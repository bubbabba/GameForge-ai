"""Build 'Pocket Town - Modern Exteriors' asset pack."""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

import chars
from core import S, Packer, TILE, draw_text, hx, ramp, save_gif, save_scaled, text_width, tiled_tsx
from town_objects import *  # noqa
from town_terrain import *  # noqa

NAME = 'PocketTown_Exteriors'
VERSION = '1.0'


def build(out_root, seed=2026):
    rng = np.random.default_rng(seed)
    root = os.path.join(out_root, f'{NAME}_v{VERSION}')
    if os.path.exists(root):
        shutil.rmtree(root)
    stats = {}

    # ---------------------------------------------------------- terrain
    T = {}
    T['grass_dirt'] = autotile(tex_dirt, tex_grass, rng, inner_rim=D[1], outer_rim=G[1])
    T['grass_sand'] = autotile(tex_sand, tex_grass, rng, inner_rim=SA[1], outer_rim=G[1])
    T['grass_water'] = autotile(tex_water, tex_grass, rng, edge='water', inner_rim=W[0], outer_rim=G[0])
    T['grass_paving'] = autotile(tex_paving, tex_grass, rng, radius=0, inset=2, inner_rim=PV[0], outer_rim=G[0])
    T['road_sidewalk'] = autotile(tex_sidewalk, tex_asphalt, rng, radius=0, inset=3, edge='curb')
    T['sand_water'] = autotile(tex_water, tex_sand, rng, edge='water', inner_rim=W[0], outer_rim=SA[1])
    fills = {
        'grass_dirt': [tex_grass(rng), tex_grass(rng, flowers=1.5), tex_grass(rng, flowers=3), tex_dirt(rng), tex_dirt(rng)],
        'grass_sand': [tex_grass(rng), tex_sand(rng), tex_sand(rng)],
        'grass_water': [tex_water(rng, phase=p) for p in range(3)] + [tex_grass(rng)],
        'grass_paving': [tex_paving(rng), tex_paving(rng)],
        'road_sidewalk': [tex_sidewalk(rng), tex_asphalt(rng)],
        'sand_water': [tex_water(rng), tex_sand(rng)],
    }
    for k, tiles in T.items():
        sh = autotile_sheet(tiles, fills[k])
        save_scaled(sh, root, f'terrain/{k}.png')
    stats['terrain_tiles'] = sum(13 + len(v) for v in fills.values())

    roads = road_tiles(rng)
    rs = S(16 * 8, 16 * ((len(roads) + 7) // 8))
    for i, t in enumerate(roads.values()):
        rs.blit(t, (i % 8) * 16, (i // 8) * 16)
    save_scaled(rs, root, 'terrain/road_markings.png')
    stats['road_tiles'] = len(roads)

    water_anim = S(48, 16)
    for p in range(3):
        water_anim.blit(tex_water(rng, phase=p), p * 16, 0)
    save_scaled(water_anim, root, 'animated/water_3frames.png')

    # -------------------------------------------------------- buildings
    B = {
        'house_cream_red': house(rng, 3, 'cream', 'red', shutters='#4a6aa8', boxes=True),
        'house_sky_orange': house(rng, 3, 'sky', 'orange', chimney=False),
        'house_rose_brown': house(rng, 3, 'rose', 'brown', shutters='#efeee6'),
        'house_mint_teal': house(rng, 2, 'mint', 'teal', chimney=False, door_col=0),
        'house_white_blue': house(rng, 4, 'white', 'blue', dormer=True, boxes=True),
        'house_brick_slate': house(rng, 4, 'brick', 'slate', 'brick', dormer=True),
        'house_lilac_green': house(rng, 3, 'lilac', 'green', 'plaster', shutters='#5a8c52'),
        'house_sand_red': house(rng, 2, 'sand', 'red', 'plaster', door_col=1),
        'shop_cafe': shop(rng, 4, 'white', 'CAFE', ('#d8443e', '#efeee6')),
        'shop_books': shop(rng, 3, 'mint', 'BOOKS', ('#3a8c90', '#efeee6')),
        'shop_mart': shop(rng, 5, 'cream', '24H MART', ('#4a7ad8', '#efeee6')),
        'shop_pizza': shop(rng, 4, 'brick', 'PIZZA', ('#48b06a', '#efeee6'), 'brick'),
        'shop_flowers': shop(rng, 3, 'rose', 'FLORA', ('#e86aa0', '#efeee6'), roof='green'),
        'shop_arcade': shop(rng, 4, 'lilac', 'ARCADE', ('#9a5ad0', '#f0c040')),
        'apartment_brick': apartment(rng, 4, 3, 'brick', 'brick'),
        'apartment_sand': apartment(rng, 5, 4, 'sand', 'plaster'),
        'apartment_sky': apartment(rng, 3, 2, 'sky', 'siding'),
        'garage_white': garage(rng),
        'garage_cream': garage(rng, 'cream', 'red'),
    }
    pk = Packer(320)
    for k, b in B.items():
        save_scaled(b, root, f'buildings/{k}.png')
        pk.add(k, b)
    sheet, atlas = pk.build()
    save_scaled(sheet, root, 'buildings/_buildings_sheet.png')
    stats['buildings'] = len(B)

    # ------------------------------------------------------------ props
    P = {
        'tree_oak_big': tree_round(rng), 'tree_oak_small': tree_round(rng, False),
        'tree_cherry_big': tree_round(rng, True, '#ec92b6'), 'tree_cherry_small': tree_round(rng, False, '#ec92b6'),
        'tree_autumn_big': tree_round(rng, True, '#e0903a'), 'tree_apple_big': tree_round(rng, True, None, '#e8403a'),
        'tree_pine_big': tree_pine(rng), 'tree_pine_small': tree_pine(rng, False),
        'bush': bush(rng), 'bush_pink': bush(rng, '#f06a9a'), 'bush_yellow': bush(rng, '#f8d048'),
        'hedge': hedge(rng), 'flower_bed': flower_bed(rng), 'planter': planter(rng),
        'bench': bench(rng), 'street_lamp': lamp(rng), 'trash_can': trash_can(rng),
        'trash_can_blue': trash_can(rng, '#4a7ad8'), 'hydrant': hydrant(rng), 'mailbox': mailbox(rng),
        'traffic_cone': cone(rng), 'stop_sign': sign_stop(rng), 'traffic_light': traffic_light(rng),
        'vending_red': vending(rng), 'vending_blue': vending(rng, '#4a7ad8'), 'bus_stop': bus_stop(rng),
        'picnic_table': picnic_table(rng), 'fountain': fountain(rng), 'dumpster': dumpster(rng),
        'crate': crate(rng), 'bike_rack': bike_rack(rng), 'bicycle_red': bicycle(rng),
        'bicycle_teal': bicycle(rng, '#3ab0b8'), 'parking_meter': parking_meter(rng),
        'newspaper_box': newspaper_box(rng),
    }
    for kind in ('picket', 'rail'):
        for part, spr in zip(('left', 'mid', 'right'), fence(rng, kind)):
            P[f'fence_{kind}_{part}'] = spr
    pk = Packer(256)
    for k, p in P.items():
        save_scaled(p, root, f'props/{k}.png')
        pk.add(k, p)
    sheet, patlas = pk.build()
    save_scaled(sheet, root, 'props/_props_sheet.png')
    stats['props'] = len(P)

    # --------------------------------------------------------- vehicles
    V = {}
    colors = {'red': '#d8443e', 'blue': '#4a6ad0', 'green': '#48b06a', 'white': '#efeee6',
              'black': '#3a3e4e', 'orange': '#f08a3a', 'pink': '#ee8ab0', 'silver': '#aab0bc'}
    plan = [('sedan', c) for c in colors] + [('van', c) for c in ('white', 'blue', 'green', 'orange')] + \
           [('pickup', c) for c in ('red', 'blue', 'silver', 'green')] + [('taxi', None), ('police', None)]
    vs = S(128, 32 * len(plan))
    for i, (kind, cname) in enumerate(plan):
        col = {'taxi': '#f0c030', 'police': '#2e3240'}.get(kind) or colors[cname]
        strip = S(128, 32)
        for j, d in enumerate(('down', 'left', 'right', 'up')):
            strip.blit(car(kind, d, col), j * 32, 0)
        name = f'{kind}_{cname}' if cname else kind
        V[name] = strip
        save_scaled(strip, root, f'vehicles/{name}.png')
        vs.blit(strip, 0, i * 32)
    save_scaled(vs, root, 'vehicles/_vehicles_sheet.png')
    stats['vehicles'] = len(V)

    # ------------------------------------------------------- characters
    specs = [chars.random_spec(rng, i) for i in range(20)]
    for i, sp in enumerate(specs):
        save_scaled(chars.sheet(sp), root, f'characters/premade_{i + 1:02d}.png')
    # layered generator parts
    for i, sk in enumerate(chars.SKINS):
        sp = dict(specs[0], skin=sk)
        save_scaled(chars.sheet(sp, ('body',)), root, f'character_generator/1_bodies/body_{i + 1}.png')
    for st in chars.HAIR_STYLES:
        for hn, hc in chars.HAIRS.items():
            sp = dict(specs[0], style=st, hair=hc)
            save_scaled(chars.sheet(sp, ('hair',)), root, f'character_generator/3_hair/{st}_{hn}.png')
    n_out = 0
    for ci, sc in enumerate(chars.CLOTH):
        for pi in (ci % len(chars.PANTS), (ci + 3) % len(chars.PANTS)):
            sp = dict(specs[0], shirt=sc, pants=chars.PANTS[pi], dress=False)
            n_out += 1
            save_scaled(chars.sheet(sp, ('outfit',)), root, f'character_generator/2_outfits/outfit_{n_out:02d}.png')
        sp = dict(specs[0], shirt=sc, pants=sc, dress=True)
        n_out += 1
        save_scaled(chars.sheet(sp, ('outfit',)), root, f'character_generator/2_outfits/outfit_{n_out:02d}_dress.png')
    stats['characters'] = len(specs)
    stats['char_parts'] = len(chars.SKINS) + len(chars.HAIR_STYLES) * len(chars.HAIRS) + n_out

    # ------------------------------------------------------ sample map
    town = sample_map(rng, T, roads, B, P, V, specs)
    save_scaled(town, root, 'sample_map.png', (1, 2))

    # ------------------------------------------------------------ tiled
    tdir = os.path.join(root, 'tiled')
    os.makedirs(tdir, exist_ok=True)
    for k in T:
        im = Image.open(os.path.join(root, '16x16', 'terrain', f'{k}.png'))
        tiled_tsx(os.path.join(tdir, f'{k}.tsx'), k, f'../16x16/terrain/{k}.png', *im.size)
    im = Image.open(os.path.join(root, '16x16', 'terrain', 'road_markings.png'))
    tiled_tsx(os.path.join(tdir, 'road_markings.tsx'), 'road_markings', '../16x16/terrain/road_markings.png', *im.size)
    with open(os.path.join(root, 'atlas.json'), 'w') as f:
        json.dump({'buildings_sheet': atlas, 'props_sheet': patlas, 'tile_size': 16,
                   'character_sheet': {'frame': [16, 32], 'columns': 'walk frames 0-3',
                                       'rows': chars.DIRS},
                   'vehicle_strip': {'frame': [32, 32], 'columns': ['down', 'left', 'right', 'up']}}, f, indent=1)

    write_docs(root, stats)
    previews(out_root, town, root, B, P, V, specs, T, roads)
    return root, stats


def place_rect(g, tiles, c0, r0, w, h):
    TL, Tt, TR, L, C, R, BL, Bb, BR = tiles[:9]
    for r in range(h):
        for c in range(w):
            top, bot, lef, rig = r == 0, r == h - 1, c == 0, c == w - 1
            t = (TL if top and lef else TR if top and rig else BL if bot and lef else BR if bot and rig
                 else Tt if top else Bb if bot else L if lef else R if rig else C)
            g.blit(t, (c0 + c) * 16, (r0 + r) * 16)


def sample_map(rng, T, roads, B, P, V, specs):
    cols, rows = 40, 24
    g = S(cols * 16, rows * 16)
    for r in range(rows):
        for c in range(cols):
            g.blit(tex_grass(rng, flowers=0.6 if rng.random() < 0.15 else 0), c * 16, r * 16)
    sw = T['road_sidewalk']
    # main horizontal road rows 9-11, sidewalks 8 & 12
    for c in range(cols):
        g.blit(sw[7], c * 16, 8 * 16)      # sidewalk with curb at bottom
        g.blit(roads['asphalt'], c * 16, 9 * 16)
        g.blit(roads['dash_h'], c * 16, 10 * 16)
        g.blit(roads['asphalt_2'], c * 16, 11 * 16)
        if not 24 <= c <= 26:
            g.blit(sw[1], c * 16, 12 * 16)  # curb at top
    # vertical road cols 24-26 rows 12-23
    for r in range(12, rows):
        g.blit(sw[5], 23 * 16, r * 16)
        g.blit(roads['asphalt'], 24 * 16, r * 16)
        g.blit(roads['dash_v'] if r > 13 else roads['asphalt'], 25 * 16, r * 16)
        g.blit(roads['asphalt_2'], 26 * 16, r * 16)
        g.blit(sw[3], 27 * 16, r * 16)
    for c in (24, 25, 26):
        g.blit(roads['crosswalk_v'], c * 16, 12 * 16)
    for c in (20, 21):
        for r in (9, 10, 11):
            g.blit(roads['crosswalk_h'], c * 16, r * 16)
    g.blit(roads['manhole'], 33 * 16, 9 * 16)
    g.blit(roads['drain'], 6 * 16, 11 * 16)
    # paving strip in front of shops, park dirt plaza, pond
    place_rect(g, T['grass_paving'], 0, 16, 23, 2)
    place_rect(g, T['grass_dirt'], 2, 18, 7, 5)
    place_rect(g, T['grass_water'], 13, 19, 8, 4)
    # parking lot bottom right
    for r in range(18, 23):
        for c in range(30, 39):
            g.blit(roads['parking_left'] if c % 2 == 0 and r in (19, 20, 21) else roads['asphalt'], c * 16, r * 16)

    objs = []  # (baseline_y, sprite, x, y)

    def put(spr, x, y):
        objs.append((y + spr.h, spr, x, y))

    # house row
    x = 8
    for k in ('house_cream_red', 'house_mint_teal', 'house_white_blue', 'house_rose_brown', 'house_sky_orange',
              'house_brick_slate', 'house_lilac_green', 'house_sand_red'):
        b = B[k]
        put(b, x, 7 * 16 - b.h)
        x += b.w + 16
        if x > cols * 16 - 32:
            break
    for c in range(cols):
        if c % 7 == 3:
            put(P['street_lamp'], c * 16, 8 * 16 - 32)
    for i, c in enumerate((2, 6, 12, 17, 22, 28, 33, 38)):
        if i % 2 == 0:
            put(P['hedge'], c * 16, 7 * 16)
    put(P['mailbox'], 5 * 16, 7 * 16 - 8)
    put(P['tree_oak_big'], 37 * 16, 1 * 16)
    put(P['tree_pine_big'], -8, 0)
    # shops row
    x = 4
    for k in ('shop_cafe', 'shop_books', 'shop_pizza', 'shop_flowers'):
        b = B[k]
        put(b, x, 16 * 16 - b.h)
        x += b.w + 8
    put(P['bench'], 6 * 16, 16 * 16 + 4)
    put(P['trash_can'], 9 * 16, 16 * 16 + 6)
    put(P['vending_red'], 21 * 16, 16 * 16 - 20)
    put(P['hydrant'], 18 * 16, 12 * 16 + 2)
    put(P['stop_sign'], 22 * 16 + 4, 12 * 16 - 14)
    put(P['traffic_light'], 27 * 16 + 2, 12 * 16 - 30)
    # park
    put(P['fountain'], 3 * 16 + 4, 18 * 16 + 8)
    for (k, cx, cy) in (('tree_cherry_big', 9, 18), ('tree_oak_big', 10, 20), ('tree_pine_small', 21, 18),
                        ('tree_cherry_small', 12, 17), ('tree_autumn_big', 19, 21), ('tree_apple_big', 0, 20)):
        put(P[k], cx * 16, cy * 16 - 16)
    for (k, cx, cy) in (('bush_pink', 1, 18), ('bush', 9, 23), ('bush_yellow', 12, 22), ('flower_bed', 21, 22),
                        ('bush', 22, 19)):
        put(P[k], cx * 16, cy * 16)
    put(P['picnic_table'], 15 * 16, 17 * 16 + 8)
    put(P['bench'], 4 * 16, 22 * 16 + 6)
    # right block
    put(B['apartment_brick'], 29 * 16, 17 * 16 - B['apartment_brick'].h)
    put(B['garage_white'], 35 * 16, 17 * 16 - 48)
    put(P['dumpster'], 37 * 16 + 4, 17 * 16 - 26)
    put(P['bike_rack'], 28 * 16, 17 * 16 - 14)
    put(P['bicycle_teal'], 28 * 16, 17 * 16 - 14)
    put(P['traffic_cone'], 29 * 16, 22 * 16)
    put(P['traffic_cone'], 39 * 16, 18 * 16)
    put(P['planter'], 33 * 16 + 8, 17 * 16 - 20)
    for (k, cx, cy, d) in (('sedan_red', 30.5, 19, 0), ('van_white', 32.5, 19, 0), ('pickup_blue', 36.5, 19, 3),
                           ('sedan_silver', 34.5, 19, 0)):
        put(V[k].crop(d * 32, 0, 32, 32), int(cx * 16), cy * 16)
    # traffic
    put(V['taxi'].crop(64, 0, 32, 32), 9 * 16, 9 * 16 - 8)
    put(V['sedan_blue'].crop(32, 0, 32, 32), 30 * 16, 10 * 16 - 6)
    put(V['police'].crop(64, 0, 32, 32), 1 * 16, 9 * 16 - 8)
    put(V['sedan_green'].crop(0, 0, 32, 32), 24 * 16, 15 * 16)
    put(V['van_orange'].crop(96, 0, 32, 32), 25 * 16 + 8, 19 * 16)
    # people
    spots = [(3, 8, 'right'), (11, 8, 'left'), (19, 12, 'down'), (8, 16, 'down'), (16, 16, 'left'),
             (5, 20, 'up'), (13, 18, 'right'), (23, 15, 'down'), (27, 19, 'up'), (33, 8, 'right'),
             (37, 12, 'left'), (22, 17, 'down')]
    for i, (cx, cy, d) in enumerate(spots):
        fr = chars.frame(specs[i], d, i % 4).outline()
        put(fr, cx * 16, cy * 16 - 18)
    for _, spr, x, y in sorted(objs, key=lambda o: o[0]):
        g.blit(spr, x, y)
    return g


# --------------------------------------------------------------- docs --

LICENSE = """POCKET TOWN - LICENSE (bubbabba)

You MAY:
  - Use these assets in unlimited personal and commercial projects (games, apps, videos).
  - Edit, recolor and modify the assets for your project.

You may NOT:
  - Resell or redistribute the assets, edited or not, as an asset pack or on their own.
  - Use the assets to train AI image models, or include them in NFTs.
  - Claim the assets as your own creation.

Credit is not required but is always appreciated: "Art: Pocket Town by bubbabba".
"""


def write_docs(root, st):
    with open(os.path.join(root, 'LICENSE.txt'), 'w') as f:
        f.write(LICENSE)
    with open(os.path.join(root, 'README.txt'), 'w') as f:
        f.write(f"""POCKET TOWN - MODERN EXTERIORS  v{VERSION}
by bubbabba

A cosy top-down 16x16 pixel art pack for modern-day RPGs, life sims and town builders.
Every sprite is provided at 16x16, 32x32 and 48x48 (pixel-perfect nearest-neighbour scaling).

CONTENTS
  terrain/            {st['terrain_tiles']} autotile & fill tiles (grass, dirt, sand, water, brick paving, sidewalk/curb)
                      Layout: 3x3 outer block + 2x2 inner corners + fill variants below.
  terrain/road_markings.png  {st['road_tiles']} road tiles (lanes, crosswalks, arrows, manhole, drain...)
  animated/           3-frame water animation
  buildings/          {st['buildings']} buildings (houses, shops, apartments, garages) - grid aligned
  props/              {st['props']} props (trees, bushes, fences, lamps, benches, signs, fountain, vending...)
  vehicles/           {st['vehicles']} vehicles x 4 directions (sedan, van, pickup, taxi, police)
  characters/         {st['characters']} premade characters (16x32, 4 directions x 4-frame walk)
  character_generator/ {st['char_parts']} layered parts: stack 1_bodies + 2_outfits + 3_hair to make your own
  tiled/              Tiled (.tsx) tilesets for the terrain sheets
  atlas.json          Sprite coordinates for the packed *_sheet.png files
  sample_map.png      Example scene built only from this pack

CHARACTER SHEETS
  64x128 px (at 16x16 scale). Frame 16x32. Rows: down, left, right, up. Columns: walk frames 0-3
  (frame 0 = idle). Suggested speed: 8 fps.

VEHICLE STRIPS
  128x32 px. Frame 32x32. Columns: down, left, right, up.

Matching pack: POCKET TOWN - COZY INTERIORS.
""")


def previews(out_root, town, root, B, P, V, specs, T, roads):
    pdir = os.path.join(out_root, f'{NAME}_itch_page')
    if os.path.exists(pdir):
        shutil.rmtree(pdir)
    os.makedirs(pdir)
    # cover 630x500: crop of the map at 2x with title banner
    crop = town.crop(16, 64, 315, 250)
    cov = crop.img().resize((630, 500), Image.NEAREST)
    banner = S(315, 250)
    bh = 46
    banner.rect(0, 0, 315, bh, (30, 28, 48, 225))
    banner.hline(0, bh, 315, (255, 214, 92, 255))
    title = 'POCKET TOWN'
    draw_text(banner, (315 - text_width(title, 3)) // 2, 6, title, hx('#ffd65c'), 3, shadow_c=hx('#a0502a'))
    sub = 'MODERN EXTERIORS 16X16'
    draw_text(banner, (315 - text_width(sub, 1)) // 2, 30, sub, hx('#f4f0e8'))
    cov.alpha_composite(banner.img().resize((630, 500), Image.NEAREST))
    cov.convert('RGB').save(os.path.join(pdir, 'cover_630x500.png'))
    # screenshots
    town.save(os.path.join(pdir, 'screenshot_1_sample_town.png'), 2)
    showcase(B.values(), 4, os.path.join(pdir, 'screenshot_2_buildings.png'), width=420)
    showcase(P.values(), 4, os.path.join(pdir, 'screenshot_3_props.png'), width=300)
    showcase([v for v in V.values()], 3, os.path.join(pdir, 'screenshot_4_vehicles.png'), width=280)
    terr = [autotile_sheet(t, []) for t in T.values()]
    showcase(terr, 4, os.path.join(pdir, 'screenshot_5_terrain.png'), width=270, bg=(30, 28, 48, 255))
    # walking gif
    frames = []
    n = 8
    for f in range(8):
        fr = S(16 * n + 8 * (n + 1), 32 * 4 + 8)
        fr.rect(0, 0, fr.w, fr.h, (116, 184, 76, 255))
        for i in range(n):
            for r, d in enumerate(chars.DIRS):
                fr.blit(chars.frame(specs[i], d, f % 4).outline(), 8 + i * 24, 4 + r * 32)
        frames.append(fr)
    save_gif(frames, os.path.join(pdir, 'animated_walk_cycles.gif'), 3, 140)


def showcase(sprites, scale, path, width=320, bg=(116, 184, 76, 255)):
    pk = Packer(width - width % 16)
    for i, s in enumerate(sprites):
        pad = S(s.w + 4, s.h + 4)
        pad.blit(s, 2, 2)
        pk.add(str(i), pad)
    sheet, _ = pk.build()
    out = S(sheet.w + 16, sheet.h + 16, bg)
    out.blit(sheet, 8, 8)
    out.save(path, scale)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '../dist'
    root, stats = build(out)
    print(root, json.dumps(stats))
