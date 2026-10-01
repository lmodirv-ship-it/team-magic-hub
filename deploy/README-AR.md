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
