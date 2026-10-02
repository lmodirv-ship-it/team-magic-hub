#!/usr/bin/env node
// NAWAT MCP Server — stdio JSON-RPC (Claude Desktop / Cursor / OpenCode)، بلا مكتبات خارجية
import { createInterface } from "node:readline";
import { api } from "./lib.mjs";

const TOOLS = [
  { name: "nawat_status", description: "حالة الجسر والمصنع وOllama", inputSchema: { type: "object", properties: {} }, run: () => api.status() },
  { name: "nawat_system", description: "مقاييس السيرفر (قرص، ذاكرة، PM2)", inputSchema: { type: "object", properties: {} }, run: () => api.system() },
  { name: "nawat_models", description: "قائمة نماذج NAWAT في Ollama", inputSchema: { type: "object", properties: {} }, run: () => api.models() },
  {
    name: "nawat_chat", description: "سؤال نموذج NAWAT محلي",
    inputSchema: { type: "object", properties: { model: { type: "string" }, prompt: { type: "string" } }, required: ["model", "prompt"] },
    run: (a) => api.chat(a.model, a.prompt),
  },
  { name: "nawat_factory_queue", description: "طابور مهام مصنع النماذج", inputSchema: { type: "object", properties: {} }, run: () => api.queue() },
  {
    name: "nawat_factory_add", description: "إضافة مهمة للمصنع (generate_data, train, quantize, deploy)",
    inputSchema: { type: "object", properties: { version: { type: "string" }, teacher: { type: "string" }, type: { type: "string" }, prompts: { type: "array", items: { type: "string" } } }, required: ["version", "teacher"] },
    run: (a) => api.queueAdd(a),
  },
];

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");

createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  if (id === undefined) return; // إشعارات
  try {
    if (method === "initialize")
      return send({ id, result: { protocolVersion: params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "nawat", version: "1.0.0" } } });
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
