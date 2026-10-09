#!/usr/bin/env node
// NAWAT CLI — لسان التحكم: nawat <أمر>  — Groupe-HN v1.1.0
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { api, masked, VERSION } from "./lib.mjs";
import { runGhn } from "./groupe-hn.mjs";

const [cmd, ...args] = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(`--${n}`);
const positional = () => { const r = []; for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) { if (!["think", "json"].includes(args[i].slice(2))) i++; continue; } r.push(args[i]); } return r; };
const out = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));
const genOpts = () => ({ think: has("think"), maxTokens: flag("max-tokens") ? Number(flag("max-tokens")) : undefined, temperature: flag("temperature") });

const HELP = `NAWAT CLI v${VERSION} — Groupe-HN
  nawat status                    حالة الجسر والمصنع وOllama (متوازية)
  nawat health | ping | system    صحة / نبضة / مقاييس السيرفر
  nawat models [--json]           النماذج: اسم + حجم + عائلة
  nawat version | config          نسخة الخادم / الإعدادات (رموز مخفية)
  nawat chat <model> <نص> [--think] [--max-tokens N] [--temperature T]
  nawat bchat [model] <نص> [--think]   عبر الجسر (يعمل عن بُعد)
  nawat compare <m1> <m2> [نص]    مقارنة نموذجين
  nawat image <وصف> [--width W --height H --steps S --out f.png]
  nawat queue | stats | datasets | logs [--tail N]
  nawat train --teacher X --version v18 [--type generate_data|train|quantize|deploy]
  nawat deploy <version> | test-teacher <m> | task-rm <id> | queue-clear
  nawat worker start|stop
  nawat projects list|create|tree|read|write [--name P --path F --content T]
  nawat sync [status|update] | update
  nawat serve [bridge|factory|mcp|ghn]
  nawat ghn <أمر>                 أوامر منصة Groupe-HN (انظر groupe-hn help)`;

try {
  switch (cmd) {
    case "status": {
      const s = await api.status();
      for (const [k, v] of Object.entries(s)) {
        if (v.ok) console.log(`✅ ${k.padEnd(8)} متصل`);
        else if (k === "factory") console.log(`⏸ ${k.padEnd(8)} غير مشغّل (اختياري) — شغّله بـ: nawat serve factory`);
        else console.log(`⏸ ${k.padEnd(8)} غير متاح الآن`);
      }
      break;
    }
    case "health": out(await api.health()); break;
    case "ping": out(await api.ping()); break;
    case "system": out(await api.system()); break;
    case "version": out({ cli: VERSION, server: await api.version() }); break;
    case "models": {
      const ms = await api.models();
      if (has("json")) out(ms); else for (const m of ms) console.log(`${m.name.padEnd(40)} ${String(m.gb).padStart(6)} GB  ${m.family}`);
      break;
    }
    case "chat": { const p = positional(); const r = await api.chat(p[0], p.slice(1).join(" "), genOpts()); console.log(r.answer, `\n⏱ ${r.ms}ms`); break; }
    case "bchat": {
      const p = positional();
      const model = p.length > 1 && p[0].includes(":") ? p.shift() : undefined;
      const r = await api.bridgeChat(p.join(" "), { ...genOpts(), model });
      console.log(r.answer, `\n⏱ ${r.ms}ms — ${r.model}`);
      break;
    }
    case "compare": {
      const rs = await api.compare(args[0], args[1], args.slice(2).join(" ") || undefined);
      for (const r of rs) console.log(`\n── ${r.model} (${r.ms}ms) ──\n${r.answer}`);
      break;
    }
    case "image": {
      const r = await api.image({ prompt: positional().join(" "), width: Number(flag("width", 768)), height: Number(flag("height", 768)), steps: Number(flag("steps", 20)) });
      const file = flag("out", r.filename);
      writeFileSync(file, Buffer.from(r.base64, "base64"));
      console.log(`🖼️ حُفظت الصورة: ${file}`);
      break;
    }
    case "queue": out(await api.queue()); break;
    case "stats": out(await api.stats()); break;
    case "datasets": out(await api.datasets()); break;
    case "logs": out(await api.logs(flag("tail"))); break;
    case "train":
      out(await api.queueAdd({ version: flag("version", "v18"), teacher: flag("teacher", "nawat-think:v17-anon"), type: flag("type", "generate_data"), prompts_file: flag("prompts", "") }));
      break;
    case "deploy": out(await api.queueAdd({ version: args[0], teacher: flag("teacher", "nawat-think:v17-anon"), type: "deploy" })); break;
    case "test-teacher": out(await api.testTeacher(args[0] ?? "nawat-think:v17-anon")); break;
    case "task-rm": out(await api.queueRemove(args[0])); break;
    case "queue-clear": out(await api.queueClear()); break;
    case "worker": out(args[0] === "stop" ? await api.workerStop() : await api.workerStart()); break;
    case "projects": out(await api.projects({ action: args[0] ?? "list", name: flag("name", args[1]), path: flag("path"), content: flag("content") })); break;
    case "sync": out(await api.sync(args[0] ?? "status")); break;
    case "update": out(await api.sync("update")); break;
    case "serve": {
      const file = { bridge: "bridge/server.mjs", factory: "deploy/factory/factory_server.py", mcp: "cli/mcp-server.mjs", ghn: "cli/groupe-hn.mjs" }[args[0] ?? "bridge"];
      const bin = file.endsWith(".py") ? "python3" : process.execPath;
      spawn(bin, args[0] === "ghn" ? [file, "bridge"] : [file], { stdio: "inherit" });
      break;
    }
    case "ghn": await runGhn(args); break;
    case "config": out(masked()); break;
    default: console.log(HELP);
  }
} catch (e) {
  console.error("⏸", e.message ?? e);
  process.exit(1);
}
