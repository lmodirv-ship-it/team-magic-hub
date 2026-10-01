import { createFileRoute } from "@tanstack/react-router";
import { PageHead, ToolsView } from "@/components/nawat/StudioViews";
import { SshPanel } from "@/components/nawat/SshPanel";
import { ServicesHealth } from "@/components/nawat/ServicesHealth";

export const Route = createFileRoute("/tools")({
  head: PageHead("الأدوات", "إدارة SSH وSFTP والمحرر والطرفية وأدوات NAWAT المحلية."),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 px-4 pt-4">
        <ServicesHealth />
        <SshPanel />
      </div>
      <ToolsView />
    </div>
  );
}
