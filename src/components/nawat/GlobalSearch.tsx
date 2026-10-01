import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bot, Cpu, FileText, LayoutDashboard } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useWorkspace } from "@/lib/nawat/workspace";
import { useModels } from "@/lib/nawat/useModels";

const PAGES = [
  { to: "/", label: "نظرة عامة" },
  { to: "/workspace", label: "مساحة العمل" },
  { to: "/atelier", label: "الورشة متعددة النماذج" },
  { to: "/resultats", label: "النتائج / المكتبة" },
  { to: "/agents", label: "الوكلاء" },
  { to: "/tools", label: "الأدوات" },
  { to: "/spy", label: "المراقبة" },
  { to: "/models", label: "النماذج" },
  { to: "/providers", label: "المزوّدون" },
  { to: "/tasks", label: "المهام" },
  { to: "/plan", label: "خطة الأسبوع" },
  { to: "/architecture", label: "البنية" },
  { to: "/settings", label: "الإعدادات" },
] as const;

const HISTORY_KEY = "nawat.search.history.v1";

/** Ctrl+P quick open; Ctrl+Shift+P commands and navigation. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const navigate = useNavigate();
  const { vfs, openFile } = useWorkspace();
  const { models } = useModels(15000);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setHistory(parsed as string[]);
    } catch {
      // Ignore unreadable history.
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommands(event.shiftKey);
        setOpen((value) => !value);
      }
    };
    const onOpen = () => { setCommands(false); setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("nawat:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nawat:open-search", onOpen);
    };
  }, []);

  const files = useMemo(() => Object.keys(vfs).sort(), [vfs]);

  const remember = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...history.filter((h) => h !== term)].slice(0, 8);
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures.
    }
  };

  const close = () => {
    remember(query);
    setOpen(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={commands ? "الأوامر والصفحات والنماذج…" : "فتح ملف سريع…"}
      />
      <CommandList>
        <CommandEmpty>لا نتائج</CommandEmpty>
        {!query && commands && history.length > 0 && (
          <CommandGroup heading="عمليات بحث سابقة">
            {history.map((h) => (
              <CommandItem key={h} value={h} onSelect={() => setQuery(h)}>
                {h}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="الملفات">
          {files.map((path) => (
            <CommandItem
              key={path}
              value={`file ${path}`}
              onSelect={() => {
                openFile(path);
                void navigate({ to: "/workspace" });
                close();
              }}
            >
              <FileText className="size-3.5" />
              {path}
            </CommandItem>
          ))}
        </CommandGroup>
        {commands && <CommandGroup heading="الأوامر">
          <CommandItem value="command search project files contents" onSelect={() => { window.dispatchEvent(new CustomEvent("nawat:project-search")); close(); }}><FileText className="size-3.5" />بحث في محتوى المشروع</CommandItem>
          <CommandItem value="command new file" onSelect={() => { window.dispatchEvent(new CustomEvent("nawat:new-file")); close(); }}><FileText className="size-3.5" />ملف جديد</CommandItem>
        </CommandGroup>}
        {commands && <CommandGroup heading="النماذج">
          {models.map((model) => (
            <CommandItem
              key={model.name}
              value={`model ${model.name}`}
              onSelect={() => {
                void navigate({ to: "/models" });
                close();
              }}
            >
              <Cpu className="size-3.5" />
              {model.name}
            </CommandItem>
          ))}
        </CommandGroup>}
        {commands && <CommandGroup heading="الصفحات">
          {PAGES.map((page) => (
            <CommandItem
              key={page.to}
              value={`page ${page.label} ${page.to}`}
              onSelect={() => {
                void navigate({ to: page.to });
                close();
              }}
            >
              {page.to === "/agents" ? (
                <Bot className="size-3.5" />
              ) : (
                <LayoutDashboard className="size-3.5" />
              )}
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>}
      </CommandList>
    </CommandDialog>
  );
}
