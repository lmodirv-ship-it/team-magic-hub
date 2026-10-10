import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/nawat/workspace";

const LAST_ROUTE_KEY = "nawat.last-route.v1";

/** Global keyboard shortcuts + last visited route persistence. */
export function ShortcutLayer() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { active, createFile, saveNow } = useWorkspace();

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_ROUTE_KEY, pathname);
    } catch {
      // Ignore storage failures.
    }
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const focused = document.activeElement;
      const inTerminal = focused instanceof Element && Boolean(focused.closest('[data-nawat-terminal]'));
      const key = event.key.toLowerCase();
      // Layout switches stay live even while the terminal has focus.
      const layoutSwitch =
        (mod && !event.altKey && !event.shiftKey && (key === "b" || key === "j" || key === "`")) ||
        (mod && event.altKey && key === "f");
      if (inTerminal && !(mod && key === "s") && !layoutSwitch) return;
      if (mod && !event.altKey && !event.shiftKey && key === "b") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("nawat:toggle-panel", { detail: "explorer" }));
        return;
      }
      if (mod && !event.altKey && !event.shiftKey && key === "j") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("nawat:toggle-panel", { detail: "chat" }));
        return;
      }
      if (mod && !event.altKey && !event.shiftKey && key === "`") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("nawat:toggle-panel", { detail: "term" }));
        return;
      }
      if (mod && event.altKey && key === "f") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("nawat:focus-mode"));
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        if (active) {
          if (saveNow()) toast.success(`تم الحفظ: ${active}`);
          else toast.error("تعذّر الحفظ؛ انسخ تعديلاتك قبل الإغلاق");
        } else {
          toast("لا يوجد ملف مفتوح للحفظ");
        }
        return;
      }
      if (mod && event.shiftKey && key === "f") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("nawat:project-search"));
        return;
      }
      if (mod && key === "n") {
        event.preventDefault();
        const path = window.prompt("مسار الملف الجديد", "my-app/nouveau.md");
        if (path?.trim()) createFile(path.trim(), "", { source: "manuel" });
        return;
      }
      if (event.key === "Escape") {
        window.dispatchEvent(new CustomEvent("nawat:escape"));
      }
    };
    window.addEventListener("keydown", onKey);
    const newFile = () => {
      const path = window.prompt("مسار الملف الجديد", "my-app/nouveau.md");
      if (path?.trim()) createFile(path.trim(), "", { source: "manuel" });
    };
    window.addEventListener("nawat:new-file", newFile);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("nawat:new-file", newFile); };
  }, [active, createFile, saveNow]);

  return null;
}

export function lastVisitedRoute(): string | null {
  try {
    return window.localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}
