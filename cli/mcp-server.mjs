#!/usr/bin/env node
// NAWAT MCP Server — stdio JSON-RPC (Claude Desktop / Cursor / OpenCode)، بلا مكتبات خارجية — 29 أداة
import { createInterface } from "node:readline";
import { api, ghn, masked, VERSION } from "./lib.mjs";

const none = { type: "object", properties: {} };
const obj = (properties, required = []) => ({ type: "object", properties, required });
const s = { type: "string" }, n = { type: "number" }, b = { type: "boolean" };
const gen = { maxTokens: n, think: b, temperature: n };

export const TOOLS = [
  { name: "nawat_status", description: "حالة الجسر والمصنع وOllama", inputSchema: none, run: () => api.status() },
  { name: "nawat_ping", description: "نبضة الجسر وزمن الاستجابة", inputSchema: none, run: () => api.ping() },
  { name: "nawat_health", description: "صحة Ollama وComfyUI", inputSchema: none, run: () => api.health() },
  { name: "nawat_system", description: "مقاييس السيرفر (قرص، ذاكرة، PM2)", inputSchema: none, run: () => api.system() },
  { name: "nawat_version", description: "نسخة الكود على الخادم", inputSchema: none, run: async () => ({ cli: VERSION, server: await api.version() }) },
  { name: "nawat_models", description: "قائمة النماذج (الجسر ثم Ollama)", inputSchema: none, run: () => api.models() },
  { name: "nawat_chat", description: "سؤال نموذج محلي مباشرة", inputSchema: obj({ model: s, prompt: s, ...gen }, ["model", "prompt"]), run: (a) => api.chat(a.model, a.prompt, a) },
  { name: "nawat_bridge_chat", description: "سؤال عبر الجسر (عن بُعد)", inputSchema: obj({ prompt: s, model: s, ...gen }, ["prompt"]), run: (a) => api.bridgeChat(a.prompt, a) },
  { name: "nawat_compare", description: "مقارنة نموذجين على نفس السؤال", inputSchema: obj({ m1: s, m2: s, prompt: s }, ["m1", "m2"]), run: (a) => api.compare(a.m1, a.m2, a.prompt) },
  { name: "nawat_image", description: "توليد صورة عبر ComfyUI (ترجع base64)", inputSchema: obj({ prompt: s, width: n, height: n, steps: n }, ["prompt"]), run: (a) => api.image(a) },
  { name: "nawat_factory_queue", description: "طابور مهام مصنع النماذج", inputSchema: none, run: () => api.queue() },
  { name: "nawat_factory_add", description: "إضافة مهمة للمصنع (generate_data, train, quantize, deploy)", inputSchema: obj({ version: s, teacher: s, type: s, prompts: { type: "array", items: s } }, ["version", "teacher"]), run: (a) => api.queueAdd(a) },
  { name: "nawat_factory_remove", description: "حذف مهمة من الطابور", inputSchema: obj({ id: s }, ["id"]), run: (a) => api.queueRemove(a.id) },
  { name: "nawat_factory_clear", description: "تفريغ الطابور", inputSchema: none, run: () => api.queueClear() },
  { name: "nawat_factory_stats", description: "إحصائيات المصنع", inputSchema: none, run: () => api.stats() },
  { name: "nawat_factory_logs", description: "سجلات المصنع", inputSchema: obj({ tail: n }), run: (a) => api.logs(a.tail) },
  { name: "nawat_factory_datasets", description: "مجموعات البيانات", inputSchema: none, run: () => api.datasets() },
  { name: "nawat_factory_test", description: "اختبار نموذج معلم", inputSchema: obj({ teacher: s }), run: (a) => api.testTeacher(a.teacher) },
  { name: "nawat_worker", description: "تشغيل / إيقاف عامل المصنع", inputSchema: obj({ action: { type: "string", enum: ["start", "stop"] } }, ["action"]), run: (a) => (a.action === "stop" ? api.workerStop() : api.workerStart()) },
  { name: "nawat_projects", description: "مشاريع السيرفر: list/create/tree/read/write", inputSchema: obj({ action: s, name: s, path: s, content: s }, ["action"]), run: (a) => api.projects(a) },
  { name: "nawat_sync", description: "مزامنة النسخ (status/update)", inputSchema: obj({ action: s }), run: (a) => api.sync(a.action) },
  { name: "nawat_config", description: "الإعدادات (الرموز مخفية)", inputSchema: none, run: async () => masked() },
  { name: "ghn_models", description: "نماذج المنصة: محلي + GGUF + السجل", inputSchema: none, run: () => ghn.models() },
  { name: "ghn_queue", description: "طابور المنصة", inputSchema: none, run: () => ghn.queue() },
  { name: "ghn_stats", description: "Ollama + القرص + الذاكرة + PM2 + المصنع", inputSchema: none, run: () => ghn.stats() },
  { name: "ghn_info", description: "نظرة سريعة على البيئة", inputSchema: none, run: () => ghn.info() },
  { name: "ghn_doctor", description: "فحص شامل للملفات والاتصال والبيئة", inputSchema: none, run: () => ghn.doctor() },
  { name: "ghn_studio", description: "الاستوديو check/start/stop", inputSchema: obj({ action: s }), run: (a) => ghn.studio(a.action ?? "check") },
  { name: "ghn_sync", description: "مزامنة GGUF بين العقدتين (تجربة افتراضيًا)", inputSchema: obj({ model: s, from: s, to: s, dry: b }, ["model"]), run: (a) => ghn.sync({ ...a, dry: a.dry !== false }) },
];

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");

if (!process.env.NAWAT_MCP_NO_LISTEN) createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  if (id === undefined) return; // إشعارات
  try {
    if (method === "initialize")
      return send({ id, result: { protocolVersion: params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "nawat", version: VERSION } } });
    if (method === "ping") return send({ id, result: {} });
    if (method === "tools/list")
      return send({ id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
    if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return send({ id, error: { code: -32602, message: "أداة غير معروفة" } });
      try {
        const r = await tool.run(params.arguments ?? {});
        return send({ id, result: { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] } });
      } catch (e) {
        return send({ id, result: { isError: true, content: [{ type: "text", text: String(e.message ?? e) }] } });
      }
    }
    send({ id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (e) {
    send({ id, error: { code: -32603, message: String(e) } });
  }
});
