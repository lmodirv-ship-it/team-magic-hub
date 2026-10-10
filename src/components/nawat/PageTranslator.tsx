import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useLang } from "@/lib/nawat/i18n";
import { translateUi, type UiLang } from "@/lib/nawat/ui-translation";

const ATTRS = ["title", "placeholder", "aria-label", "alt"] as const;
const SKIP = ".monaco-editor, .xterm, pre, code, [contenteditable='true'], [data-no-translate], script, style";
type Saved = { original: string; rendered: string };
const origText = new WeakMap<Text, Saved>();
const origAttr = new WeakMap<Element, Map<string, Saved>>();

function update(current: string, saved: Saved | undefined, lang: UiLang): Saved {
  const original = saved && current === saved.rendered ? saved.original : current;
  return { original, rendered: translateUi(original, lang) };
}

function walk(root: Node, lang: UiLang) {
  const el = root.nodeType === 1 ? root as Element : root.parentElement;
  if (el?.closest(SKIP)) return;
  if (root.nodeType === 3) {
    // User input is never translated; textarea labels still are.
    if (el?.closest("textarea")) return;
    const text = root as Text;
    const saved = update(text.data, origText.get(text), lang);
    origText.set(text, saved);
    if (text.data !== saved.rendered) text.data = saved.rendered;
    return;
  }
  if (root.nodeType !== 1) return;
  const element = root as Element;
  let attrs = origAttr.get(element);
  if (!attrs) { attrs = new Map(); origAttr.set(element, attrs); }
  for (const attr of ATTRS) {
    const value = element.getAttribute(attr);
    if (value === null) continue;
    const saved = update(value, attrs.get(attr), lang);
    attrs.set(attr, saved);
    if (value !== saved.rendered) element.setAttribute(attr, saved.rendered);
  }
  for (const child of Array.from(element.childNodes)) walk(child, lang);
}

export function PageTranslator() {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    let title: Saved | undefined;
    const translateTitle = () => {
      title = update(document.title, title, lang);
      if (document.title !== title.rendered) document.title = title.rendered;
    };
    // Lazy route boundaries may hydrate after the root effect. Wait for route settlement,
    // without depending on a window load event which might already have fired.
    const options = {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: [...ATTRS],
    };
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "childList") mutation.addedNodes.forEach((node) => walk(node, lang));
        else walk(mutation.target, lang);
      }
      translateTitle();
      observer.observe(document.body, options);
    });
    const timer = window.setTimeout(() => {
      walk(document.body, lang);
      translateTitle();
      observer.observe(document.body, options);
    }, 1200);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [lang, pathname]);
  return null;
}