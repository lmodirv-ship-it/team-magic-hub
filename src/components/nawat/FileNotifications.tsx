import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/nawat/workspace";
import { downloadText } from "@/lib/nawat/zip";
import { useLive } from "@/lib/nawat/live";

/** Shows a toast with [Voir] / [Télécharger] whenever a new file appears. */
const LOG_PATH = "logs/fichiers.log";

export function FileNotifications() {
  const { onFileCreated, openFile, vfs, writeFile } = useWorkspace();
  const { notify } = useLive();
  const vfsRef = useRef(vfs);
  vfsRef.current = vfs;

  useEffect(
    () =>
      onFileCreated(({ path, meta }) => {
        if (path.endsWith("/.keep") || path.startsWith("logs/")) return;

        const line = `${new Date().toISOString()}\t${meta.source ?? "manuel"}\t${
          meta.model ?? "-"
        }\t${path}`;
        writeFile(LOG_PATH, `${vfsRef.current[LOG_PATH] ?? ""}${line}\n`);

        notify({ kind: "info", title: `ملف جديد: ${path}`, detail: meta.model ?? "", path });
        toast(`ملف جديد: ${path}`, {
          description: new Date().toLocaleTimeString("fr-FR"),
          action: {
            label: "عرض",
            onClick: () => openFile(path),
          },
          cancel: {
            label: "تنزيل",
            onClick: () => downloadText(path, vfsRef.current[path] ?? ""),
          },
          duration: 8000,
        });
      }),
    [notify, onFileCreated, openFile, writeFile],
  );

  return null;
}
