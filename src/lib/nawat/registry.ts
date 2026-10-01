import { useCallback, useEffect, useState } from "react";

export type RegistryCategory = "تفعيل" | "إضافات" | "أدوات" | "علاقات";

export const REGISTRY_CATEGORIES: RegistryCategory[] = ["تفعيل", "إضافات", "أدوات", "علاقات"];

export type RegistryEntry = {
  id: string;
  name: string;
  role: string;
  task: string;
  category: RegistryCategory;
  enabled: boolean;
  note?: string;
  updatedAt: string;
};

const KEY = "nawat.registry.v1";

/** معرّف على شكل حرف + ستة أرقام مثل A111111 */
export function makeId(existing: RegistryEntry[]): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const used = new Set(existing.map((e) => e.id));
  for (let i = 0; i < 100000; i++) {
    const letter = letters[Math.floor(Math.random() * letters.length)] ?? "A";
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const id = `${letter}${digits}`;
    if (!used.has(id)) return id;
  }
  return `Z${Date.now().toString().slice(-6)}`;
}

export function isValidId(id: string): boolean {
  return /^[A-Z][0-9]{6}$/.test(id);
}

const now = () => new Date().toISOString();

function entry(
  id: string,
  name: string,
  role: string,
  task: string,
  category: RegistryCategory,
  enabled = true,
): RegistryEntry {
  return { id, name, role, task, category, enabled, updatedAt: now() };
}

export const DEFAULT_REGISTRY: RegistryEntry[] = [
  entry("A111111", "نواة NAWAT", "المحرك الأساسي", "تشغيل الاستوديو وإدارة الجلسات", "تفعيل"),
  entry("A111112", "محرك Ollama", "مزوّد نماذج محلي", "تشغيل النماذج على الجهاز", "تفعيل"),
  entry("A111113", "مزوّد Groupe-HN", "مزوّد سحابي", "الوصول إلى النماذج الرسمية", "تفعيل", false),
  entry("B222111", "الأتيليه متعدد النماذج", "إضافة", "تشغيل نفس الطلب على عدة نماذج", "إضافات"),
  entry("B222112", "المعاينة الذكية", "إضافة", "عرض HTML و Markdown و JSON والوسائط", "إضافات"),
  entry("B222113", "ويدجت الإحصائيات", "إضافة", "عدّادات حية في الشريط العلوي", "إضافات"),
  entry("C333111", "المحرر Monaco", "أداة", "تحرير الملفات مع تلوين الصياغة", "أدوات"),
  entry("C333112", "الطرفية", "أداة", "تنفيذ الأوامر المحلية", "أدوات"),
  entry("C333113", "مصدّر ZIP", "أداة", "تصدير نتائج المكتبة في أرشيف", "أدوات"),
  entry("C333114", "الفتح السريع Ctrl+P", "أداة", "فتح الملفات بسرعة؛ البحث داخل المشروع Ctrl+Shift+F", "أدوات"),
  entry("D444111", "WebSocket 5001", "علاقة", "بث الأحداث والإحصائيات الحية", "علاقات", false),
  entry("D444112", "واجهة /api/stats", "علاقة", "جلب الإحصائيات دوريًا", "علاقات"),
  entry("D444113", "سجل الأحداث", "علاقة", "كتابة الأحداث في logs/", "علاقات"),
];

function load(): RegistryEntry[] {
  if (typeof window === "undefined") return DEFAULT_REGISTRY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REGISTRY;
    const parsed = JSON.parse(raw) as RegistryEntry[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_REGISTRY;
    return parsed;
  } catch {
    return DEFAULT_REGISTRY;
  }
}

function persist(entries: RegistryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function useRegistry() {
  const [entries, setEntries] = useState<RegistryEntry[]>(DEFAULT_REGISTRY);

  useEffect(() => {
    setEntries(load());
  }, []);

  const commit = useCallback((next: RegistryEntry[]) => {
    setEntries(next);
    persist(next);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<RegistryEntry, "id">>) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id ? { ...e, ...patch, updatedAt: now() } : e,
        );
        persist(next);
        return next;
      });
    },
    [],
  );

  const toggle = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled, updatedAt: now() } : e,
      );
      persist(next);
      return next;
    });
  }, []);

  const add = useCallback((data: Omit<RegistryEntry, "id" | "updatedAt"> & { id?: string }) => {
    setEntries((prev) => {
      const id = data.id && isValidId(data.id) && !prev.some((e) => e.id === data.id)
        ? data.id
        : makeId(prev);
      const next = [...prev, { ...data, id, updatedAt: now() }];
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => commit(DEFAULT_REGISTRY), [commit]);

  const setAll = useCallback(
    (enabled: boolean, category?: RegistryCategory) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          !category || e.category === category ? { ...e, enabled, updatedAt: now() } : e,
        );
        persist(next);
        return next;
      });
    },
    [],
  );

  return { entries, add, update, toggle, remove, resetAll, setAll, commit };
}

/** قراءة سريعة خارج React: هل الميزة مفعّلة؟ */
export function isFeatureEnabled(name: string): boolean {
  return load().some((e) => e.name === name && e.enabled);
}
