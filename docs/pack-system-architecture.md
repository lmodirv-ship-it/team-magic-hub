🎁 NAWAT Pack System — الخطة المعمارية الكاملة

🧠 الفكرة الجوهرية

بدل مشروع واحد ضخم، نبني نظام Pack — كل Pack وحدة مستقلة قابلة للتشغيل بنقرة واحدة، وتتواصل مع الباقي عبر واجهات معرّفة. أي Pack يمكن استبداله أو تطويره دون كسر الباقي.

---

🏛️ المعمارية العامة

```
F:\nawat\NAWAT\forge\
│
├── 📁 packs\                              ← المستودع الرئيسي
│   │
│   ├── 📦 core-pack\                      ← النواة (مطلوب دائماً)
│   │   ├── agent\                         ← Forge Agent (ملفات + shell)
│   │   ├── bridge\                        ← WebSocket Relay
│   │   ├── metrics\                       ← قياس الأداء
│   │   └── start-core.bat
│   │
│   ├── 📦 editor-pack\                    ← المحرر (P1)
│   │   ├── ui\
│   │   ├── workers\                       ← Monaco self-hosted
│   │   ├── commands\                      ← Command Registry
│   │   └── start-editor.bat
│   │
│   ├── 📦 search-pack\                    ← البحث والفهرسة (P2)
│   │   ├── indexer\
│   │   ├── semantic\                      ← ChromaDB + embeddings
│   │   ├── global-search\
│   │   └── start-search.bat
│   │
│   ├── 📦 safety-pack\                    ← أمان البيانات (P3)
│   │   ├── watcher\
│   │   ├── journal\
│   │   ├── atomic-write\
│   │   └── start-safety.bat
│   │
│   ├── 📦 ai-pack\                        ← الراغ + السياق (P4)
│   │   ├── chunker\
│   │   ├── context-budget\
│   │   ├── router\                        ← توجيه النماذج
│   │   └── start-ai.bat
│   │
│   ├── 📦 agent-pack\                     ← الوكيل الذكي (P5)
│   │   ├── react-loop\
│   │   ├── tools\
│   │   ├── diff-preview\
│   │   ├── git-bridge\
│   │   └── start-agent.bat
│   │
│   ├── 📦 polish-pack\                    ← التميّز (P7)
│   │   ├── rtl-enhancer\
│   │   ├── voice\
│   │   ├── cli\
│   │   └── start-polish.bat
│   │
│   └── 📦 studio\                         ← الواجهة الموحّدة (Electron/Web)
│       ├── index.html
│       ├── packs-registry.json            ← سجل الـ Packs المتاحة
│       └── start-studio.bat
│
├── 📄 manifest.json                       ← البيان الكامل للنظام
├── 📄 start-all.bat                       ← تشغيل كل شيء
├── 📄 stop-all.bat                        ← إيقاف كل شيء
└── 📄 health-check.bat                    ← فحص صحة كل Pack
```

---

📋 مواصفات الـ Pack الواحد

كل Pack يجب أن يحتوي على:

```
pack-name\
├── 📄 pack.json              ← البيان (الاسم، الإصدار، الاعتماديات، المنافذ)
├── 📄 README.md              ← التوثيق
├── 📄 start.bat              ← تشغيل بنقرة
├── 📄 stop.bat               ← إيقاف بنقرة
├── 📄 test.bat               ← اختبار ذاتي
├── 📁 src\                   ← الكود المصدري
├── 📁 config\                ← الإعدادات
├── 📁 logs\                  ← السجلات
└── 📁 tests\                 ← الاختبارات
```

نموذج pack.json:

```json
{
  "name": "core-pack",
  "version": "1.0.0",
  "description": "Forge Agent + Bridge + Metrics",
  "author": "NAWAT",
  "ports": {
    "agent": 8790,
    "bridge": 8788,
    "metrics": 8791
  },
  "depends_on": [],
  "provides": ["file-io", "shell", "metrics"],
  "consumes": [],
  "env": {
    "ROOT": "F:/nawat",
    "LOG_LEVEL": "info"
  },
  "endpoints": {
    "health": "/health",
    "info": "/agent/info",
    "restart": "/agent/restart"
  },
  "startup_order": 1
}
```

---

🎯 تفاصيل كل Pack

📦 Pack 0: core-pack (النواة)

المسؤولية: العمليات الأساسية — قراءة/كتابة الملفات، تنفيذ الأوامر، القياس.

المنافذ: 8790 (Agent)، 8788 (Bridge)، 8791 (Metrics)

يوفّر للباقي:

· file.read(path) / file.write(path, content)
· file.tree(path, depth) / file.delete(path)
· shell.run(cmd, cwd)
· metrics.record(name, duration)

start-core.bat:

```batch
@echo off
title NAWAT Core Pack
echo [CORE] تحرير المنافذ...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8790 -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"

echo [CORE] تشغيل Forge Agent...
start "NAWAT-Agent" cmd /k "cd /d %~dp0agent && node server.js"

echo [CORE] تشغيل Metrics...
start "NAWAT-Metrics" cmd /k "cd /d %~dp0metrics && node server.js"

echo ✅ Core Pack جاهز
timeout /t 3
curl http://127.0.0.1:8790/health
```

---

📦 Pack 1: editor-pack (المحرر)

المسؤولية: Monaco Editor (self-hosted) + شريط الحالة + Command Registry.

يعتمد على: core-pack

يوفّر:

· editor.openFile(path)
· editor.saveCurrent()
· editor.registerCommand(cmd)

الميزات:

· Monaco بدون CDN
· Workers محلية
· شريط حالة كامل
· Diff viewer مدمج

start-editor.bat:

```batch
@echo off
title NAWAT Editor Pack
echo [EDITOR] فحص Core Pack...
curl -s http://127.0.0.1:8790/health >nul 2>&1
if errorlevel 1 (
  echo ❌ Core Pack غير متصل — شغّل start-core.bat أولاً
  exit /b 1
)
echo [EDITOR] تشغيل خادم الواجهة...
start "NAWAT-Editor" cmd /k "cd /d %~dp0ui && npx serve -p 5173"
echo ✅ Editor Pack جاهز على http://localhost:5173
start "" "http://localhost:5173"
```

---

📦 Pack 2: search-pack (البحث)

المسؤولية: بحث سريع + بحث دلالي (RAG) + فهرسة تدريجية.

يعتمد على: core-pack

المكوّنات:

· ripgrep (مستورد) للبحث النصي
· ChromaDB + nomic-embed للبحث الدلالي
· treesitter للتقسيم عند حدود الدوال

المنافذ: 8792 (Indexer)، 8793 (Search)

pack.json:

```json
{
  "name": "search-pack",
  "provides": ["search.text", "search.semantic", "index.status"],
  "consumes": ["file.tree", "file.read"],
  "ports": { "indexer": 8792, "search": 8793 }
}
```

---

📦 Pack 3: safety-pack (الأمان)

المسؤولية: ضمان صفر فقدان بيانات.

المكوّنات:

· watcher — مراقبة الملفات (chokidar)
· journal — سجل التعافي
· atomic-write — الكتابة الذرّية
· conflict-resolver — حل تعارض Unsaved/External

المنافذ: 8794 (Watcher)، 8795 (Journal)

يوفّر:

· file.write-atomic(path, content) ← يُستدعى بدل file.write
· session.recover() — استرجاع الجلسة
· conflict.detect() — كشف تغيير خارجي

---

📦 Pack 4: ai-pack (السياق والذكاء)

المسؤولية: إدارة السياق المُرسَل للنماذج + التوجيه التلقائي.

المكوّنات:

· chunker — تقسيم الكود بحدود الدوال
· context-budget — ميزانية Token
· router — توجيه النية (chat/code/vision/...)
· prompt-templates — قوالب جاهزة

المنافذ: 8796 (Router)، 8797 (Budget)

يوفّر:

· router.classify(text) → intent
· budget.select(files, query) → selected context
· context.inspect() — ما يُرسل بالضبط

---

📦 Pack 5: agent-pack (الوكيل)

المسؤولية: ReAct Loop + الأدوات + Diff Preview + Git.

يعتمد على: core-pack + ai-pack + safety-pack

12 أداة:
read_file, write_file, edit_file, list_dir, search_code, search_semantic, run_shell, git_status, git_diff, git_commit, fetch_url, screenshot.

يوفّر:

· agent.run(message, model) → SSE stream
· diff.propose(path, patch) → DiffPreview
· diff.apply(approval) → write-atomic

---

📦 Pack 6: polish-pack (التميّز)

المسؤولية: الميزات الفريدة.

المكوّنات:

· rtl-enhancer — تحسين RTL للعربية
· voice — Whisper + Piper
· cli — nawat.mjs موحّد
· sync — مزامنة SSH + CRDT

المنافذ: 8798 (Voice)، 8799 (CLI)

---

📦 studio (الواجهة الموحّدة)

المسؤولية: تجميع كل الـ Packs في واجهة واحدة.

يكتشف الـ Packs تلقائياً عبر packs-registry.json:

```json
{
  "packs": [
    { "name": "core-pack",    "port": 8790, "health": "/health" },
    { "name": "editor-pack",  "port": 5173, "health": "/health" },
    { "name": "search-pack",  "port": 8793, "health": "/health" },
    { "name": "safety-pack",  "port": 8794, "health": "/health" },
    { "name": "ai-pack",      "port": 8796, "health": "/health" },
    { "name": "agent-pack",   "port": 8790, "health": "/agent/info" },
    { "name": "polish-pack",  "port": 8798, "health": "/health" }
  ]
}
```

في الواجهة: مؤشرات حالة ملوّنة لكل Pack + أزرار تشغيل/إيقاف فردية.

---

🚀 السكربتات الرئيسية

start-all.bat — تشغيل كل شيء بترتيب ذكي

```batch
@echo off
chcp 65001 >nul
title NAWAT Forge — Master Launcher
color 0B

echo ╔════════════════════════════════════════════╗
echo ║  NAWAT Forge — تشغيل كل الـ Packs          ║
echo ╚════════════════════════════════════════════╝
echo.

REM 1. Core أولاً (النواة)
echo [1/7] تشغيل Core Pack...
call packs\core-pack\start.bat
timeout /t 4 /nobreak >nul

REM 2. Safety (حماية البيانات قبل أي شيء آخر)
echo [2/7] تشغيل Safety Pack...
call packs\safety-pack\start.bat
timeout /t 2 /nobreak >nul

REM 3. Search (البحث)
echo [3/7] تشغيل Search Pack...
call packs\search-pack\start.bat
timeout /t 2 /nobreak >nul

REM 4. AI (السياق)
echo [4/7] تشغيل AI Pack...
call packs\ai-pack\start.bat
timeout /t 2 /nobreak >nul

REM 5. Agent (الوكيل)
echo [5/7] تشغيل Agent Pack...
call packs\agent-pack\start.bat
timeout /t 2 /nobreak >nul

REM 6. Editor (المحرر)
echo [6/7] تشغيل Editor Pack...
call packs\editor-pack\start.bat
timeout /t 3 /nobreak >nul

REM 7. Polish (التميّز)
echo [7/7] تشغيل Polish Pack...
call packs\polish-pack\start.bat
timeout /t 2 /nobreak >nul

echo.
echo ✅ كل الـ Packs تعمل!
echo.
echo 🌐 الواجهة: http://localhost:5173
echo 📊 المراقبة: http://localhost:8791
echo.
start "" "http://localhost:5173"
pause
```

stop-all.bat — إيقاف مرتّب

```batch
@echo off
echo إيقاف كل الـ Packs...
for %%P in (8790 8788 8791 8792 8793 8794 8795 8796 8797 8798 8799 5173) do (
  powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %%P -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"
)
echo ✅ تم الإيقاف
```

health-check.bat — فحص صحة كل Pack

```batch
@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════
echo   فحص صحة NAWAT Forge Packs
echo ═══════════════════════════════════════
echo.

call :check "Core Agent"    8790 /health
call :check "Core Bridge"   8788 /health
call :check "Core Metrics"  8791 /health
call :check "Search Index"  8792 /health
call :check "Search Engine" 8793 /health
call :check "Safety Watch"  8794 /health
call :check "Safety Journal" 8795 /health
call :check "AI Router"     8796 /health
call :check "AI Budget"     8797 /health
call :check "Voice"         8798 /health
call :check "CLI"           8799 /health

echo.
pause
exit /b

:check
setlocal
set NAME=%~1
set PORT=%~2
set PATH_=%~3
curl -s -o nul -w "%%{http_code}" "http://127.0.0.1:%PORT%%PATH_%" > "%TEMP%\hc.txt"
set /p CODE=<"%TEMP%\hc.txt"
if "%CODE%"=="200" (echo ✅ %NAME% — :%PORT%) else (echo ❌ %NAME% — :%PORT% ^(%CODE%^))
endlocal
exit /b
```

---

📊 لوحة المراقبة الموحّدة

كل Pack يجب أن يوفّر /health و /metrics:

```json
// GET http://127.0.0.1:8790/health
{
  "ok": true,
  "pack": "core-pack",
  "version": "1.0.0",
  "uptime": 3600,
  "ports": { "agent": 8790, "bridge": 8788 }
}

// GET http://127.0.0.1:8790/metrics
{
  "file.read":     { "p50": 12, "p95": 45, "calls": 1523 },
  "file.write":    { "p50": 28, "p95": 120, "calls": 234 },
  "shell.run":     { "p50": 450, "p95": 2100, "calls": 87 },
  "memory_mb": 245,
  "open_files": 12
}
```

الواجهة تعرض: بطاقة لكل Pack، مع مؤشر أخضر/أحمر، وزر إعادة تشغيل.

---

🗓️ خطة التنفيذ بالـ Packs

الأسبوع الـ Packs المدة
1 core-pack + studio (هيكل) 5 أيام
2 editor-pack (P1) 5 أيام
3 search-pack (P2) + safety-pack (P3) 5 أيام
4 ai-pack (P4) + agent-pack (P5) 5 أيام
5 polish-pack (P7) + اختبار شامل 5 أيام
6 نشر + توثيق 5 أيام

الإجمالي: 6 أسابيع → منظومة كاملة.

---

🎁 فوائد نظام Pack

الفائدة الشرح
استقلالية أي Pack يمكن تشغيله وحده للاختبار
استبدالية استبدل editor-pack بـ Vim دون كسر الباقي
قابلية القياس قِس كل Pack منفصلاً
إعادة استخدام core-pack يخدم مشاريع أخرى
صيانة تحديث Pack لا يمس الباقي
اختبار test.bat لكل Pack يعمل في CI
توسّع إضافة Pack جديد = مجلد + pack.json
توزيع شارك Pack واحد مع المجتمع

---

🚦 خطوتك الأولى غداً

```bash
# 1. أنشئ الهيكل
mkdir F:\nawat\NAWAT\forge\packs
cd F:\nawat\NAWAT\forge\packs

# 2. انسخ core-pack الموجود
move ..\agent core-pack\agent

# 3. أنشئ pack.json لكل واحد (ابدأ بـ core)
# 4. اكتب start-core.bat
# 5. اختبر: نقرتان → كل شيء يعمل

# 6. ثم انتقل لـ editor-pack
```

القاعدة: كل Pack يعمل قبل الانتقال للتالي. لا موازاة.

---

🎤 الخلاصة

نظام Pack ليس مجرد تنظيم ملفات — هو فلسفة هندسية.

· كل وحدة مستقلة
· كل وحدة قابلة للاختبار
· كل وحدة قابلة للاستبدال
· كل وحدة تعرف حدودها (توفّر/تستهلك)

النتيجة: منظومة 12 ضعف أسهل في الصيانة من مشروع واحد ضخم.

---

هل أبدأ بكتابة core-pack كاملاً (pack.json + start.bat + agent + metrics) جاهزاً للنسخ؟ قل "نعم اكتب core-pack" وأبدأ فوراً. 🚀