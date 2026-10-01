import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared live connection: local WebSocket on LAN pages, with same-origin
 * statistics polling on secure/public pages where browsers block ws://.
 */

export const LIVE_WS_URL = "ws://192.168.100.66:5001";

export type NotificationKind = "info" | "success" | "error" | "task";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  at: number;
  read: boolean;
  path?: string;
};

type LiveCtx = {
  connected: boolean;
  lastStats: unknown;
  lastEventAt: number | null;
  notifications: AppNotification[];
  unread: number;
  notify: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const globalScope = globalThis as unknown as { __nawatLiveCtx?: React.Context<LiveCtx | null> };
const LiveContext = (globalScope.__nawatLiveCtx ??= createContext<LiveCtx | null>(null));

const NOTIF_KEY = "nawat.notifications.v1";
const MAX_NOTIFICATIONS = 50;

function readStored(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function eventTitle(type: string, payload: Record<string, unknown>): string {
  const name = typeof payload["name"] === "string" ? payload["name"] : undefined;
  const model = typeof payload["model"] === "string" ? payload["model"] : undefined;
  const label = name ?? model ?? "مهمة";
  if (type === "task.started") return `بدأت المهمة: ${label}`;
  if (type === "task.finished") return `انتهت المهمة: ${label}`;
  return `${type}: ${label}`;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastStats, setLastStats] = useState<unknown>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    setNotifications(readStored());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications.slice(0, 20)));
    } catch {
      // Storage can be full or disabled; notifications stay in memory.
    }
  }, [notifications]);

  const notify = useCallback<LiveCtx["notify"]>((n) => {
    setNotifications((list) =>
      [
        {
          ...n,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
          read: false,
        },
        ...list,
      ].slice(0, MAX_NOTIFICATIONS),
    );
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnect: number | undefined;
    let poll: number | undefined;
    let cancelled = false;

    const usePolling = window.location.protocol === "https:";
    const pollStats = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) throw new Error("Live statistics unavailable");
        const payload: unknown = await response.json();
        if (cancelled) return;
        setLastStats(payload);
        setLastEventAt(Date.now());
        setConnected(true);
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    const startPolling = () => {
      if (poll || cancelled) return;
      void pollStats();
      poll = window.setInterval(() => { void pollStats(); }, 5000);
    };

    const connect = () => {
      if (usePolling) {
        startPolling();
        return;
      }
      try {
        socket = new WebSocket(LIVE_WS_URL);
        socket.onopen = () => setConnected(true);
        socket.onmessage = (event) => {
          setLastEventAt(Date.now());
          try {
            const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
            const type = typeof payload["type"] === "string" ? payload["type"] : "";
            if (type === "stats.update") {
              setLastStats(payload);
              return;
            }
            if (type === "task.started" || type === "task.finished") {
              notify({
                kind: type === "task.finished" ? "success" : "task",
                title: eventTitle(type, payload),
                detail: typeof payload["detail"] === "string" ? payload["detail"] : "",
              });
            }
          } catch {
            // Ignore malformed frames from third-party clients.
          }
        };
        socket.onclose = () => {
          setConnected(false);
          startPolling();
          if (!cancelled) reconnect = window.setTimeout(connect, 5000);
        };
        socket.onerror = () => socket?.close();
      } catch {
        setConnected(false);
        if (!cancelled) reconnect = window.setTimeout(connect, 5000);
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnect) window.clearTimeout(reconnect);
      if (poll) window.clearInterval(poll);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [notify]);

  const value = useMemo<LiveCtx>(
    () => ({
      connected,
      lastStats,
      lastEventAt,
      notifications,
      unread: notifications.filter((n) => !n.read).length,
      notify,
      markRead: (id) =>
        setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllRead: () => setNotifications((list) => list.map((n) => ({ ...n, read: true }))),
      clearAll: () => setNotifications([]),
    }),
    [connected, lastEventAt, lastStats, notifications, notify],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveCtx {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside LiveProvider");
  return ctx;
}
