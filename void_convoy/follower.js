class Follower extends Vehicle {
  constructor(x, y, idx = 0) {
    super(x, y);
    this.index = idx;
    this.r = 8;
    this.maxSpeed = 5.0;
    this.maxForce = 0.7;
    this.rayonZoneDeFreinage = 55;
    this.largeurZoneEvitementDevantVaisseau = this.r * 1.6;
    this.sepWeight = 1.4;
    this.followWeight = 1.0;
    this.avoidWeight = 1.8;
    this.boundsWeight = 1.1;
    this.fleeFrontWeight = 1.9;
    this.fleeThreatWeight = 4.5;
    this.lastHeading = 0;
    this.health = 2;
    this.maxHealth = 2;
  }
  applyBehaviors(leader, followers, obs, params = {}) {
    this.applyForce(this.separate(followers).mult(params.sepWeight || this.sepWeight));
    if (obs && obs.length > 0) {
      this.applyForce(this.avoidObstacles(obs).mult(params.avoidWeight || this.avoidWeight));
    }
    this.applyForce(this.boundaries(0, 0, width, height, 24).mult(params.boundsWeight || this.boundsWeight));

    // Si des pirates sont tres proches, reaction d'evasion / fuite d'urgence
    if (params.enemies && params.enemies.length > 0) {
      let nearest = null;
      let minDist = 75;
      for (const e of params.enemies) {
        const d = this.pos.dist(e.pos);
        if (d < minDist) {
          minDist = d;
          nearest = e;
        }
      }
      if (nearest) {
        this.applyForce(this.flee(nearest.pos).mult(this.fleeThreatWeight));
      }
    }

    if (params.freezeInShootMode && params.shootMode && params.enemy) {
      this.vel.mult(0);
      this.acc.mult(0);
      return;
    }

    if (params.mode === 'queue') {
      this.applyQueue(leader, followers, params);
    } else {
      this.applyTransparent(leader, params);
    }
  }
  applyTransparent(leader, params) {
    const ahead = params.aheadDist || 58;
    const fr = params.frontRadius || 38;
    const followDist = params.queueSpacing || 34;

    // Arrive sur le point situe derriere le leader
    this.applyForce(this.arrive(this.behindTarget(leader, followDist)).mult(params.followWeight || this.followWeight));

    // Evasion : cercle d'exclusion devant le leader
    const la = (typeof leader.getAheadPoint === 'function')
      ? leader.getAheadPoint(ahead)
      : leader.vel.copy().setMag(ahead).add(leader.pos);

    if (this.pos.dist(la) < fr && (leader.vel.mag() > 0.12 || leader.lastHeading !== undefined)) {
      this.applyForce(this.flee(la).mult(params.fleeFrontWeight || this.fleeFrontWeight));
    }
  }
  behindTarget(target, spacing) {
    let dir;
    if (target.vel && target.vel.mag() > 0.3) dir = target.vel.copy().normalize();
    else dir = createVector(cos(target.lastHeading || 0), sin(target.lastHeading || 0));
    return target.pos.copy().add(dir.mult(-spacing));
  }
  applyQueue(leader, followers, params) {
    const sp = params.queueSpacing || 34;
    if (this.index === 0) {
      const f = this.arrive(this.behindTarget(leader, sp));
      f.mult(params.followWeight || this.followWeight);
      this.applyForce(f);
    } else {
      const prev = followers.find(f => f.index === this.index - 1);
      if (prev) {
        const f = this.arrive(this.behindTarget(prev, sp));
        f.mult(params.followWeight || this.followWeight);
        this.applyForce(f);
      } else {
        this.applyForce(this.seek(leader.pos).mult(params.followWeight || this.followWeight));
      }
    }
  }
  showDebug(leader, followers, params) {
    if (params && params.mode === 'queue') {
      const sp = params.queueSpacing || 34;
      const target = (this.index === 0) ? leader : followers.find(f => f.index === this.index - 1);
      if (target) {
        const bt = this.behindTarget(target, sp);
        push();
        stroke(250, 200, 95, 120);
        strokeWeight(1);
        line(this.pos.x, this.pos.y, bt.x, bt.y);
        fill(250, 200, 95, 200);
        noStroke();
        circle(bt.x, bt.y, 4);
        pop();
      }
    }
  }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    const heading = (this.vel && this.vel.mag() > 0.1)
      ? this.vel.heading() + PI / 2
      : (this.lastHeading || 0) + PI / 2;
    rotate(heading);

    // Vaisseau Cargo / Transporteur
    fill(250, 195, 80);
    stroke(180, 130, 40);
    strokeWeight(1.5);
    beginShape();
    vertex(0, -this.r * 1.6);
    vertex(-this.r * 1.1, -this.r * 0.4);
    vertex(-this.r * 1.1, this.r * 1.2);
    vertex(this.r * 1.1, this.r * 1.2);
    vertex(this.r * 1.1, -this.r * 0.4);
    endShape(CLOSE);

    // Conteneur d'energie / noyau
    fill(100, 240, 255, 220);
    noStroke();
    circle(0, 0, 5);

    // Reacteur
    if (this.vel && this.vel.mag() > 0.2) {
      fill(255, 150, 50, 180);
      circle(0, this.r * 1.3, 4);
    }
    pop();

    // Jauge de vie si blesse
    if (this.health < this.maxHealth) {
      push();
      const bw = 18;
      const pct = Math.max(0, this.health / this.maxHealth);
      noStroke();
      fill(30, 30, 30, 180);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 6, bw, 3, 1);
      fill(255, 200, 60);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 6, bw * pct, 3, 1);
      pop();
    }
  }
}
