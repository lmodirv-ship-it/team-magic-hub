import { useState } from "react";
import { Brain, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { chatStream } from "@/lib/nawat/bridge";
import { useWorkspace } from "@/lib/nawat/workspace";

const MODEL = "nawat-coder:latest";
const MAX_CHARS = 24000;

/** يرسل تقرير التحليل + plan.md + شجرة الملفات إلى nawat-coder ويكتب خطة عمل في logs/. */
export function AnalyzeProjectButton() {
  const { vfs, writeFile, openFile, active } = useWorkspace();
  const [ctrl, setCtrl] = useState<AbortController | null>(null);

  async function run() {
    const paths = Object.keys(vfs).filter((p) => p.startsWith("my-app/"));
    const project = (active?.startsWith("my-app/") ? active : paths[0])?.split("/")[1];
    if (!project) {
      toast.error("لا يوجد مشروع في my-app/ — استورد مشروعًا أولًا");
      return;
    }
    const files = paths.filter((p) => p.startsWith(`my-app/${project}/`));
    const report = vfs[`logs/analyse-${project}.md`] ?? "";
    const planPath = files.find((p) => /(^|\/)plan\.md$/i.test(p));
    const plan = planPath ? vfs[planPath]! : "";
    const tree = files.map((p) => p.slice(`my-app/${project}/`.length)).join("\n");
    const prompt = `حلّل المشروع "${project}" واقترح خطة عمل مرتبة بالأولوية (مهام مرقمة، الملفات المعنية، المخاطر).\n\n## تقرير التحليل\n${report}\n\n## plan.md\n${plan || "(غير موجود)"}\n\n## شجرة الملفات\n${tree}`.slice(0, MAX_CHARS);

    const out = `logs/plan-${project}.md`;
    const ac = new AbortController();
    setCtrl(ac);
    let acc = `# خطة عمل: ${project}\n\n> مولدة بـ ${MODEL} — ${new Date().toLocaleString("ar")}\n\n`;
    writeFile(out, acc, { source: "agent" });
    openFile(out);
    try {
      for await (const chunk of chatStream(MODEL, [{ role: "user", content: prompt }], ac.signal)) {
        acc += chunk;
        writeFile(out, acc, { source: "agent" });
      }
      toast.success(`خطة العمل جاهزة: ${out}`);
    } catch (e) {
      if (!ac.signal.aborted) toast.error((e as Error).message);
    } finally {
      setCtrl(null);
    }
  }

  return ctrl ? (
    <button
      onClick={() => ctrl.abort()}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-destructive hover:bg-accent"
    >
      <Loader2 className="size-3.5 animate-spin" /> إيقاف <Square className="size-3" />
    </button>
  ) : (
    <button
      onClick={() => void run()}
      title={`يرسل التقرير وplan.md إلى ${MODEL}`}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Brain className="size-3.5" /> حلّل المشروع بالنموذج
    </button>
  );
}
