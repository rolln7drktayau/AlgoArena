# Lancer AlgoArena depuis GitHub

## Pourquoi la demo prof ne marche pas encore

Actuellement, les changements V2 sont sur ta machine, branche `develop/v2`, mais ils ne sont pas encore sur GitHub tant que tu n'as pas fait `commit` puis `push`.

Etat attendu pour que GitHub puisse servir quelque chose :

- `develop/v2` doit etre pousse sur GitHub.
- GitHub Pages doit etre active.
- Pour la demo prof Render, une branche `web/prof-demo` doit exister sur GitHub.

## Option A - Demo immediate GitHub Pages

Cette version est la demo sans serveur dans `docs/`.

Elle sert a partager un lien rapidement avec un prof ou jury.

Limites :

- pas de backend FastAPI ;
- pas de WebSocket ;
- pas de gros calcul pymoo ;
- pas d'upload Python ;
- tout tourne dans le navigateur.

### Commandes a lancer en local

```powershell
git switch develop/v2
git add .
git commit -m "feat: add AlgoArena V2 labs and web demo"
git push -u origin develop/v2
```

### Sur GitHub

1. Va sur le repo GitHub.
2. Clique `Settings`.
3. Clique `Pages`.
4. Dans `Build and deployment`, choisis `GitHub Actions`.
5. Va dans l'onglet `Actions`.
6. Lance ou attends le workflow `Deploy GitHub Pages Demo`.
7. Quand il est vert, l'URL apparait dans le resume du workflow.

Le workflow deploye le dossier :

```text
docs/
```

## Option B - Demo prof complete avec backend sur Render

Cette version utilise :

- Dockerfile ;
- FastAPI ;
- frontend build ;
- WebSockets ;
- pymoo cote serveur.

Elle est plus proche de l'app complete.

### Creer et pousser la branche prof

Depuis `develop/v2` :

```powershell
git switch develop/v2
git switch -c web/prof-demo
git push -u origin web/prof-demo
```

Si la branche existe deja :

```powershell
git switch web/prof-demo
git merge develop/v2
git push
```

### Sur Render

1. Va sur https://render.com
2. `New`
3. `Blueprint`
4. Connecte le repo GitHub `AlgoArena`
5. Choisis la branche `web/prof-demo`
6. Render lit `render.yaml`
7. Il build avec `Dockerfile`
8. Il donne une URL publique

Health check :

```text
/api/health
```

App :

```text
/
```

Docs API :

```text
/docs
```

## Option C - Lancer en local depuis un clone GitHub

Quelqu'un clone le repo :

```powershell
git clone https://github.com/rolln7drktayau/AlgoArena.git
cd AlgoArena
git switch develop/v2
```

Installer :

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
npm install
cd frontend
npm install
cd ..
```

Lancer :

```powershell
npm run local:dev
```

Ouvrir :

```text
http://localhost:5173
```

Arreter :

```powershell
Ctrl+C
```

Si des ports restent bloques :

```powershell
npm run local:stop
```

## Resume rapide

- **GitHub Pages** : lien demo leger, sans serveur.
- **Render prof demo** : vraie app web avec backend.
- **Local** : version complete pour travailler.
- **Desktop** : installateur a construire.
- **CLI** : usage scripts/recherche.
