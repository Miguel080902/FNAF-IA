// Screen coordinates, all in the game's 1280x720 space (office items in 1600x720 space).
export const OFFICE = {
  doorL: { x: 72, y: 0 },
  doorR: { x: 1270, y: 0 },
  panelL: { x: 0, y: 263 },
  panelR: { x: 1503, y: 263 },
  // Hit areas inside a 97x253 panel cell.
  panelDoor: { y0: 40, y1: 125 },
  panelLight: { y0: 130, y1: 215 },
  nose: { x: 664, y: 238, w: 24, h: 22 },
  golden: { x: 530, y: 170 },
};

export const HUD = {
  toggle: { x: 255, y: 640, w: 600, h: 60 },
  rec: { x: 68, y: 52 },
  disabled: { x: 450, y: 70 },
  camName: { x: 840, y: 296 },
  map: { x: 856, y: 358 },
  clockRight: 1195,
  clockY: 30,
  nightRight: 1238,
  nightY: 76,
  powerLabel: { x: 38, y: 632 },
  powerDigitsX: 186,
  usageLabel: { x: 38, y: 668 },
  usageBars: { x: 120, y: 658 },
};

// Top-left corner of each camera button (60x40).
export const CAM_BUTTONS = {
  '1A': [955, 337], '1B': [935, 393], '1C': [903, 471], 5: [828, 419], 7: [1167, 419],
  3: [870, 569], '2A': [955, 587], '2B': [955, 627], '4A': [1061, 587], '4B': [1061, 627], 6: [1158, 551],
};

export const MENU = {
  title: { x: 175, y: 70 },
  items: { x: 175, y: 400, step: 75 },
  cursorX: 110,
};
