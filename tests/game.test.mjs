// Tests unitaires Iron Veil : vraies methodes des classes du jeu, via un adapteur p5 minimal.
// Lancer depuis le dossier commando/ : node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v, y) {
    if (typeof v === 'number') { this.x += v; this.y += y; } else { this.x += v.x; this.y += v.y; }
    return this;
  }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const m = this.mag(); return m > 0 ? this.div(m) : this.set(0, 0); }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  static sub(a, b) { return a.copy().sub(b); }
  static add(a, b) { return a.copy().add(b); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static mult(a, n) { return a.copy().mult(n); }
}

const clock = { now: 0 };

function makeContext() {
  const sandbox = {
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    Vector,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    radians: deg => (deg * Math.PI) / 180,
    degrees: rad => (rad * 180) / Math.PI,
    constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    random: (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    millis: () => clock.now,
    frameCount: 0,
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    QUARTER_PI: Math.PI / 4,
    cos: Math.cos, sin: Math.sin, tan: Math.tan,
    acos: Math.acos, asin: Math.asin, atan: Math.atan, atan2: Math.atan2,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow, hypot: Math.hypot,
    exp: Math.exp, log: Math.log, sign: Math.sign,
    isFinite,
    Math,
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadGame() {
  const ctx = makeContext();
  for (const f of ['selection.js', 'vehicle.js', 'pathfinding.js', 'world.js', 'bullet.js', 'soldier.js', 'enemy.js', 'missions.js']) {
    const src = readFileSync(path.join(root, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext(
    '({ Vehicle, AStar, World, Soldier, Enemy, Bullet, Grenade, WEAPONS, ROLE_DEFS, getMissions, segmentIntersectsRect, pickSpreadSpawnPoint, SquadSelection })',
    ctx
  );
}

const G = loadGame();

// ---------- Steering de base ----------

test('seek pointe vers la cible et respecte maxForce', () => {
  clock.now = 0;
  const v = new G.Vehicle(0, 0);
  const f = v.seek(new Vector(100, 0));
  assert.ok(f.x > 0 && Math.abs(f.y) < 1e-6, 'la force pointe vers la cible');
  assert.ok(f.mag() <= v.maxForce + 1e-9, 'force limitee par maxForce');
});

test('seek vers une position identique retourne une force nulle', () => {
  const v = new G.Vehicle(50, 50);
  const f = v.seek(new Vector(50, 50));
  assert.equal(f.mag(), 0);
});

test('arrive ralentit dans la zone de freinage', () => {
  clock.now = 0;
  const v = new G.Vehicle(0, 0);
  v.vel.set(2.5, 0);
  const near = v.arrive(new Vector(30, 0), 90);
  assert.ok(near.mag() <= v.maxForce + 1e-9);
  // la vitesse desiree proche est reduite : la force est opposee au mouvement (freinage)
  assert.ok(near.x < 0, 'arrive freine en faiblissant la vitesse desiree');
});

test('flee s eloigne de la menace', () => {
  const v = new G.Vehicle(100, 100);
  const f = v.flee(new Vector(100, 200)); // menace en dessous
  assert.ok(f.y < 0, 'la fuite est opposee a la menace');
  assert.ok(f.mag() <= v.maxForce + 1e-9);
});

test('pursue vise la position predite de la cible', () => {
  const v = new G.Vehicle(0, 0);
  const target = new G.Vehicle(100, 0);
  target.vel.set(0, 2); // cible descend : poursuite doit viser sous l axe horizontal
  const f = v.pursue(target);
  assert.ok(f.y > 0, 'la prediction incline la poursuite vers le futur de la cible');
  assert.ok(f.mag() <= v.maxForce + 1e-9);
});

test('separation eloigne deux agents proches', () => {
  const a = new G.Vehicle(100, 100);
  const b = new G.Vehicle(130, 100);
  const fa = a.separate([a, b]);
  const fb = b.separate([a, b]);
  assert.ok(fa.x < 0, 'a est pousse vers la gauche');
  assert.ok(fb.x > 0, 'b est pousse vers la droite');
});

// ---------- A* ----------

test('A* trouve un chemin en terrain libre et contourne un mur partiel', () => {
  const astar = new G.AStar(1024, 640, 16, [{ x: 400, y: 0, w: 32, h: 400 }], 10);
  const path = astar.findPath(100, 100, 900, 100);
  assert.ok(path.length > 0, 'un chemin existe avec un passage');
  assert.ok(path[path.length - 1].x === 900 && path[path.length - 1].y === 100, 'le chemin finit a la destination exacte');
});

test('A* retourne une liste vide quand la carte est scellee', () => {
  const wall = [];
  for (let y = 0; y < 640; y += 16) wall.push({ x: 400, y, w: 40, h: 16 });
  const astar = new G.AStar(1024, 640, 16, wall, 10);
  const path = astar.findPath(100, 320, 900, 320);
  assert.equal(path.length, 0, 'aucun chemin ne traverse le mur');
});

// ---------- Monde : collision et ligne de vue ----------

test('resolveCollision pousse l agent hors d un batiment', () => {
  const world = new G.World({ buildings: [{ x: 100, y: 100, w: 80, h: 80 }], covers: [] }, 1024, 640);
  const v = new G.Vehicle(140, 140); // centre a l interieur du batiment
  world.resolveCollision(v);
  const inside = v.pos.x >= 100 && v.pos.x <= 180 && v.pos.y >= 100 && v.pos.y <= 180;
  assert.ok(!inside, 'l agent est repousse a l exterieur');
});

test('resolveCollision annule la composante de vitesse vers le mur (glissement)', () => {
  const world = new G.World({ buildings: [{ x: 100, y: 100, w: 100, h: 100 }], covers: [] }, 1024, 640);
  const v = new G.Vehicle(150, 95);
  v.vel.set(0.4, 1.5); // velocite qui penetrate dans le mur par le haut
  world.resolveCollision(v);
  assert.ok(v.pos.y <= 100 - v.r + 1e-6, 'l agent est repousse au contact');
  assert.ok(Math.abs(v.vel.y) < 1e-9, 'la composante vers le mur est supprimee');
  assert.ok(Math.abs(v.vel.x) > 0.39, 'la composante tangentielle est conservee');
});

test('losBlocked detecte un batiment entre les deux points', () => {
  const world = new G.World({ buildings: [{ x: 200, y: 100, w: 80, h: 200 }], covers: [] }, 1024, 640);
  assert.equal(world.losBlocked(100, 200, 400, 200), true);
  assert.equal(world.losBlocked(100, 50, 120, 80), false);
});

test('pointInExtraction respecte le rayon', () => {
  const world = new G.World({ extractions: [{ x: 934, y: 560, r: 42 }] }, 1024, 640);
  assert.equal(world.pointInExtraction(934, 560), true);
  assert.equal(world.pointInExtraction(100, 100), false);
});

// ---------- Soldat : armes et combat ----------

test('tir consomme les munitions et respecte le cooldown', () => {
  clock.now = 0;
  const s = new G.Soldier(200, 200, 'assault', 'Testeur', false);
  const enemy = new G.Enemy(320, 200, [], {});
  const enemies = [enemy];
  // force la perception : ennemi juste devant
  s.lastHeading = 0;
  s.perceive(enemies, new G.World({ buildings: [], covers: [] }, 1024, 640));
  assert.equal(s.visibleEnemy, enemy);
  const bullet = s.combatFire(enemy, 0);
  assert.ok(bullet, 'premier tir autorise');
  assert.equal(s.ammo, s.maxAmmo - 1);
  const blocked = s.combatFire(enemy, 10);
  assert.equal(blocked, null, 'cooldown actif : pas de second tir');
});

test('rechargement restaure le chargeur apres le delai', () => {
  clock.now = 0;
  const s = new G.Soldier(0, 0, 'assault', 'Testeur', false);
  s.ammo = 0;
  s.startReload(0);
  assert.equal(s.finishReloadIfNeeded(500), false);
  clock.now = s.reloadDuration + 1;
  assert.equal(s.finishReloadIfNeeded(clock.now), true);
  assert.equal(s.ammo, s.maxAmmo);
});

test('changement d arme conserve les munitions par arme', () => {
  clock.now = 0;
  const s = new G.Soldier(0, 0, 'assault', 'Testeur', false);
  s.weapon = 'rifle';
  s.ammo = 3;
  s.arsenal.rifle = 3;
  s.applyWeapon('rifle');
  s.switchWeapon('smg');
  assert.equal(s.weapon, 'smg');
  assert.equal(s.ammo, WEAPONS_EXPECTED().smg.mag);
  s.switchWeapon('rifle');
  assert.equal(s.ammo, 3, 'les munitions du fusil sont restaurees');
});

function WEAPONS_EXPECTED() {
  return G.WEAPONS;
}

test('degats reduisent la sante et la mort met dead a true', () => {
  const s = new G.Soldier(0, 0, 'medic', 'Testeur', false);
  s.takeDamage(30);
  assert.equal(s.health, s.maxHealth - 30);
  s.takeDamage(10000);
  assert.equal(s.dead, true);
  assert.equal(s.health, 0);
});

test('le medic identifie et soigne un allie blesse', () => {
  clock.now = 0;
  const medic = new G.Soldier(100, 100, 'medic', 'Doc', false);
  const wounded = new G.Soldier(130, 100, 'assault', 'Anvil', false);
  wounded.health = 30;
  const allies = [medic, wounded];
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  medic.visibleEnemy = null;
  const target = medic.nearestInjured(allies);
  assert.equal(target, wounded);
  const healed = medic.healTick(allies, world);
  assert.equal(healed, wounded);
  assert.ok(wounded.health > 30, 'la sante de l allie augmente');
});

// ---------- Ennemi : FSM ----------

test('un hostile passe de patrol a combat quand une cible est visible', () => {
  clock.now = 1000;
  const enemy = new G.Enemy(100, 100, [{ x: 300, y: 100 }], {});
  enemy.lastHeading = 0; // regarde vers +x
  const friendly = new G.Soldier(220, 100, 'assault', 'Anvil', false);
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  enemy.updateAI([friendly], world, 1000);
  assert.equal(enemy.state, 'combat');
  assert.ok(enemy.pendingBullets.length >= 1, 'le hostile tire sur sa cible');
});

test('un hostile en patrol sans cible navige vers son point de patrouille', () => {
  clock.now = 0;
  const enemy = new G.Enemy(100, 100, [{ x: 300, y: 100 }], {});
  enemy.lastHeading = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  enemy.updateAI([], world, 0); // aucune cible visible
  assert.equal(enemy.state, 'patrol');
  assert.ok(enemy.path.length > 0, 'un chemin de patrouille est calcule');
});

test('un drone d entrainement passif ne tire jamais', () => {
  clock.now = 0;
  const drone = new G.Enemy(100, 100, [], { passive: true });
  drone.state = 'combat';
  drone.visibleTarget = new G.Soldier(140, 100, 'assault', 'Anvil', false);
  const bullet = drone.combatFire(drone.visibleTarget, 0);
  assert.equal(bullet, null);
});

test('l engagement a une hysteresis : pas de flip chaotique aux seuils', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const enemy = new G.Enemy(100, 100, [], {});
  enemy.lastHeading = 0;
  enemy.state = 'combat';
  const friendly = new G.Soldier(0, 100, 'assault', 'Anvil', false);

  const place = d => { friendly.pos.set(100 + d, 100); friendly.vel.set(0, 0); };
  // 200 : chase
  place(200);
  enemy.updateAI([friendly], world, 1000);
  assert.equal(enemy.engagementMode, 'chase');
  // 170 : chase maintenu (hysteresis, pas de bascule)
  place(170);
  enemy.updateAI([friendly], world, 1100);
  assert.equal(enemy.engagementMode, 'chase');
  // 150 : passe en hold
  place(150);
  enemy.updateAI([friendly], world, 1200);
  assert.equal(enemy.engagementMode, 'hold');
  // 45 : retreat
  place(45);
  enemy.updateAI([friendly], world, 1300);
  assert.equal(enemy.engagementMode, 'retreat');
  // 120 : retreat maintenu (hysteresis)
  place(120);
  enemy.updateAI([friendly], world, 1400);
  assert.equal(enemy.engagementMode, 'retreat');
  // 140 : retour en hold
  place(140);
  enemy.updateAI([friendly], world, 1500);
  assert.equal(enemy.engagementMode, 'hold');
});

// ---------- Balles ----------

test('une balle avance, puis expire', () => {
  const b = new G.Bullet(0, 0, 5, 0, 10, true);
  b.update();
  assert.equal(b.pos.x, 5);
  b.life = 1;
  b.update();
  assert.equal(b.dead, true);
});

// ---------- Extraction ----------

test('countInExtraction compte les allies vivants dans la zone', () => {
  const world = new G.World({ extractions: [{ x: 900, y: 550, r: 48 }] }, 1024, 640);
  const inside = new G.Soldier(900, 550, 'assault', 'Anvil', false);
  const outside = new G.Soldier(100, 100, 'assault', 'Doc', false);
  const deadInside = new G.Soldier(905, 555, 'assault', 'Hammer', false);
  deadInside.dead = true;
  assert.equal(world.countInExtraction([inside, outside, deadInside]), 1, 'le mort ne compte pas');
  assert.equal(world.countInExtraction([]), 0);
});

test('allAliveInExtraction exige tous les vivants dans la zone', () => {
  const world = new G.World({ extractions: [{ x: 900, y: 550, r: 48 }] }, 1024, 640);
  const a = new G.Soldier(900, 550, 'assault', 'Anvil', false);
  const b = new G.Soldier(930, 560, 'medic', 'Doc', false);
  const c = new G.Soldier(100, 100, 'marksman', 'Deadeye', false);
  assert.equal(world.allAliveInExtraction([a, b]), true);
  assert.equal(world.allAliveInExtraction([a, b, c]), false, 'un allie dehors bloque l extraction');
  c.dead = true;
  assert.equal(world.allAliveInExtraction([a, b, c]), true, 'un mort ne bloque pas');
  assert.equal(world.allAliveInExtraction([c]), false, 'aucun survivant = echec');
});

test('anchorInExtraction detecte l ancre dans la zone', () => {
  const world = new G.World({ extractions: [{ x: 900, y: 550, r: 48 }] }, 1024, 640);
  assert.equal(world.anchorInExtraction({ x: 900, y: 550 }), true);
  assert.equal(world.anchorInExtraction({ x: 100, y: 100 }), false);
});

// ---------- Missions ----------

test('les 7 missions sont definies avec objectifs et extractions', () => {
  const missions = G.getMissions();
  assert.equal(missions.length, 7);
  assert.equal(missions[0].objectives[0].type, 'eliminate');
  assert.equal(missions[1].objectives[0].type, 'secure');
  assert.equal(missions[2].objectives[0].type, 'extract');
  assert.equal(missions[3].objectives[0].type, 'eliminate');
  assert.equal(missions[3].objectives[0].count, 8);
  assert.equal(missions[4].objectives[0].type, 'secure');
  assert.equal(missions[4].objectives[0].seconds, 5);
  for (const m of missions) {
    assert.ok(m.extractions.length >= 1, m.name + ' a une zone d extraction');
    assert.ok(m.spawn, m.name + ' a un point de depart');
    assert.ok(Array.isArray(m.enemies) && m.enemies.length > 0, m.name + ' a des hostiles');
    assert.ok(m.extractions.every(e => e.r >= 40), m.name + ' : zone d extraction jouable');
  }
  assert.ok(missions[2].injured, 'la mission 3 designe un soldat blesse');
  assert.ok(missions[2].reinforcements, 'la mission 3 a des renforts');
  assert.ok(missions[3].reinforcements, 'la mission 4 a des renforts');
  assert.ok(missions[4].reinforcements, 'la mission 5 a des renforts');
  assert.ok(missions[4].zone, 'la mission 5 a une zone a tenir');
  // Cauchemar : deux nouvelles missions, plus dures que Expert
  assert.equal(missions[5].difficulty, 'Cauchemar', 'la mission 6 est en Cauchemar');
  assert.equal(missions[5].objectives[0].type, 'eliminate');
  assert.equal(missions[5].objectives[0].count, 10, 'la mission 6 vise 10 hostiles');
  assert.equal(missions[5].enemies.length, 10);
  assert.ok(missions[5].reinforcements, 'la mission 6 a des renforts');
  assert.equal(missions[6].difficulty, 'Cauchemar', 'la mission 7 est en Cauchemar');
  assert.ok(missions[6].zone, 'la mission 7 a une zone a tenir');
  assert.equal(missions[6].objectives[0].type, 'secure');
  assert.equal(missions[6].objectives[0].seconds, 6, 'la mission 7 fait tenir 6 secondes');
  assert.equal(missions[6].reinforcements.maxExtra, 8);
  const elite = missions[5].enemies.concat(missions[6].enemies).filter(e => e.opts && (e.opts.maxHealth || e.opts.damage));
  assert.ok(elite.length >= 6, 'les cauchemars possedent des hostiles d\'elite');
});

// ---------- Stabilite du cap & Anti-jitter ----------

test('stabilite de cap : pas de flip a basse vitesse (anti-jitter)', () => {
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  s.lastHeading = 1.2;
  s.vel.set(0.12, -0.08); // mag ~ 0.14 <= 0.25
  s.update();
  assert.equal(s.lastHeading, 1.2, 'le cap est preserve a basse vitesse');
});

test('stabilite de cap : orientation continue vers l ennemi en combat meme sans tir', () => {
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  const enemy = new G.Enemy(200, 100, [], {}); // plein est (angle 0)
  s.lastHeading = Math.PI / 2; // regardait vers le sud
  s.visibleEnemy = enemy;
  s.stabilizeHeading();
  assert.ok(s.lastHeading < Math.PI / 2 && s.lastHeading > 0, 'le regard s oriente vers l ennemi');
});

test('smoothAngle gere la transition circulaire autour de PI sans tour complet a 360', () => {
  const s = new G.Soldier(0, 0, 'assault', 'Anvil', false);
  const smoothed = s.smoothAngle(3.0, -3.0, 0.5);
  assert.ok(smoothed > 2.9 || smoothed < -2.9, 'la transition angulaire prend le chemin le plus court sans 360');
});

// ---------- Formation et espacement de l escouade ----------

test('l escouade a des positions de formation espacees sans conflit de separation', () => {
  const roles = ['assault', 'medic', 'marksman', 'support'];
  const soldiers = roles.map(r => new G.Soldier(0, 0, r, r, false));
  const offsets = soldiers.map(s => s.getFormationOffset());

  for (let i = 0; i < offsets.length; i++) {
    for (let j = i + 1; j < offsets.length; j++) {
      const d = Math.hypot(offsets[i].dx - offsets[j].dx, offsets[i].dy - offsets[j].dy);
      assert.ok(d >= 40, `espacement suffisant entre ${roles[i]} et ${roles[j]} (${d.toFixed(1)} px)`);
    }
  }
});

test('les offsets d extraction gardent tous les membres dans la zone et espaces', () => {
  const roles = ['assault', 'medic', 'marksman', 'support'];
  const soldiers = roles.map(r => new G.Soldier(0, 0, r, r, false));
  const offsets = soldiers.map(s => s.getExtractionOffset());

  for (let i = 0; i < offsets.length; i++) {
    const dFromCenter = Math.hypot(offsets[i].dx, offsets[i].dy);
    assert.ok(dFromCenter <= 60, `${roles[i]} est bien a l interieur du rayon 80`);
    for (let j = i + 1; j < offsets.length; j++) {
      const d = Math.hypot(offsets[i].dx - offsets[j].dx, offsets[i].dy - offsets[j].dy);
      assert.ok(d >= 40, `espacement suffisant dans l extraction entre ${roles[i]} et ${roles[j]}`);
    }
  }
});

// ---------- Zones d extraction elargies et sans collision ----------

test('toutes les zones d extraction sont elargies a au moins 75 px et libres de batiments', () => {
  const missions = G.getMissions();
  for (const m of missions) {
    for (const ext of m.extractions) {
      assert.ok(ext.r >= 75, `${m.name} : extraction large (r >= 75 px, recu ${ext.r})`);
      for (const b of m.buildings) {
        const cx = Math.max(b.x, Math.min(ext.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(ext.y, b.y + b.h));
        const d = Math.hypot(ext.x - cx, ext.y - cy);
        assert.ok(d >= ext.r, `${m.name} : batiment trop proche de l extraction (dist ${d.toFixed(1)} < ${ext.r})`);
      }
    }
  }
});

// ---------- Retention de cible en combat (anti-flip FOV) ----------

test('retention de cible : un soldat ne perd pas sa cible en reculant ou en tournant la tete', () => {
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  const enemy = new G.Enemy(200, 100, [], {});
  s.visibleEnemy = enemy;
  // Le soldat tourne la tete a l oppose
  s.lastHeading = Math.PI;
  s.perceive([enemy], world);
  assert.equal(s.visibleEnemy, enemy, 'la cible est conservee tant qu elle est a portee et en ligne de vue');
});

test('retention de cible : un hostile conserve sa cible engagée en retrait tactique', () => {
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const enemy = new G.Enemy(100, 100, [], {});
  const friendly = new G.Soldier(200, 100, 'assault', 'Anvil', false);
  enemy.visibleTarget = friendly;
  enemy.lastHeading = Math.PI;
  enemy.perceive([friendly], world);
  assert.equal(enemy.visibleTarget, friendly, 'l hostile conserve sa cible en retrait');
});

// ---------- Commandes de l'escouade : Tenir / Combat / Suivre / Soigner ----------

test('Tenir : le soldat reste immobile mais riposte sur un ennemi visible', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  s.command = 'hold';
  s.lastHeading = 0;
  const enemy = new G.Enemy(180, 100, [], {});
  s.perceive([enemy], world);
  assert.equal(s.visibleEnemy, enemy);
  const steering = s.baseSteering([s], [enemy], world, 0);
  assert.equal(steering.mag(), 0, 'en Tenir, aucune force de deplacement');
  assert.ok(s.pendingBullets.length >= 1, 'le soldat riposte sur l\'ennemi visible');
});

test('Tenir : sans ennemi visible, aucune force et aucun tir', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  s.command = 'hold';
  const steering = s.baseSteering([s], [], world, 0);
  assert.equal(steering.mag(), 0);
  assert.equal(s.pendingBullets.length, 0);
});

test('Combat : sans ennemi visible, le soldat chasse le hostile le plus proche via A*', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  s.command = 'combat';
  s.visibleEnemy = null;
  const far = new G.Enemy(700, 100, [], {});
  const near = new G.Enemy(300, 100, [], {});
  const f = s.baseSteering([s], [far, near], world, 0);
  assert.ok(f.mag() > 0, 'force de chasse non nulle');
  assert.ok(f.x > 0, 'la chasse va vers les hostiles (a droite)');
  assert.ok(s.path.length > 0, 'un chemin de chasse est calcule');
  assert.ok(Math.hypot(s.pathGoal.x - 300, s.pathGoal.y - 100) < 1e-6, 'le chemin vise le hostile le plus proche');
});

test('Combat : sans hostile vivant, aucune force', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const s = new G.Soldier(100, 100, 'assault', 'Anvil', false);
  s.command = 'combat';
  const dead = new G.Enemy(200, 100, [], {});
  dead.dead = true;
  const f = s.baseSteering([s], [dead], world, 0);
  assert.equal(f.mag(), 0);
});

test('Suivre : le soldat file vers l\'allie choisi au clic, pas vers le joueur', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const player = new G.Soldier(80, 100, 'assault', 'Vous', true);
  const target = new G.Soldier(620, 480, 'marksman', 'Deadeye', false);
  const follower = new G.Soldier(500, 420, 'assault', 'Anvil', false);
  follower.command = 'follow';
  follower.followTarget = target;
  const f = follower.baseSteering([player, target, follower], [], world, 0);
  assert.ok(f.x > 0 && f.y > 0, 'la force va vers la cible choisie (bas-droite), pas vers le joueur (haut-gauche)');
});

test('Suivre : sans cible choisie, le soldat suit le joueur (comportement historique)', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const player = new G.Soldier(80, 100, 'assault', 'Vous', true);
  const follower = new G.Soldier(500, 420, 'assault', 'Anvil', false);
  follower.command = 'follow';
  follower.followTarget = null;
  const f = follower.baseSteering([player, follower], [], world, 0);
  assert.ok(f.x < 0 && f.y < 0, 'la force va vers le joueur (haut-gauche)');
});

test('Suivre : une cible morte fait repli sur le joueur et efface le choix', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const player = new G.Soldier(80, 100, 'assault', 'Vous', true);
  const target = new G.Soldier(620, 480, 'marksman', 'Deadeye', false);
  target.dead = true;
  const follower = new G.Soldier(500, 420, 'assault', 'Anvil', false);
  follower.command = 'follow';
  follower.followTarget = target;
  const f = follower.baseSteering([player, target, follower], [], world, 0);
  assert.equal(follower.followTarget, null, 'la reference a la cible morte est effacee');
  assert.ok(f.x < 0 && f.y < 0, 'repli vers le joueur');
});

test('Rallier : ignore la cible Suivre et se rallie au joueur', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const player = new G.Soldier(80, 100, 'assault', 'Vous', true);
  const target = new G.Soldier(620, 480, 'marksman', 'Deadeye', false);
  const follower = new G.Soldier(500, 420, 'assault', 'Anvil', false);
  follower.command = 'regroup';
  follower.followTarget = target; // ne devrait pas influencer Rallier
  const f = follower.baseSteering([player, target, follower], [], world, 0);
  assert.ok(f.x < 0 && f.y < 0, 'la force va vers le joueur');
});

test('Soigner : Doc rejoint la cible choisie, meme si un autre allie est plus blesse', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const medic = new G.Soldier(100, 100, 'medic', 'Doc', false);
  const chosen = new G.Soldier(600, 100, 'assault', 'Anvil', false);
  chosen.health = 70; // blesse (< 75 %)
  const closerWounded = new G.Soldier(130, 100, 'support', 'Hammer', false);
  closerWounded.health = 10; // beaucoup plus blesse et plus proche : ne doit pas prime en ordre Soigner
  medic.command = 'heal';
  medic.healTarget = chosen;
  const f = medic.baseSteering([medic, chosen, closerWounded], [], world, 0);
  assert.ok(f.x > 0, 'Doc part vers la cible choisie (a droite)');
  assert.equal(medic.healTarget, chosen);
});

test('Soigner : une cible morte clot la mission de soin et repasse en Tenir', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const medic = new G.Soldier(100, 100, 'medic', 'Doc', false);
  const chosen = new G.Soldier(140, 100, 'assault', 'Anvil', false);
  chosen.dead = true;
  medic.command = 'heal';
  medic.healTarget = chosen;
  medic.baseSteering([medic, chosen], [], world, 0);
  assert.equal(medic.command, 'hold', 'sortie du mode Soin cible');
  assert.equal(medic.healTarget, null);
});

test('Soigner : la cible pleine sante reste assignee mais passe en position d’attente sans sur-soin', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const medic = new G.Soldier(100, 100, 'medic', 'Doc', false);
  const chosen = new G.Soldier(200, 100, 'assault', 'Anvil', false);
  chosen.health = chosen.maxHealth;
  medic.command = 'heal';
  medic.healTarget = chosen;
  const f = medic.baseSteering([medic, chosen], [], world, 0);
  assert.equal(medic.command, 'heal', 'la cible choisie reste le patient assigne');
  assert.equal(medic.healTarget, chosen);
  assert.ok(f.x > 0, 'Doc se poste pres de son patient');
  medic.healTick([medic, chosen], world);
  assert.equal(chosen.health, chosen.maxHealth, 'pas de sur-soin au-dela du maximum');
});

test('Soigner : un ennemi visible prime sur le soin (le medic riposte)', () => {
  clock.now = 0;
  const world = new G.World({ buildings: [], covers: [] }, 1024, 640);
  const medic = new G.Soldier(100, 100, 'medic', 'Doc', false);
  medic.lastHeading = 0;
  const patient = new G.Soldier(600, 100, 'assault', 'Anvil', false);
  patient.health = 20;
  medic.command = 'heal';
  medic.healTarget = patient;
  const enemy = new G.Enemy(180, 100, [], {});
  medic.perceive([enemy], world);
  medic.baseSteering([medic, patient], [enemy], world, 0);
  assert.ok(medic.pendingBullets.length >= 1, 'le medic tire sur la menace au lieu de soigner');
});

// ---------- Hostiles : espacement et repartition des renforts ----------

test('separation hostile elargie : deux hostiles a 45 px se repoussent encore', () => {
  const a = new G.Enemy(100, 100, [], {});
  const b = new G.Enemy(145, 100, [], {});
  // 45 px est hors de l'ancienne portee (36) mais dans la nouvelle (60)
  const f = a.separate([a, b], 60);
  assert.ok(f.x < 0, 'les hostiles se tiennent a l\'ecart');
});

test('pickSpreadSpawnPoint choisit le point le plus eloigne des hostiles vivants', () => {
  const hostiles = [new G.Enemy(10, 10, [], {}), new G.Enemy(20, 15, [], {})];
  const pts = [{ x: 20, y: 20 }, { x: 900, y: 600 }, { x: 100, y: 100 }];
  assert.deepEqual(G.pickSpreadSpawnPoint(pts, hostiles), { x: 900, y: 600 });
});

test('pickSpreadSpawnPoint ignore les hostiles morts et retourne un point si tout est mort', () => {
  const dead = new G.Enemy(905, 605, [], {});
  dead.dead = true;
  const live = new G.Enemy(15, 15, [], {});
  const pts = [{ x: 20, y: 20 }, { x: 900, y: 600 }];
  assert.deepEqual(G.pickSpreadSpawnPoint(pts, [dead, live]), { x: 900, y: 600 }, 'le mort ne protege pas le point de spawn');
  const allDead = [new G.Enemy(15, 15, [], {})];
  allDead[0].dead = true;
  const chosen = G.pickSpreadSpawnPoint(pts, allDead);
  assert.ok(pts.includes(chosen) || (chosen.x === 20 && chosen.y === 20), 'sans hostile vivant, un point quelconque est retourne sans planter');
});

test('pickSpreadSpawnPoint retourne null sur une liste vide', () => {
  assert.equal(G.pickSpreadSpawnPoint([], [new G.Enemy(0, 0, [], {})]), null);
});

// ---------- Selection multiple de l'escouade ----------

function mkAi(n) {
  const roles = ['assault', 'medic', 'marksman', 'support'];
  return roles.slice(0, n).map((r, i) => new G.Soldier(10 * i, 10 * i, r, 'U' + i, false));
}

test('selection vide : le pool vise toute l\'IA vivante', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  units[1].dead = true;
  const pool = s.pool(units);
  assert.deepEqual([...pool.map(u => u.name)], ['U0', 'U2', 'U3'], 'les morts sont exclus');
});

test('toggle ajoute puis retire un soldat ; le dernier clique devient principal', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  s.toggle(units[0]);
  s.toggle(units[1]);
  assert.equal(s.size, 2);
  assert.equal(s.primary, units[1], 'le dernier clique est le principal');
  s.toggle(units[0]); // retire U0
  assert.equal(s.size, 1);
  assert.equal(s.primary, units[1]);
  s.toggle(units[1]); // retire le principal -> pool vide
  assert.equal(s.size, 0);
  assert.equal(s.primary, null);
});

test('toggle : retirer le principal privilegie le membre restant le plus recent', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  s.selectExactly([units[0], units[1], units[2]]);
  assert.equal(s.primary, units[2]);
  s.toggle(units[2]); // retire le principal
  assert.equal(s.primary, units[1], 'le membre restant le plus recent devient principal');
});

test('pool : la selection reduit la cible des commandes a ses membres vivants', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  s.selectExactly([units[0], units[2]]);
  assert.deepEqual([...s.pool(units).map(u => u.name)], ['U0', 'U2']);
});

test('list purge les morts de la selection et repare le principal', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  s.selectExactly([units[0], units[1]]);
  units[1].dead = true;
  const list = s.list();
  assert.deepEqual([...list.map(u => u.name)], ['U0']);
  assert.equal(s.primary, units[0]);
});

test('selectExactly avec une liste de morts ne selectionne rien', () => {
  const s = new G.SquadSelection();
  const units = mkAi(2);
  units[0].dead = true;
  s.selectExactly([units[0]]);
  assert.equal(s.size, 0);
  assert.equal(s.primary, null);
});

test('selectAll selectionne toute l\'IA vivante, clear tout efface', () => {
  const s = new G.SquadSelection();
  const units = mkAi(4);
  units[3].dead = true;
  s.selectAll(units);
  assert.equal(s.size, 3);
  s.clear();
  assert.equal(s.size, 0);
  assert.deepEqual([...s.pool(units).map(u => u.name)], ['U0', 'U1', 'U2'], 'sans selection : toute l\'IA vivante');
});

// ---------- Hostiles d'elite (options de cauchemar) ----------

test('opts maxHealth/damage/maxSpeed remplacent les valeurs par defaut', () => {
  const e = new G.Enemy(0, 0, [], { maxHealth: 80, damage: 10, maxSpeed: 2.6 });
  assert.equal(e.maxHealth, 80);
  assert.equal(e.health, 80, 'la sante de depart suit le nouveau maximum');
  assert.equal(e.damage, 10);
  assert.equal(e.maxSpeed, 2.6);
});

test('sans opts, les valeurs par defaut hostiles sont preservees', () => {
  const e = new G.Enemy(0, 0, [], {});
  assert.equal(e.maxHealth, 60);
  assert.equal(e.damage, 8);
  assert.equal(e.maxSpeed, 2.1);
  const drone = new G.Enemy(0, 0, [], { passive: true });
  assert.equal(drone.maxHealth, 40);
  assert.equal(drone.maxSpeed, 1.1);
});

test('opts invalides (NaN, zero, negatif) retombent sur les defauts', () => {
  const e = new G.Enemy(0, 0, [], { maxHealth: NaN, damage: -3, maxSpeed: 0 });
  assert.equal(e.maxHealth, 60);
  assert.equal(e.damage, 8);
  assert.equal(e.maxSpeed, 2.1);
});
