// Soldat de l'escouade (joueur ou IA). Role influence le steering et le combat.
const WEAPONS = {
  pistol: { label: 'Pistolet', damage: 12, cooldown: 240, mag: 12, reload: 1100, speed: 9.5, accuracy: 0.9 },
  rifle:  { label: 'Fusil',    damage: 22, cooldown: 380, mag: 8,  reload: 1500, speed: 13,  accuracy: 0.82 },
  smg:    { label: 'SMG',      damage: 6,  cooldown: 72,  mag: 32, reload: 1400, speed: 11,  accuracy: 0.66 }
};

const ROLE_DEFS = {
  assault:  { label: 'Assaut',    color: [235, 140, 60],  preferredRange: 80,  desc: 'Avance sur les objectifs, engage au contact' },
  medic:    { label: 'Medic',     color: [90, 220, 130],  preferredRange: 150, desc: 'Suit et soigne les allies blesses' },
  marksman: { label: 'Tireur',    color: [110, 170, 255], preferredRange: 280, desc: 'Maintient la distance, tire en priorite' },
  support:  { label: 'Soutien',   color: [255, 220, 90],  preferredRange: 160, desc: 'Reste avec l\'escouade, tir de couverture' }
};

class Soldier extends Vehicle {
  constructor(x, y, role, name, isPlayer = false) {
    super(x, y);
    this.role = role || 'assault';
    this.roleDef = ROLE_DEFS[this.role];
    this.name = name || 'Soldat';
    this.isPlayer = isPlayer;
    this.team = 'friendly';

    this.maxSpeed = isPlayer ? 2.9 : 2.4;
    this.maxForce = 0.34;
    this.r = 10;

    // Armes : chaque arme garde son propre chargeur
    this.weapon = null; // null au demarrage : pas de sauvegarde du chargeur par defaut
    this.arsenal = { pistol: WEAPONS.pistol.mag, rifle: WEAPONS.rifle.mag, smg: WEAPONS.smg.mag };
    this.applyWeapon('rifle');

    // IA / ordres
    this.command = 'hold';        // hold | move | follow | regroup | defend | combat | heal
    this.moveTarget = null;       // {x, y}
    this.followTarget = null;     // allie a suivre (ordre Suivre) ; null = joueur
    this.path = [];
    this.pathState = { index: 0 };
    this.pathGoal = null;
    this.lowSpeedSince = null;    // garde-fou "coince a destination" : bascule en hold
    this.visibleEnemy = null;
    this.healTarget = null;
    this.lastHealFx = 0;

    this.aiState = isPlayer ? 'manual' : 'hold';
    this.pendingBullets = [];
  }

  getFormationOffset() {
    switch (this.role) {
      case 'assault':  return { dx: -36, dy: -45 };
      case 'support':  return { dx: -36, dy:  45 };
      case 'marksman': return { dx: -78, dy: -20 };
      case 'medic':    return { dx: -78, dy:  20 };
      default:         return { dx: -45, dy:   0 };
    }
  }

  getExtractionOffset() {
    switch (this.role) {
      case 'assault':  return { dx:  28, dy: -28 };
      case 'support':  return { dx:  28, dy:  28 };
      case 'marksman': return { dx: -28, dy: -28 };
      case 'medic':    return { dx: -28, dy:  28 };
      default:         return { dx:   0, dy:   0 };
    }
  }

  smoothAngle(current, target, factor = 0.22) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * factor;
  }

  stabilizeHeading() {
    if (this.dead) return;
    if (this.visibleEnemy && !this.visibleEnemy.dead) {
      const aim = Math.atan2(this.visibleEnemy.pos.y - this.pos.y, this.visibleEnemy.pos.x - this.pos.x);
      this.lastHeading = this.smoothAngle(this.lastHeading, aim, 0.3);
      return;
    }
    if (this.role === 'medic' && this.healTarget && !this.healTarget.dead) {
      const aim = Math.atan2(this.healTarget.pos.y - this.pos.y, this.healTarget.pos.x - this.pos.x);
      this.lastHeading = this.smoothAngle(this.lastHeading, aim, 0.25);
      return;
    }
    const spd = this.vel.mag();
    if (spd > 0.25) {
      const moveAngle = this.vel.heading();
      this.lastHeading = this.smoothAngle(this.lastHeading, moveAngle, 0.2);
    }
  }

  update() {
    const prevHeading = this.lastHeading;
    super.update();
    if (!this.isPlayer) {
      if (this.visibleEnemy && !this.visibleEnemy.dead) {
        this.lastHeading = Math.atan2(this.visibleEnemy.pos.y - this.pos.y, this.visibleEnemy.pos.x - this.pos.x);
        return;
      }
      if (this.vel.mag() <= 0.28) {
        this.lastHeading = prevHeading;
        return;
      }
      this.stabilizeHeading();
    }
  }

  applyWeapon(key) {
    const w = WEAPONS[key];
    if (!w) return false;
    // sauvegarde du chargeur de l'arme precedente
    if (this.weapon && this.arsenal) this.arsenal[this.weapon] = this.ammo;
    this.weapon = key;
    this.damage = w.damage;
    this.fireCooldown = w.cooldown;
    this.maxAmmo = w.mag;
    this.ammo = this.arsenal[key];
    this.reloadDuration = w.reload;
    this.bulletSpeed = w.speed;
    this.accuracy = w.accuracy;
    this.reloadEnd = 0;
    return true;
  }

  switchWeapon(key) {
    if (!WEAPONS[key] || key === this.weapon) return false;
    return this.applyWeapon(key);
  }

  setMoveOrder(x, y, world) {
    this.moveTarget = { x, y };
    this.command = 'move';
    this.path = [];
    this.pathState = { index: 0 };
    this.pathGoal = null;
  }

  requestPath(goal, world) {
    // reutiliser le chemin tant qu'il existe et que l'objectif n'a pas bouge (pas de reconstruction periodique = pas de saccade)
    if (this.pathGoal && Math.hypot(this.pathGoal.x - goal.x, this.pathGoal.y - goal.y) < 16
        && this.path.length > 0 && !this.pathDone()) {
      return;
    }
    this.path = world.findPath(this.pos.x, this.pos.y, goal.x, goal.y);
    // sauter le premier waypoint s'il est quasiment sous nos pieds
    if (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].y - this.pos.y) < 12) this.path.shift();
    this.pathState = { index: 0 };
    this.pathGoal = { x: goal.x, y: goal.y };
  }

  pathDone() {
    return this.path.length === 0 || this.pathState.index >= this.path.length;
  }

  // Perception : ennemis visibles (rayon + FOV + ligne de vue) avec retention en combat
  perceive(enemies, world) {
    if (this.visibleEnemy && !this.visibleEnemy.dead) {
      const d = this.pos.dist(this.visibleEnemy.pos);
      if (d <= this.detectionRadius * 1.3 && world.losClear(this.pos, this.visibleEnemy.pos)) {
        return this.visibleEnemy;
      }
    }

    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      if (this.canSee(e, (a, b) => world.losClear(a, b))) {
        const d = this.pos.dist(e.pos);
        if (d < bestD) { best = e; bestD = d; }
      }
    }
    this.visibleEnemy = best;
    return best;
  }

  // Force de base selon l'etat IA (sans separation / evitement).
  baseSteering(allies, enemies, world, now) {
    // 1) Medic : priorite au soin si un allie est blesse et pas de menace immediate.
    //    En ordre Soigner, la cible choisie au clic prime sur le plus blesse.
    if (this.role === 'medic') {
      let injured = null;
      if (this.command === 'heal') {
        const t = this.healTarget;
        if (!t || t.dead) {
          // cible perdue : sortie du mode Soin cible, retour en Tenir
          this.healTarget = null;
          this.command = 'hold';
        } else {
          injured = t; // la cible choisie au clic reste le patient assigne (pas de sur-soin, pas de abandon a 100 %)
        }
      } else {
        injured = this.nearestInjured(allies);
      }
      this.healTarget = injured;
      if (injured && !this.visibleEnemy) {
        const d = this.pos.dist(injured.pos);
        if (d > 34) return this.arrive(injured.pos, 40);
        return createVector(0, 0); // en position pour soigner
      }
    }

    // 2) Combat : positionnement selon le role + tir.
    //    Tenir riposte sans se deplacer ; Combat (ordre) chasse le hostile le plus proche plus bas.
    if (this.visibleEnemy) {
      const enemy = this.visibleEnemy;
      const distE = this.pos.dist(enemy.pos);
      const pref = this.roleDef.preferredRange;
      this.combatFire(enemy, now);
      if (this.command === 'hold') return createVector(0, 0); // Tenir : immobile mais riposte
      let moveForce;
      if (this.role === 'marksman') {
        if (distE < pref - 50) moveForce = this.flee(enemy.pos);
        else if (distE > pref + 60) moveForce = this.seek(enemy.pos);
        else moveForce = createVector(0, 0);
      } else if (this.role === 'assault') {
        moveForce = this.arrive(enemy.pos, 70); // freine a l'approche : ne tourne pas autour de la cible
      } else { // support / medic en combat : tenir la distance moyenne
        if (distE < pref - 60) moveForce = this.flee(enemy.pos);
        else if (distE > pref + 80) moveForce = this.seek(enemy.pos);
        else moveForce = createVector(0, 0);
      }
      return moveForce;
    }

    // 3) Ordres
    switch (this.command) {
      case 'move': {
        if (!this.moveTarget) { this.command = 'hold'; return createVector(0, 0); }
        // coince par la separation des camarades : basculer en hold apres 2,5 s de vitesse faible
        if (this.vel.magSq() < 0.09) {
          if (this.lowSpeedSince === null) this.lowSpeedSince = now;
          else if (now - this.lowSpeedSince > 2500) {
            this.command = 'hold';
            this.moveTarget = null;
            this.path = [];
            this.lowSpeedSince = null;
            return createVector(0, 0);
          }
        } else {
          this.lowSpeedSince = null;
        }
        this.requestPath(this.moveTarget, world);
        const result = this.followPath(this.path, this.pathState, 12);
        if (result.done) { this.command = 'hold'; this.moveTarget = null; return createVector(0, 0); }
        return result.force;
      }
      case 'follow':
      case 'regroup': {
        let anchor = null;
        if (this.command === 'follow' && this.followTarget) {
          if (this.followTarget.dead) {
            this.followTarget = null; // cible perdue : retour au joueur
          } else {
            anchor = this.followTarget.pos; // allié choisi au clic (joueur ou IA)
          }
        }
        if (!anchor) anchor = this.squadAnchor(allies);
        if (!anchor) return createVector(0, 0);

        const anchorInZone = world.anchorInExtraction(anchor);
        let goal;
        let arrivalRadius;
        if (anchorInZone) {
          // Dans la zone d'extraction : se deployer dans la zone spacieuse (r = 80)
          const ext = (world.extractions && world.extractions.length > 0)
            ? (world.extractions.find(e => Math.hypot(anchor.x - e.x, anchor.y - e.y) <= e.r) || world.extractions[0])
            : { x: anchor.x, y: anchor.y };
          const off = this.getExtractionOffset();
          goal = { x: ext.x + off.dx, y: ext.y + off.dy };
          arrivalRadius = 35;
        } else {
          // Formation d'escouade espacee autour de l'ancre
          const off = this.getFormationOffset();
          goal = { x: anchor.x + off.dx, y: anchor.y + off.dy };
          arrivalRadius = (this.command === 'regroup') ? 35 : 45;
        }

        const d = Math.hypot(this.pos.x - goal.x, this.pos.y - goal.y);
        // Si nous sommes dans notre creneau de formation (< 12 px), arret fluide sans jitter
        if (d < 12) {
          this.path = [];
          this.pathGoal = null;
          this.vel.mult(0.8);
          return createVector(0, 0);
        }

        // Si nous sommes proches (< 60 px) et en vue directe : arrive direct sans churn A*
        if (d < 60 && world.losClear(this.pos, goal)) {
          this.path = [];
          this.pathGoal = null;
          return this.arrive(goal, arrivalRadius);
        }

        // Sinon : navigation A* pour contourner les obstacles
        this.requestPath(goal, world);
        const result = this.followPath(this.path, this.pathState, 14);
        return result.done ? createVector(0, 0) : result.force;
      }
      case 'combat': {
        // Chasse : sans ennemi visible, naviguer (A*) vers le hostile vivant le plus proche
        let nearest = null, nd = Infinity;
        for (const e of enemies) {
          if (!e || e.dead) continue;
          const d = this.pos.dist(e.pos);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (!nearest) return createVector(0, 0); // plus de hostile : ne rien faire
        this.requestPath(nearest.pos, world);
        const result = this.followPath(this.path, this.pathState, 14);
        return result.done ? this.arrive(nearest.pos, 40) : result.force;
      }
      case 'defend':
      case 'hold':
      default:
        return createVector(0, 0);
    }
  }

  squadAnchor(allies) {
    const player = allies.find(a => a.isPlayer && !a.dead);
    if (player) return player.pos;
    const alive = allies.filter(a => !a.dead);
    if (alive.length === 0) return null;
    const c = createVector(0, 0);
    for (const a of alive) c.add(a.pos);
    return c.div(alive.length);
  }

  nearestInjured(allies) {
    let best = null, bestD = Infinity;
    for (const a of allies) {
      if (a === this || a.dead) continue;
      if (a.health >= a.maxHealth * 0.75) continue;
      const d = this.pos.dist(a.pos);
      if (d < bestD) { best = a; bestD = d; }
    }
    return best;
  }

  healTick(allies, world) {
    if (this.role !== 'medic' || this.dead) return null;
    const target = this.healTarget || this.nearestInjured(allies);
    if (!target) return null;
    const d = this.pos.dist(target.pos);
    if (d <= 34) {
      const before = target.health;
      target.health = Math.min(target.maxHealth, target.health + 0.4);
      const now = (typeof millis !== 'undefined') ? millis() : Date.now();
      this.lastHealFx = now;
      return target;
    }
    return null;
  }

  combatFire(enemy, now) {
    if (!this.canFire(now)) return null;
    // lead leger de la cible
    const distE = this.pos.dist(enemy.pos);
    const lead = distE / (this.bulletSpeed || 11);
    const px = enemy.pos.x + enemy.vel.x * lead * 0.7;
    const py = enemy.pos.y + enemy.vel.y * lead * 0.7;
    const bullet = fireBullet(this, px, py, this.damage, this.bulletSpeed || 11, true);
    this.pendingBullets.push(bullet);
    this.consumeAmmo(now);
    this.lastHeading = Math.atan2(py - this.pos.y, px - this.pos.x);
    return bullet;
  }

  // Mise a jour complete d'un soldat IA. Le joueur (isPlayer) saute cette logique.
  updateAI(allies, enemies, world, now) {
    this.finishReloadIfNeeded(now);
    this.aiState = this.dead ? 'dead' : 'hold';

    this.perceive(enemies, world);
    const base = this.baseSteering(allies, enemies, world, now);
    // un objectif de locomotion existe-t-il ? sinon repos : frottement + pas de cohesion
    const hasGoal = base.magSq() > 1e-6;

    const sepWeight = 0.9, cohWeight = 0.2, avoidWeight = 1.4;
    const sep = this.separate(allies, 34).mult(hasGoal ? sepWeight : sepWeight * 0.3);
    const coh = hasGoal ? this.cohesion(allies, 180).mult(cohWeight) : createVector(0, 0);
    const avoid = (this.vel.mag() > 0.2) ? this.avoidRects(world.buildings.concat(world.covers || [])).mult(avoidWeight) : createVector(0, 0);

    // frottement : resorbe la vitesse residuelle
    this.vel.mult(hasGoal ? 0.96 : 0.82);

    const steering = createVector(0, 0)
      .add(base)
      .add(sep)
      .add(coh)
      .add(avoid);
    steering.limit(this.maxForce);

    this.aiState = this.dead ? 'dead'
      : this.visibleEnemy ? 'combat'
      : (this.role === 'medic' && this.healTarget) ? 'heal'
      : this.command;

    this.debug.state = this.aiState;
    this.debug.desired = base.copy();
    this.debug.steering = steering.copy();
    this.debug.neighbors = allies.filter(a => a !== this && !a.dead && this.pos.dist(a.pos) < 240).length;
    this.debug.weights = { seek: this.visibleEnemy ? 1 : 0, separation: sepWeight, cohesion: cohWeight, avoidance: avoidWeight };

    this.applyForce(steering);
    return steering;
  }

  show(showLabels = false) {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.dead) {
      stroke(150);
      strokeWeight(2);
      line(-7, -7, 7, 7);
      line(-7, 7, 7, -7);
      pop();
      return;
    }
    const c = this.roleDef.color;
    const angle = this.isPlayer ? this.aimAngle : this.lastHeading;
    rotate(angle);
    // corps
    fill(c[0], c[1], c[2]);
    stroke(20, 22, 28);
    strokeWeight(2);
    ellipse(0, 0, this.r * 2, this.r * 2);
    // direction / arme
    stroke(20, 22, 28);
    strokeWeight(3);
    line(0, 0, this.r + 6, 0);
    if (this.isPlayer) {
      noFill();
      stroke(255);
      strokeWeight(1.5);
      ellipse(0, 0, this.r * 2 + 6, this.r * 2 + 6);
    }
    pop();

    if (showLabels) {
      fill(255, 255, 255, 220);
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(10);
      text(this.name, this.pos.x, this.pos.y - this.r - 4);
    }
  }
}
