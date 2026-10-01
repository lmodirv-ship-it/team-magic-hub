# USAGE — Utiliser NAWAT Studio

## Premiers pas

1. Lancez Ollama (`ollama serve`) puis NAWAT Studio.
2. Ouvrez **الإعدادات** : vérifiez l'hôte Ollama et le préfixe des modèles.
3. Choisissez un style dans la galerie (NAWAT officiel par défaut).

## L'interface

| Zone                 | Rôle                                                              |
| -------------------- | ----------------------------------------------------------------- |
| Barre d'activité     | navigation entre les pages (espace de travail, atelier, résultats…) |
| En-tête              | logo, recherche Ctrl+K, statistiques temps réel, notifications, thème |
| Explorateur          | racines `my-app/`, `bibliotheque/`, `vision_output/`, `agents/`, `models/`, `logs/` |
| Éditeur / Aperçu     | édition Monaco + aperçu intelligent (HTML, MD, JSON, code, images, PDF, log, ZIP) |
| NAWAT Chat           | conversation avec un modèle, envoi vocal et lecture vocale des réponses |
| Barre d'état         | modèles chargés, VRAM, état WebSocket, mode navigateur ou desktop  |

## Chat avec les modèles

- Sélectionnez le modèle dans l'en-tête du chat.
- `Entrée` envoie, `Maj+Entrée` retourne à la ligne.
- 📎 **Attach open file** ajoute le fichier ouvert au prompt.
- **Save output to file** enregistre la dernière réponse dans un fichier.
- 🎤 dicte un message, 🔊 active la lecture vocale de la réponse.

## Analyse et atelier multi-modèles

1. Page **الورشة** (`/atelier`) : cochez plusieurs modèles.
2. Écrivez un seul prompt, lancez : tous les modèles répondent en parallèle,
   chacun avec son chronomètre dans une grille adaptative.
3. Chaque réponse est enregistrée automatiquement dans
   `bibliotheque/<date>-<modele>.md`.

## Bibliothèque et résultats

Page **النتائج** (`/resultats`) : recherche instantanée, filtres par modèle,
type et période (24 h / 7 j / 30 j), aperçu, comparaison côte à côte de 2 à 4
fichiers, export ZIP, téléchargement et suppression.

## Agents

Page **الوكلاء** : scripts Python du dossier `agents/`, lancement de mission avec
choix du modèle et suivi en direct.

## Modèles

Page **النماذج** : démarrer / arrêter un modèle Ollama, consommation VRAM,
informations détaillées.

## Raccourcis clavier

| Raccourci      | Action                          |
| -------------- | ------------------------------- |
| `Ctrl` + `K`   | recherche globale               |
| `Ctrl` + `S`   | sauvegarder le fichier ouvert   |
| `Ctrl` + `N`   | nouveau fichier                 |
| `Échap`        | fermer les fenêtres modales     |

## Données

Tout est stocké localement (navigateur ou disque en version desktop) :
conversations, espace de travail, registre de gestion, thème, réglages voix.
Rien n'est envoyé vers un serveur externe.
