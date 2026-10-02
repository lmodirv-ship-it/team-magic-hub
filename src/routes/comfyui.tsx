import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Play, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { useServerSettings, updateServerSettings } from "@/lib/nawat/server-settings";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comfyui")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "استوديو ComfyUI — NAWAT Studio" },
      { name: "description", content: "تنظيم سير عمل ComfyUI وتوليد الصور من داخل نواة." },
      { property: "og:title", content: "استوديو ComfyUI — NAWAT Studio" },
      { property: "og:description", content: "مكتبة سير العمل، توليد الصور، والمعرض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComfyPage,
});

type Flow = { id: string; name: string; json: string };
const FLOWS_KEY = "nawat.comfy.workflows.v1";
const GALLERY_KEY = "nawat.comfy.gallery.v1";

const TXT2IMG = (ckpt = "sd_xl_base_1.0.safetensors") => JSON.stringify({
  "3": { class_type: "KSampler", inputs: { seed: 1, steps: 20, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "{{prompt}}", clip: ["4", 1] } },
  "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, low quality", clip: ["4", 1] } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "nawat", images: ["8", 0] } },
}, null, 2);

const DEFAULT_FLOWS: Flow[] = [
  { id: "txt2img", name: "نص إلى صورة (SDXL)", json: TXT2IMG() },
  { id: "logo", name: "شعار بسيط", json: TXT2IMG().replace('"width": 1024', '"width": 768').replace('"height": 1024', '"height": 768') },
];

function ComfyPage() {
  const s = useServerSettings();
  const base = s.comfyUrl.replace(/\/$/, "");
  const [online, setOnline] = useState<boolean | null>(null);
  const [flows, setFlows] = useState<Flow[]>(DEFAULT_FLOWS);
  const [sel, setSel] = useState("txt2img");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<{ src: string; prompt: string; at: string }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem(FLOWS_KEY) ?? "null"); if (Array.isArray(f) && f.length) setFlows(f); } catch { /* */ }
    try { setGallery(JSON.parse(localStorage.getItem(GALLERY_KEY) ?? "[]")); } catch { /* */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(FLOWS_KEY, JSON.stringify(flows)); }, [ready, flows]);
  useEffect(() => { if (ready) localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery.slice(0, 30))); }, [ready, gallery]);

  const check = useCallback(async () => {
    try { const r = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(5000) }); setOnline(r.ok); } catch { setOnline(false); }
  }, [base]);
  useEffect(() => { void check(); }, [check]);

  const flow = flows.find((f) => f.id === sel) ?? flows[0]!;
  const addImage = (src: string) => setGallery((g) => [{ src, prompt, at: new Date().toISOString() }, ...g]);

  const run = async () => {
    if (!prompt.trim()) return toast.error("اكتب وصف الصورة");
    setBusy(true);
    try {
      if (online) {
        const graph = JSON.parse(flow.json.split("{{prompt}}").join(prompt.replace(/"/g, '\\"')));
        const r = await fetch(`${base}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph }) });
        const { prompt_id } = await r.json();
        for (let i = 0; i < 90; i++) {
          await new Promise((ok) => setTimeout(ok, 2000));
          const h = await (await fetch(`${base}/history/${prompt_id}`)).json();
          const outs = h[prompt_id]?.outputs;
          if (outs) {
            for (const o of Object.values(outs) as { images?: { filename: string; subfolder: string; type: string }[] }[])
              for (const im of o.images ?? []) addImage(`${base}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder)}&type=${im.type}`);
            break;
          }
        }
      } else {
        const d = (await callConfiguredBridge("image", { prompt })) as { image?: string };
        if (!d.image) throw new Error("لا صورة");
        addImage(d.image.startsWith("data:") || d.image.startsWith("http") ? d.image : `data:image/png;base64,${d.image}`);
      }
      toast.success("اكتملت الصورة");
    } catch (e) { toast.error(`تعذّر التوليد: ${(e as Error).message}`); }
    setBusy(false);
  };

  return (
    <Page eyebrow="ComfyUI / Workflows" title="استوديو الصور" description="نظّم سير العمل، ولّد الصور مباشرة أو عبر الجسر، واحفظها في المعرض."
      actions={<span className={cn("rounded-full px-3 py-1 text-xs font-semibold", online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{online === null ? "…" : online ? "ComfyUI متصل" : "مباشر غير متاح — عبر الجسر"}</span>}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel title="سير العمل" note={`${flows.length}`}>
          <div className="grid gap-1">
            {flows.map((f) => (
              <button key={f.id} onClick={() => setSel(f.id)} className={cn("rounded-md px-2 py-1.5 text-start text-sm", f.id === sel ? "bg-primary/15 text-primary" : "hover:bg-muted")}>{f.name}</button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => { const id = `f-${Date.now()}`; setFlows([...flows, { id, name: "سير عمل جديد", json: TXT2IMG() }]); setSel(id); }}><Plus />جديد</Button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-xs"><Upload className="size-3" />استيراد
              <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const id = `f-${Date.now()}`; setFlows([...flows, { id, name: file.name.replace(/\.json$/, ""), json: await file.text() }]); setSel(id);
              }} />
            </label>
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">عنوان ComfyUI</label>
          <input className="control font-mono text-xs" dir="ltr" value={s.comfyUrl} onChange={(e) => updateServerSettings({ comfyUrl: e.target.value })} />
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => void check()}><RefreshCw />إعادة الفحص</Button>
        </Panel>
        <div className="grid gap-4">
          <Panel title="توليد">
            <textarea rows={3} className="control" placeholder="صف الصورة…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <Button className="mt-2" disabled={busy} onClick={() => void run()}><Play />{busy ? "جارٍ التوليد…" : "ولّد الصورة"}</Button>
          </Panel>
          <Panel title="تحرير سير العمل" note="{{prompt}} يُستبدل بالوصف">
            <div className="mb-2 flex gap-2">
              <input className="control" value={flow.name} onChange={(e) => setFlows(flows.map((f) => (f.id === flow.id ? { ...f, name: e.target.value } : f)))} />
              {flows.length > 1 && <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => { setFlows(flows.filter((f) => f.id !== flow.id)); setSel(flows[0]!.id); }}><Trash2 /></Button>}
            </div>
            <textarea dir="ltr" rows={10} className="control font-mono text-xs" value={flow.json} onChange={(e) => setFlows(flows.map((f) => (f.id === flow.id ? { ...f, json: e.target.value } : f)))} />
          </Panel>
          <Panel title="المعرض" note={`${gallery.length}`}>
            {gallery.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><ImageIcon className="size-4" />لا صور بعد</p> : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {gallery.map((g) => (
                  <a key={g.at} href={g.src} target="_blank" rel="noopener" download className="group overflow-hidden rounded-lg border border-border">
                    <img src={g.src} alt={g.prompt} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
