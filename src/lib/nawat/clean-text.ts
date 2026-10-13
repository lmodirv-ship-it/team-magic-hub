// Invisible bidi / zero-width marks that models sometimes emit inside generated files.
// They show up as red "unknown character" boxes in the editor and pollute diffs,
// so every generated file is cleaned before it is stored.
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

export function cleanInvisibleMarks(text: string): string {
  return text.replace(INVISIBLE_MARKS, "");
}
