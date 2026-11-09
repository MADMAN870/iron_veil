# Iron Veil — Commandement Tactique

Jeu de tir tactique en vue du dessus (JavaScript + p5.js) : vous incarnez un soldat, ou vous commandez une escouade de 4 IA en mode **commandement**. Tous les déplacements sont pilotés par des **Steering Behaviors** (Craig W. Reynolds, *Steering Behaviors for Autonomous Characters*, GDC 1999) et la navigation longue distance par un **A\***. Les hostiles utilisent une machine à états finis (patrouille → combat) avec une perception limitée (rayon + champ de vision + ligne de vue).

## Aperçu

- 7 missions, de **Débutant** à **Cauchemar** (2 missions « cauchemar » avec des hostiles d'élite blindés).
- Deux styles de jeu dans la même simulation : **jeu** (WASD + souris) et **commandement** (ordres → escouade).
- Soin par le médecin avec cible choisie, ordres de déplacement/formation/extraction, ennemis qui se dispersent au lieu de se tas.
- Pixel-art temps réel (buffer ½ résolution upscalé ×2), HUD tactique, minimap, debug IA
- 60 tests unitaires (`node:test`, sans dépendance) ; validation navigateur Firefox headless.

## Démarrage rapide

```bash
cd commando
python3 -m http.server 8123
# ouvrir http://localhost:8123 dans un navigateur
```

Démarrer une mission directement (pratique pour une démo ou un test) : `http://localhost:8123/?mission=6` (missions 1 à 7).

## Lancer les tests

```bash
cd commando
node --test tests/*.test.mjs
```

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
| Basculer jeu / commandement | Tab |
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

La sélection peut viser **plusieurs soldats à la fois** (clics successifs sur les soldats ou leurs cartes). Les ordres s'appliquent à toute la sélection : Suivre donne à chacun le même allié choisi, Déplacer répartit la formation autour du point cliqué. Sans sélection, les ordres visent toute l'escouade IA. Les morts sortent automatiquement de la sélection. Le bouton **Soigner** n'apparaît que si la sélection (ou l'escouade) contient un médecin.

- **Tenir** : le soldat reste immobile mais riposte sur tout ennemi visible.
- **Combat** : sans ennemi visible, le soldat navigue en A\* vers le hostile vivant le plus proche ; en vue d'un ennemi, il engage selon son rôle.
- **Suivre** : l'IA épouse la formation autour de l'allié choisi ; repli automatique sur le joueur si la cible meurt.
- **Soigner** (Doc) : rejoint l'allié choisi (joueur compris) et reste assigné jusqu'à sa mort ou un nouvel ordre ; pas de sur-soin. Ennemi visible → le médic riposte d'abord. Sans cible, Doc soigne automatiquement le plus blessé (< 75 % PV).

## Missions

1. **Terrain d'entraînement** (Débutant) — Éliminer 3 drones d'entraînement passifs (violets), puis extraire. Intro aux commandes.
2. **Infiltration urbaine** (Intermédiaire) — Ville de blocs resserrés, 6 patrouilles actives. Sécuriser le point de jonction (cercle jaune, 3 s) puis extraction.
3. **Extraction** (Avancé) — Un soldat est blessé dès le départ (Doc converge pour le soigner). Renforts hostiles toutes les 40 s (max 4).
4. **Bastion** (Très difficile) — Garnison de 8 hostiles en patrouilles serrées. Renforts toutes les 35 s (max 4). Éliminer puis extraire.
5. **La Dernière Porte** (Expert) — Nuit : tenir le carrefour (cercle jaune, 5 s) sous des vagues toutes les 22 s (max 8), puis la dernière porte.
6. **Mur de Fer** (Cauchemar) — Complexe fortifié tenu par 10 hostiles d'élite (blindage 80 PV, un vétéran à dégâts renforcés). Éliminez-les puis extrayez-vous ; renforts d'élite toutes les 30 s (max 5).
7. **La Nuit des Cendres** (Cauchemar) — Finale : tenez le carrefour des cendres (cercle jaune, 6 s) sous des vagues toutes les 18 s (max 8), 9 hostiles d'élite, puis la dernière porte.

**Extraction** : objectif validé quand **tous les alliés vivants** sont dans la zone. Les IA en Suivre/Rallier se resserrent automatiquement dans la zone. Victoire : tous les objectifs remplis. Défaite : le joueur tombe ou l'escouade est anéantie.

## Interface

- **Objectifs** avec progression (élimination X/Y, sécurisation en secondes, extraction)
- **Escouade** : rôle, état IA (FOLLOW/MOVE/HOLD/COMBAT/HEAL…), barres de vie/munition, clic pour sélectionner
- **Carte tactique** : minimap temps réel (bâtiments, couvertures, zones, positions)
- **AI LAB / debug IA** : état FSM, vecteurs vitesse/forces, chemins A\*, rayon de détection ; le soldat « principal » (dernier cliqué) est affiché avec le compte « +n sélectionnés »
- **Armement**, **Journal**, **Pause** (P), **Modale de fin** (victoire/défaite + statistiques)

## Architecture

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour le détail des systèmes (steering, FSM, perception, sélection, rendu, tests). Résumé :

```
commando/
├── sketch.js      contrôleur : entrées, boucle, HUD, minimap, audio, rendu
├── vehicle.js     Vehicle : locomotion (applyForce/update) + steering (seek/arrive/flee/pursue/separate/cohesion/avoidRects/followPath) — PROTÉGÉ
├── soldier.js     Soldier : rôles (assaut/médic/tireur/soutien), armes, ordres (hold/combat/move/follow/heal…)
├── enemy.js       Enemy : FSM patrol/combat/return + options d'élite
├── selection.js   SquadSelection : modèle pur de la sélection multiple
├── world.js       World : collisions, ligne de vue, décor statique (bake), zones
├── pathfinding.js A* octile (grille 16 px) + lissage
├── bullet.js      Bullet, Grenade
├── missions.js    7 missions (données pures)
└── tests/         60 tests unitaires (node --test)
```

## Limites connues

- Les couvertures basses bloquent le mouvement mais pas la ligne de vue.
- Les grenades n'infligent des dégâts qu'aux hostiles.
- La caméra est fixe (pas de défilement), décor non torique.
- Le mode test unitaire n'atteste pas du rendu : un smoke test navigateur le complète.
