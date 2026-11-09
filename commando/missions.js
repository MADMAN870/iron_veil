// Definitions des 3 missions. Coordonnees en pixels sur la carte 1024x640.
function getMissions() {
  return [
    {
      id: 1,
      name: 'Mission 1 — Terrain d\'entrainement',
      difficulty: 'Debutant',
      briefing: 'Apprenez les commandes d\'escouade et le tir. Eliminez les 3 drones d\'entrainement (Violet, inoffensifs), puis rejoignez la zone d\'extraction.',
      spawn: { x: 90, y: 320 },
      buildings: [
        { x: 420, y: 60, w: 90, h: 70 },
        { x: 640, y: 430, w: 100, h: 80 }
      ],
      covers: [
        { x: 300, y: 240, w: 46, h: 10, kind: 'barrier' },
        { x: 520, y: 320, w: 46, h: 10, kind: 'barrier' },
        { x: 740, y: 200, w: 56, h: 24, kind: 'vehicle' }
      ],
      enemies: [
        { x: 380, y: 180, patrol: [{ x: 380, y: 140 }, { x: 380, y: 230 }], opts: { passive: true } },
        { x: 600, y: 400, patrol: [{ x: 560, y: 400 }, { x: 660, y: 400 }], opts: { passive: true } },
        { x: 820, y: 160, patrol: [{ x: 820, y: 120 }, { x: 860, y: 210 }], opts: { passive: true } }
      ],
      objectives: [
        { type: 'eliminate', count: 3, label: 'Eliminer les 3 drones d\'entrainement' },
        { type: 'extract', label: 'Toute l\'escouade survivante a la zone d\'extraction' }
      ],
      extractions: [{ x: 920, y: 535, r: 80 }]
    },

    {
      id: 2,
      name: 'Mission 2 — Infiltration urbaine',
      difficulty: 'Intermediaire',
      briefing: 'Infiltrez la ville, reperez les patrouilles (rouge), securisez le point de jonction (cercle jaune, 3 secondes), puis extrayez-vous.',
      spawn: { x: 70, y: 320 },
      buildings: [
        { x: 170, y: 40, w: 130, h: 100 },
        { x: 400, y: 30, w: 110, h: 150 },
        { x: 610, y: 70, w: 150, h: 90 },
        { x: 800, y: 40, w: 140, h: 130 },
        { x: 90, y: 280, w: 140, h: 110 },
        { x: 350, y: 270, w: 110, h: 110 },
        { x: 590, y: 300, w: 130, h: 120 },
        { x: 830, y: 280, w: 110, h: 140 },
        { x: 60, y: 490, w: 170, h: 80 },
        { x: 330, y: 470, w: 150, h: 100 },
        { x: 630, y: 490, w: 160, h: 90 }
      ],
      covers: [
        { x: 280, y: 200, w: 46, h: 10, kind: 'barrier' },
        { x: 520, y: 210, w: 46, h: 10, kind: 'barrier' },
        { x: 720, y: 240, w: 56, h: 24, kind: 'vehicle' },
        { x: 250, y: 440, w: 56, h: 24, kind: 'vehicle' },
        { x: 520, y: 450, w: 46, h: 10, kind: 'barrier' },
        { x: 760, y: 460, w: 46, h: 10, kind: 'barrier' }
      ],
      enemies: [
        { x: 300, y: 160, patrol: [{ x: 300, y: 120 }, { x: 480, y: 230 }], opts: {} },
        { x: 680, y: 200, patrol: [{ x: 680, y: 190 }, { x: 900, y: 230 }], opts: {} },
        { x: 220, y: 460, patrol: [{ x: 140, y: 450 }, { x: 280, y: 420 }], opts: {} },
        { x: 500, y: 520, patrol: [{ x: 400, y: 520 }, { x: 640, y: 540 }], opts: {} },
        { x: 900, y: 500, patrol: [{ x: 860, y: 440 }, { x: 940, y: 540 }], opts: {} },
        { x: 560, y: 180, patrol: [{ x: 560, y: 140 }, { x: 640, y: 180 }, { x: 560, y: 230 }], opts: {} }
      ],
      zone: { x: 512, y: 356, r: 46 },
      objectives: [
        { type: 'secure', seconds: 3, label: 'Securiser le point de jonction (3 s)' },
        { type: 'extract', label: 'Extraire toute l\'escouade survivante' }
      ],
      extractions: [{ x: 920, y: 535, r: 80 }]
    },

    {
      id: 3,
      name: 'Mission 3 — Extraction',
      difficulty: 'Avance',
      briefing: 'Un soldat est blesse (Sante < 50). Protegez-le, laissez le Medic le stabiliser, puis atteignez la zone d\'extraction. Des renforts hostiles arrivent toutes les 40 secondes.',
      spawn: { x: 70, y: 320 },
      buildings: [
        { x: 150, y: 30, w: 120, h: 90 },
        { x: 330, y: 60, w: 90, h: 140 },
        { x: 500, y: 30, w: 140, h: 80 },
        { x: 700, y: 40, w: 120, h: 120 },
        { x: 880, y: 30, w: 100, h: 150 },
        { x: 80, y: 230, w: 110, h: 130 },
        { x: 280, y: 260, w: 130, h: 100 },
        { x: 480, y: 240, w: 100, h: 140 },
        { x: 660, y: 230, w: 130, h: 110 },
        { x: 60, y: 450, w: 140, h: 110 },
        { x: 260, y: 440, w: 100, h: 120 },
        { x: 430, y: 460, w: 150, h: 100 },
        { x: 660, y: 450, w: 120, h: 120 },
        { x: 850, y: 460, w: 120, h: 110 }
      ],
      covers: [
        { x: 220, y: 190, w: 46, h: 10, kind: 'barrier' },
        { x: 450, y: 200, w: 56, h: 24, kind: 'vehicle' },
        { x: 620, y: 180, w: 46, h: 10, kind: 'barrier' },
        { x: 810, y: 200, w: 56, h: 24, kind: 'vehicle' },
        { x: 210, y: 410, w: 56, h: 24, kind: 'vehicle' },
        { x: 400, y: 420, w: 46, h: 10, kind: 'barrier' },
        { x: 620, y: 410, w: 56, h: 24, kind: 'vehicle' },
        { x: 810, y: 420, w: 46, h: 10, kind: 'barrier' }
      ],
      enemies: [
        { x: 320, y: 170, patrol: [{ x: 320, y: 150 }, { x: 440, y: 230 }], opts: {} },
        { x: 600, y: 160, patrol: [{ x: 540, y: 140 }, { x: 700, y: 200 }], opts: {} },
        { x: 820, y: 170, patrol: [{ x: 780, y: 140 }, { x: 900, y: 220 }], opts: {} },
        { x: 180, y: 420, patrol: [{ x: 130, y: 420 }, { x: 250, y: 400 }], opts: {} },
        { x: 520, y: 500, patrol: [{ x: 460, y: 500 }, { x: 600, y: 520 }], opts: {} },
        { x: 880, y: 500, patrol: [{ x: 840, y: 430 }, { x: 920, y: 540 }], opts: {} }
      ],
      injured: { role: 'assault', health: 40 },
      reinforcements: { intervalSec: 40, maxExtra: 4, spawns: [{ x: 1010, y: 40 }, { x: 1010, y: 600 }, { x: 640, y: 620 }] },
      objectives: [
        { type: 'extract', label: 'Extraire toute l\'escouade survivante (blesse compris)' }
      ],
      extractions: [{ x: 920, y: 320, r: 80 }]
    },

    {
      id: 4,
      name: 'Mission 4 — Bastion',
      difficulty: 'Tres difficile',
      briefing: 'Assaut du Bastion : une colonne de 8 hostiles (patrouilles serrees) tient le complexe. Eliminez-les tous, puis extrayez-vous. Des renforts arrivent toutes les 35 secondes (max 4).',
      spawn: { x: 60, y: 320 },
      buildings: [
        { x: 150, y: 40, w: 120, h: 80 },
        { x: 340, y: 40, w: 90, h: 110 },
        { x: 500, y: 30, w: 140, h: 70 },
        { x: 700, y: 50, w: 130, h: 110 },
        { x: 880, y: 40, w: 80, h: 140 },
        { x: 80, y: 190, w: 100, h: 120 },
        { x: 250, y: 240, w: 110, h: 110 },
        { x: 430, y: 220, w: 80, h: 90 },
        { x: 570, y: 180, w: 120, h: 90 },
        { x: 750, y: 220, w: 100, h: 90 },
        { x: 890, y: 230, w: 90, h: 130 },
        { x: 60, y: 400, w: 150, h: 90 },
        { x: 280, y: 420, w: 130, h: 100 },
        { x: 480, y: 420, w: 90, h: 110 },
        { x: 660, y: 390, w: 140, h: 100 }
      ],
      covers: [
        { x: 220, y: 140, w: 46, h: 10, kind: 'barrier' },
        { x: 400, y: 160, w: 56, h: 24, kind: 'vehicle' },
        { x: 610, y: 140, w: 46, h: 10, kind: 'barrier' },
        { x: 820, y: 170, w: 56, h: 24, kind: 'vehicle' },
        { x: 200, y: 370, w: 46, h: 10, kind: 'barrier' },
        { x: 430, y: 360, w: 56, h: 24, kind: 'vehicle' },
        { x: 620, y: 350, w: 46, h: 10, kind: 'barrier' },
        { x: 810, y: 360, w: 56, h: 24, kind: 'vehicle' }
      ],
      enemies: [
        { x: 220, y: 170, patrol: [{ x: 210, y: 150 }, { x: 360, y: 210 }], opts: {} },
        { x: 390, y: 170, patrol: [{ x: 360, y: 150 }, { x: 460, y: 210 }], opts: {} },
        { x: 570, y: 130, patrol: [{ x: 520, y: 130 }, { x: 660, y: 170 }], opts: {} },
        { x: 760, y: 170, patrol: [{ x: 720, y: 130 }, { x: 830, y: 200 }], opts: {} },
        { x: 915, y: 180, patrol: [{ x: 880, y: 140 }, { x: 940, y: 360 }], opts: {} },
        { x: 160, y: 440, patrol: [{ x: 130, y: 390 }, { x: 200, y: 490 }], opts: {} },
        { x: 350, y: 380, patrol: [{ x: 330, y: 370 }, { x: 400, y: 450 }], opts: {} },
        { x: 730, y: 350, patrol: [{ x: 700, y: 340 }, { x: 800, y: 430 }], opts: {} }
      ],
      reinforcements: { intervalSec: 35, maxExtra: 4, spawns: [{ x: 1010, y: 40 }, { x: 1010, y: 600 }, { x: 640, y: 620 }] },
      objectives: [
        { type: 'eliminate', count: 8, label: 'Eliminer la garnison (8 hostiles)' },
        { type: 'extract', label: 'Extraire toute l\'escouade survivante' }
      ],
      extractions: [{ x: 920, y: 535, r: 80 }]
    },

    {
      id: 5,
      name: 'Mission 5 — La Derniere Porte',
      difficulty: 'Expert',
      briefing: 'Operation de nuit : tenez le carrefour pendant 5 secondes sous les assauts, puis atteignez la derniere porte (extraction). Des vagues de renforts ennemis arrivent toutes les 22 secondes (max 8).',
      spawn: { x: 60, y: 320 },
      buildings: [
        { x: 140, y: 30, w: 130, h: 90 },
        { x: 330, y: 50, w: 90, h: 130 },
        { x: 480, y: 30, w: 150, h: 80 },
        { x: 700, y: 40, w: 130, h: 110 },
        { x: 870, y: 30, w: 110, h: 150 },
        { x: 80, y: 240, w: 90, h: 130 },
        { x: 260, y: 250, w: 120, h: 90 },
        { x: 560, y: 210, w: 110, h: 110 },
        { x: 760, y: 220, w: 120, h: 120 },
        { x: 60, y: 450, w: 150, h: 100 },
        { x: 300, y: 450, w: 110, h: 110 },
        { x: 500, y: 440, w: 150, h: 110 },
        { x: 700, y: 450, w: 100, h: 110 }
      ],
      covers: [
        { x: 220, y: 180, w: 56, h: 24, kind: 'vehicle' },
        { x: 420, y: 180, w: 46, h: 10, kind: 'barrier' },
        { x: 600, y: 160, w: 56, h: 24, kind: 'vehicle' },
        { x: 800, y: 180, w: 46, h: 10, kind: 'barrier' },
        { x: 400, y: 360, w: 46, h: 10, kind: 'barrier' },
        { x: 620, y: 370, w: 56, h: 24, kind: 'vehicle' },
        { x: 820, y: 380, w: 46, h: 10, kind: 'barrier' }
      ],
      enemies: [
        { x: 260, y: 190, patrol: [{ x: 230, y: 150 }, { x: 340, y: 220 }], opts: {} },
        { x: 520, y: 150, patrol: [{ x: 480, y: 130 }, { x: 600, y: 200 }], opts: {} },
        { x: 720, y: 160, patrol: [{ x: 680, y: 140 }, { x: 780, y: 210 }], opts: {} },
        { x: 880, y: 200, patrol: [{ x: 850, y: 170 }, { x: 920, y: 260 }], opts: {} },
        { x: 230, y: 400, patrol: [{ x: 190, y: 400 }, { x: 280, y: 350 }], opts: {} },
        { x: 560, y: 380, patrol: [{ x: 520, y: 380 }, { x: 620, y: 420 }], opts: {} }
      ],
      zone: { x: 512, y: 336, r: 52 },
      reinforcements: { intervalSec: 22, maxExtra: 8, spawns: [{ x: 1010, y: 30 }, { x: 1010, y: 610 }, { x: 640, y: 630 }] },
      objectives: [
        { type: 'secure', seconds: 5, label: 'Tenir le carrefour (5 s) sous les vagues' },
        { type: 'extract', label: 'Extraire toute l\'escouade survivante' }
      ],
      extractions: [{ x: 920, y: 535, r: 80 }]
    },

    {
      id: 6,
      name: 'Mission 6 — Mur de Fer',
      difficulty: 'Cauchemar',
      briefing: 'Cauchemar : un complexe fortifie tient une garnison d\'elite (10 hostiles, blindage et degats renforces). Eliminez-les tous, puis extrayez-vous. Des renforts d\'elite arrivent toutes les 30 secondes (max 5).',
      spawn: { x: 50, y: 320 },
      buildings: [
        { x: 140, y: 30, w: 120, h: 90 },
        { x: 320, y: 40, w: 100, h: 110 },
        { x: 500, y: 30, w: 130, h: 70 },
        { x: 700, y: 40, w: 120, h: 110 },
        { x: 870, y: 30, w: 100, h: 140 },
        { x: 70, y: 230, w: 110, h: 120 },
        { x: 260, y: 240, w: 110, h: 100 },
        { x: 440, y: 210, w: 90, h: 90 },
        { x: 590, y: 180, w: 120, h: 110 },
        { x: 780, y: 230, w: 100, h: 110 },
        { x: 60, y: 450, w: 150, h: 90 },
        { x: 260, y: 450, w: 130, h: 100 },
        { x: 450, y: 440, w: 100, h: 110 },
        { x: 660, y: 440, w: 130, h: 100 }
      ],
      covers: [
        { x: 190, y: 180, w: 56, h: 24, kind: 'vehicle' },
        { x: 380, y: 140, w: 46, h: 10, kind: 'barrier' },
        { x: 620, y: 140, w: 46, h: 10, kind: 'barrier' },
        { x: 830, y: 170, w: 56, h: 24, kind: 'vehicle' },
        { x: 170, y: 390, w: 56, h: 24, kind: 'vehicle' },
        { x: 420, y: 370, w: 46, h: 10, kind: 'barrier' },
        { x: 630, y: 350, w: 46, h: 10, kind: 'barrier' },
        { x: 820, y: 400, w: 56, h: 24, kind: 'vehicle' }
      ],
      enemies: [
        { x: 250, y: 150, patrol: [{ x: 250, y: 150 }, { x: 380, y: 200 }], opts: {} },
        { x: 450, y: 130, patrol: [{ x: 430, y: 120 }, { x: 560, y: 170 }], opts: { maxHealth: 80 } },
        { x: 670, y: 110, patrol: [{ x: 600, y: 100 }, { x: 750, y: 150 }], opts: {} },
        { x: 920, y: 195, patrol: [{ x: 880, y: 195 }, { x: 950, y: 235 }], opts: { maxHealth: 80 } },
        { x: 220, y: 320, patrol: [{ x: 200, y: 378 }, { x: 350, y: 378 }], opts: {} },
        { x: 380, y: 290, patrol: [{ x: 340, y: 360 }, { x: 470, y: 330 }], opts: { maxHealth: 80 } },
        { x: 560, y: 330, patrol: [{ x: 520, y: 300 }, { x: 650, y: 340 }], opts: {} },
        { x: 750, y: 290, patrol: [{ x: 715, y: 325 }, { x: 775, y: 325 }], opts: { maxHealth: 80, damage: 10 } },
        { x: 330, y: 560, patrol: [{ x: 265, y: 585 }, { x: 430, y: 560 }], opts: {} },
        { x: 700, y: 555, patrol: [{ x: 630, y: 570 }, { x: 780, y: 585 }], opts: { maxHealth: 80 } }
      ],
      reinforcements: { intervalSec: 30, maxExtra: 5, spawns: [{ x: 1010, y: 40 }, { x: 1010, y: 600 }, { x: 640, y: 630 }] },
      objectives: [
        { type: 'eliminate', count: 10, label: 'Eliminer la garnison d\'elite (10 hostiles)' },
        { type: 'extract', label: 'Extraire toute l\'escouade survivante' }
      ],
      extractions: [{ x: 915, y: 545, r: 80 }]
    },

    {
      id: 7,
      name: 'Mission 7 — La Nuit des Cendres',
      difficulty: 'Cauchemar',
      briefing: 'Cauchemar final : tenez le carrefour des cendres 6 secondes sous des vagues incessantes (renforts toutes les 18 secondes, max 8), des hostiles d\'elite partout, puis atteignez la derniere porte.',
      spawn: { x: 60, y: 320 },
      buildings: [
        { x: 140, y: 30, w: 130, h: 90 },
        { x: 330, y: 30, w: 90, h: 130 },
        { x: 460, y: 30, w: 150, h: 80 },
        { x: 680, y: 40, w: 130, h: 110 },
        { x: 860, y: 30, w: 110, h: 150 },
        { x: 80, y: 240, w: 90, h: 130 },
        { x: 250, y: 250, w: 110, h: 90 },
        { x: 560, y: 210, w: 120, h: 110 },
        { x: 760, y: 220, w: 120, h: 110 },
        { x: 60, y: 450, w: 150, h: 100 },
        { x: 280, y: 440, w: 110, h: 110 },
        { x: 490, y: 440, w: 130, h: 110 },
        { x: 680, y: 440, w: 110, h: 110 }
      ],
      covers: [
        { x: 220, y: 180, w: 56, h: 24, kind: 'vehicle' },
        { x: 420, y: 180, w: 46, h: 10, kind: 'barrier' },
        { x: 620, y: 160, w: 56, h: 24, kind: 'vehicle' },
        { x: 800, y: 180, w: 46, h: 10, kind: 'barrier' },
        { x: 400, y: 360, w: 46, h: 10, kind: 'barrier' },
        { x: 600, y: 360, w: 56, h: 24, kind: 'vehicle' },
        { x: 810, y: 360, w: 46, h: 10, kind: 'barrier' }
      ],
      enemies: [
        { x: 260, y: 190, patrol: [{ x: 230, y: 150 }, { x: 340, y: 220 }], opts: {} },
        { x: 520, y: 150, patrol: [{ x: 480, y: 130 }, { x: 600, y: 200 }], opts: { maxHealth: 75 } },
        { x: 720, y: 160, patrol: [{ x: 680, y: 140 }, { x: 790, y: 210 }], opts: {} },
        { x: 880, y: 200, patrol: [{ x: 850, y: 170 }, { x: 920, y: 260 }], opts: { maxHealth: 75, damage: 9 } },
        { x: 230, y: 400, patrol: [{ x: 190, y: 380 }, { x: 280, y: 350 }], opts: {} },
        { x: 560, y: 380, patrol: [{ x: 520, y: 380 }, { x: 620, y: 430 }], opts: { maxHealth: 75 } },
        { x: 390, y: 300, patrol: [{ x: 385, y: 295 }, { x: 460, y: 300 }], opts: {} },
        { x: 510, y: 310, patrol: [{ x: 470, y: 275 }, { x: 545, y: 345 }], opts: { maxHealth: 75, damage: 9 } },
        { x: 840, y: 420, patrol: [{ x: 800, y: 400 }, { x: 900, y: 470 }], opts: {} }
      ],
      zone: { x: 480, y: 336, r: 52 },
      reinforcements: { intervalSec: 18, maxExtra: 8, spawns: [{ x: 1010, y: 30 }, { x: 1010, y: 610 }, { x: 640, y: 630 }] },
      objectives: [
        { type: 'secure', seconds: 6, label: 'Tenir le carrefour des cendres (6 s) sous les vagues' },
        { type: 'extract', label: 'Extraire toute l\'escouade survivante' }
      ],
      extractions: [{ x: 920, y: 540, r: 80 }]
    }
  ];
}
