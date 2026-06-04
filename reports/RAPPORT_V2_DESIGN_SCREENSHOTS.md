# AlgoArena V2 - Rapport visuel et fonctionnel

Date de capture : 4 juin 2026  
Branche V2 : `develop/v2`  
Branche V1 figee : `release/v1.0`

## Etat des branches

- Localement, il reste uniquement `release/v1.0` et `develop/v2`.
- Sur GitHub, `web/prof-demo` a ete supprimee.
- `master` existe encore cote GitHub uniquement parce que c'est la branche par defaut actuelle. GitHub refuse sa suppression tant que la branche par defaut n'est pas basculee vers `develop/v2`.
- Le workflow GitHub Pages est pousse sur `develop/v2`. Si GitHub affiche `Resource not accessible by integration`, Pages doit etre active manuellement une premiere fois dans `Settings` -> `Pages` -> `Source: GitHub Actions`.

Action GitHub restante :

1. Aller dans `Settings` -> `Branches`.
2. Changer `Default branch` de `master` vers `develop/v2`.
3. Supprimer `master`.

## Objectif produit V2

AlgoArena V2 doit rendre la comparaison d'algorithmes d'optimisation plus accessible a trois publics :

- Etudiant : interface guidee, textes explicatifs, metriques vulgarisees.
- Chercheur : comparaisons multi-configurations, exports academiques, statistiques.
- Curieux : exploration visuelle, problemes simples a comprendre, moins de jargon.

L'application conserve le moteur V1 : FastAPI, React/Vite/Tailwind, Zustand, WebSockets, pymoo, simulateur Edge/Fog/Cloud et workflows Pegasus DAX. La V2 ajoute des couches d'usage, de persistance, de visualisation et de securite sans reecrire le socle.

## Captures

### 1. Premier lancement et profils

![Premier lancement](screenshots/v2/01-premier-lancement-profils.png)

Choix de design :

- La modale force un premier choix utile sans bloquer les fonctionnalites.
- Les profils sont decrits par intention d'usage, pas par jargon technique.
- Le profil est modifiable dans les Labs.

### 2. Benchmark, Labs, probleme et algorithmes

![Benchmark Labs](screenshots/v2/02-benchmark-labs-probleme-algorithmes.png)

Fonctions visibles :

- Labs persistants.
- Definition du probleme.
- Bibliotheque d'algorithmes.
- Duplication de configurations pour comparer plusieurs hyperparametres.
- Panneaux concurrents selectionnables.

Choix de design :

- Interface dense pour un usage repetitif de benchmark.
- Les actions principales restent en haut de chaque zone.
- Les cartes sont reservees aux modules fonctionnels, pas a une page marketing.

### 3. Lab cree, stockage local et suppression

![Lab cree](screenshots/v2/03-lab-cree-stockage-suppression.png)

Fonctions ajoutees :

- Creation de Lab.
- Journal de Lab.
- Import/export `.algoarena`.
- Suppression de Lab.
- Choix d'un dossier local quand l'environnement navigateur le permet.
- Fallback IndexedDB/localStorage pour la version web.

### 4. Run temps reel, classement et exports

![Run temps reel](screenshots/v2/04-run-temps-reel-classement-exports.png)

Fonctions ajoutees :

- Run WebSocket conserve.
- Export CSV/PDF.
- Export LaTeX.
- Export BibTeX.
- Export statistiques JSON.
- Historique de run rattache au Lab courant.

### 5. Panneaux concurrents et charts de recherche

![Panneaux concurrents](screenshots/v2/05-panneaux-concurrents-et-charts.png)

Fonctions ajoutees :

- Selection manuelle des concurrents visibles.
- Afficher tout / masquer tout.
- Graphiques communs expliques avant et apres run.
- Vues de convergence, dispersion et comparaison globale.

### 6. Simulateur Edge/Fog/Cloud

![Simulateur](screenshots/v2/06-simulateur-edge-fog-cloud.png)

Fonctions conservees :

- Tiers Edge, Fog, Cloud.
- Objectifs configurables.
- Capacites et couts.
- Scenarios de placement.

Choix de design :

- Le simulateur reste separe du benchmark general pour ne pas melanger probleme scientifique et scenario systeme.

### 7. Explorer V2 : drawable et paysage 3D

![Explorer V2](screenshots/v2/07-explorer-v2-landscape-drawable-3d.png)

Fonctions ajoutees :

- Probleme dessinable a la souris.
- Landscape explorer visuel.
- Paysage 3D interactif.
- Domaines mono-objectif, combinatoire, bayesien leger, bruit, drawable.

Choix de design :

- L'onglet Explorer explique "pourquoi" un algorithme progresse ou stagne.
- Les problemes visuels rendent l'optimisation comprehensible pour les non-specialistes.

### 8. Resultats Explorer et convergence

![Explorer resultats](screenshots/v2/08-explorer-resultats-convergence.png)

Fonctions ajoutees :

- Simulation de domaine via endpoint dedie.
- Courbe de convergence.
- Vues adaptees selon domaine : route TSP, bin packing, confidence bands, decision/objective, genealogie simplifiee.
- Message clair si l'ancien backend repond `Method Not Allowed`.

### 9. Tutoriel

![Tutoriel](screenshots/v2/09-tutoriel.png)

Role :

- Garder une zone pedagogique distincte.
- Eviter de surcharger l'ecran Benchmark avec trop d'explications.

### 10. Demo GitHub Pages

![GitHub Pages](screenshots/v2/10-github-pages-demo-statique.png)

Role :

- Demo publique sans installation.
- Aucun serveur requis.
- Sauvegarde Lab simple dans le navigateur.
- Permet a un prof ou a une IA de tester rapidement l'intention produit.

Limite volontaire :

- Ce n'est pas la version complete FastAPI/WebSocket/pymoo.
- La version complete reste locale via `npm run local:dev`.

### 11. Vue mobile

![Mobile](screenshots/v2/11-mobile-benchmark.png)

Point a critiquer :

- La V2 est consultable sur mobile, mais le benchmark dense reste naturellement plus adapte au desktop.
- Les prochains ajustements devraient prioriser lisibilite des controles et hauteur des panneaux.

## Securite ajoutee

- Expressions mathematiques parsees par AST au lieu de `eval`.
- Upload d'algorithmes custom desactive par defaut.
- Timeout de step d'algorithme.
- Probleme Python uploadable prepare avec RestrictedPython quand active.
- Executable externe via protocole JSON stdin/stdout desactive par defaut.
- Capacites runtime exposees par `/api/capabilities` pour desactiver proprement ce qui n'est pas supporte.
- JavaScript custom execute cote frontend dans un Web Worker.

## Distribution

- Local complet : `npm run local:dev`.
- Arret propre : `npm run local:stop`.
- GitHub Pages : workflow `Deploy GitHub Pages Demo`, source `docs/`, branche `develop/v2`.
- Desktop Electron : packaging conserve avec preparation Python portable.
- CLI : package `algoarena`, commandes `algorithms`, `problems`, `domains`, `run`, `domain-run`.

## Critiques a demander a l'IA design

- Est-ce que le vocabulaire rend l'optimisation assez claire pour les curieux ?
- Le mode Benchmark est-il trop dense pour un etudiant ?
- Les Labs sont-ils assez visibles comme coeur produit ?
- Les profils doivent-ils etre un assistant de demarrage plus progressif ?
- Le contraste cyan/vert/orange est-il assez distinct sans donner une impression trop technique ?
- Faut-il fusionner certaines visualisations Explorer ou les garder separees ?
