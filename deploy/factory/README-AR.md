# مصنع NAWAT — التشغيل على السيرفر 192.168.100.67

انسخ الملفات إلى `/workspace` ثم:

```bash
pip install torch transformers peft trl datasets bitsandbytes
pm2 start factory_server.py --interpreter python3 --name nawat-factory   # المنفذ 8789
python3 generate_data.py --teacher nawat-think:v17-anon --prompts prompts.txt
python3 train_student.py --data datasets/v18.jsonl
```

المراحل: التوثيق (الهوية والبصمة) ← توليد البيانات ← فحص الجودة ← التدريب QLoRA ← الدمج وGGUF ← التكميم ← المقارنة ← الإنتاج.
صفحة المصنع داخل التطبيق: `/factory` (زر "المصنع" أعلى الإعدادات). `factory.html` نسخة مستقلة.
