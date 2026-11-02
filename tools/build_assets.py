#!/usr/bin/env python3
"""Cuts the raw sprite sheets in "Assets Fnaf/" into web-ready files in assets/.

Usage: python tools/build_assets.py
Output: assets/img/*.webp, assets/ui/*.png, assets/sfx/*.mp3, src/manifest.js
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Assets Fnaf')
OUT = os.path.join(ROOT, 'assets')
IMG = os.path.join(OUT, 'img')
UI = os.path.join(OUT, 'ui')
SFX = os.path.join(OUT, 'sfx')
PREFIX = "PC _ Computer - Five Nights at Freddy's - "
QUALITY = 80

GREEN = (0, 91, 66)
manifest = {'img': {}, 'ui': {}, 'sfx': {}, 'meta': {}}


def sheet(group, name):
    path = os.path.join(SRC, f'{PREFIX}{group} - {name}.png')
    return Image.open(path).convert('RGBA')


def key_colors(im, colors, tol=26):
    """Turns pixels close to any of the given colours fully transparent."""
    a = np.array(im.convert('RGBA'))
    mask = np.zeros(a.shape[:2], bool)
    for c in colors:
        mask |= np.abs(a[..., :3].astype(int) - np.array(c)).sum(axis=2) <= tol
    a[mask, 3] = 0
    return Image.fromarray(a)


def key_luma(im, bg=0):
    """White-on-flat-background glyphs: alpha comes from luminance."""
    a = np.array(im.convert('RGBA')).astype(float)
    luma = a[..., :3].mean(axis=2)
    # The floor drops faint plate remnants that would otherwise read as grey boxes.
    floor = bg + 40
    alpha = np.clip((luma - floor) / max(1, 255 - floor), 0, 1)
    out = np.zeros_like(a)
    out[..., :3] = 255
    out[..., 3] = alpha * 255
    return Image.fromarray(out.astype('uint8'))


def save_frames(key, group, name, starts, x=0, w=1600, h=720, size=None, quality=QUALITY):
    im = sheet(group, name).convert('RGB')
    files = []
    for i, y in enumerate(starts):
        frame = im.crop((x, y, x + w, y + h))
        if size:
            frame = frame.resize(size, Image.LANCZOS)
        fn = f'{key}_{i:02d}.webp'
        frame.save(os.path.join(IMG, fn), 'WEBP', quality=quality, method=4)
        files.append(fn)
    manifest['img'][key] = files
    print(f'{key}: {len(files)} frames')


def stack(count, first=4, stride=722):
    return [first + stride * i for i in range(count)]


def save_ui(name, im):
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(os.path.join(UI, f'{name}.png'), optimize=True)
    manifest['ui'][name] = f'{name}.png'
    return im


def plate_level(crop):
    """Background brightness behind glyphs, read from the corners.

    The most common colour would fail on huge glyphs, which are mostly white.
    """
    a = np.array(crop.convert('RGB')).astype(int).mean(axis=2)
    return int(min(a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]))


def split_columns(im, threshold=110, min_gap=1):
    """Splits a strip of glyphs into per-glyph crops using empty columns."""
    a = np.array(im.convert('RGB')).astype(int)
    ink = (a.mean(axis=2) > threshold).any(axis=0)
    runs, start, gap, last = [], None, 0, 0
    for i, v in enumerate(ink):
        if v:
            if start is None:
                start = i
            last, gap = i, 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, last + 1))
                start = None
    if start is not None:
        runs.append((start, last + 1))
    return [im.crop((r0, 0, r1, im.size[1])) for r0, r1 in runs]


def rooms():
    save_frames('office', 'Rooms', 'The Office', stack(11))
    save_frames('west', 'Rooms', 'West Hall', stack(40))
    save_frames('east', 'Rooms', 'East Hall', stack(15))
    save_frames('dining', 'Rooms', 'Dining Area', [8 + 728 * i for i in range(6)], x=8)
    save_frames('backstage', 'Rooms', 'Backstage', stack(4))
    save_frames('restrooms', 'Rooms', 'Restrooms', stack(4))
    save_frames('closet', 'Rooms', 'Supply Closet', stack(2))
    # These two sheets have no separators: frames are packed every 720px.
    save_frames('stage', 'Rooms', 'Show Stage', [720 * i for i in range(7)])
    save_frames('cove', 'Rooms', 'Pirate Cove', [720 * i for i in range(5)])


def jumpscares():
    save_frames('js_bonnie', 'Jumpscares', 'Bonnie Jumpscare', stack(11))
    save_frames('js_chica', 'Jumpscares', 'Chica Jumpscare', stack(16))
    save_frames('js_foxy', 'Jumpscares', 'Foxy Jumpscare', stack(21))
    save_frames('js_freddy_dark', 'Jumpscares', 'Freddy Jumpscare 1', stack(21), w=1280)
    save_frames('js_freddy', 'Jumpscares', 'Freddy Jumpscare 2', stack(28))


def screens():
    save_frames('menu', 'Miscellaneous', 'Main Menu, Intro, & Endings',
                [4, 726, 1448, 2170, 2892, 3614, 4336, 5058, 5782], w=1280)
    save_frames('random', 'Miscellaneous', 'Random Screens', [8 + 724 * i for i in range(6)], x=4, w=1280)
    save_frames('static', 'Miscellaneous', 'Static', stack(8), w=1280, size=(640, 360), quality=55)


def blips():
    im = sheet('Miscellaneous', 'Blip Flash')
    im = key_colors(im, [GREEN], tol=8)
    files = []
    for i, y in enumerate(stack(17)):
        frame = im.crop((0, y, 1280, y + 720)).resize((640, 360), Image.BILINEAR)
        fn = f'blip_{i:02d}.webp'
        frame.save(os.path.join(IMG, fn), 'WEBP', quality=60, method=4)
        files.append(fn)
    manifest['img']['blip'] = files
    print('blip:', len(files))


def office_parts():
    # These sheets carry real alpha: only the green grid has to be removed.
    # Doors: 7 columns of 250x720 cells; three rows below a text header.
    doors = sheet('The Office', 'Doors')
    a = np.array(doors)[..., :3].astype(int)
    probe = np.abs(a[:, 40:210] - GREEN).sum(axis=2) < 8
    header_end = int(np.argmax(probe.mean(axis=1) < 0.5))
    print('door sheet: first row at', header_end)
    cell_w = doors.size[0] // 7
    row_h = 720
    keyed = key_colors(doors, [GREEN], tol=8)
    # Playback order: open, closing frames, fully closed (row 1 / column 0).
    order = [(0, 0)] + [(0, c) for c in range(1, 7)] + [(1, c) for c in range(1, 7)] \
        + [(2, c) for c in range(1, 5)] + [(1, 0)]
    files = []
    for i, (r, c) in enumerate(order):
        y = header_end + r * (row_h + 2)
        frame = keyed.crop((c * cell_w, y, c * cell_w + cell_w, y + row_h))
        fn = f'door_{i:02d}.webp'
        frame.save(os.path.join(IMG, fn), 'WEBP', quality=85, method=4)
        files.append(fn)
    manifest['img']['door'] = files
    manifest['meta']['doorWidth'] = cell_w
    print('door:', len(files), 'cell width', cell_w)

    # Door/light panels: [door off/light off, light on, door on, both] per side.
    buttons = sheet('The Office', 'Buttons')
    keyed = key_colors(buttons, [GREEN], tol=8)
    cw, ch = buttons.size[0] // 4, buttons.size[1] // 2
    files = []
    for r in range(2):
        for c in range(4):
            cell = keyed.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            fn = f'button_{r}{c}.png'
            cell.save(os.path.join(IMG, fn), optimize=True)
            files.append(fn)
    manifest['img']['button'] = files
    manifest['meta']['button'] = {'w': cw, 'h': ch}

    # Fan: opaque frames; located on the office by template matching.
    fan = sheet('The Office', 'Fan').convert('RGB')
    arr = np.array(fan).astype(int)
    is_green = np.abs(arr - GREEN).sum(axis=2) < 8
    cols = np.where(is_green.mean(axis=0) > 0.9)[0]
    runs = []
    start = None
    for x in range(fan.size[0]):
        if x not in set(cols.tolist()):
            if start is None:
                start = x
        elif start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, fan.size[0]))
    rows = np.where(is_green.mean(axis=1) < 0.5)[0]
    y0, y1 = int(rows.min()), int(rows.max()) + 1
    frames = [fan.crop((r0, y0, r1, y1)) for r0, r1 in runs]
    office = np.array(sheet('Rooms', 'The Office').convert('L').crop((0, 4, 1600, 724))).astype(int)
    tpl = np.array(frames[0].convert('L')).astype(int)
    best, pos = None, None
    for oy in range(240, 360):
        for ox in range(720, 880):
            region = office[oy:oy + tpl.shape[0], ox:ox + tpl.shape[1]]
            if region.shape != tpl.shape:
                continue
            score = np.abs(region - tpl).mean()
            if best is None or score < best:
                best, pos = score, (ox, oy)
    print('fan frames', len(frames), frames[0].size, 'best position', pos, 'score', round(best, 2))
    files = []
    for i, f in enumerate(frames):
        fn = f'fan_{i}.webp'
        f.save(os.path.join(IMG, fn), 'WEBP', quality=85, method=4)
        files.append(fn)
    manifest['img']['fan'] = files
    manifest['meta']['fan'] = {'x': pos[0], 'y': pos[1]}

    # Monitor flip: 4 x 3 grid of 1280x720, last cell holds credits.
    cam = sheet('The Office', 'Camera')
    keyed = key_colors(cam, [GREEN], tol=8)
    cw, ch = cam.size[0] // 4, cam.size[1] // 3
    files = []
    for i in range(11):
        r, c = i // 4, i % 4
        frame = keyed.crop((c * cw + 1, r * ch + 1, c * cw + 1281, r * ch + 721))
        fn = f'monitor_{i:02d}.webp'
        frame.save(os.path.join(IMG, fn), 'WEBP', quality=75, method=4)
        files.append(fn)
    manifest['img']['monitor'] = files

    golden = Image.open(os.path.join(SRC, f'{PREFIX}Miscellaneous - Golden Freddy.png')).convert('RGBA')
    golden.save(os.path.join(IMG, 'golden.webp'), 'WEBP', quality=85, method=4)
    manifest['img']['golden'] = ['golden.webp']
    manifest['meta']['golden'] = {'w': golden.size[0], 'h': golden.size[1]}


def text_sprites():
    t = sheet('Miscellaneous', 'Camera Text').convert('RGB')
    rows = {
        'toggle': (8, 68), 'title': (107, 319), 'disabled': (323, 377),
        'cam3': (381, 407), 'cam1A': (411, 437), 'cam1C': (441, 469), 'cam5': (473, 499),
        'cam1B': (503, 529), 'cam2A': (561, 587), 'cam4B': (591, 617), 'cam2B': (621, 647),
        'cam7': (651, 677), 'cam6': (681, 707), 'cam4A': (711, 737),
        'night6': (998, 1042), 'newgame': (1067, 1100), 'continue': (1104, 1138),
        'gameover': (1142, 1169), 'cursor': (1173, 1199),
        'card1': (1203, 1300), 'card2': (1304, 1401), 'card3': (1405, 1502), 'card4': (1506, 1603),
        'card5': (1607, 1704), 'card6': (1708, 1805), 'card7': (1809, 1909),
        'customnight': (1987, 2031), 'ready': (2035, 2093), 'ailevel': (2097, 2122), 'difficulty': (2126, 2155),
        'freddy': (2159, 2203), 'chica': (2207, 2241), 'foxy': (2245, 2287),
    }
    # Glyphs sit on a flat grey plate; the plate is sampled per-sprite.
    for name, (y0, y1) in rows.items():
        row = t.crop((0, y0, t.size[0], y1))
        a = np.array(row).astype(int)
        ink_cols = np.where((np.abs(a - GREEN).sum(axis=2) > 8).any(axis=0))[0]
        crop = row.crop((int(ink_cols.min()), 0, int(ink_cols.max()) + 1, row.size[1]))
        if name == 'toggle':
            box = (int(ink_cols.min()), y0, int(ink_cols.max()) + 1, y1)
            save_ui(name, key_colors(sheet('Miscellaneous', 'Camera Text').crop(box), [GREEN], tol=8))
            continue
        save_ui(name, key_luma(crop, bg=plate_level(crop)))

    def sub(name, box):
        crop = t.crop(box)
        save_ui(name, key_luma(crop, bg=plate_level(crop)))

    for i, cam in enumerate(['1A', '1B', '1C', '2A', '2B']):
        sub(f'label{cam}', (4 + 35 * i, 741, 35 + 35 * i, 766))
    for i, cam in enumerate(['3', '4A', '4B', '5', '6']):
        sub(f'label{cam}', (4 + 35 * i, 770, 35 + 35 * i, 795))
    sub('label7', (4, 799, 35, 824))
    sub('powerleft', (39, 799, 176, 824))
    sub('usage', (4, 828, 76, 842))
    sub('six_5', (4, 846, 57, 918))
    sub('six_6', (61, 846, 114, 918))
    sub('am_big', (4, 922, 117, 994))
    sub('nightlabel', (68, 1046, 131, 1063))
    sub('bonnie', (4, 2291, 154, 2343))
    sub('arrow_r', (158, 2291, 192, 2343))
    sub('arrow_l', (4, 2347, 38, 2399))
    sub('version', (4, 2403, 67, 2418))
    sub('copyright', (4, 2422, 230, 2436))

    ui = sheet('Miscellaneous', 'Camera UI and HUD').convert('RGB')
    save_ui('rec', key_colors(ui.crop((4, 730, 54, 780)), [(0, 0, 0), GREEN], tol=30))
    save_ui('map', key_luma(ui.crop((252, 728, 652, 1128)), bg=0))

    def strip(name, box, expected):
        glyphs = split_columns(ui.crop(box))
        print(f'{name}: {len(glyphs)} glyphs, expected {expected}, widths {[g.size[0] for g in glyphs]}')
        for i, g in enumerate(glyphs[:expected]):
            save_ui(f'{name}{i}', key_luma(g, bg=0))

    strip('big', (1478, 855, 1728, 885), 10)
    strip('small', (1055, 877, 1245, 899), 10)
    save_ui('am', key_luma(ui.crop((1478, 885, 1522, 913)), bg=0))
    save_ui('percent', key_luma(ui.crop((1320, 877, 1336, 899)), bg=0))
    for i, (x, y) in enumerate([(1055, 933), (1159, 933), (1264, 933), (1369, 933), (1055, 967)]):
        save_ui(f'usage{i + 1}', key_colors(ui.crop((x, y, x + 104, y + 33)), [(0, 0, 0), GREEN], tol=30))
    save_ui('cambtn', ui.crop((1478, 960, 1538, 1000)).convert('RGBA'))
    save_ui('cambtn_on', ui.crop((1539, 960, 1599, 1000)).convert('RGBA'))

    icons = Image.open(os.path.join(SRC, f'{PREFIX}Miscellaneous - Custom Night Icons & Names.png')).convert('RGB')
    for i, name in enumerate(['freddy', 'bonnie', 'chica', 'foxy']):
        x = [8, 216, 424, 632][i]
        icon = icons.crop((x, 8, x + 200, 208))
        fn = f'icon_{name}.webp'
        icon.save(os.path.join(IMG, fn), 'WEBP', quality=85)
        manifest['img'][f'icon_{name}'] = [fn]


# Reassign a sound by changing its source file here.
SOUNDS = {
    'ambience': 'fnaf-ambience-extended_trim.mp3',
    'door': 'door-slamming-fnaf-1-sound-effects.mp3',
    'light': 'fnaf-light-sound.mp3',
    'camera': 'fnaf-open-camera-sound.mp3',
    'error': 'error-fnaf.mp3',
    'scream': 'five-nights-at-freddys-full-scream-sound_2.mp3',
    'goldenScream': 'full-golden-freddy-scream.mp3',
    'sixAm': 'five-nights-at-freddys-6-am.mp3',
    'musicBox': 'fnaf-1-music-box.mp3',
    'footsteps': 'fnaf-1-footsteps.mp3',
    'laugh': 'fnaf-freddys-laugh.mp3',
    'windowScare': 'animatronic-in-door.mp3',
    'foxyHum': 'foxy-song-dum-dum-dum.mp3',
    'foxyRun': 'fnaf-running.mp3',
    'honk': 'partyfavorraspypart_ac01_3_5HTQ8CW.mp3',
    'powerOut': 'power-outage-in-a-horror-game.mp3',
}


def sounds():
    for key, src in SOUNDS.items():
        shutil.copy(os.path.join(SRC, 'SFX', src), os.path.join(SFX, f'{key}.mp3'))
        manifest['sfx'][key] = f'{key}.mp3'


def main():
    for d in (IMG, UI, SFX):
        os.makedirs(d, exist_ok=True)
    rooms()
    jumpscares()
    screens()
    blips()
    office_parts()
    text_sprites()
    sounds()
    body = json.dumps(manifest, indent=1)
    with open(os.path.join(ROOT, 'src', 'manifest.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build_assets.py - do not edit.\nexport const MANIFEST = ' + body + ';\n')
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f'Total: {total / 1048576:.1f} MB')


if __name__ == '__main__':
    main()
