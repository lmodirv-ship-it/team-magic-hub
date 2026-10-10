import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { PY_ALL, PY_PACKS, requirementsTxt } from "@/lib/nawat/python-libs";
import { FFMPEG_HELPER, JS_ALL, JS_PACKS, packageJson } from "@/lib/nawat/js-media-libs";

const KEY = "nawat.devtools.v1";
type D = { ssh: string; project: string; pkgs: string; pip: string };
const DEF: D = { ssh: "root@192.168.100.67", project: "my-site", pkgs: "", pip: "" };

function copy(t: string) { void navigator.clipboard.writeText(t); toast.success("تم النسخ"); }
function download(name: string, t: string) {
  const url = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
  const a = document.createElement("a"); a.href = url; a.download = name.split("/").pop() || name; a.click();
  URL.revokeObjectURL(url);
}

export function DevTools({ s }: { s: { path: string; ollama: string } }) {
  const [d, setD] = useState<D>(DEF);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v) setD({ ...DEF, ...(JSON.parse(v) as D) }); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(d)); }, [ready, d]);

  const dir = `/data/projects/${d.project}`;
  const codex = `# ~/.codex/config.toml\nmodel = "nawat-coder:latest"\nmodel_provider = "nawat"\n\n[model_providers.nawat]\nname = "NAWAT Ollama"\nbase_url = "${s.ollama}/v1"\nwire_api = "chat"\n`;
  const cont = JSON.stringify({ models: [{ title: "NAWAT Coder", provider: "ollama", model: "nawat-coder:latest", apiBase: s.ollama }], tabAutocompleteModel: { title: "NAWAT Fast", provider: "ollama", model: "nawat-coder:latest", apiBase: s.ollama } }, null, 2);
  const rules = `# NAWAT rules\n- Add, never remove existing features or fields.\n- Use local models (nawat-coder, nawat-think) only.\n- UI in Arabic (RTL).\n`;
  const agents = `# AGENTS.md\n${rules}- Server project folder: ${dir}\n- Deploy: rsync without --delete.\n`;
  const deploy = `scp -r "${s.path}/${d.project}" ${d.ssh}:/data/projects/`;
  const sync = `rsync -avz "${s.path}/${d.project}/" ${d.ssh}:${dir}/   # بلا --delete: لا يحذف شيئًا`;
  const npm = `ssh ${d.ssh} "cd ${dir} && npm install ${d.pkgs || "<package>"}"`;
  const pip = `ssh ${d.ssh} "cd ${dir} && pip install ${d.pip || "<package>"}"`;

  const files: [string, string, string][] = [
    ["Codex CLI", "~/.codex/config.toml", codex],
    ["Continue / VS Code", "~/.continue/config.json", cont],
    ["Cursor rules", ".cursorrules", rules],
    ["Lovable / OpenCode / Codex", "AGENTS.md", agents],
  ];

  return (
    <>
      <Panel title="الحاسوب ⇄ السيرفر" note="نشر وتثبيت المكتبات">
        <div className="grid gap-2 md:grid-cols-2">
          {([["ssh", "مستخدم@السيرفر"], ["project", "اسم المشروع"], ["pkgs", "مكتبات npm"], ["pip", "مكتبات pip"]] as const).map(([k, l]) => (
            <label key={k} className="grid gap-1 text-xs">{l}
              <input dir="ltr" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className="control font-mono" />
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {PY_PACKS.map((p) => (
            <Button key={p.id} size="sm" variant="outline" onClick={() => setD({ ...d, pip: Array.from(new Set([...d.pip.split(/\s+/).filter(Boolean), ...p.pkgs])).join(" ") })}>🐍 {p.label}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => download("requirements.txt", requirementsTxt(d.pip ? d.pip.split(/\s+/) : PY_ALL))}><Download />requirements.txt</Button>
          {JS_PACKS.map((p) => (
            <Button key={p.id} size="sm" variant="outline" onClick={() => setD({ ...d, pkgs: Array.from(new Set([...d.pkgs.split(/\s+/).filter(Boolean), ...p.pkgs])).join(" ") })}>🎬 {p.label}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => download("package.json", packageJson(d.project, d.pkgs ? d.pkgs.split(/\s+/) : JS_ALL))}><Download />package.json</Button>
          <Button size="sm" variant="outline" onClick={() => download("media.js", FFMPEG_HELPER)}><Download />media.js (FFmpeg)</Button>
        </div>
        <ul className="mt-2 grid gap-1">
          {([["نشر", deploy], ["مزامنة تراكمية", sync], ["تثبيت npm", npm], ["تثبيت pip", pip]] as [string, string][]).map(([t, c]) => (
            <li key={t} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-xs">
              <span className="shrink-0">{t}</span>
              <code dir="ltr" className="truncate">{c}</code>
              <Button size="icon" variant="ghost" aria-label="نسخ" onClick={() => copy(c)}><Copy /></Button>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        {files.map(([t, f, c]) => (
          <Panel key={t} title={t} note={f}>
            <pre dir="ltr" className="max-h-56 overflow-auto rounded bg-muted p-2 text-xs">{c}</pre>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copy(c)}><Copy />نسخ</Button>
              <Button variant="outline" size="sm" onClick={() => download(f, c)}><Download />تنزيل</Button>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
