import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "./bridge";

export type ConversationThread = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  messages: ChatMessage[];
};
const KEY = "nawat.threads.v1";

export function readThreads(): ConversationThread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ConversationThread[];
  } catch {
    return [];
  }
}

export function createThread(model = "nawat-chat:latest"): ConversationThread {
  return {
    id: crypto.randomUUID(),
    title: "محادثة جديدة",
    model,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function useThreads() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  useEffect(() => { setThreads(readThreads()); }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(threads));
  }, [threads]);
  const save = useCallback(
    (thread: ConversationThread) =>
      setThreads((all) => [thread, ...all.filter((item) => item.id !== thread.id)]),
    [],
  );
  const remove = useCallback(
    (id: string) =>
      setThreads((all) => {
        const next = all.filter((item) => item.id !== id);
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }),
    [],
  );
  return { threads, save, remove };
}
