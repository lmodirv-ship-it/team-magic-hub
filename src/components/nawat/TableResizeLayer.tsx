import { useEffect } from "react";

/**
 * تكبير وتصغير أعمدة كل الجداول في كل الصفحات بالفأرة.
 * يضيف مقبض سحب لكل عنوان عمود لا يملك مقبضًا، ويحفظ العرض لكل صفحة.
 */
export function TableResizeLayer() {
  useEffect(() => {
    const key = () => `nawat.table.auto.${location.pathname}`;
    const load = (): Record<string, number> => {
      try { return JSON.parse(localStorage.getItem(key()) ?? "{}"); } catch { return {}; }
    };
    const attach = () => {
      const saved = load();
      document.querySelectorAll("table").forEach((table, ti) => {
        table.querySelectorAll("thead th").forEach((node, ci) => {
          const th = node as HTMLElement;
          if (th.dataset.rz || th.querySelector(".cursor-col-resize")) return;
          th.dataset.rz = "1";
          const id = `${ti}:${ci}`;
          if (saved[id]) { th.style.width = `${saved[id]}px`; th.style.minWidth = `${saved[id]}px`; }
          if (getComputedStyle(th).position === "static") th.style.position = "relative";
          const h = document.createElement("span");
          h.className = "absolute inset-y-0 start-0 w-1.5 cursor-col-resize rounded hover:bg-primary/40";
          h.title = "اسحب لتغيير العرض";
          h.addEventListener("click", (e) => e.stopPropagation());
          h.addEventListener("pointerdown", (e) => {
            e.preventDefault(); e.stopPropagation();
            const startW = th.getBoundingClientRect().width;
            const startX = e.clientX;
            const rtl = th.closest("[dir]")?.getAttribute("dir") !== "ltr";
            const move = (ev: PointerEvent) => {
              const w = Math.max(48, Math.round(startW + (rtl ? startX - ev.clientX : ev.clientX - startX)));
              th.style.width = `${w}px`; th.style.minWidth = `${w}px`;
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              const all = load(); all[id] = Math.round(th.getBoundingClientRect().width);
              try { localStorage.setItem(key(), JSON.stringify(all)); } catch { /* full */ }
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          });
          th.appendChild(h);
        });
      });
    };
    attach();
    let t: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(attach, 150); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);
  return null;
}
