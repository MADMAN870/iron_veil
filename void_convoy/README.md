# Void Convoy - Convoi & Escorte Spatiale

Jeu complet de convoi et d'escorte en p5.js (mode global), illustrant les **Steering Behaviors** de Craig Reynolds.

Le joueur pilote le vaisseau amiral d'escorte (**Leader**), guide une flotte de vaisseaux civils (**Followers / Cargos**) vers un **Portail d'évacuation**, défend le convoi contre des escadrilles de **Pirates** et secourt des **Cargos dérivants** perdus dans l'espace.

---

## Règles du Jeu

* **Démarrage :** Vous démarrez **seul** (0 suiveur) aux commandes du vaisseau d'escorte.
* **Système de Vagues & Quotas :**
  * La partie se déroule en **3 vagues successives** (Vague 1: 2 cargos, Vague 2: 3 cargos, Vague 3: 4 cargos).
  * Pour chaque vague, le **nombre exact** de cargos nécessaires ([`Wanderer`](wanderer.js)) apparaît progressivement dans le secteur, espacé dans le temps (toutes les 4,5 secondes).
* **Sauvetage :** Rapprochez le Leader ou votre convoi des balises de détresse vertes pour réparer les cargos dérivants et les intégrer au convoi.
* **Menaces :** Des pirates ([`Enemy`](enemy.js)) apparaissent en escadrilles avec [`pursue`](vehicle.js) et tirent des projectiles plasma rouges ([`EnemyBullet`](enemyBullet.js)) infligeant des dégâts au convoi et au bouclier du leader.
* **Défense :** Le leader et les cargos tirent automatiquement sur les pirates à portée avec des projectiles autoguidés ([`Bullet`](bullet.js) avec [`seek`](vehicle.js)). Le leader ne s'arrête jamais et continue de répondre aux mouvements de la souris.
* **Conditions de fin :**
  * **Victoire :** Quota des 3 vagues évacué avec succès au portail.
  * **Défaite :** Destruction du leader (bouclier à 0%) ou destruction d'un cargo essentiel rendant impossible l'atteinte du quota de la vague.

---

## Comportements de Reynolds implémentés

* **Leader (`Leader extends Vehicle`)** :
  * `arrive` sur la position de la souris.
  * `boundaries` pour rester confiné dans l'arène.
  * `avoidObstacles` pour contourner le champ d'astéroïdes.
* **Cargos (`Follower extends Vehicle`)** - 2 formations commutables :
  * **Mode Transparent (défaut)** :
    * `arrive` sur un point situé derrière le leader (`queueSpacing`).
    * `separate` pour maintenir la cohésion de groupe sans collision.
    * `flee` du centre du cercle frontal d'exclusion situé devant le leader (`aheadDist`, `frontRadius`) pour dégager son cap.
    * `flee` d'urgence si un pirate s'approche à moins de 75 px.
  * **Mode Queue leu-leu** :
    * `arrive` sur un point situé `queueSpacing` pixels derrière le véhicule précédent dans la file.
  * `avoidObstacles` et `boundaries` actifs dans les deux modes.
* **Pirates (`Enemy extends Vehicle`)** :
  * `pursue` vers le cargo le plus vulnérable ou vers le leader.
  * `separate` entre pirates pour former un encerclement.
  * `avoidObstacles` et `boundaries`.
* **Cargos dérivants (`Wanderer extends Vehicle`)** :
  * `wander` avec perturbation progressive du cap, `avoidObstacles` et `boundaries`.
* **Projectiles (`Bullet extends Vehicle`)** :
  * `seek` actif vers l'ennemi ciblé.

---

## Contrôles

* **Souris** : Déplace le Leader.
* **`L` ou Clic gauche** : Alterner entre la formation *Transparent* (essaim) et *Queue leu-leu* (file indienne).
* **`W`** : Faire apparaître un cargo dérivant supplémentaire.
* **`E` ou Clic droit** : Déclencher l'arrivée d'un renfort pirate.
* **`D` ou case "Cercle frontal & cibles"** : Activer / désactiver l'affichage debug (cercle d'exclusion avant, vecteurs, cibles de suivi).
* **`P` ou bouton "Pause"** : Mettre en pause ou reprendre la simulation.
* **Curseurs temps réel** : Volume de la musique, séparation, rayon du cercle frontal, distance d'avance, espacement de file, vitesse/force max, cadence de tir.

---

## Audio & Effets Sonores

Le module [`music.js`](music.js) génère 100% de l'ambiance sonore via l'**API Web Audio** native sans aucun fichier externe :
* Musique procédurale (ligne de basse + mélodie évolutive).
* Effets sonores intégrés : tirs laser, impacts, explosions, jingles de sauvetage et d'évacuation au portail.
* Respect des politiques d'autoplay des navigateurs et coupure nette du mix en pause.

---

## Tests Unitaires

```bash
cd void_convoy
node --test tests/*.test.mjs
```

La suite de tests (20 tests automatisés) valide :
1. L'héritage de `Vehicle` pour toutes les entités mobiles.
2. Les commutations de formation (`L` et clic).
3. La disposition géométrique en file indienne.
4. La fuite du cercle frontal d'exclusion en mode transparent.
5. La détection et l'évacuation au portail avec incrément de score.
6. Le sauvetage et ralliement au convoi des wanderers.
7. La prise en chasse par les pirates avec `pursue`.
8. Le ciblage, l'impact et la destruction des balles.
9. L'évitement des obstacles et des bords.
10. Les transitions d'état (Victoire, Game Over, Pause).
11. L'absence absolue de valeurs `NaN` ou de dépassement des forces.
