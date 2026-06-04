# Rapport d'évolution — Surprends-moi

## Ce qui a été fait
- Bouton Surprends-moi visible sans scrolling.
- Modale TSP animee avec villes, chemin, score, progression et amelioration.
- Donnees fallback dans `frontend/src/demo/tsp-demo.json`.
- Bouton "Essayer moi-meme" qui ouvre Explorer.

## Ce qui a changé par rapport à l'état précédent
Avant : aucun instant visuel sans configuration.
Après : une demo immediate montre un chemin qui s'ameliore.

## Backlog UX — Test lycéen 17 ans
| # | Écran | Problème observé | Sévérité (1-3) | Corrigé dans ce sprint ? |
|---|-------|-----------------|----------------|--------------------------|
| 1 | Accueil | Rien ne bougeait avant configuration | 3 | Oui |
| 2 | Demo | TSP trop technique | 2 | Oui |

## Backlog technique restant
- La demo locale utilise un JSON statique cote frontend plutot qu'un appel live backend.

## Compatibilité
/ws/run, /ws/scenario, CSV/PDF exports et adapters pymoo preserves.

## Branche
develop/v2

## Score lycéen estimé
8/10 : quelque chose bouge en moins de 10 secondes.
