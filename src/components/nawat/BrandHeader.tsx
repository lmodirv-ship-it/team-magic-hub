import { Link } from "@tanstack/react-router";
import { BookOpen, CircleDot, Search, ShieldCheck } from "lucide-react";
import { ChatStatsWidget } from "@/components/nawat/ChatStatsWidget";
import { NotificationCenter } from "@/components/nawat/NotificationCenter";
import { ThemeToggle } from "@/components/nawat/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/nawat/LanguageSwitcher";
import { useLang } from "@/lib/nawat/i18n";

export function BrandHeader() {
  const { t } = useLang();
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-rail px-3 shadow-sm">
      <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="NAWAT Studio">
        <img
          src="/nawat-logo.jpg"
          alt="شعار نواة"
          className="size-8 shrink-0 rounded-md border border-nawat/40 object-cover"
        />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <strong className="truncate text-sm font-semibold text-foreground">NAWAT Studio</strong>
            <span className="hidden items-center gap-1 text-[10px] text-success sm:flex">
              <CircleDot className="size-2.5 signal-pulse" /> {t("متصل ويعمل")}
            </span>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            Groupe-HN · AI Command Center
          </p>
        </div>
      </Link>
      <div className="flex-1" />
      <Button variant="outline" size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent("nawat:open-search"))}
        className="me-1 hidden items-center gap-2 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground sm:flex"
        aria-label={t("بحث شامل")}
      >
        <Search className="size-3.5" />
        <span>{t("بحث…")}</span>
        <kbd className="rounded border border-border px-1 text-[9px]">Ctrl P</kbd>
      </Button>
      <div className="hidden md:block">
        <ChatStatsWidget variant="header" />
      </div>
      <Button asChild variant="ghost" size="icon" title={t("الدليل المصور")} aria-label={t("الدليل المصور")}>
        <Link to="/manual"><BookOpen className="size-4" /></Link>
      </Button>
      <LanguageSwitcher />
      <NotificationCenter />
      <ThemeToggle />
      <div
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
        title="Groupe-HN"
      >
        <ShieldCheck className="size-3.5 text-nawat" />
        <span className="hidden sm:inline">{t("منظومة محلية آمنة")}</span>
      </div>
    </header>
  );
}
