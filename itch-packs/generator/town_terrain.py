"""Ground tiles for the town pack: textures, autotile transitions, road markings."""
import numpy as np

from core import S, TILE, hx, ramp, shift, with_alpha

G = ramp('#74b84c')      # grass
D = ramp('#c89a64')      # dirt path
SA = ramp('#e8d49a')     # sand
W = ramp('#4aa4dc')      # water
A = ramp('#5c606e')      # asphalt
SW = ramp('#c8c4bc')     # sidewalk
PV = ramp('#b8644e')     # brick paving
FL = ['#f06a7a', '#f8d048', '#ffffff', '#8a7ef0', '#f89a48']
WHITE = hx('#f4f4ec')
YELLOW = hx('#f0c030')


# ------------------------------------------------------------ textures --

def tex_grass(rng, w=TILE, h=TILE, flowers=0.0):
    s = S(w, h, G[2])
    for _ in range(w * h // 18):
        x, y = int(rng.integers(w)), int(rng.integers(h))
        c = G[1] if rng.random() < 0.55 else G[3]
        s.px(x, y, c)
        s.px(x, (y - 1) % h, c if c == G[3] else G[2])
    for _ in range(w * h // 64):  # little grass tufts
        x, y = int(rng.integers(w)), int(rng.integers(1, h))
        s.px(x, y, G[1])
        s.px((x - 1) % w, y - 1, G[1])
        s.px((x + 1) % w, y - 1, G[1])
        s.px(x, y - 1, G[3])
    for _ in range(int(w * h * flowers / 40)):
        x, y = int(rng.integers(1, w - 1)), int(rng.integers(1, h - 1))
        c = hx(FL[int(rng.integers(len(FL)))])
        s.px(x, y, c)
        s.px(x, y + 1, G[0])
    return s


def tex_dirt(rng, w=TILE, h=TILE):
    s = S(w, h, D[2])
    for _ in range(w * h // 8):
        s.px(int(rng.integers(w)), int(rng.integers(h)), D[1] if rng.random() < 0.6 else D[3])
    for _ in range(w * h // 64):
        x, y = int(rng.integers(w - 1)), int(rng.integers(h - 1))
        s.px(x, y, D[3]); s.px(x + 1, y, D[3]); s.px(x, y + 1, D[1]); s.px(x + 1, y + 1, D[0])
    return s


def tex_sand(rng, w=TILE, h=TILE):
    s = S(w, h, SA[2])
    for _ in range(w * h // 10):
        s.px(int(rng.integers(w)), int(rng.integers(h)), SA[1] if rng.random() < 0.5 else SA[3])
    return s


def tex_water(rng, w=TILE, h=TILE, phase=0):
    s = S(w, h, W[2])
    r = np.random.default_rng(99)
    for _ in range(w * h // 18):
        x, y = int(r.integers(w)), int(r.integers(h))
        x = (x + phase * 2) % w
        ln = int(r.integers(2, 4))
        for i in range(ln):
            s.px((x + i) % w, y, W[3])
        if r.random() < 0.3:
            s.px((x + 1) % w, (y - 1) % h, W[4])
    for _ in range(w * h // 24):
        s.px(int(r.integers(w)), int(r.integers(h)), W[1])
    return s


def tex_asphalt(rng, w=TILE, h=TILE):
    s = S(w, h, A[2])
    for _ in range(w * h // 12):
        s.px(int(rng.integers(w)), int(rng.integers(h)), A[1] if rng.random() < 0.5 else A[3])
    return s


def tex_sidewalk(rng, w=TILE, h=TILE):
    s = S(w, h, SW[2])
    for y in range(h):
        for x in range(w):
            if x % 8 == 7 or y % 8 == 7:
                s.px(x, y, SW[1])
            elif x % 8 == 0 or y % 8 == 0:
                s.px(x, y, SW[3])
    for _ in range(w * h // 30):
        x, y = int(rng.integers(w)), int(rng.integers(h))
        if s.get(x, y)[:3] == SW[2][:3]:
            s.px(x, y, SW[1] if rng.random() < 0.5 else SW[3])
    return s


def tex_paving(rng, w=TILE, h=TILE):
    s = S(w, h, PV[2])
    for y in range(h):
        row = y // 4
        for x in range(w):
            off = 4 if row % 2 else 0
            if y % 4 == 3 or (x + off) % 8 == 7:
                s.px(x, y, PV[0] if y % 4 == 3 else PV[1])
            elif y % 4 == 0:
                s.px(x, y, PV[3])
    for _ in range(w * h // 20):
        x, y = int(rng.integers(w)), int(rng.integers(h))
        if s.get(x, y)[:3] == PV[2][:3]:
            s.px(x, y, PV[1])
    return s


# ---------------------------------------------------------- autotiles --

def autotile(inner_tex, outer_tex, rng, inset=4, radius=5, edge='soft', inner_rim=None, outer_rim=None):
    """Return 13 tiles: 3x3 outer block (TL,T,TR,L,C,R,BL,B,BR) then 4 inner corners
    (inner-TL, inner-TR, inner-BL, inner-BR). The inner terrain sits inside an
    `inset`-px margin of the outer terrain."""
    tiles = []
    # outer block: 48x48, inner terrain = rounded rect inset from edges
    big_in, big_out = inner_tex(rng, 48, 48), outer_tex(rng, 48, 48)
    m = big_in.rrect_mask(inset, inset, 48 - 2 * inset, 48 - 2 * inset, radius)
    blk = _compose(big_in, big_out, m, inner_rim, outer_rim, edge)
    for ty in range(3):
        for tx in range(3):
            tiles.append(blk.crop(tx * 16, ty * 16, 16, 16))
    # inner corners: 32x32 inner terrain with an outer-terrain hole at center
    big_in, big_out = inner_tex(rng, 32, 32), outer_tex(rng, 32, 32)
    hole = big_in.rrect_mask(16 - inset, 16 - inset, 2 * inset, 2 * inset, min(radius, inset))
    blk = _compose(big_in, big_out, ~hole, inner_rim, outer_rim, edge)
    # quadrant of the hole sits in: BR of TL tile -> that's the tile where outer is at its BR
    q = {'BR': blk.crop(0, 0, 16, 16), 'BL': blk.crop(16, 0, 16, 16),
         'TR': blk.crop(0, 16, 16, 16), 'TL': blk.crop(16, 16, 16, 16)}
    tiles += [q['TL'], q['TR'], q['BL'], q['BR']]
    return tiles


def _compose(inn, out, m, inner_rim, outer_rim, edge):
    s = out.copy()
    s.a[m] = inn.a[m]
    H, Wd = m.shape
    pad = np.pad(m, 1, mode='edge')
    nb_out = ~pad[:-2, 1:-1] | ~pad[2:, 1:-1] | ~pad[1:-1, :-2] | ~pad[1:-1, 2:]
    nb_in = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    rim_in = m & nb_out
    rim_out = ~m & nb_in
    if inner_rim is not None:
        s.a[rim_in] = inner_rim
    if outer_rim is not None:
        s.a[rim_out] = outer_rim
    if edge == 'water':
        # light foam one pixel further inside, dark bank below the top edge
        pad2 = np.pad(rim_in, 1)
        foam = m & ~rim_in & (pad2[:-2, 1:-1] | pad2[2:, 1:-1] | pad2[1:-1, :-2] | pad2[1:-1, 2:])
        s.a[foam] = W[3]
    if edge == 'curb':
        # 2px raised curb on the sidewalk side + drop shadow onto the road below
        pad2 = np.pad(rim_in, 1)
        second = m & ~rim_in & (pad2[:-2, 1:-1] | pad2[2:, 1:-1] | pad2[1:-1, :-2] | pad2[1:-1, 2:])
        s.a[rim_in] = SW[4]
        s.a[second] = SW[3]
        shadow_rows = rim_out & np.roll(m, 1, axis=0)
        s.a[shadow_rows] = A[0]
    return s


def autotile_sheet(tiles, extra):
    """Lay out an autotile set: 3x3 block, 2x2 inner corners, extras below."""
    sheet = S(80, 48 + 16 * ((len(extra) + 4) // 5))
    for i, t in enumerate(tiles[:9]):
        sheet.blit(t, (i % 3) * 16, (i // 3) * 16)
    for i, t in enumerate(tiles[9:]):
        sheet.blit(t, 48 + (i % 2) * 16, (i // 2) * 16)
    for i, t in enumerate(extra):
        sheet.blit(t, (i % 5) * 16, 48 + (i // 5) * 16)
    return sheet


# --------------------------------------------------------- road pieces --

def road_tiles(rng):
    out = {}
    base = lambda: tex_asphalt(rng)
    out['asphalt'] = base()
    out['asphalt_2'] = base()
    t = base()
    for x in range(0, 16):
        if x % 8 < 5:
            t.rect(x, 7, 1, 2, WHITE)
    out['dash_h'] = t
    t = base()
    for y in range(0, 16):
        if y % 8 < 5:
            t.rect(7, y, 2, 1, WHITE)
    out['dash_v'] = t
    t = base(); t.hline(0, 6, 16, YELLOW); t.hline(0, 9, 16, YELLOW); out['double_yellow_h'] = t
    t = base(); t.vline(6, 0, 16, YELLOW); t.vline(9, 0, 16, YELLOW); out['double_yellow_v'] = t
    t = base()
    for y in range(1, 16, 4):
        t.rect(1, y, 14, 2, WHITE)
    out['crosswalk_v'] = t
    t = base()
    for x in range(1, 16, 4):
        t.rect(x, 1, 2, 14, WHITE)
    out['crosswalk_h'] = t
    t = base(); t.hline(0, 0, 16, WHITE); out['edge_line_top'] = t
    t = base(); t.hline(0, 15, 16, WHITE); out['edge_line_bottom'] = t
    t = base(); t.vline(0, 0, 16, WHITE); out['parking_left'] = t
    t = base(); t.rect(0, 12, 16, 2, WHITE); out['stop_line'] = t
    t = base()  # arrow up
    t.rect(7, 6, 2, 8, WHITE)
    for i in range(4):
        t.hline(7 - i, 3 + i, 2 + 2 * i, WHITE)
    out['arrow_up'] = t
    t = base()  # manhole
    t.ellipse(8, 8, 6, 6, A[0]); t.ellipse(8, 8, 5, 5, A[1])
    for y in range(4, 13, 2):
        t.hline(5, y, 6, A[0])
    t.px(6, 5, A[3]); t.px(7, 4, A[3])
    out['manhole'] = t
    t = base()  # storm drain
    t.rect(3, 5, 10, 6, A[0])
    for x in range(4, 12, 2):
        t.vline(x, 6, 4, A[1])
    out['drain'] = t
    t = base()  # cracked
    for (x0, y0, x1, y1) in ((2, 3, 6, 7), (6, 7, 5, 11), (6, 7, 10, 9), (10, 9, 13, 8)):
        t.line(x0, y0, x1, y1, A[0])
    out['cracked'] = t
    return out
