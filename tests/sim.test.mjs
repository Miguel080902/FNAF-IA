import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sim } from '../src/sim.js';

const FLIP = 0.4;
const run = (sim, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds && !sim.result; t += dt) sim.step(dt);
};
const always = () => 0; // every roll succeeds and picks the first option
const never = () => 0.999999;
const noAi = { freddy: 0, bonnie: 0, chica: 0, foxy: 0 };
const flip = (sim) => { sim.toggleCamera(); run(sim, FLIP); };

test('a quiet night lasts 535 seconds and is won', () => {
  const s = new Sim({ night: 1, rng: never });
  run(s, 534);
  assert.equal(s.result, null);
  assert.equal(s.hour, 5);
  run(s, 2);
  assert.equal(s.result, 'win');
});

test('night table: night 6 starts at the expected AI levels', () => {
  const s = new Sim({ night: 6, rng: never });
  assert.deepEqual(s.ai, { freddy: 4, bonnie: 10, chica: 12, foxy: 16 });
});

test('night 4 Freddy is either 1 or 2', () => {
  assert.equal(new Sim({ night: 4, rng: () => 0 }).ai.freddy, 1);
  assert.equal(new Sim({ night: 4, rng: () => 0.9 }).ai.freddy, 2);
});

test('AI grows at 2, 3 and 4 AM and Freddy never changes', () => {
  const s = new Sim({ night: 1, rng: never });
  run(s, 90 + 89 * 3 + 1);
  assert.equal(s.hour, 4);
  assert.deepEqual(s.ai, { freddy: 0, bonnie: 3, chica: 2, foxy: 2 });
});

test('usage 1 drains 1% every 9.6 s and night 1 has no passive drain', () => {
  const s = new Sim({ night: 1, rng: never });
  run(s, 96);
  assert.ok(Math.abs(s.power - 90) < 0.05, `power ${s.power}`);
});

test('night 2 adds 0.1% every 6 s', () => {
  const s = new Sim({ night: 2, ai: noAi, rng: never });
  run(s, 60);
  assert.ok(Math.abs(s.power - (100 - 60 / 9.6 - 1)) < 0.15, `power ${s.power}`);
});

test('usage counts doors, light and monitor', () => {
  const s = new Sim({ night: 1, rng: never });
  assert.equal(s.usage, 1);
  s.toggleDoor('L'); s.toggleDoor('R'); s.toggleLight('L');
  assert.equal(s.usage, 4);
  s.toggleCamera();
  assert.equal(s.lights.L, false, 'raising the monitor turns lights off');
  assert.equal(s.usage, 4);
});

test('only one light can be on at a time', () => {
  const s = new Sim({ night: 1, rng: never });
  s.toggleLight('L'); s.toggleLight('R');
  assert.deepEqual(s.lights, { L: false, R: true });
});

test('a closed door sends Bonnie back to the dining area', () => {
  const s = new Sim({ ai: { ...noAi, bonnie: 20 }, rng: always });
  s.pos.bonnie = 'doorL';
  s.toggleDoor('L');
  run(s, 5);
  assert.equal(s.pos.bonnie, '1B');
  assert.equal(s.inside.bonnie, false);
});

test('an open door lets Bonnie in, breaks the door and she strikes after a flip', () => {
  const s = new Sim({ ai: { ...noAi, bonnie: 20 }, rng: always });
  s.pos.bonnie = 'doorL';
  run(s, 5);
  assert.equal(s.inside.bonnie, true);
  assert.equal(s.broken.L, true);
  assert.equal(s.toggleDoor('L'), false);
  run(s, 30);
  assert.equal(s.result, null, 'no attack while the monitor stays down');
  flip(s);
  assert.equal(s.result, null);
  flip(s);
  assert.deepEqual(s.result, { killer: 'bonnie' });
});

test('30 s on the monitor with Chica inside forces the jumpscare', () => {
  const s = new Sim({ ai: { ...noAi, chica: 20 }, rng: always });
  s.pos.chica = 'doorR';
  run(s, 5);
  assert.equal(s.inside.chica, true);
  flip(s);
  run(s, 29);
  assert.equal(s.result, null);
  run(s, 2);
  assert.deepEqual(s.result, { killer: 'chica' });
});

test('watching the monitor freezes Foxy', () => {
  const s = new Sim({ ai: { ...noAi, foxy: 20 }, rng: always });
  flip(s);
  run(s, 25);
  assert.equal(s.foxy.stage, 0);
});

test('lowering the monitor locks Foxy for a random 0.83-16.67 s', () => {
  const lockFor = (roll) => {
    const s = new Sim({ ai: noAi, rng: never });
    flip(s);
    s.rng = () => roll;
    s.toggleCamera();
    return s.foxy.lock;
  };
  assert.ok(Math.abs(lockFor(0) - 0.83) < 1e-9);
  assert.ok(Math.abs(lockFor(1) - 16.67) < 1e-9);

  const s = new Sim({ ai: { ...noAi, foxy: 20 }, rng: always });
  flip(s);
  s.rng = () => 1;
  s.toggleCamera();
  s.rng = always;
  run(s, 16);
  assert.equal(s.foxy.stage, 0, 'still locked');
  run(s, 6);
  assert.ok(s.foxy.stage > 0, 'active again once the lock ends');
});

test('Foxy reaches phase 4 and charges after 1500 frames', () => {
  const s = new Sim({ ai: { ...noAi, foxy: 20 }, rng: always });
  run(s, 16);
  assert.equal(s.foxy.stage, 3);
  run(s, 24);
  assert.equal(s.result, null);
  run(s, 4);
  assert.deepEqual(s.result, { killer: 'foxy' });
});

test('looking at CAM 2A makes a waiting Foxy run immediately', () => {
  const s = new Sim({ ai: { ...noAi, foxy: 20 }, rng: always });
  s.foxy.stage = 3;
  flip(s);
  s.selectCam('2A');
  run(s, 0.1);
  assert.equal(s.foxy.running, true);
});

test('Foxy knocks drain 1, 6, 11, 16, 16', () => {
  const s = new Sim({ ai: noAi, rng: never });
  s.toggleDoor('L');
  const drains = [];
  for (let i = 0; i < 5; i++) {
    s.power = 100;
    s.foxyArrives();
    drains.push(s.drainEvents().find((e) => e.type === 'foxyKnock').drain);
  }
  assert.deepEqual(drains, [1, 6, 11, 16, 16]);
});

test('Freddy stays on stage until Bonnie and Chica have left', () => {
  const s = new Sim({ ai: { ...noAi, freddy: 20 }, rng: always });
  run(s, 10);
  assert.equal(s.pos.freddy, '1A');
  s.pos.bonnie = '5'; s.pos.chica = '7';
  run(s, 4);
  assert.equal(s.pos.freddy, '1B');
});

test('Freddy countdown is 1000 - 100 x AI frames and waits for the monitor', () => {
  const s = new Sim({ ai: { ...noAi, freddy: 5 }, rng: always });
  s.pos.bonnie = '5'; s.pos.chica = '7';
  run(s, 3.1);
  assert.ok(s.freddyCountdown > 8 && s.freddyCountdown <= 8.34, `countdown ${s.freddyCountdown}`);
  flip(s);
  run(s, 10);
  assert.equal(s.pos.freddy, '1A', 'he cannot move while the monitor is up');
  flip(s);
  assert.equal(s.pos.freddy, '1B');
});

test('Freddy at 4B: watching him stops the attack; a closed door sends him back', () => {
  const s = new Sim({ ai: { ...noAi, freddy: 20 }, rng: always });
  s.pos.bonnie = '5'; s.pos.chica = '7'; s.pos.freddy = '4B';
  flip(s);
  s.selectCam('4B');
  run(s, 10);
  assert.equal(s.pos.freddy, '4B');
  s.toggleDoor('R');
  s.selectCam('1A');
  run(s, 4);
  assert.equal(s.pos.freddy, '4A');
});

test('Freddy in the office kills only with the monitor down', () => {
  const s = new Sim({ ai: { ...noAi, freddy: 20 }, rng: always });
  s.pos.bonnie = '5'; s.pos.chica = '7'; s.pos.freddy = '4B';
  flip(s);
  run(s, 4);
  assert.equal(s.inside.freddy, true);
  run(s, 20);
  assert.equal(s.result, null);
  flip(s);
  run(s, 1.1);
  assert.deepEqual(s.result, { killer: 'freddy' });
});

test('power out opens the doors, ends in a kill, and 6 AM still saves you', () => {
  const s = new Sim({ ai: noAi, rng: always });
  s.toggleDoor('L');
  s.power = 0.001;
  run(s, 0.1);
  assert.ok(s.powerOut);
  assert.equal(s.doors.L, false);
  assert.equal(s.toggleCamera(), false);
  run(s, 5.1);
  assert.equal(s.powerOut.phase, 'song');
  run(s, 5.1);
  assert.equal(s.powerOut.phase, 'dark');
  run(s, 2.1);
  assert.deepEqual(s.result, { killer: 'freddyDark' });

  const saved = new Sim({ ai: noAi, rng: never });
  saved.time = 534.9;
  saved.hour = 5;
  saved.power = 0.001;
  run(saved, 1);
  assert.equal(saved.result, 'win');
});

test('power out is forced within 20 s per phase even with bad luck', () => {
  const s = new Sim({ ai: noAi, rng: never });
  s.power = 0.001;
  run(s, 20.2);
  assert.equal(s.powerOut.phase, 'song');
  run(s, 20.2);
  assert.equal(s.powerOut.phase, 'dark');
});

test('Golden Freddy: staring kills, raising the monitor saves', () => {
  const s = new Sim({ ai: noAi, rng: never });
  flip(s);
  s.goldenPoster = true;
  flip(s);
  assert.equal(s.goldenActive, true);
  run(s, 3);
  flip(s);
  assert.equal(s.goldenActive, false);
  assert.equal(s.result, null);

  s.goldenPoster = true;
  flip(s);
  run(s, 5.1);
  assert.deepEqual(s.result, { killer: 'golden' });
});
