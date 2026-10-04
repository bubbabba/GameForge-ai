"""Build 'Pocket Town - Cozy Interiors' asset pack."""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

import chars
from core import S, Packer, draw_text, hx, ramp, save_gif, save_scaled, text_width, tiled_tsx
from interior_objects import *  # noqa
from pack_town import LICENSE, showcase

NAME = 'PocketTown_Interiors'
VERSION = '1.0'


def build(out_root, seed=777):
    rng = np.random.default_rng(seed)
    root = os.path.join(out_root, f'{NAME}_v{VERSION}')
    if os.path.exists(root):
        shutil.rmtree(root)
    st = {}

    # ---------------------------------------------------------- floors
    F = {}
    for n, c in (('oak', '#c08a52'), ('walnut', '#8a5a3a'), ('birch', '#e0c08a'), ('gray', '#9a9490')):
        F[f'planks_{n}'] = floor_planks(rng, ramp(c))
    for n, c in (('oak', '#c08a52'), ('walnut', '#8a5a3a')):
        F[f'herringbone_{n}'] = floor_herringbone(rng, c)
    for n, (a, b) in (('bw', ('#efeee6', '#4a4a5a')), ('red', ('#efeee6', '#c8504a')), ('mint', ('#efeee6', '#7ac0a0')),
                      ('blue', ('#efeee6', '#5a7ac8'))):
        F[f'checker_{n}'] = floor_checker(rng, a, b)
    for n, c in (('white', '#e4e4e0'), ('sky', '#a8d0e8'), ('sand', '#d8c8a0'), ('slate', '#6a7080')):
        F[f'tiles_{n}'] = floor_tiles(rng, c)
    for n, c in FABRIC.items():
        F[f'carpet_{n}'] = floor_carpet(rng, c)
    fs = S(16 * 8, 16 * ((len(F) + 7) // 8))
    for i, (k, t) in enumerate(F.items()):
        fs.blit(t, (i % 8) * 16, (i // 8) * 16)
    save_scaled(fs, root, 'floors/floors.png')
    st['floors'] = len(F)

    # ----------------------------------------------------------- walls
    Wl = {}
    for n, c, pat, acc in (
            ('cream_plain', '#ead8b0', 'plain', None), ('cream_stripes', '#ead8b0', 'stripes', None),
            ('sky_dots', '#a8cce0', 'dots', '#efeee6'), ('mint_stripes', '#b6d8a2', 'stripes', None),
            ('rose_dots', '#e8b0a8', 'dots', '#efeee6'), ('lilac_plain', '#c0b0dc', 'plain', None),
            ('white_tiles', '#e4e4e0', 'tiles', None), ('sky_tiles', '#a8d0e8', 'tiles', None),
            ('wood_panel', '#b07a46', 'wood', None), ('brick_red', '#b85c48', 'brick', None),
            ('brick_white', '#dcd8d0', 'brick', None), ('sage_wainscot', '#b8c8a0', 'wainscot', '#efeee6'),
            ('navy_wainscot', '#4a5a8a', 'wainscot', '#efeee6'), ('peach_wainscot', '#f0c8a0', 'wainscot', '#8a5a3a'),
            ('yellow_plain', '#f0d890', 'plain', None), ('gray_plain', '#a0a0aa', 'plain', None)):
        Wl[n] = wall(rng, c, pat, acc)
    ws = S(16 * 8, 32 * ((len(Wl) + 7) // 8) + 16)
    for i, t in enumerate(Wl.values()):
        ws.blit(t, (i % 8) * 16, (i // 8) * 32)
    ws.blit(wall_top(), 0, ws.h - 16)
    save_scaled(ws, root, 'walls/walls.png')
    st['walls'] = len(Wl) + 1

    # ------------------------------------------------------- furniture
    P = {}
    for n in ('red', 'blue', 'green', 'pink'):
        P[f'bed_single_{n}'] = bed(rng, FABRIC[n])
        P[f'bed_double_{n}'] = bed(rng, FABRIC[n], True)
    for n in ('blue', 'mustard', 'gray', 'teal', 'red'):
        P[f'sofa_{n}_front'] = sofa(rng, FABRIC[n])
        P[f'sofa_{n}_back'] = sofa(rng, FABRIC[n], 'up')
        P[f'armchair_{n}'] = armchair(rng, FABRIC[n])
    P['table_dining'] = table(rng)
    P['table_dining_cloth'] = table(rng, cloth='#efeee6')
    P['table_coffee'] = table(rng, 32, 24, DARKWOOD)
    P['table_small'] = table(rng, 16, 24, LIGHTWOOD)
    for d in ('down', 'up', 'left', 'right'):
        P[f'chair_wood_{d}'] = chair(rng, WOOD, d)
        P[f'chair_cushion_{d}'] = chair(rng, DARKWOOD, d, '#c8504a')
    P['bookshelf'] = bookshelf(rng)
    P['bookshelf_wide'] = bookshelf(rng, True)
    P['wardrobe_oak'] = wardrobe(rng)
    P['wardrobe_white'] = wardrobe(rng, WHITE)
    P['dresser'] = dresser(rng)
    P['nightstand'] = nightstand(rng)
    P['tv_stand'] = tv_stand(rng)
    P['desk_computer'] = desk_computer(rng)
    P['fridge'] = fridge(rng)
    P['fridge_mint'] = fridge(rng, '#a8d8c0')
    P['stove'] = stove(rng)
    for k in ('plain', 'sink', 'microwave', 'coffee', 'plant'):
        P[f'counter_{k}'] = counter(rng, k)
        P[f'counter_wood_{k}'] = counter(rng, k, WOOD, '#e4e4e0')
    P['washing_machine'] = washer(rng)
    P['toilet'] = toilet(rng)
    P['bathtub'] = bathtub(rng)
    P['bathroom_sink'] = bath_sink(rng)
    for i, n in enumerate(('monstera', 'snake_plant', 'succulent')):
        P[f'plant_{n}'] = plant(rng, i)
    P['floor_lamp'] = floor_lamp(rng)
    P['piano'] = piano(rng)
    P['trash_bin'] = bin_(rng)
    for i, (n, pat) in enumerate((('red', 'border'), ('blue', 'stripes'), ('mustard', 'round'), ('teal', 'border'),
                                  ('pink', 'round'), ('purple', 'stripes'))):
        P[f'rug_{n}_{pat}'] = rug(rng, FABRIC[n], 32 if i % 2 == 0 else 48, 32, pat)
    P['window'] = window_wall(rng)
    for n in ('red', 'blue', 'green', 'mustard'):
        P[f'window_curtains_{n}'] = window_wall(rng, FABRIC[n])
    P['door'] = door_wall(rng)
    P['door_white'] = door_wall(rng, WHITE)
    for i in range(4):
        P[f'painting_{i + 1}'] = painting(rng, 16 if i < 2 else 32, 16)
    P['wall_clock'] = clock(rng)
    P['wall_shelf'] = shelf_wall(rng)
    pk = Packer(320)
    for k, p in P.items():
        save_scaled(p, root, f'furniture/{k}.png')
        pk.add(k, p)
    sheet, atlas = pk.build()
    save_scaled(sheet, root, 'furniture/_furniture_sheet.png')
    st['furniture'] = len(P)

    # ------------------------------------------------------------- pets
    for cn, cc in (('orange', '#e8a050'), ('gray', '#9a9aa8'), ('black', '#4a4654'), ('white', '#ecece4')):
        cs = S(64, 64)
        for r, d in enumerate(chars.DIRS):
            for f in range(4):
                cs.blit(cat(np.random.default_rng(r), cc, d, f), f * 16, r * 16)
        save_scaled(cs, root, f'pets/cat_{cn}.png')
    st['pets'] = 4

    # ------------------------------------------------------- characters
    crng = np.random.default_rng(seed + 1)
    specs = [chars.random_spec(crng, i + 3) for i in range(8)]
    for i, sp in enumerate(specs):
        save_scaled(chars.sheet(sp), root, f'characters/resident_{i + 1:02d}.png')
    st['characters'] = len(specs)

    house = sample_house(rng, F, Wl, P, specs)
    save_scaled(house, root, 'sample_house.png', (1, 2))

    tdir = os.path.join(root, 'tiled')
    os.makedirs(tdir, exist_ok=True)
    tiled_tsx(os.path.join(tdir, 'floors.tsx'), 'floors', '../16x16/floors/floors.png', fs.w, fs.h)
    tiled_tsx(os.path.join(tdir, 'walls.tsx'), 'walls', '../16x16/walls/walls.png', ws.w, ws.h)
    with open(os.path.join(root, 'atlas.json'), 'w') as f:
        json.dump({'furniture_sheet': atlas, 'floors': list(F), 'walls_16x32': list(Wl), 'tile_size': 16}, f, indent=1)

    write_docs(root, st)
    previews(out_root, house, F, Wl, P, specs)
    return root, st


def sample_house(rng, F, Wl, P, specs):
    cols, rows = 24, 17
    g = S(cols * 16, rows * 16, (34, 32, 52, 255))
    rooms = [  # (c0, c1, r_wall, floor, wall)
        (1, 11, 0, 'planks_oak', 'sage_wainscot'),
        (12, 23, 0, 'checker_mint', 'white_tiles'),
        (1, 11, 8, 'carpet_blue', 'sky_dots'),
        (12, 17, 8, 'tiles_sky', 'sky_tiles'),
        (18, 23, 8, 'herringbone_walnut', 'wood_panel'),
    ]
    for c0, c1, r0, fl, wl in rooms:
        for c in range(c0, c1):
            g.blit(Wl[wl], c * 16, (r0 + 1) * 16)
            for r in range(r0 + 3, r0 + 8):
                g.blit(F[fl], c * 16, r * 16)
    top = wall_top()
    for c in range(cols):
        for r in (0, 8, 16):
            g.blit(top, c * 16, r * 16)
    for r in range(rows):
        for c in (0, 23):
            g.blit(top, c * 16, r * 16)
    for r in list(range(0, 4)) + list(range(6, 9)):
        g.blit(top, 11 * 16, r * 16)
    for r in list(range(8, 12)) + list(range(14, 17)):
        g.blit(top, 11 * 16, r * 16)
        g.blit(top, 17 * 16, r * 16)
    for r in (4, 5):  # side doorways
        g.blit(F['planks_oak'], 11 * 16, r * 16)
    for r in (12, 13):
        g.blit(F['carpet_blue'], 11 * 16, r * 16)
        g.blit(F['tiles_sky'], 17 * 16, r * 16)
    for c in (4, 5):  # doorway between top and bottom floors
        g.blit(F['planks_oak'], c * 16, 8 * 16)
        g.blit(F['carpet_blue'], c * 16, 9 * 16)
        g.blit(F['carpet_blue'], c * 16, 10 * 16)

    objs = []

    def put(k, x, y, floor_item=False):
        spr = P[k] if isinstance(k, str) else k
        objs.append((-1 if floor_item else y + spr.h, spr, int(x), int(y)))

    # living room
    put('rug_red_border', 3 * 16, 4.5 * 16, True)
    put('sofa_teal_front', 3 * 16, 3 * 16 - 4)
    put('table_coffee', 3 * 16, 5 * 16 - 4)
    put('armchair_mustard', 7 * 16, 4 * 16)
    put('tv_stand', 3 * 16, 6 * 16 + 2)
    put('bookshelf_wide', 8 * 16, 1 * 16 + 4)
    put('plant_monstera', 1 * 16, 1 * 16 + 14)
    put('window_curtains_red', 6 * 16, 1 * 16 - 2)
    put('painting_3', 2 * 16 + 4, 1 * 16 + 6)
    put('floor_lamp', 10 * 16, 5 * 16)
    put('piano', 8 * 16, 5 * 16 + 4)
    # kitchen
    for i, k in enumerate(('fridge', 'counter_plain', 'counter_sink', 'stove', 'counter_microwave', 'counter_coffee',
                           'counter_plant')):
        put(k, (13 + i) * 16, 1 * 16 + 4)
    put('window', 20 * 16, 1 * 16 - 2)
    put('wall_clock', 21 * 16 + 8, 1 * 16 + 6)
    put('table_dining_cloth', 16 * 16, 4.5 * 16)
    put('chair_cushion_right', 15 * 16, 4.5 * 16 + 2)
    put('chair_cushion_left', 18 * 16, 4.5 * 16 + 2)
    put('chair_cushion_down', 16 * 16 + 8, 3.5 * 16)
    put('plant_snake_plant', 22 * 16, 5 * 16)
    put('trash_bin', 12 * 16, 6 * 16)
    # bedroom
    put('rug_mustard_round', 6 * 16, 13 * 16, True)
    put('bed_double_pink', 2 * 16, 10 * 16 + 4)
    put('nightstand', 1 * 16, 10 * 16 + 8)
    put('nightstand', 4 * 16, 10 * 16 + 8)
    put('wardrobe_white', 8 * 16, 9 * 16 + 4)
    put('window_curtains_blue', 6 * 16, 9 * 16 - 2)
    put('dresser', 8 * 16, 13.5 * 16)
    put('plant_succulent', 9 * 16, 13 * 16)
    put('painting_1', 2 * 16 + 8, 9 * 16 + 4)
    # bathroom
    put('bathtub', 12 * 16, 10 * 16 + 4)
    put('toilet', 15 * 16, 10 * 16 + 8)
    put('bathroom_sink', 16 * 16, 9 * 16 + 6)
    put('washing_machine', 12 * 16, 13 * 16)
    # study
    put('desk_computer', 19 * 16, 10 * 16)
    put('chair_wood_up', 20 * 16 - 8, 11 * 16 + 4)
    put('bookshelf', 22 * 16, 9 * 16 + 4)
    put('wall_shelf', 19 * 16, 9 * 16 + 2)
    put('rug_purple_stripes', 18 * 16 + 8, 13 * 16, True)
    put('plant_monstera', 18 * 16, 14 * 16)
    # residents + cats
    for i, (cx, cy, d) in enumerate(((5.5, 6, 'down'), (17.5, 6, 'up'), (6, 13.5, 'left'), (20.5, 14, 'down'))):
        put(chars.frame(specs[i], d, 0).outline(), cx * 16, cy * 16 - 18)
    put(cat(rng, '#e8a050', 'right'), 9 * 16, 7 * 16)
    put(cat(rng, '#4a4654', 'down'), 4 * 16, 14 * 16)
    for _, spr, x, y in sorted(objs, key=lambda o: o[0]):
        g.blit(spr, x, y)
    return g


def write_docs(root, st):
    with open(os.path.join(root, 'LICENSE.txt'), 'w') as f:
        f.write(LICENSE)
    with open(os.path.join(root, 'README.txt'), 'w') as f:
        f.write(f"""POCKET TOWN - COZY INTERIORS  v{VERSION}
by bubbabba

A 16x16 top-down interior pack for modern RPGs, life sims and cosy games.
Every sprite is provided at 16x16, 32x32 and 48x48.

CONTENTS
  floors/      {st['floors']} seamless floor tiles (planks, herringbone, checker, tiles, carpets)
  walls/       {st['walls']} wall tiles - 16x32 wall faces (wallpapers, tiles, brick, wainscot) + wall-top tile
  furniture/   {st['furniture']} furniture & decor sprites (beds, sofas, kitchen, bathroom, study, plants,
               rugs, windows, doors, paintings...). All aligned to the 16px grid.
  pets/        {st['pets']} cats - 16x16, rows: down, left, right, up; 4 frames each
  characters/  {st['characters']} residents - 16x32, rows: down, left, right, up; 4-frame walk
  tiled/       Tiled (.tsx) tilesets for floors and walls
  atlas.json   Sprite coordinates for _furniture_sheet.png
  sample_house.png  Example house built only from this pack

WALLS
  Each wall face is 16x32: the top 4px is the wall cap seen from above, then the wall,
  then the baseboard. Place the wall face on the row above your floor.

Matching pack: POCKET TOWN - MODERN EXTERIORS (same palette, scale and characters style).
""")


def previews(out_root, house, F, Wl, P, specs):
    pdir = os.path.join(out_root, f'{NAME}_itch_page')
    if os.path.exists(pdir):
        shutil.rmtree(pdir)
    os.makedirs(pdir)
    crop = house.crop(0, 0, 315, 250).img().resize((630, 500), Image.NEAREST)
    banner = S(315, 250)
    banner.rect(0, 204, 315, 46, (30, 28, 48, 230))
    banner.hline(0, 204, 315, (255, 214, 92, 255))
    t = 'POCKET TOWN'
    draw_text(banner, (315 - text_width(t, 3)) // 2, 209, t, hx('#ffd65c'), 3, shadow_c=hx('#a0502a'))
    sub = 'COZY INTERIORS 16X16'
    draw_text(banner, (315 - text_width(sub)) // 2, 234, sub, hx('#f4f0e8'))
    crop.alpha_composite(banner.img().resize((630, 500), Image.NEAREST))
    crop.convert('RGB').save(os.path.join(pdir, 'cover_630x500.png'))
    house.save(os.path.join(pdir, 'screenshot_1_sample_house.png'), 2)
    showcase(P.values(), 3, os.path.join(pdir, 'screenshot_2_furniture.png'), width=400, bg=(214, 196, 160, 255))
    showcase(list(F.values()) + list(Wl.values()), 4, os.path.join(pdir, 'screenshot_3_floors_walls.png'),
             width=240, bg=(30, 28, 48, 255))
    frames = []
    for f in range(8):
        fr = S(4 * 24 + 8, 4 * 20 + 8, (214, 196, 160, 255))
        for i, cc in enumerate(('#e8a050', '#9a9aa8', '#4a4654', '#ecece4')):
            for r, d in enumerate(chars.DIRS):
                fr.blit(cat(np.random.default_rng(r), cc, d, f % 4), 8 + i * 24, 4 + r * 20)
        frames.append(fr)
    save_gif(frames, os.path.join(pdir, 'animated_cats.gif'), 4, 150)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '../dist'
    root, st = build(out)
    print(root, json.dumps(st))
