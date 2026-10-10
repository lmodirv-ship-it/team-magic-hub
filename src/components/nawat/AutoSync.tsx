import { useEffect } from "react";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";
import { loadSyncPeers } from "@/components/nawat/SyncPeersSettings";
import { saveToServer } from "@/lib/nawat/server-config-sync";

// Silent background sync: no popups, failures are ignored (bridge is optional).
export const AUTO_SYNC_KEY = "nawat.sync.auto.v1";
const EVERY_MS = 3 * 60 * 1000;

export function AutoSync() {
  useEffect(() => {
    const run = async () => {
      if (localStorage.getItem(AUTO_SYNC_KEY) === "off") return;
      try { await saveToServer(); } catch { /* optional */ }
      try { await callConfiguredBridge("sync", { action: "status", peers: loadSyncPeers() }); } catch { /* optional */ }
      localStorage.setItem(AUTO_SYNC_KEY + ".last", new Date().toISOString());
    };
    const first = setTimeout(run, 15000);
    const t = setInterval(run, EVERY_MS);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  return null;
}
