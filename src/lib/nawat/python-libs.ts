// Embedded Python library packs (pip). Shared by workspace templates, orchestrator and DevTools.
export type PyPack = { id: string; label: string; pkgs: string[] };

export const PY_PACKS: PyPack[] = [
  { id: "web", label: "Web / API (FastAPI · Flask)", pkgs: ["fastapi", "uvicorn[standard]", "flask", "flask-cors", "requests", "httpx", "pydantic", "python-dotenv"] },
  { id: "ai", label: "IA / Données (NumPy · Pandas · Ollama)", pkgs: ["numpy", "pandas", "matplotlib", "scikit-learn", "ollama", "jupyter", "ipykernel"] },
  { id: "auto", label: "Automatisation (Requests · Scrapy)", pkgs: ["requests", "beautifulsoup4", "lxml", "scrapy", "schedule", "rich"] },
];

export const PY_ALL = Array.from(new Set(PY_PACKS.flatMap((p) => p.pkgs)));

export const requirementsTxt = (pkgs: string[] = PY_ALL) => pkgs.join("\n") + "\n";

export const pyprojectToml = (name: string, pkgs: string[] = PY_ALL) =>
  `[project]\nname = "${name}"\nversion = "0.1.0"\nrequires-python = ">=3.10"\ndependencies = [\n${pkgs.map((p) => `  "${p}",`).join("\n")}\n]\n`;

export const pipfile = (pkgs: string[] = PY_ALL) =>
  `[[source]]\nurl = "https://pypi.org/simple"\nverify_ssl = true\nname = "pypi"\n\n[packages]\n${pkgs.map((p) => `"${p.replace(/\[.*\]/, "")}" = "*"`).join("\n")}\n\n[requires]\npython_version = "3"\n`;

export const notebook = (title: string) =>
  JSON.stringify({ cells: [{ cell_type: "markdown", metadata: {}, source: [`# ${title}`] }, { cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: ["import pandas as pd\n", "import numpy as np\n", "df = pd.DataFrame(np.random.rand(5, 3), columns=list('abc'))\n", "df"] }], metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" } }, nbformat: 4, nbformat_minor: 5 }, null, 1);
