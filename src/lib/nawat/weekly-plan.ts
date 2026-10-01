import type { Agent } from "./studio";
import { saveDevelopmentModel } from "./providers";

export type PlanState = "planned" | "ready" | "active";

export type ProposedModel = {
  id: string;
  name: string;
  role: string;
  reason: string;
  priority: 1 | 2 | 3;
  suggestedSize?: number;
};

export type ProposedAgent = {
  id: string;
  name: string;
  specialty: string;
  firstTask: string;
  model: string;
};

export type ProposedService = {
  id: string;
  name: string;
  purpose: string;
  endpoint?: string;
};

export const proposedModels: ProposedModel[] = [
  {
    id: "vision",
    name: "nawat-vision",
    role: "رؤية عربية خالصة",
    reason: "إضافة هوية نواة إلى محرك الرؤية المبني على moondream.",
    priority: 3,
  },
  {
    id: "embed",
    name: "nawat-embed",
    role: "تضمين عربي",
    reason: "ترقية البحث الدلالي في الذاكرة باستخدام nomic-embed-text مع ضبط عربي.",
    priority: 3,
  },
  {
    id: "tri-r2",
    name: "nawat-tri:1.5b-r2",
    role: "الجولة الثانية",
    reason: "بيانات أنظف وتصحيح حالات الهلوسة في r1.",
    priority: 2,
  },
  {
    id: "coder-q4",
    name: "nawat-coder:7b-q4",
    role: "برمجة مخففة للسيرفر",
    reason: "نسخة Q4 بحجم تقريبي 2.5GB ملائمة لخوادم CPU.",
    priority: 2,
    suggestedSize: 2_500_000_000,
  },
  {
    id: "whisper",
    name: "nawat-whisper",
    role: "صوت عربي إلى نص",
    reason: "تشغيل زر الميكروفون بمحرك Whisper صغير.",
    priority: 1,
  },
];

export const proposedAgents: ProposedAgent[] = [
  {
    id: "doctor",
    name: "nawat-doctor",
    specialty: "طبيب المواقع وتشخيص الأعطال",
    firstTask: "إعداد تقرير عن المواقع الـ28 المعطلة",
    model: "nawat-tri:1.5b-r1",
  },
  {
    id: "engineer",
    name: "nawat-engineer",
    specialty: "مراجعة مولدات الكود قبل التسليم",
    firstTask: "مراجعة greet_module",
    model: "nawat-coder:latest",
  },
  {
    id: "lawyer",
    name: "nawat-lawyer",
    specialty: "الامتثال للقائمة البيضاء",
    firstTask: "تدقيق أوامر SSH الأخيرة",
    model: "nawat-tri:1.5b-r1",
  },
  {
    id: "librarian",
    name: "nawat-librarian",
    specialty: "تنظيم المكونات وفهرستها",
    firstTask: "فهرسة تحليلات TVCC",
    model: "nawat-chat:latest",
  },
  {
    id: "trainer",
    name: "nawat-trainer",
    specialty: "تجهيز دفعات التدريب وتقييمها",
    firstTask: "أتمتة review-20 القادمة",
    model: "nawat-coder:latest",
  },
];

export const proposedServices: ProposedService[] = [
  {
    id: "teams",
    name: "فرق الوكلاء الجاهزة",
    purpose: "فريق فحص وفريق بناء بدل التجميع اليدوي.",
    endpoint: "/api/agents/teams",
  },
  {
    id: "library-search",
    name: "بحث المكتبة",
    purpose: "البحث في المكتبة من أي واجهة.",
    endpoint: "/api/library/search",
  },
  {
    id: "start-all",
    name: "تشغيل الخادم دفعة واحدة",
    purpose: "إقلاع خدمات VPS بأمر واحد مثل الجهاز المحلي.",
  },
];

const STATE_KEY = "nawat.weeklyPlanStates.v1";
const CHANGE_EVENT = "nawat:weekly-plan-changed";

export function getPlanStates(): Record<string, PlanState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}") as Record<string, PlanState>;
  } catch {
    return {};
  }
}

export function setPlanState(id: string, state: PlanState) {
  const next = { ...getPlanStates(), [id]: state };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeWeeklyPlan(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function activateModel(model: ProposedModel) {
  saveDevelopmentModel({
    name: model.name,
    size: model.suggestedSize ?? 0,
    digest: "pending-build",
    modifiedAt: new Date().toISOString(),
  });
  setPlanState(`model:${model.id}`, "active");
}

export function getActivatedAgents(): Agent[] {
  const states = getPlanStates();
  return proposedAgents
    .filter((agent) => states[`agent:${agent.id}`] === "active")
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.specialty,
      model: agent.model,
      state: "idle",
      progress: 0,
      task: agent.firstTask,
      memory: 0,
    }));
}
