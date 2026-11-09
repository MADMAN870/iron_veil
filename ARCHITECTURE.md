# Iron Veil — Architecture

> Note: Ce document décrit l'architecture interne du jeu **Iron Veil**. Pour jouer, voir [README.md](README.md). Le seul fichier protégé est `vehicle.js` : ne pas le modifier sans accord explicite.

## Vue d'ensemble

Iron Veil est un jeu de tir tactique en vue de dessus (JS + p5.js, mode global, sans build, sans framework). Deux styles de jeu cohabitent dans la même simulation :

1. **Mode jeu** — le joueur incarne un soldat (WASD/ZQSD + souris).
2. **Mode commandement** — le joueur dirige l'escouade (4 IA) via des ordres.

Le mouvement de **toutes** les entités du monde (joueur, escouade, hostiles, grenades, balles) est piloté par des **Steering Behaviors** (Craig W. Reynolds, *Steering Behaviors for Autonomous Characters*, GDC 1999) ; la navigation longue distance par l'**A\*** (grille 16 px, `pathfinding.js`). Les hostiles utilisent une machine à états finis (patrouille → alerte → combat) avec perception limitée par rayon de détection, champ de vision et ligne de vue.

```text
Entrées (clavier/souris)
        |
        v
  Sélection d'action   (FSM soldat/ennemi, ordres d'escouade, UI)
        |
        v
  Steering             (seek/arrive/flee/pursue/separate/cohesion/avoidRects/followPath)
        |
        v
  Locomotion           (Vehicle.applyForce() -> vel += acc -> pos += vel : une seule intégration)
        |
        v
  Règles de scène      (collisions, bords, réapparitions, victoire/défaite, renforts)
        |
        v
  Rendu                (buffer pixel ½ résolution -> upscale x2 ; HUD HTML/CSS)
```

## Structure des fichiers

```
commando/
├── index.html          # layout : canvas + panneau tactique + modal + overlay damageFlash
├── style.css           # thème "pixel military" CRT (bevels durs, scanlines, barres segmentées)
├── sketch.js           # contrôleur de scène : entrées, boucle draw/updateWorld, HUD, minimap, audio, rendu
├── selection.js        # SquadSelection : modèle pur (sans DOM/p5) de la sélection multiple
├── vehicle.js          # Vehicle : moteur de locomotion + bibliothèque de steering (PROTÉGÉ)
├── soldier.js          # Soldier extends Vehicle : rôles, ordres, armes, medic
├── enemy.js            # Enemy extends Vehicle : FSM patrol/alert/combat + renforts
├── world.js            # World : bâtiments/couvertures, collision cercle/rect (glissement), ligne de vue,
│                       #   rendu statique du décor (bake par mission), zones d'extraction/sécurisation
├── pathfinding.js      # A* octile, grille 16 px, gonflage d'obstacles, lissage de chemin
├── bullet.js           # Bullet + Grenade + fireBullet (dispersion selon précision)
├── missions.js         # 7 missions (données pures : bâtiments, patrouilles, objectifs, renforts)
├── music.js            # musique + SFX en Web Audio (démarre à la première interaction)
├── tests/game.test.mjs # tests unitaires (node:test + adaptateur p5 minimal)
└── libraries/p5.min.js # p5.js 1.7.0 (inchangé)
```

Ordre de chargement (`index.html`) : p5 → music → vehicle → pathfinding → world → bullet → soldier → enemy → missions → selection → sketch. Pas de bundler : les fichiers simples déclarent des classes globales, utilisées par les suivants.

## Boucle de jeu (sketch.js)

```text
setup()        -> canvas 1024x640, buffer pixelLayer (½ résolution), missions, UI, startMission()
draw()         -> drawFrame() (try/catch : bannière fatale visible au lieu d'un écran figé)
  updateWorld(now)   (si playing, non pause)
    joueur            -> steering manuel (WASD) si mode jeu, sinon immobile
    escouade IA       -> soldier.updateAI() + healTick()
    hostiles          -> enemy.updateAI()
    renforts          -> spawn au point le plus éloigné des hostiles vivants
    locomotion        -> a.update() + world.resolveCollision(a)   (une seule intégration)
    balles/grenades   -> intégration, collisions, dégâts
    objectifs         -> secureTimer, extraction
  rendu               -> pixelLayer puis blit upscalé
  HUD                 -> renderObjectives, renderSquadHud, updateAiLab, drawMinimap, updateHudStatics
```

`update()` de chaque `Vehicle` est la seule intégration de `acc → vel → pos`. Aucun code de scène ne téléporte une entité pour la déplacer (les réapparitions/grenades sont des règles de scène explicites, distinctes du steering).

## Steering behaviors (vehicle.js — API)

| Méthode | Rôle |
| --- | --- |
| `seek(target)` | vitesse désirée vers la cible, steering = désiré − courant |
| `flee(threat)` | idem, à l'opposé de la menace |
| `arrive(target, slowRadius)` | ralentit dans la zone de freinage, seuil d'arrêt |
| `pursue(entity)` / `evade(entity)` | prédiction de la position future (×12, bornée) |
| `wander()` | errance perturbée progressivement |
| `separate(agents, radius)` | dispersion (hôte 60 px, amis 34 px) |
| `cohesion(agents, radius)` / `alignment` | formation d'escouade |
| `avoidRects(rects)` | évitement local des bâtiments (point d'ancrage devant) |
| `followPath(path, state, radius)` | seek waypoint courant, avance si atteinte |
| `canSee(target, losClear)` | rayon + FOV + ligne de vue |

Toutes les forces retournées sont limitées par `maxForce` ; la somme pondérée finale est également limitée après composition (`steering.limit(this.maxForce)`).

## Perception et IA

**Soldats (`soldier.js`, `Soldier extends Vehicle`)**

- `perceive(enemies, world)` : meilleure cible visible (rayon 230, FOV 110°, LoS), avec rétention de cible (`detectionRadius × 1.3`) — anti-flip à reculons/composition d'angle.
- `baseSteering()` ordre de priorité :
  1. Médic : soin (cible choisie au clic > plus blessé < 75 % PV ; toujours immobile si ennemi visible) ;
  2. Combat : positionnement par rôle (assault arrive au contact, marksman/support tiennent la distance) ;
  3. Ordres : `move` / `follow` (ancre = cible choisie ou joueur) / `regroup` (ancre joueur) / `combat` (traque A* du hostile le plus proche) / `hold` (immobile, riposte) / `defend`.
- Forces composées : `base + separate (34 px, ×0.9) + cohesion (×0.2) + avoidRects (×1.4)`, frottement 0.96 avec objectif / 0.82 au repos.
- Tir (`combatFire`) : lead léger (×0.7), dispersion selon `WEAPONS[w].accuracy`, munitions par arme (`arsenal`), rechargement non bloquant.

**Hostiles (`enemy.js`, `Enemy extends Vehicle`)**

- FSM explicite : `patrol → combat ↔ return` avec `lastKnown` (avance sur la dernière position connue).
- Hystérésis d'engagement : chase > 190 px, retraite < 60 px, maintien entre (évite le flip 180°).
- Perception : rayon 210, FOV 115°, rétention ×1.3.
- Séparation élargie (60 px, ×1.1) : pas de tas sur la cible.
- `opts.elite` : `maxHealth` / `damage` / `maxSpeed` renforcés (missions Cauchemar).

**Escouade** : formation d'escouade resserrée autour de l'ancre (offsets par rôle) ; dans une zone d'extraction, déploiement aux 4 coins (offsets de sortie). A* recalculé seulement si l'objectif bouge > 16 px (pas de reconstruction périodique → pas de saccades).

## Sélection d'unités (selection.js)

`SquadSelection` est un modèle pur (aucun DOM/p5) : `toggle`, `selectExactly`, `selectAll`, `clear`, `prune` (morts retirés automatiquement), `pool(allAi)` (sélection si elle existe, sinon toute l'IA vivante), `primary` (dernier cliqué = focus AI Lab / debug). `sketch.js` l'utilise via de fines wrappers (`selectionList`, `toggleSelection`, `commandPool`…). En mode commandement : clic/carte = ajouter/retirer d'une sélection multiple ; `A` tout sélectionner, `X` effacer, `Q` cycler ; sans sélection, les ordres visent toute l'escouade.

## Missions (missions.js)

7 missions, types d'objectif `eliminate | secure | extract` (rencontres ou séquences). Les 2 Cauchemar (6–7) utilisent les hostiles d'élite. Les extractions sont dimensionnées `r ≥ 75` sans bâtiment à moins de `r` de leur centre (contrainte testée) ; la victoire exige **tous les alliés vivants dans la zone**.

## Rendu (pixel-art)

Buffer hors-écran `pixelLayer` à ½ résolution, upscalé ×2 sans lissage (`noSmooth()`). Le décor statique est **cuit une fois par mission** dans `staticLayer` (`World.renderStatic()`). Par frame : static → zones pulsées → debug → sprites → projectiles/explosions → blit. HUD HTML côté panneau droit (minimap, AI LAB, journaux, cartes escouade). Shake caméra, flashes, particules ≤ 240, débris.

## Tests

```bash
node --test tests/*.test.mjs
```

60 tests (`node:test` + adaptateur p5 minimal dans `tests/game.test.mjs`) : steering, A*, collisions, LoS, armes, medic, FSM hostiles, balles, intégrité des 7 missions, options d'élite, sélection multi (via `selection.js`), seuils exacts, non-mutation des vecteurs. Les tests ne couvrent pas le rendu ; la validation d'intégration navigateur est faite en Firefox headless (WebDriver BiDi).

## Garde-fous du projet

- `vehicle.js` est **protégé** : toute évolution passe par des sous-classes (nouveau fichier), jamais par modification de la base.
- Aucune téléportation de locomotion : les forces passent par `applyForce` / `update()`.
- Forces limitées après pondération ; vecteurs de cible copiés, jamais mutés ; divisions par zéro évitées (cible confondue, vitesse nulle).
- p5.js 1.7.0 en mode global, intégré sans build ; styles isolés par `push()`/`pop()`.

## Limites connues

- Les couvertures basses bloquent le mouvement mais pas la ligne de vue.
- Grenades : dégâts côté hostiles uniquement.
- Décor non torique (pas de wrapping de monde), caméra fixe.
- Le test unitaire n'atteste pas du rendu réel : un smoke test navigateur le complète.
