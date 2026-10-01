import { createFileRoute } from "@tanstack/react-router";
import { AgentsView, PageHead } from "@/components/nawat/StudioViews";
export const Route = createFileRoute("/agents")({
  head: PageHead("الوكلاء", "إدارة ومراقبة وكلاء R1 وTermine في NAWAT Studio."),
  component: AgentsView,
});
