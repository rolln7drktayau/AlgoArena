# Lancer AlgoArena depuis GitHub

## Branches attendues

Le depot doit rester simple :

- `release/v1.0` : V1 figee.
- `develop/v2` : V2 active et source du deploiement GitHub Pages.

Si `master` apparait encore sur GitHub, c'est uniquement parce que GitHub refuse de supprimer la branche par defaut. Il faut d'abord changer la branche par defaut dans `Settings` -> `Branches` -> `Default branch` vers `develop/v2`, puis supprimer `master`.

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

## Option B - Lancer en local depuis un clone GitHub

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
- **Local** : version complete pour travailler.
- **Desktop** : installateur a construire.
- **CLI** : usage scripts/recherche.
