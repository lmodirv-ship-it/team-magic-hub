#!/usr/bin/env node
// Groupe-HN CLI — أوامر المنصة: groupe-hn <أمر>  (أو nawat ghn <أمر>)
import http from "node:http";
import { ghn, api, cfg, VERSION } from "./lib.mjs";

export async function runGhn(argv) {
  const [cmd, ...args] = argv;
  const has = (n) => args.includes(`--${n}`);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const out = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));
  switch (cmd) {
    case "models": {
      const m = await ghn.models();
      if (has("json")) return out(m);
      for (const x of m.ollama) console.log(`● ${x.name.padEnd(40)} ${x.gb} GB  ${x.family}`);
      for (const x of m.gguf) console.log(`  ${x.name.padEnd(40)} ${x.gb} GB  gguf`);
      for (const x of m.registry) console.log(`  ${String(x.name ?? x.id).padEnd(40)} registry`);
      return;
    }
    case "queue": return out(await ghn.queue());
    case "stats": return out(await ghn.stats());
    case "info": return out(await ghn.info());
    case "studio": return out(await ghn.studio(args[0] ?? "check"));
    case "sync": return out(await ghn.sync({ model: flag("model"), from: flag("from", cfg.nodes[0]), to: flag("to", cfg.nodes[1]), dry: has("dry") || !has("run") }));
    case "doctor": {
      const d = await ghn.doctor();
      for (const c of d.checks) console.log(`${c.ok ? "✅" : "⚠️"} ${c.name.padEnd(36)} ${c.detail}`);
      console.log(d.ok ? "\n🎉 كل شيء سليم — واصل الإبداع!" : `\n${d.failed} نقطة تحتاج انتباهك.`);
      if (!d.ok) process.exitCode = 2;
      return;
    }
    case "bridge": {
      const port = Number(flag("port", cfg.bridgePort));
      const routes = { "/api/models": () => ghn.models(), "/api/queue": () => ghn.queue(), "/api/stats": () => ghn.stats(), "/api/info": () => ghn.info(), "/api/health": async () => ({ ok: true, version: VERSION }) };
      http.createServer(async (req, res) => {
        const fn = routes[(req.url ?? "").split("?")[0]];
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (req.method !== "GET" || !fn) { res.statusCode = 404; return res.end('{"error":"not found"}'); }
        try { res.end(JSON.stringify(await fn())); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message ?? e) })); }
      }).listen(port, () => console.log(`🌉 Groupe-HN bridge (قراءة فقط) على :${port}`));
      return;
    }
    default:
      console.log(`Groupe-HN CLI v${VERSION}
  groupe-hn models [--json]      كل النماذج: محلي ● + GGUF + السجل
  groupe-hn queue                حالة الطابور
  groupe-hn stats                Ollama + القرص + الذاكرة + PM2 + المصنع
  groupe-hn bridge [--port 8795] جسر API خفيف للقراءة
  groupe-hn sync --model X [--from H --to H] [--run]   (تجربة افتراضيًا)
  groupe-hn studio check|start|stop
  groupe-hn info                 نظرة على البيئة
  groupe-hn doctor               فحص شامل (خروج 2 عند وجود نقص)`);
      void api;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("groupe-hn.mjs")) {
  runGhn(process.argv.slice(2)).catch((e) => { console.error("⏸", e.message ?? e); process.exit(1); });
}
