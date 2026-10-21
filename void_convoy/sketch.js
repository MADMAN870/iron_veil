let leader, followers = [], wanderers = [], obstacles = [], bullets = [], enemies = [], enemyBullets = [], enemy = null;
let portal = null;
let mode = 'transparent';
let shootMode = false;
let lastShoot = 0;
let paused = false;
let debugMode = true;
let gameState = 'PLAYING'; // 'PLAYING', 'GAMEOVER', 'VICTORY'

// Systeme de vagues & quotas stricts
let wave = 1;
const maxWaves = 3;
let waveQuota = 2; // Vague 1: 2 cargos, Vague 2: 3 cargos, Vague 3: 4 cargos
let cargosEvacuatedInWave = 0;
let wanderersSpawnedInWave = 0;
let lastWandererSpawn = 0;
const WANDERER_SPAWN_INTERVAL = 11000; // Cargos apparaissent lentement (toutes les 11s)
let totalCargosSaved = 0;
let cargosSaved = 0; // Alias de compatibilite
let lastWaveSpawn = 0;
let score = 0;

let params = {
  sepWeight: 1.4,
  frontRadius: 38,
  queueSpacing: 34,
  shootRate: 12,
  followWeight: 1.0,
  fleeFrontWeight: 1.9,
  avoidWeight: 1.8,
  boundsWeight: 1.1,
  aheadDist: 58,
  maxSpeed: 4.0,
  maxForce: 0.6
};

function getWaveQuota(w) {
  return w + 1; // Vague 1: 2, Vague 2: 3, Vague 3: 4
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  if (typeof describe === 'function') {
    describe('Jeu de Convoi & Escorte : vous demarrez seul, secourez le nombre exact de cargos espaces dans le temps pour chaque vague, et evacuez-les vers le portail.', LABEL);
  }
  initLevel();
  applyParams();
  bind();
  updateLbl();
  updateHud();
}

function initLevel() {
  leader = new Leader(width * 0.22, height * 0.5);
  followers = []; // Vous demarrez sans aucun suiveur !
  wanderers = [];
  obstacles = [];
  bullets = [];
  enemies = [];
  enemyBullets = [];
  enemy = null;
  shootMode = false;

  wave = 1;
  waveQuota = getWaveQuota(wave);
  cargosEvacuatedInWave = 0;
  wanderersSpawnedInWave = 0;
  totalCargosSaved = 0;
  cargosSaved = 0;
  score = 0;

  // Le premier cargo apparait 3.5 secondes apres le depart
  lastWandererSpawn = (typeof millis === 'function') ? (millis() - (WANDERER_SPAWN_INTERVAL - 3500)) : 0;
  // Les premiers pirates arrivent tres rapidement (apres 1.2s)
  lastWaveSpawn = (typeof millis === 'function') ? (millis() - 3000) : 0;

  // Champ d'asteroides / obstacles
  obstacles.push(new Obstacle(width * 0.38, height * 0.42, 28));
  obstacles.push(new Obstacle(width * 0.62, height * 0.58, 24));
  obstacles.push(new Obstacle(width * 0.50, height * 0.20, 20));
  obstacles.push(new Obstacle(width * 0.70, height * 0.80, 26));

  // Portail d'extraction dans la zone droite
  portal = new Portal(width * 0.86, height * 0.5, 48);
}

function resetGame() {
  initLevel();
  applyParams();
  gameState = 'PLAYING';
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
  updateHud();
  if (!gameMusic.running && !paused) gameMusic.start();
}

function spawnWandererForWave() {
  const x = random(width * 0.25, width * 0.78);
  const y = random(height * 0.15, height * 0.85);
  wanderers.push(new Wanderer(x, y));
  applyParams();
}

function nextWave() {
  wave++;
  waveQuota = getWaveQuota(wave);
  cargosEvacuatedInWave = 0;
  wanderersSpawnedInWave = 0;
  lastWandererSpawn = millis() - (WANDERER_SPAWN_INTERVAL - 3500);
  lastWaveSpawn = millis() + 1000;
  enemies = [];
  enemyBullets = [];
  enemy = null;
  shootMode = false;
  updateHud();
}

function applyParams() {
  if (leader) {
    leader.maxSpeed = params.maxSpeed;
    leader.maxForce = params.maxForce;
  }
  for (const f of followers) {
    f.maxSpeed = params.maxSpeed;
    f.maxForce = params.maxForce;
  }
  for (const w of wanderers) {
    w.maxSpeed = params.maxSpeed;
    w.maxForce = params.maxForce;
  }
}

function bind() {
  const map = [
    ['sep', 'sepVal', v => params.sepWeight = v],
    ['frad', 'fradVal', v => params.frontRadius = v],
    ['qsp', 'qspVal', v => params.queueSpacing = v],
    ['srate', 'srateVal', v => params.shootRate = v],
    ['mspeed', 'mspeedVal', v => params.maxSpeed = v],
    ['mforce', 'mforceVal', v => params.maxForce = v],
    ['ahead', 'aheadVal', v => params.aheadDist = v]
  ];
  for (const [id, vid, set] of map) {
    const el = document.getElementById(id);
    const v = document.getElementById(vid);
    if (el && v) {
      el.addEventListener('input', () => {
        set(+el.value);
        v.textContent = el.value;
        applyParams();
      });
    }
  }

  const mus = document.getElementById('music');
  const musV = document.getElementById('musicVal');
  if (mus && musV) {
    mus.addEventListener('input', () => {
      gameMusic.setVolume(+mus.value);
      musV.textContent = Number(mus.value).toFixed(2);
      if (!gameMusic.running && !paused) gameMusic.start();
    });
  }

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) restartBtn.addEventListener('click', resetGame);

  const debugToggle = document.getElementById('debugToggle');
  if (debugToggle) {
    debugToggle.addEventListener('change', () => {
      debugMode = debugToggle.checked;
    });
  }

  const modalBtn = document.getElementById('modalBtn');
  if (modalBtn) modalBtn.addEventListener('click', resetGame);

  if (document.addEventListener) {
    document.addEventListener('contextmenu', e => e.preventDefault());
  }
}

function updateLbl() {
  const lbl = document.getElementById('modeLabel');
  if (lbl) {
    lbl.textContent = mode === 'queue' ? 'queue leu-leu' : 'transparent (fuit devant leader)';
  }
}

function updateHud() {
  const sh = document.getElementById('leaderShield');
  const cc = document.getElementById('cargosInConvoy');
  const cs = document.getElementById('cargosSaved');
  const wl = document.getElementById('waveLabel');
  if (sh && leader) sh.textContent = `${Math.max(0, Math.round(leader.health))}%`;
  if (cc) cc.textContent = followers.length;
  if (cs) cs.textContent = `${cargosEvacuatedInWave} / ${waveQuota} (Total: ${totalCargosSaved})`;
  if (wl) wl.textContent = `${wave} / ${maxWaves}`;
}

function toggleMode() {
  mode = mode === 'transparent' ? 'queue' : 'transparent';
  updateLbl();
}

function togglePause() {
  paused = !paused;
  const btn = document.getElementById('pauseBtn');
  if (btn) btn.textContent = paused ? 'Reprendre' : 'Pause';
  if (paused) gameMusic.stop();
  else gameMusic.start();
}

function toggleDebug() {
  debugMode = !debugMode;
  const cb = document.getElementById('debugToggle');
  if (cb) cb.checked = debugMode;
}

function spawnEnemy(x = mouseX, y = mouseY) {
  const e = new Enemy(x, y, true);
  enemies.push(e);
  enemy = e;
  shootMode = true;
  lastShoot = millis();
}

function spawnWave() {
  const count = Math.min(4, Math.max(1, wave));
  for (let i = 0; i < count; i++) {
    const edge = Math.floor(random(4));
    let x = 0, y = 0;
    if (edge === 0) { x = random(width); y = -20; }
    else if (edge === 1) { x = width + 20; y = random(height); }
    else if (edge === 2) { x = random(width); y = height + 20; }
    else { x = -20; y = random(height); }
    enemies.push(new Enemy(x, y, true));
  }
  if (enemies.length > 0) {
    enemy = enemies[0];
    shootMode = true;
  }
}

function showModal(title, desc, btnText) {
  const modal = document.getElementById('modal');
  const mt = document.getElementById('modalTitle');
  const md = document.getElementById('modalDesc');
  const mb = document.getElementById('modalBtn');
  if (modal && mt && md && mb) {
    mt.textContent = title;
    md.innerHTML = desc;
    mb.textContent = btnText;
    modal.classList.remove('hidden');
  }
}

function keyPressed() {
  if (key.toLowerCase() === 'p') { togglePause(); return; }
  if (!gameMusic.running && !paused) gameMusic.start();
  if (key.toLowerCase() === 'l') toggleMode();
  if (key.toLowerCase() === 'w') {
    wanderers.push(new Wanderer(random(width * 0.2, width * 0.8), random(height * 0.2, height * 0.8)));
    applyParams();
  }
  if (key.toLowerCase() === 'e') spawnEnemy();
  if (key.toLowerCase() === 'd') toggleDebug();
}

function mousePressed() {
  if (!gameMusic.running && !paused) gameMusic.start();
  if (mouseButton === RIGHT) spawnEnemy();
  else toggleMode();
}

function draw() {
  background(10, 14, 24);

  // Mise a jour et affichage du portail et des obstacles
  if (portal) {
    portal.update();
    portal.show();
  }
  for (const o of obstacles) o.show();

  if (!paused && gameState === 'PLAYING') {
    // 0. Apparition espacee dans le temps des cargos a secourir (exact nombre requis)
    if (wanderersSpawnedInWave < waveQuota && millis() - lastWandererSpawn > WANDERER_SPAWN_INTERVAL) {
      spawnWandererForWave();
      wanderersSpawnedInWave++;
      lastWandererSpawn = millis();
    }

    // 1. Vagues de pirates regulieres
    if (millis() - lastWaveSpawn > 3000 && enemies.length < 10) {
      spawnWave();
      lastWaveSpawn = millis();
    }

    // 2. Deplacement du leader : toujours actif et fluide, ne s'arrete jamais pour tirer !
    leader.applyBehaviors(obstacles);
    leader.update();
    leader.edges();

    // 3. Deplacement des suiveurs (le convoi suit en continu)
    for (let fi = followers.length - 1; fi >= 0; fi--) {
      const f = followers[fi];
      f.applyBehaviors(leader, followers, obstacles, {
        ...params,
        mode,
        enemy,
        enemies
      });
      f.update();
      f.edges();

      // Frottements / collisions avec les asteroides
      for (const o of obstacles) {
        if (f.pos.dist(o.pos) < (f.r + o.r)) {
          f.health -= 0.02;
          if (f.health <= 0) {
            followers.splice(fi, 1);
            followers.forEach((fol, idx) => fol.index = idx);
            if (typeof gameMusic.playExplosion === 'function') gameMusic.playExplosion();
            break;
          }
        }
      }
    }

    // 4. Deplacement des wanderers
    for (const w of wanderers) {
      w.applyBehaviors(obstacles);
      w.update();
      w.edges();
    }

    // 5. Sauvetage des wanderers par le leader ou les suiveurs
    for (let i = wanderers.length - 1; i >= 0; i--) {
      const w = wanderers[i];
      let rescued = leader.pos.dist(w.pos) < (leader.r + w.r + 28);
      if (!rescued) {
        for (const f of followers) {
          if (f.pos.dist(w.pos) < (f.r + w.r + 22)) {
            rescued = true;
            break;
          }
        }
      }
      if (rescued) {
        followers.push(new Follower(w.pos.x, w.pos.y, followers.length));
        wanderers.splice(i, 1);
        score += 150;
        if (typeof gameMusic.playRescue === 'function') gameMusic.playRescue();
      }
    }

    // 6. Evacuation des suiveurs dans le portail
    if (portal) {
      for (let i = followers.length - 1; i >= 0; i--) {
        const f = followers[i];
        if (portal.contains(f)) {
          followers.splice(i, 1);
          followers.forEach((fol, idx) => fol.index = idx);
          cargosEvacuatedInWave++;
          totalCargosSaved++;
          cargosSaved = totalCargosSaved;
          score += 300;
          if (typeof gameMusic.playEvacuate === 'function') gameMusic.playEvacuate();

          // Verification si quota de la vague atteint
          if (cargosEvacuatedInWave >= waveQuota) {
            if (wave >= maxWaves) {
              gameState = 'VICTORY';
              showModal(
                '🎉 Victoire Totale !',
                `Toutes les vagues ont été évacuées avec succès !<br>Total cargos sauvés : <b>${totalCargosSaved}</b><br>Score : <b>${score}</b>`,
                'Rejouer'
              );
            } else {
              nextWave();
            }
          }
        }
      }
    }

    // 7. IA des pirates (Enemy)
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      // Cible : cargo le plus proche ou leader
      let target = leader;
      let minD = leader.pos.dist(e.pos);
      for (const f of followers) {
        const d = f.pos.dist(e.pos);
        if (d < minD) {
          minD = d;
          target = f;
        }
      }
      e.applyBehaviors(target, obstacles, enemies);
      e.update();
      e.edges();

      // Tirs hostiles des pirates vers le convoi ou le leader
      if (typeof e.canShoot === 'function' && e.canShoot(target, 420) && enemyBullets.length < 25) {
        enemyBullets.push(new EnemyBullet(e.pos.x, e.pos.y, target));
      }

      // Degats de contact
      if (e.pos.dist(leader.pos) < (e.r + leader.r + 2)) {
        leader.health -= 0.35;
        if (leader.health <= 0) {
          gameState = 'GAMEOVER';
          showModal(
            '💥 Vaisseau Amiral Détruit',
            `Votre leader a succombé sous les assauts pirates.<br>Cargos sauvés : <b>${totalCargosSaved}</b> | Score : <b>${score}</b>`,
            'Réessayer'
          );
        }
      }
      for (let fi = followers.length - 1; fi >= 0; fi--) {
        const f = followers[fi];
        if (e.pos.dist(f.pos) < (e.r + f.r + 2)) {
          f.health -= 2.0; // Collision directe mortelle pour le cargo !
          if (f.health <= 0) {
            followers.splice(fi, 1);
            followers.forEach((fol, idx) => fol.index = idx);
            if (typeof gameMusic.playExplosion === 'function') gameMusic.playExplosion();
          }
        }
      }

      // Si le pirate percute un cargo derivant non secouru, il le detruit
      for (let wi = wanderers.length - 1; wi >= 0; wi--) {
        const w = wanderers[wi];
        if (e.pos.dist(w.pos) < (e.r + w.r + 2)) {
          wanderers.splice(wi, 1);
          if (typeof gameMusic.playExplosion === 'function') gameMusic.playExplosion();
        }
      }
    }

    // 8. Tirs de defense des vaisseaux vers les pirates
    if (enemies.length > 0) {
      shootMode = true;
      enemy = enemies[0];
      const iv = 1000 / Math.max(1, params.shootRate);
      if (millis() - lastShoot > iv && bullets.length < 40) {
        const srcs = [leader, ...followers];
        for (const s of srcs) {
          // Tir vers le pirate le plus proche a portee de tir (<= 320 px)
          let closestPirate = null;
          let bd = 320;
          for (const e of enemies) {
            const d = s.pos.dist(e.pos);
            if (d < bd) {
              bd = d;
              closestPirate = e;
            }
          }
          if (closestPirate) {
            bullets.push(new Bullet(s.pos.x, s.pos.y, closestPirate));
            if (s === leader && typeof gameMusic.playLaser === 'function') {
              gameMusic.playLaser();
            }
          }
        }
        lastShoot = millis();
      }
    } else {
      shootMode = false;
      enemy = null;
    }

    // 9. Mise a jour et collisions des balles de defense
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.applyBehaviors();
      b.update();

      if (typeof b.isDead === 'function' && b.isDead()) {
        bullets.splice(i, 1);
        continue;
      }
      if (b.pos.x < -40 || b.pos.x > width + 40 || b.pos.y < -40 || b.pos.y > height + 40) {
        bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (b.pos.dist(e.pos) < (b.r + e.r)) {
          e.health -= 1;
          bullets.splice(i, 1);
          hit = true;
          if (e.health <= 0) {
            enemies.splice(ei, 1);
            score += 100;
            if (typeof gameMusic.playExplosion === 'function') gameMusic.playExplosion();
            if (enemies.length > 0) enemy = enemies[0];
            else { enemy = null; shootMode = false; }
          }
          break;
        }
      }
      if (hit) continue;
      if (!enemies.length && b.pos.dist(leader.pos) > width * 1.5) {
        bullets.splice(i, 1);
      }
    }

    // 10. Mise a jour et collisions des tirs pirates (le convoi perd de la vie !)
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      eb.applyBehaviors();
      eb.update();

      if (typeof eb.isDead === 'function' && eb.isDead()) {
        enemyBullets.splice(i, 1);
        continue;
      }
      if (eb.pos.x < -40 || eb.pos.x > width + 40 || eb.pos.y < -40 || eb.pos.y > height + 40) {
        enemyBullets.splice(i, 1);
        continue;
      }

      // Impact sur le leader
      if (eb.pos.dist(leader.pos) < (eb.r + leader.r)) {
        leader.health -= 6;
        enemyBullets.splice(i, 1);
        if (typeof gameMusic.playHit === 'function') gameMusic.playHit();
        if (leader.health <= 0) {
          gameState = 'GAMEOVER';
          showModal(
            '💥 Vaisseau Amiral Détruit',
            `Votre leader a succombé sous les tirs ennemis.<br>Cargos sauvés : <b>${totalCargosSaved}</b> | Score : <b>${score}</b>`,
            'Réessayer'
          );
        }
        continue;
      }

      // Impact sur les cargos du convoi (les tirs pirates les detruisent rapidement !)
      let hitCargo = false;
      for (let fi = followers.length - 1; fi >= 0; fi--) {
        const f = followers[fi];
        if (eb.pos.dist(f.pos) < (eb.r + f.r)) {
          f.health -= 2.0; // Tir mortel en 1 coup !
          enemyBullets.splice(i, 1);
          hitCargo = true;
          if (typeof gameMusic.playHit === 'function') gameMusic.playHit();
          if (f.health <= 0) {
            followers.splice(fi, 1);
            followers.forEach((fol, idx) => fol.index = idx);
            if (typeof gameMusic.playExplosion === 'function') gameMusic.playExplosion();
          }
          break;
        }
      }
      if (hitCargo) continue;
    }

    // Verification defaite : quota impossible a atteindre car trop de cargos perdus
    const potentialCargos = followers.length + wanderers.length + (waveQuota - wanderersSpawnedInWave);
    const needed = waveQuota - cargosEvacuatedInWave;
    if (potentialCargos < needed) {
      gameState = 'GAMEOVER';
      showModal(
        '⚠️ Échec de la Mission',
        `Un cargo crucial de la vague ${wave} a été détruit. Impossible d'atteindre le quota (${cargosEvacuatedInWave}/${waveQuota}).`,
        'Réessayer'
      );
    }

    updateHud();
  }

  // Rendu debug (cercle frontal d'exclusion et cibles)
  if (debugMode) {
    leader.showDebug(params, mode);
    for (const f of followers) f.showDebug(leader, followers, { ...params, mode });
  }

  // Rendu des entites
  leader.show();
  for (const f of followers) f.show();
  for (const w of wanderers) w.show();
  for (const e of enemies) e.show();
  for (const b of bullets) b.show();
  for (const eb of enemyBullets) eb.show();

  if (paused) {
    push();
    noStroke();
    fill(255);
    textSize(32);
    textAlign(CENTER, CENTER);
    text('PAUSE', width / 2, height / 2);
    textSize(16);
    text('P ou bouton pour reprendre', width / 2, height / 2 + 40);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
