import { createFileRoute } from "@tanstack/react-router";
import { ArchitectureView, PageHead } from "@/components/nawat/StudioViews";
export const Route = createFileRoute("/architecture")({
  head: PageHead("بنية النظام", "مخطط مرئي لبنية NAWAT Studio المحلية متعددة الوكلاء."),
  component: ArchitectureView,
});
