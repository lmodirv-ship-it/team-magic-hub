// سجل الميزات الدائم — أضف ولا تحذف. كل ميزة جديدة تُضاف في آخر القائمة برقم تسلسلي.
export type Feature = { id: number; date: string; title: string; area: string; route?: string };

export const FEATURES: Feature[] = [
  { id: 1, date: "2026-10-08", area: "السجل", title: "سجل الميزات الدائم داخل البرنامج", route: "/ledger" },
  { id: 2, date: "2026-10-08", area: "السجل", title: "اختبار يمنع حذف أي ميزة مسجلة" },
  { id: 3, date: "2026-10-08", area: "المنافذ", title: "تمرير صفحة المنافذ حتى الأسفل", route: "/ports" },
  { id: 4, date: "2026-10-08", area: "الربط", title: "إعداد Codex CLI لنماذج Ollama المحلية", route: "/mcp" },
  { id: 5, date: "2026-10-08", area: "الربط", title: "إعداد Continue / VS Code للنماذج المحلية", route: "/mcp" },
  { id: 6, date: "2026-10-08", area: "الربط", title: "قواعد Cursor للمشروع (.cursorrules)", route: "/mcp" },
  { id: 7, date: "2026-10-08", area: "الربط", title: "ملف AGENTS.md لـ Lovable وCodex وOpenCode", route: "/mcp" },
  { id: 8, date: "2026-10-08", area: "الربط", title: "تنزيل أي ملف إعداد بنقرة", route: "/mcp" },
  { id: 9, date: "2026-10-08", area: "الحزم", title: "مولّد أوامر تثبيت مكتبات npm", route: "/mcp" },
  { id: 10, date: "2026-10-08", area: "الحزم", title: "مولّد أوامر تثبيت مكتبات pip", route: "/mcp" },
  { id: 11, date: "2026-10-08", area: "الحزم", title: "تثبيت المكتبات داخل مجلد مشروع السيرفر", route: "/mcp" },
  { id: 12, date: "2026-10-08", area: "النشر", title: "أمر نشر مجلد الحاسوب إلى السيرفر (scp)", route: "/mcp" },
  { id: 13, date: "2026-10-08", area: "النشر", title: "أمر مزامنة تراكمية بلا حذف (rsync)", route: "/mcp" },
  { id: 14, date: "2026-10-08", area: "النشر", title: "اسم مشروع السيرفر محفوظ مع الإعدادات", route: "/mcp" },
  { id: 15, date: "2026-10-08", area: "النشر", title: "مستخدم وعنوان SSH محفوظان على الجهاز", route: "/mcp" },
  { id: 16, date: "2026-10-08", area: "السجل", title: "بحث في سجل الميزات", route: "/ledger" },
  { id: 17, date: "2026-10-08", area: "السجل", title: "تصفية الميزات حسب المحور", route: "/ledger" },
  { id: 18, date: "2026-10-08", area: "السجل", title: "تصدير السجل JSON", route: "/ledger" },
  { id: 19, date: "2026-10-08", area: "السجل", title: "عدّاد التقدم نحو 600 ميزة", route: "/ledger" },
  { id: 20, date: "2026-10-08", area: "الإعدادات", title: "زر سجل الميزات في الإعدادات", route: "/settings" },
];
