// A* sur grille reguliere. Les cellules bloquees intersectent un rectangle gonfle (rayon agent).
class AStar {
  constructor(worldW, worldH, cellSize, buildings, inflate = 10) {
    this.cell = cellSize;
    this.cols = Math.ceil(worldW / cellSize);
    this.rows = Math.ceil(worldH / cellSize);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cx = col * cellSize;
        const cy = row * cellSize;
        for (const b of buildings) {
          if (cx < b.x + b.w + inflate && cx + cellSize > b.x - inflate &&
              cy < b.y + b.h + inflate && cy + cellSize > b.y - inflate) {
            this.blocked[row * this.cols + col] = 1;
            break;
          }
        }
      }
    }
  }

  isBlockedCell(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
    return this.blocked[row * this.cols + col] === 1;
  }

  nearestFree(col, row) {
    if (!this.isBlockedCell(col, row)) return { col, row };
    for (let radius = 1; radius < Math.max(this.cols, this.rows); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (!this.isBlockedCell(col + dx, row + dy)) return { col: col + dx, row: row + dy };
        }
      }
    }
    return null;
  }

  worldToCell(x, y) {
    return { col: Math.floor(x / this.cell), row: Math.floor(y / this.cell) };
  }

  cellToWorld(col, row) {
    return { x: col * this.cell + this.cell / 2, y: row * this.cell + this.cell / 2 };
  }

  // Retourne une liste de points monde (centre de cellule), ou [] si injoignable.
  findPath(startX, startY, goalX, goalY) {
    const sc = this.worldToCell(startX, startY), gc = this.worldToCell(goalX, goalY);
    const start = this.nearestFree(sc.col, sc.row);
    const goal = this.nearestFree(gc.col, gc.row);
    if (!start || !goal) return [];

    const cols = this.cols, rows = this.rows;
    const idx = (c, r) => r * cols + c;
    const g = new Float64Array(cols * rows).fill(Infinity);
    const f = new Float64Array(cols * rows).fill(Infinity);
    const parent = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const open = [idx(start.col, start.row)];
    g[idx(start.col, start.row)] = 0;
    f[idx(start.col, start.row)] = this._heuristic(start.col, start.row, goal.col, goal.row);

    const neighbors = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

    while (open.length > 0) {
      // extraire le noeud de plus petit f
      let bestI = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bestI]]) bestI = i;
      const current = open.splice(bestI, 1)[0];
      if (closed[current]) continue;
      closed[current] = 1;
      const cc = current % cols, cr = Math.floor(current / cols);
      if (cc === goal.col && cr === goal.row) {
        // reconstruire
        const path = [];
        let node = current;
        while (node !== -1) {
          path.push(this.cellToWorld(node % cols, Math.floor(node / cols)));
          node = parent[node];
        }
        path.reverse();
        path.push({ x: goalX, y: goalY }); // destination exacte
        return this._smooth(path, startX, startY);
      }
      for (const [dx, dy, cost] of neighbors) {
        const nc = cc + dx, nr = cr + dy;
        if (this.isBlockedCell(nc, nr)) continue;
        // pas de diagonale en "coin" a travers un mur
        if (dx !== 0 && dy !== 0 && (this.isBlockedCell(cc + dx, cr) || this.isBlockedCell(cc, nr + dy))) continue;
        const ni = idx(nc, nr);
        const tentative = g[current] + cost;
        if (tentative < g[ni]) {
          g[ni] = tentative;
          f[ni] = tentative + this._heuristic(nc, nr, goal.col, goal.row);
          parent[ni] = current;
          if (!closed[ni]) open.push(ni);
        }
      }
    }
    return [];
  }

  _heuristic(col, row, goalCol, goalRow) {
    const dx = Math.abs(col - goalCol), dy = Math.abs(row - goalRow);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); // octile
  }

  // Supprime les waypoints intermediaires visibles en ligne droite (los fournie par l'appelant).
  _smooth(path) {
    if (path.length <= 2) return path;
    const smoothed = [path[0]];
    let anchor = 0;
    for (let i = 2; i < path.length; i++) {
      if (!this._lineFree(path[anchor], path[i])) {
        smoothed.push(path[i - 1]);
        anchor = i - 1;
      }
    }
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  _lineFree(a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (this.cell / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (this.isBlockedCell(Math.floor(x / this.cell), Math.floor(y / this.cell))) return false;
    }
    return true;
  }
}
