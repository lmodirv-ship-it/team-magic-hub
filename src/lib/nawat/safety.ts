/** Safety Pack (متصفح): كتابة موثّقة بقراءة لاحقة + سجل تعافي لنسخ الملفات. ليست كتابة ذرّية على القرص. */
export type Vfs = Record<string, string>;
export type JournalEntry = { at: string; path: string; content: string; size: number };

const JOURNAL_KEY = "nawat.safety.journal.v1";
const TMP_KEY = "nawat.safety.tmp.v1";
const MAX_ENTRIES = 200;
const MAX_FILE = 200_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/** file.write-atomic: يكتب في مفتاح مؤقت، يتحقق بالقراءة، ثم يستبدل الأصل. */
export function writeVerified(key: string, value: string) {
  localStorage.setItem(TMP_KEY, value);
  const back = localStorage.getItem(TMP_KEY);
  if (back === null || hash(back) !== hash(value)) throw new Error("فشل التحقق من الكتابة");
  localStorage.setItem(key, value);
  localStorage.removeItem(TMP_KEY);
}

export function readJournal(): JournalEntry[] {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? "[]") as JournalEntry[]; } catch { return []; }
}

/** يسجّل النسخة السابقة لكل ملف تغيّر منذ آخر حفظ. */
export function journalChanges(prev: Vfs, next: Vfs) {
  const changed = Object.keys(prev).filter((p) => prev[p] !== next[p] && (prev[p] ?? "").length <= MAX_FILE);
  if (!changed.length) return;
  const at = new Date().toISOString();
  let list = [...changed.map((p) => ({ at, path: p, content: prev[p] ?? "", size: (prev[p] ?? "").length })), ...readJournal()].slice(0, MAX_ENTRIES);
  // خفّض الحجم إذا امتلأت المساحة
  while (list.length) {
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(list)); return; } catch { list = list.slice(0, Math.floor(list.length / 2)); }
  }
}

export function clearJournal() { localStorage.removeItem(JOURNAL_KEY); }

/** session.recover: هل بقيت كتابة مؤقتة غير مكتملة من جلسة سابقة؟ */
export function hasInterruptedWrite() { return localStorage.getItem(TMP_KEY) !== null; }
