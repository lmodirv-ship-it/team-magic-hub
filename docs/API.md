# API — NAWAT Studio

Deux surfaces : l'API interne de l'application et l'API Ollama locale.

## 1. Authentification

- **Ollama local** : aucune authentification (`http://127.0.0.1:11434`).
- **Serveur compagnon** (port 5001, optionnel) : clé d'API à générer côté serveur,
  envoyée dans l'en-tête `Authorization: Bearer <clé>`.
- **Fournisseurs distants** (page المزوّدون) : clé stockée localement et envoyée
  en `Authorization: Bearer` vers l'URL configurée.

## 2. Endpoints de l'application

### `GET /api/stats`

```json
{
  "type": "stats.update",
  "activeModels": 3,
  "filesGenerated": 47,
  "filesFixed": 12,
  "analysesDone": 9,
  "history": { "activeModels": [1, 2, 2, 3, 3, 3, 3, 3, 3, 3] },
  "trends": { "activeModels": "+12%" }
}
```

Interrogé au chargement puis toutes les 5 secondes. Si le serveur compagnon est
absent, l'application calcule les valeurs localement.

### WebSocket `ws://localhost:5001`

Messages attendus :

| Type            | Charge utile                                                      |
| --------------- | ----------------------------------------------------------------- |
| `stats.update`  | `{activeModels, filesGenerated, filesFixed, analysesDone, history, trends}` |
| `task.started`  | `{name, model}`                                                   |
| `task.finished` | `{name, model, durationMs}`                                       |

Reconnexion automatique toutes les 5 secondes, voyant vert/rouge dans l'en-tête
et la barre d'état.

## 3. Endpoints Ollama utilisés

| Méthode | Chemin          | Usage                                  |
| ------- | --------------- | -------------------------------------- |
| GET     | `/api/tags`     | liste des modèles                      |
| GET     | `/api/ps`       | modèles chargés en mémoire + VRAM      |
| POST    | `/api/show`     | détails d'un modèle                    |
| POST    | `/api/generate` | charger (`keep_alive: "30m"`) / décharger (`keep_alive: 0`) |
| POST    | `/api/chat`     | conversation en flux (`stream: true`)  |

## 4. Exemples

```bash
curl http://localhost:8080/api/stats
curl http://127.0.0.1:11434/api/tags
curl -X POST http://127.0.0.1:11434/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"nawat-chat:latest","messages":[{"role":"user","content":"مرحبا"}],"stream":true}'
```

```python
import requests
r = requests.post("http://127.0.0.1:11434/api/chat", json={
    "model": "nawat-coder:latest",
    "messages": [{"role": "user", "content": "Écris un script Python"}],
    "stream": False,
})
print(r.json()["message"]["content"])
```

```js
const res = await fetch("http://127.0.0.1:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ model: "nawat-chat:latest", messages, stream: true }),
});
const reader = res.body.getReader(); // flux NDJSON
```

## 5. Limites et webhooks

- Ollama traite les requêtes séquentiellement par modèle : l'atelier lance
  plusieurs modèles en parallèle, la VRAM est le facteur limitant.
- Aucun rate limit côté application ; à mettre en place dans le serveur compagnon.
- Webhooks : à implémenter dans le serveur compagnon et diffuser vers l'interface
  sous forme d'événements `task.*` sur le WebSocket.
