// Vehicule de base du projet Commando.
// Modele par image, integration simple : la locomotion est fournie ici.
// Les sous-classes composent des forces de steering, puis appellent applyForce().
class Vehicle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.r = 10;
    this.maxSpeed = 2.5;
    this.maxForce = 0.35;

    // Combat
    this.maxHealth = 100;
    this.health = 100;
    this.maxAmmo = 12;
    this.ammo = 12;
    this.reloadDuration = 1200; // ms
    this.reloadEnd = 0;
    this.fireCooldown = 250; // ms entre deux tirs
    this.lastShot = -Infinity;
    this.detectionRadius = 230;
    this.fov = radians(110);
    this.accuracy = 0.9;

    this.lastHeading = 0;
    this.dead = false;

    // Diagnostic (AI Lab), rempli a chaque frame par la sous-classe
    this.debug = {
      state: 'init',
      desired: createVector(0, 0),
      steering: createVector(0, 0),
      neighbors: 0,
      weights: {}
    };
  }

  applyForce(f) {
    if (!f || !isFinite(f.x) || !isFinite(f.y)) return;
    this.acc.add(f);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    if (this.vel.mag() > 0.1) this.lastHeading = this.vel.heading();
  }

  isReloading(now) { return now < this.reloadEnd; }

  startReload(now) {
    if (this.isReloading(now) || this.ammo === this.maxAmmo) return false;
    this.reloadEnd = now + this.reloadDuration;
    return true;
  }

  finishReloadIfNeeded(now) {
    if (this.reloadEnd > 0 && now >= this.reloadEnd) {
      this.ammo = this.maxAmmo;
      this.reloadEnd = 0;
      return true;
    }
    return false;
  }

  canFire(now) {
    return !this.dead && !this.isReloading(now) && this.ammo > 0 && (now - this.lastShot) >= this.fireCooldown;
  }

  consumeAmmo(now) {
    this.ammo -= 1;
    this.lastShot = now;
    if (this.ammo === 0) this.startReload(now);
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) this.dead = true;
  }

  // --- Steering behaviors (retournent une force, ne deplacent pas) ---

  _targetPos(target) {
    const p = (target && target.pos) ? target.pos : target;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || !isFinite(p.x) || !isFinite(p.y)) {
      return createVector(this.pos.x, this.pos.y); // cible invalide : aucune direction
    }
    return createVector(p.x, p.y); // copie : ne jamais muter le vecteur de la cible
  }

  seek(target) {
    const tp = this._targetPos(target);
    const desired = p5.Vector.sub(tp, this.pos);
    if (desired.magSq() < 1e-9) return createVector(0, 0);
    desired.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  arrive(target, slowRadius = 90) {
    const tp = this._targetPos(target);
    const toTarget = p5.Vector.sub(tp, this.pos);
    const d = toTarget.mag();
    if (d < 1e-9) return createVector(0, 0);
    let speed = this.maxSpeed;
    if (d < slowRadius) speed = this.maxSpeed * (d / slowRadius);
    const desired = toTarget.setMag(speed);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  flee(threat) {
    const tp = this._targetPos(threat);
    const desired = p5.Vector.sub(this.pos, tp);
    if (desired.magSq() < 1e-9) return createVector(0, 0);
    desired.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  pursue(entity) {
    if (!entity) return createVector(0, 0);
    const prediction = entity.pos.copy().add(entity.vel.copy().mult(12));
    return this.seek(prediction);
  }

  evade(entity) {
    if (!entity) return createVector(0, 0);
    const force = this.pursue(entity);
    return force.mult(-1);
  }

  wander() {
    const circleCenter = this.vel.copy();
    if (circleCenter.magSq() < 1e-6) circleCenter.set(cos(this.lastHeading), sin(this.lastHeading));
    circleCenter.setMag(60).add(this.pos);
    const fc = (typeof frameCount !== 'undefined') ? frameCount : 0;
    const theta = this.lastHeading + Math.sin((this.wanderSeed || 0) + fc * 0.05) * 0.6;
    const point = createVector(cos(theta) * 30, sin(theta) * 30).add(circleCenter);
    const desired = p5.Vector.sub(point, this.pos);
    desired.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    this.wanderSeed = (this.wanderSeed || Math.random() * 1000) + 0.01;
    return steering;
  }

  separate(agents, radius = 46) {
    const steering = createVector(0, 0);
    let count = 0;
    for (const other of agents) {
      if (other === this || other.dead) continue;
      const d = this.pos.dist(other.pos);
      if (d > 0 && d < radius) {
        const away = p5.Vector.sub(this.pos, other.pos);
        away.div(d * d);
        steering.add(away);
        count++;
      }
    }
    if (count === 0) return steering;
    steering.div(count);
    if (steering.magSq() < 1e-9) return steering;
    steering.setMag(this.maxSpeed);
    steering.sub(this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  cohesion(agents, radius = 240) {
    const center = createVector(0, 0);
    let count = 0;
    for (const other of agents) {
      if (other === this || other.dead) continue;
      if (this.pos.dist(other.pos) < radius) { center.add(other.pos); count++; }
    }
    if (count === 0) return createVector(0, 0);
    center.div(count);
    return this.seek(center);
  }

  alignment(agents, radius = 120) {
    const avg = createVector(0, 0);
    let count = 0;
    for (const other of agents) {
      if (other === this || other.dead) continue;
      if (this.pos.dist(other.pos) < radius) { avg.add(other.vel); count++; }
    }
    if (count === 0) return createVector(0, 0);
    avg.div(count);
    if (avg.magSq() < 1e-9) return createVector(0, 0);
    avg.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(avg, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  // Evitement local des batiments (rectangles) via un point d'ancrage devant nous.
  avoidRects(rects) {
    const speed = this.vel.mag();
    let dir;
    if (speed > 0.1) dir = this.vel.copy().normalize();
    else dir = createVector(cos(this.lastHeading), sin(this.lastHeading));

    const ahead = p5.Vector.add(this.pos, dir.copy().mult(this.r + Math.max(28, this.maxSpeed * 14)));
    for (const rect of rects) {
      const cx = constrain(ahead.x, rect.x, rect.x + rect.w);
      const cy = constrain(ahead.y, rect.y, rect.y + rect.h);
      const d = Math.hypot(ahead.x - cx, ahead.y - cy);
      if (d < this.r + 14) {
        // pousser perpendiculairement a la normale de la face la plus proche
        const center = createVector(rect.x + rect.w / 2, rect.y + rect.h / 2);
        const push = p5.Vector.sub(this.pos, center);
        if (push.magSq() < 1e-9) push.set(1, 0);
        push.setMag(this.maxSpeed);
        const steering = p5.Vector.sub(push, this.vel);
        steering.limit(this.maxForce * 1.6);
        return steering;
      }
    }
    return createVector(0, 0);
  }

  // Suit un chemin A* : seek le waypoint courant, avance quand il est atteint.
  followPath(path, state, arriveRadius = 14) {
    if (!path || path.length === 0 || state.index >= path.length) {
      return { force: createVector(0, 0), done: true };
    }
    const wp = path[state.index];
    const d = Math.hypot(this.pos.x - wp.x, this.pos.y - wp.y);
    if (d < arriveRadius) {
      state.index += 1;
      if (state.index >= path.length) return { force: createVector(0, 0), done: true };
      return { force: this.seek(path[state.index]), done: false };
    }
    const isLast = state.index === path.length - 1;
    return { force: isLast ? this.arrive(wp, 60) : this.seek(wp), done: false };
  }

  // Detection : distance + angle de champ de vision + ligne de vue libre (fournie par la scene).
  canSee(target, losClear) {
    if (!target || target.dead) return false;
    const d = this.pos.dist(target.pos);
    if (d > this.detectionRadius) return false;
    const angleTo = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
    let diff = angleTo - this.lastHeading;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    if (Math.abs(diff) > this.fov / 2) return false;
    return losClear ? losClear(this.pos, target.pos) : true;
  }

  headingToward(point) {
    return Math.atan2(point.y - this.pos.y, point.x - this.pos.x);
  }
}
