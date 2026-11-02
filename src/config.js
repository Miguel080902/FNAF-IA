// Every gameplay number lives here, tagged with where it comes from:
//   [doc]   the project's mechanics document
//   [table] community AI table (rorotestsite.neocities.org/mechanics), matches the doc
//   [wiki]  community wiki figure found by search
//   [mem]   recalled from the Boxfigs decompile; no readable source confirmed it
//   [tune]  no source: chosen to feel right
export const FPS = 60;

export const NIGHT = {
  firstHourSec: 90, // [doc] 535 s in total (90 + 5 x 89)
  hourSec: 89,
  hours: 6,
};

// [table] Order: freddy, bonnie, chica, foxy. Night 4 Freddy is a 50/50 between 1 and 2.
export const AI_BY_NIGHT = {
  1: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 },
  2: { freddy: 0, bonnie: 3, chica: 1, foxy: 1 },
  3: { freddy: 1, bonnie: 0, chica: 5, foxy: 2 },
  4: { freddy: [1, 2], bonnie: 2, chica: 4, foxy: 6 },
  5: { freddy: 3, bonnie: 5, chica: 7, foxy: 5 },
  6: { freddy: 4, bonnie: 10, chica: 12, foxy: 16 },
};

// [table][doc] AI bonus gained when the clock reaches each hour. Freddy never gains any.
export const AI_HOUR_BONUS = {
  2: ['bonnie'],
  3: ['bonnie', 'chica', 'foxy'],
  4: ['bonnie', 'chica', 'foxy'],
};

export const MOVE_INTERVAL = { // [wiki] precise values; the doc rounds them to 3 s and 5 s
  freddy: 3.02,
  bonnie: 4.97,
  chica: 4.98,
  foxy: 5.01,
};

export const POWER = {
  secondsPerPercentAtUsage1: 9.6, // [mem] 9.6 / 4.8 / 3.2 / 2.4 s per 1% at usage 1-4
  passiveAmount: 0.1, // [doc]
  passiveIntervalByNight: { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3, 7: 3 }, // [doc] night 1 has none
};

// Possible next rooms on a successful roll.
// [mem] Bonnie and Chica graphs follow the decompile; the doc's Chica route is one path through it.
export const ROUTES = {
  bonnie: {
    '1A': ['1B', '5'],
    '1B': ['5', '2A'],
    5: ['1B', '2A'],
    '2A': ['3', '2B'],
    3: ['2A', 'doorL'],
    '2B': ['3', 'doorL'],
  },
  chica: {
    '1A': ['1B'],
    '1B': ['7', '6'],
    7: ['6', '1B'],
    6: ['7', '4A'],
    '4A': ['1B', '4B'],
    '4B': ['4A', 'doorR'],
  },
  freddy: { // [doc] same side of the building as Chica
    '1A': ['1B'],
    '1B': ['7'],
    7: ['6'],
    6: ['4A'],
    '4A': ['4B'],
  },
};

export const RETREAT = { bonnie: '1B', chica: '4A', freddy: '4A' }; // [mem]

export const ATTACK = {
  forcedCameraDropSec: 30, // [doc] about 30 s on the monitor with someone inside
};

export const FOXY = {
  // [mem] Random lock after lowering the monitor, on every night. The doc says a flat 1 s;
  // set both values to 1 to try that version.
  cameraLockMinSec: 0.83,
  cameraLockMaxSec: 16.67,
  attackFrames: 1500, // [doc] 25 s at 60 FPS
  runSec: 1.6, // [tune] length of the corridor sprint
  knockFirstDrain: 1, // [doc] 1, 6, 11, 16, 16...
  knockDrainStep: 5,
  knockDrainMax: 16,
  returnStages: [0, 1], // [doc] back in phase 1 or 2
};

export const FREDDY = {
  countdownFrames: (ai) => Math.max(0, 1000 - 100 * ai), // [doc]
  officeKillChancePerSec: 0.25, // [doc]
};

export const POWER_OUT = { // [doc]
  stepSec: 5,
  chance: 0.2,
  maxSec: 20,
  killStepSec: 2,
  killChance: 0.2,
};

export const GOLDEN = {
  posterChance: 0.00001 / 100, // [doc] 0.00001% each time CAM 2B is opened
  stareSec: 5, // [doc]
  menuChance: 0.0001 / 100, // [doc] on game over
  customNightCode: { freddy: 1, bonnie: 9, chica: 8, foxy: 7 }, // [mem] the 1987 easter egg
};

export const CAMERA = {
  flipSec: 0.37, // [tune] 11 frames at about 30 FPS
  moveStaticSec: 2, // [tune] static when someone leaves or enters the watched room
  rareViewChance: 0.01, // [tune] alternate posters and stares
};

export const CAM_NAMES = ['1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5', '6', '7'];
