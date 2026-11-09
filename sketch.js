// Iron Veil - scene principale. Orchestration : entrees, mise a jour, rendu, HUD.
const WORLD_W = 1024;
const WORLD_H = 640;

let missions = [];
let mission = null;
let missionIndex = 0;
let world = null;
let gameState = 'menu'; // menu | playing | victory | defeat
let paused = false;

let player = null;
let friendlies = []; // inclut le joueur
let hostiles = [];
let bullets = [];
let grenades = [];
let explosions = [];
let healPulses = [];
const PIXEL = 0.5;
let pixelLayer = null;
let staticLayer = null;
let particles = [];
let flashes = [];
let camShake = 0;

let mode = 'play'; // play | command
let moveOrderArmed = false;
let followPickArmed = false; // en attente d'un clic pour choisir l'allie a suivre
let healPickArmed = false;   // en attente d'un clic pour choisir le blesse a soigner
let selected = null;         // soldat IA "principal" (dernier clique) : focus AI Lab / debug
let debugMode = true;

let kills = 0;
let secureTimer = 0;
let grenadeCount = 2;
let reinforceClock = 0;
let reinforceSpawned = 0;
let mouseDown = false;
let audioCtx = null;
let sfxEnabled = true;
let missionStartedAt = 0;
let lastSquadHud = 0;
let rosterSignature = '';
let playerWasInZone = false;

const SQUAD_OFFSETS = [
  { role: 'assault',  name: 'Anvil',   dx: -36, dy: -45 },
  { role: 'medic',    name: 'Doc',     dx: -78, dy:  20 },
  { role: 'marksman', name: 'Deadeye', dx: -78, dy: -20 },
  { role: 'support',  name: 'Hammer',  dx: -36, dy:  45 }
];

function setup() {
  const canvas = createCanvas(WORLD_W, WORLD_H);
  const container = document.getElementById('battlefieldContainer');
  if (container) canvas.parent(container);
  noSmooth();
  pixelLayer = createGraphics(Math.round(WORLD_W * PIXEL), Math.round(WORLD_H * PIXEL));
  pixelLayer.pixelDensity(1);
  if (typeof describe === 'function') {
    describe('Champ de bataille urbain en vue du dessus. Vous incarnez un soldat ou commandez une escouade de 4 IA.', LABEL);
  }

  missions = getMissions();
  buildMissionSelect();
  bindUI();
  const params = new URLSearchParams(window.location.search);
  const forced = parseInt(params.get('mission'), 10);
  if (!Number.isNaN(forced) && forced >= 1 && forced <= missions.length) {
    startMission(forced - 1); // demarre directement (pratique pour les tests et la demo)
  } else {
    startMission(0, true); // apercu derriere le menu
    gameState = 'menu';
    document.getElementById('modal').classList.add('visible');
  }
  updateHudStatics();
}

// ---------- Missions ----------

function startMission(index, asPreview = false) {
  mission = missions[index];
  missionIndex = index;
  world = new World(mission, WORLD_W, WORLD_H);
  staticLayer = createGraphics(Math.round(WORLD_W * PIXEL), Math.round(WORLD_H * PIXEL));
  staticLayer.pixelDensity(1);
  world.renderStatic(staticLayer, PIXEL);
  particles = [];
  flashes = [];
  camShake = 0;

  player = new Soldier(mission.spawn.x, mission.spawn.y, 'assault', 'Vous', true);
  player.aimAngle = 0;
  friendlies = [player];
  for (const off of SQUAD_OFFSETS) {
    const s = new Soldier(mission.spawn.x + off.dx, mission.spawn.y + off.dy, off.role, off.name, false);
    s.command = 'follow';
    friendlies.push(s);
  }
  if (mission.injured) {
    const target = friendlies.find(f => f.role === mission.injured.role && !f.isPlayer);
    if (target) target.health = mission.injured.health;
  }

  hostiles = mission.enemies.map(e => new Enemy(e.x, e.y, e.patrol || [], e.opts || {}));
  bullets = [];
  grenades = [];
  explosions = [];
  healPulses = [];
  kills = 0;
  secureTimer = 0;
  grenadeCount = 2;
  reinforceClock = 0;
  reinforceSpawned = 0;
  mode = 'play';
  moveOrderArmed = false;
  followPickArmed = false;
  healPickArmed = false;
  selection.clear();
  selected = null;
  paused = false;
  rosterSignature = '';
  lastObjectivesHtml = '';
  playerWasInZone = false;
  missionStartedAt = millis();
  paused = false;

  logLine('Operation : ' + mission.name);
  const pm = document.getElementById('pauseModal');
  if (pm) pm.classList.remove('visible');
  if (!asPreview) {
    gameState = 'playing';
    document.getElementById('modal').classList.remove('visible');
    document.getElementById('modalMenuBtn').style.display = 'none';
    document.getElementById('missionName').textContent = mission.name;
  }
  updateHudStatics();
  renderObjectives();
  updatePickHint();
  refreshCommandPanel();
}

function missionObjectivesState() {
  return mission.objectives.map(obj => {
    if (obj.type === 'eliminate') return { ...obj, done: kills >= obj.count, progress: Math.min(kills, obj.count) + ' / ' + obj.count };
    if (obj.type === 'secure') return { ...obj, done: secureTimer >= obj.seconds, progress: Math.min(secureTimer, obj.seconds).toFixed(1) + ' s / ' + obj.seconds + ' s' };
    if (obj.type === 'extract') {
      const alive = friendlies.filter(f => !f.dead);
      const inside = world.countInExtraction(friendlies);
      return { ...obj, done: world.allAliveInExtraction(friendlies), progress: inside + ' / ' + alive.length + ' dans la zone' };
    }
    return { ...obj, done: false, progress: '' };
  });
}

function allAliveInExtraction() {
  return world.allAliveInExtraction(friendlies);
}

function checkVictory() {
  if (gameState !== 'playing') return;
  const state = missionObjectivesState();
  if (state.every(o => o.done)) {
    gameState = 'victory';
    showEndModal(true);
  }
}

function checkDefeat() {
  if (gameState !== 'playing') return;
  const alive = friendlies.filter(f => !f.dead);
  if (alive.length === 0 || player.dead) {
    gameState = 'defeat';
    showEndModal(false);
  }
}

function showEndModal(won) {
  const modal = document.getElementById('modal');
  const isLast = missionIndex >= missions.length - 1;
  const title = document.getElementById('modalTitle');
  title.textContent = won ? 'MISSION ACCOMPLIE' : 'MISSION ECHOUEE';
  title.className = won ? 'end-title victory' : 'end-title defeat';
  document.getElementById('modalDesc').textContent = won
    ? (isLast ? 'Toutes les operations sont terminees. L\'escouade rentre a la base.' : 'Objectifs remplis. Pret pour l\'operation suivante ?')
    : 'L\'escouade est neutralisee ou le joueur est tombe au combat.';
  document.getElementById('missionSelect').style.display = 'none';
  document.getElementById('modalMenuBtn').style.display = 'inline-block';
  document.getElementById('modalBtn').textContent = won ? (isLast ? 'Rejouer la mission' : 'Mission suivante') : 'Reessayer';

  // statistiques de fin
  const elapsed = Math.max(0, Math.floor((millis() - missionStartedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const survivors = friendlies.filter(f => !f.dead).length;
  const totalFriendlies = friendlies.length;
  const objectivesDone = missionObjectivesState().filter(o => o.done).length;
  const objectivesTotal = mission.objectives.length;
  document.getElementById('missionStats').innerHTML =
    statCell(kills, 'hostiles neutralises') +
    statCell(mm + ':' + ss, 'duree') +
    statCell(survivors + ' / ' + totalFriendlies, 'survivants') +
    statCell(objectivesDone + ' / ' + objectivesTotal, 'objectifs');
  modal.classList.add('visible');
}

function statCell(value, label) {
  return '<div class="stat-cell"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
}

function bindModalButton() {
  document.getElementById('modalBtn').addEventListener('click', () => {
    gameMusic.start();
    if (gameState === 'menu') {
      startMission(missionIndex);
    } else if (gameState === 'victory') {
      startMission(Math.min(missionIndex + 1, missions.length - 1));
    } else if (gameState === 'defeat') {
      startMission(missionIndex);
    }
  });
  document.getElementById('modalMenuBtn').addEventListener('click', () => {
    gameMusic.start();
    returnToMenu();
  });
  document.getElementById('resumeBtn')?.addEventListener('click', () => {
    togglePause();
  });
  document.getElementById('restartMissionBtn')?.addEventListener('click', () => {
    const pm = document.getElementById('pauseModal');
    if (pm) pm.classList.remove('visible');
    paused = false;
    startMission(missionIndex);
  });
  document.getElementById('pauseMenuBtn')?.addEventListener('click', () => {
    const pm = document.getElementById('pauseModal');
    if (pm) pm.classList.remove('visible');
    returnToMenu();
  });
}

function returnToMenu() {
  paused = false;
  gameState = 'menu';
  startMission(missionIndex, true);
  gameState = 'menu';
  document.getElementById('modalTitle').textContent = 'IRON VEIL';
  document.getElementById('modalTitle').className = '';
  document.getElementById('modalDesc').textContent = 'Sept operations tactiques. Vous incarnez un soldat (WASD + souris) en mode jeu, ou commandez votre escouade (Tab) en mode commandement. Les allies et les hostiles agissent par Steering Behaviors et machines a etats.';
  document.getElementById('missionStats').innerHTML = '';
  document.getElementById('missionSelect').style.display = 'flex';
  document.getElementById('modalBtn').textContent = 'Lancer la mission';
  document.getElementById('modalMenuBtn').style.display = 'none';
  document.getElementById('modal').classList.add('visible');
}

// ---------- UI ----------

function buildMissionSelect() {
  const container = document.getElementById('missionSelect');
  container.innerHTML = '';
  missions.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.className = 'mission-btn' + (i === 0 ? ' selected' : '');
    const short = m.name.replace(/^Mission \d+ — /, '');
    btn.innerHTML = '<b>' + short + '</b><small>' + m.difficulty + '</small>';
    btn.title = m.briefing;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mission-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      missionIndex = i;
      startMission(i, true);
      gameState = 'menu';
      document.getElementById('modal').classList.add('visible');
    });
    container.appendChild(btn);
  });
}

function bindUI() {
  bindModalButton();
  document.getElementById('btnMove').addEventListener('click', () => armMoveOrder());
  document.getElementById('btnFollow').addEventListener('click', () => armFollowPick());
  document.getElementById('btnHold').addEventListener('click', () => issueCommandToSquad('hold'));
  document.getElementById('btnCombat').addEventListener('click', () => issueCommandToSquad('combat'));
  document.getElementById('btnHeal').addEventListener('click', () => armHealPick());
  document.getElementById('btnRegroup').addEventListener('click', () => issueCommandToSquad('regroup'));
  document.getElementById('btnDefend').addEventListener('click', () => issueCommandToSquad('defend'));
  document.getElementById('btnSelectAll').addEventListener('click', () => { if (mode !== 'command') toggleMode(); selectAllAi(); });
  document.getElementById('btnClearSel').addEventListener('click', () => { if (mode !== 'command') toggleMode(); clearSelection(); });
  document.getElementById('debugToggle').addEventListener('change', e => { debugMode = e.target.checked; });
  document.querySelectorAll('.weapon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      player.switchWeapon(btn.dataset.weapon);
      gameMusic.start();
      updateHudStatics();
    });
  });

  // demarrage de la musique a la premiere interaction (politique d'autoplay)
  const startAudioOnce = () => gameMusic.start();
  document.addEventListener('pointerdown', startAudioOnce);
  document.addEventListener('keydown', startAudioOnce);

  const target = () => document.querySelector('#battlefieldContainer canvas');

  document.addEventListener('mousedown', e => {
    const c = target();
    if (c && e.target === c) mouseDown = true;
  });
  document.addEventListener('mouseup', () => { mouseDown = false; });
}

function armMoveOrder() {
  if (mode !== 'command') toggleMode();
  moveOrderArmed = true;
  followPickArmed = false;
  healPickArmed = false;
  updatePickHint();
  logLine('Cliquez sur la carte pour donner l\'ordre de deplacement.');
}

// Escouade : selection multiple, modele pur dans selection.js (A = tout, X = aucun, Q = cycle simple)
const selection = new SquadSelection();

function selectionList() {
  const list = selection.list();
  selected = selection.primary;
  return list;
}

function toggleSelection(f) {
  selection.toggle(f);
  selected = selection.primary;
  rosterSignature = '';
}

function selectAllAi() {
  selection.selectAll(friendlies);
  selected = selection.primary;
  rosterSignature = '';
  logLine('Escouade selectionnee (' + selection.size + ' soldats).');
}

function clearSelection() {
  selection.clear();
  selected = null;
  rosterSignature = '';
  logLine('Selection effacee : les ordres visent toute l\'escouade IA.');
}

// Pool de soldats vises par les commandes : la selection si elle existe, sinon toute l'IA vivante
function commandPool() {
  return selection.pool(friendlies.filter(f => !f.isPlayer));
}

function pickAllyAt(x, y) {
  for (const f of friendlies) {
    if (f.dead) continue;
    if (dist(x, y, f.pos.x, f.pos.y) < 16) return f;
  }
  return null;
}

function medicHealTargets() {
  return commandPool().filter(f => f.role === 'medic');
}

function cancelPicks() {
  if (!followPickArmed && !healPickArmed) return;
  followPickArmed = false;
  healPickArmed = false;
  updatePickHint();
  logLine('Ciblage annule.');
}

function armFollowPick() {
  if (mode !== 'command') toggleMode();
  moveOrderArmed = false;
  healPickArmed = false;
  const targets = commandPool();
  if (targets.length === 0) { logLine('Aucun soldat IA a commender.'); return; }
  followPickArmed = !followPickArmed; // recliquer pour armer/desarmer
  updatePickHint();
  if (followPickArmed) logLine('Suivre : cliquez sur un allie (joueur ou IA).');
}

function armHealPick() {
  if (mode !== 'command') toggleMode();
  moveOrderArmed = false;
  followPickArmed = false;
  const medics = medicHealTargets();
  if (medics.length === 0) {
    logLine(selection.size ? 'La selection ne contient pas de medic.' : 'Aucun medic dans l\'escouade.');
    return;
  }
  healPickArmed = !healPickArmed;
  updatePickHint();
  if (healPickArmed) logLine('Soigner : cliquez sur l\'allie a soigner (joueur compris).');
}

function updatePickHint() {
  const el = document.getElementById('pickHint');
  if (!el) return;
  if (followPickArmed) el.textContent = 'SUIVRE — cliquez sur l\'allie a suivre (joueur ou IA). Clic droit pour annuler.';
  else if (healPickArmed) el.textContent = 'SOIGNER — cliquez sur l\'allie a soigner (joueur compris). Clic droit pour annuler.';
  el.hidden = !(followPickArmed || healPickArmed);
}

function refreshCommandPanel() {
  const commandSources = commandPool();
  const hasMedic = commandSources.some(t => t.role === 'medic');
  const btnHeal = document.getElementById('btnHeal');
  if (btnHeal) btnHeal.style.display = hasMedic ? '' : 'none';
  const map = { btnHold: 'hold', btnCombat: 'combat', btnMove: 'move', btnFollow: 'follow', btnHeal: 'heal', btnRegroup: 'regroup', btnDefend: 'defend' };
  const cmds = new Set(commandSources.map(t => t.command));
  const uniform = commandSources.length > 0 && cmds.size === 1;
  for (const [id, cmd] of Object.entries(map)) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('active', uniform && cmds.has(cmd));
  }
}

function issueCommandToSquad(command) {
  const targets = commandPool();
  for (const t of targets) {
    t.command = command;
    if (command !== 'move') { t.moveTarget = null; }
    if (command !== 'follow') { t.followTarget = null; }
  }
  followPickArmed = false;
  healPickArmed = false;
  updatePickHint();
  refreshCommandPanel();
  const label = selection.size === 0 ? 'Escouade' : (selection.size === 1 && selected ? selected.name : selection.size + ' soldats');
  logLine(label + ' : ordre ' + command.toUpperCase());
}

function toggleMode() {
  mode = (mode === 'play') ? 'command' : 'play';
  moveOrderArmed = false;
  followPickArmed = false;
  healPickArmed = false;
  updatePickHint();
  document.getElementById('modeBadge').textContent = mode === 'play' ? 'MODE JEU' : 'MODE COMMANDEMENT';
  document.getElementById('modeBadge').className = 'badge ' + (mode === 'play' ? 'badge-play' : 'badge-command');
}

function logLine(text) {
  const log = document.getElementById('log');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = text;
  log.prepend(line);
  while (log.children.length > 6) log.removeChild(log.lastChild);
}

let lastObjectivesHtml = '';

function renderObjectives() {
  const state = missionObjectivesState();
  const signature = JSON.stringify(state.map(o => [o.done, o.progress]));
  if (signature === lastObjectivesHtml) return;
  lastObjectivesHtml = signature;
  const ul = document.getElementById('objectiveList');
  ul.innerHTML = '';
  for (const obj of state) {
    const li = document.createElement('li');
    li.className = obj.done ? 'done' : '';
    li.textContent = obj.label + (obj.progress ? ' — ' + obj.progress : '');
    ul.appendChild(li);
  }
}

function updateHudStatics() {
  document.getElementById('missionName').textContent = mission ? mission.name : '';
  document.getElementById('ammoLabel').textContent = player ? (player.ammo + ' / ' + player.maxAmmo) : '';
  document.getElementById('grenadeLabel').textContent = grenadeCount;
  document.getElementById('reloadLabel').textContent = (player && player.isReloading(millis())) ? '(rechargement…)' : '';
  document.querySelectorAll('.weapon-btn').forEach(b => b.classList.toggle('active', player && b.dataset.weapon === player.weapon));
}

function renderSquadHud(now) {
  selectionList(); // purge les morts de la selection
  const container = document.getElementById('squadList');
  const signature = friendlies.map(f => f.name + (f.dead ? '!' : '')).join(',');
  if (signature !== rosterSignature) {
    rosterSignature = signature;
    container.innerHTML = '';
    friendlies.forEach(f => {
      if (f.isPlayer) return;
      const card = document.createElement('div');
      card.className = 'squad-card' + (selection.has(f) ? ' selected' : '') + (f.dead ? ' dead' : '');
      card.dataset.name = f.name;
      card.innerHTML =
        '<div class="sc-top"><span><b>' + f.name + '</b> <span class="sc-role">— ' + f.roleDef.label + '</span></span>' +
        '<span class="sc-role">' + f.aiState.toUpperCase() + '</span></div>' +
        '<div class="bar bar-hp' + (f.health / f.maxHealth < 0.35 ? ' low' : '') + '"><div style="width:' + (100 * f.health / f.maxHealth) + '%"></div></div>' +
        '<div class="bar bar-ammo"><div style="width:' + (f.maxAmmo ? 100 * f.ammo / f.maxAmmo : 0) + '%"></div></div>';
      card.addEventListener('click', () => { if (!f.dead) toggleSelection(f); });
      container.appendChild(card);
    });
  } else if (now - lastSquadHud > 120) {
    lastSquadHud = now;
    container.querySelectorAll('.squad-card').forEach(card => {
      const f = friendlies.find(fr => fr.name === card.dataset.name);
      if (!f) return;
      card.classList.toggle('selected', selection.has(f));
      card.classList.toggle('dead', f.dead);
      const hpBar = card.querySelector('.bar-hp');
      hpBar.classList.toggle('low', f.health / f.maxHealth < 0.35);
      hpBar.firstElementChild.style.width = (100 * f.health / f.maxHealth) + '%';
      card.querySelector('.bar-ammo').firstElementChild.style.width = (f.maxAmmo ? 100 * f.ammo / f.maxAmmo : 0) + '%';
      card.querySelector('.sc-role:last-child').textContent = f.aiState.toUpperCase();
    });
  }
  refreshCommandPanel();
}

function updateAiLab() {
  const focus = selected || player;
  if (!focus) return;
  const extra = selection.size > 1 ? ' (+' + (selection.size - 1) + ' selectionnes)' : '';
  document.getElementById('labName').textContent = focus.name + ' (' + (focus.isPlayer ? 'JOUEUR' : focus.roleDef.label.toUpperCase()) + ')' + extra;
  document.getElementById('labState').textContent = focus.isPlayer ? 'manuel' : String(focus.aiState).toUpperCase();
  document.getElementById('labDesired').textContent = focus.debug.desired.mag().toFixed(2);
  document.getElementById('labVelocity').textContent = focus.vel.mag().toFixed(2);
  document.getElementById('labSteering').textContent = focus.debug.steering.mag().toFixed(2);
  document.getElementById('labRadius').textContent = Math.round(focus.detectionRadius) + ' px';
  document.getElementById('labNeighbors').textContent = focus.debug.neighbors;
  document.getElementById('labWeights').textContent = Object.entries(focus.debug.weights)
    .filter(([, v]) => v > 0).map(([k, v]) => k + ':' + v).join('  ') || '—';
}

function drawMinimap() {
  const mm = document.getElementById('minimap');
  const ctx = mm.getContext('2d');
  const sx = mm.width / WORLD_W, sy = mm.height / WORLD_H;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, mm.width, mm.height);
  ctx.fillStyle = '#3a3f52';
  for (const b of world.buildings) ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
  ctx.fillStyle = '#4c4436';
  for (const c of world.covers) ctx.fillRect(c.x * sx, c.y * sy, c.w * sx, c.h * sy);
  if (world.zone) {
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(world.zone.x * sx, world.zone.y * sy, world.zone.r * sx, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#29e0f0';
  for (const e of world.extractions) {
    ctx.beginPath();
    ctx.arc(e.x * sx, e.y * sy, e.r * sx, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const h of hostiles) {
    if (h.dead) continue;
    ctx.fillStyle = '#ff6a55';
    ctx.fillRect(h.pos.x * sx - 2, h.pos.y * sy - 2, 4, 4);
  }
  for (const f of friendlies) {
    if (f.dead) continue;
    ctx.fillStyle = f.isPlayer ? '#ffffff' : '#5ad08a';
    ctx.beginPath();
    ctx.arc(f.pos.x * sx, f.pos.y * sy, f.isPlayer ? 3 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Boucle ----------

function draw() {
  try {
    drawFrame();
  } catch (err) {
    showFatal(err);
  }
}

function showFatal(err) {
  let b = document.getElementById('fatalBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'fatalBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:8px 14px;font:12px monospace;z-index:99;white-space:pre-wrap;';
    document.body.appendChild(b);
  }
  b.textContent += 'draw: ' + (err && err.stack ? err.stack : err) + '\n';
}

function drawFrame() {
  const now = millis();

  if (gameState === 'playing' && !paused) {
    updateWorld(now);
  }

  // --- rendu pixel-art : static layer + dynamique en demi-res, upscale x2 ---
  const pg = pixelLayer;
  pg.clear();
  pg.image(staticLayer, 0, 0, pg.width, pg.height);
  pg.push();
  if (camShake > 0.4) {
    pg.translate(random(-camShake, camShake), random(-camShake, camShake));
    camShake *= 0.9;
  } else {
    camShake = 0;
  }
  pg.scale(PIXEL, PIXEL);
  drawZoneAndExtraction(pg, now);
  if (debugMode) drawDebugPixels(pg, now);
  drawAgentsPixel(pg);
  drawProjectilesPixel(pg, now);
  if (mode === 'command') drawCommandCursorPixel(pg);
  pg.pop();

  background(10, 11, 16);
  image(pg, 0, 0, WORLD_W, WORLD_H);

  checkVictory();
  checkDefeat();

  renderObjectives();
  renderSquadHud(now);
  updateAiLab();
  drawMinimap();
  updateHudStatics();
}

function updateWorld(now) {
  // --- Joueur ---
  const inputDir = createVector(0, 0);
  if (mode === 'play') {
    if (keyIsDown(65) || keyIsDown(81)) inputDir.x -= 1; // A / Q
    if (keyIsDown(68)) inputDir.x += 1;                  // D
    if (keyIsDown(87) || keyIsDown(90)) inputDir.y -= 1; // W / Z
    if (keyIsDown(83)) inputDir.y += 1;                  // S
  }
  if (inputDir.magSq() > 0) {
    inputDir.normalize();
    const desired = inputDir.mult(player.maxSpeed);
    const steering = p5.Vector.sub(desired, player.vel).limit(player.maxForce * 1.6);
    player.applyForce(steering);
    player.debug.desired = desired.copy().limit(player.maxForce * 1.6);
    player.debug.steering = steering.copy();
    player.debug.state = 'manual';
  } else {
    player.vel.mult(0.86); // friction douce a l'arret
    player.debug.desired = createVector(0, 0);
    player.debug.steering = createVector(0, 0);
  }
  player.aimAngle = Math.atan2(mouseY - player.pos.y, mouseX - player.pos.x);
  player.lastHeading = player.isPlayer ? (player.vel.mag() > 0.3 ? player.vel.heading() : player.lastHeading) : player.lastHeading;
  player.finishReloadIfNeeded(now);

  if (mode === 'play' && mouseDown && player.canFire(now)) {
    firePlayerWeapon(now);
  }

  // --- Escouade IA ---
  for (const f of friendlies) {
    if (f.isPlayer || f.dead) continue;
    f.updateAI(friendlies, hostiles, world, now);
    const healed = f.healTick(friendlies, world);
    if (healed) healPulses.push({ x: healed.pos.x, y: healed.pos.y, born: now });
  }

  // --- Hostiles ---
  for (const h of hostiles) {
    if (h.dead) continue;
    h.updateAI(friendlies, world, now, hostiles);
  }

  // --- Renforts (mission 3) ---
  if (mission.reinforcements) {
    reinforceClock += 1 / 60;
    if (reinforceClock >= mission.reinforcements.intervalSec && reinforceSpawned < mission.reinforcements.maxExtra) {
      reinforceClock = 0;
      reinforceSpawned += 1;
      const pts = mission.reinforcements.spawns;
      // Renforts : apparaitre le plus loin possible des hostiles vivants (pas de tassement)
      const sp = pickSpreadSpawnPoint(pts, hostiles) || pts[0];
      const patrol = [sp, { x: constrain(sp.x - 140, 40, WORLD_W - 40), y: constrain(sp.y + 80, 40, WORLD_H - 40) }];
      hostiles.push(new Enemy(sp.x, sp.y, patrol, {}));
      logLine('Renforts hostiles reperes !');
    }
  }

  // --- Locomotion (les cadavres ne glissent pas) ---
  for (const a of [...friendlies, ...hostiles]) {
    if (a.dead) { a.vel.set(0, 0); continue; }
    a.update();
    world.resolveCollision(a);
  }

  // --- Balles produites ce tour ---
  for (const a of [...friendlies, ...hostiles]) {
    for (const b of a.pendingBullets.splice(0)) {
      bullets.push(b);
      flashes.push({ x: b.pos.x, y: b.pos.y, ang: Math.atan2(b.vel.y, b.vel.x), born: now, hostile: !b.friendly });
      if (a.isPlayer) {
        sfx('shoot', 1);
      } else {
        const d = Math.hypot(b.pos.x - player.pos.x, b.pos.y - player.pos.y);
        sfx('shoot', Math.max(0.12, Math.min(0.55, 1 - d / 800)));
      }
    }
  }

  // --- Grenades ---
  for (const g of grenades) {
    g.update();
    if (g.exploded) {
      explosions.push({ x: g.pos.x, y: g.pos.y, born: now, radius: g.radius });
      spawnExplosionParticles(g.pos.x, g.pos.y);
      camShake = Math.max(camShake, 6);
      sfx('explosion');
      for (const h of hostiles) {
        if (h.dead) continue;
        const d = Math.hypot(h.pos.x - g.pos.x, h.pos.y - g.pos.y);
        if (d < g.radius) h.takeDamage(Math.round(g.damage * (1 - d / g.radius * 0.6)));
        if (h.dead && !h.deathFx) {
          h.deathFx = true;
          spawnKillExplosion(h.pos.x, h.pos.y);
        }
      }
    }
  }
  grenades = grenades.filter(g => !g.dead);

  // --- Balles ---
  for (const b of bullets) {
    b.update();
    if (b.dead) continue;
    // collision avec les batiments et couvertures
    for (const rect of world.buildings.concat(world.covers)) {
      if (b.pos.x >= rect.x && b.pos.x <= rect.x + rect.w && b.pos.y >= rect.y && b.pos.y <= rect.y + rect.h) {
        b.dead = true;
        break;
      }
    }
    if (b.dead) continue;
    const targets = b.friendly ? hostiles : friendlies;
    for (const t of targets) {
      if (t.dead) continue;
      if (dist(b.pos.x, b.pos.y, t.pos.x, t.pos.y) < t.r + b.r) {
        t.takeDamage(b.damage);
        b.dead = true;
        spawnSparks(b.pos.x, b.pos.y, 5, t.isPlayer ? [255, 120, 90] : [200, 40, 40]);
        if (t.isPlayer) { camShake = Math.max(camShake, 3.5); flashDamageOverlay(); sfx('hurt', 1); }
        if (b.friendly) sfx('hit', 0.7);
        if (t.team === 'hostile' && t.dead && !t.deathFx) {
          t.deathFx = true;
          spawnKillExplosion(t.pos.x, t.pos.y);
        }
        break;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // Compteur global d'elimination : tout hostile mis hors de combat par l'escouade compte
  const deadHostiles = hostiles.filter(h => h.dead).length;
  if (deadHostiles > kills) logLine('Hostile neutralise (' + deadHostiles + ')');
  kills = deadHostiles;

  // --- Zone d'extraction : annoncer l'attente de l'escouade ---
  const playerInZone = world.anchorInExtraction(player.pos);
  if (playerInZone && !playerWasInZone) {
    const inside = world.countInExtraction(friendlies);
    const alive = friendlies.filter(f => !f.dead).length;
    if (inside < alive) logLine('Extraction : en attente de l\'escouade (' + inside + '/' + alive + ' dans la zone)');
  }
  playerWasInZone = playerInZone;

  // --- Zone a securiser (mission 2) ---
  if (world.zone) {
    const occupied = friendlies.some(f => !f.dead && Math.hypot(f.pos.x - world.zone.x, f.pos.y - world.zone.y) < world.zone.r);
    if (occupied) secureTimer += 1 / 60;
  }

  // particules (integration + cycle de vie)
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= 1; }
  particles = particles.filter(p => p.life > 0);
  flashes = flashes.filter(f => now - f.born < 90);

  explosions = explosions.filter(e => now - e.born < 700);
  healPulses = healPulses.filter(p => now - p.born < 1200);
}

function spawnSparks(x, y, n, rgb) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TWO_PI;
    const sp = 0.6 + Math.random() * 2.2;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 24 + Math.floor(Math.random() * 22),
      maxLife: 46,
      size: Math.random() < 0.4 ? 2 : 1,
      color: rgb
    });
  }
  if (particles.length > 240) particles.splice(0, particles.length - 240);
}

function spawnExplosionParticles(x, y) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * TWO_PI;
    const sp = 1 + Math.random() * 3.2;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 30 + Math.floor(Math.random() * 30),
      maxLife: 60,
      size: Math.random() < 0.5 ? 2 : 3,
      color: Math.random() < 0.6 ? [255, 200, 80] : [255, 120, 50]
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * TWO_PI;
    const sp = 0.4 + Math.random() * 1.4;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 50 + Math.floor(Math.random() * 40),
      maxLife: 90,
      size: 2,
      color: [70, 70, 78]
    });
  }
}

function spawnKillExplosion(x, y) {
  explosions.push({ x, y, born: millis(), radius: 36 });
  spawnSparks(x, y, 10, [255, 170, 70]);
  spawnSparks(x, y, 6, [120, 120, 128]);
  camShake = Math.max(camShake, 2.2);
  sfx('killBoom', 0.9);
}

function flashDamageOverlay() {
  const el = document.getElementById('damageFlash');
  if (!el) return;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

function firePlayerWeapon(now) {
  const bullet = fireBullet(player, mouseX, mouseY, player.damage, player.bulletSpeed, true);
  bullets.push(bullet);
  player.consumeAmmo(now);
  player.lastHeading = Math.atan2(mouseY - player.pos.y, mouseX - player.pos.x);
  updateHudStatics();
}

// ---------- Rendu ----------

// Cercle en pointilles (pixels) : n arcs de `dash` rad tous les `period`.
function dashCircle(pg, x, y, r, dash, period, phase) {
  const n = Math.floor((Math.PI * 2) / period);
  for (let i = 0; i < n; i++) {
    const a0 = (phase || 0) + i * period;
    pg.arc(x, y, r * 2, r * 2, a0, a0 + dash);
  }
}

function drawZoneAndExtraction(pg, now) {
  const t = now / 1000;
  if (world.zone) {
    const z = world.zone;
    pg.noStroke();
    pg.fill(255, 200, 60, 22 + 14 * Math.sin(t * 2.6));
    pg.ellipse(z.x, z.y, z.r * 2, z.r * 2);
    pg.noFill();
    pg.stroke(255, 209, 102, 220);
    pg.strokeWeight(3);
    dashCircle(pg, z.x, z.y, z.r, 0.26, Math.PI * 2 / 10, t * 0.7);
    pg.fill(255, 209, 102, 230);
    pg.noStroke();
    pg.textAlign(CENTER, CENTER);
    pg.textFont('Courier New');
    pg.textStyle(BOLD);
    pg.textSize(11);
    pg.text('SECURISER', z.x, z.y);
  }
  for (const e of world.extractions) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    pg.noStroke();
    pg.fill(40, 220, 235, 26 + 18 * pulse);
    pg.ellipse(e.x, e.y, e.r * 2, e.r * 2);
    pg.noFill();
    pg.stroke(45, 225, 240, 230);
    pg.strokeWeight(3);
    dashCircle(pg, e.x, e.y, e.r, 0.3, Math.PI * 2 / 12, t * 0.9);
    // chevrons internes
    pg.stroke(45, 225, 240, 160);
    pg.strokeWeight(2);
    const cr = e.r * 0.45 + 3 * Math.sin(t * 2.2);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      pg.line(e.x + dx * (cr - 6) - dy * 5, e.y + dy * (cr - 6) - dx * 5, e.x + dx * cr, e.y + dy * cr);
      pg.line(e.x + dx * (cr - 6) + dy * 5, e.y + dy * (cr - 6) + dx * 5, e.x + dx * cr, e.y + dy * cr);
    }
    pg.fill(140, 245, 250, 235);
    pg.noStroke();
    pg.textAlign(CENTER, CENTER);
    pg.textFont('Courier New');
    pg.textStyle(BOLD);
    pg.textSize(11);
    pg.text('EXTRACTION', e.x, e.y);
  }
}

function drawAgentsPixel(pg) {
  // fantomes d'abord, vivants par dessus
  for (const a of [...hostiles, ...friendlies]) {
    if (a.dead) {
      pg.push();
      pg.translate(a.pos.x, a.pos.y);
      pg.fill(12, 13, 17, 190);
      pg.noStroke();
      pg.rect(-11, -4, 22, 8, 2);
      pg.rect(-7, -8, 14, 16, 2);
      pg.stroke(105, 108, 118);
      pg.strokeWeight(2);
      pg.line(-6, -6, 6, 6);
      pg.line(-6, 6, 6, -6);
      pg.pop();
    }
  }

  for (const a of [...hostiles, ...friendlies]) {
    if (a.dead) continue;
    const facing = a.isPlayer && a.aimAngle !== undefined ? a.aimAngle : a.lastHeading;
    const isHostile = a.team === 'hostile';
    pg.push();
    pg.translate(a.pos.x, a.pos.y);

    // ombre portee
    pg.fill(8, 9, 12, 110);
    pg.noStroke();
    pg.ellipse(2, 4, a.r * 2.1, a.r * 1.35);

    pg.rotate(facing);
    const c = isHostile ? (a.passive ? [196, 96, 214] : [228, 84, 64]) : a.roleDef.color;
    // torse
    pg.fill(c[0] * 0.42, c[1] * 0.42, c[2] * 0.42);
    pg.stroke(10, 11, 15);
    pg.strokeWeight(1.5);
    pg.rect(-a.r * 0.75, -a.r * 0.62, a.r * 1.5, a.r * 1.24, 2);
    // bandeau couleur de role (epaulettes)
    pg.fill(c[0], c[1], c[2]);
    pg.rect(-a.r * 0.75, -a.r * 0.62, 3, a.r * 1.24);
    pg.rect(a.r * 0.75 - 3, -a.r * 0.62, 3, a.r * 1.24);
    // casque
    pg.fill(c[0] * 0.72 + 40, c[1] * 0.72 + 40, c[2] * 0.72 + 40);
    pg.rect(-a.r * 0.52, -a.r * 0.52, a.r * 1.04, a.r * 0.9, 2);
    pg.fill(c[0] * 0.95 + 30, c[1] * 0.95 + 30, c[2] * 0.95 + 30);
    pg.rect(-a.r * 0.52, -a.r * 0.52, a.r * 1.04, 3, 2);
    // arme
    pg.fill(16, 16, 20);
    pg.rect(a.r * 0.35, -1.5, a.r * 0.95, 3);
    pg.rect(a.r * 1.1, -1, 3, 2);
    if (isHostile) {
      // viseur rouge
      pg.fill(255, 60, 40);
      pg.rect(a.r * 0.1, -1, 3, 2);
    }
    if (a.isPlayer) {
      pg.noFill();
      pg.stroke(240, 240, 245);
      pg.strokeWeight(1.5);
      pg.rect(-a.r * 0.75 - 2, -a.r * 0.62 - 2, a.r * 1.5 + 4, a.r * 1.24 + 4, 3);
    }
    pg.pop();

    // selection (mode commandement) : chevrons amber pour chaque soldat selectionne
    if (mode === 'command' && selection.has(a)) {
      pg.push();
      pg.translate(a.pos.x, a.pos.y);
      pg.stroke(232, 193, 90);
      pg.strokeWeight(2);
      const d = a.r + 7;
      const l = 6;
      pg.line(-d, -d + l, -d, -d); pg.line(-d, -d, -d + l, -d);
      pg.line(d, -d + l, d, -d); pg.line(d, -d, d - l, -d);
      pg.line(-d, d - l, -d, d); pg.line(-d, d, -d + l, d);
      pg.line(d, d - l, d, d); pg.line(d, d, d - l, d);
      pg.pop();
    }

    // barre de vie (blocs) au-dessus si blesse
    if (a.health < a.maxHealth) {
      const w = 26, ratio = a.health / a.maxHealth;
      const y = a.pos.y - a.r - 12;
      pg.noStroke();
      pg.fill(12, 12, 16, 200);
      pg.rect(a.pos.x - w / 2 - 1, y - 1, w + 2, 5);
      pg.fill(ratio > 0.35 ? color(96, 224, 130) : color(255, 96, 70));
      const seg = Math.floor(w * ratio / 4) * 4;
      pg.rect(a.pos.x - w / 2, y, Math.max(seg, ratio > 0 ? 4 : 0), 3);
    }
  }
}

function drawProjectilesPixel(pg, now) {
  // balles : streak + tete lumineuse
  for (const b of bullets) {
    const sp = b.vel.mag();
    const nx = sp > 0.01 ? b.vel.x / sp : 1, ny = sp > 0.01 ? b.vel.y / sp : 0;
    pg.stroke(b.friendly ? color(255, 236, 150) : color(255, 130, 95));
    pg.strokeWeight(1.5);
    pg.line(b.pos.x - nx * 6, b.pos.y - ny * 6, b.pos.x, b.pos.y);
    pg.noStroke();
    pg.fill(b.friendly ? color(255, 250, 220) : color(255, 200, 160));
    pg.rect(b.pos.x - 1, b.pos.y - 1, 2, 2);
  }

  // grenades
  for (const g of grenades) {
    pg.noStroke();
    pg.fill(86, 128, 74);
    pg.rect(g.pos.x - 2, g.pos.y - 2, 5, 5);
    pg.fill(255, 70, 50);
    if (Math.floor(now / 90) % 2 === 0) pg.rect(g.pos.x, g.pos.y - 1, 1, 1);
  }

  // explosions : anneau + coeur
  for (const e of explosions) {
    const t = (now - e.born) / 700;
    const r = e.radius * (0.35 + 0.65 * t);
    pg.noFill();
    pg.stroke(255, 190, 80, 235 * (1 - t));
    pg.strokeWeight(5 * (1 - t) + 1);
    pg.ellipse(e.x, e.y, r * 2, r * 2);
    pg.stroke(255, 120, 60, 180 * (1 - t));
    pg.strokeWeight(2);
    pg.ellipse(e.x, e.y, r * 1.15, r * 1.15);
  }

  // muzzle flashes
  for (const f of flashes) {
    const age = now - f.born;
    if (age > 90) continue;
    const k = 1 - age / 90;
    pg.stroke(255, 240, 170, 255 * k);
    pg.strokeWeight(2);
    const len = 6 + 4 * k;
    for (const off of [-0.35, 0, 0.35]) {
      pg.line(f.x + Math.cos(f.ang + off * 0.6) * 3, f.y + Math.sin(f.ang + off * 0.6) * 3,
              f.x + Math.cos(f.ang + off) * len, f.y + Math.sin(f.ang + off) * len);
    }
    pg.noStroke();
    pg.fill(255, 255, 220, 255 * k);
    pg.rect(f.x - 1, f.y - 1, 3, 3);
  }

  // particules
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    pg.noStroke();
    pg.fill(p.color[0], p.color[1], p.color[2], 255 * a);
    pg.rect(p.x, p.y, p.size, p.size);
  }

  // soin : croix verte montante
  for (const p of healPulses) {
    const t = (now - p.born) / 1200;
    const y = p.y - t * 24;
    pg.stroke(120, 255, 150, 225 * (1 - t));
    pg.strokeWeight(2);
    pg.line(p.x - 4, y, p.x + 4, y);
    pg.line(p.x, y - 4, p.x, y + 4);
  }
}

function drawDebugPixels(pg, now) {
  // chemins A*
  for (const f of friendlies) {
    if (f.dead || !f.path || f.path.length === 0 || f.pathState.index >= f.path.length) continue;
    pg.stroke(90, 220, 255, 170);
    pg.strokeWeight(2);
    const pts = f.path.slice(f.pathState.index);
    if (pts.length > 0) {
      pg.beginShape();
      pg.vertex(f.pos.x, f.pos.y);
      for (const p of pts) pg.vertex(p.x, p.y);
      pg.endShape();
      pg.noStroke();
      pg.fill(90, 220, 255, 210);
      for (const p of pts) pg.rect(p.x - 2, p.y - 2, 4, 4);
    }
  }

  const focus = selected || player;
  for (const a of [...friendlies, ...hostiles]) {
    if (a.dead) continue;
    const isFocus = a === focus;
    pg.noFill();
    pg.stroke(isFocus ? color(255, 220, 90, 200) : color(150, 160, 200, 45));
    pg.strokeWeight(isFocus ? 2 : 1);
    dashCircle(pg, a.pos.x, a.pos.y, a.detectionRadius, 0.24, Math.PI * 2 / 26, now / 900);
    if (isFocus) {
      const facing = a.isPlayer ? a.aimAngle : a.lastHeading;
      pg.stroke(255, 220, 90, 120);
      pg.fill(255, 220, 90, 24);
      pg.arc(a.pos.x, a.pos.y, a.detectionRadius * 2, a.detectionRadius * 2, facing - a.fov / 2, facing + a.fov / 2, PIE);
      pg.noFill();
      // vecteurs : vitesse (vert) et force de steering (rouge)
      pg.stroke(110, 255, 140);
      pg.strokeWeight(2);
      pg.line(a.pos.x, a.pos.y, a.pos.x + a.vel.x * 14, a.pos.y + a.vel.y * 14);
      pg.stroke(255, 90, 90);
      pg.line(a.pos.x, a.pos.y, a.pos.x + a.debug.steering.x * 60, a.pos.y + a.debug.steering.y * 60);
      // etiquette d'etat
      pg.noStroke();
      pg.fill(255, 230, 150);
      pg.textFont('Courier New');
      pg.textStyle(BOLD);
      pg.textSize(10);
      pg.textAlign(CENTER, BOTTOM);
      pg.text(String(a.debug.state).toUpperCase(), a.pos.x, a.pos.y - a.r - 3);
    }
  }
}

function drawCommandCursorPixel(pg) {
  // chevrons de ciblage pour chaque soldat selectionne
  for (const sel of selection.list()) {
    if (sel.dead) continue;
    pg.noFill();
    pg.stroke(232, 193, 90, 220);
    pg.strokeWeight(2);
    const d = sel.r + 8;
    const l = 7;
    pg.line(sel.pos.x - d, sel.pos.y - d + l, sel.pos.x - d, sel.pos.y - d);
    pg.line(sel.pos.x - d, sel.pos.y - d, sel.pos.x - d + l, sel.pos.y - d);
    pg.line(sel.pos.x + d, sel.pos.y - d + l, sel.pos.x + d, sel.pos.y - d);
    pg.line(sel.pos.x + d, sel.pos.y - d, sel.pos.x + d - l, sel.pos.y - d);
    pg.line(sel.pos.x - d, sel.pos.y + d - l, sel.pos.x - d, sel.pos.y + d);
    pg.line(sel.pos.x - d, sel.pos.y + d, sel.pos.x - d + l, sel.pos.y + d);
    pg.line(sel.pos.x + d, sel.pos.y + d - l, sel.pos.x + d, sel.pos.y + d);
    pg.line(sel.pos.x + d, sel.pos.y + d, sel.pos.x + d - l, sel.pos.y + d);
  }
  if (moveOrderArmed) {
    pg.noFill();
    pg.stroke(232, 193, 90, 210);
    pg.strokeWeight(2);
    pg.line(mouseX - 10, mouseY, mouseX + 10, mouseY);
    pg.line(mouseX, mouseY - 10, mouseX, mouseY + 10);
  }
}

// ---------- Entrees ----------

function togglePause() {
  if (gameState !== 'playing') return;
  paused = !paused;
  const pm = document.getElementById('pauseModal');
  if (pm) {
    if (paused) pm.classList.add('visible');
    else pm.classList.remove('visible');
  }
  logLine(paused ? 'Jeu en pause.' : 'Reprise de la mission.');
}

function keyPressed() {
  if (key === 'Tab') { toggleMode(); return false; }
  const k = String(key).toLowerCase();

  if (k === 'p' || k === 'escape') { togglePause(); return; }
  if (k === 'd') { debugMode = !debugMode; document.getElementById('debugToggle').checked = debugMode; return; }

  if (k === '1') { player.switchWeapon('pistol'); return; }
  if (k === '2') { player.switchWeapon('rifle'); return; }
  if (k === '3') { player.switchWeapon('smg'); return; }

  if (mode === 'play') {
    if (k === 'r') { player.startReload(millis()); return; }
    if (k === 'g') { throwGrenade(); return; }
  } else {
    if (k === 'm') { armMoveOrder(); return; }
    if (k === 'f') { armFollowPick(); return; }
    if (k === 'h') { issueCommandToSquad('hold'); return; }
    if (k === 'c') { issueCommandToSquad('combat'); return; }
    if (k === 'v') { armHealPick(); return; }
    if (k === 'r') { issueCommandToSquad('regroup'); return; }
    if (k === 'b') { issueCommandToSquad('defend'); return; }
    if (k === 'a') { selectAllAi(); return; }
    if (k === 'x') { clearSelection(); return; }
    if (k === 'q') { cycleSelection(); return; }
  }
}

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > WORLD_W || mouseY > WORLD_H) return;
  if (gameState !== 'playing') return;

  if (mode === 'command') {
    // Ciblage Suivre / Soigner en attente : le clic designe un allie (joueur inclus)
    if (followPickArmed || healPickArmed) {
      const picked = pickAllyAt(mouseX, mouseY);
      if (!picked) {
        logLine('Ciblage : aucun allie sous le curseur — recliquez ou clic droit pour annuler.');
        return; // reste arme pour retenter
      }
      if (followPickArmed) {
        const targets = commandPool();
        for (const t of targets) { t.command = 'follow'; t.followTarget = picked; t.moveTarget = null; }
        logLine((selection.size === 0 ? 'Escouade' : (selection.size === 1 ? targets[0].name : targets.length + ' soldats')) + ' : suit ' + picked.name);
      } else {
        const medics = medicHealTargets();
        for (const m of medics) { m.command = 'heal'; m.healTarget = picked; m.moveTarget = null; }
        logLine(medics.map(m => m.name).join(', ') + ' soigne(nt) ' + picked.name);
      }
      followPickArmed = false;
      healPickArmed = false;
      updatePickHint();
      refreshCommandPanel();
      return;
    }
    if (moveOrderArmed) {
      issueMoveOrderAt(mouseX, mouseY);
      moveOrderArmed = false;
      return;
    }
    // selection multiple : clic sur un soldat IA le bascule dans la selection
    let picked = null;
    for (const f of friendlies) {
      if (f.isPlayer || f.dead) continue;
      if (dist(mouseX, mouseY, f.pos.x, f.pos.y) < 16) { picked = f; break; }
    }
    if (picked) {
      toggleSelection(picked);
      return;
    }
    // clic sur le sol : ordre de deplacement pour la selection (ou toute l'escouade)
    issueMoveOrderAt(mouseX, mouseY);
    return;
  }

  // mode jeu : un clic tire (maintien gere dans draw)
  if (player.canFire(millis())) firePlayerWeapon(millis());
}

function issueMoveOrder(soldier, x, y, silent = false) {
  if (soldier.dead) return;
  soldier.setMoveOrder(x, y, world);
  if (!silent) logLine(soldier.name + ' : deplacement vers (' + Math.round(x) + ', ' + Math.round(y) + ')');
}

// Ordre de deplacement mutualise : 1 soldat = clic precis ; plusieurs = formation espacee ;
// aucune selection = toute l'escouade IA en formation.
function issueMoveOrderAt(x, y) {
  const targets = commandPool();
  if (targets.length === 0) return;
  if (targets.length === 1) { issueMoveOrder(targets[0], x, y); return; }
  for (const f of targets) {
    const off = f.getFormationOffset ? f.getFormationOffset() : { dx: 0, dy: 0 };
    issueMoveOrder(f, x + off.dx, y + off.dy, true);
  }
  logLine(targets.length + ' soldats : mouvement en formation vers le point d\'ordre.');
}

function cycleSelection() {
  const ai = friendlies.filter(f => !f.isPlayer && !f.dead);
  if (ai.length === 0) { clearSelection(); return; }
  const current = selected && ai.includes(selected) ? selected : null;
  const i = current ? ai.indexOf(current) : -1;
  const next = ai[(i + 1) % ai.length];
  selection.selectExactly([next]);
  selected = selection.primary;
  rosterSignature = '';
  logLine('Selection : ' + next.name + ' (Q : cycle, A : tout, X : aucun)');
}

function throwGrenade() {
  if (grenadeCount <= 0 || player.dead) { logLine('Plus de grenade.'); return; }
  grenades.push(new Grenade(player.pos.x, player.pos.y, mouseX, mouseY, 60, 75, 45));
  grenadeCount -= 1;
  sfx('click');
}

function mouseWheel(event) {
  // Q/molette : changer d'arme
  const dir = event.delta > 0 ? 1 : -1;
  const order = ['pistol', 'rifle', 'smg'];
  const i = order.indexOf(player.weapon);
  player.switchWeapon(order[(i + dir + order.length) % order.length]);
}

// Clic droit : ordre de deplacement en mode commandement
document.addEventListener('contextmenu', e => {
  const c = document.querySelector('#battlefieldContainer canvas');
  if (c && e.target === c) {
    e.preventDefault();
    if (gameState === 'playing' && mode === 'command') {
      if (followPickArmed || healPickArmed) { cancelPicks(); return; }
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (WORLD_W / rect.width);
      const y = (e.clientY - rect.top) * (WORLD_H / rect.height);
      issueMoveOrderAt(x, y);
    }
  }
});

// ---------- Audio minimal (Web Audio) ----------

function sfx(kind, volume = 1) {
  if (!sfxEnabled) return;
  if (volume <= 0) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const v = Math.max(0, Math.min(1, volume));
    if (kind === 'shoot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
      gain.gain.setValueAtTime(0.07 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.start(t); osc.stop(t + 0.1);
    } else if (kind === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      gain.gain.setValueAtTime(0.1 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.13);
    } else if (kind === 'hurt') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
      gain.gain.setValueAtTime(0.16 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      osc.start(t); osc.stop(t + 0.18);
    } else if (kind === 'killBoom') {
      // explosion d'eloignement court : bruit en pseudo-bruit + chute sub-bass
      const buf = audioCtx.createBuffer(1, 4096, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
      const noise = audioCtx.createBufferSource();
      noise.buffer = buf;
      const ng = audioCtx.createGain();
      const nf = audioCtx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.setValueAtTime(900, t);
      nf.frequency.exponentialRampToValueAtTime(90, t + 0.4);
      ng.gain.setValueAtTime(0.5 * v, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      noise.connect(nf); nf.connect(ng); ng.connect(audioCtx.destination);
      noise.start(t); noise.stop(t + 0.5);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.4);
      gain.gain.setValueAtTime(0.34 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.start(t); osc.stop(t + 0.45);
    } else if (kind === 'explosion') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.5);
      gain.gain.setValueAtTime(0.25 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t); osc.stop(t + 0.6);
    } else if (kind === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      gain.gain.setValueAtTime(0.06 * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t); osc.stop(t + 0.07);
    }
  } catch (err) {
    // audio indisponible : silencieux
  }
}
