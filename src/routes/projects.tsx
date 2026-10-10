import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bot, FileCode2, FolderPlus, Play, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";
import {
  createProject, extractFiles, getActiveProject, listProjects, projectTree, readProjectFile,
  setActiveProject, writeProjectFile, type ProjectFile, type ServerProject,
} from "@/lib/nawat/projects";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "المشاريع والمنسّق — NAWAT Studio" },
      { name: "description", content: "كل مشروع في مجلد مستقل على السيرفر، ونموذج منسّق يوزّع الأدوار وينشئ الملفات." },
      { property: "og:title", content: "المشاريع والمنسّق — NAWAT Studio" },
      { property: "og:description", content: "مشاريع السيرفر والنموذج المنسّق للمهام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

type Role = { role: string; model: string; task: string; status?: "wait" | "run" | "done" | "fail"; output?: string };
const ORCH_KEY = "nawat.orchestrator.v1";
const DEFAULT_ROLES = {
  coordinator: "qwen3.5:9b", planner: "qwen3.5:9b", coder: "qwen3:4b", reviewer: "qwen3.5:9b",
  html: "nawat-coder:latest", css: "nawat-coder:latest", js: "nawat-coder:latest", debugger: "qwen3.5:9b",
};
const ROLE_LABELS: Record<keyof typeof DEFAULT_ROLES, string> = {
  coordinator: "المنسّق", planner: "المخطط", coder: "المبرمج", reviewer: "المراجع",
  html: "باني HTML", css: "باني CSS", js: "باني JS", debugger: "المصحّح",
};
/** Specialist team: each builder owns one file and writes it directly in the project. */
const TEAM: { role: "html" | "css" | "js"; file: string; lang: string }[] = [
  { role: "html", file: "index.html", lang: "html" },
  { role: "css", file: "style.css", lang: "css" },
  { role: "js", file: "app.js", lang: "javascript" },
];
/** All text formats a builder can produce (binary media like png/mp4 cannot be written by a text model). */
const FORMATS: { id: string; file: string; lang: string; group: string }[] = [
  ...TEAM.map((t) => ({ id: t.role, file: t.file, lang: t.lang, group: "واجهة" })),
  { id: "ts", file: "src/main.ts", lang: "typescript", group: "واجهة" },
  { id: "jsx", file: "src/App.jsx", lang: "react jsx", group: "إطارات" },
  { id: "tsx", file: "src/App.tsx", lang: "react tsx", group: "إطارات" },
  { id: "vue", file: "src/App.vue", lang: "vue", group: "إطارات" },
  { id: "svg", file: "assets/logo.svg", lang: "svg", group: "أصول" },
  { id: "ico", file: "assets/favicon.svg", lang: "svg icon", group: "أصول" },
  { id: "json", file: "package.json", lang: "json", group: "إعدادات" },
  { id: "env", file: ".env.example", lang: "dotenv (بدون أسرار حقيقية)", group: "إعدادات" },
  { id: "md", file: "README.md", lang: "markdown", group: "إعدادات" },
  { id: "gitignore", file: ".gitignore", lang: "gitignore", group: "إعدادات" },
  { id: "sql", file: "db/schema.sql", lang: "sql", group: "خادم" },
  { id: "php", file: "api/index.php", lang: "php", group: "خادم" },
  { id: "py", file: "server/app.py", lang: "python", group: "خادم" },
  { id: "go", file: "server/main.go", lang: "go", group: "خادم" },
];
const FORMATS_KEY = "nawat.orchestrator.formats.v1";
const stripFence = (t: string) => (t.match(/```[\w-]*[^\n]*\n([\s\S]*?)```/)?.[1] ?? t).trim();

async function ask(model: string, system: string, user: string) {
  const d = (await callConfiguredBridge("chat", { model, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] })) as { message?: { content?: string } };
  return d.message?.content ?? "";
}

function ProjectsPage() {
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [root, setRoot] = useState("");
  const [active, setActive] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try { const r = await listProjects(); setProjects(r.projects); setRoot(r.root); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, []);
  const loadTree = useCallback(async (n: string) => {
    if (!n) return;
    try { setFiles((await projectTree(n)).files); } catch (e) { toast.error((e as Error).message); }
  }, []);
  useEffect(() => { setActive(getActiveProject()); void refresh(); }, [refresh]);
  useEffect(() => { void loadTree(active); }, [active, loadTree]);

  const pick = (n: string) => { setActive(n); setActiveProject(n); setOpen(null); };

  return (
    <Page eyebrow="Projects / Orchestrator" title="المشاريع والمنسّق" description="كل مشروع جديد يُنشأ في مجلد مستقل على السيرفر، والنموذج المنسّق يوزّع الأدوار ويكتب الملفات فيه."
      actions={<Button variant="outline" size="icon" aria-label="تحديث" onClick={() => void refresh()}><RefreshCw /></Button>}>
      {err && <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">السيرفر غير متاح الآن: {err}</p>}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Panel title="مشاريع السيرفر" note={root || "/data/projects"}>
          <div className="flex gap-1">
            <input className="control" placeholder="اسم مشروع جديد" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button size="icon" aria-label="إنشاء" onClick={async () => {
              if (!newName.trim()) return;
              try { await createProject(newName.trim()); toast.success("أُنشئ مجلد المشروع على السيرفر"); pick(newName.trim()); setNewName(""); void refresh(); }
              catch (e) { toast.error((e as Error).message); }
            }}><FolderPlus /></Button>
          </div>
          <div className="mt-2 grid gap-1">
            {projects.map((p) => (
              <button key={p.name} onClick={() => pick(p.name)} className={cn("rounded-md px-2 py-1.5 text-start text-sm", p.name === active ? "bg-primary/15 text-primary" : "hover:bg-muted")}>{p.name}</button>
            ))}
            {projects.length === 0 && <p className="text-xs text-muted-foreground">لا مشاريع بعد</p>}
          </div>
          {active && (
            <div className="mt-3 max-h-72 overflow-auto border-t border-border pt-2 font-mono text-[11px]" dir="ltr">
              {files.filter((f) => f.type === "file").map((f) => (
                <button key={f.path} className="block w-full truncate rounded px-1 text-start hover:bg-muted" onClick={async () => {
                  try { setOpen({ path: f.path, content: (await readProjectFile(active, f.path)).content }); } catch (e) { toast.error((e as Error).message); }
                }}><FileCode2 className="me-1 inline size-3" />{f.path}</button>
              ))}
            </div>
          )}
        </Panel>
        <div className="grid gap-4">
          {open && (
            <Panel title={open.path} actions={<Button size="sm" onClick={async () => { await writeProjectFile(active, open.path, open.content); toast.success("حُفظ على السيرفر"); }}><Save />حفظ</Button>}>
              <textarea dir="ltr" rows={14} className="control font-mono text-xs" value={open.content} onChange={(e) => setOpen({ ...open, content: e.target.value })} />
            </Panel>
          )}
          <Orchestrator project={active} onWritten={() => void loadTree(active)} />
        </div>
      </div>
    </Page>
  );
}

function Orchestrator({ project, onWritten }: { project: string; onWritten: () => void }) {
  const [models, setModels] = useState(DEFAULT_ROLES);
  const [goal, setGoal] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const [formats, setFormats] = useState<string[]>(["html", "css", "js"]);
  useEffect(() => { try { setModels({ ...DEFAULT_ROLES, ...JSON.parse(localStorage.getItem(ORCH_KEY) ?? "{}") }); } catch { /* */ } }, []);
  useEffect(() => { try { const f = JSON.parse(localStorage.getItem(FORMATS_KEY) ?? "null"); if (Array.isArray(f) && f.length) setFormats(f); } catch { /* */ } }, []);
  const toggleFormat = (id: string) => setFormats((v) => { const n = v.includes(id) ? v.filter((x) => x !== id) : [...v, id]; localStorage.setItem(FORMATS_KEY, JSON.stringify(n)); return n; });
  const builders = FORMATS.filter((f) => formats.includes(f.id)).map((f) => ({ ...f, model: (models as Record<string, string>)[f.id] ?? models.coder }));
  const setModel = (k: keyof typeof DEFAULT_ROLES, v: string) => { const n = { ...models, [k]: v }; setModels(n); localStorage.setItem(ORCH_KEY, JSON.stringify(n)); };

  const plan = async () => {
    if (!goal.trim()) { toast.error("اكتب الهدف"); return; }
    setBusy(true);
    try {
      const txt = await ask(models.coordinator,
        'أنت المنسّق. قسّم الهدف إلى مهام قصيرة ووزّعها على الأدوار: planner (تخطيط)، coder (كتابة الملفات)، reviewer (مراجعة)، image (وصف صور). أعد JSON فقط: [{"role":"coder","task":"..."}]',
        goal);
      const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1)) as { role: string; task: string }[];
      setRoles(arr.map((r) => ({ ...r, model: (models as Record<string, string>)[r.role] ?? models.coder, status: "wait" })));
    } catch (e) { toast.error(`تعذّر التخطيط: ${(e as Error).message}`); }
    setBusy(false);
  };

  const execute = async () => {
    if (!project) { toast.error("اختر مشروعًا أولًا"); return; }
    setBusy(true);
    let context = "";
    for (let i = 0; i < roles.length; i++) {
      const r = roles[i]!;
      setRoles((l) => l.map((x, j) => (j === i ? { ...x, status: "run" } : x)));
      try {
        const sys = r.role === "coder"
          ? "اكتب الملفات المطلوبة فقط. كل ملف في كتلة كود تبدأ بـ ```lang path/file.ext"
          : `أنت ${r.role} في فريق تطوير. أجب باختصار.`;
        const out = await ask(r.model, sys, `الهدف: ${goal}\nمهمتك: ${r.task}\nما سبق:\n${context.slice(-4000)}`);
        context += `\n[${r.role}] ${out}`;
        const filesOut = extractFiles(out);
        for (const [p, c] of Object.entries(filesOut)) await writeProjectFile(project, p, c);
        if (Object.keys(filesOut).length) onWritten();
        window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: out, model: r.model, started: Date.now(), done: true } }));
        setRoles((l) => l.map((x, j) => (j === i ? { ...x, status: "done", output: out } : x)));
      } catch (e) {
        setRoles((l) => l.map((x, j) => (j === i ? { ...x, status: "fail", output: (e as Error).message } : x)));
      }
    }
    setBusy(false);
    toast.success("انتهى المنسّق");
  };

  /** Coordinator → parallel HTML/CSS/JS builders → debugger fixes each file → reviewer notes. */
  const runTeam = async () => {
    if (!project) { toast.error("اختر مشروعًا أولًا"); return; }
    if (!goal.trim()) { toast.error("اكتب الهدف"); return; }
    setBusy(true);
    const list: Role[] = [
      { role: "coordinator", model: models.coordinator, task: "تقسيم المشروع وتحديد العقد بين الملفات", status: "run" },
      ...builders.map((t) => ({ role: t.id, model: t.model, task: t.file, status: "wait" as const })),
      { role: "debugger", model: models.debugger, task: "تصحيح الملفات مباشرة", status: "wait" },
      { role: "reviewer", model: models.reviewer, task: "مراجعة الجودة", status: "wait" },
    ];
    setRoles(list);
    const upd = (i: number, p: Partial<Role>) => setRoles((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
    const live = (text: string, model: string) => window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text, model, started: Date.now(), done: true } }));
    try {
      const spec = await ask(models.coordinator,
        `أنت المنسّق. اكتب مواصفات قصيرة للمشروع: الأقسام، أسماء الـ id والـ class، والدوال، والجداول والمسارات، حتى تتوافق هذه الملفات: ${builders.map((b) => b.file).join("، ")}. لا تكتب كودًا.`, goal);
      upd(0, { status: "done", output: spec });
      const files: Record<string, string> = {};
      await Promise.all(builders.map(async (t, k) => {
        const i = k + 1;
        upd(i, { status: "run" });
        try {
          const out = await ask(t.model, `أنت متخصص ${t.lang} فقط. اكتب محتوى الملف ${t.file} كاملًا داخل كتلة كود واحدة، دون شرح. ملفات المشروع: ${builders.map((b) => b.file).join("، ")} — اربط بينها بشكل صحيح.`, `الهدف: ${goal}\nالمواصفات:\n${spec}`);
          files[t.file] = stripFence(out);
          await writeProjectFile(project, t.file, files[t.file]!);
          onWritten(); live(files[t.file]!, t.model);
          upd(i, { status: "done", output: files[t.file] ?? "" });
        } catch (e) { upd(i, { status: "fail", output: (e as Error).message }); }
      }));
      const di = builders.length + 1;
      upd(di, { status: "run" });
      const all = Object.entries(files).map(([f, c]) => `--- ${f}\n${c}`).join("\n\n");
      for (const [f, c] of Object.entries(files)) {
        const fixed = stripFence(await ask(models.debugger, `أنت المصحّح. أصلح الأخطاء وعدم التوافق في ${f} مع بقية الملفات. أعد الملف كاملًا داخل كتلة كود واحدة.`, `${all}\n\nالملف المطلوب: ${f}\n${c}`));
        if (fixed.length > 20) { await writeProjectFile(project, f, fixed); files[f] = fixed; live(fixed, models.debugger); }
      }
      onWritten();
      upd(di, { status: "done", output: "صُحّحت: " + Object.keys(files).join("، ") });
      upd(di + 1, { status: "run" });
      const review = await ask(models.reviewer, "أنت المراجع. قيّم الجودة من 10 واذكر أهم 5 ملاحظات باختصار.", Object.entries(files).map(([f, c]) => `--- ${f}\n${c}`).join("\n\n"));
      upd(di + 1, { status: "done", output: review });
      toast.success("أنجز الفريق المشروع");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <Panel title="النموذج المنسّق" note={project ? `المشروع: ${project}` : "اختر مشروعًا"}>
      <div className="grid gap-2 sm:grid-cols-4">
        {(Object.keys(DEFAULT_ROLES) as (keyof typeof DEFAULT_ROLES)[]).map((k) => (
          <label key={k} className="text-xs text-muted-foreground">{ROLE_LABELS[k]}
            <input className="control font-mono text-xs" dir="ltr" value={models[k]} onChange={(e) => setModel(k, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="mt-2 rounded-md border border-border p-2">
        <p className="mb-1 text-xs text-muted-foreground">صيغ الملفات التي ينشئها البناؤون ({formats.length})</p>
        <div className="flex flex-wrap gap-1">
          {FORMATS.map((f) => (
            <button type="button" key={f.id} aria-pressed={formats.includes(f.id)} onClick={() => toggleFormat(f.id)}
              className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", formats.includes(f.id) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}
              title={f.group}>{f.file}</button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">الصور والفيديو والصوت (png، jpg، mp4، mp3) تُنتج عبر ComfyUI وليس عبر نماذج الكود.</p>
      </div>
      <textarea rows={3} className="control mt-2" placeholder="الهدف: مثلاً موقع تعريفي لمطعم في طنجة" value={goal} onChange={(e) => setGoal(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void plan()}><Bot />وزّع الأدوار</Button>
        <Button disabled={busy || !roles.length} variant="outline" onClick={() => void execute()}><Play />نفّذ واكتب الملفات</Button>
        <Button disabled={busy} variant="secondary" onClick={() => void runTeam()}><Play />فريق متخصص (HTML · CSS · JS + تصحيح + مراجعة)</Button>
      </div>
      {roles.length > 0 && (
        <ol className="mt-3 grid gap-2">
          {roles.map((r, i) => (
            <li key={i} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">{r.role}</span>
                <span className="font-mono text-muted-foreground" dir="ltr">{r.model}</span>
                <span className="ms-auto">{({ wait: "بانتظار", run: "يعمل…", done: "تم", fail: "فشل" })[r.status ?? "wait"]}</span>
              </div>
              <p className="mt-1">{r.task}</p>
              {r.output && <pre dir="ltr" className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-1 font-mono text-[10px]">{r.output.slice(0, 1500)}</pre>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
