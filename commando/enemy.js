// Hostile : patrouille, alerte, combat. FSM simple explicite.
class Enemy extends Vehicle {
  constructor(x, y, patrol = [], opts = {}) {
    super(x, y);
    this.team = 'hostile';
    this.r = 10;
    // opts : passive (drone inoffensif) | maxHealth / damage / maxSpeed (elite de cauchemar)
    const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
    this.maxSpeed = num(opts.maxSpeed, opts.passive ? 1.1 : 2.1);
    this.maxForce = 0.3;
    this.maxHealth = num(opts.maxHealth, opts.passive ? 40 : 60);
    this.health = this.maxHealth;
    this.passive = !!opts.passive; // drones d'entrainement : n'attaquent pas
    this.detectionRadius = 210;
    this.fov = radians(115);
    this.accuracy = 0.72;
    this.damage = num(opts.damage, 8);
    this.fireCooldown = 550;
    this.maxAmmo = Infinity;
    this.ammo = Infinity;
    this.bulletSpeed = 9.5;
    this.reloadDuration = 0;

    this.patrol = patrol;          // [{x,y}, ...]
    this.patrolIndex = 0;
    this.state = 'patrol';         // patrol | alert | combat | return
    this.lastKnown = null;         // {x, y}
    this.loseTimer = 0;
    this.path = [];
    this.pathState = { index: 0 };
    this.pathGoal = null;
    this.visibleTarget = null;
    this.passiveWander = opts.passive || false;
    this.engagementMode = 'hold';   // chase | retreat | hold (hysteresis : evite le flip 180)
    this.pendingBullets = [];
  }

  smoothAngle(current, target, factor = 0.22) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * factor;
  }

  stabilizeHeading() {
    if (this.dead) return;
    if (this.visibleTarget && !this.visibleTarget.dead) {
      const aim = Math.atan2(this.visibleTarget.pos.y - this.pos.y, this.visibleTarget.pos.x - this.pos.x);
      this.lastHeading = this.smoothAngle(this.lastHeading, aim, 0.3);
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
    if (this.visibleTarget && !this.visibleTarget.dead) {
      this.lastHeading = Math.atan2(this.visibleTarget.pos.y - this.pos.y, this.visibleTarget.pos.x - this.pos.x);
      return;
    }
    if (this.vel.mag() <= 0.28) {
      this.lastHeading = prevHeading;
      return;
    }
    this.stabilizeHeading();
  }

  perceive(friendlies, world) {
    if (this.visibleTarget && !this.visibleTarget.dead) {
      const d = this.pos.dist(this.visibleTarget.pos);
      if (d <= this.detectionRadius * 1.3 && world.losClear(this.pos, this.visibleTarget.pos)) {
        return this.visibleTarget;
      }
    }
    let best = null, bestD = Infinity;
    for (const f of friendlies) {
      if (f.dead) continue;
      if (this.canSee(f, (a, b) => world.losClear(a, b))) {
        const d = this.pos.dist(f.pos);
        if (d < bestD) { best = f; bestD = d; }
      }
    }
    this.visibleTarget = best;
    return best;
  }

  updateAI(friendlies, world, now, hostiles = []) {
    this.finishReloadIfNeeded(now);
    this.perceive(friendlies, world);

    // --- Transitions FSM ---
    if (this.state !== 'combat' && this.visibleTarget) {
      this.state = 'combat';
      this.lastKnown = { x: this.visibleTarget.pos.x, y: this.visibleTarget.pos.y };
      this.loseTimer = 0;
    } else if (this.state === 'combat') {
      if (this.visibleTarget) {
        this.lastKnown = { x: this.visibleTarget.pos.x, y: this.visibleTarget.pos.y };
        this.loseTimer = now;
      } else if (this.loseTimer && now - this.loseTimer > 4000) {
        this.state = 'return';
        this.pathGoal = null;
      }
    } else if (this.state === 'return') {
      // revenu a la patrouille quand on atteint le prochain point
      if (this.pathDone() || this.patrol.length === 0) this.state = 'patrol';
    }

    // --- Force de base selon l'etat ---
    let base = createVector(0, 0);
    if (this.state === 'combat' && this.visibleTarget) {
      const t = this.visibleTarget;
      const d = this.pos.dist(t.pos);
      if (this.passive) {
        this.engagementMode = 'hold';
        base = createVector(0, 0);
      } else {
        // hysteresis : chase jusqu'a 160, retreat jusqu'a 130, sinon zone morte stable
        if (d > 190) this.engagementMode = 'chase';
        else if (d < 60) this.engagementMode = 'retreat';
        else if (this.engagementMode === 'chase' && d < 160) this.engagementMode = 'hold';
        else if (this.engagementMode === 'retreat' && d > 130) this.engagementMode = 'hold';
        if (this.engagementMode === 'chase') base = this.pursue(t);
        else if (this.engagementMode === 'retreat') base = this.flee(t.pos);
        else base = createVector(0, 0);
      }
      this.combatFire(t, now);
    } else if (this.state === 'combat' && this.lastKnown) {
      // cible perdue : avancer vers derniere position connue
      this.requestPath(this.lastKnown, world, now);
      const r = this.followPath(this.path, this.pathState, 12);
      base = r.done ? createVector(0, 0) : r.force;
      if (r.done) this.state = 'return';
    } else if (this.state === 'return' || this.state === 'patrol') {
      if (this.patrol.length > 0) {
        const wp = this.patrol[this.patrolIndex];
        const d = Math.hypot(this.pos.x - wp.x, this.pos.y - wp.y);
        if (d < 16) {
          this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
          this.pathGoal = null;
          this.path = [];
          base = createVector(0, 0);
        } else if (d < 80 && world.losClear(this.pos, wp)) {
          this.path = [];
          this.pathGoal = null;
          base = this.arrive(wp, 35);
        } else {
          this.requestPath(wp, world, now);
          const r = this.followPath(this.path, this.pathState, 14);
          base = r.force;
        }
      } else {
        base = this.wander();
      }
    }

    // separation elargie : les hostiles se tiennent a l'ecart les uns des autres (pas de tas)
    const sep = this.separate(hostiles, 60).mult(1.1);
    const avoid = (this.vel.mag() > 0.2) ? this.avoidRects(world.buildings.concat(world.covers || [])).mult(1.4) : createVector(0, 0);
    const steering = createVector(0, 0).add(base).add(sep).add(avoid).limit(this.maxForce);

    this.debug.state = this.state;
    this.debug.desired = base.copy();
    this.debug.steering = steering.copy();
    this.debug.neighbors = 0;
    this.debug.weights = { seek: this.state === 'combat' ? 1 : 0, avoidance: 1.5 };

    this.applyForce(steering);
    return steering;
  }

  requestPath(goal, world, now) {
    // reutiliser le chemin tant qu'il existe et que l'objectif n'a pas bouge (pas de reconstruction periodique = pas de saccade)
    if (this.pathGoal && Math.hypot(this.pathGoal.x - goal.x, this.pathGoal.y - goal.y) < 16
        && this.path.length > 0 && !this.pathDone()) {
      return;
    }
    this.path = world.findPath(this.pos.x, this.pos.y, goal.x, goal.y);
    if (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].y - this.pos.y) < 12) this.path.shift();
    this.pathState = { index: 0 };
    this.pathGoal = { x: goal.x, y: goal.y };
  }

  pathDone() {
    return this.path.length === 0 || this.pathState.index >= this.path.length;
  }

  combatFire(target, now) {
    if (this.passive) return null; // drones d'entrainement ne tirent pas
    if (!this.canFire(now)) return null;
    const dist = this.pos.dist(target.pos);
    const lead = dist / this.bulletSpeed;
    const px = target.pos.x + target.vel.x * lead * 0.6;
    const py = target.pos.y + target.vel.y * lead * 0.6;
    const bullet = fireBullet(this, px, py, this.damage, this.bulletSpeed, false);
    this.pendingBullets.push(bullet);
    this.consumeAmmo(now);
    this.lastHeading = Math.atan2(py - this.pos.y, px - this.pos.x);
    return bullet;
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
    rotate(this.lastHeading);
    fill(this.passive ? color(200, 120, 220) : color(235, 90, 70));
    stroke(25, 15, 15);
    strokeWeight(2);
    beginShape();
    vertex(this.r + 3, 0);
    vertex(-this.r, -this.r * 0.8);
    vertex(-this.r * 0.5, 0);
    vertex(-this.r, this.r * 0.8);
    endShape(CLOSE);
    pop();

    if (showLabels) {
      fill(255, 200, 190, 230);
      noStroke();
      textAlign(CENTER, BOTTOM);
      textSize(10);
      text(this.state.toUpperCase(), this.pos.x, this.pos.y - this.r - 4);
    }
  }
}

// Choisit, parmi des points candidats, celui qui est le plus eloigne de tous les hostiles vivants.
// Utilise pour les renforts : on ne fait pas apparaitre un nouveau hostile au milieu du tas.
function pickSpreadSpawnPoint(candidates, hostiles) {
  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    let dMin = Infinity;
    for (const h of hostiles) {
      if (!h || h.dead) continue;
      const d = Math.hypot(c.x - h.pos.x, c.y - h.pos.y);
      if (d < dMin) dMin = d;
    }
    if (best === null || dMin > bestScore) { best = c; bestScore = dMin; }
  }
  return best;
}
