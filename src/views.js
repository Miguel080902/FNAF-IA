// Picks which sprite-sheet frame a camera shows for a given simulation state.
import { CAMERA } from './config.js';

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const rare = (rng, base, alternatives) => (rng() < CAMERA.rareViewChance ? pick(rng, alternatives) : base);

export function cameraFrame(sim, cam, rng = Math.random) {
  const { bonnie, chica, freddy } = sim.pos;
  switch (cam) {
    case '1A': {
      if (bonnie === '1A' && chica === '1A') return ['stage', rare(rng, 0, [1])];
      if (chica === '1A') return ['stage', 2];
      if (bonnie === '1A') return ['stage', 3];
      if (freddy === '1A') return ['stage', rare(rng, 4, [5])];
      return ['stage', 6];
    }
    case '1B':
      if (bonnie === '1B') return ['dining', pick(rng, [1, 2])];
      if (chica === '1B') return ['dining', pick(rng, [3, 4])];
      if (freddy === '1B') return ['dining', 5];
      return ['dining', 0];
    case '1C': {
      if (sim.foxy.stage >= 3 || sim.foxy.running) return ['cove', rare(rng, 3, [4])];
      return ['cove', sim.foxy.stage];
    }
    case '2A':
      if (bonnie === '2A') return ['west', 8];
      return ['west', pick(rng, [6, 6, 6, 7])];
    case '2B':
      if (bonnie === '2B') return ['west', rare(rng, pick(rng, [3, 4]), [5])];
      if (sim.goldenPoster) return ['west', 2];
      return ['west', rare(rng, 0, [1])];
    case '3':
      return ['closet', bonnie === '3' ? 1 : 0];
    case '4A':
      if (chica === '4A') return ['east', pick(rng, [4, 5])];
      if (freddy === '4A') return ['east', 3];
      return ['east', rare(rng, 0, [1, 2])];
    case '4B':
      if (chica === '4B') return ['east', pick(rng, [11, 12, 13])];
      if (freddy === '4B') return ['east', 14];
      return ['east', rare(rng, 6, [7, 8, 9, 10])];
    case '5':
      if (bonnie === '5') return ['backstage', pick(rng, [2, 3])];
      return ['backstage', rare(rng, 0, [1])];
    case '6':
      return null; // Audio only.
    case '7':
      if (chica === '7') return ['restrooms', pick(rng, [1, 2])];
      if (freddy === '7') return ['restrooms', 3];
      return ['restrooms', 0];
    default:
      return null;
  }
}

export function officeFrame(sim) {
  if (sim.lights.L) return sim.pos.bonnie === 'doorL' ? 4 : 2;
  if (sim.lights.R) return sim.pos.chica === 'doorR' ? 5 : 3;
  return 0;
}
