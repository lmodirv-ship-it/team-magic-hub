import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { CAPS, CLI, COMPARE, CORE, ENV, EX, GHN, MCP, OTHER, type L } from "@/lib/nawat/groupe-hn-docs";

export const Route = createFileRoute("/groupe-hn")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "دليل Groupe-HN CLI + MCP — NAWAT Studio" },
      { name: "description", content: "الدليل الكامل لأوامر nawat وgroupe-hn وأدوات MCP التسع والعشرين وجداول قدرات نماذج نواة." },
      { property: "og:title", content: "دليل Groupe-HN CLI + MCP" },
      { property: "og:description", content: "أوامر، أدوات MCP، قدرات النماذج، وأي نموذج لأي مهمة — بالعربية والفرنسية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

const LKEY = "nawat.ghn.docs.lang";

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>{head.map((h) => <th key={h} className="border border-border bg-muted p-2 text-start text-primary">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="border border-border p-2 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-primary">{children}</code>;

function GuidePage() {
  const [lang, setLang] = useState<"ar" | "fr">("ar");
  const [task, setTask] = useState(0);
  useEffect(() => { const v = localStorage.getItem(LKEY); if (v === "fr" || v === "ar") setLang(v); }, []);
  const pick = (l: "ar" | "fr") => { setLang(l); localStorage.setItem(LKEY, l); };
  const t = (o: L) => o[lang] ?? o.ar;
  const ar = lang === "ar";
  const best = COMPARE[task] ?? COMPARE[0]!;

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <Page eyebrow="Groupe-HN v1.1.0" title={ar ? "دليل CLI + MCP" : "Guide CLI + MCP"} description={ar ? "التحكم الكامل بالمنصة من سطر الأوامر ومساعدي الذكاء الاصطناعي — نماذج نواة." : "Contrôle total de la plateforme depuis le terminal et les assistants IA."}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={ar ? "default" : "outline"} onClick={() => pick("ar")}>العربية</Button>
            <Button size="sm" variant={!ar ? "default" : "outline"} onClick={() => pick("fr")}>Français</Button>
            <Button size="sm" variant="outline" asChild><a href="/groupe-hn-cli.html" download><Download />{ar ? "تنزيل الدليل HTML" : "Télécharger HTML"}</a></Button>
            <Button size="sm" variant="ghost" asChild><Link to="/mcp">MCP + CLI</Link></Button>
          </div>

          <Panel title={ar ? "أي نموذج لأي مهمة؟" : "Quel modèle pour quelle tâche ?"} note={ar ? "اختر المهمة" : "Choisissez"}>
            <div className="flex flex-wrap gap-2">
              {COMPARE.map((c, i) => <Button key={i} size="sm" variant={i === task ? "default" : "outline"} onClick={() => setTask(i)}>{t(c[0])}</Button>)}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm">
              <div className="rounded border border-border p-3"><div className="text-xs text-muted-foreground">{ar ? "الترشيح الأول" : "1er choix"}</div><C>{best[1]}</C></div>
              <div className="rounded border border-border p-3"><div className="text-xs text-muted-foreground">{ar ? "البديل الأخف" : "Alternative légère"}</div><C>{best[2]}</C></div>
              <div className="rounded border border-border p-3"><div className="text-xs text-muted-foreground">{ar ? "ملاحظة" : "Note"}</div>{best[3] ?? "—"}</div>
            </div>
          </Panel>

          <Panel title={ar ? "1) التثبيت والمتغيرات" : "1) Installation et variables"}>
            <pre dir="ltr" className="mb-2 rounded bg-muted p-2 text-xs">{"cd C:\\nawat\nnpm link        # nawat + groupe-hn + nawat-mcp\nnawat status\ngroupe-hn doctor"}</pre>
            <Table head={ar ? ["متغير", "الافتراضي", "الوصف"] : ["Variable", "Défaut", "Description"]} rows={ENV.map((e) => [<C key="k">{e[0]}</C>, <C key="v">{e[1] || "—"}</C>, t(e[2])])} />
          </Panel>

          <Panel title={ar ? "2) أوامر nawat" : "2) Commandes nawat"} note={`${CLI.length}`}>
            <Table head={ar ? ["الأمر", "المهمة", "مثال"] : ["Commande", "Rôle", "Exemple"]} rows={CLI.map((c) => [<C key="c">{c[0]}</C>, t(c[1]), <C key="e">{c[2]}</C>])} />
          </Panel>

          <Panel title={ar ? "3) أوامر groupe-hn" : "3) Commandes groupe-hn"} note={`${GHN.length}`}>
            <Table head={ar ? ["الأمر", "المهمة", "مثال"] : ["Commande", "Rôle", "Exemple"]} rows={GHN.map((c) => [<C key="c">{c[0]}</C>, t(c[1]), <C key="e">{c[2]}</C>])} />
          </Panel>

          <Panel title={ar ? "4) أدوات MCP — 29 أداة" : "4) Outils MCP — 29 outils"}>
            <Table head={ar ? ["الأداة", "الشرح", "المدخلات"] : ["Outil", "Description", "Entrées"]} rows={MCP.map((m) => [<C key="n">{m[0]}</C>, t(m[1]), <C key="i">{m[2]}</C>])} />
          </Panel>

          <Panel title={ar ? "5) نماذج نواة" : "5) Modèles noyau"} note={`${CORE.length}`}>
            <Table head={ar ? ["النموذج", "الحجم", "الدور"] : ["Modèle", "Taille", "Rôle"]} rows={CORE.map((m) => [<C key="n">{m[0]}</C>, m[1], t(m[2])])} />
          </Panel>

          <Panel title={ar ? "نماذج أخرى (قواعد خارجية)" : "Autres modèles"} note={`${OTHER.length}`}>
            <Table head={ar ? ["النموذج", "الحجم", "الدور"] : ["Modèle", "Taille", "Rôle"]} rows={OTHER.map((m) => [<C key="n">{m[0]}</C>, m[1], t(m[2])])} />
          </Panel>

          <Panel title={ar ? "جدول القدرات (★ ممتاز · ✓ جيد · — غير مخصص)" : "Capacités (★ · ✓ · —)"}>
            <Table
              head={ar ? ["الفئة", "", "محادثة", "برمجة", "تفكير", "رؤية", "صوت/تضمين", "السرعة"] : ["Catégorie", "", "Chat", "Code", "Raison.", "Vision", "Voix/Embed", "Vitesse"]}
              rows={CAPS.map((c) => [<C key="n">{`nawat-${c[0]}`}</C>, t(c[1]), c[2], c[3], c[4], c[5], c[6], c[7]])}
            />
          </Panel>

          <Panel title={ar ? "6) سيناريوهات الاستعمال" : "6) Scénarios"}>
            <div className="grid gap-3 md:grid-cols-2">
              {EX.map((e, i) => (
                <div key={i} className="rounded border border-border p-3">
                  <div className="mb-1 text-sm font-semibold">{t(e[0])}</div>
                  <pre dir="ltr" className="rounded bg-muted p-2 text-xs">{e[1]}</pre>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Page>
    </div>
  );
}
