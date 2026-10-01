import { useSyncExternalStore } from "react";

export type PortType = "web" | "ai" | "db" | "docker" | "svc" | "dev" | "infra";
export type PortEntry = {
  id: string;
  code?: string; // معرّف العرض: حرف + 6 أرقام (P000001)
  port: string; // "8787" أو نطاق "11435-11461"
  host: string; // عنوان الخادم
  bind: "public" | "local";
  type: PortType;
  service: string;
  manager: string;
  description: string;
  enabled: boolean;
  pages: string[]; // صفحات التطبيق المرتبطة
  links: string[]; // معرّفات منافذ مرتبطة (يعتمد على)
};

export const PORT_TYPES: Record<PortType, string> = {
  web: "ويب", ai: "ذكاء اصطناعي", db: "قاعدة بيانات", docker: "حاوية", svc: "خدمة", dev: "تطوير", infra: "بنية",
};

export const APP_PAGES: { to: string; label: string }[] = [
  { to: "/", label: "نظرة عامة" }, { to: "/workspace", label: "مساحة العمل" },
  { to: "/chat/new", label: "المحادثات" }, { to: "/atelier", label: "الورشة" },
  { to: "/resultats", label: "النتائج" }, { to: "/agents", label: "الوكلاء" },
  { to: "/tools", label: "الأدوات" }, { to: "/spy", label: "المراقبة" },
  { to: "/models", label: "النماذج" }, { to: "/providers", label: "المزوّدون" },
  { to: "/tasks", label: "المهام" }, { to: "/plan", label: "خطة الأسبوع" },
  { to: "/architecture", label: "البنية" }, { to: "/settings", label: "الإعدادات" },
  { to: "/packs", label: "Packs" }, { to: "/metrics", label: "القياسات" },
];

const S = "192.168.100.66"; // كل المنافذ على هذا الخادم
const p = (id: string, port: string, host: string, bind: "public" | "local", type: PortType, service: string, manager: string, description: string, pages: string[], links: string[] = []): PortEntry =>
  ({ id, port, host, bind, type, service, manager, description, enabled: true, pages, links });

/** يمنح كل منفذ بلا معرّف الرقم التالي المتاح: حرف P + 6 أرقام (P000001) */
function withCodes(list: PortEntry[]): PortEntry[] {
  const used = new Set(list.map((x) => x.code).filter(Boolean) as string[]);
  let n = 1;
  return list.map((x) => {
    if (x.code) return x;
    while (used.has(`P${String(n).padStart(6, "0")}`)) n++;
    const code = `P${String(n).padStart(6, "0")}`;
    used.add(code);
    return { ...x, code };
  });
}

/** البيانات الأولية: من صفحة المنافذ المرفوعة + منافذ التطبيق المحلية */
export const DEFAULT_PORTS: PortEntry[] = [
  p("nginx-80", "80", S, "public", "web", "nginx", "nginx", "الموقع الرئيسي — 237 موقعًا، الافتراضي nawat.hn-groupe.net", ["/", "/architecture"]),
  p("site-3001", "3001", S, "public", "web", "nginx", "nginx", "HN GROUPE — Ride Hailing & Delivery", ["/architecture"], ["nginx-80"]),
  p("nawat3-8083", "8083", S, "public", "web", "nginx → nawat3", "nginx", "واجهة nawat3 (تمرير إلى :5004، رفع 100m، مهلة 160s)", ["/workspace", "/atelier"], ["nawat3-5004"]),
  p("nawat3-5004", "5004", S, "public", "svc", "nawat3", "pm2", "خادم nawat3 الخلفي", ["/atelier", "/agents"], ["ollama"]),
  p("nginx-8181", "8181", S, "public", "infra", "nginx default_server", "nginx", "اللقطة الافتراضية — ترفض 400 إذا خرج Host عن القائمة", ["/architecture"], ["nginx-80"]),
  p("cockpit", "9090", S, "public", "infra", "Cockpit", "systemd", "لوحة إدارة النظام — يُفضّل تقييدها بـ127.0.0.1", ["/spy", "/settings"]),
  p("node-exp", "9100", S, "public", "infra", "node_exporter", "systemd", "مقاييس المضيف دون مصادقة — يُفضّل تقييدها", ["/spy", "/metrics"]),
  p("ttyd", "7681", S, "public", "dev", "ttyd", "systemd", "طرفية ويب", ["/tools", "/workspace"]),
  p("containerd", "32871", S, "public", "docker", "containerd", "containerd", "واجهة containerd", ["/architecture"]),
  p("dns", "53", "127.0.0.53", "local", "infra", "systemd-resolved", "systemd", "DNS محلي داخل الخادم (127.0.0.53/54)", ["/settings"]),
  p("comfyui", "8188", "192.168.2.4", "public", "ai", "ComfyUI — مولّد الصور", "docker", "يغذّي «ارسم…» وأزرار التكبير والتوسيع والتعبئة", ["/atelier", "/models"]),
  p("published-app", "443", "studio-nawat.lovable.app", "public", "web", "NAWAT Studio المنشور", "cloud", "الرابط بين خدمات تطبيق الهاتف — يفتح من أي مكان بالإنترنت", ["/ports"], ["bridge-models", "comfyui", "search-gateway"]),
  p("bridge-models", "8788", S, "public", "ai", "الجسر — نماذج الخادم", "local", "للمهام الصعبة: برمجة، رؤية، استدلال طويل (تطبيق الهاتف)", ["/models", "/atelier"], ["ollama"]),
  p("search-gateway", "443", "ntapi.hn-dbpro.com", "public", "web", "بوابة البحث السحابية", "cloud", "ويب · أخبار · صور · فيديو · ويكيبيديا · أسئلة", ["/atelier"]),
  p("ollama", "11434", S, "public", "ai", "Ollama", "systemd", "خادم النماذج المحلي", ["/models", "/atelier", "/chat/new", "/workspace", "/providers", "/settings"]),
  p("llamacpp", "5050", S, "public", "ai", "llama.cpp (0.5B)", "pm2", "نموذج صغير سريع", ["/models", "/providers"]),
  p("openwebui", "3000", S, "public", "ai", "Open WebUI / المحرك", "docker", "واجهة المحادثة والمحرك", ["/chat/new", "/providers"], ["ollama", "litellm"]),
  p("litellm", "4000", S, "public", "ai", "LiteLLM", "docker", "بوابة توجيه النماذج", ["/providers", "/models"], ["ollama"]),
  p("nawat3-range", "11435-11461", S, "public", "svc", "nawat3 (PID 1313)", "pm2", "نطاق 27 منفذًا يحجزه nawat3 — يستحق المراجعة", ["/architecture"], ["nawat3-5004"]),
  p("factory", "5001", S, "public", "svc", "المصنع / عدادات الإحصاء", "local", "مصدر إحصاءات NAWAT CHAT (WS)", ["/", "/chat/new", "/spy"]),
  p("bridge", "8787", S, "public", "svc", "جسر SSH", "local", "تنفيذ الأوامر والطرفية عبر SSH", ["/tools", "/workspace", "/packs"]),
  p("studio", "5174", S, "public", "dev", "NAWAT Studio", "local", "واجهة الاستوديو", ["/"]),
  p("core-pack", "8790", S, "public", "svc", "core-pack", "local", "النواة: ملفات وأحداث", ["/packs"]),
  p("editor-pack", "8792", S, "public", "svc", "editor-pack / search-pack", "local", "تعارض: الحزمتان تطلبان 8792", ["/packs", "/workspace"], ["core-pack"]),
  p("search-pack", "8793", S, "public", "svc", "search-pack indexer", "local", "فهرسة البحث الدلالي", ["/packs", "/workspace"], ["core-pack", "ollama"]),
];

const KEY = "nawat.ports.v1";
let current: PortEntry[] = DEFAULT_PORTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const stored: PortEntry[] = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object").map((x: Partial<PortEntry>, i: number): PortEntry => ({
      id: typeof x.id === "string" && x.id ? x.id : `p-fix-${i}`,
      ...(typeof x.code === "string" ? { code: x.code } : {}),
      port: String(x.port ?? ""), host: String(x.host ?? S),
      bind: x.bind === "local" ? "local" : "public",
      type: x.type && x.type in PORT_TYPES ? x.type : "svc",
      service: String(x.service ?? ""), manager: String(x.manager ?? ""), description: String(x.description ?? ""),
      enabled: x.enabled !== false,
      pages: Array.isArray(x.pages) ? x.pages : [], links: Array.isArray(x.links) ? x.links : [],
    })) : [];
    if (stored.length) {
      // ترحيل: كل المنافذ على الخادم 192.168.100.66 (باستثناء DNS المحلي داخل الخادم)
      let changed = false;
      const migrated = stored.map((x) => {
        if (x.id !== "dns" && (x.host === "localhost" || x.host === "127.0.0.1")) {
          changed = true;
          return { ...x, host: S, bind: "public" as const };
        }
        return x;
      });
      // إضافة منافذ الهاتف الجديدة للبيانات المحفوظة سابقًا
      for (const id of ["published-app", "bridge-models", "search-gateway"]) {
        if (!migrated.some((x) => x.id === id)) { const d = DEFAULT_PORTS.find((x) => x.id === id); if (d) migrated.push({ ...d }); }
      }
      const coded = withCodes(migrated);
      current = coded;
      { void changed; try { localStorage.setItem(KEY, JSON.stringify(coded)); } catch { /* storage full */ } }
    } else {
      current = withCodes(DEFAULT_PORTS);
    }
  } catch { /* keep defaults */ }
}
function commit(next: PortEntry[]) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full */ }
  listeners.forEach((l) => l());
}

export function usePorts(): PortEntry[] {
  return useSyncExternalStore(
    (l) => { load(); listeners.add(l); return () => { listeners.delete(l); }; },
    () => { load(); return current; },
    () => DEFAULT_PORTS,
  );
}
export const portsApi = {
  update: (id: string, patch: Partial<PortEntry>) => commit(current.map((x) => (x.id === id ? { ...x, ...patch } : x))),
  add: (e: Omit<PortEntry, "id">) => commit(withCodes([...current, { ...e, id: `p-${Date.now().toString(36)}` }])),
  remove: (id: string) => commit(current.filter((x) => x.id !== id).map((x) => ({ ...x, links: x.links.filter((l) => l !== id) }))),
  reset: () => commit(withCodes(DEFAULT_PORTS)),
};
