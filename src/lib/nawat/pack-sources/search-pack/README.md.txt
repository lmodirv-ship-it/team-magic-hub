# 📦 NAWAT Search Pack

بحث دلالي هجين (Semantic + Keyword) على مشروعك، يعمل **محلياً بالكامل** بلا Docker ولا API خارجي.

## ⚡ التشغيل

```bash
# تأكد من core-pack
..\core-pack\start.bat

# ثم
start.bat
```

🎯 الميزات

الميزة الوصف
بحث دلالي يفهم المعنى لا الكلمات
بحث نصي يستخدم core-pack
بحث هجين يدمج الاثنين بـ RRF
فهرسة تدريجية يحفظ التقدم
مراقبة حية يحدّث الفهرس تلقائياً عند تعديل ملف
Reranking ذكي يفضّل الملفات البرمجية
RAG-ready يعيد السياق جاهزاً للنماذج
بدون Docker SQLite + JS cosine

🏗️ المعمارية

```
┌─────────────┐      ┌──────────────┐      ┌────────────┐
│  Editor /   │─────▶│  Search API  │─────▶│  SQLite    │
│  Agent      │      │   :8792      │      │  + Vectors │
└─────────────┘      └──────┬───────┘      └────────────┘
                            │
                     ┌──────▼───────┐
                     │  Embedder    │
                     │  (Ollama)    │
                     └──────────────┘
                            ▲
                     ┌──────┴───────┐
                     │  Indexer     │
                     │   :8793      │
                     │  + Watcher   │
                     └──────────────┘
```

📡 API

بحث

```bash
# دلالي
curl -X POST http://127.0.0.1:8792/search/semantic \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"كيف يتم التحقق من المستخدم\",\"limit\":5}"

# هجين (مُوصى به)
curl -X POST http://127.0.0.1:8792/search/hybrid \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"auth middleware\",\"limit\":5}"
```

فهرسة

```bash
# بدء
curl -X POST http://127.0.0.1:8792/index/start -d "{\"reset\":false}"

# الحالة
curl http://127.0.0.1:8793/index/status

# إعادة تعيين
curl -X POST http://127.0.0.1:8792/index/reset
```

RAG

```bash
curl -X POST http://127.0.0.1:8792/context \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"error handling\",\"topK\":5}"
```

📊 التكامل مع Agent

عندما يطلب الوكيل سياقاً لسؤال، يستدعي:

```javascript
const ctx = await fetch('http://127.0.0.1:8792/context', {
  method: 'POST',
  body: JSON.stringify({ query: userMessage, topK: 5 })
}).then(r => r.json());

// ctx.chunks → [{path, text, score, lineStart}]
```

⚙ الإعدادات

متغير افتراضي الوصف
EMBED_MODEL nomic-embed-text:latest نموذج التضمين
CHUNK_SIZE 600 حجم القطعة (حروف)
CHUNK_OVERLAP 80 تداخل بين القطع
WATCH_ENABLED true مراقبة الملفات
INDEX_ON_START false فهرسة تلقائية عند الإقلاع
INDEX_ROOT F:/nawat مجلد المشروع

🧪 الاختبار

```bash
test.bat
```

📁 البنية

```
search-pack/
├── src/
│   ├── chunker.js      ← تقسيم ذكي للكود
│   ├── embedder.js     ← توليد embeddings
│   ├── vectorStore.js  ← SQLite + cosine
│   ├── searchEngine.js ← منطق البحث والدمج
│   ├── reranker.js     ← تحسين الترتيب
│   ├── watcher.js      ← مراقبة الملفات
│   └── utils.js
├── server/server.js    ← API البحث
├── indexer/worker.js   ← عامل الفهرسة
└── data/
    └── index.db        ← SQLite
```

🔒 ضمانات

· محلي 100% — لا API خارجي
· بدون Docker — SQLite ملف واحد
· تدريجي — يحفظ التقدم
· آمن للانقطاع — WAL mode
· لا يفهرس الثنائيات — صور، فيديو، zip
· يتجاهل المجلدات الضخمة — node_modules, stv, إلخ

📄 الترخيص

MIT — NAWAT Team

```

---

## 🚀 التشغيل

```bash
# 1. انسخ الحزمة إلى
F:\nawat\NAWAT\forge\packs\search-pack\

# 2. ثبّت (قد يستغرق دقائق بسبب better-sqlite3)
npm install

# 3. شغّل core-pack أولاً
cd ..\core-pack & start.bat

# 4. ثم search-pack
cd ..\search-pack & start.bat
```

ملاحظة: إذا فشل تثبيت better-sqlite3 على Windows، جرّب:

```bash
npm install --build-from-source better-sqlite3
