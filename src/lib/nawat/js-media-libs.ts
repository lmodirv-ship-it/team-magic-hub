// Embedded JavaScript / Node.js library packs (npm), incl. FFmpeg media tools. Shared by workspace templates and DevTools.
export type JsPack = { id: string; label: string; pkgs: string[] };

export const JS_PACKS: JsPack[] = [
  { id: "media", label: "FFmpeg / Médias", pkgs: ["fluent-ffmpeg", "ffmpeg-static", "ffprobe-static", "sharp", "music-metadata"] },
  { id: "server", label: "Express / Upload", pkgs: ["express", "cors", "dotenv", "multer", "ws", "axios"] },
  { id: "browser", label: "FFmpeg navigateur (WASM)", pkgs: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
  { id: "ai", label: "IA locale (Ollama)", pkgs: ["ollama"] },
];

export const JS_ALL = Array.from(new Set(JS_PACKS.flatMap((p) => p.pkgs)));

export const packageJson = (name: string, pkgs: string[] = JS_ALL, main = "index.js") =>
  JSON.stringify({ name, version: "0.1.0", type: "module", main, scripts: { start: `node ${main}` }, dependencies: Object.fromEntries(pkgs.map((p) => [p, "latest"])) }, null, 2) + "\n";

export const FFMPEG_HELPER = `import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const run = (cmd) => new Promise((ok, ko) => cmd.on("end", ok).on("error", ko).run());

export const convert = (input, output) => run(ffmpeg(input).output(output));
export const extractAudio = (input, output = "audio.mp3") => run(ffmpeg(input).noVideo().audioCodec("libmp3lame").output(output));
export const toWav16k = (input, output = "audio.wav") => run(ffmpeg(input).noVideo().audioChannels(1).audioFrequency(16000).output(output));
export const toGif = (input, output = "out.gif", start = 0, duration = 5) => run(ffmpeg(input).setStartTime(start).duration(duration).outputOptions(["-vf", "fps=10,scale=480:-1"]).output(output));
export const cut = (input, output, start, duration) => run(ffmpeg(input).setStartTime(start).duration(duration).outputOptions("-c copy").output(output));
export const thumbnail = (input, folder = ".", filename = "thumb.png") => new Promise((ok, ko) => ffmpeg(input).on("end", ok).on("error", ko).screenshots({ count: 1, folder, filename }));
export const probe = (input) => new Promise((ok, ko) => ffmpeg.ffprobe(input, (e, d) => (e ? ko(e) : ok(d))));
`;

export const FFMPEG_CLI = `import { convert, extractAudio, toGif, thumbnail, probe } from "./media.js";

const [cmd, input, output] = process.argv.slice(2);
const map = { convert: () => convert(input, output), audio: () => extractAudio(input, output), gif: () => toGif(input, output), thumb: () => thumbnail(input), probe: async () => console.log(JSON.stringify(await probe(input), null, 2)) };
if (!map[cmd]) { console.log("usage: node converter.js <convert|audio|gif|thumb|probe> input [output]"); process.exit(0); }
await map[cmd]();
console.log("done");
`;

export const MEDIA_SERVER = `import express from "express";
import cors from "cors";
import multer from "multer";
import { extractAudio, convert } from "./media.js";

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

app.post("/api/audio", upload.single("file"), async (req, res) => {
  const out = req.file.path + ".mp3";
  try { await extractAudio(req.file.path, out); res.download(out); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post("/api/convert", upload.single("file"), async (req, res) => {
  const out = req.file.path + "." + (req.query.to || "mp4");
  try { await convert(req.file.path, out); res.download(out); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.listen(3000, () => console.log("media API on http://localhost:3000"));
`;

export const MEDIA_AI = `import ollama from "ollama";
import { toWav16k, thumbnail } from "./media.js";

const input = process.argv[2] || "video.mp4";
await toWav16k(input, "audio.wav");
await thumbnail(input, ".", "thumb.png");
const r = await ollama.chat({ model: "nawat-coder:latest", messages: [{ role: "user", content: "Résume ce que contient une vidéo nommée " + input }] });
console.log(r.message.content);
console.log("audio.wav prêt pour nawat-audio (transcription locale)");
`;
