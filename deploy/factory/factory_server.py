#!/usr/bin/env python3
"""
NAWAT Factory Server — خادم مصنع النماذج
يوفّر REST API على المنفذ 8789 لإدارة قائمة المهام والعمليات.
"""
import os
import json
import time
import threading
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ============================================================
# الإعدادات
# ============================================================
WORKSPACE = Path("/workspace")
QUEUE_FILE = WORKSPACE / "factory_queue.json"
LOG_DIR = WORKSPACE / "logs"
DATASETS_DIR = WORKSPACE / "datasets"
MODELS_DIR = WORKSPACE / "models"
for d in [LOG_DIR, DATASETS_DIR, MODELS_DIR]:
    d.mkdir(exist_ok=True)

OLLAMA_URL = "http://localhost:11434"
BRIDGE_URL = "http://localhost:8787"
SERVER_PORT = 8789

# حالة العامل
worker_state = {
    "running": False,
    "current_task": None,
    "last_update": None,
    "stats": {
        "total_generated": 0,
        "total_failed": 0,
        "total_deployed": 0,
        "started_at": None
    }
}

# ============================================================
# أدوات مساعدة
# ============================================================
def log(msg, level="INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    with open(LOG_DIR / "factory.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")

def json_response(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

def text_response(handler, text, status=200, content_type="text/plain"):
    body = text.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", f"{content_type}; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

# ============================================================
# إدارة قائمة المهام
# ============================================================
def load_queue():
    if not QUEUE_FILE.exists():
        return {"tasks": [], "completed": [], "failed": []}
    try:
        return json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"tasks": [], "completed": [], "failed": []}

def save_queue(q):
    QUEUE_FILE.write_text(
        json.dumps(q, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

# ============================================================
# عمليات المصنع
# ============================================================
def check_ollama():
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5) as r:
            data = json.loads(r.read())
            return True, [m["name"] for m in data.get("models", [])]
    except Exception as e:
        return False, []

def call_teacher(teacher, prompt, timeout=120):
    """يستدعي المعلم ويُرجع الرد"""
    payload = json.dumps({
        "model": teacher,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.6, "num_predict": 1024}
    }).encode()
    
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read()).get("response", "").strip()

def generate_dataset(version, teacher, prompts, output_dir=None):
    """يولّد مجموعة بيانات كاملة"""
    if output_dir is None:
        output_dir = DATASETS_DIR / version
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_file = output_dir / f"{version}_dataset.jsonl"
    
    log(f"📝 بدء توليد {len(prompts)} مثال لـ {version} من {teacher}")
    
    results = []
    failed = 0
    
    for i, prompt in enumerate(prompts, 1):
        try:
            answer = call_teacher(teacher, prompt)
            if answer and len(answer) > 20:
                results.append({
                    "instruction": prompt,
                    "input": "",
                    "output": answer,
                    "teacher": teacher,
                    "generated_at": datetime.now().isoformat()
                })
                log(f"  ✅ [{i}/{len(prompts)}] {prompt[:60]}")
            else:
                failed += 1
                log(f"  ⚠️ [{i}] رد قصير", "WARN")
        except Exception as e:
            failed += 1
            log(f"  ❌ [{i}] {e}", "ERROR")
    
    # حفظ
    with open(dataset_file, "w", encoding="utf-8") as f:
        for item in results:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    
    log(f"💾 حُفظ {len(results)} مثال ({failed} فشل) في {dataset_file}")
    
    worker_state["stats"]["total_generated"] += len(results)
    worker_state["stats"]["total_failed"] += failed
    
    return {
        "success": True,
        "version": version,
        "total": len(results),
        "failed": failed,
        "file": str(dataset_file)
    }

# ============================================================
# العامل (Worker Thread)
# ============================================================
def worker_loop():
    """حلقة العامل الخلفية — تعالج المهام من قائمة الانتظار"""
    log("🔧 بدء حلقة العامل")
    worker_state["running"] = True
    worker_state["stats"]["started_at"] = datetime.now().isoformat()
    
    while worker_state["running"]:
        try:
            queue = load_queue()
            
            # ابحث عن مهمة معلقة
            pending = [t for t in queue["tasks"] if t.get("status") == "pending"]
            
            if not pending:
                time.sleep(5)
                continue
            
            # خذ أول مهمة
            task = pending[0]
            worker_state["current_task"] = task
            task["status"] = "running"
            task["started_at"] = datetime.now().isoformat()
            save_queue(queue)
            
            log(f"▶️ بدء المهمة: {task['version']}")
            
            try:
                if task["type"] == "generate_data":
                    # اقرأ المطالبات
                    prompts_file = Path(task.get("prompts_file", ""))
                    if prompts_file.exists():
                        prompts = [
                            l.strip() for l in prompts_file.read_text(encoding="utf-8").splitlines()
                            if l.strip() and not l.startswith("#")
                        ]
                    else:
                        prompts = task.get("prompts", [])
                    
                    if not prompts:
                        raise ValueError("لا توجد مطالبات")
                    
                    result = generate_dataset(
                        task["version"],
                        task["teacher"],
                        prompts,
                        task.get("output_dir")
                    )
                    
                    task["status"] = "completed"
                    task["result"] = result
                    task["completed_at"] = datetime.now().isoformat()
                    queue["completed"].append(task)
                
                elif task["type"] == "deploy":
                    # رفع النموذج إلى السيرفر
                    log(f"📤 نشر {task['version']} إلى {task.get('server')}")
                    # TODO: تنفيذ منطق النشر
                    task["status"] = "completed"
                    queue["completed"].append(task)
                
                else:
                    raise ValueError(f"نوع مهمة غير معروف: {task['type']}")
            
            except Exception as e:
                log(f"❌ فشل المهمة {task['version']}: {e}", "ERROR")
                task["status"] = "failed"
                task["error"] = str(e)
                task["failed_at"] = datetime.now().isoformat()
                queue["failed"].append(task)
            
            # احذف المهمة من القائمة
            queue["tasks"] = [t for t in queue["tasks"] if t.get("task_id") != task.get("task_id")]
            if task not in queue["tasks"] and task.get("status") in ["completed", "failed"]:
                queue["tasks"] = [t for t in queue["tasks"] if t["version"] != task["version"] or t.get("status") not in ["completed", "failed"]]
            
            worker_state["current_task"] = None
            worker_state["last_update"] = datetime.now().isoformat()
            save_queue(queue)
            
            log(f"✔️ انتهت المهمة: {task['version']} → {task['status']}")
        
        except Exception as e:
            log(f"❌ خطأ في العامل: {e}", "ERROR")
            time.sleep(5)
    
    log("🛑 توقف العامل")

# ============================================================
# HTTP Server
# ============================================================
class FactoryHandler(BaseHTTPRequestHandler):
    
    def log_message(self, fmt, *args):
        pass  # صامت
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # الصفحة الرئيسية (HTML)
        if path == "/" or path == "/factory":
            html_file = Path(__file__).parent / "factory_page.html"
            if html_file.exists():
                text_response(self, html_file.read_text(encoding="utf-8"), content_type="text/html")
            else:
                text_response(self, "NAWAT Factory API", content_type="text/plain")
        
        elif path == "/api/status":
            ok, models = check_ollama()
            json_response(self, {
                "server": "online",
                "ollama": {"online": ok, "models_count": len(models)},
                "worker": worker_state,
                "timestamp": datetime.now().isoformat()
            })
        
        elif path == "/api/models":
            ok, models = check_ollama()
            json_response(self, {"models": models})
        
        elif path == "/api/queue":
            queue = load_queue()
            json_response(self, queue)
        
        elif path == "/api/logs":
            log_file = LOG_DIR / "factory.log"
            if log_file.exists():
                lines = log_file.read_text(encoding="utf-8").splitlines()
                json_response(self, {"lines": lines[-200:]})
            else:
                json_response(self, {"lines": []})
        
        elif path == "/api/stats":
            json_response(self, worker_state["stats"])
        
        elif path == "/api/datasets":
            datasets = []
            for d in DATASETS_DIR.iterdir():
                if d.is_dir():
                    files = list(d.glob("*.jsonl"))
                    total = sum(1 for f in files for _ in f.open(encoding="utf-8"))
                    datasets.append({
                        "version": d.name,
                        "files": len(files),
                        "samples": total,
                        "size_mb": round(sum(f.stat().st_size for f in files) / 1e6, 2)
                    })
            json_response(self, {"datasets": datasets})
        
        else:
            json_response(self, {"error": "not found"}, 404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        # قراءة البيانات
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        
        try:
            data = json.loads(body)
        except Exception:
            data = {}
        
        if path == "/api/queue/add":
            version = data.get("version", "").strip()
            teacher = data.get("teacher", "").strip()
            task_type = data.get("type", "generate_data")
            prompts = data.get("prompts", [])
            prompts_file = data.get("prompts_file", "")
            
            if not version or not teacher:
                json_response(self, {"error": "version و teacher مطلوبان"}, 400)
                return
            
            queue = load_queue()
            task = {
                "task_id": f"{version}-{int(time.time())}",
                "version": version,
                "teacher": teacher,
                "type": task_type,
                "prompts": prompts,
                "prompts_file": prompts_file,
                "status": "pending",
                "created": datetime.now().isoformat()
            }
            queue["tasks"].append(task)
            save_queue(queue)
            
            log(f"➕ مهمة جديدة: {version} (teacher: {teacher})")
            json_response(self, {"success": True, "task": task})
        
        elif path == "/api/worker/start":
            if not worker_state["running"]:
                t = threading.Thread(target=worker_loop, daemon=True)
                t.start()
                json_response(self, {"success": True, "message": "Worker started"})
            else:
                json_response(self, {"success": True, "message": "Worker already running"})
        
        elif path == "/api/worker/stop":
            worker_state["running"] = False
            json_response(self, {"success": True, "message": "Worker stopping..."})
        
        elif path == "/api/test":
            # اختبار سريع لمعلم
            teacher = data.get("teacher", "nawat-think:v17-anon")
            prompt = data.get("prompt", "قل مرحبا فقط")
            try:
                answer = call_teacher(teacher, prompt)
                json_response(self, {"success": True, "answer": answer})
            except Exception as e:
                json_response(self, {"success": False, "error": str(e)}, 500)
        
        else:
            json_response(self, {"error": "not found"}, 404)
    
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path.startswith("/api/queue/task/"):
            task_id = path.split("/")[-1]
            queue = load_queue()
            before = len(queue["tasks"])
            queue["tasks"] = [t for t in queue["tasks"] if t.get("task_id") != task_id]
            save_queue(queue)
            json_response(self, {"success": True, "removed": before - len(queue["tasks"])})
        
        elif path == "/api/queue/clear":
            queue = load_queue()
            queue["tasks"] = []
            save_queue(queue)
            json_response(self, {"success": True})
        
        else:
            json_response(self, {"error": "not found"}, 404)

# ============================================================
# التشغيل
# ============================================================
def main():
    log("=" * 60)
    log(f"🏭 خادم المصنع — المنفذ {SERVER_PORT}")
    log("=" * 60)
    
    # ابدأ العامل تلقائياً
    t = threading.Thread(target=worker_loop, daemon=True)
    t.start()
    
    server = HTTPServer(("0.0.0.0", SERVER_PORT), FactoryHandler)
    log(f"✅ الخادم يعمل على http://0.0.0.0:{SERVER_PORT}")
    log(f"🌐 الصفحة: http://localhost:{SERVER_PORT}/factory")
    log(f"📡 API: http://localhost:{SERVER_PORT}/api/status")
    log("=" * 60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("🛑 إيقاف الخادم...")
        worker_state["running"] = False
        server.shutdown()

if __name__ == "__main__":
    main()
