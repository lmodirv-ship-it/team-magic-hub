import { createFileRoute } from "@tanstack/react-router";
import { PackDashboard } from "@/components/nawat/PackDashboard";

export const Route = createFileRoute("/packs")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "لوحة مراقبة Packs — NAWAT Studio" },
      { name: "description", content: "مراقبة صحة كل Pack في NAWAT Pack System: حالة، قياسات، وإعادة تشغيل عبر الجسر." },
      { property: "og:title", content: "لوحة مراقبة Packs — NAWAT Studio" },
      { property: "og:description", content: "بطاقة لكل Pack مع مؤشر حالة وقياسات وإعادة تشغيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PackDashboard,
});
