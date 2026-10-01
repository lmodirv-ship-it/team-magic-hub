import { useEffect, useState } from "react";
import { ollamaHost } from "@/lib/nawat/bridge";

const SERVICES = [
  { name: "Engine", url: "http://127.0.0.1:3000/api/state" },
  { name: "Factory", url: "http://127.0.0.1:5001/api/state" },
  { name: "Bridge", url: "http://127.0.0.1:8787/api/ping" },
  { name: "Studio", url: "http://127.0.0.1:5174/" },
];

async function ping(url: string): Promise<boolean> {
  try {
    // no-cors: نعرف فقط أن الخدمة تجيب، حتى بدون ترويسات CORS
    await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

export function ServicesHealth() {
  const [state, setState] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    const all = [...SERVICES, { name: "Ollama", url: `${ollamaHost()}/api/tags` }];
    const check = () =>
      all.forEach((s) => void ping(s.url).then((ok) => setState((p) => ({ ...p, [s.name]: ok }))));
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="glass-panel flex flex-wrap items-center gap-3 rounded-xl px-4 py-2 text-xs" dir="ltr">
      <span className="font-semibold">NAWAT start-all</span>
      {[...SERVICES.map((s) => s.name), "Ollama"].map((n) => (
        <span key={n} className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${state[n] == null ? "bg-muted-foreground" : state[n] ? "bg-nawat" : "bg-destructive"}`}
          />
          {n}
        </span>
      ))}
    </section>
  );
}
