# AlgoArena Studio 3

## Interface livrée

La disposition reprend `image.png` : navigation latérale, Pareto central, convergence et solution en bas, inspecteur à droite et barre d'exécution. Le studio tient dans la fenêtre aux résolutions de bureau testées (1586×992 et 1366×768). Les longs formulaires, tableaux et traces défilent dans leur panneau. Sur mobile et avec un zoom important, le défilement reste disponible pour préserver la lisibilité.

Apprendre ajoute des explications ; Explorer privilégie les résultats ; Recherche révèle le vecteur de décision et les extensions avancées. Changer de niveau ne modifie pas les algorithmes ni les paramètres. Présentation masque navigation et inspecteur ; Échap en sort. L'inspecteur est repliable. Thème clair, navigation clavier sur les points et préférence de réduction des animations sont pris en compte.

Les vues Scénario, Workflow, Objectifs, Algorithmes, Arena, Pareto, Métriques, Comparer, Statistiques, Projets et Exporter sont intégrées à l'application réelle. Les graphiques ne contiennent pas de résultats de démonstration inventés. Les tutoriels et le bac à sable existants restent accessibles et sont chargés à la demande. Le chargement initial JavaScript passe d'environ 811 kB à environ 198 kB minifiés ; cela mesure le bundle, pas le temps de calcul scientifique.

## Calculs et stockage

- Les endpoints WebSocket benchmark, scénario et campagne utilisent des processus `spawn`, une file de huit événements maximum et deux jobs concurrents par défaut.
- Fermer la connexion arrête le processus ; le nettoyage est protégé de l'annulation du gestionnaire ASGI. Timeout d'inactivité par défaut : 30 secondes pour le benchmark, 300 secondes pour les scénarios et campagnes. Ce dispositif ne constitue pas un sandbox pour du Python hostile.
- Le journal SQLite est dans `~/.algoarena/runs.sqlite3`, configurable par `ALGOARENA_DATA_DIR`. Il conserve manifestes, événements et synthèses. Le fichier SQLite est limité à environ 1 GiB ; prévoir également l'espace du journal WAL. Une erreur disque est remontée, sans effacement automatique des résultats.
- Le manifeste conserve configuration, graine effective, versions Python/NumPy/pymoo/FastAPI, plateforme et empreinte SHA-256 de la configuration. Les limites explicites de population, générations et nombre de configurations sont validées côté API. Les plafonds historiques sont appliqués avant lancement ; le manifeste conserve séparément configuration demandée et effective.
- Les synthèses benchmark gardent les 200 derniers instantanés par algorithme ; les événements complets restent accessibles avec `GET /api/runs/{id}/events?after=N`. La mémoire n'est pas une archive illimitée.
- Après redémarrage, les runs laissés en cours sont marqués interrompus. Les campagnes peuvent reprendre depuis Projets : les échantillons terminés sont réutilisés uniquement avec la configuration originale exacte. Une nouvelle exécution possède son propre manifeste. La reprise au milieu d'une génération n'est pas implémentée.
- Les anciens fichiers `.algoarena` de schéma 1 restent lisibles ; les nouveaux ajoutent un champ facultatif `studio` pour la graine et le scénario. Les transactions IndexedDB ne sont annoncées terminées qu'après commit. Les fichiers importés sont validés et limités à 20 MiB.

## Scheduling : conventions explicites

Le moteur est un ordonnanceur déterministe à listes, non préemptif, avec trace des événements de transfert et de calcul. Il ne prétend pas reproduire un simulateur réseau à paquets ni toutes les fonctions de CloudSim Plus.

| Grandeur | Unité / convention |
|---|---|
| Calcul demandé | MI |
| Vitesse | MIPS par appareil, jamais multipliée une seconde fois par le nombre d'appareils |
| Données | MB |
| Bande passante | Mbps ; temps de transfert = 8 × MB / Mbps |
| Durée / latence cumulée | secondes |
| Puissance | watts par appareil |
| Énergie | joules, calcul actif + repos sur l'horizon du makespan |
| Coût | unité monétaire par MI |

Un enfant attend la fin de tous ses parents. Une liaison entrante par tier sérialise les transferts ; un transfert inter-tier utilise le minimum entre débit sortant source et entrant destination. Les appareils sont occupés pendant le calcul. La latence est la somme des dates de fin, et la violation d'échéance est comptée séparément comme retard : aucune pénalité cachée n'altère la mesure physique.

Pour les DAX, la précédence est conservée ; cycles et références manquantes sont rejetés. Runtime converti avec une référence explicite de 1 000 MIPS ; I/O agrégées par tâche converties en MB. Les données exactes par arête, la contention des liens sortants, la migration, les pannes, la mobilité et les politiques énergétiques avancées restent hors du modèle actuel.

Chaque point scénario transporte son vecteur de placement, sa provenance et ses objectifs. La sélection déclenche le décodage déterministe du même vecteur et affiche un Gantt avec appareil, début et fin. Aucune moyenne de répétitions n'est présentée comme un placement individuel.

## Campagnes scientifiques

La vue Statistiques lance problèmes × configurations actives × graines de base, avec budget d'évaluations demandé. Les graines effectives sont dérivées de façon stable pour chaque problème/configuration ; elles figurent dans les résultats. Le compteur mesure les évaluations réellement demandées au problème. Les dépassements de lots et budgets non exactement atteints sont visibles et exclus de l'inférence.

Les résultats exportent échantillons finaux, effectifs, moyenne, écart-type échantillonnal et médiane de HV. Comparaisons : Mann–Whitney bilatéral asymptotique via SciPy, correction de Holm sur toutes les comparaisons rapportées, effet rang-bisérial. Minimum de cinq observations par groupe ; ce seuil n'est pas une garantie de puissance statistique. Les problèmes sans référence HV ne produisent pas de test sur HV. Aucun test sur les générations successives.

Friedman sur blocs multi-problèmes, intervalles bootstrap, MCDM et import de résultats externes ne sont pas encore intégrés. Les campagnes locales sont limitées à cinq millions d'évaluations demandées. Les erreurs restent dans les résultats, sans remplacement par zéro.

## Distribution et sécurité

Imports Python désactivés par défaut. Les drapeaux d'activation restent réservés au code de confiance. Origines HTTP/WS locales explicites ; écoute locale `127.0.0.1`. Pour changer d'origine frontend : `ALGOARENA_ALLOWED_ORIGINS` (liste séparée par virgules). L'exposition réseau nécessite une authentification dédiée.

Electron et les dépendances Python affectées ont été mis à jour ; les versions sensibles sont fixées dans les manifestes. Le runtime portable Windows est utilisé directement lorsqu'il est fourni, sans recréer un venv ni installer des paquets au premier lancement. Le script de préparation portable construit ce runtime en amont. La distribution sans runtime embarqué garde le bootstrap Python existant et nécessite un accès réseau.

Cette livraison n'est pas une certification sur tous les OS ou tous les matériels. L'installation sur machines vierges hors ligne et les mesures matérielles complètes restent à qualifier. Le workflow CI ajouté teste Python et le build frontend sur Windows et Linux.

## Vérification reproductible

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm --prefix frontend run test
npm --prefix frontend run build
# Dans un autre terminal :
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --ws wsproto
node scripts/test_studio.mjs
```

Les tests navigateur couvrent benchmark, sélection clavier, changement de niveau sans modifier les résultats, présentation, export, scénario/Pareto/Gantt, campagne et absence de débordement de page aux tailles de bureau testées. Les captures locales sont générées dans `reports/` et ne sont pas incluses dans Git.

Les tests backend couvrent aussi les microcas analytiques du scheduler, l'arrêt effectif d'un processus, les exports après réouverture du stockage, la reprise de campagne et l'exclusion des budgets non conformes. Les avertissements de dépréciation des bibliothèques sont distincts des échecs et des audits de vulnérabilités.

Contrôle local de livraison : **37 tests backend et 6 tests frontend réussis**, build TypeScript/Vite réussi, parcours Playwright réussi, démarrage du shell Electron réussi avec `sandbox=true`, `contextIsolation=true`, `nodeIntegration=false`. Audits npm racine/frontend et pip-audit de l'environnement Python : aucune vulnérabilité connue signalée lors du contrôle. `pip check` ne signale pas de conflit de dépendances. Les matrices CI et installateurs ne sont pas assimilés à ces tests locaux.
