import { useEffect, useState } from "react";

/**
 * تحكم موحّد بالجداول بالفأرة (RTL-aware):
 * - سحب حافة عنوان العمود لتغيير عرضه (يُحفظ في المتصفح لكل جدول)
 * - نقر عنوان العمود للترتيب تصاعديًا/تنازليًا/إلغاء
 * - نقر سطر لتحديده (يتجاهل النقر داخل خانات وأزرار)
 */
export function useTableMouse(tableId: string) {
  const storeKey = `nawat.table.${tableId}.widths`;
  const [widths, setWidths] = useState<Record<number, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? "{}") as Record<number, number>;
    } catch {
      return {};
    }
  });
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(widths));
    } catch {
      /* تجاهل */
    }
  }, [widths, storeKey]);

  const startResize = (col: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest("th");
    if (!th) return;
    const startW = th.getBoundingClientRect().width;
    const startX = e.clientX;
    const rtl = th.closest("[dir]")?.getAttribute("dir") !== "ltr";
    const move = (ev: PointerEvent) => {
      const d = rtl ? startX - ev.clientX : ev.clientX - startX;
      setWidths((w) => ({ ...w, [col]: Math.max(48, Math.round(startW + d)) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** خصائص عنوان عمود: عرض محفوظ + نقر للترتيب */
  const thProps = (col: number, sortable = true) => ({
    style: widths[col] ? { width: widths[col], minWidth: widths[col] } : undefined,
    onClick: sortable
      ? () =>
          setSort((s) =>
            s?.col === col ? (s.dir === 1 ? { col, dir: -1 as const } : null) : { col, dir: 1 as const },
          )
      : undefined,
    className: `relative select-none${sortable ? " cursor-pointer hover:text-foreground" : ""}`,
  });

  /** مقبض السحب على حافة العمود */
  const resizeHandle = (col: number) => (
    <span
      key="rz"
      onPointerDown={startResize(col)}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-y-0 start-0 w-1.5 cursor-col-resize rounded hover:bg-primary/40"
      title="اسحب لتغيير العرض"
    />
  );

  /** سهم اتجاه الترتيب لعنوان عمود */
  const sortMark = (col: number) =>
    sort?.col === col ? <span className="ms-1 text-[9px] text-primary">{sort.dir === 1 ? "▲" : "▼"}</span> : null;

  /** ترتيب نسخة من الأسطر حسب العمود المختار */
  const sortRows = <R,>(rows: R[], get: (r: R, col: number) => string | number | boolean): R[] => {
    if (!sort) return rows;
    const { col, dir } = sort;
    return [...rows].sort((a, b) => {
      const x = get(a, col);
      const y = get(b, col);
      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : typeof x === "boolean" && typeof y === "boolean"
            ? Number(x) - Number(y)
            : String(x).localeCompare(String(y), "ar");
      return cmp * dir;
    });
  };

  /** خصائص سطر: نقر للتحديد (يتجاهل الخانات والأزرار) + تظليل عند التحويم */
  const trProps = (key: string) => ({
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("input,select,button,textarea,a,[role='switch'],[data-noselect]")) return;
      setSelected((s) => (s === key ? null : key));
    },
    className: `cursor-pointer transition-colors hover:bg-muted/30${selected === key ? " bg-primary/10 hover:bg-primary/15" : ""}`,
  });

  return { thProps, resizeHandle, sortMark, sortRows, trProps, selected };
}
