// Pure game rules: no DOM, images or audio, so it can run under node:test.
// The renderer reads the public state; sounds and visuals are driven by `events`.
import {
  AI_BY_NIGHT, AI_HOUR_BONUS, ATTACK, CAMERA, FOXY, FPS, FREDDY, GOLDEN,
  MOVE_INTERVAL, NIGHT, POWER, POWER_OUT, RETREAT, ROUTES,
} from './config.js';

const DOOR_FOR = { bonnie: 'L', chica: 'R' };

export class Sim {
  constructor({ night = 1, ai = null, rng = Math.random } = {}) {
    this.rng = rng;
    this.night = night;
    this.ai = {};
    const base = ai || AI_BY_NIGHT[Math.min(night, 6)];
    for (const k of ['freddy', 'bonnie', 'chica', 'foxy']) {
      const v = base[k];
      this.ai[k] = Array.isArray(v) ? v[Math.floor(rng() * v.length)] : v;
    }
    this.time = 0;
    this.hour = 0;
    this.power = 100;
    this.passiveTimer = 0;
    this.knocks = 0;
    this.doors = { L: false, R: false };
    this.lights = { L: false, R: false };
    this.broken = { L: false, R: false };
    this.camUp = false;
    this.camTransition = 0; // >0 while the monitor is flipping
    this.camTarget = false;
    this.cam = '1A';
    this.camStatic = 0;
    this.camUpTime = 0;
    this.pos = { bonnie: '1A', chica: '1A', freddy: '1A' };
    this.inside = { bonnie: false, chica: false, freddy: false };
    this.timers = { bonnie: 0, chica: 0, freddy: 0, foxy: 0 };
    this.freddyCountdown = null;
    this.freddyOfficeTimer = 0;
    this.foxy = { stage: 0, lock: 0, attackTimer: 0, running: false, runTime: 0 };
    this.goldenPoster = false;
    this.goldenActive = false;
    this.goldenTimer = 0;
    this.powerOut = null;
    this.result = null; // 'win' | {killer}
    this.events = [];
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  drainEvents() { const e = this.events; this.events = []; return e; }

  roll(who) { return Math.floor(this.rng() * 20) + 1 <= this.ai[who]; }

  get camActive() { return this.camUp || (this.camTransition > 0 && this.camTarget); }

  get usage() {
    if (this.powerOut) return 0;
    let u = 1;
    if (this.doors.L) u++;
    if (this.doors.R) u++;
    if (this.lights.L || this.lights.R) u++;
    if (this.camActive) u++;
    return u;
  }

  // ---- Player actions ----
  toggleDoor(side) {
    if (this.powerOut || this.result) return false;
    if (this.broken[side]) { this.emit('error'); return false; }
    this.doors[side] = !this.doors[side];
    this.emit('door', { side, closed: this.doors[side] });
    return true;
  }

  toggleLight(side) {
    if (this.powerOut || this.result || this.camActive) return false;
    if (this.broken[side]) { this.emit('error'); return false; }
    const other = side === 'L' ? 'R' : 'L';
    const on = !this.lights[side];
    this.lights[side] = on;
    if (on) this.lights[other] = false;
    this.emit('light', { on: this.lights.L || this.lights.R });
    if (on && this.atDoor(side)) this.emit('windowScare');
    return true;
  }

  atDoor(side) {
    return side === 'L' ? this.pos.bonnie === 'doorL' : this.pos.chica === 'doorR';
  }

  toggleCamera() {
    if (this.powerOut || this.result || this.camTransition > 0) return false;
    this.camTarget = !this.camUp;
    this.camTransition = CAMERA.flipSec;
    this.emit('camera', { up: this.camTarget });
    if (this.camTarget) {
      this.lights.L = this.lights.R = false;
      this.emit('light', { on: false });
      this.clearGolden();
    } else {
      this.foxy.lock = this.lerp(FOXY.cameraLockMinSec, FOXY.cameraLockMaxSec);
    }
    return true;
  }

  selectCam(id) {
    if (!this.camUp || this.cam === id) return false;
    this.cam = id;
    this.emit('camSwitch', { cam: id });
    if (id === '2B' && this.pos.bonnie !== '2B' && this.rng() < GOLDEN.posterChance) {
      this.goldenPoster = true;
    }
    return true;
  }

  lerp(a, b) { return a + (b - a) * this.rng(); }

  clearGolden() {
    this.goldenActive = false;
    this.goldenTimer = 0;
  }

  // ---- Simulation ----
  step(dt) {
    if (this.result) return;
    this.time += dt;
    this.updateClock();
    if (this.result) return;
    this.updateMonitor(dt);
    if (this.result) return;
    if (this.powerOut) {
      this.updatePowerOut(dt);
      return;
    }
    this.updatePower(dt);
    if (this.powerOut) return;
    this.updateRoamer('bonnie', dt);
    this.updateRoamer('chica', dt);
    this.updateFreddy(dt);
    this.updateFoxy(dt);
    this.updateGolden(dt);
    if (this.camStatic > 0) this.camStatic = Math.max(0, this.camStatic - dt);
  }

  updateClock() {
    const after = this.time - NIGHT.firstHourSec;
    const hour = after < 0 ? 0 : 1 + Math.floor(after / NIGHT.hourSec);
    while (this.hour < hour) {
      this.hour++;
      for (const who of AI_HOUR_BONUS[this.hour] || []) this.ai[who]++;
      if (this.hour >= NIGHT.hours) {
        this.result = 'win';
        this.emit('win');
        return;
      }
      this.emit('hour', { hour: this.hour });
    }
  }

  updateMonitor(dt) {
    if (this.camTransition > 0) {
      this.camTransition -= dt;
      if (this.camTransition <= 0) {
        this.camTransition = 0;
        const wasUp = this.camUp;
        this.camUp = this.camTarget;
        if (!this.camUp && wasUp) this.onCameraLowered();
      }
    }
    if (this.camUp) {
      this.camUpTime += dt;
      const someoneInside = this.inside.bonnie || this.inside.chica;
      if (someoneInside && this.camUpTime >= ATTACK.forcedCameraDropSec) {
        this.emit('forcedDrop');
        this.camUp = false;
        this.onCameraLowered();
      }
    } else {
      this.camUpTime = 0;
    }
  }

  onCameraLowered() {
    this.emit('cameraLowered');
    if (this.inside.bonnie) return this.kill('bonnie');
    if (this.inside.chica) return this.kill('chica');
    if (this.goldenPoster) {
      this.goldenPoster = false;
      this.goldenActive = true;
      this.goldenTimer = 0;
      this.emit('golden');
    }
    return undefined;
  }

  updatePower(dt) {
    this.power -= (dt * this.usage) / POWER.secondsPerPercentAtUsage1;
    const interval = POWER.passiveIntervalByNight[this.night];
    if (interval) {
      this.passiveTimer += dt;
      while (this.passiveTimer >= interval) {
        this.passiveTimer -= interval;
        this.power -= POWER.passiveAmount;
      }
    }
    if (this.power <= 0) this.startPowerOut();
  }

  startPowerOut() {
    this.power = 0;
    this.doors.L = this.doors.R = false;
    this.lights.L = this.lights.R = false;
    this.camUp = false;
    this.camTarget = false;
    this.camTransition = 0;
    this.clearGolden();
    this.powerOut = { phase: 'waiting', elapsed: 0, tick: 0 };
    this.emit('powerOut');
  }

  updatePowerOut(dt) {
    const p = this.powerOut;
    p.elapsed += dt;
    p.tick += dt;
    if (p.phase === 'dark') {
      if (p.tick >= POWER_OUT.killStepSec) {
        p.tick -= POWER_OUT.killStepSec;
        if (this.rng() < POWER_OUT.killChance) this.kill('freddyDark');
      }
      return;
    }
    let advance = p.elapsed >= POWER_OUT.maxSec;
    if (p.tick >= POWER_OUT.stepSec) {
      p.tick -= POWER_OUT.stepSec;
      if (this.rng() < POWER_OUT.chance) advance = true;
    }
    if (!advance) return;
    p.elapsed = 0;
    p.tick = 0;
    if (p.phase === 'waiting') {
      p.phase = 'song';
      this.emit('songStart');
    } else {
      p.phase = 'dark';
      this.emit('songEnd');
    }
  }

  moveTo(who, to) {
    const from = this.pos[who];
    this.pos[who] = to;
    this.emit('move', { who, from, to });
    if (this.camUp && (this.cam === from || this.cam === to) && who !== 'freddy') {
      this.camStatic = CAMERA.moveStaticSec;
    }
    if (to === '6') this.emit('kitchen', { who });
  }

  tick(who, dt) {
    this.timers[who] += dt;
    if (this.timers[who] < MOVE_INTERVAL[who]) return false;
    this.timers[who] -= MOVE_INTERVAL[who];
    return true;
  }

  updateRoamer(who, dt) {
    if (!this.tick(who, dt) || this.inside[who] || !this.roll(who)) return;
    const room = this.pos[who];
    const side = DOOR_FOR[who];
    if (room === `door${side}`) {
      if (this.doors[side]) {
        this.moveTo(who, RETREAT[who]);
      } else {
        this.inside[who] = true;
        this.broken[side] = true;
        this.lights[side] = false;
        this.pos[who] = 'office';
        this.emit('light', { on: this.lights.L || this.lights.R });
        this.emit('entered', { who, side });
      }
      return;
    }
    const options = ROUTES[who][room];
    this.moveTo(who, options[Math.floor(this.rng() * options.length)]);
  }

  updateFreddy(dt) {
    const timed = this.tick('freddy', dt);
    if (this.inside.freddy) {
      if (!this.camActive) {
        this.freddyOfficeTimer += dt;
        while (this.freddyOfficeTimer >= 1) {
          this.freddyOfficeTimer -= 1;
          if (this.rng() < FREDDY.officeKillChancePerSec) { this.kill('freddy'); return; }
        }
      }
      return;
    }
    const room = this.pos.freddy;
    const blocked = this.pos.bonnie === '1A' || this.pos.chica === '1A';
    if (room === '4B') {
      // [doc] Attack mode: the monitor no longer stops him unless it is showing CAM 4B.
      const watched = this.camUp && this.cam === '4B';
      if (timed && !watched && this.roll('freddy')) {
        if (this.doors.R) {
          this.moveTo('freddy', RETREAT.freddy);
          this.emit('laugh');
        } else {
          this.inside.freddy = true;
          this.pos.freddy = 'office';
          this.freddyOfficeTimer = 0;
          this.emit('entered', { who: 'freddy', side: 'R' });
        }
      }
      return;
    }
    if (this.freddyCountdown !== null) {
      this.freddyCountdown -= dt;
      if (this.freddyCountdown <= 0 && !this.camActive) {
        this.freddyCountdown = null;
        this.moveTo('freddy', ROUTES.freddy[room][0]);
        this.emit('laugh');
      }
      return;
    }
    if (timed && !this.camActive && !(room === '1A' && blocked) && this.roll('freddy')) {
      this.freddyCountdown = FREDDY.countdownFrames(this.ai.freddy) / FPS;
    }
  }

  updateFoxy(dt) {
    const f = this.foxy;
    const timed = this.tick('foxy', dt);
    if (f.lock > 0) f.lock = Math.max(0, f.lock - dt);
    if (f.running) {
      f.runTime += dt;
      if (f.runTime >= FOXY.runSec) this.foxyArrives();
      return;
    }
    if (f.stage === 3) {
      f.attackTimer += dt;
      const watching2A = this.camUp && this.cam === '2A';
      if (watching2A || f.attackTimer >= FOXY.attackFrames / FPS) this.foxyRun();
      return;
    }
    if (timed && !this.camActive && f.lock <= 0 && this.roll('foxy')) {
      f.stage++;
      if (f.stage === 3) f.attackTimer = 0;
      this.emit('foxyStage', { stage: f.stage });
    }
  }

  foxyRun() {
    this.foxy.running = true;
    this.foxy.runTime = 0;
    this.emit('foxyRun');
  }

  foxyArrives() {
    const f = this.foxy;
    f.running = false;
    if (!this.doors.L) { this.kill('foxy'); return; }
    const drain = Math.min(FOXY.knockDrainMax, FOXY.knockFirstDrain + FOXY.knockDrainStep * this.knocks);
    this.knocks++;
    this.power = Math.max(0, this.power - drain);
    f.stage = FOXY.returnStages[Math.floor(this.rng() * FOXY.returnStages.length)];
    this.emit('foxyKnock', { drain });
    if (this.power <= 0) this.startPowerOut();
  }

  updateGolden(dt) {
    if (!this.goldenActive) return;
    this.goldenTimer += dt;
    if (this.goldenTimer >= GOLDEN.stareSec) this.kill('golden');
  }

  kill(killer) {
    if (this.result) return;
    this.result = { killer };
    this.emit('kill', { killer });
  }

  get displayPower() { return Math.max(0, Math.ceil(this.power)); }

  get displayHour() { return this.hour === 0 ? 12 : this.hour; }
}
