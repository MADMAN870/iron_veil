// Monde : batiments (bloquent mouvement + ligne de vue), couvertures (bloquent mouvement),
// zones de mission. Gere la collision cercle/rectangle et la ligne de vue segment/rectangle.
class World {
  constructor(def, worldW, worldH) {
    this.w = worldW;
    this.h = worldH;
    this.buildings = def.buildings || [];
    this.covers = def.covers || [];
    this.extractions = def.extractions || [];
    this.zone = def.zone || null; // {x, y, r} zone a securiser
    this.navigation = new AStar(worldW, worldH, 16, this.buildings, 10);
  }

  findPath(x1, y1, x2, y2) {
    return this.navigation.findPath(x1, y1, x2, y2);
  }

  // Collision cercle vs rectangles : pousse l'agent hors du mur et annule la composante
  // de vitesse qui penetrate (glissement le long du mur, supprime le flutter contre la paroi).
  resolveCollision(agent) {
    let collided = false;
    for (const rect of [...this.buildings, ...this.covers]) {
      const cx = constrain(agent.pos.x, rect.x, rect.x + rect.w);
      const cy = constrain(agent.pos.y, rect.y, rect.y + rect.h);
      const dx = agent.pos.x - cx, dy = agent.pos.y - cy;
      const dSq = dx * dx + dy * dy;
      if (dSq < agent.r * agent.r) {
        collided = true;
        let nx, ny;
        if (dSq < 1e-9) {
          // centre a l'interieur : pousser vers la face la plus proche
          const left = agent.pos.x - rect.x, right = rect.x + rect.w - agent.pos.x;
          const top = agent.pos.y - rect.y, bottom = rect.y + rect.h - agent.pos.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { agent.pos.x = rect.x - agent.r; nx = -1; ny = 0; }
          else if (m === right) { agent.pos.x = rect.x + rect.w + agent.r; nx = 1; ny = 0; }
          else if (m === top) { agent.pos.y = rect.y - agent.r; nx = 0; ny = -1; }
          else { agent.pos.y = rect.y + rect.h + agent.r; nx = 0; ny = 1; }
        } else {
          const d = Math.sqrt(dSq);
          nx = dx / d;
          ny = dy / d;
          agent.pos.x = cx + nx * agent.r;
          agent.pos.y = cy + ny * agent.r;
        }
        // supprimer la composante de vitesse qui entre dans le mur
        const into = agent.vel.x * nx + agent.vel.y * ny;
        if (into < 0) {
          agent.vel.x -= nx * into;
          agent.vel.y -= ny * into;
        }
      }
    }
    agent.pos.x = constrain(agent.pos.x, agent.r, this.w - agent.r);
    agent.pos.y = constrain(agent.pos.y, agent.r, this.h - agent.r);
    return collided;
  }

  // Ligne de vue : le segment a-b est bloque par un batiment ?
  losBlocked(ax, ay, bx, by) {
    for (const b of this.buildings) {
      if (segmentIntersectsRect(ax, ay, bx, by, b)) return true;
    }
    return false;
  }

  losClear(a, b) {
    return !this.losBlocked(a.x, a.y, b.x, b.y);
  }

  pointInExtraction(x, y) {
    for (const e of this.extractions) {
      if (Math.hypot(x - e.x, y - e.y) <= e.r) return true;
    }
    return false;
  }

  // Combien d'entites (toutes vivantes ou non) sont dans une zone d'extraction.
  countInExtraction(entities) {
    let n = 0;
    for (const e of entities) {
      if (e.dead) continue;
      if (this.pointInExtraction(e.pos.x, e.pos.y)) n++;
    }
    return n;
  }

  // L'extraction reussit quand TOUS les allies vivants sont dans la zone.
  // Au moins un survivant requis ; les morts ne comptent plus.
  allAliveInExtraction(allies) {
    const alive = allies.filter(a => !a.dead);
    if (alive.length === 0) return false;
    return alive.every(a => this.pointInExtraction(a.pos.x, a.pos.y));
  }

  // Position de l'ancre (joueur) est-elle dans une extraction ?
  anchorInExtraction(pos) {
    return this.extractions.some(e => Math.hypot(pos.x - e.x, pos.y - e.y) <= e.r);
  }

  // Decoupage pixel-art fige pour la mission : asphalte, marquages, batiments, couvertures.
  // pg : graphics p5 deja dimensionne en world*s. S'affiche en un seul drawImage par frame.
  renderStatic(pg, s) {
    pg.push();
    pg.scale(s, s);

    // asphalte : base + taches + bruit deterministe
    pg.background(35, 38, 45);
    for (let i = 0; i < 26; i++) {
      const hx = hash2(i, 11), hy = hash2(i, 77), hw = 40 + hash2(i, 123) * 130;
      const hh = 30 + hash2(i, 213) * 90;
      pg.noStroke();
      pg.fill(hash2(i, 55) > 0.5 ? color(30, 33, 40, 120) : color(42, 46, 55, 120));
      pg.rect(hx * this.w, hy * this.h, hw, hh);
    }
    // bruit de pixels
    for (let i = 0; i < 2600; i++) {
      const x = hash2(i, 991) * this.w, y = hash2(i, 577) * this.h;
      const v = hash2(i, 331);
      pg.noStroke();
      pg.fill(v > 0.5 ? color(56, 60, 71) : color(24, 26, 33));
      pg.rect(Math.floor(x / 2) * 2, Math.floor(y / 2) * 2, 2, 2);
    }
    // marquages axiaux (arteres)
    pg.stroke(74, 76, 58);
    pg.strokeWeight(3);
    for (let x = 32; x < this.w; x += 96) {
      if (hash2(Math.round(x), 7) > 0.45) pg.line(x, this.h / 2, x + 34, this.h / 2);
    }
    for (let y = 32; y < this.h; y += 96) {
      if (hash2(Math.round(y), 13) > 0.45) pg.line(this.w / 2, y, this.w / 2, y + 34);
    }
    // quelques plaques d'egout
    for (let i = 0; i < 5; i++) {
      const x = hash2(i, 449) * this.w, y = hash2(i, 811) * this.h;
      pg.noStroke();
      pg.fill(28, 30, 38);
      pg.ellipse(x, y, 10, 10);
      pg.stroke(58, 62, 74);
      pg.strokeWeight(1);
      pg.ellipse(x, y, 8, 8);
      pg.noStroke();
    }

    // batiments : trottoir, facade, toit + accessoires deterministes
    for (const b of this.buildings) {
      // trottoir
      pg.noStroke();
      pg.fill(52, 56, 66);
      pg.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 2);
      pg.fill(64, 69, 82);
      pg.rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 2);
      // corps du batiment
      pg.fill(64, 68, 84);
      pg.rect(b.x, b.y, b.w, b.h, 2);
      // toit
      pg.fill(48, 51, 66);
      pg.rect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 1);
      pg.fill(42, 45, 58);
      pg.rect(b.x + 12, b.y + 12, b.w - 24, b.h - 24, 1);
      // arrete haute (lumiere du nord)
      pg.fill(96, 102, 126);
      pg.rect(b.x, b.y, b.w, 3);
      pg.rect(b.x, b.y, 3, b.h);
      // cote ombre
      pg.fill(30, 32, 44);
      pg.rect(b.x, b.y + b.h - 3, b.w, 3);
      pg.rect(b.x + b.w - 3, b.y, 3, b.h);
      // accessoires de toit (ventilo, escalier, antenne) selon le seed du batiment
      const seed = Math.round(b.x * 7 + b.y * 13);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      pg.fill(70, 74, 92);
      pg.rect(cx - 14, cy - 9, 12, 9);
      pg.fill(84, 88, 106);
      pg.rect(cx - 14, cy - 9, 12, 2);
      if (hash2(seed, 5) > 0.35) {
        pg.fill(60, 64, 80);
        pg.rect(cx + 4, cy + 2, 16, 10);
        pg.fill(74, 78, 96);
        pg.rect(cx + 4, cy + 2, 16, 2);
      }
      if (hash2(seed, 9) > 0.55) {
        pg.stroke(120, 126, 148);
        pg.strokeWeight(1);
        pg.line(cx + 14, cy - 12, cx + 14, cy - 26);
        pg.line(cx + 10, cy - 21, cx + 18, cy - 21);
        pg.line(cx + 11, cy - 16, cx + 17, cy - 16);
        pg.noStroke();
      }
      // bruit de toit
      for (let i = 0; i < Math.floor((b.w * b.h) / 90); i++) {
        const rx = b.x + 10 + hash2(seed + i, 171) * (b.w - 20);
        const ry = b.y + 10 + hash2(seed + i, 733) * (b.h - 20);
        pg.fill(hash2(seed + i, 91) > 0.5 ? color(56, 59, 74) : color(38, 40, 52));
        pg.rect(rx, ry, 2, 2);
      }
    }

    // couvertures
    for (const c of this.covers) {
      if (c.kind === 'vehicle') {
        // ombre portee
        pg.noStroke();
        pg.fill(20, 22, 28, 180);
        pg.rect(c.x + 4, c.y + 5, c.w, c.h, 5);
        // carrosserie
        pg.fill(74, 82, 58);
        pg.rect(c.x, c.y, c.w, c.h, 4);
        pg.fill(88, 98, 72);
        pg.rect(c.x + 3, c.y + 2, c.w - 6, c.h - 4, 3);
        // cabine
        pg.fill(96, 106, 82);
        pg.rect(c.x + c.w * 0.30, c.y + 4, c.w * 0.34, c.h - 8, 2);
        pg.fill(60, 70, 52);
        pg.rect(c.x + c.w * 0.34, c.y + 6, c.w * 0.26, 4);
        // roues
        pg.fill(18, 19, 24);
        pg.rect(c.x + 2, c.y - 2, 10, 4);
        pg.rect(c.x + c.w - 12, c.y - 2, 10, 4);
        pg.rect(c.x + 2, c.y + c.h - 2, 10, 4);
        pg.rect(c.x + c.w - 12, c.y + c.h - 2, 10, 4);
        // phares
        pg.fill(200, 200, 170);
        pg.rect(c.x + c.w - 2, c.y + 4, 2, 3);
        pg.rect(c.x + c.w - 2, c.y + c.h - 7, 2, 3);
      } else {
        // barriere ecrasable : ombre + plots + bandes
        pg.noStroke();
        pg.fill(18, 19, 24, 160);
        pg.rect(c.x + 2, c.y + 3, c.w, c.h, 2);
        pg.fill(126, 112, 62);
        pg.rect(c.x, c.y, c.w, c.h, 2);
        pg.fill(96, 84, 44);
        for (let x = c.x + 2; x < c.x + c.w - 2; x += 10) {
          pg.rect(x, c.y + 1, 4, c.h - 2);
        }
        pg.fill(150, 138, 84);
        pg.rect(c.x, c.y, c.w, 2);
      }
    }

    pg.pop();
  }

  draw() {
    // sol : asphalte avec quadrillage de rues
    background(38, 40, 46);
    stroke(48, 50, 57);
    strokeWeight(1);
    for (let x = 0; x <= this.w; x += 64) line(x, 0, x, this.h);
    for (let y = 0; y <= this.h; y += 64) line(0, y, this.w, y);

    // batiments
    for (const b of this.buildings) {
      noStroke();
      fill(70, 74, 88);
      rect(b.x, b.y, b.w, b.h, 3);
      fill(58, 62, 75);
      rect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 2);
      // fenetres
      fill(96, 102, 122);
      const cols = Math.floor((b.w - 16) / 22), rows = Math.floor((b.h - 16) / 22);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + Math.floor(b.x)) % 3 !== 0) {
            rect(b.x + 12 + i * 22, b.y + 12 + j * 22, 10, 8, 1);
          }
        }
      }
    }

    // couvertures : barrieres et vehicules
    for (const c of this.covers) {
      noStroke();
      if (c.kind === 'vehicle') {
        fill(84, 92, 74);
        rect(c.x, c.y, c.w, c.h, 6);
        fill(110, 120, 96);
        rect(c.x + c.w * 0.25, c.y + 3, c.w * 0.5, c.h - 6, 4);
      } else {
        fill(120, 108, 66);
        rect(c.x, c.y, c.w, c.h, 2);
        stroke(90, 80, 45);
        strokeWeight(2);
        for (let x = c.x + 4; x < c.x + c.w - 2; x += 12) line(x, c.y + 2, x + 6, c.y + c.h - 2);
        noStroke();
      }
    }

    // zone a securiser
    if (this.zone) {
      noFill();
      stroke(255, 200, 60, 180);
      strokeWeight(2);
      drawingContext.setLineDash([8, 6]);
      ellipse(this.zone.x, this.zone.y, this.zone.r * 2, this.zone.r * 2);
      drawingContext.setLineDash([]);
    }

    // zones d'extraction
    for (const e of this.extractions) {
      fill(40, 200, 220, 40);
      stroke(40, 220, 240, 200);
      strokeWeight(2);
      ellipse(e.x, e.y, e.r * 2, e.r * 2);
      noStroke();
      fill(120, 240, 250);
      textAlign(CENTER, CENTER);
      textSize(11);
      text('EXTRACTION', e.x, e.y);
    }
  }
}

// Bruit deterministe 2D -> [0, 1)
function hash2(i, j) {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Segment vs rectangle (intersection propere).
function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const edges = [
    [rect.x, rect.y, rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
    [rect.x, rect.y + rect.h, rect.x, rect.y]
  ];
  for (const [x1, y1, x2, y2] of edges) {
    if (segmentsIntersect(ax, ay, bx, by, x1, y1, x2, y2)) return true;
  }
  // segment entierement a l'interieur
  return pointInRect(ax, ay, rect) && pointInRect(bx, by, rect);
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function cross(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}
