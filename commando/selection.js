// SquadSelection : modele pur de la selection multiple de soldats IA.
// Aucune dependance DOM/p5 : utilise par sketch.js, couvert par tests/selection.test.mjs.
class SquadSelection {
  constructor() {
    this.members = new Set();
    this.primary = null; // dernier soldat vivant clique : focus AI Lab / debug
  }

  has(unit) {
    return this.members.has(unit);
  }

  get size() {
    return this.members.size;
  }

  clear() {
    this.members.clear();
    this.primary = null;
  }

  prune() {
    for (const u of [...this.members]) {
      if (u.dead) this.members.delete(u);
    }
    if (this.primary && (this.primary.dead || !this.members.has(this.primary))) {
      const arr = [...this.members];
      this.primary = arr.length ? arr[arr.length - 1] : null;
    }
  }

  list() {
    this.prune();
    return [...this.members];
  }

  toggle(unit) {
    this.prune();
    if (this.members.has(unit)) this.members.delete(unit);
    else this.members.add(unit);
    if (!this.members.has(this.primary)) {
      const arr = [...this.members];
      this.primary = arr.length ? arr[arr.length - 1] : null;
    }
    if (this.members.has(unit)) this.primary = unit; // clic = focus sur le soldat choisi
    return this.members.has(unit);
  }

  // Selection exactement egale a units (cycle Q : un seul ; selectionner tout : tous les vivants)
  selectExactly(units) {
    this.members.clear();
    let last = null;
    for (const u of units) {
      if (u && !u.dead) {
        this.members.add(u);
        last = u;
      }
    }
    this.primary = last; // le dernier de la liste devient le principal
  }

  selectAll(allUnits) {
    this.selectExactly(allUnits.filter(u => u && !u.dead));
  }

  // Cibles des commandes : la selection si elle existe (et est vivante), sinon toute l'IA vivante
  pool(allAi) {
    const alive = allAi.filter(u => u && !u.dead);
    if (this.members.size === 0) return alive;
    return alive.filter(u => this.members.has(u));
  }
}
