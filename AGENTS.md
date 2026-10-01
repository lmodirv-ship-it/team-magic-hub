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
- App data tables (roles, pages, permissions, app_store, api_keys, usage_events) are reached only via server functions in src/lib/nawat/db.functions.ts using the admin client — dev mode has no sign-in, so tables have RLS on with no client policies.
