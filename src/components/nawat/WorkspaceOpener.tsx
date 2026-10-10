import { useRef, useState } from "react";
import { FolderOpen, FolderPlus, Files, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/lib/nawat/workspace";
import { PY_PACKS, notebook, pipfile, pyprojectToml, requirementsTxt } from "@/lib/nawat/python-libs";

const SKIP_DIRS = /(^|\/)(node_modules|\.git|dist|build|\.next|\.venv|__pycache__|\.cache)(\/|$)/;
const TEXT_EXT =
  /\.(md|txt|json|jsonc|ya?ml|toml|ini|env|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|c|h|cpp|cs|php|sh|bat|ps1|sql|xml|svg|csv|log|vue|svelte|dockerfile|gitignore)$/i;
const MAX_TEXT = 512 * 1024;
const MAX_FILES = 1500;

type Stat = { files: number; skipped: number; bytes: number; byExt: Record<string, number> };

const TEMPLATES: Record<string, (n: string) => Record<string, string>> = {
  vide: (n) => ({ [`${n}/README.md`]: `# ${n}\n\nمشروع جديد في NAWAT Studio.\n` }),
  web: (n) => ({
    [`${n}/README.md`]: `# ${n}\n\nتطبيق ويب.\n`,
    [`${n}/index.html`]: `<!doctype html>\n<html lang="ar" dir="rtl">\n<head><meta charset="utf-8"><title>${n}</title><link rel="stylesheet" href="style.css"></head>\n<body><h1>${n}</h1><script src="main.js"></script></body>\n</html>\n`,
    [`${n}/style.css`]: `body { font-family: system-ui; margin: 2rem; }\n`,
    [`${n}/main.js`]: `console.log("${n} ready");\n`,
  }),
  python: (n) => ({
    [`${n}/README.md`]: `# ${n}\n\nمشروع Python.\n`,
    [`${n}/main.py`]: `def main():\n    print("${n}")\n\n\nif __name__ == "__main__":\n    main()\n`,
    [`${n}/requirements.txt`]: ``,
  }),
  agent: (n) => ({
    [`${n}/profile.json`]: `{\n  "name": "${n}",\n  "role": "",\n  "task": ""\n}\n`,
    [`${n}/agent.py`]: `def plan(goal: str) -> list[str]:\n    return [goal]\n\n\ndef learn(event: dict) -> None:\n    pass\n`,
  }),
  "python-api": (n) => ({
    [`${n}/README.md`]: `# ${n}\n\nAPI FastAPI.\n\n    pip install -r requirements.txt\n    uvicorn app:app --reload\n`,
    [`${n}/app.py`]: `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\n\napp = FastAPI()\napp.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])\n\n\n@app.get("/api/hello")\ndef hello():\n    return {"message": "Bonjour depuis Python"}\n`,
    [`${n}/requirements.txt`]: requirementsTxt(PY_PACKS[0].pkgs),
    [`${n}/pyproject.toml`]: pyprojectToml(n, PY_PACKS[0].pkgs),
  }),
  "python-ai": (n) => ({
    [`${n}/README.md`]: `# ${n}\n\nIA locale + données.\n\n    pip install -r requirements.txt\n    python main.py\n`,
    [`${n}/main.py`]: `import ollama\nimport pandas as pd\n\nr = ollama.chat(model="nawat-coder:latest", messages=[{"role": "user", "content": "Bonjour"}])\nprint(r["message"]["content"])\nprint(pd.DataFrame({"a": [1, 2, 3]}).describe())\n`,
    [`${n}/analyse.ipynb`]: notebook(n),
    [`${n}/requirements.txt`]: requirementsTxt(PY_PACKS[1].pkgs),
  }),
  "python-full": (n) => ({
    [`${n}/README.md`]: `# ${n}\n\nWeb + IA + automatisation.\n\n    pip install -r requirements.txt\n`,
    [`${n}/main.py`]: `def main():\n    print("${n}")\n\n\nif __name__ == "__main__":\n    main()\n`,
    [`${n}/requirements.txt`]: requirementsTxt(),
    [`${n}/pyproject.toml`]: pyprojectToml(n),
    [`${n}/Pipfile`]: pipfile(),
  }),
};

function slug(s: string) {
  return s.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "projet";
}

function report(name: string, st: Stat) {
  const rows = Object.entries(st.byExt)
    .sort((a, b) => b[1] - a[1])
    .map(([e, c]) => `| ${e} | ${c} |`)
    .join("\n");
  return `# تحليل المشروع: ${name}\n\n- التاريخ: ${new Date().toLocaleString("ar")}\n- ملفات مستوردة: ${st.files}\n- ملفات متجاوزة (ثنائية/كبيرة/مجلدات مستبعدة): ${st.skipped}\n- الحجم النصي: ${(st.bytes / 1024).toFixed(1)} KB\n\n## حسب النوع\n\n| الامتداد | العدد |\n|---|---|\n${rows}\n`;
}

export function WorkspaceOpener() {
  const { importFiles, writeFile, openFile } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState("web");
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  async function ingest(list: FileList | null, fallbackName: string) {
    if (!list || list.length === 0) return;
    const all = Array.from(list);
    const first = (all[0] as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
    const project = slug(first.split("/")[0] || fallbackName);
    const out: Record<string, string> = {};
    const st: Stat = { files: 0, skipped: 0, bytes: 0, byExt: {} };
    setBusy({ done: 0, total: all.length });
    for (let i = 0; i < all.length; i++) {
      const f = all[i]! as File & { webkitRelativePath?: string };
      const rel = f.webkitRelativePath || `${project}/${f.name}`;
      const ext = (f.name.match(/\.[^.]+$/)?.[0] ?? f.name).toLowerCase();
      if (SKIP_DIRS.test(rel) || st.files >= MAX_FILES || f.size > MAX_TEXT || !TEXT_EXT.test(f.name)) {
        st.skipped++;
      } else {
        out[`my-app/${rel}`] = await f.text();
        st.files++;
        st.bytes += f.size;
        st.byExt[ext] = (st.byExt[ext] ?? 0) + 1;
      }
      if (i % 25 === 0) setBusy({ done: i + 1, total: all.length });
    }
    importFiles(out);
    const rp = `logs/analyse-${project}.md`;
    writeFile(rp, report(project, st), { source: "agent" });
    openFile(rp);
    setBusy(null);
    setOpen(false);
    toast.success(`تم تحليل ${project}: ${st.files} ملف في EXPLORER`);
  }

  function createProject() {
    const n = slug(name);
    const files = TEMPLATES[tpl]!(n);
    const prefixed: Record<string, string> = {};
    for (const [p, c] of Object.entries(files)) prefixed[`my-app/${p}`] = c;
    importFiles(prefixed);
    openFile(Object.keys(prefixed)[0]!);
    setOpen(false);
    setName("");
    toast.success(`أُنشئ المشروع ${n} في my-app/`);
  }

  return (
    <>
      <div className="border-b border-border p-2">
        <Button size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
          <Sparkles className="size-4" />
          مساحة عمل / مشروع
        </Button>
      </div>
      <input
        ref={dirRef}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => void ingest(e.target.files, "dossier")}
      />
      <input
        ref={filesRef}
        type="file"
        hidden
        multiple
        onChange={(e) => void ingest(e.target.files, "fichiers")}
      />
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>مساحة العمل</DialogTitle>
            <DialogDescription>
              اختر مجلد مشروع أو ملفات ليحللها النظام، أو أنشئ مشروعًا جديدًا. النتيجة تظهر في
              EXPLORER تحت my-app/.
            </DialogDescription>
          </DialogHeader>
          {busy ? (
            <div className="space-y-2 py-4">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> تحليل الملفات… {busy.done}/{busy.total}
              </div>
              <Progress value={(busy.done / busy.total) * 100} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={() => dirRef.current?.click()}>
                  <FolderOpen className="size-4" /> فتح مجلد مشروع
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => filesRef.current?.click()}>
                  <Files className="size-4" /> تحديد ملفات
                </Button>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-semibold">مشروع جديد</p>
                <Input
                  placeholder="اسم المشروع"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {Object.keys(TEMPLATES).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={tpl === k ? "default" : "ghost"}
                      onClick={() => setTpl(k)}
                    >
                      {k}
                    </Button>
                  ))}
                </div>
                <Button className="w-full gap-2" disabled={!name.trim()} onClick={createProject}>
                  <FolderPlus className="size-4" /> إنشاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
