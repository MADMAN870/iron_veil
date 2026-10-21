class Enemy extends Vehicle {
  constructor(x, y, active = true) {
    super(x, y);
    this.r = 13;
    this.maxSpeed = active ? 3.2 : 0;
    this.maxForce = 0.65;
    this.health = 20;
    this.maxHealth = 20;
    this.avoidWeight = 2.2;
    this.lastHeading = 0;
    this.active = active;
    this.lastShoot = (typeof millis === 'function') ? millis() : 0;
    this.shootInterval = 1000; // Tir rapide et agressif (toutes les 1.0s)
  }
  applyBehaviors(target, obstacles = [], enemies = []) {
    if (!this.active) return;
    if (enemies && enemies.length > 1) {
      this.applyForce(this.separate(enemies).mult(1.5));
    }
    if (obstacles && obstacles.length > 0) {
      this.applyForce(this.avoidObstacles(obstacles).mult(this.avoidWeight));
    }
    this.applyForce(this.boundaries(0, 0, width, height, 22));
    if (target && target.pos) {
      // Poursuite de la cible (cargo le plus proche ou leader)
      const pursueForce = this.pursue(target);
      this.applyForce(pursueForce);
    }
  }
  canShoot(target, maxDist = 380) {
    if (!this.active || !target || !target.pos) return false;
    const now = (typeof millis === 'function') ? millis() : 0;
    if (now - this.lastShoot > this.shootInterval && this.pos.dist(target.pos) < maxDist) {
      this.lastShoot = now;
      return true;
    }
    return false;
  }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    const heading = (this.vel && this.vel.mag() > 0.1)
      ? this.vel.heading() + PI / 2
      : (this.lastHeading || 0) + PI / 2;
    rotate(heading);

    // Corps du vaisseau pirate
    fill(235, 60, 50);
    stroke(160, 30, 25);
    strokeWeight(2);
    beginShape();
    vertex(0, -this.r * 1.8);
    vertex(-this.r * 1.2, this.r * 1.2);
    vertex(0, this.r * 0.6);
    vertex(this.r * 1.2, this.r * 1.2);
    endShape(CLOSE);

    // Reacteur
    if (this.vel && this.vel.mag() > 0.3) {
      fill(255, 180, 40, 200);
      noStroke();
      circle(0, this.r * 1.0, 5);
    }
    pop();

    // Barre de vie si blesse
    if (this.health < this.maxHealth) {
      push();
      const bw = 24;
      const pct = Math.max(0, this.health / this.maxHealth);
      noStroke();
      fill(40, 40, 40, 180);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 8, bw, 4, 2);
      fill(240, 60, 60);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 8, bw * pct, 4, 2);
      pop();
    }
  }
}
