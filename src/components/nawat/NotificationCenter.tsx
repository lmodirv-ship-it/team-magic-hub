import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useLive, type AppNotification } from "@/lib/nawat/live";

const kindColor: Record<AppNotification["kind"], string> = {
  info: "bg-nawat",
  success: "bg-success",
  error: "bg-destructive",
  task: "bg-warning",
};

export function NotificationCenter() {
  const { notifications, unread, markRead, markAllRead, clearAll } = useLive();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="مركز الإشعارات"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-destructive px-1 text-[9px] leading-4 font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          <strong className="text-xs">الإشعارات</strong>
          <span className="text-[10px] text-muted-foreground">({notifications.length})</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={markAllRead}>
            <CheckCheck className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={clearAll}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد إشعارات</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-start hover:bg-accent/60 ${
                n.read ? "opacity-60" : ""
              }`}
            >
              <span className={`mt-1 size-2 shrink-0 rounded-full ${kindColor[n.kind]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-foreground">{n.title}</span>
                {n.detail && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {n.detail}
                  </span>
                )}
                <span className="block text-[10px] text-muted-foreground">
                  {new Date(n.at).toLocaleTimeString("fr-FR")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
