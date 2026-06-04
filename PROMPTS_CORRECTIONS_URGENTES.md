# AlgoArena V2 — Corrections urgentes UI/UX
# Basé sur analyse des captures du 4 juin 2026

---

# CORRECTION 1 — Profils utilisateurs : rendre la différence visible et immédiate

## Problème observé
Quand l'utilisateur change de profil (Étudiant / Chercheur / Curieux),
l'interface ne change pas visiblement. Le choix de profil n'a donc aucun sens
pour l'utilisateur. C'est la critique principale.

## Ce qui doit changer concrètement

### Profil ÉTUDIANT — ce qui est masqué ou simplifié

MASQUER complètement (display:none, pas juste opacity) :
- Tous les algorithmes sauf NSGA-II, NSGA-III et Random Search.
  Afficher à la place un bouton "+ Voir tous les algorithmes (mode avancé)".
- Les métriques IGD+, GD, GD+, Epsilon, Spread, Spacing.
  Ne garder visible que HV (Hypervolume) et IGD avec leurs tooltips humains.
- Les exports LaTeX, BibTeX, Statistiques JSON.
  Ne garder que CSV et PDF dans un bouton "Exporter".
- Le champ "Expression mathématique personnalisée" dans la définition du problème.
- Les sliders d'hyperparamètres avancés (garder seulement Taille population
  et Générations, masquer tout le reste derrière "Paramètres avancés ▼").
- La section "Custom Algorithm Upload".
- Les indicateurs WebSocket/HTTP fallback.

AJOUTER visible en mode Étudiant :
- Un encart jaune/amber discret en haut du Benchmark :
  "💡 Mode Étudiant : interface simplifiée. Passe en mode Chercheur
   pour accéder à tous les outils."
- Sous chaque métrique visible, une ligne d'explication en vert clair :
  HV → "Plus c'est grand, mieux c'est."
  IGD → "Plus c'est petit, plus l'algorithme est précis."
- Un bouton "Que se passe-t-il ?" visible pendant et après le run,
  qui ouvre un panneau expliquant le résultat en langage simple.

### Profil CHERCHEUR — ce qui est ajouté ou mis en avant

AFFICHER par défaut (ce qui était masqué) :
- Tous les algorithmes.
- Toutes les métriques.
- Exports LaTeX, BibTeX, Statistiques JSON visibles directement
  dans la barre d'actions, pas dans un menu déroulant.
- Section "Répétitions" avec tests statistiques (Wilcoxon, Kruskal-Wallis)
  visible directement sous le bouton Lancer.
- Champ d'expression mathématique personnalisée.
- Hyperparamètres complets dépliés par défaut.
- Un encart neutre (pas de message condescendant) :
  "Mode Chercheur : tous les outils disponibles."

### Profil CURIEUX — ce qui est différent

AFFICHER uniquement :
- L'onglet Explorer en premier (pas Comparer).
- Sur Comparer : seulement 3 algorithmes (NSGA-II, MOEA/D, Random Search),
  seulement le problème ZDT1 et TSP, seulement HV comme métrique.
- Un grand bouton "Surprends-moi" en premier plan.
- Pas de panneau Labs visible au premier coup d'œil
  (accessible via un lien discret "Sauvegarder mes résultats").
- Un message d'accueil : "Pas besoin de tout comprendre.
  Lance quelque chose et observe ce qui se passe."

## Implémentation

Dans useAppStore.ts, le profil courant est déjà stocké.
Créer un hook useProfileFilter() qui retourne pour chaque section
si elle est visible selon le profil actif.

Exemple :
```typescript
const useProfileFilter = () => {
  const profile = useAppStore(s => s.profile); // 'student' | 'researcher' | 'curious'
  return {
    showAllAlgorithms: profile === 'researcher',
    showAdvancedMetrics: profile === 'researcher',
    showLatexExport: profile === 'researcher',
    showStatTests: profile === 'researcher',
    showMetricExplanations: profile === 'student',
    showStudentBanner: profile === 'student',
    defaultTabIsExplore: profile === 'curious',
    showSurpriseMeProminent: profile === 'curious',
  };
};
```

Utiliser ce hook dans chaque composant concerné pour conditionner l'affichage.

Le changement de profil doit être immédiat : pas de rechargement, pas de
confirmation. L'utilisateur voit l'interface changer en temps réel.

Ajouter dans le header, à côté du sélecteur de langue, un badge cliquable
indiquant le profil actif : "👤 Étudiant ▼" avec menu déroulant pour changer.
Ce badge doit être toujours visible pour que l'utilisateur comprenne
pourquoi il voit plus ou moins d'options.

## Test lycéen 17 ans
Ouvrir l'app en profil Étudiant.
Compter le nombre d'éléments visibles dans la bibliothèque d'algorithmes.
Si c'est plus de 5, c'est encore trop.
Changer pour profil Chercheur.
La différence doit être visible en moins de 2 secondes sans scrolling.

---

# CORRECTION 2 — Réduire la densité visuelle et créer de la hiérarchie

## Problème observé
La page Benchmark est un mur uniforme de composants à la même densité.
L'œil ne sait pas où commencer. Captres 2, 3, 4, 5, 6 : tout a le même poids.

## Règle fondamentale à appliquer
**Une seule zone d'attention principale par écran.**
L'utilisateur doit voir immédiatement : "je suis à l'étape X".

## Restructuration de la page Benchmark

### Avant le run — mode configuration

La page doit montrer clairement 3 étapes numérotées :

```
┌─────────────────────────────────────────────────────┐
│  ÉTAPE 1 — Quel problème ?          [✓ ZDT1 · 2 obj] │
│  [Changer ▼]                                         │
├─────────────────────────────────────────────────────┤
│  ÉTAPE 2 — Quels algorithmes ?      [3 sélectionnés] │
│  [NSGA-II ✓] [NSGA-III ✓] [MOEA/D ✓] [+ Ajouter]    │
├─────────────────────────────────────────────────────┤
│  ÉTAPE 3                                             │
│  [▶ LANCER LA COMPÉTITION]  grand bouton vert        │
└─────────────────────────────────────────────────────┘
```

Les algorithmes non sélectionnés sont dans un panneau repliable
"Bibliothèque complète ▼" en dessous. Pas dépliée par défaut.

### Réduire la colonne gauche d'algorithmes

ACTUELLEMENT : 14 algorithmes affichés en liste avec tous leurs sliders dépliés.
C'est environ 800px de hauteur juste pour cette colonne.

APRÈS CORRECTION :
- Afficher les algorithmes comme des CHIPS/TAGS sélectionnables,
  pas comme des panneaux dépliés.
- Format : un badge coloré par algorithme avec une checkbox.
  NSGA-II [✓] | NSGA-III [✓] | MOEA/D [ ] | SPEA2 [ ] | ...
- Quand un algorithme est sélectionné, ses hyperparamètres s'affichent
  dans un panneau dédié à droite, pas inline dans la liste.
- La liste complète tient sur 2-3 lignes maximum.

### Hiérarchie typographique

Appliquer ces tailles de façon stricte et cohérente :
- Titre de section (Étape 1, Étape 2) : text-lg font-bold, couleur blanche.
- Label de champ : text-sm text-gray-400, pas bold.
- Valeur active : text-sm text-cyan-400.
- Texte d'aide : text-xs text-gray-500, italic.
- Ne jamais utiliser text-base pour un label secondaire.

### Espacements

Augmenter les espacements entre sections : gap-8 minimum entre les 3 étapes.
Actuellement tout est gap-2 ou gap-4, d'où la sensation d'étouffement.

---

# CORRECTION 3 — Drawable Landscape : rendre l'action évidente

## Problème observé
Le canvas drawable (image 9) est un grand rectangle blanc/beige vide.
Zéro indication de ce qu'il faut faire. Le lycéen n'essaiera pas de dessiner
s'il ne comprend pas que c'est interactif.

## Corrections

### État vide du canvas

Quand le canvas est vide (aucun trait), afficher en overlay semi-transparent
au centre du canvas :

```
        ✏️
   Dessine ici
   
   Peins des zones sombres.
   L'algorithme cherchera
   les zones les plus basses.
   
   [Exemple simple]  [Deux vallées]
```

Ce message disparaît dès que l'utilisateur commence à dessiner.

### Curseur

Le curseur doit changer en pinceau (cursor: crosshair ou SVG custom)
dès qu'il entre dans le canvas. Pas le curseur par défaut.

### Feedback visuel immédiat

Quand l'utilisateur dessine, les traits doivent apparaître immédiatement
en bleu sombre (couleur "vallée"). Le fond reste clair.
Le contraste doit être visible dès le premier coup de souris.

Ajouter sous le canvas une légende permanente de 1 ligne :
"🔵 Zones sombres = vallées (bon)  |  ⬜ Zones claires = montagnes (mauvais)"

### Bouton Lancer la recherche

Actuellement ce bouton est dans la barre en bas, petit, peu visible.
Après que l'utilisateur a dessiné quelque chose, ce bouton doit :
- Devenir plus grand et pulsant (animation CSS pulse).
- Changer de label : "▶ Lancer la recherche sur ce paysage".
- Être accompagné d'un message contextuel :
  "Ton paysage est prêt. Lance la recherche pour voir l'algorithme explorer."

---

# CORRECTION 4 — Paysage 3D : ajouter contexte et légende

## Problème observé
Le nuage de points 3D (Rastrigin) est beau mais déconnecté.
L'instruction "Clique et fais glisser pour tourner" est en texte blanc
sur fond sombre, difficile à lire, et disparaît trop vite.

## Corrections

### Légende permanente
Ajouter sous le canvas 3D une légende en 2 lignes toujours visible :
"🔵 Bleu = bonne solution (fitness basse)  |  🔴 Rouge = mauvaise solution"
"⭐ = meilleure solution trouvée"

### Instruction d'interaction persistante
Remplacer le texte flottant dans le canvas par un badge fixe
en bas à gauche du canvas : "🖱️ Glisser pour tourner · Molette pour zoomer"
Ce badge est permanent, pas juste au hover.

### Explication du paysage choisi
À droite du sélecteur de paysage (Rastrigin, Sphère, etc.),
ajouter une phrase contextuelle qui change selon le paysage :
- Rastrigin : "Surface très accidentée avec beaucoup de faux minima.
  L'algorithme peut facilement se perdre."
- Sphère : "Surface simple avec un seul minimum global.
  N'importe quel algorithme le trouve facilement."
- Rosenbrock : "Vallée en forme de banane. Facile à trouver,
  difficile à suivre jusqu'au fond."

### Contrôle de vitesse d'animation
Ajouter un slider "Vitesse" [Lent · Normal · Rapide] visible
sous le canvas 3D pour contrôler la vitesse de déplacement des points.

---

# CORRECTION 5 — Simulateur Edge/Fog/Cloud : sortir du mode formulaire

## Problème observé
L'écran Simulateur (image 8) ressemble à un formulaire d'administration.
Labels : TIER, DEVICES, RATE, COST, IDLE, WORKING, UP, DOWN.
Aucune aide visuelle. Les chiffres (20480, 1332, 1648) semblent arbitraires.

## Corrections

### Renommer les colonnes
- TIER → Niveau
- DEVICES → Appareils
- RATE → Vitesse (tâches/s)
- COST → Coût (€/tâche)
- IDLE → Consommation repos (W)
- WORKING → Consommation active (W)
- UP → Bande montante (Mbps)
- DOWN → Bande descendante (Mbps)

Chaque colonne doit avoir un tooltip "?" expliquant l'unité et l'impact
sur les objectifs.

### Remplacer les inputs bruts par des sliders avec valeurs préréglées

Au lieu d'un champ texte libre pour chaque valeur, utiliser des presets :

Pour VITESSE : [Lente | Moyenne | Rapide | Personnalisée]
Pour COÛT : [Gratuit | Économique | Standard | Premium]
Pour PUISSANCE : [Faible | Moyenne | Forte]

En mode "Personnalisée", l'input numérique réapparaît.
Cela réduit l'intimidation pour les non-experts.

### Ajouter une preview visuelle de l'environnement
Au-dessus du tableau, afficher un schéma simple (SVG) montrant :
[📱 Edge x5] → [🖥️ Fog x5] → [☁️ Cloud x5]
avec des flèches de latence entre les tiers.
Ce schéma se met à jour quand l'utilisateur change le nombre d'appareils.

### Presets de scénarios en haut de page
Avant le tableau, ajouter 3 boutons de preset :
[⚡ Démo rapide] [🔬 Cas d'usage moyen] [💥 Stress test]
Chaque preset charge des valeurs cohérentes et une description :
"Démo rapide : 3 tiers, 10 tâches, objectifs latence + coût."

---

# CORRECTION 6 — Tutoriel : mettre à jour les noms et le contenu

## Problème observé
Le tutoriel (image 11) mentionne encore les anciens noms :
"Benchmark", "Algorithm Library", "Problem Definition".
Ces noms doivent avoir été renommés mais le tutoriel n'a pas suivi.

## Corrections

Remplacer dans le texte du tutoriel :
- "Benchmark" → "Comparer"
- "Algorithm Library" → "Algorithmes" (section de l'onglet Comparer)
- "Problem Definition" → "Problème"
- "Scenario Simulator" → "Simuler"
- "Exploration V2" → "Explorer"
- "Competition Grid" → "Panneaux concurrents"
- "Replay Controls" → "Rejouer"

Restructurer le tutoriel pour correspondre aux 3 profils :
Ajouter en haut un sélecteur :
"Afficher le guide pour : [Étudiant] [Chercheur] [Curieux]"
Le contenu change selon le profil sélectionné.

En mode Étudiant, le tutoriel montre uniquement les 5 étapes essentielles
avec des illustrations simples.
En mode Chercheur, il montre les exports avancés, les stats, les configs.
En mode Curieux, il montre uniquement Explorer et le bouton Surprends-moi.

---

# RÉCAPITULATIF DES PRIORITÉS D'IMPLÉMENTATION

1. CORRECTION 1 (Profils visibles) — BLOQUANT. À faire en premier.
   Sans ça, le choix de profil est du théâtre inutile.

2. CORRECTION 3 (Drawable canvas vide) — RAPIDE et HAUTE VALEUR.
   1-2 heures de travail, impact immédiat sur la compréhension.

3. CORRECTION 2 (Densité / hiérarchie) — IMPORTANT mais plus long.
   Refactoriser la liste d'algorithmes en chips sélectionnables.

4. CORRECTION 5 (Simulateur formulaire) — MOYEN TERME.
   Ajouter les presets et renommer les colonnes en premier.
   Le schéma SVG peut attendre.

5. CORRECTION 4 (3D légende) — RAPIDE.
   Ajouter la légende et l'instruction persistante : 30 minutes.

6. CORRECTION 6 (Tutoriel noms) — RAPIDE.
   Chercher-remplacer dans le fichier texte du tutoriel : 1 heure.

---

# RÈGLE LYCÉEN — TEST APRÈS CHAQUE CORRECTION

Après chaque correction, ouvrir l'app en mode Curieux ou Étudiant
et répondre à ces 3 questions :

1. En 10 secondes, est-ce que je vois quelque chose qui m'intéresse ?
2. En 30 secondes, est-ce que je comprends ce que je peux faire ?
3. En 2 minutes, est-ce que j'ai réussi à lancer quelque chose ?

Si la réponse à une de ces questions est non, la correction est incomplète.
Noter le résultat dans BACKLOG_UX_CORRECTIONS.md.
