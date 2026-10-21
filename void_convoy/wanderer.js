class Wanderer extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 8;
    this.maxSpeed = 3.6; // Plus rapide et evasif, necessite une vraie interception !
    this.maxForce = 0.65;
    this.distanceCercle = 70;
    this.wanderRadius = 38;
    this.displaceRange = 0.35; // Changements de cap plus dynamiques
    this.avoidWeight = 3.0;
    this.boundariesWeight = 3.0;
    this.largeurZoneEvitementDevantVaisseau = this.r * 2;
    this.lastHeading = this.vel.heading();
    this.pulse = random(TWO_PI);
  }
  applyBehaviors(obs) {
    this.applyForce(this.wander());
    if (obs && obs.length > 0) {
      this.applyForce(this.avoidObstacles(obs).mult(this.avoidWeight));
    }
    this.applyForce(this.boundaries(0, 0, width, height, 30).mult(this.boundariesWeight));
  }
  show() {
    this.pulse += 0.05;
    push();
    translate(this.pos.x, this.pos.y);

    // Balise SOS lumineuse
    noFill();
    stroke(80, 230, 140, 100 + sin(this.pulse) * 80);
    strokeWeight(1.5);
    circle(0, 0, (this.r + 8 + sin(this.pulse) * 3) * 2);

    rotate(this.vel.heading() + PI / 2);
    fill(90, 220, 130);
    stroke(50, 160, 80);
    strokeWeight(1.5);
    beginShape();
    vertex(0, -this.r * 1.6);
    vertex(-this.r, this.r * 1.2);
    vertex(this.r, this.r * 1.2);
    endShape(CLOSE);

    fill(200, 255, 220);
    noStroke();
    circle(0, -2, 4);
    pop();
  }
}
