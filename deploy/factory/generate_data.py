#!/usr/bin/env python3
"""
NAWAT Data Generator — مولّد بيانات التدريب
يستدعي المعلم (Ollama) لكل مطالبة ويحفظ الأجوبة في JSONL.
"""
import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ============================================================
# الإعدادات الافتراضية
# ============================================================
DEFAULT_OLLAMA = "http://localhost:11434"
DEFAULT_TEACHER = "nawat-think:v17-anon"
DEFAULT_TEMP = 0.6
DEFAULT_MAX_TOKENS = 1024
DEFAULT_TIMEOUT = 180
DEFAULT_RETRIES = 3

# ============================================================
# أدوات مساعدة
# ============================================================
def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERROR": "❌", "STEP": "▶️"}
    print(f"[{ts}] {icons.get(level, '•')} {msg}", flush=True)


def sanitize_text(text):
    """تنظيف النص من الرموز الضارة"""
    if not text:
        return ""
    # إزالة رموز التحكم
    text = text.replace("\x00", "").replace("\r\n", "\n")
    # إزالة المسافات الزائدة
    lines = [l.rstrip() for l in text.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines).strip()


def validate_sample(instruction, output, min_output=20, max_output=8000):
    """يتحقق من جودة المثال"""
    if not instruction or not instruction.strip():
        return False, "instruction فارغ"
    if not output or len(output) < min_output:
        return False, f"output قصير (<{min_output})"
    if len(output) > max_output:
        return False, f"output طويل (>{max_output})"
    # فحص التكرار المفرط
    words = output.split()
    if len(words) > 30:
        unique_ratio = len(set(words)) / len(words)
        if unique_ratio < 0.20:
            return False, "تكرار مفرط"
    return True, ""


# ============================================================
# استدعاء المعلم (Ollama API)
# ============================================================
def call_teacher(ollama_url, teacher, prompt, temperature, max_tokens, timeout):
    """يرسل مطالبة إلى المعلم ويُرجع الرد"""
    payload = json.dumps({
        "model": teacher,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{ollama_url}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode("utf-8"))
        return data.get("response", "")


def process_one(args_tuple):
    """يعالج مطالبة واحدة مع إعادة المحاولة"""
    idx, prompt, config = args_tuple
    last_error = None

    for attempt in range(1, config["retries"] + 1):
        try:
            answer = call_teacher(
                config["ollama_url"],
                config["teacher"],
                prompt,
                config["temperature"],
                config["max_tokens"],
                config["timeout"]
            )
            answer = sanitize_text(answer)

            is_valid, reason = validate_sample(prompt, answer)
            if not is_valid:
                last_error = f"غير صالح: {reason}"
                time.sleep(1)
                continue

            return {
                "success": True,
                "index": idx,
                "prompt": prompt,
                "data": {
                    "instruction": prompt,
                    "input": "",
                    "output": answer,
                    "teacher": config["teacher"],
                    "generated_at": datetime.now().isoformat(),
                }
            }

        except urllib.error.URLError as e:
            last_error = f"خطأ اتصال: {e}"
            time.sleep(2 * attempt)
        except Exception as e:
            last_error = f"خطأ: {e}"
            time.sleep(1)

    return {
        "success": False,
        "index": idx,
        "prompt": prompt,
        "error": last_error or "فشل غير معروف"
    }


# ============================================================
# إدارة النماذج (تحميل وإفراغ)
# ============================================================
def preload_model(ollama_url, teacher):
    """يحمل النموذج في الذاكرة قبل البدء"""
    log(f"⏳ تحميل المعلم: {teacher}", "STEP")
    try:
        payload = json.dumps({
            "model": teacher,
            "prompt": "test",
            "stream": False,
            "options": {"num_predict": 1}
        }).encode()
        req = urllib.request.Request(
            f"{ollama_url}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            r.read()
        log(f"✅ المعلم جاهز: {teacher}", "OK")
        return True
    except Exception as e:
        log(f"❌ فشل تحميل المعلم: {e}", "ERROR")
        return False


def check_ollama(ollama_url):
    """يتحقق من أن Ollama يعمل"""
    try:
        with urllib.request.urlopen(f"{ollama_url}/api/tags", timeout=5) as r:
            data = json.loads(r.read())
            return True, [m["name"] for m in data.get("models", [])]
    except Exception as e:
        return False, []


# ============================================================
# الوظيفة الرئيسية
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="NAWAT Data Generator")
    parser.add_argument("--version", required=True, help="رقم الإصدار (r18)")
    parser.add_argument("--teacher", default=DEFAULT_TEACHER, help="اسم المعلم")
    parser.add_argument("--prompts", required=True, help="مسار ملف المطالبات")
    parser.add_argument("--output", required=True, help="مجلد المخرجات")
    parser.add_argument("--ollama", default=DEFAULT_OLLAMA, help="عنوان Ollama")
    parser.add_argument("--temperature", type=float, default=DEFAULT_TEMP)
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES)
    parser.add_argument("--workers", type=int, default=1, help="عدد العمال المتوازيين (1 للنماذج المحلية)")
    parser.add_argument("--limit", type=int, default=0, help="حد أقصى للمطالبات (0 = الكل)")
    parser.add_argument("--resume", action="store_true", help="استئناف من ملف موجود")

    args = parser.parse_args()

    # ============================================================
    # التحضير
    # ============================================================
    log("=" * 60, "STEP")
    log(f"📝 توليد بيانات: {args.version}", "STEP")
    log(f"👨‍🏫 المعلم: {args.teacher}", "STEP")
    log("=" * 60, "STEP")

    # فحص Ollama
    ok, models = check_ollama(args.ollama)
    if not ok:
        log(f"❌ Ollama غير متاح على {args.ollama}", "ERROR")
        sys.exit(1)

    if args.teacher not in models:
        log(f"⚠️ المعلم '{args.teacher}' غير موجود", "WARN")
        log(f"   المتوفر: {', '.join(models[:5])}...", "WARN")
        # نستمر على أي حال، فقد يكون اسماً بديلاً

    log(f"✅ Ollama يعمل ({len(models)} نموذج متاح)", "OK")

    # ============================================================
    # قراءة المطالبات
    # ============================================================
    prompts_file = Path(args.prompts)
    if not prompts_file.exists():
        log(f"❌ ملف المطالبات غير موجود: {prompts_file}", "ERROR")
        sys.exit(1)

    prompts = []
    for line in prompts_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            prompts.append(line)

    if args.limit > 0:
        prompts = prompts[:args.limit]

    if not prompts:
        log("❌ لا توجد مطالبات صالحة", "ERROR")
        sys.exit(1)

    log(f"📊 عدد المطالبات: {len(prompts)}", "OK")

    # ============================================================
    # مجلد المخرجات
    # ============================================================
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_file = output_dir / f"{args.version}_dataset.jsonl"

    # استئناف
    existing = []
    if args.resume and dataset_file.exists():
        with open(dataset_file, "r", encoding="utf-8") as f:
            existing = [json.loads(l) for l in f if l.strip()]
        log(f"🔄 استئناف: {len(existing)} مثال موجود", "WARN")
        # استبعاد المطالبات الموجودة
        done_prompts = {e["instruction"] for e in existing}
        prompts = [p for p in prompts if p not in done_prompts]
        log(f"📊 المتبقي: {len(prompts)} مطالبة", "OK")

    if not prompts:
        log("✅ لا شيء للتنفيذ — كل المطالبات مُنفّذة", "OK")
        return

    # ============================================================
    # تحميل المعلم مسبقاً (لتجنب timeout أول استدعاء)
    # ============================================================
    if not preload_model(args.ollama, args.teacher):
        log("⚠️ قد تكون أول استدعاءات بطيئة", "WARN")

    # ============================================================
    # معالجة المطالبات
    # ============================================================
    config = {
        "ollama_url": args.ollama,
        "teacher": args.teacher,
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "timeout": args.timeout,
        "retries": args.retries,
    }

    log("=" * 60, "STEP")
    log(f"🚀 بدء التوليد ({args.workers} عامل)", "STEP")
    log("=" * 60, "STEP")

    start_time = time.time()
    results = list(existing)
    failed = []
    completed = 0

    try:
        if args.workers == 1:
            # تسلسلي (أسرع للنماذج المحلية)
            for idx, prompt in enumerate(prompts, 1):
                result = process_one((idx, prompt, config))
                completed += 1

                if result["success"]:
                    results.append(result["data"])
                    preview = prompt[:50].replace("\n", " ")
                    log(f"[{completed}/{len(prompts)}] ✅ {preview}...", "OK")
                else:
                    failed.append({"instruction": prompt, "error": result["error"]})
                    preview = prompt[:50].replace("\n", " ")
                    log(f"[{completed}/{len(prompts)}] ❌ {preview}... → {result['error']}", "ERROR")

                # حفظ دوري كل 10 عناصر
                if completed % 10 == 0:
                    _save_dataset(dataset_file, results)
                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    eta = (len(prompts) - completed) / rate if rate > 0 else 0
                    log(f"   💾 حفظ {len(results)} | ⏱️ {elapsed:.0f}ث | ETA {eta:.0f}ث", "INFO")

        else:
            # متوازي (للسيرفرات متعددة الأنوية)
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futures = {ex.submit(process_one, (i, p, config)): i for i, p in enumerate(prompts, 1)}
                for fut in as_completed(futures):
                    result = fut.result()
                    completed += 1

                    if result["success"]:
                        results.append(result["data"])
                        preview = result["prompt"][:50].replace("\n", " ")
                        log(f"[{completed}/{len(prompts)}] ✅ {preview}...", "OK")
                    else:
                        failed.append({"instruction": result["prompt"], "error": result["error"]})
                        preview = result["prompt"][:50].replace("\n", " ")
                        log(f"[{completed}/{len(prompts)}] ❌ {preview}...", "ERROR")

                    if completed % 10 == 0:
                        _save_dataset(dataset_file, results)

    except KeyboardInterrupt:
        log("⛔ تم الإيقاف يدوياً", "WARN")
    finally:
        _save_dataset(dataset_file, results)

    # ============================================================
    # التقرير النهائي
    # ============================================================
    elapsed = time.time() - start_time
    log("=" * 60, "STEP")
    log("📊 التقرير النهائي", "STEP")
    log("=" * 60, "STEP")
    log(f"✅ نجح: {len(results)}", "OK")
    log(f"❌ فشل: {len(failed)}", "ERROR")
    log(f"⏱️ المدة: {elapsed:.1f} ثانية", "INFO")
    log(f"📄 الملف: {dataset_file}", "OK")
    log(f"📦 الحجم: {dataset_file.stat().st_size / 1024:.1f} KB", "INFO")

    # حفظ الفاشلة
    if failed:
        failed_file = output_dir / f"{args.version}_failed.jsonl"
        with open(failed_file, "w", encoding="utf-8") as f:
            for item in failed:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        log(f"📄 الفاشلة: {failed_file}", "WARN")

    # فحص الجودة السريع
    if results:
        avg_len = sum(len(r["output"]) for r in results) / len(results)
        log(f"📏 متوسط طول الرد: {avg_len:.0f} حرف", "INFO")

    log("🎉 اكتمل التوليد", "OK")


def _save_dataset(path, results):
    """حفظ البيانات في JSONL"""
    with open(path, "w", encoding="utf-8") as f:
        for item in results:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


# ============================================================
# نقطة الدخول
# ============================================================
if __name__ == "__main__":
    main()
