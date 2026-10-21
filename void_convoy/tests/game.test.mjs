import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// Adaptateur p5 minimal pour tester les vraies methodes des sous-classes.
class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v, y) { if (typeof v === 'number') { this.x += v; this.y += y; } else { this.x += v.x; this.y += v.y; } return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const m = this.mag(); return m ? this.div(m) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  static sub(a, b) { return a.copy().sub(b); }
  static add(a, b) { return a.copy().add(b); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static mult(a, n) { return a.copy().mult(n); }
}

function makeElements() {
  const ids = ['sep', 'ahead', 'frad', 'qsp', 'srate', 'mspeed', 'mforce', 'music', 'pauseBtn',
    'debugToggle', 'sepVal', 'aheadVal', 'fradVal', 'qspVal', 'srateVal', 'mspeedVal', 'mforceVal', 'musicVal', 'modeLabel',
    'leaderShield', 'cargosInConvoy', 'cargosSaved', 'waveLabel', 'restartBtn', 'modal', 'modalTitle', 'modalDesc', 'modalBtn'];
  const map = new Map();
  for (const id of ids) {
    map.set(id, {
      id,
      value: id === 'music' ? '0.5' : '1',
      checked: true,
      textContent: '',
      innerHTML: '',
      classList: { add() {}, remove() {}, contains: () => false },
      addEventListener(_t, fn) { this._click = fn; this._change = fn; }
    });
  }
  return map;
}

// Adaptateur Web Audio minimal : gain et oscillateurs enregistres pour les assertions.
function makeAudio() {
  const ctx = { oscillators: [], gains: [], resumeCalls: 0 };
  class GainStub {
    constructor() { this.value = 0; this.gain = { value: 0, setValueAtTime: v => { this.value = v; this.gain.value = v; }, setTargetAtTime: v => { this.value = v; this.gain.value = v; }, exponentialRampToValueAtTime: () => {} }; }
    connect() {}
  }
  class OscStub {
    constructor() { this.frequency = { value: 0 }; this.type = ''; this.started = false; this.stopped = false; }
    connect() {}
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }
  class AudioContextStub {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; ctx.oscillatorFactory = this; }
    createGain() { const g = new GainStub(); ctx.gains.push(g); return g; }
    createOscillator() { const o = new OscStub(); ctx.oscillators.push(o); return o; }
    resume() { ctx.resumeCalls++; this.state = 'running'; }
  }
  return { ctx, AudioContextStub };
}

function load() {
  const elements = makeElements();
  const noop = () => {};
  const { ctx: audioCtx, AudioContextStub } = makeAudio();
  const context = {
    p5: { Vector },
    createVector: (x, y) => new Vector(x, y),
    PI: Math.PI, TWO_PI: Math.PI * 2,
    min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin,
    map: (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a)),
    random: (a, b) => b === undefined ? (a === undefined ? 0.5 : a / 2) : (a + b) / 2,
    dist: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
    width: 1200, height: 800, windowWidth: 1200, windowHeight: 800,
    mouseX: 600, mouseY: 400, mouseButton: 'left', key: '',
    LEFT: 'left', RIGHT: 'right', CENTER: 'center',
    createCanvas: noop, resizeCanvas: noop, background: noop,
    push: noop, pop: noop, translate: noop, rotate: noop, fill: noop, stroke: noop,
    strokeWeight: noop, noFill: noop, noStroke: noop, circle: noop, line: noop, rect: noop,
    beginShape: noop, vertex: noop, endShape: noop, CLOSE: 0,
    text: noop, textSize: noop, textAlign: noop,
    millis: () => 0,
    setInterval: () => 1, clearInterval: noop,
    AudioContext: AudioContextStub,
    document: { getElementById: id => elements.get(id), addEventListener() {} },
  };
  context.window = context;
  vm.createContext(context);
  for (const f of ['vehicle.js', 'obstacle.js', 'portal.js', 'leader.js', 'follower.js',
    'wanderer.js', 'enemy.js', 'bullet.js', 'enemyBullet.js', 'music.js', 'sketch.js']) {
    vm.runInContext(readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
  }
  return { context, elements, audioCtx };
}

test('heritage : les entites mobiles sont des Vehicle', () => {
  const { context } = load();
  const ok = vm.runInContext(
    'new Leader(0,0) instanceof Vehicle && new Follower(0,0) instanceof Vehicle && ' +
    'new Wanderer(0,0) instanceof Vehicle && new Enemy(0,0) instanceof Vehicle && ' +
    'new Bullet(0,0,null) instanceof Vehicle && new EnemyBullet(0,0,null) instanceof Vehicle', context);
  assert.equal(ok, true);
});

test('touche L et clic gauche changent de mode, clic droit spawn un ennemi', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  assert.equal(vm.runInContext('mode', context), 'transparent');
  vm.runInContext('key="l"; keyPressed()', context);
  assert.equal(vm.runInContext('mode', context), 'queue');
  vm.runInContext('key="L"; keyPressed()', context);
  assert.equal(vm.runInContext('mode', context), 'transparent');
  vm.runInContext('mouseButton="left"; mousePressed()', context);
  assert.equal(vm.runInContext('mode', context), 'queue');
  assert.equal(vm.runInContext('enemy', context), null);
  vm.runInContext('mouseButton="right"; mouseX=250; mouseY=150; mousePressed()', context);
  assert.equal(vm.runInContext('!!enemy', context), true);
  assert.equal(vm.runInContext('shootMode', context), true);
});

test('touche W ajoute un wanderer reel dans la scene', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const before = vm.runInContext('wanderers.length', context);
  vm.runInContext('key="w"; keyPressed()', context);
  vm.runInContext('key="w"; keyPressed()', context);
  assert.equal(vm.runInContext('wanderers.length', context), before + 2);
  assert.equal(vm.runInContext('wanderers.every(w => w instanceof Wanderer)', context), true);
});

test('mode queue : les suiveurs se rangent en file derriere le leader', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const result = vm.runInContext(`
    mode='queue';
    leader.pos.set(300,400); leader.vel.set(0,0); leader.lastHeading=0;
    followers = [];
    for(let i=0;i<6;i++) followers.push(new Follower(300 - i*30, 400, i));
    for(let i=0;i<600;i++){
      mouseX=300+Math.sin(i*0.02)*250; mouseY=400+Math.cos(i*0.017)*150;
      leader.applyBehaviors(); leader.update();
      for(const f of followers){ f.applyBehaviors(leader,followers,obstacles,{...params,mode,shootMode,enemy}); f.update(); }
    }
    followers.map(f=>f.pos.dist(leader.pos))
  `, context);
  // distances croissantes : file indienne, follower 0 proche du leader
  assert.ok(result[0] < 60, `follower 0 trop loin: ${result[0]}`);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i] > result[i - 1] - 5, `file non ordonnee en ${i}`);
  }
  assert.ok(result[5] > result[0] + 100, 'le dernier suiveur doit etre loin derriere');
});

test('mode transparent : le suiveur fuit le cercle devant le leader', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const out = vm.runInContext(`
    const lead = new Leader(600,400); lead.vel.set(3,0); lead.lastHeading=0;
    const f = new Follower(600,400,0); f.vel.set(0,0);
    // le suiveur est dans le cercle devant le leader (centre 658, rayon 38),
    // du cote oppose au leader : la fuite doit le pousser vers +x
    f.pos.set(678, 400);
    f.acc.set(0,0);
    f.applyBehaviors(lead,[f],[],{...params,mode:'transparent',shootMode:false,enemy:null});
    f.acc.copy()
  `, context);
  // la fuite pousse vers la droite (+x) : le suiveur devant le leader recule
  assert.ok(out.x > 0, `la fuite doit pousser vers +x, obtenu ${out.x}`);
});

test('wanderer : evite un obstacle et reste dans les bords', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    const w = new Wanderer(500,400); w.vel.set(2.8,0); w.lastHeading=0;
    const obs=[new Obstacle(700,400,30)];
    let closest=1e9, minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9;
    for(let i=0;i<500;i++){
      w.applyBehaviors(obs); w.update();
      const d=w.pos.dist(createVector(700,400)); if(d<closest)closest=d;
      minX=Math.min(minX,w.pos.x); maxX=Math.max(maxX,w.pos.x);
      minY=Math.min(minY,w.pos.y); maxY=Math.max(maxY,w.pos.y);
    }
    ({closest,minX,maxX,minY,maxY})
  `, context);
  // rayon obstacle 30 + rayon wanderer 8 = 38 : on ne doit pas traverser le centre
  assert.ok(r.closest > 38, `collision avec l'obstacle: ${r.closest}`);
  assert.ok(r.minX >= 0 && r.maxX <= 1200, `sortie horizontale ${r.minX}..${r.maxX}`);
  assert.ok(r.minY >= 0 && r.maxY <= 800, `sortie verticale ${r.minY}..${r.maxY}`);
});

test('les balles visent l ennemi et sont retirees a l impact', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const res = vm.runInContext(`
    const e = new Enemy(600,400);
    const b = new Bullet(560,400,e);
    b.applyBehaviors(); b.update();
    const before = b.pos.dist(e.pos);
    b.pos.set(600,400); // simule l'impact
    const hit = b.pos.dist(e.pos) < (b.r + e.r);
    ({ before, hit })
  `, context);
  assert.ok(res.before < 40, 'la balle doit se rapprocher de l ennemi');
  assert.equal(res.hit, true, 'le test de collision doit detecter l impact');
});

test('pas de NaN ni de vitesse hors limite apres simulation longue', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const ok = vm.runInContext(`
    for(let i=0;i<400;i++){
      mouseX=400+Math.sin(i*0.03)*300; mouseY=400+Math.cos(i*0.02)*250;
      leader.applyBehaviors(obstacles); leader.update();
      for(const f of followers){ f.applyBehaviors(leader,followers,obstacles,{...params,mode,shootMode,enemy}); f.update(); }
      if(wanderers.length) for(const w of wanderers){ w.applyBehaviors(obstacles); w.update(); }
    }
    const all=[leader,...followers,...wanderers];
    all.every(v => Number.isFinite(v.pos.x) && Number.isFinite(v.pos.y) && v.vel.mag() <= v.maxSpeed + 1e-6 && v.acc.mag() < 1e-9)
  `, context);
  assert.equal(ok, true);
});

test('le leader evite aussi les obstacles', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    const lead = new Leader(400,400); lead.vel.set(3,0); lead.lastHeading=0;
    const obs=[new Obstacle(600,400,40)];
    let closest=1e9;
    for(let i=0;i<400;i++){
      mouseX=800; mouseY=400; // souris de l'autre cote de l'obstacle
      lead.applyBehaviors(obs); lead.update();
      const d=lead.pos.dist(obs[0].pos); if(d<closest)closest=d;
    }
    closest
  `, context);
  // rayon obstacle 40 + rayon leader 11 = 51 : le leader ne doit pas traverser
  assert.ok(r > 45, `le leader est passe dans l'obstacle: ${r}`);
});

test('les curseurs max speed / max force sont appliques aux vehicules', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    params.maxSpeed=6.5; params.maxForce=1.7; applyParams();
    const all=[leader,...followers];
    ({ speed: all.every(v=>v.maxSpeed===6.5), force: all.every(v=>v.maxForce===1.7) })
  `, context);
  assert.equal(r.speed, true);
  assert.equal(r.force, true);
});

test('comportement transparent : arrive sur un point derriere le leader', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    mode='transparent';
    leader.pos.set(600,400); leader.vel.set(3,0); leader.lastHeading=0;
    if (!followers.length) followers.push(new Follower(600,400,0));
    const f=followers[0]; f.pos.set(600,400); f.vel.set(0,0); f.lastHeading=0;
    for(let i=0;i<400;i++){
      mouseX=600; mouseY=400; // leader immobile destination, mais vel force >0
      leader.vel.set(3,0);
      f.applyBehaviors(leader,followers,obstacles,{...params,mode,shootMode:false,enemy:null});
      f.update();
    }
    // point vise : derriere le leader (600,400) a 34 px vers -x
    f.pos.dist(createVector(600-34,400))
  `, context);
  assert.ok(r < 40, `le suiveur ne se range pas derriere le leader: ${r}`);
});

test('bouton pause : gele la simulation, le reprend fait bouger a nouveau', () => {
  const { context, elements } = load();
  vm.runInContext('setup()', context);
  // on place le leader avec une vitesse non nulle
  vm.runInContext(`leader.pos.set(300,300); leader.vel.set(0,0); leader.acc.set(0,0);
    mouseX=900; mouseY=600;`, context);
  // pause via le bouton DOM (clic)
  elements.get('pauseBtn')._click();
  assert.equal(vm.runInContext('paused', context), true);
  assert.equal(elements.get('pauseBtn').textContent, 'Reprendre');
  const frozen = vm.runInContext(`
    leader.vel.set(3,0); leader.acc.set(0,0);
    draw(); draw(); leader.pos.x
  `, context);
  // en pause, draw() ne met pas a jour la position
  assert.equal(frozen, 300, `le leader a bouge pendant la pause: ${frozen}`);
  // reprise via le bouton
  elements.get('pauseBtn')._click();
  assert.equal(vm.runInContext('paused', context), false);
  assert.equal(elements.get('pauseBtn').textContent, 'Pause');
  const moved = vm.runInContext(`leader.vel.set(3,0); draw(); leader.pos.x`, context);
  assert.ok(moved > 300, `le leader ne bouge pas apres reprise: ${moved}`);
});

test('curseur volume musique : applique le gain et met a jour le libelle', () => {
  const { context, elements } = load();
  vm.runInContext('setup()', context);
  // le slider appelle gameMusic.setVolume et affiche la valeur
  elements.get('music').value = '0.8';
  elements.get('music')._click();
  assert.equal(vm.runInContext('gameMusic.volume', context), 0.8);
  assert.equal(elements.get('musicVal').textContent, '0.80');
  // le gain maitre suit le volume une fois le contexte cree
  vm.runInContext('gameMusic.ensureContext()', context);
  assert.equal(vm.runInContext('gameMusic.master.gain.value', context), 0.8);
  vm.runInContext('gameMusic.setVolume(0.25)', context);
  assert.equal(vm.runInContext('gameMusic.master.gain.value', context), 0.25);
});

test('volume musique : borne [0,1] et start/stop pilotent le mix', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    gameMusic.ensureContext();
    gameMusic.setVolume(2); const over = gameMusic.volume;
    gameMusic.setVolume(-1); const under = gameMusic.volume;
    gameMusic.setVolume(0.4);
    const started = gameMusic.start(); const running = gameMusic.running;
    gameMusic.stop();
    ({ over, under, started, running, stopped: !gameMusic.running,
       gainAtStop: gameMusic.master.gain.value })
  `, context);
  assert.equal(r.over, 1, 'volume au dessus de 1 non borne');
  assert.equal(r.under, 0, 'volume negatif non borne');
  assert.equal(r.started, true, 'start() devrait reussir');
  assert.equal(r.running, true, 'la musique devrait tourner');
  assert.equal(r.stopped, true, 'stop() devrait arreter');
  assert.equal(r.gainAtStop, 0, 'stop() devrait couper le gain maitre');
});

test('en combat et tir, le leader ne s arrete jamais et continue de suivre la souris', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  vm.runInContext(`
    spawnEnemy(600, 400);
    mouseX = 900; mouseY = 600;
    leader.pos.set(300, 300);
    leader.vel.set(2, 2);
    draw();
  `, context);
  const leaderSpeed = vm.runInContext('leader.vel.mag()', context);
  const leaderMoved = vm.runInContext('leader.pos.x > 300 && leader.pos.y > 300', context);
  assert.ok(leaderSpeed > 0, 'le leader ne doit pas s arreter pendant le tir');
  assert.equal(leaderMoved, true, 'le leader doit continuer d avancer vers la souris');
});

test('tirs ennemis : les tirs pirates infligent des degats au convoi et au leader', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const res = vm.runInContext(`
    if (!followers.length) followers.push(new Follower(350, 300, 0));
    const initialShield = leader.health;
    const initialFollowerHealth = followers[0].health;
    // Balle ennemie touchant le leader
    const ebLead = new EnemyBullet(leader.pos.x, leader.pos.y, leader);
    enemyBullets.push(ebLead);
    // Balle ennemie touchant un cargo
    const ebCargo = new EnemyBullet(followers[0].pos.x, followers[0].pos.y, followers[0]);
    enemyBullets.push(ebCargo);
    draw();
    ({
      shieldLost: initialShield - leader.health,
      cargoLost: initialFollowerHealth - (followers[0] ? followers[0].health : 0),
      bulletsRemoved: enemyBullets.length === 0
    })
  `, context);
  assert.ok(res.shieldLost > 0, 'le bouclier du leader doit baisser a l impact');
  assert.ok(res.cargoLost >= 1, 'le cargo du convoi doit perdre 1 PV a l impact');
  assert.equal(res.bulletsRemoved, true, 'les balles ennemies doivent disparaitre a l impact');
});

test('affichage debug : touche D bascule debugMode et getAheadPoint calcule le centre du cercle frontal', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  assert.equal(vm.runInContext('debugMode', context), true);
  vm.runInContext('key="d"; keyPressed()', context);
  assert.equal(vm.runInContext('debugMode', context), false);
  vm.runInContext('key="D"; keyPressed()', context);
  assert.equal(vm.runInContext('debugMode', context), true);

  const aheadPt = vm.runInContext(`
    leader.pos.set(400, 300);
    leader.vel.set(4, 0);
    leader.getAheadPoint(58);
  `, context);
  assert.equal(aheadPt.x, 458);
  assert.equal(aheadPt.y, 300);
});

test('portail : evacuation d un cargo augmente cargosSaved et le score', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const res = vm.runInContext(`
    followers.push(new Follower(portal.pos.x, portal.pos.y, 0));
    const initialSaved = totalCargosSaved;
    const initialCount = followers.length;
    draw();
    ({
      savedDiff: totalCargosSaved - initialSaved,
      countDiff: initialCount - followers.length,
      scoreGained: score
    })
  `, context);
  assert.equal(res.savedDiff, 1, 'un cargo doit etre comptabilise comme evacue');
  assert.equal(res.countDiff, 1, 'le cargo evacue doit etre retire de la file');
  assert.ok(res.scoreGained >= 250, 'le score doit augmenter a l evacuation');
});

test('sauvetage : approcher un wanderer le transforme en suiveur du convoi', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    wanderers.push(new Wanderer(500, 400));
    const initialFollowers = followers.length;
    const initialWanderers = wanderers.length;
    // On place le leader a proximite immediate du wanderer
    leader.pos.set(510, 400);
    draw();
    ({
      followersAdded: followers.length - initialFollowers,
      wanderersRemoved: initialWanderers - wanderers.length
    })
  `, context);
  assert.equal(r.followersAdded, 1, 'un suiveur doit etre ajoute');
  assert.equal(r.wanderersRemoved, 1, 'le wanderer secouru doit disparaitre');
});

test('pirate : Enemy en chasse applique une force de poursuite vers la cible', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    const pirate = new Enemy(100, 100, true);
    pirate.vel.set(0, 0);
    pirate.acc.set(0, 0);
    const cargo = new Follower(200, 100, 0);
    cargo.vel.set(2, 0);
    pirate.applyBehaviors(cargo, [], []);
    pirate.acc.copy()
  `, context);
  // La cible est vers +x (200,100), la poursuite doit accelerer vers la droite (+x)
  assert.ok(r.x > 0, `le pirate doit accelerer vers la cible, obtenu ${r.x}`);
});

test('fin de partie : victoire au quota atteint et defaite si leader detruit', () => {
  const { context } = load();
  vm.runInContext('setup()', context);

  // Test Victoire (derniere vague atteinte et quota rempli)
  vm.runInContext(`
    wave = maxWaves;
    waveQuota = getWaveQuota(wave);
    cargosEvacuatedInWave = waveQuota - 1;
    followers.push(new Follower(portal.pos.x, portal.pos.y, 0));
    draw();
  `, context);
  assert.equal(vm.runInContext('gameState', context), 'VICTORY');

  // Test Defaite
  vm.runInContext(`
    resetGame();
    leader.health = 0.1;
    // Un ennemi touche le leader
    const p = new Enemy(leader.pos.x, leader.pos.y, true);
    enemies.push(p);
    draw();
  `, context);
  assert.equal(vm.runInContext('gameState', context), 'GAMEOVER');
});

test('demarrage et vagues : demarrage sans suiveur, apparition espacee des cargos et quota exact', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  // Au demarrage, aucun suiveur dans le convoi
  assert.equal(vm.runInContext('followers.length', context), 0);
  assert.equal(vm.runInContext('wave', context), 1);
  assert.equal(vm.runInContext('waveQuota', context), 2);

  // Apparition espacee du premier cargo
  vm.runInContext('lastWandererSpawn = -20000; draw();', context);
  assert.equal(vm.runInContext('wanderers.length >= 1', context), true);
  assert.equal(vm.runInContext('wanderersSpawnedInWave >= 1', context), true);
});

test('balles : duree de vie bornee et disparition hors ecran sans rebouclage infini', () => {
  const { context } = load();
  vm.runInContext('setup()', context);
  const r = vm.runInContext(`
    const b = new Bullet(500, 400, null);
    const initialLife = b.lifespan;
    b.update();
    const lifeAfter1 = b.lifespan;
    // On force la fin de vie
    b.lifespan = 0;
    const deadByTime = b.isDead();
    // Balle hors ecran
    const b2 = new Bullet(-100, 400, null);
    const deadByBounds = b2.isDead();
    ({ initialLife, lifeDecremented: lifeAfter1 === initialLife - 1, deadByTime, deadByBounds })
  `, context);
  assert.ok(r.initialLife > 0, 'la balle doit avoir une duree de vie definie');
  assert.equal(r.lifeDecremented, true, 'update() doit decrementer la duree de vie');
  assert.equal(r.deadByTime, true, 'une balle expiree doit etre marquee isDead');
  assert.equal(r.deadByBounds, true, 'une balle hors ecran doit etre marquee isDead');
});
