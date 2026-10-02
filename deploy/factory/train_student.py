#!/usr/bin/env python3
"""
NAWAT Student Trainer — مدرب الطالب
يغذّي النموذج الطالب بالبيانات المولّدة من المعلم (QLoRA + Unsloth).
"""
import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

# ============================================================
# الإعدادات
# ============================================================
DEFAULT_BASE_MODEL = "Qwen/Qwen3-4B-Instruct-2507"
DEFAULT_MAX_SEQ_LEN = 2048
DEFAULT_BATCH_SIZE = 1
DEFAULT_GRAD_ACCUM = 4
DEFAULT_LEARNING_RATE = 2e-4
DEFAULT_EPOCHS = 3


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERROR": "❌", "STEP": "▶️"}
    print(f"[{ts}] {icons.get(level, '•')} {msg}", flush=True)


# ============================================================
# فحص المتطلبات
# ============================================================
def check_dependencies():
    """يتأكد من تثبيت المكتبات المطلوبة"""
    missing = []
    for pkg in ["torch", "transformers", "peft", "trl", "datasets", "bitsandbytes"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        log(f"❌ مكتبات ناقصة: {', '.join(missing)}", "ERROR")
        log("   ثبّتها بالأمر التالي:", "INFO")
        log(f"   pip install {' '.join(missing)}", "INFO")
        return False
    return True


def check_cuda():
    """يتحقق من توفر كرت الشاشة"""
    try:
        import torch
        if torch.cuda.is_available():
            name = torch.cuda.get_device_name(0)
            mem = torch.cuda.get_device_properties(0).total_memory / 1e9
            log(f"✅ CUDA متاح: {name} ({mem:.1f} GB)", "OK")
            return True
        else:
            log("⚠️ CUDA غير متاح — سيكون التدريب على CPU (بطيء جداً)", "WARN")
            return False
    except Exception as e:
        log(f"❌ خطأ في فحص CUDA: {e}", "ERROR")
        return False


# ============================================================
# توليد سكربت التدريب (Python مؤقت)
# ============================================================
TRAIN_SCRIPT_TEMPLATE = '''
import os
import json
import torch
from datetime import datetime
from pathlib import Path
from datasets import Dataset
from transformers import TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTTrainer

# ============================================================
# الإعدادات من argparse (تُمرر من الأب)
# ============================================================
import sys
args_dict = json.loads(sys.argv[1])

BASE_MODEL = args_dict["base_model"]
DATASET_PATH = args_dict["dataset"]
OUTPUT_DIR = args_dict["output"]
MAX_SEQ_LEN = args_dict["max_seq_len"]
BATCH_SIZE = args_dict["batch_size"]
GRAD_ACCUM = args_dict["grad_accum"]
LEARNING_RATE = args_dict["learning_rate"]
EPOCHS = args_dict["epochs"]
MAX_STEPS = args_dict["max_steps"]

print(f"📥 تحميل النموذج: {BASE_MODEL}", flush=True)

# ============================================================
# إعداد التكميم 4-bit (QLoRA)
# ============================================================
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)

model = prepare_model_for_kbit_training(model)

# ============================================================
# LoRA
# ============================================================
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ============================================================
# تحميل البيانات
# ============================================================
print(f"📊 تحميل البيانات: {DATASET_PATH}", flush=True)
data = []
with open(DATASET_PATH, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            data.append(json.loads(line))

print(f"   عدد الأمثلة: {len(data)}", flush=True)

def format_sample(item):
    """تنسيق Qwen chat template"""
    instruction = item["instruction"]
    output = item["output"]
    text = f"<|im_start|>user\\n{instruction}<|im_end|>\\n<|im_start|>assistant\\n{output}<|im_end|>"
    return {"text": text}

dataset = Dataset.from_list([format_sample(d) for d in data])
dataset = dataset.train_test_split(test_size=0.05, seed=42)
train_ds = dataset["train"]
eval_ds = dataset["test"]
print(f"   تدريب: {len(train_ds)} | تقييم: {len(eval_ds)}", flush=True)

# ============================================================
# التدريب
# ============================================================
os.makedirs(OUTPUT_DIR, exist_ok=True)

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    warmup_steps=10,
    num_train_epochs=EPOCHS,
    max_steps=MAX_STEPS if MAX_STEPS > 0 else -1,
    learning_rate=LEARNING_RATE,
    fp16=True,
    logging_steps=5,
    save_strategy="steps",
    save_steps=50,
    eval_strategy="steps",
    eval_steps=50,
    optim="paged_adamw_8bit",
    weight_decay=0.01,
    lr_scheduler_type="cosine",
    report_to="none",
    seed=42,
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    eval_dataset=eval_ds,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LEN,
    packing=False,
    args=training_args,
)

print("🚀 بدء التدريب...", flush=True)
result = trainer.train()
print(f"✅ اكتمل التدريب: {result.metrics}", flush=True)

# ============================================================
# الحفظ
# ============================================================
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"💾 حفظ في: {OUTPUT_DIR}", flush=True)
'''


# ============================================================
# الوظيفة الرئيسية
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="NAWAT Student Trainer")
    parser.add_argument("--dataset", required=True, help="مسار ملف JSONL")
    parser.add_argument("--output", required=True, help="مجلد الحفظ")
    parser.add_argument("--base-model", default=DEFAULT_BASE_MODEL)
    parser.add_argument("--max-seq-len", type=int, default=DEFAULT_MAX_SEQ_LEN)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--grad-accum", type=int, default=DEFAULT_GRAD_ACCUM)
    parser.add_argument("--learning-rate", type=float, default=DEFAULT_LEARNING_RATE)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--max-steps", type=int, default=0, help="0 = epochs كاملة")
    parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()

    # ============================================================
    # التحضير
    # ============================================================
    log("=" * 60, "STEP")
    log("🎓 تدريب الطالب (Student Training)", "STEP")
    log("=" * 60, "STEP")

    # فحص المتطلبات
    if not check_dependencies():
        sys.exit(1)

    has_gpu = check_cuda()
    if not has_gpu:
        log("⚠️ لا يمكن المتابعة بدون GPU (سيكون بطيئاً جداً)", "WARN")
        if input("استمرار على CPU؟ [y/N]: ").strip().lower() != "y":
            sys.exit(0)

    # فحص البيانات
    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        log(f"❌ ملف البيانات غير موجود: {dataset_path}", "ERROR")
        sys.exit(1)

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = [json.loads(l) for l in f if l.strip()]

    if len(samples) < 10:
        log(f"⚠️ عدد الأمثلة قليل جداً ({len(samples)}). التدريب سيكون ضعيفاً.", "WARN")

    log(f"📊 عدد الأمثلة: {len(samples)}", "OK")
    log(f"📁 مجلد الحفظ: {args.output}", "OK")

    # ============================================================
    # بناء سكربت التدريب
    # ============================================================
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    train_script = output_dir / "_train_internal.py"
    train_script.write_text(TRAIN_SCRIPT_TEMPLATE, encoding="utf-8")

    config = {
        "base_model": args.base_model,
        "dataset": str(dataset_path),
        "output": str(output_dir),
        "max_seq_len": args.max_seq_len,
        "batch_size": args.batch_size,
        "grad_accum": args.grad_accum,
        "learning_rate": args.learning_rate,
        "epochs": args.epochs,
        "max_steps": args.max_steps,
    }

    config_file = output_dir / "training_config.json"
    config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.dry_run:
        log("🧪 وضع المعاينة — لن يُنفّذ التدريب", "WARN")
        log(json.dumps(config, ensure_ascii=False, indent=2), "INFO")
        return

    # ============================================================
    # تشغيل التدريب
    # ============================================================
    log("=" * 60, "STEP")
    log("🚀 بدء التدريب...", "STEP")
    log("=" * 60, "STEP")

    config_json = json.dumps(config)
    cmd = [sys.executable, str(train_script), config_json]

    start_time = datetime.now()
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )

        for line in process.stdout:
            print(line, end="", flush=True)

        process.wait()

    except KeyboardInterrupt:
        log("⛔ تم الإيقاف يدوياً", "WARN")
        process.terminate()
        sys.exit(1)

    elapsed = (datetime.now() - start_time).total_seconds() / 60

    # ============================================================
    # التقرير
    # ============================================================
    log("=" * 60, "STEP")
    log("📊 التقرير النهائي", "STEP")
    log("=" * 60, "STEP")

    if process.returncode == 0:
        log(f"✅ اكتمل التدريب في {elapsed:.1f} دقيقة", "OK")
        log(f"📁 النموذج: {output_dir}", "OK")

        # حساب الحجم
        total_size = sum(f.stat().st_size for f in output_dir.rglob("*") if f.is_file())
        log(f"📦 الحجم: {total_size / 1e9:.2f} GB", "INFO")

        # حفظ تقرير
        report = {
            "status": "success",
            "duration_minutes": round(elapsed, 2),
            "output_dir": str(output_dir),
            "dataset": str(dataset_path),
            "samples": len(samples),
            "base_model": args.base_model,
            "completed_at": datetime.now().isoformat(),
        }
        (output_dir / "training_report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        log("🎉 اكتمل بنجاح", "OK")
    else:
        log(f"❌ فشل التدريب (exit code: {process.returncode})", "ERROR")
        sys.exit(1)


if __name__ == "__main__":
    main()
