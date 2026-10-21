class Bullet extends Vehicle {
  constructor(x, y, t) {
    super(x, y);
    this.target = t;
    this.r = 3.5;
    this.maxSpeed = 9.5;
    this.maxForce = 1.6;
    this.lifespan = 75; // Environ 1.25 seconde a 60 fps
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
    const alpha = map(this.lifespan, 0, 75, 40, 255);
    fill(255, 240, 80, alpha);
    stroke(255, 170, 30, alpha * 0.7);
    strokeWeight(1.5);
    circle(this.pos.x, this.pos.y, this.r * 2);
    pop();
  }
}
