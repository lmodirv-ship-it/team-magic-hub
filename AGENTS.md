<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Load Monaco and its workers client-side from the installed package, not a CDN, so workspace editing remains local and SSR avoids browser-only CSS imports.
- Keep browser workspace persistence explicitly distinct from desktop filesystem writes; browser storage cannot guarantee atomic disk writes or unlimited recovery.
- Render the workspace terminal with local xterm.js and route browser commands only through the bridge's documented SSH exec endpoint; do not present one-shot HTTP execution as a persistent PTY session.
- Cloud relay: phone/site submit jobs to /api/public/relay; bridge/cloud-agent.mjs on the LAN server pulls them outbound — no inbound ports or tunnels needed.
- Bridge connection settings use the versioned shared profile in bridge-config.ts; relay secrets remain in device-only storage and are excluded from exports.
- Live status uses LAN WebSocket only on non-secure local pages and same-origin polling on HTTPS, because browsers block insecure WebSocket from secure pages.
- App data tables (roles, pages, permissions, app_store, api_keys, usage_events) are reached only via server functions in src/lib/nawat/db.functions.ts using the admin client — dev mode has no sign-in, so tables have RLS on with no client policies.
- Public bridges are a list in the bridge config (active first, others as fallback); bridges marked serverKey keep their password in a server secret and are called only through relay.functions.ts.
- Desktop exe is a thin Electron wrapper (desktop/main.cjs) that loads the server URL then the official URL — so published changes reach it without rebuilding.
- Server status comes from the bridge's read-only /api/system (relay kind "system"); the UI falls back to the last recorded report when the bridge is unreachable.
- Model factory UI lives at /factory and talks directly to the LAN factory_server.py (port 8789, URL saved per device); server scripts live in deploy/factory. Why: training runs on the LAN GPU server, not in the cloud.
- CLI and MCP server live in cli/ and share cli/lib.mjs; dependency-free Node so they run on Windows and the LAN server without installs. MCP uses stdio JSON-RPC.
- Server projects live one folder per project under the bridge's PROJECTS_DIR and are reached only through the bridge "projects" kind (list/create/tree/read/write, path-confined). Why: isolates each project and works over LAN or relay.
- Copy sync uses the bridge "sync" kind against SYNC_PEERS; the extension merge engine in /sync merges exported nawat.* settings additively and never exports secrets. Why: "add, never remove".
- Speed Build executes only the model explicitly selected by the user, with no automatic model or cloud fallback. Why: preserve local-model sovereignty and predictable execution.
- Groupe-HN CLI commands live in cli/groupe-hn.mjs (callable as `groupe-hn` or `nawat ghn`) and share cli/lib.mjs; guide data for /groupe-hn lives in src/lib/nawat/groupe-hn-docs.ts. Why: one source for CLI, MCP and docs.
