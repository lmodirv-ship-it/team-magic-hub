📦 search-pack — حزمة البحث الدلالي (RAG)

حزمة تعتمد على core-pack، تضيف بحثاً دلالياً (Semantic) + بحثاً نصياً (Hybrid) + فهرسة تلقائية + Reranking باستخدام nomic-embed-text (مُحمَّل مسبقاً في Ollama) وقاعدة بيانات متجهية محلية (بدون Docker).

---

📁 هيكل الحزمة

```
F:\nawat\NAWAT\forge\packs\search-pack\
├── pack.json
├── package.json
├── README.md
├── start.bat
├── stop.bat
├── test.bat
├── shared/                          ← نسخة محلية (أو symlink لـ core-pack/shared)
│   └── logger.js
├── server\
│   └── server.js                    ← خادم البحث الرئيسي
├── indexer\
│   ├── worker.js                    ← خادم الفهرس (Background)
│   └── scheduler.js                 ← جدولة الفهرسة
├── src\
│   ├── chunker.js                   ← تقسيم الملفات
│   ├── embedder.js                  ← توليد embeddings عبر Ollama
│   ├── vectorStore.js               ← قاعدة بيانات متجهية (SQLite)
│   ├── searchEngine.js              ← منطق البحث
│   ├── reranker.js                  ← إعادة ترتيب النتائج
│   ├── watcher.js                   ← مراقبة الملفات
│   └── utils.js
└── data\                            ← تُنشأ تلقائياً
    ├── index.db                     ← SQLite
    └── state.json                   ← آخر فهرسة
```

---

📄 1. pack.json

```json
{
  "$schema": "https://nawat.dev/schemas/pack-v1.json",
  "name": "search-pack",
  "displayName": "NAWAT Search Pack",
  "version": "1.0.0",
  "description": "بحث دلالي هجين (Semantic + Keyword) على المشروع مع فهرسة تلقائية",
  "author": "NAWAT Team",
  "license": "MIT",
  "type": "service",
  "priority": 20,

  "ports": {
    "search": 8792,
    "indexer": 8793
  },

  "depends_on": ["core-pack"],

  "provides": [
    "search.semantic",
    "search.hybrid",
    "search.reindex",
    "search.status",
    "context.retrieve"
  ],
  "consumes": [
    "file.read",
    "file.tree",
    "metrics.record",
    "events.bus"
  ],

  "env": {
    "CORE_URL": "http://127.0.0.1:8790",
    "OLLAMA_URL": "http://127.0.0.1:11434",
    "EMBED_MODEL": "nomic-embed-text:latest",
    "INDEX_ROOT": "F:/nawat",
    "CHUNK_SIZE": "600",
    "CHUNK_OVERLAP": "80",
    "MAX_CHUNKS_PER_FILE": "50",
    "INDEX_ON_START": "false",
    "WATCH_ENABLED": "true"
  },

  "endpoints": {
    "health": "/health",
    "stats": "/stats",
    "search": {
      "semantic": "POST /search/semantic",
      "hybrid": "POST /search/hybrid",
      "keyword": "POST /search/keyword"
    },
    "index": {
      "status": "GET /index/status",
      "start": "POST /index/start",
      "stop": "POST /index/stop",
      "reset": "POST /index/reset",
      "file": "POST /index/file"
    },
    "context": {
      "retrieve": "POST /context"
    }
  },

  "self_test": {
    "timeout_ms": 60000,
    "checks": [
      "core_reachable",
      "ollama_reachable",
      "embed_model_available",
      "db_writable",
      "index_small_dir",
      "semantic_search",
      "hybrid_search"
    ]
  }
}
```

---

📄 2. package.json

```json
{
  "name": "nawat-search-pack",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "description": "NAWAT Search Pack — Semantic + Hybrid Search",
  "scripts": {
    "start": "node server/server.js",
    "start:indexer": "node indexer/worker.js",
    "test": "node test/run.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^11.0.0",
    "chokidar": "^3.6.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

ملاحظة: better-sqlite3 تحتاج ترجمة. على Windows، ثبّت windows-build-tools أو استخدم Node مع Prebuild. إذا فشل التثبيت، سنقدّم بديلاً.

---

📄 3. src/utils.js

```javascript
/**
 * أدوات مساعدة
 */
const crypto = require('crypto');
const path = require('path');

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fileExt(p) {
  return (p.split('.').pop() || '').toLowerCase();
}

function isTextFile(p) {
  const ext = fileExt(p);
  const text = new Set([
    'js','mjs','cjs','jsx','ts','tsx','json','jsonl','md','markdown',
    'html','htm','css','scss','less','sass','py','rb','go','rs','java',
    'php','c','h','cpp','hpp','cc','cxx','cs','swift','kt','sh','bash',
    'ps1','bat','cmd','yml','yaml','toml','ini','cfg','conf','sql','xml',
    'vue','svelte','astro','env','gitignore','dockerignore','lock','txt',
    'log','csv','tsv','graphql','gql','proto','lua','r','pl','ex','exs',
  ]);
  return text.has(ext);
}

function isSkippedDir(name) {
  const skip = new Set([
    'node_modules','.git','.svn','.hg','dist','build','out','.next','.nuxt',
    '.cache','.parcel-cache','.turbo','coverage','.nyc_output','stv',
    'deepanalyse','.ollama','models','__pycache__','.venv','venv','env',
    '.idea','.vscode-server','.pytest_cache','.mypy_cache','.tox',
    'target','bin','obj','.gradle','.dart_tool','.expo',
  ]);
  return skip.has(name);
}

function truncate(text, n) {
  if (typeof text !== 'string') return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function nowMs() {
  return Date.now();
}

function roundTo(n, digits = 3) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

module.exports = {
  sha1, sha256, fileExt, isTextFile, isSkippedDir,
  truncate, safeJsonParse, nowMs, roundTo,
};
```

---

📄 4. src/chunker.js — تقسيم ذكي

```javascript
/**
 * Chunker — يقسم الملفات إلى قطع (chunks) ذات معنى
 *
 * الاستراتيجية:
 *  1. للكود: يكتشف حدود الدوال/الأصناف ويعتمدها
 *  2. للماركداون: يقسم حسب العناوين
 *  3. للـ JSON: يكتشف مستويات الكائنات
 *  4. Fallback: تقسيم بالسطور مع overlap
 */
const { sha1, fileExt } = require('./utils');

const DEFAULT_OPTS = {
  chunkSize: 600,       // بالحروف
  overlap: 80,
  maxChunksPerFile: 50,
};

/* ============ Anlizyzer Regex ============ */
const BOUNDARY_PATTERNS = {
  js:   /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|method)\s+[\w$]|^\s*(?:async\s+)?[\w$]+\s*\([^)]*\)\s*{/m,
  ts:   /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+[\w$]|^\s*(?:public|private|protected|static|async)?\s*[\w$]+\s*\([^)]*\)\s*[:{]/m,
  py:   /^(?:def|class|async\s+def)\s+\w+/m,
  rs:   /^(?:pub\s+)?(?:async\s+)?(?:fn|struct|enum|trait|impl|mod)\s+\w+/m,
  go:   /^func\s+|^type\s+|^var\s+|^const\s+/m,
  java: /^(?:public|private|protected|static|\s)*\s*(?:class|interface|enum|void|int|String|boolean)\s+\w+/m,
  rb:   /^(?:def|class|module)\s+\w+/m,
  php:  /^(?:public|private|protected|static)?\s*function\s+\w+/m,
  sh:   /^\w+\s*\(\)\s*{|^function\s+\w+/m,
  md:   /^#{1,6}\s+/m,
};

function getBoundaryRegex(ext) {
  if (BOUNDARY_PATTERNS[ext]) return BOUNDARY_PATTERNS[ext];
  // fallback: كل سطر يبدأ بـ 4 مسافات أو }
  return /^(?:}\s*$|[A-Z][\w$]+\s*\(|export\s|def\s|function\s)/m;
}

/**
 * يجد مواقع الحدود في النص
 */
function findBoundaries(content, ext) {
  const regex = getBoundaryRegex(ext);
  const boundaries = [0];
  let m;
  const re = new RegExp(regex.source, 'gm');
  while ((m = re.exec(content)) !== null) {
    if (m.index > 0) boundaries.push(m.index);
    if (boundaries.length > 10000) break;
  }
  boundaries.push(content.length);
  return boundaries;
}

/**
 * تقسيم ذكي — يحاول الاعتماد على الحدود
 */
function smartChunk(content, ext, opts = {}) {
  const { chunkSize, overlap, maxChunksPerFile } = { ...DEFAULT_OPTS, ...opts };

  // ملفات صغيرة
  if (content.length <= chunkSize) {
    return [content];
  }

  // ابحث عن الحدود
  const boundaries = findBoundaries(content, ext);

  // إذا كانت الحدود كثيرة جداً (ملف ضخم بلا بنية) — تقسيم ساذج
  if (boundaries.length > 500) {
    return naiveChunk(content, chunkSize, overlap, maxChunksPerFile);
  }

  const chunks = [];
  let currentStart = 0;

  for (let i = 1; i < boundaries.length; i++) {
    const candidateEnd = boundaries[i];
    const size = candidateEnd - currentStart;

    if (size >= chunkSize || i === boundaries.length - 1) {
      let end = candidateEnd;
      // لا تتجاوز الحد الأقصى بكتير
      if (size > chunkSize * 2 && i > 1) {
        end = boundaries[i - 1];
      }

      const chunkText = content.slice(currentStart, end);
      if (chunkText.trim().length > 30) {
        chunks.push(chunkText);
      }

      // overlap: ابدأ من نهاية القطعة السابقة
      currentStart = Math.max(0, end - overlap);
      if (chunks.length >= maxChunksPerFile) break;
    }
  }

  return chunks;
}

/**
 * تقسيم ساذج بالسطور (fallback)
 */
function naiveChunk(content, chunkSize, overlap, maxChunks) {
  const chunks = [];
  const lines = content.split('\n');
  let buf = [];
  let bufLen = 0;

  for (const line of lines) {
    buf.push(line);
    bufLen += line.length + 1;

    if (bufLen >= chunkSize) {
      const chunk = buf.join('\n');
      if (chunk.trim().length > 30) chunks.push(chunk);
      if (chunks.length >= maxChunks) break;

      // overlap: احتفظ بآخر ~5 أسطر
      const keep = Math.max(2, Math.ceil(overlap / 40));
      buf = buf.slice(-keep);
      bufLen = buf.reduce((a, l) => a + l.length + 1, 0);
    }
  }

  if (buf.length && chunks.length < maxChunks) {
    const chunk = buf.join('\n');
    if (chunk.trim().length > 30) chunks.push(chunk);
  }

  return chunks;
}

/**
 * الواجهة العامة — يقسم ملفاً ويعيد القطع مع معلوماتها
 */
function chunkFile({ path, content, opts }) {
  const ext = fileExt(path);
  const pieces = smartChunk(content, ext, opts);

  return pieces.map((text, i) => ({
    id: `${sha1(path)}-${i}-${sha1(text).slice(0, 8)}`,
    path,
    index: i,
    total: pieces.length,
    text,
    ext,
    charCount: text.length,
    lineStart: content.slice(0, content.indexOf(text)).split('\n').length,
  }));
}

module.exports = { chunkFile, smartChunk, naiveChunk };
```

---

📄 5. src/embedder.js — توليد Embeddings

```javascript
/**
 * Embedder — يحوّل النصوص إلى متجهات عبر Ollama
 * - Batch (متوازي محدود)
 * - Cache في الذاكرة (LRU)
 * - Retry + Timeout
 */
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.EMBED_MODEL || 'nomic-embed-text:latest';

const CACHE_MAX = 5000;
const cache = new Map(); // sha1(text) → number[]

function cacheGet(key) {
  if (!cache.has(key)) return null;
  const v = cache.get(key);
  cache.delete(key);
  cache.set(key, v); // LRU touch
  return v;
}

function cacheSet(key, val) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, val);
}

async function embedOne(text, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Ollama ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!Array.isArray(data.embedding)) {
      throw new Error('رد غير متوقع من Ollama — لا يوجد embedding');
    }
    return data.embedding;
  } finally {
    clearTimeout(t);
  }
}

/**
 * توليد embeddings لدفعة نصوص
 * - متوازي محدود (concurrency)
 * - Cache
 * - Progress callback
 */
async function embedBatch(texts, options = {}) {
  const {
    concurrency = 3,
    onProgress = null,
    timeoutMs = 30000,
  } = options;

  const results = new Array(texts.length);
  let done = 0;
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= texts.length) break;

      const text = texts[i];
      const key = require('./utils').sha1(text);

      const cached = cacheGet(key);
      if (cached) {
        results[i] = cached;
        done++;
        if (onProgress) onProgress(done, texts.length);
        continue;
      }

      try {
        const vec = await embedOne(text, { timeoutMs });
        results[i] = vec;
        cacheSet(key, vec);
      } catch (e) {
        results[i] = null;
        console.warn(`[embedder] فشل العنصر ${i}: ${e.message}`);
      }

      done++;
      if (onProgress) onProgress(done, texts.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  return results;
}

/**
 * اختبار الاتصال + النموذج
 */
async function checkEmbedder() {
  try {
    // 1) Ollama حي
    const h = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!h.ok) return { ok: false, error: 'Ollama لا يستجيب' };
    const tags = await h.json();
    const hasModel = (tags.models || []).some((m) =>
      m.name === MODEL || m.name.startsWith(MODEL.split(':')[0])
    );
    if (!hasModel) {
      return { ok: false, error: `النموذج ${MODEL} غير مثبت. شغّل: ollama pull ${MODEL}` };
    }

    // 2) embedding تجريبي
    const v = await embedOne('اختبار');
    return { ok: true, dim: v.length, model: MODEL };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { embedOne, embedBatch, checkEmbedder, MODEL };
```

---

📄 6. src/vectorStore.js — قاعدة البيانات المتجهية

```javascript
/**
 * VectorStore — تخزين محلي للمتجهات
 *  - SQLite لـ metadata + vectors (BLOB)
 *  - Cosine similarity في JS
 *  - فهارس (indexes) على المسار + الوقت
 *  - Upsert (تحديث ذكي)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

class VectorStore {
  constructor(dbPath = path.join(DATA_DIR, 'index.db')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._init();
    this._prepare();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id          TEXT PRIMARY KEY,
        path        TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text        TEXT NOT NULL,
        ext         TEXT,
        char_count  INTEGER,
        line_start  INTEGER,
        vec         BLOB NOT NULL,
        dim         INTEGER NOT NULL,
        file_hash   TEXT,
        updated_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_path ON chunks(path);
      CREATE INDEX IF NOT EXISTS idx_ext  ON chunks(ext);
      CREATE INDEX IF NOT EXISTS idx_time ON chunks(updated_at);

      CREATE TABLE IF NOT EXISTS files (
        path        TEXT PRIMARY KEY,
        file_hash   TEXT NOT NULL,
        chunk_count INTEGER NOT NULL,
        indexed_at  INTEGER NOT NULL,
        size        INTEGER
      );

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  _prepare() {
    this.stmtInsertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks
      (id, path, chunk_index, text, ext, char_count, line_start, vec, dim, file_hash, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtDeleteByPath = this.db.prepare(`DELETE FROM chunks WHERE path = ?`);
    this.stmtDeleteFile = this.db.prepare(`DELETE FROM files WHERE path = ?`);
    this.stmtInsertFile = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, file_hash, chunk_count, indexed_at, size)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.stmtGetFile = this.db.prepare(`SELECT * FROM files WHERE path = ?`);
    this.stmtAllFiles = this.db.prepare(`SELECT * FROM files ORDER BY path`);
    this.stmtCountChunks = this.db.prepare(`SELECT COUNT(*) as n FROM chunks`);
    this.stmtAllChunks = this.db.prepare(`SELECT id, path, text, vec, dim, chunk_index, line_start, ext FROM chunks`);
    this.stmtChunksByExt = this.db.prepare(`SELECT id, path, text, vec, dim, chunk_index, line_start, ext FROM chunks WHERE ext = ?`);
  }

  /**
   * Upsert ملف كامل:
   *  - احذف chunks القديمة
   *  - أدرج الجديدة
   *  - حدّث ملف السجل
   */
  upsertFile({ path: filePath, fileHash, size, chunks, vectors }) {
    const tx = this.db.transaction(() => {
      this.stmtDeleteByPath.run(filePath);

      const now = Date.now();
      for (let i = 0; i < chunks.length; i++) {
        const vec = vectors[i];
        if (!vec) continue;
        const c = chunks[i];
        const buf = Buffer.from(new Float32Array(vec).buffer);
        this.stmtInsertChunk.run(
          c.id, filePath, c.index, c.text, c.ext,
          c.charCount, c.lineStart, buf, vec.length, fileHash, now
        );
      }

      this.stmtInsertFile.run(filePath, fileHash, chunks.length, now, size || 0);
    });
    tx();
  }

  deleteFile(filePath) {
    const tx = this.db.transaction(() => {
      this.stmtDeleteByPath.run(filePath);
      this.stmtDeleteFile.run(filePath);
    });
    tx();
  }

  getFile(filePath) {
    return this.stmtGetFile.get(filePath);
  }

  allFiles() {
    return this.stmtAllFiles.all();
  }

  countChunks() {
    return this.stmtCountChunks.get().n;
  }

  /**
   * بحث التشابه الجيبي (Cosine)
   */
  search(queryVec, options = {}) {
    const {
      limit = 10,
      ext = null,
      excludePaths = [],
      minScore = 0.2,
    } = options;

    const qNorm = norm(queryVec);
    if (qNorm === 0) return [];

    const rows = ext ? this.stmtChunksByExt.all(ext) : this.stmtAllChunks.all();
    const excludeSet = new Set(excludePaths);

    const scored = [];
    for (const row of rows) {
      if (excludeSet.has(row.path)) continue;

      const vec = new Float32Array(
        row.vec.buffer,
        row.vec.byteOffset,
        row.vec.byteLength / 4
      );

      const score = cosine(qNorm, queryVec, vec);
      if (score < minScore) continue;

      scored.push({
        id: row.id,
        path: row.path,
        text: row.text,
        ext: row.ext,
        chunkIndex: row.chunk_index,
        lineStart: row.line_start,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  getMeta(key) {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key);
    return row ? row.value : null;
  }

  setMeta(key, value) {
    this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run(key, String(value));
  }

  close() {
    try { this.db.close(); } catch {}
  }

  reset() {
    const tx = this.db.transaction(() => {
      this.db.exec(`DELETE FROM chunks; DELETE FROM files; DELETE FROM meta;`);
    });
    tx();
  }
}

/* ============ Math ============ */
function norm(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  return Math.sqrt(s);
}

function cosine(normA, a, b) {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normB += b[i] * b[i];
  }
  if (normB === 0) return 0;
  return dot / (normA * Math.sqrt(normB));
}

module.exports = { VectorStore, cosine };
```

---

📄 7. src/reranker.js — إعادة الترتيب

```javascript
/**
 * Reranker — يحسّن ترتيب النتائج بناءً على:
 *  - المطابقة النصية المباشرة
 *  - قرب المسار من ملفات المشروع
 *  - حداثة الملف
 *  - نوع الملف
 */
const path = require('path');

const EXT_WEIGHTS = {
  ts: 1.10, tsx: 1.10, js: 1.08, mjs: 1.08, jsx: 1.08,
  py: 1.06, rs: 1.06, go: 1.05, java: 1.05,
  md: 0.98, txt: 0.95, json: 0.92, yml: 0.95, yaml: 0.95,
  css: 0.90, scss: 0.90, html: 0.88,
  lock: 0.50, log: 0.30, csv: 0.60,
};

/**
 * يحسب keyword matches داخل النص
 */
function keywordBoost(text, query) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let score = 0;

  // مطابقة كاملة للجملة
  if (t.includes(q)) score += 0.30;

  // مطابقة الكلمات الفردية
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 0) {
    let matched = 0;
    for (const w of words) {
      if (t.includes(w)) matched++;
    }
    score += (matched / words.length) * 0.15;
  }

  return score;
}

/**
 * تقارب المسار
 */
function pathBoost(filePath, query) {
  const name = path.basename(filePath).toLowerCase();
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  let score = 0;
  for (const w of words) {
    if (name.includes(w)) score += 0.10;
  }
  return Math.min(score, 0.20);
}

/**
 * rerank مجموعة نتائج
 */
function rerank(results, { query, limit = 10 } = {}) {
  const reranked = results.map((r) => {
    const ext = r.ext || (r.path.split('.').pop() || '').toLowerCase();
    const extW = EXT_WEIGHTS[ext] ?? 1.0;

    const kw = keywordBoost(r.text, query);
    const pb = pathBoost(r.path, query);

    const finalScore = (r.score * extW) + kw + pb;

    return { ...r, baseScore: r.score, kwBoost: kw, pathBoost: pb, finalScore };
  });

  reranked.sort((a, b) => b.finalScore - a.finalScore);
  return reranked.slice(0, limit);
}

module.exports = { rerank, keywordBoost, pathBoost };
```

---

📄 8. src/searchEngine.js — منطق البحث

```javascript
/**
 * SearchEngine — يجمع:
 *  - Vector search (semantic)
 *  - Keyword search (يستخدم core-pack)
 *  - Reranking
 *  - Hybrid merge
 */
const { VectorStore } = require('./vectorStore');
const { embedOne } = require('./embedder');
const { rerank } = require('./reranker');
const { truncate } = require('./utils');

const CORE = process.env.CORE_URL || 'http://127.0.0.1:8790';

class SearchEngine {
  constructor(store) {
    this.store = store || new VectorStore();
  }

  /**
   * بحث دلالي خالص
   */
  async semantic({ query, limit = 10, ext = null, minScore = 0.25 }) {
    const t0 = Date.now();
    const queryVec = await embedOne(query);
    const raw = this.store.search(queryVec, {
      limit: limit * 3,
      ext,
      minScore,
    });
    const ranked = rerank(raw, { query, limit });
    return {
      ok: true,
      mode: 'semantic',
      query,
      ms: Date.now() - t0,
      count: ranked.length,
      results: ranked.map((r) => this._format(r)),
    };
  }

  /**
   * بحث نصي عبر core-pack
   */
  async keyword({ query, limit = 20, ext = null }) {
    const t0 = Date.now();
    const body = { query, maxResults: limit * 3 };
    const res = await fetch(`${CORE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Core search failed: ${res.status}`);
    const data = await res.json();

    let results = (data.results || []).map((r) => ({
      id: `${r.file}:${r.line}`,
      path: r.file,
      text: r.text,
      ext: (r.file.split('.').pop() || '').toLowerCase(),
      lineStart: r.line,
      score: 0.5,
    }));

    if (ext) results = results.filter((r) => r.ext === ext);
    results = results.slice(0, limit);

    return {
      ok: true,
      mode: 'keyword',
      query,
      ms: Date.now() - t0,
      count: results.length,
      results: results.map((r) => this._format(r)),
    };
  }

  /**
   * بحث هجين — يدمج semantic + keyword
   * دمج RRF (Reciprocal Rank Fusion)
   */
  async hybrid({ query, limit = 10, ext = null, minScore = 0.2 }) {
    const t0 = Date.now();

    const [sem, kw] = await Promise.all([
      this.semantic({ query, limit: limit * 2, ext, minScore }).catch((e) => ({ results: [], error: e.message })),
      this.keyword({ query, limit: limit * 2, ext }).catch((e) => ({ results: [], error: e.message })),
    ]);

    const merged = this._rrf(
      [sem.results || [], kw.results || []],
      { k: 60 }
    );

    const top = merged.slice(0, limit);

    return {
      ok: true,
      mode: 'hybrid',
      query,
      ms: Date.now() - t0,
      count: top.length,
      sources: {
        semantic: (sem.results || []).length,
        keyword: (kw.results || []).length,
      },
      results: top.map((r) => this._format(r)),
    };
  }

  /**
   * استرجاع السياق للنماذج (RAG)
   * يعيد قطع مرتبة، مع نصها الكامل (أو مقتطعة) جاهزة للإدراج في prompt
   */
  async retrieveContext({ query, topK = 5, maxCharsPerChunk = 1200 }) {
    const res = await this.hybrid({ query, limit: topK });
    return {
      ok: true,
      query,
      chunks: res.results.map((r) => ({
        path: r.path,
        lineStart: r.lineStart,
        score: r.score,
        text: truncate(r.text, maxCharsPerChunk),
      })),
    };
  }

  /* ============ RRF ============ */
  _rrf(lists, { k = 60 } = {}) {
    const scores = new Map(); // id → { score, item }
    lists.forEach((list) => {
      list.forEach((item, rank) => {
        const id = item.path + '::' + (item.lineStart ?? item.chunkIndex ?? item.id);
        const add = 1 / (k + rank + 1);
        if (!scores.has(id)) {
          scores.set(id, { score: 0, item });
        }
        scores.get(id).score += add;
      });
    });
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map((x) => ({ ...x.item, rrfScore: x.score }));
  }

  _format(r) {
    return {
      path: r.path,
      lineStart: r.lineStart ?? null,
      ext: r.ext,
      score: Number((r.finalScore ?? r.score ?? 0).toFixed(4)),
      preview: truncate((r.text || '').replace(/\s+/g, ' '), 220),
      text: r.text,
    };
  }
}

module.exports = { SearchEngine };
```

---

📄 9. src/watcher.js — مراقبة الملفات

```javascript
/**
 * Watcher — يراقب الملفات ويعيد فهرستها عند التعديل
 * - debounce 1.5s
 * - تجاهل الملفات غير المدعومة
 */
const chokidar = require('chokidar');
const path = require('path');
const { isTextFile, isSkippedDir, fileExt } = require('./utils');

const DEBOUNCE_MS = 1500;

class FileWatcher {
  constructor({ root, onFileChange, onFileDelete, logger }) {
    this.root = root;
    this.onFileChange = onFileChange;
    this.onFileDelete = onFileDelete;
    this.logger = logger;
    this.watcher = null;
    this.pending = new Map(); // path → timer
  }

  start() {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.root, {
      ignored: (p) => {
        const parts = p.split(/[/\\]/);
        return parts.some((seg) => isSkippedDir(seg));
      },
      persistent: true,
      ignoreInitial: true,
      depth: 8,
      awaitWriteFinish: {
        stabilityThreshold: 800,
        pollInterval: 200,
      },
    });

    this.watcher.on('add', (p) => this._schedule(p, 'add'));
    this.watcher.on('change', (p) => this._schedule(p, 'change'));
    this.watcher.on('unlink', (p) => this._handleDelete(p));

    this.logger?.info(`watcher بدأ على ${this.root}`);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.pending.forEach((t) => clearTimeout(t));
      this.pending.clear();
      this.logger?.info('watcher توقف');
    }
  }

  _schedule(filePath, event) {
    if (!isTextFile(filePath)) return;

    const existing = this.pending.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.pending.delete(filePath);
      try {
        await this.onFileChange?.(filePath, event);
      } catch (e) {
        this.logger?.error(`فشل معالجة ${filePath}`, { error: e.message });
      }
    }, DEBOUNCE_MS);

    this.pending.set(filePath, timer);
  }

  async _handleDelete(filePath) {
    try {
      await this.onFileDelete?.(filePath);
    } catch (e) {
      this.logger?.error(`فشل حذف ${filePath}`, { error: e.message });
    }
  }
}

module.exports = { FileWatcher };
```

---

📄 10. indexer/worker.js — عامل الفهرسة

```javascript
/**
 * Indexer Worker — خدمة الفهرسة (Background)
 *
 *  - يمشي على شجرة المشروع
 *  - يقسّم الملفات
 *  - يولّد embeddings
 *  - يخزنها في VectorStore
 *  - يوفّر HTTP API للتقدم
 *
 *  المنفذ: 8793
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { VectorStore } = require('../src/vectorStore');
const { chunkFile } = require('../src/chunker');
const { embedBatch, checkEmbedder } = require('../src/embedder');
const { FileWatcher } = require('../src/watcher');
const { sha1, isTextFile, isSkippedDir } = require('../src/utils');

// logger مبسّط
const log = (level, msg, meta) => {
  const t = new Date().toISOString();
  const line = `[${t}] [${level}] [indexer] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  console.log(line);
};
const logger = {
  info: (m, x) => log('INFO', m, x),
  warn: (m, x) => log('WARN', m, x),
  error: (m, x) => log('ERROR', m, x),
  debug: () => {},
};

const CORE = process.env.CORE_URL || 'http://127.0.0.1:8790';
const ROOT = process.env.INDEX_ROOT || 'F:/nawat';
const PORT = parseInt(process.env.INDEXER_PORT || '8793', 10);
const HOST = process.env.INDEXER_HOST || '127.0.0.1';
const WATCH = process.env.WATCH_ENABLED === 'true';

/* ============ الحالة ============ */
const state = {
  status: 'idle',           // idle | running | stopping
  phase: 'idle',            // scan | read | chunk | embed | store
  total: 0,
  done: 0,
  currentFile: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  stats: {
    filesScanned: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    filesFailed: 0,
    chunksCreated: 0,
    bytesRead: 0,
  },
};

const store = new VectorStore();
const app = express();
app.use(cors());
app.use(express.json());

/* ============ الأدوات ============ */

/**
 * قراءة ملف عبر core-pack
 */
async function readViaCore(filePath) {
  const res = await fetch(`${CORE}/file/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  if (!res.ok) throw new Error(`core /file/read فشل: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'فشل القراءة');
  return data;
}

/**
 * جلب شجرة الملفات من core
 */
async function fetchTree(root, depth = 10) {
  const res = await fetch(`${CORE}/file/tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: root, depth }),
  });
  if (!res.ok) throw new Error(`core /file/tree فشل: ${res.status}`);
  return (await res.json()).tree;
}

/**
 * يمشي على الشجرة ويجمع الملفات النصية
 */
function collectFiles(tree, out = []) {
  for (const node of tree) {
    if (node.type === 'dir') {
      if (isSkippedDir(node.name)) continue;
      if (node.children) collectFiles(node.children, out);
    } else {
      if (isTextFile(node.path)) out.push({ path: node.path, size: node.size || 0 });
    }
  }
  return out;
}

/**
 * فهرسة ملف واحد
 */
async function indexOneFile(fileInfo) {
  const { path: filePath, size } = fileInfo;

  const t0 = Date.now();

  // 1) اقرأ
  const data = await readViaCore(filePath);
  if (data.binary) return { skipped: true, reason: 'binary' };

  const content = data.content || '';
  const fileHash = sha1(content);

  // 2) هل نحتاج إعادة فهرسة؟
  const existing = store.getFile(filePath);
  if (existing && existing.file_hash === fileHash) {
    return { skipped: true, reason: 'unchanged', chunks: existing.chunk_count };
  }

  // 3) قطّع
  const chunks = chunkFile({
    path: filePath,
    content,
    opts: {
      chunkSize: parseInt(process.env.CHUNK_SIZE || '600', 10),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '80', 10),
      maxChunksPerFile: parseInt(process.env.MAX_CHUNKS_PER_FILE || '50', 10),
    },
  });

  if (!chunks.length) return { skipped: true, reason: 'no-chunks' };

  // 4) embeddings
  const vectors = await embedBatch(chunks.map((c) => c.text), {
    concurrency: 3,
    onProgress: (done, total) => {
      state.currentFile = `${path.basename(filePath)} (${done}/${total})`;
    },
  });

  // 5) خزّن
  store.upsertFile({
    path: filePath,
    fileHash,
    size,
    chunks,
    vectors,
  });

  return {
    skipped: false,
    chunks: chunks.length,
    ms: Date.now() - t0,
  };
}

/**
 * الفهرسة الكاملة
 */
async function runFullIndex({ reset = false } = {}) {
  if (state.status === 'running') {
    logger.warn('فهرسة جارية بالفعل');
    return;
  }

  state.status = 'running';
  state.phase = 'scan';
  state.startedAt = Date.now();
  state.done = 0;
  state.total = 0;
  state.lastError = null;
  state.stats = {
    filesScanned: 0, filesIndexed: 0, filesSkipped: 0,
    filesFailed: 0, chunksCreated: 0, bytesRead: 0,
  };

  try {
    if (reset) {
      logger.warn('إعادة تعيين الفهرس...');
      store.reset();
    }

    // 1) اجلب الشجرة
    logger.info(`مسح شجرة ${ROOT}...`);
    const tree = await fetchTree(ROOT, 10);
    const files = collectFiles(tree);
    state.total = files.length;
    state.stats.filesScanned = files.length;
    logger.info(`تم العثور على ${files.length} ملف نصي`);

    // 2) عالج ملفاً ملفاً (متوازي محدود)
    state.phase = 'embed';
    const concurrency = 2;
    let next = 0;

    async function worker() {
      while (state.status === 'running') {
        const i = next++;
        if (i >= files.length) break;
        const f = files[i];
        state.currentFile = f.path;

        try {
          const r = await indexOneFile(f);
          if (r.skipped) {
            state.stats.filesSkipped++;
          } else {
            state.stats.filesIndexed++;
            state.stats.chunksCreated += r.chunks;
          }
        } catch (e) {
          state.stats.filesFailed++;
          logger.error(`فشل ${f.path}`, { error: e.message });
        }

        state.done++;
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));

    state.phase = 'done';
    state.finishedAt = Date.now();
    state.status = 'idle';
    store.setMeta('last_index_at', Date.now());
    store.setMeta('last_index_duration_ms', state.finishedAt - state.startedAt);

    logger.info('✅ اكتملت الفهرسة', {
      duration: ((state.finishedAt - state.startedAt) / 1000).toFixed(1) + 's',
      indexed: state.stats.filesIndexed,
      skipped: state.stats.filesSkipped,
      failed: state.stats.filesFailed,
      chunks: state.stats.chunksCreated,
    });
  } catch (e) {
    state.status = 'idle';
    state.phase = 'error';
    state.lastError = e.message;
    logger.error('فشل الفهرسة', { error: e.message });
  }
}

/* ============ Watcher ============ */
const watcher = WATCH ? new FileWatcher({
  root: ROOT,
  logger,
  onFileChange: async (filePath) => {
    logger.info(`ملف تغيّر: ${filePath}`);
    try {
      const r = await indexOneFile({ path: filePath, size: 0 });
      logger.info(`أُعيدت فهرسة ${path.basename(filePath)}`, r);
    } catch (e) {
      logger.error(`فشل إعادة الفهرسة: ${e.message}`);
    }
  },
  onFileDelete: async (filePath) => {
    logger.info(`ملف حُذف: ${filePath}`);
    store.deleteFile(filePath);
  },
}) : null;

/* ============ HTTP API ============ */

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    pack: 'search-pack',
    service: 'indexer',
    status: state.status,
    phase: state.phase,
    chunks: store.countChunks(),
    files: store.allFiles().length,
    watcher: !!watcher,
    uptime: process.uptime(),
  });
});

app.get('/index/status', (req, res) => {
  res.json({
    ok: true,
    status: state.status,
    phase: state.phase,
    total: state.total,
    done: state.done,
    progress: state.total ? Math.round((state.done / state.total) * 100) : 0,
    currentFile: state.currentFile,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    lastError: state.lastError,
    stats: state.stats,
    store: {
      chunks: store.countChunks(),
      files: store.allFiles().length,
    },
  });
});

app.post('/index/start', async (req, res) => {
  const { reset = false } = req.body || {};
  if (state.status === 'running') {
    return res.status(409).json({ ok: false, error: 'فهرسة جارية بالفعل' });
  }
  // ابدأ في الخلفية
  setImmediate(() => runFullIndex({ reset }));
  res.json({ ok: true, message: 'بدأت الفهرسة' });
});

app.post('/index/stop', (req, res) => {
  state.status = 'stopping';
  res.json({ ok: true });
});

app.post('/index/reset', (req, res) => {
  if (state.status === 'running') {
    return res.status(409).json({ ok: false, error: 'أوقف الفهرسة أولاً' });
  }
  store.reset();
  res.json({ ok: true });
});

app.post('/index/file', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ ok: false, error: 'path مطلوب' });
    const result = await indexOneFile({ path: filePath, size: 0 });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/stats', (req, res) => {
  const files = store.allFiles();
  const byExt = {};
  for (const f of files) {
    const ext = (f.path.split('.').pop() || '').toLowerCase();
    byExt[ext] = (byExt[ext] || 0) + 1;
  }
  res.json({
    ok: true,
    chunks: store.countChunks(),
    files: files.length,
    byExtension: byExt,
    lastIndexAt: store.getMeta('last_index_at'),
    lastIndexDurationMs: store.getMeta('last_index_duration_ms'),
  });
});

/* ============ الإقلاع ============ */
async function main() {
  logger.info('═══════════════════════════════════════');
  logger.info('  NAWAT Search Pack — Indexer         ');
  logger.info('═══════════════════════════════════════');
  logger.info(`ROOT: ${ROOT}`);
  logger.info(`CORE: ${CORE}`);

  // فحص embedder
  const embed = await checkEmbedder();
  if (!embed.ok) {
    logger.error(`❌ Embedder غير جاهز: ${embed.error}`);
    logger.error('   شغّل: ollama pull nomic-embed-text');
  } else {
    logger.info(`✅ Embedder جاهز — dim=${embed.dim}, model=${embed.model}`);
  }

  // ابدأ watcher
  if (watcher) watcher.start();

  // إذا طُلب، ابدأ الفهرسة
  if (process.env.INDEX_ON_START === 'true') {
    setImmediate(() => runFullIndex({ reset: false }));
  }

  app.listen(PORT, HOST, () => {
    logger.info(`✅ جاهز على http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    logger.warn('إيقاف...');
    if (watcher) watcher.stop();
    store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  logger.error('فشل الإقلاع', { error: e.message });
  process.exit(1);
});
```

---

📄 11. server/server.js — خادم البحث

```javascript
/**
 * Search Pack Server — API البحث
 * المنفذ: 8792
 */
const express = require('express');
const cors = require('cors');
const { VectorStore } = require('../src/vectorStore');
const { SearchEngine } = require('../src/searchEngine');
const { checkEmbedder } = require('../src/embedder');

const log = (level, msg, meta) => {
  const t = new Date().toISOString();
  console.log(`[${t}] [${level}] [search] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`);
};
const logger = {
  info: (m, x) => log('INFO', m, x),
  error: (m, x) => log('ERROR', m, x),
  warn: (m, x) => log('WARN', m, x),
  debug: () => {},
};

const PORT = parseInt(process.env.SEARCH_PORT || '8792', 10);
const HOST = process.env.SEARCH_HOST || '127.0.0.1';
const CORE = process.env.CORE_URL || 'http://127.0.0.1:8790';

const store = new VectorStore();
const engine = new SearchEngine(store);
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

/* ============ Health ============ */
app.get('/health', async (req, res) => {
  const embed = await checkEmbedder().catch((e) => ({ ok: false, error: e.message }));
  res.json({
    ok: true,
    pack: 'search-pack',
    service: 'search',
    chunks: store.countChunks(),
    files: store.allFiles().length,
    embedder: { ok: embed.ok, model: embed.model, dim: embed.dim },
    uptime: process.uptime(),
  });
});

/* ============ Search Endpoints ============ */
app.post('/search/semantic', async (req, res) => {
  const t0 = Date.now();
  try {
    const { query, limit = 10, ext = null, minScore = 0.25 } = req.body || {};
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'query مطلوب (حرفان على الأقل)' });
    }
    const result = await engine.semantic({ query, limit, ext, minScore });
    res.json(result);
    logger.info('semantic', { query: query.slice(0, 60), count: result.count, ms: result.ms });
  } catch (e) {
    logger.error('semantic فشل', { error: e.message });
    res.status(500).json({ ok: false, error: e.message, ms: Date.now() - t0 });
  }
});

app.post('/search/keyword', async (req, res) => {
  try {
    const { query, limit = 20, ext = null } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query مطلوب' });
    const result = await engine.keyword({ query, limit, ext });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/search/hybrid', async (req, res) => {
  try {
    const { query, limit = 10, ext = null, minScore = 0.2 } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query مطلوب' });
    const result = await engine.hybrid({ query, limit, ext, minScore });
    res.json(result);
    logger.info('hybrid', { query: query.slice(0, 60), count: result.count, ms: result.ms });
  } catch (e) {
    logger.error('hybrid فشل', { error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ============ Context Retrieval (RAG) ============ */
app.post('/context', async (req, res) => {
  try {
    const { query, topK = 5, maxCharsPerChunk = 1200 } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query مطلوب' });
    const result = await engine.retrieveContext({ query, topK, maxCharsPerChunk });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ============ Stats ============ */
app.get('/stats', (req, res) => {
  const files = store.allFiles();
  const byExt = {};
  for (const f of files) {
    const ext = (f.path.split('.').pop() || '').toLowerCase();
    byExt[ext] = (byExt[ext] || 0) + 1;
  }
  res.json({
    ok: true,
    chunks: store.countChunks(),
    files: files.length,
    byExtension: byExt,
    lastIndexAt: store.getMeta('last_index_at'),
  });
});

/* ============ Proxy for indexer ============ */
app.use('/index', async (req, res) => {
  const url = `http://127.0.0.1:8793/index${req.url === '/' ? '' : req.url}`;
  try {
    const r = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Indexer غير متاح: ' + e.message });
  }
});

/* ============ 404 ============ */
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `المسار غير موجود: ${req.method} ${req.path}` });
});

/* ============ الإقلاع ============ */
app.listen(PORT, HOST, () => {
  logger.info('═══════════════════════════════════════');
  logger.info('  NAWAT Search Pack — Search Server   ');
  logger.info('═══════════════════════════════════════');
  logger.info(`✅ http://${HOST}:${PORT}`);
  logger.info(`   chunks: ${store.countChunks()} · files: ${store.allFiles().length}`);
});

process.on('SIGINT', () => { store.close(); process.exit(0); });
process.on('SIGTERM', () => { store.close(); process.exit(0); });
```

---

📄 12. start.bat

```batch
@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title NAWAT Search Pack
color 0D

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║           NAWAT Search Pack — v1.0.0               ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM ──── فحص Core ────
echo [1/5] فحص Core Pack...
curl -s -o nul http://127.0.0.1:8790/health 2>nul
if errorlevel 1 (
  echo ❌ Core Pack غير متصل!
  echo    شغّل: ..\core-pack\start.bat
  pause
  exit /b 1
)
echo ✅ Core متصل
echo.

REM ──── فحص Ollama ────
echo [2/5] فحص Ollama...
curl -s -o nul http://127.0.0.1:11434/api/tags 2>nul
if errorlevel 1 (
  echo ❌ Ollama غير متصل!
  pause
  exit /b 1
)
echo ✅ Ollama متصل
echo.

REM ──── فحص النموذج ────
echo [3/5] فحص نموذج التضمين (nomic-embed-text)...
curl -s http://127.0.0.1:11434/api/tags | findstr /C:"nomic-embed-text" >nul
if errorlevel 1 (
  echo ⚠️  النموذج غير مثبت — جاري التثبيت...
  ollama pull nomic-embed-text
)
echo ✅ جاهز
echo.

REM ──── التبعيات ────
if not exist "node_modules" (
  echo [4/5] تثبيت التبعيات...
  call npm install
  if errorlevel 1 (
    echo ❌ فشل التثبيت — تحقق من better-sqlite3
    pause
    exit /b 1
  )
)
echo ✅ التبعيات جاهزة
echo.

REM ──── المنافذ ────
echo [5/5] تحرير المنافذ 8792, 8793...
powershell -NoProfile -Command ^
  "8792,8793 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }"
echo.

REM ──── التشغيل ────
echo 🚀 تشغيل Indexer...
start "NAWAT-Search-Indexer" cmd /k "cd /d %~dp0 && node indexer/worker.js"
timeout /t 3 /nobreak >nul

echo 🚀 تشغيل Search Server...
start "NAWAT-Search-Server" cmd /k "cd /d %~dp0 && node server/server.js"
timeout /t 2 /nobreak >nul

echo.
echo ✅ Search Pack يعمل!
echo.
echo   🔍 Search:   http://127.0.0.1:8792
echo   📇 Indexer:  http://127.0.0.1:8793
echo.

choice /C YN /M "هل تريد بدء الفهرسة الآن؟ (Y/N)"
if errorlevel 2 goto :end
echo.
echo 📇 بدء الفهرسة (قد يستغرق دقائق حسب حجم المشروع)...
curl -s -X POST http://127.0.0.1:8792/index/start -H "Content-Type: application/json" -d "{\"reset\":false}"
echo.
echo راقب التقدم: http://127.0.0.1:8793/index/status

:end
echo.
pause
```

---

📄 13. stop.bat

```batch
@echo off
chcp 65001 >nul
echo إيقاف Search Pack...
powershell -NoProfile -Command ^
  "8792,8793 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }"
taskkill /FI "WINDOWTITLE eq NAWAT-Search-Indexer*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq NAWAT-Search-Server*" /F >nul 2>&1
echo ✅ تم
timeout /t 1 /nobreak >nul
```

---

📄 14. test.bat

```batch
@echo off
chcp 65001 >nul
title NAWAT Search Pack — Self Test
color 0E

set PASS=0
set FAIL=0

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║        NAWAT Search Pack — اختبار القبول           ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM 1) Core
curl -s -o nul http://127.0.0.1:8790/health 2>nul
if errorlevel 1 (echo ❌ Core & set /a FAIL+=1) else (echo ✅ Core & set /a PASS+=1)

REM 2) Ollama
curl -s -o nul http://127.0.0.1:11434/api/tags 2>nul
if errorlevel 1 (echo ❌ Ollama & set /a FAIL+=1) else (echo ✅ Ollama & set /a PASS+=1)

REM 3) Search Server
curl -s -o nul http://127.0.0.1:8792/health 2>nul
if errorlevel 1 (echo ❌ Search Server & set /a FAIL+=1) else (echo ✅ Search Server & set /a PASS+=1)

REM 4) Indexer
curl -s -o nul http://127.0.0.1:8793/health 2>nul
if errorlevel 1 (echo ❌ Indexer & set /a FAIL+=1) else (echo ✅ Indexer & set /a PASS+=1)

REM 5) Embedder Model
curl -s http://127.0.0.1:8792/health | findstr /C:"\"ok\":true" >nul
if errorlevel 1 (echo ❌ Embedder & set /a FAIL+=1) else (echo ✅ Embedder & set /a PASS+=1)

echo.
echo ════════════════════════════════════════════════════════
echo   ✅ نجح: %PASS%   ❌ فشل: %FAIL%
echo ════════════════════════════════════════════════════════
if %FAIL%==0 (exit /b 0) else (exit /b 1)
```

---

📄 15. README.md

```markdown
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
```

أو استخدم sql.js (بديل WASM لا يحتاج ترجمة).

---

🎯 ما يضيفه search-pack للمنظومة

الطبقة قبل بعد
البحث نصي فقط نصي + دلالي + هجين
السياق للـ AI أول N ملف أقرب 5 قطع دلالياً
الفهرسة لا شيء تلقائية + مراقبة
الجودة grep RRF + Reranking

بعد search-pack، يستطيع agent-pack أن يجد السياق الصحيح لأي سؤال — حتى لو لم يستخدم المستخدم نفس الكلمات.

---

باقي الـ Packs:

· safety-pack — Watch + Journal + Atomic (يعزز core)
· ai-pack — Router + Context Budget
· agent-pack — ReAct Loop
· polish-pack — RTL + Voice + CLI

هل تريد safety-pack تالياً (حماية صفر فقدان)؟ 🚀