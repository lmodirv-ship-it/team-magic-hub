import { useEffect, useMemo, useState } from "react";
import { getActivatedAgents, subscribeWeeklyPlan } from "./weekly-plan";

export type AgentState = "idle" | "running" | "failed";
export type Agent = {
  id: string;
  name: string;
  role: string;
  model: string;
  state: AgentState;
  progress: number;
  task: string;
  memory: number;
};
export type StudioEvent = {
  id: string;
  time: string;
  source: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
};
export type Telemetry = { cpu: number; ram: number; gpu: number; vram: number };

const mockAgents: Agent[] = [
  { id: "n1", name: "N1", role: "القائد المنسّق", model: "nawat-chat:latest", state: "running", progress: 74, task: "تخطيط ديناميكي عبر النموذج", memory: 7.4 },
  { id: "g1", name: "G1", role: "بنّاء — وحدات", model: "nawat-coder:latest", state: "running", progress: 61, task: "إنتاج وحدة المصادقة", memory: 4.2 },
  { id: "g2", name: "G2", role: "بنّاء — دمج", model: "nawat-coder:latest", state: "idle", progress: 100, task: "دمج الفروع المكتملة", memory: 3.8 },
  { id: "g3", name: "G3", role: "بنّاء — اختبار", model: "nawat-coder:latest", state: "running", progress: 45, task: "تشغيل حزمة الاختبارات", memory: 3.6 },
  { id: "g4", name: "G4", role: "بنّاء — تحسين", model: "nawat-coder:latest", state: "idle", progress: 100, task: "تحسين زمن الاستجابة", memory: 3.1 },
  { id: "g5", name: "G5", role: "بنّاء — إنتاج", model: "nawat-coder:latest", state: "idle", progress: 100, task: "بانتظار مهمة جديدة", memory: 2.9 },
  { id: "n2", name: "N2", role: "تحليل — تكميم", model: "nawat-tri:1.5b-r2", state: "idle", progress: 100, task: "تكميم q4 للدفعة الأخيرة", memory: 2.4 },
  { id: "n3", name: "N3", role: "تحليل — نمذجة", model: "nawat-tri:1.5b-r2", state: "idle", progress: 100, task: "نمذجة تدفق البيانات", memory: 2.2 },
  { id: "n4", name: "N4", role: "تحليل — حساب", model: "nawat-tri:1.5b-r1", state: "idle", progress: 100, task: "حسابات إحصائية", memory: 2.1 },
  { id: "n5", name: "N5", role: "تحليل — تحقق رياضي", model: "nawat-tri:1.5b-r1", state: "idle", progress: 100, task: "التحقق من البراهين", memory: 2.0 },
  { id: "nawat-n1", name: "nawat-n1", role: "القائد المخطط", model: "nawat-chat:latest", state: "running", progress: 58, task: "يستشعر أدواته ويوزع المهام", memory: 5.6 },
  { id: "nawat-builder", name: "nawat-builder", role: "البنّاء", model: "nawat-coder:latest", state: "running", progress: 39, task: "يجرد المخزون الحالي", memory: 4.4 },
  { id: "nawat-lab", name: "nawat-lab", role: "المختبر", model: "nawat-tri:1.5b-r2", state: "running", progress: 82, task: "يقيس السجل: ~1680 حدثاً", memory: 3.3 },
  { id: "nawat-pro", name: "nawat-pro", role: "المحترف", model: "nawat-chat:latest", state: "idle", progress: 100, task: "حكم صحة المخرجات", memory: 4.0 },
  { id: "nawat-doctor", name: "nawat-doctor", role: "طبيب المواقع", model: "nawat-tri:1.5b-r2", state: "running", progress: 67, task: "فحص 304 مواقع (~10 معطلة)", memory: 2.8 },
  { id: "nawat-engineer", name: "nawat-engineer", role: "مهندس الكود", model: "nawat-coder:latest", state: "idle", progress: 100, task: "مراجعة الشيفرة", memory: 3.9 },
  { id: "nawat-lawyer", name: "nawat-lawyer", role: "محامي القواعد", model: "nawat-chat:latest", state: "idle", progress: 100, task: "تدقيق الامتثال", memory: 3.5 },
];

const seedEvents: StudioEvent[] = [
  { id: "1", time: "10:42:18", source: "Engine", level: "info", message: "المحرك :3000 يعمل — 1680 حدثاً مسجلاً" },
  { id: "2", time: "10:42:21", source: "Factory", level: "success", message: "المعمل :5001 جاهز — باب أوامر الشغل fj_* يعمل" },
  { id: "3", time: "10:42:26", source: "Bridge", level: "success", message: "الجسر :8787 متصل — طبقة SSH الخفية نشطة" },
  { id: "4", time: "10:42:30", source: "nawat-doctor", level: "warning", message: "10 مواقع معطلة من أصل 304" },
  { id: "5", time: "10:42:35", source: "Train", level: "success", message: "القطار الليلي: r2 مسلّم — eval_loss 0.24" },
];

export function useStudioRuntime() {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState(mockAgents);
  const [events, setEvents] = useState(seedEvents);
  const [telemetry, setTelemetry] = useState<Telemetry>({ cpu: 38, ram: 61, gpu: 47, vram: 72 });

  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const connect = () => {
      try {
        socket = new WebSocket("ws://192.168.100.66:5001");
        socket.onopen = () => setConnected(true);
        socket.onclose = () => {
          setConnected(false);
          if (!cancelled) timer = setTimeout(connect, 5000);
        };
        socket.onerror = () => socket?.close();
        socket.onmessage = ({ data }) => {
          try {
            const payload = JSON.parse(String(data)) as {
              agents?: Agent[];
              event?: StudioEvent;
              telemetry?: Telemetry;
            };
            if (payload.agents) setAgents(payload.agents);
            if (payload.event)
              setEvents((current) => [payload.event as StudioEvent, ...current].slice(0, 120));
            if (payload.telemetry) setTelemetry(payload.telemetry);
          } catch {
            /* Ignore malformed local events. */
          }
        };
      } catch {
        setConnected(false);
      }
    };
    connect();
    const pulse = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setTelemetry((t) => ({
          cpu: Math.max(20, Math.min(82, t.cpu + Math.round(Math.random() * 10 - 5))),
          ram: Math.max(45, Math.min(78, t.ram + Math.round(Math.random() * 6 - 3))),
          gpu: Math.max(25, Math.min(90, t.gpu + Math.round(Math.random() * 12 - 6))),
          vram: Math.max(55, Math.min(88, t.vram + Math.round(Math.random() * 4 - 2))),
        }));
      }
    }, 2200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(pulse);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      const activated = getActivatedAgents();
      setAgents((current) => [
        ...current.filter((agent) => mockAgents.some((base) => base.id === agent.id)),
        ...activated,
      ]);
    };
    refresh();
    return subscribeWeeklyPlan(refresh);
  }, []);

  return useMemo(
    () => ({ connected, agents, events, telemetry }),
    [connected, agents, events, telemetry],
  );
}

export const toolConnections = [
  { name: "SSH", detail: "15 رمزاً · قائمة بيضاء + تدقيق B1001", state: "متصل", latency: "34 ms" },
  { name: "SFTP", detail: "مزامنة آمنة", state: "جاهز", latency: "—" },
  { name: "Monaco Editor", detail: "42 ملفًا", state: "نشط", latency: "محلي" },
  { name: "PowerShell", detail: "7.5", state: "جاهز", latency: "محلي" },
  { name: "File Watcher", detail: "Chokidar", state: "يراقب", latency: "8 ms" },
  { name: "ZIP Engine", detail: "adm-zip", state: "جاهز", latency: "محلي" },
];

export const bridgeTools = [
  { name: "echo", desc: "صدى نصي" },
  { name: "upper / lower", desc: "تحويل حالة الأحرف" },
  { name: "reverse", desc: "عكس النص" },
  { name: "hash", desc: "تجزئة تشفيرية" },
  { name: "b64 / unb64", desc: "ترميز Base64 وفكه" },
  { name: "uuid", desc: "توليد معرّفات فريدة" },
  { name: "json", desc: "تحقق وتنسيق JSON" },
  { name: "time / today", desc: "الوقت والتاريخ الحالي" },
  { name: "arabic", desc: "كشف اللغة العربية" },
  { name: "len / words", desc: "قياس الطول وعدد الكلمات" },
  { name: "sum / calc", desc: "حساب رياضي" },
  { name: "SSH", desc: "تنفيذ مقيد بقائمة بيضاء + تدقيق B1001 (F1010)" },
];

export const demoModels = [
  { name: "nawat-chat:latest", size: "4.7 GB", state: "running", vram: "4.2 GB" },
  { name: "nawat-coder:latest", size: "4.7 GB", state: "running", vram: "4.2 GB" },
  { name: "nawat-tri:1.5b-r2", size: "3.1 GB", state: "running", vram: "2.8 GB" },
  { name: "nawat-tri:1.5b-r1", size: "3.1 GB", state: "ready", vram: "—" },
  { name: "nawat-vision:latest", size: "3.3 GB", state: "ready", vram: "—" },
  { name: "nawat-vision", size: "3.3 GB", state: "ready", vram: "—" },
  { name: "nawat-embed:latest", size: "274 MB", state: "ready", vram: "—" },
  { name: "embed-text:latest", size: "274 MB", state: "ready", vram: "—" },
  { name: "nawat-whisper", size: "1.5 GB", state: "ready", vram: "—" },
];

export type NodeInfo = {
  id: string;
  label: string;
  role: string;
  host: string;
  status: "online" | "degraded" | "offline";
  models: string[];
  cpu: number;
  ram: number;
  gpu: number;
};

export const infraNodes: NodeInfo[] = [
  {
    id: "local",
    label: "الجهاز المحلي",
    role: "التطوير والتشغيل",
    host: "127.0.0.1:11434",
    status: "online",
    models: [
      "nawat-chat:latest",
      "nawat-coder:latest",
      "nawat-tri:1.5b-r2",
      "nawat-tri:1.5b-r1",
      "nawat-vision:latest",
      "nawat-embed:latest",
      "embed-text:latest",
      "nawat-whisper",
    ],
    cpu: 41,
    ram: 63,
    gpu: 52,
  },
  {
    id: "vps-66",
    label: "VPS (66)",
    role: "الإنتاج — CPU فقط",
    host: "192.168.100.66:11434",
    status: "online",
    models: ["nawat-chat:latest", "nawat-tri:1.5b-r2"],
    cpu: 58,
    ram: 71,
    gpu: 0,
  },
];

export const systemServices = [
  { name: "المحرك (Engine)", port: 3000, desc: "القلب — 1680 حدثاً" },
  { name: "المعمل (Factory)", port: 5001, desc: "باب استقبال أوامر الشغل fj_*" },
  { name: "الجسر (Bridge)", port: 8787, desc: "طبقة SSH الخفية الحقيقية" },
  { name: "الاستوديو (Studio)", port: 5174, desc: "واجهة NAWAT Studio" },
];

export const deployPipeline = [
  { step: "تقسيم 4.7GB إلى 10 أجزاء", detail: "10/10", done: true },
  { step: "رفع الأجزاء عبر SFTP", detail: "10/10", done: true },
  { step: "إعادة التجميع والتحقق SHA256", detail: "60e05f…", done: true },
  { step: "إصلاح ترميز Modelfile", detail: "UTF-16 → PS", done: true },
  { step: "ollama create", detail: "4.7 GB جاهز", done: true },
  { step: "اختبار حي للاستجابة", detail: "ناجح", done: true },
];

export const siteStats = { total: 304, online: 294, offline: 10, pending: 0 };
