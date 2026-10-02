import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** ينبّه عند توفر نسخة جديدة من التطبيق المثبّت مع زر تثبيت. */
export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.self !== window.top || location.hostname.includes("id-preview")) return;
    let reg: ServiceWorkerRegistration | undefined;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const nw = r.installing;
        nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) setWaiting(nw); });
      });
    };
    navigator.serviceWorker.register("/sw.js").then((r) => { reg = r; watch(r); }).catch(() => {});
    const t = setInterval(() => void reg?.update().catch(() => {}), 5 * 60_000);
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
    return () => clearInterval(t);
  }, []);
  if (!waiting) return null;
  return (
    <div className="fixed bottom-14 left-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
      <span>يتوفر تحديث جديد لـ NAWAT</span>
      <Button size="sm" onClick={() => waiting.postMessage("SKIP_WAITING")}><Download />تثبيت التحديث</Button>
      <Button size="sm" variant="ghost" onClick={() => setWaiting(null)}>لاحقًا</Button>
    </div>
  );
}
