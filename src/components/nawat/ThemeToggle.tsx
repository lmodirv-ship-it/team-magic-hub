import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/nawat/theme";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل ستايل نواة الرسمي"}
      title={isDark ? "الوضع الفاتح" : "ستايل نواة الرسمي"}
      className="text-muted-foreground"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
