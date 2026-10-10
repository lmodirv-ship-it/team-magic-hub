import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Boxes,
  ClipboardList,
  Code2,
  Cpu,
  Eye,
  FlaskConical,
  FolderKanban,
  KeyRound,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Network,
  PlugZap,
  Settings,
  Cable,
  Wrench,
  Link2,
  ImageIcon,
  FolderTree,
  GitMerge,
  Zap,
} from "lucide-react";
import { useLang } from "@/lib/nawat/i18n";

const items = [
  { to: "/", icon: LayoutDashboard, label: "نظرة عامة" },
  { to: "/workspace", icon: Code2, label: "مساحة العمل" },
  { to: "/speed-build", icon: Zap, label: "Speed Build" },
  {
    to: "/chat/$threadId",
    params: { threadId: "new" },
    icon: MessageSquareText,
    label: "المحادثات",
  },
  { to: "/atelier", icon: FlaskConical, label: "الورشة متعددة النماذج" },
  { to: "/resultats", icon: FolderKanban, label: "النتائج" },
  { to: "/agents", icon: Bot, label: "الوكلاء" },
  { to: "/tools", icon: Wrench, label: "الأدوات" },
  { to: "/spy", icon: Eye, label: "المراقبة" },
  { to: "/models", icon: Cpu, label: "النماذج" },
  { to: "/providers", icon: PlugZap, label: "المزوّدون" },
  { to: "/api-keys", icon: KeyRound, label: "مفاتيح API والاستهلاك" },
  { to: "/database", icon: Database, label: "قواعد البيانات" },
  { to: "/tasks", icon: Boxes, label: "المهام" },
  { to: "/plan", icon: ClipboardList, label: "خطة الأسبوع" },
  { to: "/architecture", icon: Network, label: "البنية" },
  { to: "/settings", icon: Settings, label: "الإعدادات" },
  { to: "/ports", icon: Cable, label: "المنافذ" },
  { to: "/connect", icon: Link2, label: "الربط السريع" },
  { to: "/projects", icon: FolderTree, label: "المشاريع والمنسّق" },
  { to: "/comfyui", icon: ImageIcon, label: "استوديو ComfyUI" },
  { to: "/sync", icon: GitMerge, label: "المزامنة ودمج الإضافات" },
] as const;

export function ActivityBar() {
  const { t } = useLang();
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav className="flex w-[68px] shrink-0 flex-col items-center border-e border-border bg-rail py-3">
      <Link
        to="/"
        className="mb-4 grid size-11 place-items-center overflow-hidden rounded-md border border-nawat/30 bg-secondary"
        title="NAWAT Studio"
      >
        <img src="/nawat-logo.jpg" alt="شعار نواة الرئيسي" className="size-full object-cover" />
      </Link>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
        {items.map(({ to, icon: Icon, label: raw }) => {
          const label = t(raw);
          const active =
            to === "/"
              ? path === "/"
              : to === "/chat/$threadId"
                ? path.startsWith("/chat")
                : path.startsWith(to);
          const className = `group relative grid size-10 shrink-0 place-items-center rounded-md transition-colors ${active ? "bg-accent text-nawat" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`;
          const content = (
            <>
              <Icon className="size-[18px]" />
              {active && (
                <span className="absolute inset-y-2 start-[-8px] w-0.5 rounded-full bg-nawat" />
              )}
            </>
          );
          return to === "/chat/$threadId" ? (
            <Link
              key={to}
              to="/chat/$threadId"
              params={{ threadId: "new" }}
              title={label}
              aria-label={label}
              className={className}
            >
              {content}
            </Link>
          ) : (
            <Link key={to} to={to} title={label} aria-label={label} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 font-mono text-[8px] tracking-widest text-muted-foreground">STUDIO</div>
    </nav>
  );
}
