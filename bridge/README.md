# جسر NAWAT (المنفذ 8788)

يربط **تطبيق الهاتف** و**الموقع المنشور** بخدمات الخادم `192.168.100.66` (Ollama وComfyUI).

## التشغيل على الخادم
```bash
# Node 18 أو أحدث، بلا تثبيت حزم
node bridge/server.mjs
```
متغيرات اختيارية:

| المتغير | الافتراضي |
|---|---|
| `BRIDGE_PORT` | `8788` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `COMFY_URL` | `http://192.168.2.4:8188` |
| `DEFAULT_MODEL` | `nawat-coder:latest` |
| `BRIDGE_TOKEN` | فارغ (يُنصح بتعيينه عند الفتح للإنترنت) |
| `ALLOWED_ORIGINS` | الموقع المنشور + المنصة + localhost |

تشغيل دائم مع إعادة التشغيل: `npx pm2 start bridge/server.mjs --name nawat-bridge && npx pm2 save`

## نقاط الاتصال
- `GET /api/ping` — فحص سريع (بلا رمز)
- `GET /api/health` — حالة Ollama وComfyUI
- `GET /api/models` — قائمة النماذج المثبتة
- `POST /api/chat` — `{ model, messages, think, image, stream }`
- `POST /api/image` — `{ prompt, width, height, steps }` ← صورة base64

## 1) الهاتف ↔ الخادم (نفس الشبكة)
في التطبيق: عنوان الجسر `http://192.168.100.66:8788` ثم «اختبار».

## 2) الموقع المنشور ↔ الخادم (عبر الإنترنت)
الموقع يعمل بـ HTTPS، والمتصفح يمنع الاتصال بعنوان HTTP محلي. الحل: نفق HTTPS مجاني:
```bash
BRIDGE_TOKEN=كلمة-سر-قوية node bridge/server.mjs
cloudflared tunnel --url http://localhost:8788
```
انسخ الرابط `https://....trycloudflare.com` وضعه كعنوان الجسر في الموقع والهاتف معًا — يعمل حينها من أي مكان.

## 3) الجسر السحابي (بلا نفق ولا فتح منافذ)
الوكيل على الخادم يتصل بالموقع المنشور ويسحب الطلبات:
```bash
node bridge/server.mjs &
RELAY_TOKEN=كلمة-سر-الجسر-السحابي node bridge/cloud-agent.mjs
```
في الهاتف: الإعدادات ← الاتصال ← «سحابي» ثم اكتب نفس كلمة السر.
نقاط المرحّل: `/api/public/relay/status | submit | result/:id | pull | done`.
