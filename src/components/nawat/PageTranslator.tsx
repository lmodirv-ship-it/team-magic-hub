import { useEffect } from "react";
import dict from "@/lib/nawat/i18n-dict.json";
import { translate, useLang, type Lang } from "@/lib/nawat/i18n";

/**
 * Translates every Arabic text and label on every page (FR/EN), keeping the
 * original Arabic so switching back to AR restores it. Code editors and terminals are skipped.
 */
const D = dict as Record<string, [string, string]>;
const KEYS = Object.keys(D).sort((a, b) => b.length - a.length);
const AR = /[\u0600-\u06FF]/;
const ATTRS = ["title", "placeholder", "aria-label"] as const;
const SKIP = ".monaco-editor, .xterm, pre, code, textarea, [contenteditable='true'], [data-no-translate]";
const cache = { fr: new Map<string, string>(), en: new Map<string, string>() };
const origText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, Record<string, string>>();

function tr(s: string, l: Lang): string {
  if (l === "ar" || !AR.test(s)) return s;
  const c = cache[l as "fr" | "en"];
  const hit = c.get(s);
  if (hit !== undefined) return hit;
  const core = s.trim();
  const i = l === "fr" ? 0 : 1;
  let out: string;
  const manual = translate(core, l);
  if (manual !== core) out = s.replace(core, manual);
  else if (D[core]) out = s.replace(core, D[core][i]);
  else {
    out = s;
    for (const k of KEYS) if (out.includes(k)) out = out.split(k).join(D[k]?.[i] ?? k);
  }
  c.set(s, out);
  return out;
}

function walk(root: Node, l: Lang) {
  const el = root.nodeType === 1 ? (root as Element) : root.parentElement;
  if (el?.closest(SKIP)) return;
  if (root.nodeType === 3) {
    const t = root as Text;
    const o = origText.get(t) ?? t.data;
    if (!origText.has(t)) {
      if (!AR.test(o)) return;
      origText.set(t, o);
    }
    const next = tr(o, l);
    if (t.data !== next) t.data = next;
    return;
  }
  if (root.nodeType !== 1) return;
  const e = root as Element;
  let saved = origAttr.get(e);
  for (const a of ATTRS) {
    const v = e.getAttribute(a);
    if (v === null) continue;
    if (!saved?.[a] && !AR.test(v)) continue;
    if (!saved) origAttr.set(e, (saved = {}));
    if (!saved[a] || (AR.test(v) && v !== saved[a])) saved[a] = v;
    const next = tr(saved[a], l);
    if (v !== next) e.setAttribute(a, next);
  }
  for (const n of Array.from(e.childNodes)) walk(n, l);
}

export function PageTranslator() {
  const { lang } = useLang();
  useEffect(() => {
    let busy = false;
    const run = (n: Node) => {
      busy = true;
      walk(n, lang);
      busy = false;
    };
    const docTitle = () => {
      const t = document.title;
      if (AR.test(t) && lang !== "ar") document.title = tr(t, lang);
    };
    const mo = new MutationObserver((ms) => {
      if (busy) return;
      for (const m of ms) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          if (AR.test(t.data)) origText.set(t, t.data);
          run(t);
        } else if (m.type === "attributes") run(m.target);
        else m.addedNodes.forEach(run);
      }
      docTitle();
    });
    // Wait for hydration to finish before touching the page.
    const start = window.setTimeout(() => {
      run(document.body);
      docTitle();
      mo.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
      });
    }, 900);
    return () => {
      window.clearTimeout(start);
      mo.disconnect();
    };
  }, [lang]);
  return null;
}
