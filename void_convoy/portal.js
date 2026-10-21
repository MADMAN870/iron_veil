class Portal {
  constructor(x, y, r = 46) {
    this.pos = createVector(x, y);
    this.r = r;
    this.pulse = 0;
  }
  update() {
    this.pulse += 0.04;
  }
  contains(vehicle) {
    if (!vehicle || !vehicle.pos) return false;
    return this.pos.dist(vehicle.pos) < (this.r + vehicle.r * 0.6);
  }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    const pulseR = this.r + sin(this.pulse) * 4;

    // Halos lumineux du portail
    noFill();
    stroke(80, 200, 255, 60);
    strokeWeight(6);
    circle(0, 0, (pulseR + 14) * 2);

    stroke(120, 220, 255, 140);
    strokeWeight(3);
    circle(0, 0, pulseR * 2);

    // Coeur du portail
    fill(40, 140, 220, 180);
    noStroke();
    circle(0, 0, (pulseR - 8) * 2);

    // Rayons tournants
    rotate(this.pulse);
    stroke(200, 240, 255, 200);
    strokeWeight(2);
    for (let a = 0; a < TWO_PI; a += PI / 2) {
      line(0, 0, cos(a) * (pulseR - 6), sin(a) * (pulseR - 6));
    }
    pop();
  }
}
