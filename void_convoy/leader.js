class Leader extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 12;
    this.maxSpeed = 3.4;
    this.maxForce = 0.7;
    this.avoidWeight = 2.0;
    this.lastHeading = 0;
    this.health = 100;
    this.maxHealth = 100;
  }
  getAheadPoint(aheadDist = 58) {
    let dir;
    if (this.vel.mag() > 0.12) dir = this.vel.copy().normalize();
    else if (this.lastHeading !== undefined) dir = createVector(cos(this.lastHeading), sin(this.lastHeading));
    else dir = createVector(1, 0);
    return this.pos.copy().add(dir.mult(aheadDist));
  }
  applyBehaviors(obstacles) {
    let m = createVector(mouseX, mouseY);
    this.applyForce(this.arrive(m, 40));
    this.applyForce(this.boundaries(0, 0, width, height, 26));
    if (obstacles && obstacles.length > 0) {
      this.applyForce(this.avoidObstacles(obstacles).mult(this.avoidWeight));
    }
  }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    const heading = (this.vel && this.vel.mag() > 0.1)
      ? this.vel.heading() + PI / 2
      : (this.lastHeading || 0) + PI / 2;
    rotate(heading);

    // Vaisseau Amiral (Leader)
    fill(70, 150, 255);
    stroke(30, 90, 200);
    strokeWeight(2);
    beginShape();
    vertex(0, -this.r * 1.8);
    vertex(-this.r * 1.3, this.r * 1.3);
    vertex(-this.r * 0.5, this.r * 0.9);
    vertex(0, this.r * 1.1);
    vertex(this.r * 0.5, this.r * 0.9);
    vertex(this.r * 1.3, this.r * 1.3);
    endShape(CLOSE);

    // Cockpit
    fill(210, 240, 255);
    noStroke();
    circle(0, -this.r * 0.4, 6);

    // Reacteur
    if (this.vel && this.vel.mag() > 0.2) {
      fill(80, 220, 255, 180);
      circle(0, this.r * 1.2, 5);
    }
    pop();

    // Jauge de bouclier/vie
    if (this.health < this.maxHealth) {
      push();
      const bw = 30;
      const pct = Math.max(0, this.health / this.maxHealth);
      noStroke();
      fill(30, 30, 30, 180);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 10, bw, 4, 2);
      fill(pct > 0.3 ? [60, 180, 255] : [255, 60, 60]);
      rect(this.pos.x - bw / 2, this.pos.y - this.r - 10, bw * pct, 4, 2);
      pop();
    }
  }
  showDebug(params = {}, mode = 'transparent') {
    let ahead = params.aheadDist || 58;
    let fr = params.frontRadius || 38;
    let qsp = params.queueSpacing || 34;
    let aheadPt = this.getAheadPoint(ahead);
    let dir;
    if (this.vel.mag() > 0.12) dir = this.vel.copy().normalize();
    else if (this.lastHeading !== undefined) dir = createVector(cos(this.lastHeading), sin(this.lastHeading));
    else dir = createVector(1, 0);
    let behindPt = this.pos.copy().add(dir.copy().mult(-qsp));

    push();
    if (mode === 'transparent') {
      // Segment d'orientation vers le centre du cercle frontal
      stroke(255, 120, 120, 180);
      strokeWeight(1.5);
      line(this.pos.x, this.pos.y, aheadPt.x, aheadPt.y);

      // Cercle frontal d'exclusion (zone que fuient les suiveurs)
      fill(255, 80, 80, 45);
      stroke(255, 90, 90, 220);
      strokeWeight(1.5);
      circle(aheadPt.x, aheadPt.y, fr * 2);

      // Point central du cercle frontal
      fill(255, 70, 70);
      noStroke();
      circle(aheadPt.x, aheadPt.y, 6);
    }

    // Point cible derriere le leader (pour l'arrivee des suiveurs)
    stroke(80, 220, 120, 160);
    strokeWeight(1);
    line(this.pos.x, this.pos.y, behindPt.x, behindPt.y);
    fill(80, 220, 120);
    noStroke();
    circle(behindPt.x, behindPt.y, 6);
    pop();
  }
}
