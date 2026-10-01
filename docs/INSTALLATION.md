# INSTALLATION — NAWAT Studio

## 1. Prérequis

| Outil       | Version    | Rôle                                        |
| ----------- | ---------- | ------------------------------------------- |
| Node.js     | ≥ 20 LTS   | interface web, build Electron               |
| npm         | ≥ 10       | gestion des paquets                         |
| Ollama      | ≥ 0.3      | modèles locaux (`nawat-*`)                  |
| Python      | ≥ 3.10     | optionnel : agents et serveurs compagnons   |
| Git         | récent     | optionnel : récupérer les mises à jour      |

## 2. Windows

```powershell
# 1) Installer Node.js et Ollama
winget install OpenJS.NodeJS.LTS
winget install Ollama.Ollama

# 2) Extraire l'archive nawat-studio-v1.0.0.zip
Expand-Archive .\nawat-studio-v1.0.0.zip -DestinationPath C:\NAWAT

# 3) Installer et démarrer
cd C:\NAWAT\nawat-studio
npm install
npm run dev        # http://localhost:8080
```

Version installeur : double-cliquez sur `NAWAT Studio Setup 1.0.0.exe`,
choisissez le dossier d'installation, les raccourcis sont créés automatiquement.

## 3. macOS

```bash
brew install node ollama
unzip nawat-studio-v1.0.0.zip -d ~/NAWAT
cd ~/NAWAT/nawat-studio && npm install && npm run dev
```

Version `.dmg` : ouvrez l'image, glissez **NAWAT Studio** dans Applications.
Au premier lancement : clic droit → Ouvrir (application non signée).

## 4. Linux

```bash
sudo apt install -y nodejs npm
curl -fsSL https://ollama.com/install.sh | sh
unzip nawat-studio-v1.0.0.zip -d ~/NAWAT
cd ~/NAWAT/nawat-studio && npm install && npm run dev
```

AppImage : `chmod +x "NAWAT Studio-1.0.0.AppImage" && ./NAWAT\ Studio-1.0.0.AppImage`

## 5. Modèles Ollama

```bash
ollama serve
ollama pull qwen2.5-coder:1.5b
ollama cp qwen2.5-coder:1.5b nawat-coder:latest
```

L'interface n'affiche que les modèles dont le nom commence par le préfixe
configuré (`nawat` par défaut, modifiable dans **الإعدادات**).

## 6. Vérification

1. `http://localhost:8080` s'ouvre sur l'espace de travail.
2. La barre d'état affiche « X nawat models » (> 0 si Ollama tourne).
3. Le voyant WebSocket est vert si le compagnon local (port 5001) tourne — rouge sinon,
   l'application reste utilisable en mode hors-ligne.

## 7. Problèmes courants

| Symptôme                              | Cause / solution                                                |
| ------------------------------------- | --------------------------------------------------------------- |
| « لا يمكن الوصول إلى Ollama »         | `ollama serve` n'est pas lancé, ou hôte erroné dans Réglages.     |
| Aucun modèle listé                    | Le préfixe des modèles ne correspond pas — changez-le.            |
| Voyant WebSocket rouge                | Le serveur compagnon `ws://localhost:5001` n'existe pas encore.   |
| Fenêtre Electron blanche              | `base: './'` manquant dans `vite.config.ts` avant `npm run build`. |
| Port 8080 occupé                      | `npm run dev -- --port 8090`.                                     |
