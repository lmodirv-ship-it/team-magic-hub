# تثبيت نوات على السيرفر 192.168.100.67

## المتطلبات
Ubuntu/Debian · Node.js 20+ · Bun · Git · PM2 · Docker (لـ Supabase المحلية) · Ollama (اختياري)

## 1) قاعدة البيانات المحلية
```
npx supabase init && npx supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f deploy/schema.sql
npx supabase status   # انسخ المفاتيح إلى .env
```

## 2) التثبيت
```
bash deploy/install.sh https://github.com/<حسابك>/<المستودع>.git
nano /opt/nawat/.env && pm2 restart all
```

## 3) المزامنة التلقائية
كل تعديل في Lovable يُدفع إلى GitHub، والسيرفر يسحبه كل 5 دقائق (deploy/update.sh) ويعيد البناء تلقائيًا.
للتحديث الفوري: `/opt/nawat/deploy/update.sh`

## 4) إعدادات النماذج (جديد)
في `.env`:
```
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_FALLBACKS=http://192.168.2.4:11434   # احتياط تلقائي
QWEN_NO_THINK=1                              # ردود qwen3 قصيرة بدون تفكير مطوّل
MODEL_STORAGE_PATH=/data/model               # قرص البيانات HDD
COMFY_URL=http://192.168.2.4:8188
```
ثم `pm2 restart all`. حالة السيرفر تظهر في صفحة المنافذ (مسار `/api/system`).

## 5) رفع ملفات الموديل G:\model (91 GiB) إلى /data/model
المساحة المتاحة 422 GiB تكفي. من Windows:
```
scp -r "G:\model\*" nawat@192.168.100.67:/data/model/
```
أو RealFTP عبر sftp://192.168.100.67 (منفذ 22). السرعة محدودة بـ 100 Mbps حتى يُنقل الكابل لمنفذ Gigabit.

## 6) صيانة
```
sudo apt install -y smartmontools && sudo smartctl -H /dev/sda && sudo smartctl -H /dev/sdb
# أعد تشغيل ComfyUI على 192.168.2.4 ثم تحقق: curl http://192.168.2.4:8188/system_stats
sudo shutdown -r 03:00   # جدولة إعادة التشغيل المطلوبة
```

## 7) نسخة الحاسوب
- PWA: افتح الموقع في Chrome/Edge ← "تثبيت التطبيق".
- Windows: نزّل NAWAT-Desktop-win64.zip من صفحة المنافذ وشغّل NAWAT-Desktop.exe. يفتح السيرفر المحلي أولًا ثم العنوان الرسمي، وكل تعديل منشور يظهر تلقائيًا.
