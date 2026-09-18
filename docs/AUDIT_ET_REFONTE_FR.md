# AlgoArena : audit et proposition de refonte

> **Mise à jour : direction validée par l’utilisateur, Studio 3 implémenté.** Les constats et étapes ci-dessous décrivent l’audit initial. Voir [la livraison et les limites actuelles](STUDIO_V3_FR.md) avant d’interpréter les éléments « à faire ».


Statut : proposition à valider avant refonte complète. Les correctifs ciblés décrits ci-dessous sont appliqués ; l'architecture cible et la maquette ne sont pas encore intégrées au produit.

## Décision proposée

Conserver React, TypeScript, FastAPI et les adaptateurs pymoo. Recentrer le produit sur une expérience scientifique persistante, accessible à trois niveaux : Apprendre, Explorer, Recherche. Présentation est une vue des résultats, Arena une façon d'observer une exécution. Éviter quatre applications ou un nouvel IDE complet.

La promesse réaliste est : construire, comprendre et reproduire une expérience d'optimisation et d'ordonnancement localement. « Surpasser tous les outils » et « fiable sur tout matériel » ne sont pas des critères vérifiables. Définir une matrice de capacités, des cas de référence et des configurations matérielles testées.

## Périmètre et constats

Inspection du backend, du moteur de scheduling, des adaptateurs, des métriques, des imports, de l'état React, de la persistance, du shell Electron et des scripts. Exécution des suites disponibles et du build. Ce travail n'est ni un audit de sécurité exhaustif, ni une validation expérimentale de tous les algorithmes et systèmes d'exploitation.

| Priorité | Constat fondé sur le code | Conséquence / action |
|---|---|---|
| P0 scientifique | `scenario/workflows.py` extrait les parents DAX, mais `ScenarioTask` ne porte pas les dépendances ; `SchedulingProblem` ne les applique pas | Un ordre topologique seul ne garantit pas qu'un enfant commence après la fin de ses parents. Reconcevoir le modèle avant toute revendication de fidélité DAX. |
| P0 scientifique | `effective_rate = processing_rate * devices`, avec déjà une file par appareil | Si la vitesse est par appareil, la capacité est comptée deux fois. Fixer les unités et les conventions avant correction du modèle. |
| P0 scientifique | L'énergie de repos est additionnée par tâche à partir de son attente | Risque de compter plusieurs fois une même période d'inactivité. Calculer l'intégrale de puissance par ressource et intervalle. |
| P0 sécurité | Import Python restreint dans le processus serveur, avec accès au module NumPy | RestrictedPython ne constitue pas une isolation système. Import désormais désactivé par défaut ; isolation requise avant code étudiant non fiable. |
| P0 scientifique corrigé | `RunRequest.seed` ignoré lors de la construction des algorithmes | Graine globale transmise si l'algorithme n'a pas sa propre graine explicite. Test de répétabilité ajouté. Cela ne prouve pas le déterminisme de toutes les versions de pymoo. |
| P0 scientifique corrigé | Tests de significativité sur générations corrélées dans `export_statistics` | Export désormais descriptif ; tests inférentiels indisponibles tant qu'il n'existe pas de répétitions indépendantes exploitables. |
| P0 scientifique corrigé | Référence HV issue de chaque population | HV désormais indisponible sans référence partagée explicite ou dérivée du front de référence. Les scénarios sans cette référence affichent une valeur absente. |
| P1 sécurité corrigé | Chemin web joint sans contrôle de confinement ; noms d'upload issus du client | Vérification du chemin résolu ; noms UUID ; limite de lecture du fichier Python à 1 MiB ; nettoyage après échec. La taille totale de requête multipart reste à borner en amont. |
| P1 sécurité corrigé | CORS permissif et WebSocket sans contrôle d'origine | Liste explicite d'origines locales ; rejet des origines étrangères HTTP et WS. Ce mécanisme ne remplace pas une authentification. |
| P1 disponibilité | `wait_for(to_thread(...))` abandonne l'attente sans arrêter le thread | Un calcul bloqué peut continuer après timeout/déconnexion. Processus de travail terminables et protocole d'annulation nécessaires. |
| P1 mémoire | `_runs` et snapshots conservés sans politique de rétention backend ; file scénario sans borne | Campagnes longues capables d'épuiser la RAM. Stockage disque, quotas, éviction et régulation du flux nécessaires. |
| P1 concurrence | Les scénarios manipulent `random.seed` et `np.random.seed` globaux | Risque d'interférence entre exécutions concurrentes. Générateurs propres aux runs et isolation par processus. |
| P1 robustesse corrigé | Routes HTTP de simulation calculant dans une fonction `async` | Routes synchrones exécutées par FastAPI dans son pool de threads ; évite de monopoliser directement la boucle ASGI, sans supprimer la contention CPU. |
| P1 persistance | IndexedDB résout des écritures sur succès de requête, avant fin de transaction | Ne confirmer la sauvegarde qu'au commit ; traiter `abort`, quota disque et version de schéma. |
| P2 performances | Bundle initial mesuré à environ 811 kB minifié avant mises à jour | Charger vues et visualisations lourdes à la demande ; mesurer avant/après. |
| P2 scientifique | `best_overall`, radars normalisés et convergence dérivée d'un historique HV | Afficher le critère de tri et ses hypothèses ; ne jamais présenter un gagnant universel. |
| P2 reproductibilité | Versions produit divergentes et dépendance pymoo non verrouillée exactement | Unifier version, environnement résolu, provenance et hash des entrées dans un manifeste de run. |

Les statistiques maison de `core/statistics.py` ne doivent pas servir de référence publiée sans validation : traitement approximatif des ex aequo, approximation des p-values, appariement tronqué par `zip`. Préférer des implémentations scientifiques éprouvées avec tests sur cas connus.

## Ce qui est conservé

- Adaptateurs d'algorithmes et séparation problèmes / algorithmes.
- WebSocket, rendu groupé par animation frame, workers graphiques et historique frontend déjà limité.
- Imports/exports de labs et IndexedDB : une base à migrer, pas à réécrire sans reprise des données.
- Répétitions du mode scénario, exports CSV/PDF/LaTeX et profils déjà présents.
- Isolation du renderer Electron (`contextIsolation`, `sandbox`, absence de Node dans la page).

## Critique de la proposition attribuée à Claude

1. **Bonne priorité sur reproductibilité, campagnes, MCDM et pédagogie.** Mais LaTeX, répétitions scénario, labs et profils existent déjà. Les compléter et les valider au lieu de les annoncer comme absents.
2. **Comparaison concurrentielle à rectifier.** jMetalPy documente des visualisations statiques, interactives et temps réel, des expériences et des tests statistiques. PlatEMO possède déjà une GUI et un catalogue très étendu. Le temps réel seul ne différencie pas AlgoArena. Sources : [jMetalPy](https://github.com/jMetal/jMetalPy), [PlatEMO](https://github.com/BIMK/PlatEMO).
3. **PymooLab est une référence pertinente.** Sa prépublication décrit une interface sur pymoo, la traçabilité, l'assistance LLM et MCDM. La notice arXiv ne suffit pas à confirmer une publication définitive dans une revue : [prépublication des auteurs](https://arxiv.org/abs/2603.01345).
4. **CloudSim, iFogSim et YAFS ne doivent pas être amalgamés.** La restriction universelle à une topologie en arbre n'est pas démontrée par la proposition. Comparer chaque moteur sur des scénarios et hypothèses explicites : [CloudSim Plus](https://github.com/cloudsimplus/cloudsimplus).
5. **Un run isolé reste utile** pour déboguer et enseigner, mais n'établit pas une supériorité statistique. Une campagne doit comparer des résultats finaux au même budget d'évaluations ; une génération n'est pas une unité de travail comparable entre algorithmes.
6. **Ne pas changer automatiquement population ou budget selon le matériel.** Cela changerait l'expérience. Adapter par défaut la concurrence, la fréquence de rendu et la densité graphique. Proposer un preset léger avant lancement et enregistrer le choix.
7. **Reporter LLM et Pyodide.** Le premier ajoute une dépendance et du code à vérifier ; le second un second environnement numérique à maintenir. Commencer par des modèles pédagogiques déterministes, des formulaires et des expressions validées.
8. **Ne pas promettre des imports d'algorithmes étudiants sûrs via RestrictedPython.** La documentation indique expressément qu'il ne s'agit pas d'un sandbox : [documentation officielle](https://restrictedpython.readthedocs.io/en/latest/).

## Critique de la proposition ChatGPT pour les vues

Retenir E, avec une Arena intégrée. Conserver la même géographie et la sélection liée. Modifier les points suivants :

- Trois niveaux de détail modifiables à tout moment, sans attribuer des fonctionnalités selon le statut social de l'utilisateur.
- Présentation devient une action depuis l'analyse, avec sortie évidente et navigation clavier ; elle n'est pas un quatrième mode de travail.
- Quatre étapes principales : Préparer, Exécuter, Analyser, Exporter. Les projets sont un point d'entrée ; les tutoriels sont une aide contextuelle.
- En Apprendre, un parcours court de quatre étapes, pas huit écrans obligatoires. En Recherche, accès direct aux mêmes données.
- Inspecteur masquable ; sur petit écran, panneau sous le graphique. Aucun agencement à trois colonnes imposé aux petits écrans.
- 2D par défaut, unités visibles, palette lisible, symboles en plus des couleurs, option de réduction des animations.
- Une sélection porte un identifiant stable de solution, avec run, répétition et algorithme. Ne pas utiliser l'indice d'un tableau filtré comme identité.
- Pareto → placement → Gantt devient le parcours central, mais seulement après conservation des vecteurs de décision et des événements de simulation.
- Aide à la décision séparée de la performance algorithmique : pondérer énergie/latence choisit une solution selon une préférence, cela ne démontre pas qu'un algorithme est supérieur.
- Explication d'un résultat basée sur traces réelles ; ne pas inventer une causalité sur sélection/croisement/mutation sans instrumentation correspondante.

Maquette de discussion autonome : [ouvrir la proposition interactive](refonte.html). Données illustratives, aucune simulation réelle. Elle permet de changer de niveau, de vue et de solution pour examiner la sélection liée.

## Architecture cible

```text
React : projet / expérience / sélection / présentation
                  │ commandes et événements versionnés
API locale : validation / jobs / flux / exports
                  │
Ordonnanceur : file bornée / concurrence limitée / annulation
                  │
Processus de calcul : adaptateur optimisation → évaluateur
                      benchmark ou simulation à événements
                  │
SQLite : métadonnées et états ; fichiers : traces et tableaux
```

Un processus séparé rend l'annulation possible ; il ne sécurise pas à lui seul du code arbitraire. L'exécution de code non fiable exige restrictions OS ou conteneur approprié, limites CPU/RAM/disque et stratégie réseau. Pour la première version locale, réserver les extensions Python au code de confiance.

Objets : `Project`, `Scenario`, `ExperimentSpec`, `RunManifest`, `Solution`, `EventTrace`, `Analysis`. Une spécification figée possède schéma, unités, objectifs min/max, contraintes, budgets, références et liste de graines. Le manifeste conserve configuration demandée ET effective, versions résolues, plateforme, erreurs, compteurs d'évaluations et empreintes des entrées. Changer de vue ne modifie jamais ces objets.

## Simulation : fondations à reconstruire

1. Définir ressources individuelles, capacités, unités, liens, latence, bande passante et partage de ressources.
2. Conserver le DAG et ses volumes de données ; rejeter cycles et références manquantes. Préserver les valeurs physiques DAX, ou annoncer explicitement leur transformation en preset pédagogique.
3. Moteur à événements discrets : tâche prête, transfert, début/fin de calcul, disponibilité. Les règles départagent les événements simultanés de façon déterministe.
4. Comptabiliser énergie, coût et temps à partir de la trace ; séparer métriques physiques et pénalités de contraintes.
5. Valider à la main des microcas : une machine/deux tâches, dépendance entre tiers, transfert partagé, période inactive, deadline dépassée.
6. Comparer ensuite des cas communs à CloudSim Plus sous hypothèses identiques. Publier les écarts expliqués, pas une promesse générale de supériorité.

## Recherche et campagnes

Matrice problèmes × algorithmes × graines, budget d'évaluations explicite, erreurs et runs incomplets exclus avec justification. Résultats finaux et distributions, médiane/IQR et moyenne/écart-type clairement définis. Intervalles de confiance avec méthode documentée ; aucun seuil universel de « 30 runs suffisants ».

Wilcoxon seulement pour observations réellement appariées ; Mann–Whitney pour deux groupes indépendants si le protocole le justifie ; Friedman sur blocs cohérents, corrections Holm pour comparaisons multiples. Partager un nombre de graine ne suffit pas à démontrer l'appariement. Afficher aussi taille d'effet, effectif et limites du plan expérimental.

Fronts de référence et normalisation versionnés. HV partagé et fixe ; approximation déclarée si dimension élevée. MCDM : sens des objectifs, normalisation, poids et analyse de sensibilité visibles. Import CSV externe avec schéma, unités et provenance contrôlés.

## Fluidité et matériel

Séparer le rythme de calcul, de stockage et d'affichage. Émettre quelques mises à jour par seconde ; garder la précision intégrale sur disque, échantillonner seulement la vue. Reconnexion et replay à partir d'un curseur d'événement. Nombre de workers limité par mémoire disponible autant que par CPU. Aucun changement silencieux de protocole.

Cibles proposées, à mesurer avant d'en faire des garanties : interface utilisable sur 2 cœurs/4 Go pour petits exercices ; jeu d'essai à 10 000 points affiché sans bloquer la navigation ; mémoire bornée sur campagne prolongée ; annulation effective d'un worker en moins de 2 secondes ; installation locale hors ligne testée sur machines vierges. Préciser les scénarios et navigateurs de chaque mesure.

## Livraison par étapes et critères d'acceptation

| Lot | Livrable | Condition de passage |
|---|---|---|
| 0 — ce changement | Correctifs ciblés, documentation rangée, audit, proposition de vues | Tests existants et régressions passent ; limites documentées |
| 1 — socle | Spécification/manifestes, SQLite, workers terminables, quotas | Reprise après crash, annulation réelle, mémoire bornée, import ancien lab sans perte |
| 2 — science | Scheduling à événements, DAG, unités, références HV | Microcas analytiques justes ; mêmes entrées/graines/environnement → mêmes objectifs ; écarts documentés |
| 3 — studio | Apprendre/Explorer/Recherche et sélection liée | Étudiant lance un cas guidé ; prof projette ; chercheur retrouve le manifeste ; parcours clavier complet |
| 4 — campagnes | Matrice multi-runs, analyses validées, exports complets | Budgets équitables, résultats d'essais statistiques de référence, interruption/reprise testées |
| 5 — distribution | Installateurs reproductibles, premier lancement hors ligne | Matrice OS/matériel vérifiée, dépendances auditées et versions figées |

Migration progressive derrière une entrée dédiée ; conserver les labs existants et proposer une conversion versionnée. Pas de remplacement global de l'interface avant validation des parcours.

## Correctifs opérationnels et limites restantes

- Les cinq Markdown de racine sont déplacés dans `docs/guides/`. Seul `README.md` reste à la racine. Lien README et inclusion dans le paquet desktop adaptés. Ces guides décrivent l'état antérieur ; le présent audit prévaut sur leurs promesses de sécurité et de validité statistique.
- Les lanceurs locaux écoutent désormais sur `127.0.0.1`. Pour un frontend sur une autre origine, déclarer `ALGOARENA_ALLOWED_ORIGINS` (liste séparée par virgules). L'accès réseau partagé doit faire l'objet d'un déploiement authentifié distinct.
- `ALGOARENA_ENABLE_CUSTOM_PROBLEM_UPLOAD=1` réactive le Python de confiance ; les drapeaux algorithmes et subprocess existants restent nécessaires pour leurs fonctions respectives.
- Les mises à jour npm compatibles ont été appliquées, puis Vitest passé à la branche 4 corrigée. Audit frontend : zéro alerte au contrôle effectué. Audit racine : 18 → 2 alertes hautes, liées à Electron/extract-zip ; migration Electron et qualification de l'installateur restent à faire. Aucun `audit fix --force` aveugle.
- Dépendances Python : audit CVE automatisé non réalisé dans ce lot. Les tests passant ne constituent pas un audit de vulnérabilités.
- Pas de validation de toutes les plateformes, ni de campagne de performance réelle, ni de validation physique complète du simulateur dans ce lot.

## Validation demandée

Vérifications effectuées : 22 tests backend, 3 tests frontend, compilation TypeScript et build Vite réussis. Maquette vérifiée dans Chromium via Playwright : navigation, niveaux, sélection liée, entrée/sortie de présentation et absence de débordement horizontal à 390 px. Le build signale encore un bundle d'environ 811 kB minifié. Les avertissements de dépréciation pymoo/ReportLab restent présents. La suppression du cache pytest a été bloquée par la politique automatique ; il est conservé. Environnements, dépendances installées et distributions locales conservés car utiles au développement.

Valider la direction « studio local à trois niveaux + présentation », les fondations scientifiques avant l'élargissement fonctionnel, et la livraison progressive des lots 1 à 5. La refonte complète n'est pas déclarée terminée : cette proposition et ses correctifs constituent la base concrète à approuver.
