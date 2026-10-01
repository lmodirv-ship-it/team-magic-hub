import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/nawat/StudioViews";
import { MissionControlView } from "@/components/nawat/MissionControl";

export const Route = createFileRoute("/")({
  head: PageHead(
    "مركز القيادة",
    "مركز قيادة NAWAT Studio: ثلاث عقد، خمسة نماذج محلية، وكلاء ومراقبة حية.",
  ),
  component: MissionControlView,
});
