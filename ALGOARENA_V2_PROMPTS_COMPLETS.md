# AlgoArena V2 — Prompts complets par module

> Ce document contient un prompt autonome pour chaque partie manquante ou partielle de la V2.
> Chaque prompt inclut : contexte, mission, règle du lycéen 17 ans, backlog obligatoire, rapport de fin.
> L'ordre suit la priorité produit (grand public d'abord), mais tous les modules sont couverts.

---

## Règle universelle — présente dans TOUS les prompts

> **À copier-coller en tête de chaque prompt si tu veux l'utiliser isolément.**

```
RÈGLE UNIVERSELLE — LYCÉEN 17 ANS

Avant de considérer toute tâche comme terminée, joue le rôle d'un lycéen de 17 ans
qui n'a jamais entendu parler d'optimisation. Il arrive sur AlgoArena pour la première fois,
curieux mais sans patience. Il a 45 secondes avant de fermer l'onglet.

Pour chaque écran ou fonctionnalité que tu modifies ou crées, réponds à ces questions
en te mettant dans sa peau :

1. Est-ce que je comprends ce que je peux faire ici sans lire de documentation ?
2. Est-ce que je vois quelque chose d'intéressant dans les 10 premières secondes ?
3. Est-ce qu'un mot m'a bloqué ou perdu ? Lequel ?
4. Est-ce que j'ai envie de cliquer sur quelque chose ?
5. Est-ce que je comprends ce qui vient de se passer après avoir cliqué ?

Note tous les problèmes trouvés dans le BACKLOG_UX.md du module concerné.
Ne considère jamais une tâche terminée si le lycéen serait perdu.
```

---

## Structure du rapport de fin (obligatoire pour chaque module)

Chaque prompt se termine par la production d'un rapport structuré ainsi :

```markdown
# Rapport d'évolution — [Nom du module]

## Ce qui a été fait
[Liste précise de ce qui a été implémenté]

## Ce qui a changé par rapport à l'état précédent
[Diff fonctionnel : avant / après]

## Backlog UX — Test lycéen 17 ans
| # | Écran | Problème observé | Sévérité (1-3) | Corrigé dans ce sprint ? |
|---|-------|-----------------|----------------|--------------------------|
| 1 | ...   | ...             | ...            | Oui / Non / Partiel      |

## Backlog technique restant
[Ce qui n'a pas pu être fait dans ce sprint avec raison]

## Compatibilité
[Confirme que /ws/run, /ws/scenario, CSV/PDF exports, pymoo adapters sont préservés]

## Branche
[Nom de la branche Git, tag si release]

## Score lycéen estimé
[Note /10 : combien de secondes avant que le lycéen comprenne quelque chose d'intéressant]
```

---

---

# MODULE 1 — Bouton "Surprends-moi" et premier instant de vie

**Priorité : CRITIQUE — c'est le premier contact avec l'outil**

```
CONTEXTE
Tu travailles sur AlgoArena, une application de comparaison d'algorithmes d'optimisation.
Branche de travail : develop/v2. Ne jamais toucher release/v1.0 ni release/*.
Stack : React + Vite + Tailwind + Zustand (frontend), FastAPI + pymoo (backend).
Le projet tourne sans Docker. Pas d'auth. Pas de cloud requis.

ÉTAT ACTUEL
L'utilisateur arrive sur l'application et voit immédiatement la page Benchmark avec :
Labs, définition du problème, bibliothèque d'algorithmes, hyperparamètres, WebSocket...
Il ne se passe rien tant qu'il n'a pas tout configuré lui-même.
C'est rédhibitoire pour un utilisateur non expert.

MISSION
Implémenter un bouton "Surprends-moi" (ou "Voir un exemple") visible dès l'arrivée
sur l'application, avant toute configuration.

Ce bouton doit :
1. Lancer immédiatement une démonstration précalculée ou en temps réel du problème TSP
   (Travelling Salesman Problem) avec une visualisation animée de villes et d'un chemin
   qui s'améliore génération après génération.
2. Ne nécessiter aucune configuration préalable de l'utilisateur.
3. S'afficher dans une modale ou un panneau dédié qui n'écrase pas l'état courant.
4. Montrer dans la modale : le nom du problème en langage simple ("Trouver le chemin
   le plus court entre des villes"), le nom de l'algorithme ("NSGA-II cherche..."),
   une animation SVG ou Canvas du chemin qui se raccourcit en temps réel,
   et une métrique simple en langage humain ("Score : 847 → 312, soit 63% d'amélioration").
5. Se terminer par un bouton "Essayer moi-même" qui charge la config TSP dans le Lab
   courant et ferme la modale.

PLACEMENT
- Le bouton doit être visible sans scrolling dès l'ouverture.
- Il doit être discret mais attractif : icône éclair ou étoile, label court.
- Il ne doit pas gêner les utilisateurs experts qui arrivent avec une config précise.

IMPLÉMENTATION SUGGÉRÉE
- Créer un composant SurpriseMeButton.tsx dans frontend/src/components/.
- Créer un composant SurpriseMeModal.tsx avec l'animation.
- La démo peut tourner en local (appel backend /api/problem-domains/simulate
  avec kind=tsp) ou être précalculée en JSON statique pour la version GitHub Pages.
- La solution JSON précalculée doit être dans frontend/src/demo/tsp-demo.json.
- Sur GitHub Pages (pas de backend), utiliser la solution précalculée.
- Sur mode local, appeler le backend pour un run live de 30 itérations max.

ANIMATION
L'animation doit montrer :
- Un canvas 400x300 avec 12 à 15 villes placées aléatoirement (seed fixe pour la démo).
- Le chemin actuel dessiné en lignes vertes.
- Chaque amélioration doit être animée (transition fluide du chemin).
- Le score actuel affiché en grand.
- Une barre de progression "génération X / 30".

LANGUE
Tout le texte de cette modale doit être en français ET en anglais selon la langue active.
Aucun jargon technique : pas de "hypervolume", pas de "IGD", pas de "WebSocket".

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle ci-dessus]
Après avoir implémenté, joue le rôle du lycéen. Note dans BACKLOG_UX_MODULE1.md
tous les moments de confusion. Corrige-les avant de clore le sprint.

RAPPORT DE FIN
Produis le rapport structuré standard à la fin du sprint.
Nomme-le RAPPORT_MODULE1_SURPRISE.md dans le dossier docs/rapports/.
```

---

# MODULE 2 — Refonte UX langage et navigation

**Priorité : HAUTE — chaque terme technique perdu est un utilisateur perdu**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Stack : React + Vite + Tailwind + Zustand. Backend FastAPI.

ÉTAT ACTUEL
L'interface utilise des termes trop techniques pour le grand public :
- Onglets : "Benchmark", "Scenario Simulator", "Exploration V2"
- Sections : "Problem Definition", "Algorithm Library",
  "Side-by-Side Competition Panels", "Common Research Charts"
- Métriques : "IGD", "IGD+", "GD", "GD+", "HV", "Epsilon additif",
  "Spread / Delta", "Spacing"
- Boutons : "RestrictedPython", "WebSocket fallback", "AST-validated expression"

MISSION
Renommer, expliquer et contextualiser. Pas de changement fonctionnel,
uniquement de la clarté.

PARTIE 1 — Renommages obligatoires
Appliquer ces renommages dans toute la codebase frontend (i18n ou texte direct) :
- "Benchmark" → "Comparer"
- "Scenario Simulator" → "Simuler"
- "Exploration V2" → "Explorer"
- "Problem Definition" → "Problème"
- "Algorithm Library" → "Algorithmes"
- "Side-by-Side Competition Panels" → "Panneaux concurrents"
- "Common Research Charts" → "Comparaison globale"
- "Run" → "Lancer" (bouton principal)
- "Export" → "Exporter" (bouton menu)
- "Lab" → garder "Lab" mais ajouter sous-titre "(espace de travail)"

PARTIE 2 — Micro-descriptions dans la navigation
Chaque onglet de navigation doit afficher une phrase courte au survol ou
en sous-titre visible :
- "Comparer" → "Lance plusieurs algorithmes sur un même problème et compare leurs résultats"
- "Simuler" → "Applique l'optimisation à un vrai problème de répartition cloud/fog/edge"
- "Explorer" → "Observe comment un algorithme cherche la meilleure solution, pas à pas"

PARTIE 3 — Tooltips humains sur chaque métrique
Pour chaque métrique affichée dans l'UI, ajouter un bouton "?" qui affiche
une explication en langage humain. Pas un tooltip de 3 mots : une vraie phrase.

Voici les textes à utiliser (à intégrer dans le système i18n) :
- HV (Hypervolume) : "Mesure combien de bonnes solutions l'algorithme a trouvées.
  Plus la valeur est grande, mieux l'algorithme couvre l'espace des solutions possibles."
- IGD : "Mesure à quelle distance les solutions trouvées sont du front idéal théorique.
  Plus la valeur est petite, plus l'algorithme s'approche de la perfection."
- IGD+ : "Variante améliorée d'IGD, plus précise quand les solutions sont proches du front idéal."
- GD : "Distance moyenne entre les solutions trouvées et le front idéal.
  Mesure la convergence vers la meilleure zone."
- Spread : "Mesure si les solutions couvrent bien tout l'espace des compromis possibles.
  Un spread proche de 1 signifie une bonne diversité."
- Spacing : "Mesure si les solutions sont régulièrement espacées.
  Un bon spacing évite les zones vides ou les clusters."
- Epsilon : "Mesure de combien il faudrait décaler les solutions pour qu'elles dominent
  le front idéal. Valeur idéale : 0."

PARTIE 4 — Profil utilisateur : clarifier l'écran de choix
Sur l'écran de sélection du profil au premier lancement, ajouter sous le titre :
"Ce choix adapte les explications et les options mises en avant.
Toutes les fonctions restent toujours disponibles."

Adapter les descriptions de chaque profil :
- Étudiant : "Tutoriels visibles, métriques expliquées simplement, interface guidée"
- Chercheur : "Exports LaTeX/BibTeX, statistiques avancées, tout visible par défaut"
- Curieux : "Exemples visuels mis en avant, pas de jargon, exploration libre"

PARTIE 5 — Masquer les infos techniques par défaut
Les éléments suivants ne doivent être visibles qu'en mode Chercheur ou
après un clic sur "Options avancées" :
- Détails de la méthode de sécurité (RestrictedPython, AST, subprocess)
- WebSocket status et fallback indicators
- Les métriques IGD+, GD+, Epsilon (les garder disponibles mais pas en premier plan)
- Les exports LaTeX/BibTeX (les mettre dans un menu "Exporter" déroulant)

LANGUE
Tout nouveau texte doit être bilingue FR/EN via le système i18n existant.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Teste chaque écran après modification. Note dans BACKLOG_UX_MODULE2.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE2_LANGAGE.md dans docs/rapports/.
```

---

# MODULE 3 — Drawable Fitness Landscape

**Priorité : HAUTE — c'est la killer feature différenciante d'AlgoArena**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Stack frontend : React + Vite + Tailwind. Backend : FastAPI + pymoo.
Un domaine "drawable" est déjà listé dans /api/problem-domains mais
la fonctionnalité est partielle.

ÉTAT ACTUEL
Le domaine "drawable" existe dans le registre mais l'expérience utilisateur
est incomplète. Il n'y a pas de vrai canvas interactif de dessin.

MISSION
Créer l'expérience "Dessine ton paysage" : l'utilisateur dessine une surface
de fitness à la souris, puis un algorithme cherche le minimum sur cette surface.
C'est la fonctionnalité la plus pédagogique et la plus différenciante.

COMPOSANT DrawableLandscape.tsx
Créer un composant dans frontend/src/components/explore/.

Fonctionnement :
1. Un canvas 600x400 s'affiche avec un fond en dégradé neutre.
2. L'utilisateur dessine à la souris : les zones où il peint deviennent des "vallées"
   (valeur de fitness basse = bonne). Les zones non peintes sont des "montagnes"
   (fitness haute = mauvaise).
3. Un slider "Intensité" contrôle la profondeur des vallées dessinées.
4. Un bouton "Effacer" remet le canvas vide.
5. Un bouton "Exemple : vallée simple" charge un paysage précalculé avec
   une seule vallée profonde au centre.
6. Un bouton "Exemple : deux vallées" charge un paysage avec deux minima locaux
   pour montrer le problème des optima locaux.

VISUALISATION DE L'ALGORITHME
1. Après dessin, l'utilisateur clique "Lancer la recherche".
2. Des points (population de solutions) apparaissent aléatoirement sur le canvas.
3. Génération après génération, les points se déplacent vers les zones sombres (vallées).
4. Les déplacements sont animés avec une transition fluide (200ms par génération).
5. Un curseur de vitesse contrôle la vitesse d'animation (lent/normal/rapide).
6. La meilleure solution trouvée est marquée d'une étoile dorée.
7. Un compteur "Meilleur score : X" se met à jour en temps réel.

ALGORITHMES DISPONIBLES
Trois modes simples, sans jargon :
- "Gradient simulé" (= gradient descent approximé sur la grille)
- "Exploration aléatoire" (= random search)
- "Évolution" (= version simplifiée genetic algorithm, 1 objectif)

Ces algorithmes opèrent sur la grille 2D du canvas (discrétisée en 60x40 cellules).
Ils n'ont pas besoin du backend pymoo pour ce mode : tout tourne en JavaScript côté client.

PÉDAGOGIE INTÉGRÉE
Afficher en dessous du canvas une explication contextuelle qui change selon
ce qui se passe :
- Au début : "Dessine des vallées. L'algorithme cherchera les zones les plus sombres."
- Pendant la recherche : "L'algorithme explore [X] solutions. Il a trouvé une vallée !"
- En cas de blocage visible : "L'algorithme est bloqué dans un optimum local.
  Il ne voit pas la vallée plus profonde à côté."
- À la fin : "Terminé ! Le meilleur point trouvé est marqué d'une étoile."

EXPORT
- Bouton "Sauvegarder dans le Lab" : enregistre le canvas comme image PNG
  et les paramètres dans le Lab courant.
- Bouton "Partager" : génère une URL encodée avec le paysage (grille JSON compressée)
  pour partager un paysage exact avec quelqu'un d'autre.

VERSION GITHUB PAGES
Ce module doit fonctionner entièrement en JavaScript, sans backend.
Les trois algorithmes sont implémentés côté client uniquement.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Le test principal : est-ce qu'un lycéen comprend sans lire quoi que ce soit
ce qu'il faut faire ? Dessiner puis cliquer "Lancer" doit être évident.
Note dans BACKLOG_UX_MODULE3.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE3_DRAWABLE.md dans docs/rapports/.
```

---

# MODULE 4 — 3D Landscape Explorer

**Priorité : HAUTE — spectaculaire, mémorable, partageable**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Un landscape 2D existe déjà dans V2 Explore. Ce module ajoute la version 3D.
Stack : React + Vite. Librairie 3D : three.js (déjà disponible dans l'environnement React).

ÉTAT ACTUEL
"3D landscape explorer. 2D landscape exists in V2 Explore." — partiel selon le status.

MISSION
Créer un explorateur 3D interactif du paysage de fitness pour les problèmes
à 2 variables de décision et 1 objectif (ou 2 objectifs projetés en Z).

COMPOSANT Landscape3DExplorer.tsx
Créer dans frontend/src/components/explore/.

VISUALISATION 3D
1. Afficher une surface 3D (mesh) représentant le paysage de fitness.
   - Axe X : première variable de décision
   - Axe Y : deuxième variable de décision
   - Axe Z : valeur de fitness (hauteur)
   - Couleur : dégradé bleu (bas/bon) → rouge (haut/mauvais)
2. La surface est interactive :
   - Rotation à la souris (OrbitControls ou équivalent manuel).
   - Zoom à la molette.
   - Le double-clic recentre la vue.
3. Les solutions de la population courante sont affichées comme des sphères
   colorées flottant au niveau Z correspondant à leur fitness.
4. La meilleure solution est une sphère dorée plus grande.
5. L'évolution de la population est animée : les sphères se déplacent
   entre les générations.

PROBLÈMES INTÉGRÉS
Proposer 5 paysages prédéfinis avec boutons de sélection :
- "Sphère" (1 minimum global, simple)
- "Rastrigin" (nombreux minima locaux, surface ondulée chaotique)
- "Rosenbrock" (vallée courbe, difficile à suivre)
- "Ackley" (surface complexe avec nombreux plateaux)
- "Personnalisé" (reprend le drawable du MODULE 3 projeté en 3D)

Pour les 4 premiers, calculer la surface côté backend via
/api/problem-domains/simulate avec kind=landscape3d et les paramètres nécessaires.
En fallback GitHub Pages, utiliser des données précalculées JSON.

RÉSOLUTION
- Surface de 50x50 points par défaut (2500 points).
- Option "Haute résolution" à 100x100 (10000 points, peut être lent sur mobile).
- Afficher un avertissement si l'appareil semble lent (< 30 FPS détectés).

PÉDAGOGIE
Panneau latéral avec texte contextuel :
- Expliquer pourquoi "Rastrigin" est difficile (beaucoup de vallées locales).
- Montrer en surbrillance où l'algorithme a cherché vs où il aurait dû aller.
- Bouton "Rejouer depuis le début" pour revoir l'animation.

PERFORMANCE
- Utiliser InstancedMesh pour les sphères de population (pas d'objet 3D individuel).
- Throttle l'animation à 30 FPS si nécessaire.
- Libérer les ressources WebGL quand le composant est démonté.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
La surface 3D doit être immédiatement belle et compréhensible.
Si le lycéen passe 10 secondes à chercher comment la faire tourner, c'est un échec.
Ajouter un hint visuel discret "Clique et fais glisser pour tourner".
Note dans BACKLOG_UX_MODULE4.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE4_3D.md dans docs/rapports/.
```

---

# MODULE 5 — GitHub Pages / Pyodide — Version web complète

**Priorité : HAUTE — c'est la vitrine publique de l'outil**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Un fichier docs/index.html existe déjà comme démo serverless légère.
Il utilise des fallbacks JavaScript sans vrai Python.

MISSION
Améliorer significativement la version GitHub Pages pour qu'elle soit
une vraie démo autonome et convaincante, sans backend.

OBJECTIF
Quand quelqu'un arrive sur algoarena.github.io (ou équivalent), il doit
pouvoir lancer une vraie compétition d'algorithmes sans rien installer.

PARTIE 1 — Page d'accueil GitHub Pages
La page docs/index.html doit être refaite pour devenir une vraie landing page
d'entrée, pas juste une démo technique. Elle doit contenir :

En-tête :
- Logo + titre "AlgoArena"
- Sous-titre : "Compare des algorithmes d'optimisation. Regarde-les apprendre."
- Deux boutons : "Essayer maintenant" (ancre vers la démo) et
  "Télécharger la version complète" (lien vers GitHub Releases).

Section démo :
- Le bouton "Surprends-moi" (MODULE 1) doit être le premier élément visible.
- Un sélecteur de problème simple : TSP / Bin Packing / Trouver le minimum.
- Un sélecteur d'algorithme simplifié (3 choix max, noms humains).
- Un grand canvas d'animation.
- Les métriques en langage humain.

Section "Pourquoi AlgoArena" :
- 3 arguments visuels simples avec icônes :
  - "Voir les algorithmes penser en temps réel"
  - "Comparer équitablement, pas juste regarder un gagnant"
  - "Comprendre pourquoi, pas seulement qui gagne"

Pied de page :
- Lien GitHub
- Lien vers la documentation
- "Fait avec ❤️ pour la recherche et l'enseignement"

PARTIE 2 — Intégration Pyodide
Tenter de charger Pyodide de manière asynchrone dans docs/index.html.
Si Pyodide charge avec succès (délai max : 8 secondes) :
- Activer les algorithmes pymoo basiques (NSGA-II sur ZDT1).
- Afficher un badge "🐍 Python actif" discret.

Si Pyodide ne charge pas (timeout, mobile, connexion lente) :
- Utiliser les algorithmes JavaScript de fallback existants.
- Afficher un badge "⚡ Mode rapide" à la place.
- Ne jamais bloquer l'utilisateur : l'app doit fonctionner même sans Pyodide.

L'utilisateur ne doit pas savoir si c'est Python ou JavaScript qui tourne.
L'expérience doit être identique.

PARTIE 3 — Labs en localStorage sur GitHub Pages
La version GitHub Pages doit supporter les Labs en localStorage
(pas IndexedDB pour maximiser la compatibilité).
- Créer un Lab automatiquement au premier chargement ("Mon premier Lab").
- Permettre export/import .algoarena.
- Afficher "Vos Labs sont sauvegardés dans ce navigateur" discrètement.

PARTIE 4 — Build automatique
Ajouter un script npm run pages:build qui :
1. Build le frontend Vite.
2. Copie le résultat dans docs/ en conservant l'index.html amélioré.
3. Génère un docs/manifest.json avec version, date de build, et liste des features actives.

Ajouter dans .github/workflows/ un fichier pages.yml qui :
1. Se déclenche sur push vers develop/v2 ou main.
2. Lance pages:build.
3. Commit le résultat dans docs/ si des changements existent.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test principal : ouvrir docs/index.html dans un navigateur sans serveur local.
Est-ce que quelque chose se passe en moins de 10 secondes ?
Note dans BACKLOG_UX_MODULE5.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE5_PAGES.md dans docs/rapports/.
```

---

# MODULE 6 — Arbre généalogique évolutionnaire complet

**Priorité : MOYENNE-HAUTE — très pédagogique, unique**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
"Simplified genealogy exists for TSP" — partiel selon le status.
Le backend utilise pymoo. Les internals pymoo exposent des informations
sur la parenté des solutions entre générations.

ÉTAT ACTUEL
Une généalogie simplifiée existe pour TSP mais pas depuis les internals pymoo
pour les algorithmes multi-objectifs.

MISSION
Construire l'arbre généalogique complet des solutions pour les algorithmes
multi-objectifs pymoo, et l'afficher visuellement.

PARTIE BACKEND
Dans backend/app/core/run_manager.py, modifier la boucle d'exécution
génération par génération pour capturer, à chaque étape :
- L'identifiant unique de chaque solution (hash de ses variables de décision).
- Les identifiants de ses parents (si l'algorithme le permet via pymoo).
- Sa génération de naissance.
- Si elle est encore dans la population ou a été éliminée.

Exposer ces données dans le payload WebSocket sous la clé "genealogy" :
```json
{
  "genealogy": {
    "nodes": [
      {"id": "abc123", "gen": 0, "alive": false, "x": [0.1, 0.3]},
      {"id": "def456", "gen": 1, "alive": true, "x": [0.08, 0.28],
       "parents": ["abc123", "xyz789"]}
    ]
  }
}
```
Cette clé est optionnelle : si l'algorithme ne supporte pas la généalogie,
elle est absente. Ne jamais casser la compatibilité WebSocket existante.

PARTIE FRONTEND — Composant GenealogyTree.tsx
Créer dans frontend/src/components/benchmark/.

Visualisation :
1. Un graphe orienté de gauche à droite : générations en colonnes.
2. Chaque nœud est une solution. Couleur = rang Pareto.
3. Les arêtes montrent la filiation (parent → enfant).
4. Les nœuds "morts" (éliminés) sont grisés mais visibles.
5. Les nœuds "vivants" (dans la population finale) sont brillants.
6. La meilleure solution finale est mise en évidence avec une couronne.

Interactivité :
- Survol d'un nœud : affiche ses valeurs d'objectifs en tooltip humain.
- Clic sur un nœud : highlight tous ses ancêtres et descendants.
- Slider "Génération" : affiche l'arbre jusqu'à la génération X.
- Bouton "Animer" : fait avancer le slider automatiquement.

Performance :
- Limiter l'affichage à 200 nœuds max par défaut.
- Option "Afficher tout" pour les chercheurs (peut être lent).
- Utiliser un layout hiérarchique (Sugiyama ou similaire via d3-dag ou manuel).

FALLBACK SI PAS DE GÉNÉALOGIE
Si l'algorithme ne fournit pas de données de parenté, afficher à la place
un graphique "Évolution de la population" : scatter animé montrant
comment les points se déplacent génération par génération.
Ce fallback est toujours utile pédagogiquement.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Question clé : est-ce que le lycéen comprend en 10 secondes que ces points
connectés montrent "d'où viennent les meilleures solutions" ?
Note dans BACKLOG_UX_MODULE6.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE6_GENEALOGY.md dans docs/rapports/.
```

---

# MODULE 7 — Suite complète d'optimisation combinatoire

**Priorité : MOYENNE — élargit le public**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
TSP et bin packing existent déjà comme démos légères.
Ce module les complète avec une vraie bibliothèque de problèmes combinatoires.

MISSION
Ajouter 4 nouveaux problèmes combinatoires visuels dans l'onglet Explorer.

PROBLÈME 1 — Coloriage de graphe
Colorier les nœuds d'un graphe de façon qu'aucun voisin n'ait la même couleur,
en utilisant le moins de couleurs possible.
Visualisation : graphe interactif avec nœuds colorés. L'algorithme change
les couleurs génération après génération.
Explication humaine : "Imagine un emploi du temps : deux cours qui partagent
des étudiants ne peuvent pas avoir lieu en même temps."

PROBLÈME 2 — Sac à dos (Knapsack)
Choisir des objets à mettre dans un sac en maximisant la valeur
sans dépasser le poids maximum.
Visualisation : liste d'objets avec icônes, sac avec barre de remplissage.
L'algorithme montre quels objets il sélectionne.
Explication humaine : "Tu pars en voyage avec un sac limité. Que prendre ?"

PROBLÈME 3 — Scheduling de tâches
Affecter des tâches à des machines pour minimiser le temps total.
Visualisation : diagramme de Gantt animé.
Explication humaine : "Comment répartir le travail entre plusieurs personnes
pour finir le plus vite possible ?"

PROBLÈME 4 — Sudoku par optimisation
Résoudre un sudoku en le traitant comme un problème d'optimisation.
Visualisation : grille sudoku qui se remplit progressivement.
Explication humaine : "Même le sudoku peut être résolu par un algorithme
d'évolution !"

IMPLÉMENTATION
Chaque problème doit :
1. Avoir un composant React dédié dans frontend/src/components/explore/combinatorial/.
2. Être enregistré dans le domain registry backend sous /api/problem-domains.
3. Fonctionner avec les algorithmes mono-objectifs existants.
4. Avoir une explication en langage humain visible avant le lancement.
5. Permettre de modifier la taille du problème (petit/moyen/grand).
6. Fonctionner sur GitHub Pages (JavaScript uniquement, pas de backend requis).

ALGORITHMES DISPONIBLES POUR CES PROBLÈMES
- Évolution simple (genetic algorithm 1 objectif)
- Recuit simulé (simulated annealing)
- Recherche locale (local search)
Ces trois algorithmes doivent être implémentés en JavaScript pur
dans frontend/src/lib/combinatorial-solvers.ts.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test clé : le lycéen comprend-il le problème du sac à dos en moins de 5 secondes ?
Si l'explication nécessite plus de 2 phrases, c'est trop long.
Note dans BACKLOG_UX_MODULE7.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE7_COMBINATORIAL.md dans docs/rapports/.
```

---

# MODULE 8 — Module Bayesian Optimization complet

**Priorité : MOYENNE — très différenciant pour les chercheurs**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
"Production Bayesian optimization module beyond current surrogate-guided
sampling demo" — partiel selon le status.

MISSION
Transformer la démo Bayesian-light en un vrai module d'optimisation bayésienne
pédagogique et fonctionnel.

CONCEPT PÉDAGOGIQUE À VISUALISER
L'optimisation bayésienne fonctionne en 3 étapes répétées :
1. Observer quelques points (évaluations coûteuses).
2. Construire un modèle de substitution (surrogate) qui prédit la fitness
   partout où on n'a pas encore mesuré.
3. Choisir intelligemment le prochain point à évaluer.

C'est fondamentalement différent des algorithmes évolutionnaires :
on évalue peu, mais on choisit intelligemment.

PARTIE BACKEND
Créer backend/app/domains/bayesian.py avec :
- Un Gaussian Process simple (utiliser scikit-learn GaussianProcessRegressor).
- Une fonction d'acquisition Expected Improvement (EI).
- L'API domain-simulate doit retourner à chaque itération :
  - Les points évalués.
  - La surface de prédiction du GP (grille discrète).
  - L'incertitude du GP (barre d'erreur).
  - Le prochain point recommandé par EI.
  - Le meilleur point trouvé.

PARTIE FRONTEND — Composant BayesianExplorer.tsx
Créer dans frontend/src/components/explore/.

Visualisation pour un problème 1D (une variable) :
1. Graphique principal (600x300) montrant :
   - La vraie fonction (courbe bleue transparente).
   - Les points déjà évalués (points noirs).
   - La prédiction GP (courbe verte pleine).
   - L'intervalle de confiance GP (zone verte transparente ±2σ).
   - Le prochain point recommandé (croix rouge clignotante).
2. Sous le graphique, un deuxième graphique plus petit montrant
   la fonction d'acquisition (EI) : où vaut-il le mieux chercher.
3. Bouton "Évaluer le prochain point" : ajoute le point recommandé.
4. Bouton "Auto (10 étapes)" : évalue 10 points automatiquement avec animation.

EXPLICATION CONTEXTUELLE
Panel latéral avec texte qui change selon l'étape :
- Étape 1-3 : "On commence par explorer au hasard pour avoir une première idée."
- Étape 4+ : "Le modèle prédit maintenant la forme de la fonction.
  La zone floue montre où il est encore incertain."
- Quand EI pointe vers une zone inexplorée : "Le prochain point est choisi
  là où le modèle est très incertain. Explorer vaut mieux qu'exploiter."
- Quand EI pointe vers un minimum apparent : "Le modèle pense que c'est
  une bonne zone. Il exploite sa connaissance."

COMPARAISON AVEC ALÉATOIRE
Ajouter un compteur "Évaluations utilisées : X / 20".
Afficher en parallèle combien de points aléatoires il faudrait en moyenne
pour trouver un optimum aussi bon. Cette comparaison illustre pourquoi
la Bayesian Opt est utile pour les fonctions coûteuses à évaluer.

PROBLÈMES DISPONIBLES
- "Montagne cachée" : fonction unimodale simple.
- "Deux vallées" : bimodale, montre l'exploration vs exploitation.
- "Fonction bruitée" : avec bruit gaussien, montre la robustesse du GP.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test clé : est-ce que le lycéen comprend intuitivement la zone floue
du GP comme "ce que l'algorithme ne sait pas encore" ?
Note dans BACKLOG_UX_MODULE8.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE8_BAYESIAN.md dans docs/rapports/.
```

---

# MODULE 9 — Suite mono-objectif complète

**Priorité : MOYENNE — élargit la compréhension des fondamentaux**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
"Full single-objective algorithm suite beyond current random/domain demos"
— partiel selon le status.

MISSION
Implémenter une vraie bibliothèque d'algorithmes mono-objectifs avec
visualisation pédagogique de leurs comportements différents.

ALGORITHMES À IMPLÉMENTER
Chacun doit avoir :
- Une implémentation Python dans backend/app/algorithms/single_objective/.
- Un nom humain (pas juste "SA" ou "GA").
- Une description courte de son comportement.
- Une visualisation de son parcours sur le paysage.

Liste des algorithmes :
1. Descente de gradient (Gradient Descent)
   Nom affiché : "Le funambule" — suit toujours la pente descendante.
   Comportement visible : chemin direct, souvent piégé dans un optimum local.

2. Recuit simulé (Simulated Annealing)
   Nom affiché : "L'explorateur patient" — accepte parfois des mauvais moves
   pour s'échapper des pièges.
   Comportement visible : chemin erratique au début, de plus en plus précis.

3. Algorithme génétique simple (Genetic Algorithm)
   Nom affiché : "La meute" — une population qui évolue ensemble.
   Comportement visible : nuage de points qui converge.

4. Recherche aléatoire (Random Search)
   Nom affiché : "Le chanceux" — cherche au hasard, sans mémoire.
   Comportement visible : points dispersés, pas de direction.

5. CMA-ES
   Nom affiché : "L'adaptateur" — apprend la forme du paysage et s'adapte.
   Comportement visible : ellipse de recherche qui tourne et se rétrécit.

VISUALISATION COMMUNE
Pour tous les algorithmes, sur un paysage 2D fixe (Rastrigin ou Ackley) :
1. Le paysage en arrière-plan (heatmap colorée, bleu = bon).
2. Le chemin parcouru par l'algorithme (trajet en blanc transparent).
3. La position actuelle (point rouge).
4. La meilleure position trouvée (étoile verte).
5. Un graphique de convergence sous le canvas (courbe du meilleur score).

MODE COMPÉTITION
Permettre de lancer plusieurs de ces algorithmes en parallèle sur le même
paysage et voir en temps réel lequel trouve le meilleur optimum en premier.
C'est l'extension naturelle de l'arène au mono-objectif.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test clé : après 30 secondes, le lycéen doit pouvoir dire spontanément
"ce chemin cherche mieux que celui-là". Si c'est ambigu, l'animation
n'est pas assez claire.
Note dans BACKLOG_UX_MODULE9.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE9_MONOOBJ.md dans docs/rapports/.
```

---

# MODULE 10 — Exports statistiques formels (Wilcoxon / Kruskal-Wallis)

**Priorité : MOYENNE — valeur chercheur**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
"Statistics JSON export with Kruskal-Wallis and pairwise Wilcoxon results
when enough samples exist" — implémenté selon le status.
"Formal Wilcoxon/Kruskal-Wallis exports for repeated experiments" — partiel.

MISSION
Compléter et rendre utilisable l'export statistique formel.

PARTIE 1 — Interface de lancement d'expériences répétées
Actuellement il n'est pas clair comment lancer 30 répétitions du même run
pour avoir des résultats statistiquement valides.

Ajouter dans la section Run du Benchmark :
- Un champ "Répétitions" (défaut : 1, max : 30).
- Quand répétitions > 1, afficher "Mode analyse statistique activé".
- Une barre de progression globale "Run 3/30".
- À la fin, activer automatiquement l'export statistique.

PARTIE 2 — Rapport statistique interactif
Créer un composant StatisticalReport.tsx dans frontend/src/components/benchmark/.

Il affiche :
1. Tableau comparatif avec moyenne ± écart-type pour chaque métrique,
   pour chaque algorithme.
2. Matrice de p-values (test de Wilcoxon pairwise) avec code couleur :
   - Vert : différence significative (p < 0.05).
   - Orange : différence limite (0.05 ≤ p < 0.1).
   - Rouge : pas de différence significative.
3. Résultat du test de Kruskal-Wallis global :
   "Les algorithmes ont des performances significativement différentes (p=0.002)"
   ou "Aucune différence significative n'a été détectée (p=0.34)".
4. Recommandation automatique :
   "Sur ce problème avec ces paramètres, NSGA-II surpasse statistiquement
   MOEA/D sur la métrique HV avec p=0.003."

PARTIE 3 — Export LaTeX amélioré
L'export LaTeX existant doit être complété pour inclure :
- Le tableau statistique formaté IEEE.
- Les p-values en footnote.
- La commande \begin{table} correctement formatée.
- Un package.bib généré automatiquement avec les citations des algorithmes.

PARTIE 4 — Seuil minimum d'avertissement
Si l'utilisateur tente d'exporter des stats avec < 5 répétitions,
afficher un avertissement :
"⚠️ Les tests statistiques nécessitent au moins 5 répétitions pour être
fiables. Vous avez X répétitions. Les résultats sont fournis à titre indicatif."

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test : le lycéen ne doit pas voir ce module par défaut (profil Étudiant/Curieux).
En mode Chercheur, il doit comprendre "vert = cet algorithme est vraiment meilleur,
pas juste par chance" en lisant la matrice.
Note dans BACKLOG_UX_MODULE10.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE10_STATS.md dans docs/rapports/.
```

---

# MODULE 11 — Desktop : Python portable embarqué

**Priorité : BASSE-MOYENNE — important pour la distribution grand public**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Electron est déjà configuré. Un script Windows prepare_portable_python_windows.ps1
existe. L'objectif est de rendre la distribution desktop vraiment plug-and-play.

ÉTAT ACTUEL
L'Electron cherche Python dans l'ordre :
1. ALGOARENA_PYTHON env var
2. desktop/python/python.exe (portable)
3. .venv local
4. Système python/python3

Le script de préparation existe mais le workflow de build n'est pas automatisé.

MISSION
Automatiser complètement le build d'un installateur desktop qui embarque
Python et ne nécessite aucune installation préalable.

PARTIE 1 — Script de build automatisé
Créer scripts/build-desktop-full.ps1 (Windows) et scripts/build-desktop-full.sh
(Linux/macOS) qui :
1. Vérifient les prérequis (Node, Python système pour le build).
2. Téléchargent Python portable depuis python.org/ftp si absent.
3. Créent un venv dans desktop/python/.
4. Installent les requirements backend dans ce venv.
5. Build le frontend.
6. Lancent electron-builder.
7. Produisent l'installateur dans dist/.

PARTIE 2 — Détection intelligente au démarrage
Dans desktop/main.js (ou main.ts), améliorer la détection Python :
- Tester chaque option avec un ping (python --version) avant de l'utiliser.
- Afficher une splash screen pendant le démarrage avec le statut :
  "Démarrage d'AlgoArena... Chargement du moteur Python..."
- Si aucun Python n'est trouvé, ouvrir une fenêtre d'aide avec instructions
  d'installation simples, pas un crash silencieux.

PARTIE 3 — GitHub Actions pour les builds
Compléter .github/workflows/ avec build-desktop.yml qui :
1. Se déclenche sur les tags v*.*.* (releases).
2. Build sur Windows, macOS et Linux en parallèle (matrix strategy).
3. Télécharge Python portable et construit l'installateur.
4. Upload les artefacts dans la GitHub Release correspondante.

PARTIE 4 — Auto-update
Implémenter electron-updater basique :
- Au démarrage, vérifier si une nouvelle version est disponible sur GitHub Releases.
- Afficher un badge "Mise à jour disponible" discret dans le header.
- Bouton "Mettre à jour" qui télécharge et installe en arrière-plan.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test : télécharger l'installateur, double-cliquer. En moins de 2 minutes,
l'app doit être ouverte et fonctionnelle, sans jamais ouvrir un terminal.
Si ce n'est pas possible, documenter précisément pourquoi.
Note dans BACKLOG_UX_MODULE11.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE11_DESKTOP.md dans docs/rapports/.
```

---

# MODULE 12 — Sandbox custom algorithm production-grade

**Priorité : BASSE (sécurité mais peu visible) — nécessaire avant tout déploiement public**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
"Production-grade custom algorithm sandbox. Direct custom algorithm upload
is disabled by default." — partiel selon le status.
RestrictedPython est utilisé pour les problèmes custom mais pas pour les
algorithmes custom.

MISSION
Implémenter un sandbox sécurisé pour l'exécution d'algorithmes custom uploadés,
activable uniquement en mode local avec consentement explicite.

ARCHITECTURE RECOMMANDÉE
Ne pas exécuter le code custom dans le processus FastAPI principal.
Créer un processus worker isolé qui reçoit les instructions via une queue.

PARTIE 1 — Worker process isolé
Créer backend/app/sandbox/worker.py :
- Processus Python séparé lancé par le backend principal.
- Communication via multiprocessing.Queue ou asyncio Pipe.
- Timeout strict : si le worker ne répond pas en N secondes, le process est tué.
- Mémoire limitée via resource.setrlimit (Linux/macOS) ou équivalent Windows.
- Pas d'accès réseau dans le worker (socket bloqué via monkeypatching).
- Pas d'accès fichier hors du dossier temp dédié.

PARTIE 2 — API d'activation
L'upload d'algorithme custom doit nécessiter :
1. La variable d'env ALGOARENA_ENABLE_CUSTOM_ALGORITHM_UPLOAD=1.
2. Un écran de consentement dans l'UI :
   "⚠️ Vous êtes sur le point d'exécuter du code Python tiers sur votre machine.
   N'utilisez cette fonctionnalité qu'avec du code en lequel vous avez confiance.
   AlgoArena isole l'exécution mais ne peut pas garantir une sécurité totale."
   Bouton "J'ai compris, continuer" pour procéder.

PARTIE 3 — Validation statique avant exécution
Avant d'envoyer le code au worker, analyser l'AST Python pour détecter :
- Imports interdits : os, sys, subprocess, socket, requests, urllib.
- Appels à exec(), eval(), __import__(), open().
- Accès à __builtins__.
Si détecté : refuser l'upload avec un message explicatif précis.

PARTIE 4 — Interface de log du sandbox
Dans l'UI, quand un algorithme custom tourne, afficher un panneau
"Activité de l'algorithme custom" avec :
- Les prints() et logs émis par le code.
- Les erreurs interceptées.
- Le temps d'exécution par step.
- Un bouton "Arrêter" qui tue le worker proprement.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Ce module est invisible par défaut. Le lycéen ne doit jamais voir
la moindre mention de sandbox, RestrictedPython ou isolation.
Ces termes ne doivent apparaître que dans la documentation développeur.
Note dans BACKLOG_UX_MODULE12.md que tout est bien caché.

RAPPORT DE FIN
Produis RAPPORT_MODULE12_SANDBOX.md dans docs/rapports/.
```

---

# MODULE 13 — Scénario Simulator : refonte UX en étapes

**Priorité : MOYENNE — simplifie le module le plus complexe**

```
CONTEXTE
AlgoArena V2, branche develop/v2.
Le Scenario Simulator est décrit comme "très dense et très technique".
Le DESIGN_REPORT recommande de le découper en étapes.

MISSION
Transformer l'écran de configuration du simulateur en un wizard en 5 étapes.

ÉTAPE 1 — Environnement
Titre : "Où tournent les calculs ?"
Interface :
- 3 cartes visuelles cliquables : Edge / Fog / Cloud (ou les trois).
- Chaque carte a une illustration simple et une description humaine :
  - Edge : "Appareils locaux, rapides mais limités."
  - Fog : "Serveurs intermédiaires, bon équilibre."
  - Cloud : "Puissance maximale, mais plus lent à atteindre."
- Curseurs simples pour chaque tier sélectionné : nombre de devices (1-10),
  puissance (faible/moyenne/forte).
- Bouton "Ajouter un tier personnalisé" caché dans "Options avancées".

ÉTAPE 2 — Tâches ou Workflow
Titre : "Quelles tâches à exécuter ?"
Interface :
- Deux options visuelles avec icônes :
  - "Générer des tâches simples" : curseur nombre de tâches (5-100).
  - "Charger un workflow scientifique" : sélecteur des workflows Pegasus DAX.
- Pour le workflow, afficher un aperçu : nom, nombre de tâches, dépendances.
- Preset rapide : "Démo rapide (10 tâches)" / "Workflow moyen" / "Stress test".

ÉTAPE 3 — Objectifs
Titre : "Qu'est-ce qui compte le plus ?"
Interface :
- Curseurs de priorité pour chaque objectif (pas des checkboxes) :
  - Latence (temps de réponse)
  - Coût (prix de calcul)
  - Énergie consommée
  - Temps total
- Visualisation immédiate : "Vous privilégiez la rapidité sur le coût."
- Option "Ajouter un objectif personnalisé" masquée dans "Avancé".

ÉTAPE 4 — Algorithmes
Titre : "Qui cherche la meilleure solution ?"
Interface :
- Identique au sélecteur d'algorithmes du Benchmark, mais simplifié.
- Suggestion automatique : "Pour 3 objectifs, NSGA-III est recommandé."

ÉTAPE 5 — Résultats
Titre : "Voici les meilleurs compromis trouvés"
Interface :
- Garder le ScenarioVisualDashboard existant.
- Ajouter en tête : "L'algorithme a testé X configurations et retient ces Y solutions."
- Mettre en évidence la "solution recommandée" : celle qui équilibre le mieux
  les priorités définies à l'étape 3.
- Simplifier les labels : "Coût total" pas "cost_objective_value".

NAVIGATION DU WIZARD
- Barre de progression "Étape X sur 5" visible en haut.
- Boutons "Précédent" et "Suivant".
- Bouton "Lancer directement" qui utilise des valeurs par défaut intelligentes
  pour les étapes non configurées (pour les impatients).
- L'état de chaque étape est sauvegardé dans le Lab courant.

RÈGLE LYCÉEN 17 ANS
[Voir règle universelle]
Test clé : le lycéen doit pouvoir lancer une simulation complète en moins
de 2 minutes sans jamais se demander "c'est quoi ça ?".
Note dans BACKLOG_UX_MODULE13.md.

RAPPORT DE FIN
Produis RAPPORT_MODULE13_SCENARIO.md dans docs/rapports/.
```

---

# DOCUMENT DE SUIVI GLOBAL — À maintenir après chaque sprint

```
MISSION
Après chaque module complété, mettre à jour le fichier docs/EVOLUTION_REPORT.md.

Ce fichier est le tableau de bord de l'évolution du projet.

Structure :

# AlgoArena — Rapport d'évolution global

## État général
[Version courante, date, branche active]

## Modules complétés
| Module | Nom | Date | Score lycéen /10 | Bugs restants |
|--------|-----|------|-----------------|---------------|
| M1     | Surprise Me | ... | X/10 | ... |
...

## Backlog UX consolidé — Problèmes non résolus
[Tous les items des BACKLOG_UX_MODULEn.md qui ne sont pas encore corrigés,
 triés par sévérité]

## Backlog technique restant
[Tout ce qui est "still planned" dans V2_IMPLEMENTATION_STATUS.md,
 mis à jour à chaque sprint]

## Métriques de qualité
- Nombre de termes techniques encore visibles pour profil Curieux : X
- Nombre de modules fonctionnels sans backend : X/13
- Temps avant premier "wow" sur GitHub Pages : X secondes
- Score Lighthouse Performance GitHub Pages : X/100

## Prochaine priorité recommandée
[Le module suivant à travailler selon le rapport courant]
```

---

## Récapitulatif des modules

| # | Module | Priorité | Backend requis | GitHub Pages | Dépend de |
|---|--------|----------|----------------|--------------|-----------|
| 1 | Bouton Surprends-moi | CRITIQUE | Optionnel | ✅ | — |
| 2 | Refonte langage/UX | HAUTE | Non | ✅ | — |
| 3 | Drawable Landscape | HAUTE | Non | ✅ | — |
| 4 | 3D Landscape | HAUTE | Optionnel | Partiel | M3 |
| 5 | GitHub Pages complet | HAUTE | Non | ✅ | M1, M2 |
| 6 | Arbre généalogique | MOYENNE-HAUTE | Oui | Partiel | — |
| 7 | Combinatoire complet | MOYENNE | Non | ✅ | — |
| 8 | Bayesian Optimization | MOYENNE | Oui | Partiel | — |
| 9 | Suite mono-objectif | MOYENNE | Oui | Partiel | — |
| 10 | Stats formelles | MOYENNE | Oui | Non | — |
| 11 | Desktop portable | BASSE-MOYENNE | Oui | N/A | — |
| 12 | Sandbox custom algo | BASSE | Oui | Non | — |
| 13 | Scénario wizard UX | MOYENNE | Oui | Non | — |

---

*Document généré pour AlgoArena V2 — develop/v2*
*Branche release/v1.0 figée — ne jamais supprimer release/**
