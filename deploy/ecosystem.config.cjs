module.exports = { apps: [
  { name: "nawat-web", script: "bun", args: "run preview --host 0.0.0.0 --port 3000", cwd: __dirname + "/.." },
  { name: "nawat-bridge", script: "bridge/server.mjs", cwd: __dirname + "/..", node_args: "--env-file=.env" },
  { name: "nawat-cloud-agent", script: "bridge/cloud-agent.mjs", cwd: __dirname + "/..", node_args: "--env-file=.env" },
]};
