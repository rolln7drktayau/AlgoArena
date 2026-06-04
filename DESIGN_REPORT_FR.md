# Rapport Design - AlgoArena V2

## Objectif de la vue

AlgoArena doit devenir un outil de comparaison et d'exploration d'algorithmes d'optimisation. La vue actuelle cherche a couvrir trois usages :

- **Benchmark** : comparer plusieurs algorithmes sur un meme probleme.
- **Scenario Simulator** : appliquer l'optimisation a un cas Edge/Fog/Cloud.
- **Exploration V2** : comprendre l'optimisation avec des problemes plus visuels et pedagogiques.

Le risque actuel est que ces trois usages apparaissent comme des blocs techniques juxtaposes. Le design doit donc clarifier le parcours utilisateur avant d'ajouter encore plus de fonctionnalites.

## Structure actuelle de l'application

### Header

Le header contient :

- logo AlgoArena ;
- nom de l'application ;
- sous-titre ;
- selecteur de langue ;
- bouton theme clair/sombre ;
- navigation principale.

Choix actuel :

- La navigation est compacte pour laisser un maximum d'espace aux graphiques.
- Les onglets sont toujours visibles pour rappeler que l'app a plusieurs modes.
- Le theme sombre est adapte aux graphiques et dashboards scientifiques.

Probleme :

- Les onglets ne suffisent pas a expliquer la difference entre Benchmark, Scenario et Exploration.
- Certains termes restent trop academiques pour un utilisateur non specialiste.

Recommendation design :

- Garder la navigation compacte.
- Ajouter des micro-descriptions contextuelles dans chaque onglet plutot qu'un gros panneau global.
- Renommer eventuellement :
  - `Benchmark` -> `Comparer`
  - `Scenario Simulator` -> `Simuler`
  - `Exploration V2` -> `Explorer`

## Benchmark

Le Benchmark est le coeur de l'application.

Il contient :

- Labs ;
- definition du probleme ;
- bibliotheque d'algorithmes ;
- actions de run/export ;
- metriques epinglees ;
- replay ;
- leaderboard ;
- radar ;
- panneaux side-by-side ;
- graphiques de recherche communs.

### Pourquoi ces choix

- **Labs** : necessaires pour rendre l'app persistante et utilisable dans le temps.
- **Problem Definition** : l'utilisateur doit controler le probleme avant de comparer.
- **Algorithm Library** : les algorithmes sont les concurrents de l'arene.
- **Side-by-Side Panels** : utiles pour inspecter chaque algorithme individuellement.
- **Common Research Charts** : utiles pour comparer tous les algorithmes dans un meme espace.
- **Leaderboard** : donne une lecture rapide du gagnant actuel.
- **Radar** : donne une synthese finale multi-metriques.

### Probleme UX

La page Benchmark est dense. Elle ressemble plus a un cockpit de recherche qu'a un produit grand public.

Recommendations :

- Prioriser la hierarchie :
  1. Choisir un Lab
  2. Choisir probleme
  3. Choisir concurrents
  4. Lancer
  5. Lire resultat
- Cacher certains exports dans un menu `Exporter`.
- Mettre les outils avances dans des sections repliables.
- Utiliser des labels plus directs :
  - `Problem Definition` -> `Probleme`
  - `Algorithm Library` -> `Algorithmes`
  - `Side-by-Side Competition Panels` -> `Panneaux concurrents`
  - `Common Research Charts` -> `Comparaison globale`

## Labs

Un Lab est un espace de travail local.

Il contient :

- probleme ;
- algorithmes ;
- runs ;
- notes ;
- metriques epinglees ;
- historique.

Choix actuel :

- Sauvegarde automatique dans IndexedDB.
- Export/import `.algoarena`.
- Partage URL si le Lab est petit.
- Choix optionnel d'un dossier local quand le navigateur/Electron supporte File System Access.
- Suppression possible des Labs.

Pourquoi :

- IndexedDB fonctionne partout en web local.
- Le fichier `.algoarena` donne une sauvegarde portable.
- Le dossier local donne une experience desktop plus comprehensible.

Limite :

- Un navigateur web ne peut pas ecrire librement n'importe ou sans permission utilisateur.
- Le choix de dossier depend de l'API File System Access.

Recommendation design :

- Afficher clairement :
  - `Stockage automatique navigateur`
  - `Synchronise aussi vers : dossier choisi`
- Eviter de laisser croire que l'app a un acces disque total en mode web.

## Profils utilisateur

Profils :

- Etudiant
- Chercheur
- Curieux

Pourquoi :

- L'app a plusieurs publics.
- Le profil doit changer le niveau d'explication, pas bloquer des fonctions.

Probleme actuel :

- L'utilisateur peut ne pas comprendre pourquoi il doit choisir un profil.

Recommendation :

- Dire explicitement : "Cela adapte les explications et les options mises en avant. Toutes les fonctions restent disponibles."
- Ajouter plus tard :
  - Etudiant : tooltips et tutoriels visibles.
  - Chercheur : exports/statistiques visibles par defaut.
  - Curieux : exemples visuels mis en avant.

## Exploration V2

But :

Montrer d'autres familles d'optimisation que le multi-objectifs classique.

Domaines :

- mono-objectif ;
- TSP ;
- bin packing ;
- bayesian-light ;
- noisy ;
- drawable.

Pourquoi :

- Le public grand public comprend mieux un chemin TSP ou un packing qu'un front de Pareto abstrait.
- C'est un espace pedagogique pour visualiser exploration, convergence, bruit, stagnation.

Probleme actuel :

- Le nom `V2 Explore` est technique.
- On ne comprend pas immediatement que ce mode est pedagogique.

Recommendation :

- Renommer `Exploration V2` en `Explorer`.
- Ajouter une phrase courte : "Observe comment un algorithme cherche une meilleure solution sur des problemes visuels."
- Eviter de montrer des donnees brutes JSON sauf mode chercheur.

## Scenario Simulator

But :

Transformer des taches et workflows scientifiques en probleme d'affectation Edge/Fog/Cloud.

Pourquoi :

- C'est le module applique.
- Il donne une valeur concrete au benchmarking.

Probleme actuel :

- L'ecran est tres dense et tres technique.

Recommendation :

- Decouper en etapes :
  1. Environnement
  2. Workflow / taches
  3. Objectifs
  4. Algorithmes
  5. Resultats
- Ajouter des presets : `Demo rapide`, `Workflow moyen`, `Stress test`.

## Identite visuelle

Choix actuel :

- Dark UI ;
- accent vert ;
- orange secondaire ;
- fond technique ;
- cartes de dashboard.

Pourquoi :

- Convient aux graphiques.
- Donne une image scientifique/tech.
- Le vert fonctionne pour action principale et progression.

Risques :

- Trop sombre pour un public etudiant/curieux.
- Beaucoup de bordures et cartes peuvent donner une sensation d'outil interne.

Recommendation :

- Garder le theme sombre, mais augmenter les espacements et simplifier les cartes.
- Faire du theme clair une vraie experience lisible, pas seulement une inversion.
- Utiliser des pictogrammes pour :
  - lancer ;
  - exporter ;
  - supprimer ;
  - importer ;
  - sauvegarder.

## Priorite design recommandee

1. Renommer les sections avec des mots plus simples.
2. Mettre les actions avancees dans des menus.
3. Rendre Benchmark plus lineaire : probleme -> algorithmes -> run -> resultats.
4. Faire d'Exploration un vrai mode pedagogique, moins dashboard.
5. Garder Scenario comme module applique avance.
6. Faire des Labs un element central mais discret.
7. Ajouter des tooltips contextualises selon le profil.

## Synthese pour une IA design

AlgoArena doit etre pense comme un outil scientifique accessible. Il ne faut pas faire une landing page marketing. Il faut une interface de travail claire, dense mais guidee.

Direction proposee :

- Benchmark = cockpit de comparaison.
- Explorer = laboratoire pedagogique visuel.
- Scenario = simulateur applique.
- Labs = persistence et organisation.

Le design doit reduire l'ambiguite en montrant toujours :

- ce que l'utilisateur configure ;
- ce qu'il lance ;
- ce qu'il observe ;
- ce qu'il peut exporter.

Le style doit rester technique, mais plus calme, plus explicite, et moins charge en texte brut.
