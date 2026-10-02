# Updates from the server 192.168.100.67 inspection report

Everything below is added on top of what already exists. No current setting or field gets removed.

## What the report found
- The server is healthy: i5-4590, about 18 GiB RAM, Supabase working, NAWAT 1.1.0 running under PM2, starts automatically after a reboot.
- Chat runs through Ollama on 192.168.2.4. qwen3.5:9b works in about 20 seconds.
- The local model qwen3:4b gets stuck in long thinking and hits the generation limit.
- ComfyUI on port 8188 isn't available, so image generation is down.
- There are two disks: a 128 GB system SSD (`/`) and a 500 GB HDD for data (`/data`, 422 GiB free). The `/data/model` folder exists and is empty. The model files from G:\model total 91 GiB.
- The system wants a reboot. SMART isn't installed.

## Additions
1. **Chat model settings**
   - Add Ollama 192.168.2.4:11434 as a source next to the local Ollama.
   - Add a "disable thinking" option (`think:false` + a token limit) for Qwen3 models, so qwen3:4b gives short answers.
2. **ComfyUI status**
   - Show a clear "ComfyUI not available" notice in the image page and the coordinator, with a "retest" button, instead of a silent failure.
   - Add a field to change the ComfyUI address (keeping 192.168.2.4:8188 as the default).
3. **"Server status" card** on the ports page, with the data from the report:
   - NAWAT version, PM2 status, and Supabase status.
   - The two disks with their used and free space.
   - A "reboot required" warning and a "SMART not installed" warning.
   - Data comes from the bridge when it's reachable, and the report's numbers show otherwise.
4. **Model storage**
   - Add a "model storage path" setting, default `/data/model` on the data disk, next to the existing `/data/models`.
   - Add a section in the deploy guide on uploading G:\model to `/data/model` with SFTP or rsync, with the required space check (91 GiB of 422 GiB).
5. **Deploy guide**
   - Add steps: install `smartmontools`, schedule the reboot, and restart ComfyUI.

6. **Track a request all the way to building the site (the coordinator)**
   - Visible stages: choose modules, then structure questions with no fixed limit, then approve the structure, then create files inside the project (p000x), then run the preview, then show the site in the preview panel.
   - A stage tracker inside the coordinator panel, with a status per stage (waiting, working, done, failed) and the time taken.
   - Spread the work across several models: a fast model for structure and questions, a stronger model for the code, ComfyUI for images, with an automatic fallback to qwen3.5:9b.
   - Focus on production speed: run independent stages in parallel, and keep responses short (thinking off).
7. **Desktop versions (exe + PWA)**
   - PWA: install the app from the browser on the computer and the phone, with an "update available" notice when a new version comes out.
   - exe for Windows: a light wrapper (Electron) that opens the server address or the official address. Auto-update pulls the latest version from GitHub Releases, so every change made here shows up automatically.
   - A download button for "NAWAT Desktop (exe)" on the ports page, next to the APK versions, which stay in place.
8. **Model file transfer**
   - A transfer-status display (GB moved and percentage) from the bridge, plus a note on network speed: the switch port is limited to 100 Mbps, so moving the cable to a Gigabit port is the fix.

## Limit
- I can't reach 192.168.100.67 from here. Changes reach the server through the existing sync: GitHub, then "Update server now", or the automatic check every 5 minutes.

## Technical details
- `bridge-config.ts`: new fields (`ollamaHosts[]`, `comfyUrl`, `modelStoragePath`, `qwenNoThink`) with versioned defaults, without deleting old fields.
- `providers.ts`: pass `think:false`/`num_predict` when the option is on.
- `bridge/server.mjs`: add a read-only `/system` endpoint (df, free, pm2 jlist, reboot-required, smartctl if present).
- New component `ServerStatusCard.tsx` on the ports page.
- Update `deploy/README-AR.md`.
