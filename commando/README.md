# Iron Veil — Commandement Tactique

Jeu de tir tactique en vue du dessus (JavaScript + p5.js) : vous incarnez un soldat ou commandez une escouade de 4 IA. Les déplacements sont pilotés par des **Steering Behaviors** (Craig W. Reynolds) et la navigation longue distance par **A\***. Les hostiles utilisent une **machine à états finis** (patrouille → combat) avec perception (rayon de détection + champ de vision + ligne de vue).

> Exercice pratique du dépôt `IA2_SteeringBehaviors_Casablanca_G2`. Voir `AGENTS.md` et `ARCHITECTURE.md` à la racine.

## Démarrage rapide

```bash
cd commando
python3 -m http.server 8123
# puis ouvrir http://localhost:8123 dans un navigateur
```

Astuce : `http://localhost:8123/?mission=4` démarre directement une mission (1 à 5), pratique pour un test ou une démo.

## Lancer les tests

```bash
cd commando
node --test tests/*.test.mjs
```

60 tests unitaires couvrent : forces de steering (seek, arrive, flee, pursue, separation), A* (chemin libre, contournement, carte scellee), collision cercle/rectangle, ligne de vue, armes (cooldown, rechargement, munitions par arme), soin du medic (priorite a la cible choisie, pas de sur-soin, persistence tant que la cible vit), FSM des hostiles (patrouille → combat, drones passifs), balles, integrite des 7 missions, options d'elite des hostiles de cauchemar (maxHealth / damage / maxSpeed), stabilite de cap (anti-jitter / anti-rotation 360°), retention de cible en combat (anti-flip FOV), espacement en formation tactique, zones d’extraction elargies sans obstacle, commandes d’escouade (Tenir immobile mais riposte, Combat par traque A* du hostile le plus proche, Suivre avec cible choisis au clic + repli sur le joueur, Rallier qui ignore la cible Suivre), separation hostile 60 px et choix du point de spawn des renforts le plus eloigne, selection multiple de l’escouade (ajout/retrait, pool cible, purge des morts, soldat principal). Les tests utilisent un adaptateur p5 minimal (`tests/game.test.mjs`) — ils ne prouvent pas la compatibilité du rendu ; les parties interactives ont été validées dans Firefox headless via WebDriver BiDi.

## Contrôles

### Mode jeu (défaut)

| Action | Touche |
| --- | --- |
| Déplacer | WASD ou ZQSD |
| Viser | Souris |
| Tirer | Clic gauche (maintenir pour le SMG) |
| Recharger | R |
| Armes | 1 Pistolet · 2 Fusil · 3 SMG (aussi la molette) |
| Grenade | G |
| Basculer mode jeu / commandement | Tab |
| Menu Pause | P ou Échap (Reprendre, Recommencer, Menu) |
| Mode debug IA | D |

### Mode commandement (Tab)

| Action | Touche / souris |
| --- | --- |
| Sélectionner un soldat | Q (cycle) ou clic sur le soldat / sa carte — chaque clic ajoute ou retire le soldat de la sélection |
| Tout sélectionner | A (ou bouton Tous) |
| Effacer la sélection | X (ou bouton Aucun) — les ordres re-visent alors toute l'escouade |
| Ordre de déplacement | M puis clic sur la carte, ou clic droit, ou clic sur le sol |
| Suivre (cible au choix) | F puis clic sur l'allié à suivre — joueur ou IA |
| Tenir la position | H |
| Combat | C |
| Soigner (médic uniquement) | V puis clic sur l'allié à soigner — joueur compris |
| Se rallier | R |
| Défendre la zone | B |

La sélection peut viser **plusieurs soldats à la fois** (clics successifs sur les soldats ou leurs cartes ; Tous/Aucun pour tout prendre ou tout lâcher) : les ordres (Tenir, Combat, Déplacer, Suivre, Soigner, Rallier, Défendre) s'appliquent à toute la sélection — Suivre assigne le même allié suivi à chacun, Déplacer répartit la formation autour du point cliqué. Sans sélection, les ordres s'appliquent à toute l'escouade IA. Les morts sont automatiquement retirés de la sélection. Le panneau latéral expose les mêmes commandes en boutons ; le bouton **Soigner** n'apparaît que si la sélection (ou l'escouade) contient un médecin. L'AI LAB affiche le soldat « principal » (dernier cliqué) avec le compte « +n sélectionnés ». La logique de sélection est un modèle pur sans DOM (`selection.js`, `SquadSelection`), testé dans `tests/game.test.mjs`. Quand **Suivre** ou **Soigner** est armé, un bandeau indique la cible attendue et le clic suivant sur un allié désigne la cible (clic droit pour annuler).

- **Tenir** : le soldat reste immobile mais riposte sur tout ennemi visible.
- **Combat** : sans ennemi visible, le soldat navigue (A*) vers le hostile vivant le plus proche ; en vue d'un ennemi, il engage selon son rôle (Assaut : contact, Tireur/Soutien/Médic : distance préférée).
- **Suivre** : l'IA épouse la formation autour de l'allié choisi (l'extraction automatique s'applique toujours si l'ancre est dans la zone). Repli automatique sur le joueur si la cible meurt.
- **Soigner** (Doc) : Doc rejoint l'allié choisi (joueur compris) et reste assigné jusqu'à sa mort ou un nouvel ordre ; pas de sur-soin au-delà du maximum. Si un ennemi est visible, le médic riposte d'abord. Sans cible choisie, Doc soigne automatiquement le plus blessé (< 75 % PV).

Les hostiles appliquent une séparation élargie (60 px) pour ne pas se tas sur la cible, et les renforts apparaissent au point de spawn le plus éloigné des hostiles vivants.

## Audio

- **Musique** : drone mineur + percussion martiale + motif rare, générée en Web Audio (`music.js`), démarre à la première interaction (politique d'autoplay). Volume fixe (32 %), pas de contrôle en jeu.
- **Effets sonores** : tirs (distance atténuée), impact, blessure joueur, **explosion quand un hostile tombe** (anneau + débris), explosion de grenade, clic d'interface.
- **Pause simple** : P ou Échap gèle la partie (reprise identique), sans menu.
- **Écrans de fin** : victoire (amber) / défaite (rouge) avec statistiques (hostiles neutralisés, durée, survivants, objectifs) et deux boutons : action principale + retour au menu.

## Interface

- **Objectifs** avec progression (élimination X/Y, sécurisation en secondes, extraction)
- **Escouade** : rôle, état IA courant (FOLLOW/MOVE/HOLD/COMBAT/HEAL...), barres de vie et munitions, clic pour sélectionner
- **Armement** : arme active, munitions, grenades (2)
- **Carte tactique** : minimap temps réel (bâtiments, couvertures, zones, positions)
- **Mode debug IA** : cercles de détection, cône de vision, tracés A\*, vecteurs vitesse (vert) et force de steering (rouge), étiquettes d'état
- **AI LAB** : état FSM, |vitesse désirée|, |vitesse courante|, |force steering|, rayon de détection, voisins, poids de comportement du soldat sélectionné (ou du joueur)

## Missions

1. **Terrain d'entraînement** (Débutant) — Éliminer 3 drones d'entraînement passifs (violets), puis extraire l'escouade. Introduit les commandes et le tir.
2. **Infiltration urbaine** (Intermédiaire) — Ville de blocs resserrés, 6 patrouilles actives. Sécuriser le point de jonction (cercle jaune, 3 s) avant extraction.
3. **Extraction** (Avancé) — Un soldat est blessé dès le départ (l'IA medic converge pour le soigner). Des renforts hostiles arrivent toutes les 40 s (max 4).
4. **Bastion** (Très difficile) — Assaut d'un complexe tenu par 8 hostiles en patrouilles serrées. Renforts toutes les 35 s (max 4). Éliminer la garnison puis extraire l'escouade.
5. **La Dernière Porte** (Expert) — Opération de nuit : tenir le carrefour (cercle jaune, 5 s) sous des vagues de renforts toutes les 22 s (max 8), puis rejoindre l'extraction.
6. **Mur de Fer** (Cauchemar) — Complexe fortifié tenu par 10 hostiles d'élite (blindage à 80 PV, un vétéran à 10 dégâts). Éliminez-les tous puis extrayez-vous ; renforts d'élite toutes les 30 s (max 5).
7. **La Nuit des Cendres** (Cauchemar) — Finale : tenez le carrefour des cendres (cercle jaune, 6 s) sous des vagues toutes les 18 s (max 8), 9 hostiles d'élite (PV/dégâts renforcés), puis la dernière porte.

**Extraction** : l'objectif n'est validé que lorsque **tous les alliés vivants** sont dans la zone (les morts ne bloquent pas). Le libellé de l'objectif affiche la progression `n / total dans la zone` ; un joueur seul dans la zone est « en attente de l'escouade ». Les IA en mode Suivre/Rallier se resserrent automatiquement quand l'ancre est dans la zone.

Victoire : tous les objectifs accomplis. Défaite : le joueur ou toute l'escouade est mis(e) hors de combat. La sélection de mission est libre ; un bouton « Mission suivante » apparaît après chaque victoire.

## Architecture

```
commando/
├── index.html          # layout : canvas + panneau tactique + modal (+ overlay damageFlash)
├── style.css           # thème "pixel military" CRT : bevels durs, scanlines, barres segmentées
├── sketch.js           # contrôleur de scène (entrées, boucle, HUD, minimap, audio, rendu)
├── vehicle.js          # classe Vehicle de base : locomotion + steering (Reynolds)
├── soldier.js          # Soldier extends Vehicle : rôles (assault/medic/marksman/support),
│                       #   ordres (move/follow/hold/regroup/defend), combat, munitions par arme
├── enemy.js            # Enemy extends Vehicle : FSM patrol/alert/combat + renforts
├── world.js            # World : bâtiments (vision+mouvement), couvertures (mouvement),
│                       #   collision cercle/rect (glissement mur), ligne de vue,
│                       #   renderStatic() : bake du décor pixel-art par mission
├── pathfinding.js      # A* octile sur grille 16 px, gonflage obstacle, lissage de chemin
├── bullet.js           # Bullet + Grenade + fireBullet (dispersion selon précision)
├── missions.js         # Définitions des 7 missions (données pures)
├── tests/game.test.mjs # Tests unitaires (node:test + adaptateur p5 minimal)
└── libraries/p5.min.js # p5.js 1.7.0 (inchangé)
```

### Rendu pixel-art

Le champ de bataille est rendu dans un buffer hors-écran à **½ résolution** (512×320), puis upscalé ×2 sans lissage (`noSmooth()`, `image-rendering: pixelated`). Le **décor statique** (asphalte + bruit déterministe, marquages, plaques, bâtiments avec toits/ventileurs/antennes, barrières, véhicules) est cuit une fois par mission via `World.renderStatic()`. Chaque frame dessine : static layer → zones pulsées (sécuriser/extraction, cercle en pointillés rotatif) → debug (chemins A*, rayons, vecteurs) → sprites d'agents (vue de dessus : ombre, torse, casque, arme, chevrons de sélection) → projectiles/éclairs/débris → blit upscalé. Micro-particules (étincelles, débris), flash de bouche, shake caméra à l'impact/explosion, overlay rouge côté HUD quand le joueur est touché. L'interface HTML est re-stylée pour cohérence : panneaux à bevels durs, scanlines CRT (pseudo-éléments, `pointer-events: none`), barres de vie segmentées, badges et modale chromés.

### Séparation des systèmes

| Système | Rôle | Où |
| --- | --- | --- |
| Sélection d'action | FSM (soldat/ennemi), ordres d'escouade | `soldier.js`, `enemy.js` |
| Steering | seek / arrive / flee / pursue / separate / cohesion / avoidRects / followPath | `vehicle.js` |
| Locomotion | `applyForce()` → `vel += acc` → `pos += vel` | `vehicle.js` (une seule intégration) |
| Navigation | A\* grille + lissage ligne droite | `pathfinding.js` |
| Perception | Rayon + FOV + `losBlocked` (segment vs rectangles) | `vehicle.canSee`, `world.js` |
| Combat | Balles indépendantes : cooldown, rechargement, dispersion, dégâts | `soldier.js`, `bullet.js` |

Le mouvement combine toujours plusieurs forces pondérées (seek vers l'objectif ×1 + séparation ×1.25 + cohésion ×0.35 + évitement bâtiments ×1.5), limitées par `maxForce` après somme. Les chemins A* sont recalculés quand l'objectif se déplace de plus de 16 px ou après 700 ms sans progression.

### Repos et anti-rotation (orbite)

L'IA absorbe sa vitesse résiduelle quand aucun objectif de locomotion n'existe (frottement fort, `vel × 0.82`) et applique un frottement léger sinon (`× 0.97`). Au repos, la cohésion est désactivée et la séparation réduite — c'est le couple seek/cohésion tangentiel qui créait l'orbite autour d'un point fixe. En combat, l'Assaut utilise `arrive` (pas `pursue`) pour ne pas tourner autour d'une cible immobile. Un garde-fou force un soldat immobile depuis plus de 2,5 s en état `move` à basculer en `hold` (cas du soldat bloqué à destination par ses camarades).
Côté hostiles : hystérésis sur l'engagement (chase > 190 px, retraite < 60 px, maintien jusqu'à 160/130 px) pour éviter le flip à 180° aux seuils. Les chemins A* sont réutilisés tant qu'ils sont valides (pas de reconstruction périodique qui recale le premier waypoint). La collision cercle/rect supprime la composante de vitesse pénétrante : les agents glissent le long des murs au lieu de vibrer/rester bloqués contre la paroi. Les cadavres ne glissent plus (locomotion ignorée, `vel` mis à zéro) ; un hostile qui tombe déclenche une petite explosion visuelle et sonore.

### Paramètres utiles

- Rayon de détection : ennemi 210 px, escouade 230 px — Champ de vision : 115° / 110°
- Vitesses : joueur 2.9, escouade 2.4, ennemi 2.1 (drones 1.1) px/frame
- Medic : soigne 0.4 PV/frame à moins de 34 px, cible alliées < 75 % PV
- Drones d'entraînement : passifs, ne tirent jamais ; chaque arme conserve son propre chargeur

## Limites connues

- Les couvertures basses ne bloquent pas la ligne de vue (seuls les bâtiments la bloquent).
- Grenade : dégâts 60 (rayon 75 px) côté hostiles uniquement ; pas de dégâts de zone alliés.
- Le mode debug est obligatoire pour la démo pédagogique ; le masquer (D) ne change pas la simulation.
- p5 intégré en mode global (un seul sketch). Pas de son spatial : effets simples Web Audio.
- Les coordonnées de la caméra sont fixes (1024×640) — pas de défilement.
