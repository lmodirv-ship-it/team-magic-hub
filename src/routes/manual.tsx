import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { BookOpen, ChevronLeft, ChevronRight, Download, List, LoaderCircle, Minus, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/nawat/i18n";
import contents from "@/lib/nawat/manual-contents.json";
import { MANUAL_PAGES, manualPage } from "@/lib/nawat/manual";
import frPdf from "@/assets/manual-fr-v2.pdf.asset.json";
import arPdf from "@/assets/manual-ar-v2.pdf.asset.json";
import "@/components/nawat/manual.css";

export const Route = createFileRoute("/manual")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Guide illustré AR / FR — NAWAT Code · Groupe-HN" },
    { name: "description", content: "Guide illustré de 120 pages : NAWAT Code, CLI, modèles et vingt pages sur les sites et programmes Groupe-HN, en français et arabe." },
    { property: "og:title", content: "Guide illustré bilingue — NAWAT Code" },
    { property: "og:description", content: "120 pages illustrées, sommaire et lecture en français ou arabe : NAWAT et Groupe-HN." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ManualReader,
});

function ManualReader() {
  const { lang: appLang } = useLang();
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showContents, setShowContents] = useState(false);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(800);
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const ar = lang === "ar";
  const t = (fr: string, arabic: string) => ar ? arabic : fr;
  const url = ar ? arPdf.url : frPdf.url;
  useEffect(() => { setLang(appLang === "ar" ? "ar" : "fr"); }, [appLang]);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    setLoading(true); setError(false); setDocument(undefined);
    Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([pdf, worker]) => {
      if (disposed) return;
      pdf.GlobalWorkerOptions.workerSrc = worker.default;
      task = pdf.getDocument({ url });
      return task.promise.then((doc) => { if (!disposed) setDocument(doc); });
    }).catch((cause: unknown) => { if (!disposed) { console.error("Manual PDF loading failed", cause); setError(true); setLoading(false); } });
    return () => { disposed = true; void task?.destroy(); };
  }, [url, retry]);
  useEffect(() => {
    if (!document) return;
    let disposed = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    setLoading(true);
    document.getPage(page).then(async (pdfPage) => {
      const target = canvas.current;
      if (disposed || !target) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.max(200, Math.min(width - 32, 900)) / base.width * zoom / 100;
      const viewport = pdfPage.getViewport({ scale });
      target.width = viewport.width * window.devicePixelRatio;
      target.height = viewport.height * window.devicePixelRatio;
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const context = target.getContext("2d");
      if (!context) return;
      render = pdfPage.render({ canvas: target, canvasContext: context, viewport, transform: [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0] });
      await render.promise;
      if (!disposed) setLoading(false);
    }).catch((cause: unknown) => { if (!disposed) { console.error("Manual PDF rendering failed", cause); setLoading(false); setError(true); } });
    return () => { disposed = true; render?.cancel(); };
  }, [document, page, zoom, width]);

  return <section data-no-translate dir={ar ? "rtl" : "ltr"} className="manual-reader flex min-w-0 flex-1 flex-col bg-background text-foreground">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <BookOpen className="size-5 text-primary" />
      <h1 className="me-auto text-sm font-semibold">{t("Guide NAWAT Code", "دليل NAWAT Code")}</h1>
      <div role="group" aria-label={t("Langue du guide", "لغة الدليل")} className="flex gap-1">
        {(["fr", "ar"] as const).map((l) => <Button key={l} size="sm" variant={lang === l ? "default" : "outline"} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</Button>)}
      </div>
      <Button size="sm" variant="outline" asChild><a href={url} download target="_blank" rel="noreferrer"><Download className="size-4" />PDF</a></Button>
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border bg-muted px-2 py-2">
      <Button size="icon" variant="ghost" title={t("Sommaire", "الفهرس")} aria-label={t("Sommaire", "الفهرس")} aria-expanded={showContents} onClick={() => setShowContents(!showContents)}><List /></Button>
      <Button size="icon" variant="outline" disabled={page === 1} title={t("Page précédente", "الصفحة السابقة")} aria-label={t("Page précédente", "الصفحة السابقة")} onClick={() => setPage(manualPage(page - 1))}><ChevronLeft /></Button>
      <Input type="number" min={1} max={MANUAL_PAGES} value={page} aria-label={t("Numéro de page", "رقم الصفحة")} onChange={(e) => setPage(manualPage(Number(e.target.value)))} className="h-9 w-20 text-center" />
      <span className="text-xs">/ {MANUAL_PAGES}</span>
      <Button size="icon" variant="outline" disabled={page === MANUAL_PAGES} title={t("Page suivante", "الصفحة التالية")} aria-label={t("Page suivante", "الصفحة التالية")} onClick={() => setPage(manualPage(page + 1))}><ChevronRight /></Button>
      <Button size="icon" variant="ghost" disabled={zoom <= 50} title={t("Réduire", "تصغير")} aria-label={t("Réduire", "تصغير")} onClick={() => setZoom(zoom - 25)}><Minus /></Button>
      <span className="w-10 text-center text-xs">{zoom}%</span>
      <Button size="icon" variant="ghost" disabled={zoom >= 200} title={t("Agrandir", "تكبير")} aria-label={t("Agrandir", "تكبير")} onClick={() => setZoom(zoom + 25)}><Plus /></Button>
    </div>
    <div className="relative flex min-h-0 flex-1">
      {showContents && <nav aria-label={t("Sommaire du guide", "فهرس الدليل")} className="absolute inset-y-0 start-0 z-10 w-72 max-w-full overflow-y-auto border-e border-border bg-background p-2 md:static md:shrink-0">
        <Button variant="ghost" className="w-full justify-start" onClick={() => { setPage(1); setShowContents(false); }}>{t("Couverture", "الغلاف")} · 1</Button>
        {[2, 3, 4].map((n) => <Button key={n} variant="ghost" className="w-full justify-start" onClick={() => { setPage(n); setShowContents(false); }}>{t("Sommaire", "الفهرس")} {n - 1} · {n}</Button>)}
        {contents[lang].map((entry) => <Button key={entry.page} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-start text-xs" onClick={() => { setPage(entry.page); setShowContents(false); }}><span className="me-2 text-primary">{entry.page}</span>{entry.title}</Button>)}
      </nav>}
      <div ref={area} className="min-w-0 flex-1 overflow-auto p-4">
        {loading && !error && <div role="status" className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{t("Chargement…", "جار التحميل…")}</div>}
        {error ? <div className="flex flex-col items-center gap-3 py-12"><p>{t("Le guide n’a pas pu être chargé.", "تعذر تحميل الدليل.")}</p><Button variant="outline" onClick={() => { setError(false); setRetry(retry + 1); }}><RotateCw />{t("Réessayer", "إعادة المحاولة")}</Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer">{t("Ouvrir le PDF", "فتح PDF")}</a></Button></div> : <canvas ref={canvas} aria-label={t(`Guide français, page ${page}`, `الدليل العربي، صفحة ${page}`)} className="mx-auto block h-auto max-w-none w-full" />}
      </div>
    </div>
  </section>;
}