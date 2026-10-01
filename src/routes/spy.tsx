import { createFileRoute } from "@tanstack/react-router";
import { PageHead, SpyView } from "@/components/nawat/StudioViews";
export const Route = createFileRoute("/spy")({
  head: PageHead("المراقبة", "مراقبة مباشرة لأحداث وموارد ومواقع NAWAT Studio."),
  component: SpyView,
});
