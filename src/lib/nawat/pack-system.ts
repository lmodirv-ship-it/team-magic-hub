const SEARCH_PACK_SOURCES = import.meta.glob("./pack-sources/search-pack/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
// NAWAT Pack System — مولّد معمارية forge/ + سكربت الإنشاء الشامل
// يطابق وثيقة «NAWAT Pack System — الخطة المعمارية الكاملة» (454 سطرًا)

interface PackSpec {
  name: string;
  title: string;
  desc: string;
  ports: Record<string, number>;
  depends_on: string[];
  provides: string[];
  consumes: string[];
  subdirs: string[];
  order: number;
  startScript: string; // اسم سكربت التشغيل داخل الـ Pack
  readmeExtra?: string;
  extraFiles?: Record<string, string>;
}

const PACKS: PackSpec[] = [
  {
    name: "core-pack", title: "النواة (مطلوب دائمًا)",
    desc: "العمليات الأساسية — قراءة/كتابة الملفات، تنفيذ الأوامر، القياس",
    ports: { agent: 8790, bridge: 8788, metrics: 8791 },
    depends_on: [],
    provides: ["file.read", "file.write", "file.tree", "file.delete", "shell.run", "metrics.record"],
    consumes: [],
    subdirs: ["agent", "bridge", "metrics"], order: 1, startScript: "start-core.bat",
    readmeExtra: "## يوفّر للباقي\n- `file.read(path)` / `file.write(path, content)`\n- `file.tree(path, depth)` / `file.delete(path)`\n- `shell.run(cmd, cwd)`\n- `metrics.record(name, duration)`\n",
  },
  {
    name: "editor-pack", title: "المحرر (P1)",
    desc: "Monaco Editor (self-hosted) + شريط الحالة + Command Registry",
    ports: { editor: 5173 },
    depends_on: ["core-pack"],
    provides: ["editor.openFile", "editor.saveCurrent", "editor.registerCommand"],
    consumes: ["file.read", "file.write"],
    subdirs: ["ui", "workers", "commands"], order: 6, startScript: "start-editor.bat",
    readmeExtra: "## الميزات\n- Monaco بدون CDN\n- Workers محلية\n- شريط حالة كامل\n- Diff viewer مدمج\n",
  },
  {
    name: "search-pack", title: "البحث والفهرسة (P2)",
    desc: "بحث سريع + بحث دلالي (RAG) + فهرسة تدريجية",
    ports: { indexer: 8792, search: 8793 },
    depends_on: ["core-pack"],
    provides: ["search.text", "search.semantic", "index.status"],
    consumes: ["file.tree", "file.read"],
    subdirs: ["indexer", "semantic", "global-search"], order: 3, startScript: "start-search.bat",
    readmeExtra: "## المكوّنات\n- ripgrep (مستورد) للبحث النصي\n- ChromaDB + nomic-embed للبحث الدلالي\n- treesitter للتقسيم عند حدود الدوال\n",
  },
  {
    name: "safety-pack", title: "أمان البيانات (P3)",
    desc: "ضمان صفر فقدان بيانات — مراقبة + سجل تعافٍ + كتابة ذرّية",
    ports: { watcher: 8794, journal: 8795 },
    depends_on: ["core-pack"],
    provides: ["file.write-atomic", "session.recover", "conflict.detect"],
    consumes: ["file.read"],
    subdirs: ["watcher", "journal", "atomic-write", "conflict-resolver"], order: 2, startScript: "start-safety.bat",
    readmeExtra: "## يوفّر\n- `file.write-atomic(path, content)` ← يُستدعى بدل file.write\n- `session.recover()` — استرجاع الجلسة\n- `conflict.detect()` — كشف تغيير خارجي\n",
  },
  {
    name: "ai-pack", title: "السياق والذكاء (P4)",
    desc: "إدارة السياق المُرسَل للنماذج + التوجيه التلقائي",
    ports: { router: 8796, budget: 8797 },
    depends_on: ["core-pack"],
    provides: ["router.classify", "budget.select", "context.inspect"],
    consumes: ["search.text", "search.semantic"],
    subdirs: ["chunker", "context-budget", "router", "prompt-templates"], order: 4, startScript: "start-ai.bat",
    readmeExtra: "## يوفّر\n- `router.classify(text)` → intent\n- `budget.select(files, query)` → selected context\n- `context.inspect()` — ما يُرسل بالضبط\n",
  },
  {
    name: "agent-pack", title: "الوكيل الذكي (P5)",
    desc: "ReAct Loop + الأدوات + Diff Preview",
    ports: { agent: 8790 },
    depends_on: ["core-pack", "ai-pack", "safety-pack"],
    provides: ["agent.run", "diff.propose", "diff.apply"],
    consumes: ["router.classify", "budget.select", "file.write-atomic"],
    subdirs: ["react-loop", "tools", "diff-preview", "git-bridge"], order: 5, startScript: "start-agent.bat",
    readmeExtra: "## الأدوات (بدون git — مستبعد من النطاق)\nread_file, write_file, edit_file, list_dir, search_code, search_semantic, run_shell, fetch_url, screenshot\n\n## يوفّر\n- `agent.run(message, model)` → SSE stream\n- `diff.propose(path, patch)` → DiffPreview\n- `diff.apply(approval)` → write-atomic\n\n> ملاحظة: مجلد git-bridge هيكلي فقط — Git مستبعد بقرار صريح.\n",
  },
  {
    name: "polish-pack", title: "التميّز (P7)",
    desc: "الميزات الفريدة — RTL + الصوت + CLI + المزامنة",
    ports: { voice: 8798, cli: 8799 },
    depends_on: ["core-pack"],
    provides: ["rtl.enhance", "voice.tts", "voice.stt", "cli"],
    consumes: [],
    subdirs: ["rtl-enhancer", "voice", "cli", "sync"], order: 7, startScript: "start-polish.bat",
    readmeExtra: "## المكوّنات\n- rtl-enhancer — تحسين RTL للعربية\n- voice — Whisper + Piper\n- cli — nawat.mjs موحّد\n- sync — مزامنة SSH + CRDT\n",
  },
  {
    name: "studio", title: "الواجهة الموحّدة (Electron/Web)",
    desc: "تجميع كل الـ Packs في واجهة واحدة — يكتشفها عبر packs-registry.json",
    ports: { studio: 8798 },
    depends_on: ["core-pack"],
    provides: ["studio-ui"],
    consumes: ["metrics.record"],
    subdirs: [], order: 8, startScript: "start-studio.bat",
    readmeExtra: "في الواجهة: مؤشرات حالة ملوّنة لكل Pack + أزرار تشغيل/إيقاف فردية.\n",
    extraFiles: {
      "index.html": `<!doctype html>\n<html lang="ar" dir="rtl">\n<head><meta charset="utf-8"><title>NAWAT Studio</title></head>\n<body><h1>NAWAT Studio — الواجهة الموحّدة</h1><script src="packs-registry.json" type="application/json"></script></body>\n</html>\n`,
    },
  },
];

function packJson(p: PackSpec): string {
  return JSON.stringify({
    name: p.name,
    version: "1.0.0",
    description: p.desc,
    author: "NAWAT",
    ports: p.ports,
    depends_on: p.depends_on,
    provides: p.provides,
    consumes: p.consumes,
    env: { ROOT: "F:/nawat", LOG_LEVEL: "info" },
    endpoints: { health: "/health", info: "/agent/info", metrics: "/metrics", restart: "/agent/restart" },
    startup_order: p.order,
  }, null, 2) + "\n";
}

function readme(p: PackSpec): string {
  const ports = Object.entries(p.ports).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return `# ${p.name} — ${p.title}\n\n${p.desc}.\n\n## المنافذ\n${ports}\n\n${p.readmeExtra ?? ""}\n## التشغيل\n\`\`\`\n${p.startScript}   :: تشغيل بنقرة\nstop.bat           :: إيقاف\ntest.bat           :: اختبار ذاتي\n\`\`\`\n\n## الاعتماديات\n${p.depends_on.length ? p.depends_on.join(", ") : "لا شيء"}\n`;
}

function startBat(p: PackSpec): string {
  const port = Object.values(p.ports)[0] ?? 8000;
  const depCheck = p.depends_on.length
    ? `echo [${p.name}] فحص الاعتماديات...\n` + p.depends_on.map((d) => {
        const dep = PACKS.find((x) => x.name === d);
        const dp = dep ? (Object.values(dep.ports)[0] ?? 8000) : 8790;
        return `curl -s http://127.0.0.1:${dp}/health >nul 2>&1 || (echo ❌ ${d} غير متصل — شغّله أولاً && exit /b 1)`;
      }).join("\n") + "\n"
    : "";
  return `@echo off\nchcp 65001 >nul\ntitle NAWAT ${p.name}\n${depCheck}echo [${p.name}] تشغيل على المنفذ ${port}...\nrem TODO: node src\\main.js\necho ✅ ${p.name} جاهز\npause\n`;
}

function stopBat(p: PackSpec): string {
  const ports = Object.values(p.ports);
  return `@echo off\nrem ${p.name} — إيقاف\n` + ports.map((port) =>
    `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"`
  ).join("\n") + `\necho ✅ أُوقف ${p.name}\n`;
}

function testBat(p: PackSpec): string {
  const port = Object.values(p.ports)[0] ?? 8000;
  return `@echo off\nchcp 65001 >nul\nrem ${p.name} — اختبار ذاتي\ncurl -s http://127.0.0.1:${port}/health && echo ✅ OK || echo ❌ FAIL\npause\n`;
}

/** يبني خريطة مسار → محتوى لكامل معمارية forge/ */
export function buildPackSystemFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  const put = (path: string, content: string) => { files[path] = content; };

  for (const p of PACKS) {
    const base = `forge/packs/${p.name}`;
    put(`${base}/pack.json`, packJson(p));
    put(`${base}/README.md`, readme(p));
    put(`${base}/${p.startScript}`, startBat(p));
    put(`${base}/stop.bat`, stopBat(p));
    put(`${base}/test.bat`, testBat(p));
    put(`${base}/config/default.json`, JSON.stringify({ logLevel: "info" }, null, 2) + "\n");
    put(`${base}/logs/.gitkeep`, "");
    put(`${base}/tests/README.md`, `# اختبارات ${p.name}\n`);
    for (const sub of p.subdirs) {
      put(`${base}/src/${sub}/README.md`, `# ${sub}\n\nوحدة ${sub} ضمن ${p.name}.\n`);
    }
    if (!p.subdirs.length) put(`${base}/src/README.md`, `# src — ${p.name}\n`);
    for (const [rel, content] of Object.entries(p.extraFiles ?? {})) {
      put(`${base}/${rel}`, content);
    }
  }

  // سجل الـ Packs للواجهة الموحدة (مطابق للوثيقة)
  put("forge/packs/studio/packs-registry.json", JSON.stringify({
    packs: [
      { name: "core-pack", port: 8790, health: "/health" },
      { name: "editor-pack", port: 5173, health: "/health" },
      { name: "search-pack", port: 8793, health: "/health" },
      { name: "safety-pack", port: 8794, health: "/health" },
      { name: "ai-pack", port: 8796, health: "/health" },
      { name: "agent-pack", port: 8790, health: "/agent/info" },
      { name: "polish-pack", port: 8798, health: "/health" },
    ],
  }, null, 2) + "\n");

  // البيان الكامل للنظام
  put("forge/manifest.json", JSON.stringify({
    system: "NAWAT Pack System",
    version: "1.0.0",
    author: "Groupe-HN",
    root: "F:/nawat/NAWAT/forge",
    packs: PACKS.map((p) => ({
      name: p.name, version: "1.0.0", ports: p.ports,
      depends_on: p.depends_on, provides: p.provides, startup_order: p.order,
    })),
  }, null, 2) + "\n");

  // start-all.bat — تشغيل بترتيب ذكي (مطابق للوثيقة)
  const ordered = [...PACKS].filter((p) => p.name !== "studio").sort((a, b) => a.order - b.order);
  const names: Record<string, string> = {
    "core-pack": "Core Pack", "safety-pack": "Safety Pack", "search-pack": "Search Pack",
    "ai-pack": "AI Pack", "agent-pack": "Agent Pack", "editor-pack": "Editor Pack", "polish-pack": "Polish Pack",
  };
  put("forge/start-all.bat",
    `@echo off\nchcp 65001 >nul\ntitle NAWAT Forge — Master Launcher\ncolor 0B\n\n` +
    `echo ╔════════════════════════════════════════════╗\n` +
    `echo ║  NAWAT Forge — تشغيل كل الـ Packs          ║\n` +
    `echo ╚════════════════════════════════════════════╝\necho.\n\n` +
    ordered.map((p, i) =>
      `echo [${i + 1}/7] تشغيل ${names[p.name] ?? p.name}...\ncall packs\\${p.name}\\${p.startScript}\ntimeout /t ${p.name === "core-pack" ? 4 : 2} /nobreak >nul\n`
    ).join("\n") +
    `\necho.\necho ✅ كل الـ Packs تعمل!\necho.\necho 🌐 الواجهة: http://localhost:5173\necho 📊 المراقبة: http://localhost:8791\necho.\nstart "" "http://localhost:5173"\npause\n`);

  // stop-all.bat — إيقاف مرتّب (مطابق للوثيقة)
  put("forge/stop-all.bat",
    `@echo off\nchcp 65001 >nul\necho إيقاف كل الـ Packs...\n` +
    `for %%P in (8790 8788 8791 8792 8793 8794 8795 8796 8797 8798 8799 5173) do (\n` +
    `  powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %%P -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }"\n` +
    `)\necho ✅ تم الإيقاف\n`);

  // health-check.bat — فحص صحة كل Pack (مطابق للوثيقة)
  const checks: Array<[string, number]> = [
    ["Core Agent", 8790], ["Core Bridge", 8788], ["Core Metrics", 8791],
    ["Search Index", 8792], ["Search Engine", 8793], ["Safety Watch", 8794],
    ["Safety Journal", 8795], ["AI Router", 8796], ["AI Budget", 8797],
    ["Voice", 8798], ["CLI", 8799],
  ];
  put("forge/health-check.bat",
    `@echo off\nchcp 65001 >nul\n` +
    `echo ═══════════════════════════════════════\necho   فحص صحة NAWAT Forge Packs\necho ═══════════════════════════════════════\necho.\n\n` +
    checks.map(([n, p]) => `call :check "${n}" ${p} /health`).join("\n") +
    `\n\necho.\npause\nexit /b\n\n:check\nsetlocal\nset NAME=%~1\nset PORT=%~2\nset PATH_=%~3\n` +
    `curl -s -o nul -w "%%{http_code}" "http://127.0.0.1:%PORT%%PATH_%" > "%TEMP%\\hc.txt"\n` +
    `set /p CODE=<"%TEMP%\\hc.txt"\n` +
    `if "%CODE%"=="200" (echo ✅ %NAME% — :%PORT%) else (echo ❌ %NAME% — :%PORT% ^(%CODE%^))\n` +
    `endlocal\nexit /b\n`);

  put("forge/README.md",
    `# NAWAT Pack System\n\nبدل مشروع واحد ضخم: كل Pack وحدة مستقلة قابلة للتشغيل بنقرة واحدة، وتتواصل مع الباقي عبر واجهات معرّفة. أي Pack يمكن استبداله أو تطويره دون كسر الباقي.\n\n## الـ Packs\n` +
    ordered.map((p) => `${p.order}. **${p.name}** — ${p.title}`).join("\n") +
    `\n\n## التشغيل\n\`\`\`\nstart-all.bat     :: تشغيل كل شيء بترتيب ذكي\nstop-all.bat      :: إيقاف كل شيء\nhealth-check.bat  :: فحص صحة كل Pack\n\`\`\`\n\n## لوحة المراقبة\nكل Pack يوفّر \`/health\` و \`/metrics\`. الواجهة تعرض بطاقة لكل Pack مع مؤشر أخضر/أحمر وزر إعادة تشغيل.\n`);

  // search-pack: الكود التنفيذي الحقيقي (من وثيقة search-pack)
  for (const k of Object.keys(files)) if (k.startsWith("forge/packs/search-pack/") && !k.includes("/logs/")) delete files[k];
  for (const [src, body] of Object.entries(SEARCH_PACK_SOURCES)) {
    const name = src.split("/").pop()!.replace(/\.txt$/, "").replace(/__/g, "/");
    files[`forge/packs/search-pack/${name}`] = body as string;
  }

  return files;
}

// ─── سكربت الإنشاء الشامل ───────────────────────────────────────────────

/** UTF-8 → base64 آمن في المتصفح، مقسّم لتفادي تجاوز المكدس */
function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

/**
 * setup-forge.bat — سكربت واحد مكتفٍ ذاتيًا ينشئ شجرة forge/ كاملة دفعة واحدة.
 * كل الملفات مضمّنة base64 داخل السكربت؛ لا يحتاج إنترنت ولا أدوات خارجية.
 */
export function buildSetupBat(): string {
  const files = buildPackSystemFiles();
  const b64 = toB64(JSON.stringify(files));
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 1000) chunks.push(b64.slice(i, i + 1000));

  const ps = [
    `$j=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([IO.File]::ReadAllText($env:NAWAT_TMP)))`,
    `$m=$j|ConvertFrom-Json`,
    `$root=Join-Path $env:NAWAT_ROOT 'forge'`,
    `$n=0`,
    `foreach($pr in $m.PSObject.Properties){`,
    ` $p=Join-Path $root ($pr.Name -replace '/','\\')`,
    ` [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($p))|Out-Null`,
    ` [IO.File]::WriteAllText($p,$pr.Value,(New-Object Text.UTF8Encoding($false)))`,
    ` $n++`,
    `}`,
    `Write-Host "✅ أُنشئت $n ملفًا في $root"`,
  ].join("; ");

  return [
    "@echo off",
    "chcp 65001 >nul",
    "title NAWAT Forge — الإنشاء الشامل",
    "echo ╔════════════════════════════════════════════╗",
    "echo ║  NAWAT Pack System — إنشاء forge/ كاملة     ║",
    "echo ╚════════════════════════════════════════════╝",
    "echo.",
    `set "NAWAT_ROOT=%~dp0"`,
    'set "NAWAT_TMP=%TEMP%\\nawat-forge-%RANDOM%%RANDOM%.b64"',
    'break>"%NAWAT_TMP%"',
    ...chunks.map((c) => `>>"%NAWAT_TMP%" echo ${c}`),
    "echo إنشاء الملفات...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`,
    'del "%NAWAT_TMP%" 2>nul',
    "echo.",
    "echo الخطوة التالية: forge\\start-all.bat",
    "pause",
    "",
  ].join("\n");
}

/** setup-forge.sh — نسخة Linux/Mac من سكربت الإنشاء الشامل */
export function buildSetupSh(): string {
  const files = buildPackSystemFiles();
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "set -e",
    'ROOT="$(cd "$(dirname "$0")" && pwd)/forge"',
    'echo "═══ NAWAT Pack System — إنشاء forge/ كاملة ═══"',
    'mkdir -p "$ROOT"',
    "n=0",
  ];
  for (const [path, content] of Object.entries(files)) {
    lines.push(`mkdir -p "$ROOT/$(path.split("/").slice(0, -1).join("/"))"`);
    lines.push(`base64 -d > "$ROOT/${path}" <<'NAWAT_B64'`);
    const b64 = toB64(content);
    for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
    lines.push("NAWAT_B64");
    lines.push("n=$((n+1))");
  }
  lines.push('echo "✅ أُنشئت $n ملفًا في $ROOT"');
  lines.push('echo "الخطوة التالية: شغّل الخدمات من forge/packs"');
  lines.push("");
  return lines.join("\n");
}
