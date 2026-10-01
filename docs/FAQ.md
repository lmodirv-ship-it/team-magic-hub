# FAQ — NAWAT Studio

**NAWAT Studio a-t-il besoin d'Internet ?**
Non pour l'interface : elle tourne en local avec Ollama. Internet n'est nécessaire
que pour télécharger des modèles ou utiliser un fournisseur distant.

**« لا يمكن الوصول إلى Ollama » s'affiche.**
Lancez `ollama serve`, puis vérifiez l'hôte dans **الإعدادات**
(par défaut `http://127.0.0.1:11434`).

**Aucun modèle n'apparaît alors qu'Ollama tourne.**
Seuls les modèles dont le nom commence par le préfixe configuré (`nawat`) sont
affichés. Changez le préfixe ou renommez le modèle :
`ollama cp mistral:latest nawat-chat:latest`.

**Le voyant WebSocket est rouge.**
Le serveur compagnon `ws://localhost:5001` n'est pas lancé. L'application
fonctionne quand même : les statistiques sont calculées localement.

**La fenêtre Electron est blanche.**
`base: './'` doit être présent dans `vite.config.ts` **avant** `npm run build`,
puis recopiez `dist/` dans `renderer/`.

**Windows affiche « Éditeur inconnu » à l'installation.**
L'exécutable n'est pas signé. Cliquez « Informations complémentaires → Exécuter
quand même », ou signez l'application (voir `docs/BUILD.md`).

**Où sont stockées mes données ?**
Dans le navigateur (localStorage) en version web, et sur le disque en version
desktop. Sauvegarde : exportez la bibliothèque en ZIP depuis la page Résultats.

**Comment mettre à jour ?**
Version web/PWA : rechargez la page. Version desktop : réinstallez le nouvel
`.exe`. Version ZIP : remplacez les fichiers en conservant `bibliotheque/`.

**La dictée vocale ne marche pas.**
La reconnaissance vocale du navigateur requiert Chrome/Edge et une autorisation
micro ; Firefox ne la prend pas en charge.

**Puis-je l'utiliser sur téléphone ?**
Oui : installez la PWA (voir `docs/MOBILE.md`). Le téléphone doit pouvoir joindre
la machine qui héberge Ollama.

**Support**
Groupe-HN — Mouylay Ismail El Hassani.
