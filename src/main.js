import { Audio } from './audio.js';
import { AI_BY_NIGHT, CAMERA, CAM_NAMES, GOLDEN } from './config.js';
import { CAM_BUTTONS, HUD, MENU, OFFICE } from './layout.js';
import { MANIFEST } from './manifest.js';
import { Sim } from './sim.js';
import { cameraFrame, officeFrame } from './views.js';
import { createPresenter, unwarpY } from './warp.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const SPEED = Number(params.get('speed')) || 1;
const $ = (id) => document.getElementById(id);
const hudCanvas = $('hud');
const hud = hudCanvas.getContext('2d');
const comp = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
const c = comp.getContext('2d');
const present = createPresenter($('scene'), comp);
const audio = new Audio(MANIFEST.sfx);
const img = {};
const ui = {};
const rand = (n) => Math.floor(Math.random() * n);
const inside = (p, x, y, w, h) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;

// ---- Save data ----
const SAVE_KEY = 'fnaf-web-save';
function readSave() {
  try {
    return { night: 1, beat5: false, beat6: false, beat7: false, ...JSON.parse(localStorage.getItem(SAVE_KEY)) };
  } catch (_) {
    return { night: 1, beat5: false, beat6: false, beat7: false };
  }
}
let save = readSave();
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* private mode */ }
}

// ---- Loading ----
function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { console.warn('Missing image', src); resolve(image); };
    image.src = src;
  });
}

async function loadAll() {
  const groups = Object.entries(MANIFEST.img);
  const uiEntries = Object.entries(MANIFEST.ui);
  const total = groups.reduce((n, [, files]) => n + files.length, 0) + uiEntries.length + Object.keys(MANIFEST.sfx).length;
  let done = 0;
  const tick = () => { done++; $('fill').style.width = `${(done / total) * 100}%`; };
  await Promise.all([
    ...groups.map(async ([key, files]) => {
      img[key] = await Promise.all(files.map((f) => loadImage(`assets/img/${f}`).then((i) => { tick(); return i; })));
    }),
    ...uiEntries.map(async ([key, file]) => { ui[key] = await loadImage(`assets/ui/${file}`); tick(); }),
    audio.load(tick),
  ]);
}

// ---- Shared drawing helpers ----
function drawNumber(prefix, n, x, y, { right = false, gap = 2 } = {}) {
  const glyphs = String(n).split('').map((d) => ui[prefix + d]);
  const width = glyphs.reduce((w, g) => w + g.width + gap, -gap);
  let cx = right ? x - width : x;
  for (const g of glyphs) { hud.drawImage(g, cx, y); cx += g.width + gap; }
  return cx;
}

function staticOverlay(alpha) {
  hud.globalAlpha = alpha;
  hud.drawImage(img.static[rand(img.static.length)], 0, 0, 1280, 720);
  hud.globalAlpha = 1;
}

function blipOverlay(alpha = 0.7) {
  hud.globalAlpha = alpha;
  hud.drawImage(img.blip[rand(img.blip.length)], 0, 0, 1280, 720);
  hud.globalAlpha = 1;
}

// ---- Scene machine ----
const pointer = { x: 640, y: 360, active: false, touch: false };
let scene = null;
let sceneTime = 0;

function go(next) {
  scene = next;
  sceneTime = 0;
  if (scene.enter) scene.enter();
}

function startNight(night, ai = null) {
  go(cardScene(night, ai));
}

// ---- Menu ----
function menuItems() {
  const items = [{ ui: 'newgame', action: () => { save.night = 1; writeSave(); go(newspaperScene()); } },
    { ui: 'continue', action: () => startNight(Math.min(save.night, 5)), night: Math.min(save.night, 5) }];
  if (save.beat5) items.push({ ui: 'night6', action: () => startNight(6) });
  if (save.beat6) items.push({ ui: 'customnight', action: () => go(customScene()) });
  return items;
}

function menuScene() {
  let selected = 0;
  let face = 0;
  let faceTimer = 0;
  let hallucination = 0;
  const items = menuItems();
  const hit = (i) => inside(pointer, MENU.items.x - 70, MENU.items.y + i * MENU.items.step - 8, 460, 58);
  return {
    enter() {
      audio.stopAll();
      audio.loop('ambience', 0.45);
      audio.noiseLoop('static', 0.012, 6000, 'highpass');
    },
    update(dt) {
      faceTimer -= dt;
      if (faceTimer <= 0) {
        faceTimer = 0.06 + Math.random() * 0.1;
        face = Math.random() < 0.9 ? 0 : 1 + rand(3);
      }
      hallucination = Math.max(0, hallucination - dt);
      items.forEach((_, i) => { if (hit(i)) selected = i; });
    },
    draw() {
      c.drawImage(img.menu[face], 0, 0);
      hud.clearRect(0, 0, 1280, 720);
      staticOverlay(0.28 + Math.random() * 0.1);
      if (Math.random() < 0.015) blipOverlay(0.55);
      hud.drawImage(ui.title, MENU.title.x, MENU.title.y);
      const beaten = [save.beat5, save.beat6, save.beat7].filter(Boolean).length;
      for (let s = 0; s < beaten; s++) drawStar(MENU.title.x + 22 + s * 56, MENU.title.y + 250);
      items.forEach((item, i) => {
        const y = MENU.items.y + i * MENU.items.step;
        hud.drawImage(ui[item.ui], MENU.items.x, y);
        if (item.night) {
          hud.drawImage(ui.nightlabel, MENU.items.x + 2, y + 38);
          drawNumber('small', item.night, MENU.items.x + 70, y + 36);
        }
        if (i === selected) hud.drawImage(ui.cursor, MENU.cursorX, y + 3);
      });
      hud.drawImage(ui.version, 10, 672);
      hud.drawImage(ui.copyright, 10, 692);
    },
    click() {
      items.forEach((item, i) => { if (hit(i)) item.action(); });
    },
  };
}

function drawStar(cx, cy) {
  hud.fillStyle = '#fff';
  hud.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 22;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    hud[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  hud.fill();
}

function newspaperScene() {
  return {
    update() { if (sceneTime > 6) startNight(1); },
    draw() {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      c.globalAlpha = Math.min(1, sceneTime / 0.6, Math.max(0, 6 - sceneTime) / 0.6);
      c.drawImage(img.menu[4], 0, 0);
      c.globalAlpha = 1;
      hud.clearRect(0, 0, 1280, 720);
    },
    click() { if (sceneTime > 0.6) startNight(1); },
  };
}

// ---- Custom night ----
function customScene() {
  const order = ['freddy', 'bonnie', 'chica', 'foxy'];
  const levels = { freddy: 1, bonnie: 3, chica: 3, foxy: 1 };
  const xs = [90, 370, 650, 930];
  const arrow = (i) => ({ l: [xs[i] + 8, 400], r: [xs[i] + 158, 400] });
  return {
    draw() {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      hud.clearRect(0, 0, 1280, 720);
      hud.drawImage(ui.customnight, 455, 30);
      hud.drawImage(ui.difficulty, 245, 86);
      order.forEach((who, i) => {
        hud.drawImage(img[`icon_${who}`][0], xs[i], 140);
        hud.drawImage(ui[who], xs[i], 350);
        hud.drawImage(ui.arrow_l, ...arrow(i).l);
        hud.drawImage(ui.arrow_r, ...arrow(i).r);
        drawNumber('big', levels[who], xs[i] + 100, 410, { right: false });
      });
      hud.drawImage(ui.ailevel, 90, 480);
      hud.drawImage(ui.ready, 1040, 620);
    },
    click() {
      order.forEach((who, i) => {
        const a = arrow(i);
        if (inside(pointer, a.l[0] - 10, a.l[1] - 10, 56, 72)) levels[who] = Math.max(0, levels[who] - 1);
        if (inside(pointer, a.r[0] - 10, a.r[1] - 10, 56, 72)) levels[who] = Math.min(20, levels[who] + 1);
      });
      if (inside(pointer, 1040, 610, 210, 80)) {
        const code = GOLDEN.customNightCode;
        if (order.every((w) => levels[w] === code[w])) { go(goldenScene()); return; }
        startNight(7, { ...levels });
      }
    },
  };
}

// ---- Night intro card ----
function cardScene(night, ai) {
  return {
    enter() {
      audio.stopAll();
      audio.blip(0.5, 0.5);
    },
    update() { if (sceneTime > 3) go(nightScene(night, ai)); },
    draw() {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      hud.clearRect(0, 0, 1280, 720);
      const card = ui[`card${night}`];
      hud.drawImage(card, (1280 - card.width) / 2, (720 - card.height) / 2);
      if (sceneTime < 0.5) blipOverlay(1 - sceneTime * 2);
    },
  };
}

// ---- The night itself ----
function nightScene(night, ai) {
  const sim = new Sim({ night, ai: ai || AI_BY_NIGHT[Math.min(night, 6)] });
  if (DEBUG) window.__sim = sim;
  let scroll = 160;
  let camPan = 0;
  let camPanDir = 1;
  let camPanHold = 2;
  let view = null;
  let switchFlash = 0;
  let toggleArmed = true;
  let doorFrame = { L: 0, R: 0 };
  let doorTimer = 0;
  let fanTimer = 0;
  let fanFrame = 0;
  let flicker = 0;
  let recTimer = 0;
  let powerOutFace = false;
  let humTimer = 20 + Math.random() * 30;
  let scare = null;
  let camBlink = 0;

  const refreshView = () => { view = cameraFrame(sim, sim.cam); };

  function handleEvents() {
    for (const e of sim.drainEvents()) {
      switch (e.type) {
        case 'door': audio.play('door', { vol: 0.8 }); break;
        case 'error': audio.play('error'); break;
        case 'light':
          if (e.on) audio.loop('light', 0.7); else audio.stop('light');
          break;
        case 'windowScare': audio.play('windowScare', { vol: 0.9 }); break;
        case 'camera':
          audio.play('camera');
          if (e.up) { refreshView(); switchFlash = 0.25; }
          break;
        case 'camSwitch':
          refreshView();
          switchFlash = 0.25;
          audio.blip(0.15);
          break;
        case 'move': {
          const near = ['2A', '2B', '3', '4A', '4B', 'doorL', 'doorR'].includes(e.to);
          audio.play('footsteps', { vol: near ? 0.55 : 0.15 });
          if (e.from === '6' && e.who === 'freddy') audio.stop('musicBox');
          refreshView();
          break;
        }
        case 'kitchen':
          if (e.who === 'chica') audio.clatter();
          else audio.loop('musicBox', 0.2);
          break;
        case 'laugh': audio.play('laugh', { vol: 0.7 }); break;
        case 'foxyStage': refreshView(); break;
        case 'foxyRun': audio.play('foxyRun'); refreshView(); break;
        case 'foxyKnock':
          audio.play('door', { vol: 1, rate: 1.6 });
          setTimeout(() => audio.play('door', { vol: 0.8, rate: 1.8 }), 180);
          refreshView();
          break;
        case 'powerOut':
          audio.stopAll();
          audio.play('powerOut');
          break;
        case 'songStart': audio.loop('musicBox', 0.8); break;
        case 'songEnd': audio.stop('musicBox'); break;
        case 'forcedDrop': audio.play('camera'); break;
        case 'golden': audio.blip(0.3, 0.3); break;
        case 'kill': beginScare(e.killer); break;
        case 'win': go(sixAmScene(night)); break;
        default: break;
      }
    }
  }

  function beginScare(killer) {
    audio.stopAll();
    if (killer === 'golden') { go(goldenScene()); return; }
    const key = { bonnie: 'js_bonnie', chica: 'js_chica', foxy: 'js_foxy', freddy: 'js_freddy', freddyDark: 'js_freddy_dark' }[killer];
    scare = { key, t: 0, frames: img[key], wide: killer !== 'freddyDark' };
    audio.play('scream');
  }

  function panOffice(dt) {
    if (pointer.touch && !pointer.active) return;
    const d = (pointer.x - 640) / 640;
    const dead = 0.18;
    if (Math.abs(d) > dead) {
      const speed = ((Math.abs(d) - dead) / (1 - dead)) * 780;
      scroll = Math.max(0, Math.min(320, scroll + Math.sign(d) * speed * dt));
    }
  }

  function updateToggleHover() {
    if (pointer.touch) return;
    const t = HUD.toggle;
    const over = inside(pointer, t.x, t.y, t.w, t.h + 20);
    if (over && toggleArmed) { toggleArmed = false; sim.toggleCamera(); }
    if (!over) toggleArmed = true;
  }

  function updateCamPan(dt) {
    if (camPanHold > 0) { camPanHold -= dt; return; }
    camPan += camPanDir * 60 * dt;
    if (camPan >= 320) { camPan = 320; camPanDir = -1; camPanHold = 2; }
    if (camPan <= 0) { camPan = 0; camPanDir = 1; camPanHold = 2; }
  }

  function drawDoors() {
    const draw = (frame, x, mirror) => {
      const image = img.door[frame];
      if (!frame) return;
      const dx = x - scroll;
      if (mirror) {
        c.save();
        c.translate(dx + MANIFEST.meta.doorWidth, 0);
        c.scale(-1, 1);
        c.drawImage(image, 0, 0);
        c.restore();
      } else {
        c.drawImage(image, dx, 0);
      }
    };
    draw(doorFrame.L, OFFICE.doorL.x, true);
    draw(doorFrame.R, OFFICE.doorR.x, false);
  }

  function drawPanels() {
    const cell = (side) => {
      const door = sim.doors[side] ? 2 : 0;
      const light = sim.lights[side] ? 1 : 0;
      return door + light;
    };
    c.drawImage(img.button[cell('L')], OFFICE.panelL.x - scroll, OFFICE.panelL.y);
    c.drawImage(img.button[4 + cell('R')], OFFICE.panelR.x - scroll, OFFICE.panelR.y);
  }

  function drawOffice() {
    const po = sim.powerOut;
    if (po) {
      if (po.phase === 'dark') {
        c.fillStyle = '#000';
        c.fillRect(0, 0, 1280, 720);
      } else {
        c.drawImage(img.office[powerOutFace ? 10 : 9], -scroll, 0);
      }
      return;
    }
    c.drawImage(img.office[flicker > 0 ? 1 : officeFrame(sim)], -scroll, 0);
    c.drawImage(img.fan[fanFrame], MANIFEST.meta.fan.x - scroll, MANIFEST.meta.fan.y);
    drawDoors();
    drawPanels();
    if (sim.goldenActive) c.drawImage(img.golden[0], OFFICE.golden.x - scroll, OFFICE.golden.y);
  }

  function drawCameraRoom() {
    if (sim.cam === '2A' && sim.foxy.running) {
      const p = Math.min(1, sim.foxy.runTime / 1.6);
      c.drawImage(img.west[9 + Math.floor(p * 26)], -camPan, 0);
      return;
    }
    if (!view) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      return;
    }
    c.drawImage(img[view[0]][view[1]], -camPan, 0);
  }

  function drawHudText() {
    const h = sim.displayHour;
    drawNumber('big', h, HUD.clockRight, HUD.clockY, { right: true });
    hud.drawImage(ui.am, HUD.clockRight + 6, HUD.clockY);
    hud.drawImage(ui.nightlabel, HUD.nightRight - 92, HUD.nightY + 2);
    drawNumber('small', Math.min(night, 7), HUD.nightRight, HUD.nightY, { right: true });
    hud.drawImage(ui.powerleft, HUD.powerLabel.x, HUD.powerLabel.y);
    const x = drawNumber('small', sim.displayPower, HUD.powerDigitsX, HUD.powerLabel.y - 1);
    hud.drawImage(ui.percent, x + 2, HUD.powerLabel.y - 1);
    hud.drawImage(ui.usage, HUD.usageLabel.x, HUD.usageLabel.y);
    hud.drawImage(ui[`usage${Math.max(1, Math.min(5, sim.usage))}`], HUD.usageBars.x, HUD.usageBars.y);
  }

  function drawCameraHud() {
    if (recTimer % 2 < 1) hud.drawImage(ui.rec, HUD.rec.x, HUD.rec.y);
    hud.drawImage(ui.map, HUD.map.x, HUD.map.y);
    hud.drawImage(ui[`cam${sim.cam}`], HUD.camName.x, HUD.camName.y);
    for (const id of CAM_NAMES) {
      const [x, y] = CAM_BUTTONS[id];
      const lit = id === sim.cam && camBlink % 0.8 < 0.4;
      hud.drawImage(lit ? ui.cambtn_on : ui.cambtn, x, y);
      hud.drawImage(ui[`label${id}`], x + 8, y + 6);
    }
    if (sim.cam === '6') hud.drawImage(ui.disabled, HUD.disabled.x, HUD.disabled.y);
  }

  function drawMonitorFlip() {
    const progress = sim.camTransition / CAMERA.flipSec;
    const raised = sim.camTarget ? 1 - progress : progress;
    const i = Math.max(0, Math.min(10, Math.floor(raised * 11)));
    hud.drawImage(img.monitor[i], 0, 0);
  }

  return {
    enter() {
      audio.loop('ambience', 0.5);
      audio.noiseLoop('fan', 0.05, 320);
    },
    update(dt) {
      camBlink += dt;
      if (scare) {
        scare.t += dt;
        if (scare.t > 1.7) go(gameOverScene());
        return;
      }
      panOffice(sim.camActive ? 0 : dt);
      updateToggleHover();
      updateCamPan(dt);
      recTimer += dt;
      doorTimer += dt;
      fanTimer += dt;
      if (doorTimer >= 1 / 30) {
        doorTimer = 0;
        for (const side of ['L', 'R']) {
          const target = sim.doors[side] ? img.door.length - 1 : 0;
          doorFrame[side] += Math.sign(target - doorFrame[side]);
        }
      }
      if (fanTimer >= 1 / 30) { fanTimer = 0; fanFrame = (fanFrame + 1) % img.fan.length; }
      flicker = Math.random() < 0.004 ? 0.05 : Math.max(0, flicker - dt);
      switchFlash = Math.max(0, switchFlash - dt);
      if (sim.powerOut) powerOutFace = sim.powerOut.phase === 'song' && Math.random() < 0.18;
      humTimer -= dt;
      if (humTimer <= 0) {
        humTimer = 25 + Math.random() * 40;
        if (sim.foxy.stage === 0 && !sim.powerOut) audio.play('foxyHum', { vol: 0.15 });
      }
      if (sim.camUp) {
        audio.noiseLoop('static', sim.camStatic > 0 || sim.cam === '6' ? 0.09 : 0.018, 6000, 'highpass');
      } else {
        audio.stop('static');
      }
      sim.step(dt * SPEED);
      handleEvents();
    },
    draw() {
      hud.clearRect(0, 0, 1280, 720);
      if (scare) {
        const frames = scare.frames;
        let i = Math.floor(scare.t * 30);
        if (i >= frames.length) i = frames.length - 4 + (i % 4);
        c.fillStyle = '#000';
        c.fillRect(0, 0, 1280, 720);
        c.drawImage(frames[i], scare.wide ? -scroll : 0, 0);
        return;
      }
      if (sim.camUp) {
        drawCameraRoom();
        if (sim.camStatic > 0 || sim.cam === '6') staticOverlay(1);
        else {
          staticOverlay(0.12 + Math.random() * 0.1);
          if (switchFlash > 0) staticOverlay(Math.min(1, switchFlash * 4));
          if (Math.random() < 0.01) blipOverlay(0.35);
        }
      } else {
        drawOffice();
      }
      if (sim.camTransition > 0) drawMonitorFlip();
      if (sim.camUp) drawCameraHud();
      if (!sim.powerOut) {
        drawHudText();
        if (sim.camTransition === 0) hud.drawImage(ui.toggle, HUD.toggle.x, HUD.toggle.y);
      }
      if (DEBUG) {
        hud.fillStyle = '#0f0';
        hud.font = '14px monospace';
        hud.fillText(JSON.stringify({ t: sim.time | 0, ai: sim.ai, pos: sim.pos, foxy: sim.foxy.stage, power: +sim.power.toFixed(1) }), 10, 16);
      }
    },
    click() {
      if (sim.result) return;
      if (pointer.touch) {
        const t = HUD.toggle;
        if (inside(pointer, t.x, t.y, t.w, t.h + 20)) { sim.toggleCamera(); return; }
      }
      if (sim.camUp) {
        for (const id of CAM_NAMES) {
          const [x, y] = CAM_BUTTONS[id];
          if (inside(pointer, x, y, 60, 40)) { sim.selectCam(id); return; }
        }
        return;
      }
      if (sim.camActive || sim.powerOut) return;
      const ox = pointer.x + scroll;
      const oy = unwarpY(pointer.x, pointer.y);
      const panel = (side, p) => {
        if (ox < p.x || ox > p.x + MANIFEST.meta.button.w) return false;
        const yy = oy - p.y;
        if (yy >= OFFICE.panelDoor.y0 && yy < OFFICE.panelDoor.y1) { sim.toggleDoor(side); return true; }
        if (yy >= OFFICE.panelLight.y0 && yy < OFFICE.panelLight.y1) { sim.toggleLight(side); return true; }
        return false;
      };
      if (panel('L', OFFICE.panelL) || panel('R', OFFICE.panelR)) return;
      const n = OFFICE.nose;
      if (ox >= n.x && ox < n.x + n.w && oy >= n.y && oy < n.y + n.h) audio.play('honk');
    },
  };
}

// ---- End of night screens ----
function sixAmScene(night) {
  return {
    enter() {
      audio.stopAll();
      audio.play('sixAm');
      if (night <= 5) save.night = Math.max(save.night, night + 1);
      if (night === 5) save.beat5 = true;
      if (night === 6) save.beat6 = true;
      if (night === 7) save.beat7 = true;
      writeSave();
    },
    update() {
      if (sceneTime > 7) {
        if (night === 5) go(endingScene(5));
        else if (night === 6) go(endingScene(6));
        else if (night === 7) go(endingScene(7));
        else startNight(night + 1);
      }
    },
    draw() {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      hud.clearRect(0, 0, 1280, 720);
      const roll = Math.min(1, Math.max(0, (sceneTime - 1) / 1.5));
      const x = 530;
      const y = 324;
      hud.save();
      hud.beginPath();
      hud.rect(x, y - 10, 70, 92);
      hud.clip();
      hud.drawImage(ui.six_5, x, y - roll * 90);
      hud.drawImage(ui.six_6, x, y + 90 - roll * 90);
      hud.restore();
      hud.drawImage(ui.am_big, x + 80, y);
    },
  };
}

function endingScene(n) {
  const frame = { 5: 5, 6: 6, 7: 7 }[n];
  return {
    update() { if (sceneTime > 10) go(menuScene()); },
    draw() {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 1280, 720);
      c.globalAlpha = Math.min(1, sceneTime / 1.2);
      c.drawImage(img.menu[frame], 0, 0);
      c.globalAlpha = 1;
      hud.clearRect(0, 0, 1280, 720);
    },
    click() { if (sceneTime > 1.2) go(menuScene()); },
  };
}

function gameOverScene() {
  return {
    enter() {
      audio.stopAll();
      audio.noiseLoop('static', 0.1, 6000, 'highpass');
    },
    update() {
      if (sceneTime > 3) audio.stop('static');
      if (sceneTime > 11) {
        if (Math.random() < GOLDEN.menuChance) go(goldenScene());
        else go(menuScene());
      }
    },
    draw() {
      hud.clearRect(0, 0, 1280, 720);
      if (sceneTime < 3) {
        c.fillStyle = '#000';
        c.fillRect(0, 0, 1280, 720);
        staticOverlay(1);
        return;
      }
      c.drawImage(img.menu[8], 0, 0);
      hud.drawImage(ui.gameover, 980, 650);
    },
    click() { if (sceneTime > 3.5) go(menuScene()); },
  };
}

function goldenScene() {
  return {
    enter() {
      audio.stopAll();
      audio.play('goldenScream');
    },
    update() { if (sceneTime > 2.5) { audio.stopAll(); location.reload(); } },
    draw() {
      hud.clearRect(0, 0, 1280, 720);
      c.drawImage(img.random[5], 0, 0);
    },
  };
}

// ---- Input ----
function updatePointer(e) {
  const r = hudCanvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 1280;
  pointer.y = ((e.clientY - r.top) / r.height) * 720;
  pointer.touch = e.pointerType === 'touch';
}
hudCanvas.addEventListener('pointermove', updatePointer);
hudCanvas.addEventListener('pointerdown', (e) => {
  updatePointer(e);
  pointer.active = true;
  audio.unlock();
  if (scene && scene.click) scene.click();
});
window.addEventListener('pointerup', () => { pointer.active = false; });
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('frame').requestFullscreen?.();
  }
});

// ---- Main loop ----
let last = 0;
function frame(now) {
  // Capped so that a backgrounded tab pauses the night rather than skipping through it.
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sceneTime += dt;
  if (scene.update) scene.update(dt);
  if (scene.draw) scene.draw();
  present();
  requestAnimationFrame(frame);
}

async function boot() {
  await loadAll();
  $('msg').textContent = 'Listo';
  $('bar').style.display = 'none';
  const start = $('start');
  start.style.display = 'block';
  const begin = () => {
    audio.unlock();
    $('boot').style.display = 'none';
    const n = Number(params.get('night'));
    if (DEBUG && n) {
      const aiParam = params.get('ai');
      let ai = null;
      if (aiParam) {
        const [freddy, bonnie, chica, foxy] = aiParam.split(',').map(Number);
        ai = { freddy, bonnie, chica, foxy };
      }
      go(nightScene(n, ai));
    } else {
      go(menuScene());
    }
    last = performance.now();
    requestAnimationFrame(frame);
  };
  start.addEventListener('click', begin);
  if (DEBUG) window.__begin = begin;
  if (DEBUG) window.__goto = (name) => go({ custom: customScene, gameover: gameOverScene, menu: menuScene }[name]());
  if (DEBUG) window.__six = (n) => go(sixAmScene(n));
  if (DEBUG) window.__ending = (n) => go(endingScene(n));
}

boot();
