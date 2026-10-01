import { useRef } from "react";

type ResizerProps = {
  axis: "x" | "y";
  /** Which adjacent flex sibling to resize: the one before or after the handle. */
  target: "before" | "after";
  onResize: (size: number) => void;
  label: string;
  min?: number;
  max?: number;
};

/**
 * Draggable splitter handle between flex panels.
 * For axis "x" it sets the panel width; for axis "y" it sets the panel height.
 * Works in both LTR and RTL by resolving the panel's physical anchor side.
 */
export function Resizer({ axis, target, onResize, label, min = 160, max = 720 }: ResizerProps) {
  const dragging = useRef(false);
  const panel = useRef<HTMLElement | null>(null);

  const findPanel = (handle: HTMLElement) =>
    (target === "before"
      ? handle.previousElementSibling
      : handle.nextElementSibling) as HTMLElement | null;

  const sizeFromPointer = (x: number, y: number) => {
    const el = panel.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (axis === "y") return target === "after" ? r.bottom - y : y - r.top;
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    // A "before" panel sits at the inline start (right in RTL, left in LTR).
    const rightAnchored = target === "before" ? rtl : !rtl;
    return rightAnchored ? r.right - x : x - r.left;
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        panel.current = findPanel(e.currentTarget);
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.classList.add("select-none");
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const size = sizeFromPointer(e.clientX, e.clientY);
        if (size !== null) onResize(Math.min(max, Math.max(min, Math.round(size))));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        document.body.classList.remove("select-none");
      }}
      onPointerCancel={() => {
        dragging.current = false;
        document.body.classList.remove("select-none");
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 16;
        if (axis === "x" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          const rtl = getComputedStyle(document.documentElement).direction === "rtl";
          const growsLeft = (target === "before") === rtl;
          const delta = (e.key === "ArrowLeft") === growsLeft ? step : -step;
          e.preventDefault();
          const el = panel.current ?? findPanel(e.currentTarget);
          if (el) onResize(Math.min(max, Math.max(min, el.getBoundingClientRect().width + delta)));
        }
        if (axis === "y" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const el = panel.current ?? findPanel(e.currentTarget);
          if (el) {
            const cur = el.getBoundingClientRect().height;
            onResize(Math.min(max, Math.max(min, cur + (e.key === "ArrowDown" ? step : -step))));
          }
        }
      }}
      className={`group relative z-10 shrink-0 touch-none outline-none ${
        axis === "x"
          ? "w-1 cursor-col-resize after:absolute after:inset-y-0 after:-inset-x-1"
          : "h-1 cursor-row-resize after:absolute after:inset-x-0 after:-inset-y-1"
      } after:content-[''] hover:bg-nawat/30 focus-visible:bg-nawat/50`}
      title={label}
    />
  );
}
