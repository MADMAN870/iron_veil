// Projectiles simules et grenades. Le tir est independant du mouvement.
class Bullet {
  constructor(x, y, vx, vy, damage, friendly) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.damage = damage;
    this.friendly = friendly; // true = escouade, false = hostile
    this.life = 90; // frames
    this.dead = false;
    this.r = 2.5;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 1;
    if (this.life <= 0) this.dead = true;
  }

  draw() {
    noStroke();
    fill(this.friendly ? color(255, 230, 140) : color(255, 120, 90));
    ellipse(this.pos.x, this.pos.y, this.r * 2, this.r * 2);
  }
}

class Grenade {
  constructor(x, y, targetX, targetY, damage, radius, fuseFrames) {
    this.pos = createVector(x, y);
    const d = Math.hypot(targetX - x, targetY - y);
    const travel = Math.min(d, 260);
    const angle = Math.atan2(targetY - y, targetX - x);
    this.target = createVector(x + cos(angle) * travel, y + sin(angle) * travel);
    this.damage = damage;
    this.radius = radius;
    this.fuse = fuseFrames;
    this.dead = false;
    this.exploded = false;
  }

  update() {
    const toTarget = p5.Vector.sub(this.target, this.pos);
    const d = toTarget.mag();
    if (d > 6) {
      toTarget.setMag(6);
      this.pos.add(toTarget);
    }
    this.fuse -= 1;
    if (this.fuse <= 0) {
      this.dead = true;
      this.exploded = true;
    }
  }

  draw() {
    push();
    noStroke();
    fill(90, 140, 90);
    ellipse(this.pos.x, this.pos.y, 6, 6);
    pop();
  }
}

// Tir avec dispersion fonction de la precision du tireur.
function fireBullet(shooter, targetX, targetY, damage, speed, friendly) {
  const baseAngle = Math.atan2(targetY - shooter.pos.y, targetX - shooter.pos.x);
  const spread = (1 - shooter.accuracy) * 0.35 + 0.015; // rad
  const angle = baseAngle + (Math.random() - 0.5) * 2 * spread;
  return new Bullet(
    shooter.pos.x + cos(angle) * (shooter.r + 4),
    shooter.pos.y + sin(angle) * (shooter.r + 4),
    cos(angle) * speed,
    sin(angle) * speed,
    damage,
    friendly
  );
}
