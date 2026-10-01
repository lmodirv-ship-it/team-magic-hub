import { createFileRoute } from "@tanstack/react-router";
import { WeeklyPlanView } from "@/components/nawat/WeeklyPlanView";
import { PageHead } from "@/components/nawat/StudioViews";

export const Route = createFileRoute("/plan")({
  head: PageHead(
    "إضافات هذا الأسبوع",
    "خطة نماذج ووكلاء وخدمات NAWAT Studio الجديدة مع حالات الجاهزية والتفعيل.",
  ),
  component: WeeklyPlanView,
});
