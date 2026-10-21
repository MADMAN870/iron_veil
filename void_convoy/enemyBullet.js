class EnemyBullet extends Vehicle {
  constructor(x, y, target) {
    super(x, y);
    this.target = target;
    this.r = 3.5;
    this.maxSpeed = 8.5;
    this.maxForce = 1.4;
    this.lifespan = 85;
    this.vel = createVector(random(-0.5, 0.5), random(-0.5, 0.5)).setMag(this.maxSpeed);
  }
  applyBehaviors() {
    if (this.target && this.target.pos && (this.target.health === undefined || this.target.health > 0)) {
      this.applyForce(this.seek(this.target.pos));
    }
  }
  update() {
    super.update();
    this.lifespan--;
  }
  isDead() {
    if (this.lifespan <= 0) return true;
    if (typeof width !== 'undefined' && typeof height !== 'undefined') {
      if (this.pos.x < -30 || this.pos.x > width + 30 ||
          this.pos.y < -30 || this.pos.y > height + 30) {
        return true;
      }
    }
    return false;
  }
  show() {
    push();
    fill(255, 50, 50);
    stroke(255, 140, 140, 200);
    strokeWeight(1.5);
    circle(this.pos.x, this.pos.y, this.r * 2);
    pop();
  }
}
