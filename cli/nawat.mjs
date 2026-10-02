#!/usr/bin/env node
// NAWAT CLI — لسان التحكم: nawat <أمر>
import { spawn } from "node:child_process";
import { api, cfg } from "./lib.mjs";

const [cmd, ...args] = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));

const HELP = `NAWAT CLI — Groupe-HN
  nawat status                    حالة الجسر والمصنع وOllama
  nawat system                    مقاييس السيرفر
  nawat models                    النماذج
  nawat chat <model> <نص>         سؤال نموذج
  nawat compare <m1> <m2> [نص]    مقارنة نموذجين
  nawat queue                     طابور المصنع
  nawat stats | logs              إحصائيات / سجلات المصنع
  nawat train --teacher X --version v18 [--type generate_data|train|quantize|deploy]
  nawat deploy <version>          إضافة مهمة نشر
  nawat worker start|stop         تشغيل/إيقاف عامل المصنع
  nawat serve [bridge|factory|mcp] تشغيل خدمة محليًا
  nawat config                    العناوين الحالية
المتغيرات: NAWAT_BRIDGE NAWAT_FACTORY NAWAT_OLLAMA NAWAT_TOKEN`;

try {
  switch (cmd) {
    case "status": {
      const s = await api.status();
      for (const [k, v] of Object.entries(s)) console.log(`${v.ok ? "✅" : "❌"} ${k.padEnd(8)} ${v.ok ? "متصل" : v.error}`);
      break;
    }
    case "system": out(await api.system()); break;
    case "models": for (const m of await api.models()) console.log(`${m.name.padEnd(40)} ${m.gb} GB`); break;
    case "chat": { const r = await api.chat(args[0], args.slice(1).join(" ")); console.log(r.answer, `\n⏱ ${r.ms}ms`); break; }
    case "compare": {
      const prompt = args.slice(2).join(" ") || "من أنت ومن طوّرك؟";
      const rs = await Promise.all([args[0], args[1]].map((m) => api.chat(m, prompt).catch((e) => ({ model: m, ms: 0, answer: `❌ ${e.message}` }))));
      for (const r of rs) console.log(`\n── ${r.model} (${r.ms}ms) ──\n${r.answer}`);
      break;
    }
    case "queue": out(await api.queue()); break;
    case "stats": out(await api.stats()); break;
    case "logs": out(await api.logs()); break;
    case "train":
      out(await api.queueAdd({ version: flag("version", "v18"), teacher: flag("teacher", "nawat-think:v17-anon"), type: flag("type", "generate_data"), prompts_file: flag("prompts", "") }));
      break;
    case "deploy": out(await api.queueAdd({ version: args[0], teacher: flag("teacher", "nawat-think:v17-anon"), type: "deploy" })); break;
    case "worker": out(args[0] === "stop" ? await api.workerStop() : await api.workerStart()); break;
    case "serve": {
      const file = { bridge: "bridge/server.mjs", factory: "deploy/factory/factory_server.py", mcp: "cli/mcp-server.mjs" }[args[0] ?? "bridge"];
      const bin = file.endsWith(".py") ? "python3" : process.execPath;
      spawn(bin, [file], { stdio: "inherit" });
      break;
    }
    case "config": out(cfg.token ? { ...cfg, token: "***" } : cfg); break;
    default: console.log(HELP);
  }
} catch (e) {
  console.error("❌", e.message ?? e);
  process.exit(1);
}
