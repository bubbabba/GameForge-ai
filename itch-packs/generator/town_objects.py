"""Buildings, street props and vehicles for the town pack."""
import numpy as np

from core import S, draw_text, hx, ramp, shadow, shift, text_width, with_alpha, light_shade

WOOD = ramp('#a8703c')
METAL = ramp('#8c98aa')
GLASS = ramp('#86c8ea')
STONE = ramp('#9a96a0')
LEAF = ramp('#4e9e3e')
PINE = ramp('#2f7c52')
TRUNK = ramp('#7a5034')
WHITE = ramp('#eeeae0')
RED = ramp('#d8443e')
LIGHT = hx('#fff6b0')

WALLS = {'cream': '#ead8b0', 'sky': '#9ec6dc', 'rose': '#e8aaa0', 'mint': '#b6d8a2',
         'white': '#efeee6', 'brick': '#b85c48', 'sand': '#d8b884', 'lilac': '#b8a8d8'}
ROOFS = {'red': '#c84e48', 'blue': '#4a6aa8', 'green': '#5a8c52', 'slate': '#5e5a6e',
         'orange': '#d8883e', 'teal': '#3a8c90', 'brown': '#7a5444'}


# ------------------------------------------------------------ buildings --

def _wall(s, x, y, w, h, R, style, rng):
    s.rect(x, y, w, h, R[2])
    if style == 'siding':
        for yy in range(y + 2, y + h, 3):
            s.hline(x, yy, w, R[1])
    elif style == 'brick':
        for yy in range(y, y + h):
            row = (yy - y) // 3
            if (yy - y) % 3 == 2:
                s.hline(x, yy, w, R[1])
            else:
                for xx in range(x, x + w):
                    if (xx - x + (3 if row % 2 else 0)) % 6 == 5:
                        s.px(xx, yy, R[1])
        for _ in range(w * h // 25):
            s.px(x + int(rng.integers(w)), y + int(rng.integers(h)), R[3])
    else:  # plaster
        for _ in range(w * h // 14):
            s.px(x + int(rng.integers(w)), y + int(rng.integers(h)), R[1] if rng.random() < .5 else R[3])
    s.vline(x + w - 1, y, h, R[1])


def _window(s, x, y, w=10, h=10, frame=WHITE, shutters=None, box=False, lit=False):
    G = GLASS if not lit else ramp('#f4d870')
    s.rect(x, y, w, h, frame[2])
    s.rect(x + 1, y + 1, w - 2, h - 2, G[2])
    s.rect(x + 1, y + 1, w - 2, 2, G[1])  # top shadow inside frame
    for i in range(3):  # diagonal glint
        s.px(x + 2 + i, y + h - 3 - i, G[4])
        s.px(x + 3 + i, y + h - 3 - i, G[3])
    s.vline(x + w // 2, y + 1, h - 2, frame[2])
    s.hline(x + 1, y + h // 2, w - 2, frame[2])
    s.hline(x - 1, y + h, w + 2, frame[1])  # sill
    if shutters is not None:
        for sx in (x - 3, x + w):
            s.rect(sx, y, 3, h, shutters[2])
            s.vline(sx + 2 if sx < x else sx, y, h, shutters[1])
            for yy in range(y + 1, y + h, 2):
                s.hline(sx, yy, 3, shutters[1])
    if box:
        s.rect(x - 1, y + h + 1, w + 2, 3, WOOD[1])
        for i in range(0, w + 2, 2):
            c = hx(['#f06a7a', '#f8d048', '#ffffff', '#b07af0'][i // 2 % 4])
            s.px(x - 1 + i, y + h, c)
            s.px(x + i, y + h, LEAF[2])


def _door(s, x, y, w, h, R, glass=True, double=False):
    s.rect(x - 1, y - 1, w + 2, h + 1, WHITE[2])
    s.rect(x, y, w, h, R[2])
    s.vline(x + w - 1, y, h, R[1])
    if double:
        s.vline(x + w // 2, y, h, R[0])
        if glass:
            s.rect(x + 1, y + 1, w // 2 - 2, h - 3, GLASS[2])
            s.rect(x + w // 2 + 1, y + 1, w // 2 - 2, h - 3, GLASS[2])
            s.px(x + 2, y + 2, GLASS[4]); s.px(x + w // 2 + 2, y + 2, GLASS[4])
    else:
        if glass:
            s.rect(x + 2, y + 2, w - 4, 4, GLASS[2])
            s.px(x + 2, y + 2, GLASS[4])
        s.rect(x + 2, y + 8, w - 4, h - 10, R[3]) if h > 12 else None
        s.px(x + w - 3, y + h // 2 + 1, hx('#f0d060'))
    s.rect(x - 2, y + h, w + 4, 2, STONE[3])
    s.hline(x - 2, y + h + 1, w + 4, STONE[1])


def _roof_gable(s, x, y, w, h, R, rng, chimney=False, dormer=False):
    s.rect(x, y, w, h, R[2])
    for row, yy in enumerate(range(y + 3, y + h - 2, 3)):
        s.hline(x, yy, w, R[1])
        off = 2 if row % 2 else 0
        for xx in range(x + off, x + w, 4):
            s.px(xx, yy - 1, R[1])
            s.px(xx + 1, yy - 2, R[3])
    s.rect(x, y, w, 2, R[3])  # ridge
    s.hline(x, y, w, R[4])
    s.rect(x, y + h - 2, w, 2, R[0])  # eave
    s.hline(x, y + h - 2, w, R[1])
    if chimney:
        cx = x + w - 14
        B = ramp(WALLS['brick'])
        s.rect(cx, y - 2, 7, 9, B[2])
        s.vline(cx + 6, y - 2, 9, B[1])
        s.hline(cx, y + 2, 7, B[1])
        s.rect(cx - 1, y - 3, 9, 2, STONE[2])
    if dormer:
        dx = x + w // 2 - 7
        s.rect(dx, y + 4, 14, h - 8, WHITE[2])
        s.poly([(dx - 2, y + 5), (dx + 7, y + 1), (dx + 16, y + 5)], R[1])
        _window(s, dx + 3, y + 6, 8, h - 13 if h - 13 > 4 else 5)


def _roof_flat(s, x, y, w, h, rng):
    s.rect(x, y, w, h, STONE[1])
    s.rect(x + 2, y + 2, w - 4, h - 4, STONE[2])
    for _ in range(w * h // 18):
        s.px(x + 2 + int(rng.integers(w - 4)), y + 2 + int(rng.integers(h - 4)), STONE[3])
    s.hline(x, y, w, STONE[3])
    s.rect(x, y + h - 2, w, 2, STONE[0])


def _awning(s, x, y, w, c1, c2):
    for xx in range(x, x + w):
        c = c1 if (xx - x) // 3 % 2 == 0 else c2
        s.vline(xx, y, 5, c[2])
        s.px(xx, y, c[3])
        s.px(xx, y + 5, c[1] if (xx - x) % 3 != 1 else CLEAR_ROW)
    s.hline(x, y + 4, w, shift(c1[1], dv=-0.05))


CLEAR_ROW = (0, 0, 0, 0)


def _sign(s, x, y, text, bg, fg):
    tw = text_width(text)
    w = tw + 6
    s.rect(x - w // 2, y, w, 9, bg[2])
    s.hline(x - w // 2, y, w, bg[3])
    s.hline(x - w // 2, y + 8, w, bg[1])
    draw_text(s, x - tw // 2, y + 2, text, fg)


def house(rng, wt=3, wall='cream', roof='red', style='siding', chimney=True, dormer=False,
          shutters=None, boxes=False, door_col=None):
    W, roof_h, wall_h = wt * 16, 24, 24
    s = S(W, roof_h + wall_h + 8)
    R, RR = ramp(WALLS[wall]), ramp(ROOFS[roof])
    wy = roof_h
    _wall(s, 1, wy, W - 2, wall_h + 8, R, style, rng)
    s.rect(1, wy + wall_h + 6, W - 2, 2, STONE[1])  # foundation
    s.rect(1, wy, W - 2, 2, with_alpha(R[0], 255))   # eave shadow
    _roof_gable(s, 0, 0, W, roof_h + 2, RR, rng, chimney, dormer)
    dc = door_col if door_col is not None else wt // 2
    for col in range(wt):
        cx = col * 16 + 8
        if col == dc:
            _door(s, cx - 5, wy + 12, 10, 18, ramp(['#c84e48', '#4a6aa8', '#5a8c52', '#7a5444'][int(rng.integers(4))]))
        else:
            _window(s, cx - 5, wy + 8, 10, 11, shutters=ramp(shutters) if shutters else None, box=boxes)
    return s


def shop(rng, wt=4, wall='white', name='CAFE', aw=('#d8443e', '#efeee6'), style='plaster', roof='flat'):
    W = wt * 16
    roof_h, wall_h = 12, 40
    s = S(W, roof_h + wall_h + 4)
    R = ramp(WALLS[wall])
    _wall(s, 1, roof_h, W - 2, wall_h + 4, R, style, rng)
    s.rect(1, roof_h + wall_h + 2, W - 2, 2, STONE[1])
    if roof == 'flat':
        _roof_flat(s, 0, 0, W, roof_h + 2, rng)
    else:
        _roof_gable(s, 0, 0, W, roof_h + 2, ramp(ROOFS[roof]), rng)
    s.rect(1, roof_h + 2, W - 2, 1, R[0])
    _sign(s, W // 2, roof_h + 4, name, ramp('#3a3e4e'), hx('#f8e8b0'))
    _awning(s, 3, roof_h + 15, W - 6, ramp(aw[0]), ramp(aw[1]))
    # display windows either side of door
    dw = 12
    dx = W // 2 - dw // 2
    _door(s, dx, roof_h + 22, dw, 18, ramp('#4a5a6a'), double=True)
    lw = dx - 6
    if lw > 6:
        for wx in (3, dx + dw + 3):
            ww = lw if wx == 3 else W - 3 - wx
            s.rect(wx, roof_h + 22, ww, 14, WHITE[2])
            s.rect(wx + 1, roof_h + 23, ww - 2, 12, GLASS[2])
            s.rect(wx + 1, roof_h + 23, ww - 2, 3, GLASS[1])
            for i in range(4):
                s.px(wx + 2 + i, roof_h + 33 - i, GLASS[4])
            s.hline(wx - 1, roof_h + 36, ww + 2, R[0])
    return s


def apartment(rng, wt=4, floors=3, wall='brick', style='brick'):
    W = wt * 16
    roof_h, floor_h = 10, 16
    H = roof_h + floors * floor_h + 14
    s = S(W, H)
    R = ramp(WALLS[wall])
    _wall(s, 1, roof_h, W - 2, H - roof_h, R, style, rng)
    _roof_flat(s, 0, 0, W, roof_h + 2, rng)
    # AC unit on roof
    s.rect(W - 14, 2, 9, 6, METAL[2]); s.hline(W - 14, 2, 9, METAL[3])
    for i in range(3):
        s.hline(W - 13, 4 + i, 7, METAL[1] if i % 2 else METAL[2])
    for fl in range(floors):
        y = roof_h + 3 + fl * floor_h
        s.hline(1, y + floor_h - 2, W - 2, R[3])
        for col in range(wt):
            _window(s, col * 16 + 3, y, 10, 10, lit=rng.random() < 0.2)
    y = roof_h + floors * floor_h
    s.rect(1, H - 2, W - 2, 2, STONE[1])
    _door(s, W // 2 - 7, H - 15, 14, 13, ramp('#4a5a6a'), double=True)
    s.rect(W // 2 - 10, y - 1, 20, 3, ramp('#3a3e4e')[2])  # entry canopy
    s.hline(W // 2 - 10, y + 1, 20, ramp('#3a3e4e')[1])
    return s


def garage(rng, wall='white', roof='slate'):
    W = 32
    s = S(W, 48)
    R = ramp(WALLS[wall])
    _wall(s, 1, 18, W - 2, 30, R, 'siding', rng)
    _roof_gable(s, 0, 0, W, 20, ramp(ROOFS[roof]), rng)
    s.rect(4, 26, 24, 20, WHITE[1])
    for y in range(27, 46, 3):
        s.hline(5, y, 22, WHITE[3]); s.hline(5, y + 1, 22, WHITE[2])
    s.rect(1, 46, W - 2, 2, STONE[1])
    return s


# ---------------------------------------------------------------- props --

def tree_round(rng, big=True, leaf=None, fruit=None):
    L = ramp(leaf) if leaf else LEAF
    w, h = (32, 48) if big else (16, 32)
    s = shadow(w, h, w / 2, h - 3, w * 0.38, 3)
    tw = 4 if big else 2
    th = 14 if big else 9
    tx = w // 2 - tw // 2
    s.rect(tx, h - 3 - th, tw, th, TRUNK[2])
    s.vline(tx + tw - 1, h - 3 - th, th, TRUNK[1])
    s.px(tx, h - 4, TRUNK[1]); s.px(tx + tw, h - 4, TRUNK[1])
    cy = h * 0.38
    r = w * 0.42
    m = s.ellipse_mask(w / 2, cy, r, r * 0.92)
    for (dx, dy, rr) in ((-0.55, 0.25, 0.55), (0.55, 0.25, 0.55), (0, 0.45, 0.6), (-0.3, -0.45, 0.5), (0.35, -0.4, 0.5)):
        m |= s.ellipse_mask(w / 2 + dx * r, cy + dy * r, rr * r, rr * r * 0.9)
    light_shade(s, m, L, w * 0.35, cy - r * 0.55, r * 0.55)
    # leaf clumps
    for _ in range(int(r * 2)):
        x, y = int(rng.integers(w)), int(rng.integers(h))
        if m[y, x] and m[min(h - 1, y + 1), x]:
            s.px(x, y, L[min(4, int(s.a[y, x][1] > L[3][1]) + 3)])
            s.px(x, y + 1, L[1])
    if fruit:
        for _ in range(5 if big else 2):
            for _t in range(30):
                x, y = int(rng.integers(w)), int(rng.integers(h))
                if m[y, x]:
                    s.px(x, y, hx(fruit)); s.px(x, y - 1, hx('#ffffff'))
                    break
    return s.outline()


def tree_pine(rng, big=True):
    w, h = (32, 48) if big else (16, 32)
    s = shadow(w, h, w / 2, h - 3, w * 0.32, 3)
    th = 7 if big else 5
    s.rect(w // 2 - 2, h - 3 - th, 4 if big else 3, th, TRUNK[2])
    s.vline(w // 2 + 1, h - 3 - th, th, TRUNK[1])
    tiers = 3
    top, bottom = 2, h - 3 - th + 2
    seg = (bottom - top) / tiers
    for i in range(tiers):
        y0 = top + i * seg * 0.85
        y1 = top + (i + 1) * seg + 2
        half = (w / 2 - 1) * (0.5 + 0.5 * (i + 1) / tiers)
        m = s.poly_mask([(w / 2, y0), (w / 2 - half, y1), (w / 2 + half, y1)])
        s.a[m] = PINE[2]
        yy, xx = np.mgrid[0:h, 0:w]
        s.a[m & (xx < w / 2 - 1) & (yy < y1 - 2)] = PINE[3]
        s.a[m & (yy >= y1 - 2)] = PINE[1]
        s.a[m & (xx > w / 2 + half * 0.4) & (yy >= y1 - 4)] = PINE[0]
    s.px(w // 2 - 1, 3, PINE[4])
    return s.outline()


def bush(rng, flowers=None):
    s = shadow(16, 16, 8, 13, 7, 2.5)
    m = s.ellipse_mask(8, 9, 7, 5.5) | s.ellipse_mask(5, 7, 4, 4) | s.ellipse_mask(11, 7, 4, 4)
    light_shade(s, m, LEAF, 5, 4, 3)
    if flowers:
        for _ in range(6):
            x, y = int(rng.integers(3, 13)), int(rng.integers(4, 12))
            if m[y, x]:
                s.px(x, y, hx(flowers)); s.px(x, y - 1, hx('#ffffff') if rng.random() < .3 else hx(flowers))
    return s.outline()


def hedge(rng):
    s = S(16, 16)
    s.rect(0, 3, 16, 12, LEAF[2])
    s.rect(0, 3, 16, 3, LEAF[3]); s.hline(0, 3, 16, LEAF[4])
    s.rect(0, 12, 16, 3, LEAF[1])
    for _ in range(20):
        x, y = int(rng.integers(16)), int(rng.integers(5, 13))
        s.px(x, y, LEAF[1] if rng.random() < .5 else LEAF[3])
    s.hline(0, 15, 16, LEAF[0])
    return s


def flower_bed(rng):
    s = S(16, 16)
    s.rect(1, 6, 14, 9, ramp('#6a4a32')[2])
    s.hline(1, 6, 14, ramp('#6a4a32')[3])
    s.frame(0, 5, 16, 11, STONE[2])
    s.hline(0, 15, 16, STONE[1])
    for x in range(2, 14, 3):
        c = ramp(['#f06a7a', '#f8d048', '#b07af0', '#ffffff'][x % 4])
        s.px(x, 9, LEAF[2]); s.px(x, 10, LEAF[1])
        s.px(x, 8, c[2]); s.px(x - 1, 8, c[3]); s.px(x + 1, 8, c[1]); s.px(x, 7, c[3])
    for x in range(3, 14, 3):
        s.px(x, 12, LEAF[2]); s.px(x, 11, ramp('#f06a7a')[2])
    return s


def bench(rng):
    s = shadow(32, 16, 16, 14, 14, 2)
    for y in (3, 6):
        s.rect(1, y, 30, 2, WOOD[2]); s.hline(1, y, 30, WOOD[3])
    s.rect(1, 9, 30, 3, WOOD[2]); s.hline(1, 9, 30, WOOD[4]); s.hline(1, 11, 30, WOOD[1])
    for x in (3, 27):
        s.rect(x, 2, 2, 13, METAL[1]); s.vline(x, 2, 13, METAL[2])
    return s.outline()


def lamp(rng):
    s = shadow(16, 48, 8, 45, 4, 1.5)
    s.rect(7, 8, 2, 37, METAL[1]); s.vline(7, 8, 37, METAL[2])
    s.rect(5, 42, 6, 3, METAL[1]); s.hline(5, 42, 6, METAL[3])
    s.rect(4, 3, 8, 3, ramp('#3a3e4e')[2])
    s.rect(5, 6, 6, 4, LIGHT); s.hline(5, 9, 6, hx('#f8d870'))
    s.rect(6, 1, 4, 2, ramp('#3a3e4e')[2])
    s.outline()
    glow = S(16, 48)
    glow.ellipse(8, 9, 8, 6, (255, 240, 160, 50))
    glow.blit(s, 0, 0)
    return glow


def trash_can(rng, color='#4a8a5a'):
    C = ramp(color)
    s = shadow(16, 16, 8, 14, 6, 2)
    s.rect(3, 4, 10, 10, C[2]); s.vline(12, 4, 10, C[1]); s.vline(3, 4, 10, C[3])
    for x in (5, 8, 11):
        s.vline(x, 6, 7, C[1])
    s.rect(2, 2, 12, 3, C[3]); s.hline(2, 2, 12, C[4]); s.hline(2, 4, 12, C[1])
    s.rect(6, 1, 4, 1, METAL[2])
    return s.outline()


def hydrant(rng):
    s = shadow(16, 16, 8, 14, 5, 2)
    s.rect(5, 5, 6, 9, RED[2]); s.vline(10, 5, 9, RED[1]); s.vline(5, 5, 9, RED[3])
    s.rect(3, 7, 10, 3, RED[2]); s.hline(3, 7, 10, RED[3]); s.hline(3, 9, 10, RED[1])
    s.ellipse(8, 4.5, 3, 2.5, RED[3]); s.px(7, 3, RED[4])
    s.rect(4, 13, 8, 2, RED[1])
    s.px(8, 8, METAL[3])
    return s.outline()


def mailbox(rng):
    C = ramp('#3a62b8')
    s = shadow(16, 32, 8, 29, 6, 2)
    s.rect(3, 10, 10, 13, C[2]); s.vline(12, 10, 13, C[1]); s.vline(3, 10, 13, C[3])
    s.ellipse(8, 10, 5, 3, C[3]); s.rect(3, 10, 10, 1, C[3])
    s.rect(5, 13, 6, 2, C[0])
    s.rect(4, 23, 2, 6, C[0]); s.rect(10, 23, 2, 6, C[0])
    s.rect(6, 17, 4, 3, WHITE[2])
    return s.outline()


def cone(rng):
    O = ramp('#f07a2a')
    s = shadow(16, 16, 8, 14, 6, 2)
    s.poly([(8, 2), (4, 13), (12, 13)], O[2])
    s.hline(5, 8, 6, WHITE[3]); s.hline(5, 9, 6, WHITE[2])
    s.line(8, 3, 6, 12, O[3])
    s.rect(2, 13, 12, 2, O[1])
    return s.outline()


def sign_stop(rng):
    s = shadow(16, 32, 8, 30, 3, 1.5)
    s.rect(7, 12, 2, 18, METAL[1]); s.vline(7, 12, 18, METAL[2])
    m = s.poly_mask([(5, 1), (10, 1), (14, 5), (14, 10), (10, 14), (5, 14), (1, 10), (1, 5)])
    s.a[m] = RED[2]
    s.poly([(5, 2), (10, 2), (13, 5), (13, 6), (2, 6), (2, 5)], RED[3])
    s.rect(3, 7, 10, 2, WHITE[3])
    return s.outline()


def traffic_light(rng):
    s = shadow(16, 48, 8, 46, 3, 1.5)
    s.rect(7, 18, 2, 27, METAL[1]); s.vline(7, 18, 27, METAL[2])
    D = ramp('#2e3240')
    s.rect(4, 1, 8, 18, D[2]); s.vline(11, 1, 18, D[1]); s.hline(4, 1, 8, D[3])
    for i, c in enumerate(('#e84a3a', '#f0c030', '#4ad06a')):
        C = ramp(c)
        on = i == 0
        s.ellipse(8, 4.5 + i * 5, 2.5, 2.2, C[3] if on else C[0])
        if on:
            s.px(7, 3, hx('#ffffff'))
    return s.outline()


def vending(rng, color='#d8443e'):
    C = ramp(color)
    s = shadow(16, 32, 8, 30, 7, 2)
    s.rect(1, 3, 14, 26, C[2]); s.vline(14, 3, 26, C[1]); s.hline(1, 3, 14, C[3])
    s.rect(3, 5, 8, 13, ramp('#d8f0ff')[2])
    for y in range(6, 17, 4):
        for x in range(4, 10, 2):
            s.rect(x, y, 1, 3, hx(['#f05050', '#50a0f0', '#f0d040'][(x + y) % 3]))
    s.rect(12, 6, 2, 8, C[0])
    for y in range(7, 13, 2):
        s.px(12, y, hx('#f0e070'))
    s.rect(3, 21, 8, 4, C[0]); s.hline(3, 21, 8, ramp('#202030')[2])
    return s.outline()


def bus_stop(rng):
    s = shadow(48, 48, 24, 45, 22, 3)
    s.rect(2, 4, 44, 4, ramp('#3a62b8')[2]); s.hline(2, 4, 44, ramp('#3a62b8')[3])
    s.hline(2, 7, 44, ramp('#3a62b8')[1])
    for x in (3, 44):
        s.rect(x, 8, 2, 36, METAL[1]); s.vline(x, 8, 36, METAL[2])
    gl = with_alpha(GLASS[3], 150)
    s.rect(5, 9, 39, 22, gl)
    for i in range(6):
        s.px(8 + i, 26 - i, with_alpha(GLASS[4], 220)); s.px(9 + i, 26 - i, with_alpha(GLASS[4], 200))
    s.rect(8, 33, 32, 3, WOOD[2]); s.hline(8, 33, 32, WOOD[3]); s.hline(8, 35, 32, WOOD[1])
    for x in (10, 37):
        s.rect(x, 36, 2, 7, METAL[1])
    s.rect(29, 11, 13, 14, WHITE[2]); draw_text(s, 30, 13, 'BUS', ramp('#3a62b8')[2])
    s.rect(30, 20, 11, 3, ramp('#f0c030')[2])
    s.outline()
    return s


def picnic_table(rng):
    s = shadow(32, 32, 16, 26, 15, 4)
    s.rect(2, 6, 28, 3, WOOD[2]); s.hline(2, 6, 28, WOOD[3])
    s.rect(4, 10, 24, 10, WOOD[2])
    for y in (10, 13, 16):
        s.hline(4, y, 24, WOOD[3])
    s.hline(4, 19, 24, WOOD[1])
    s.rect(2, 21, 28, 3, WOOD[2]); s.hline(2, 21, 28, WOOD[3]); s.hline(2, 23, 28, WOOD[1])
    for x in (6, 24):
        s.rect(x, 24, 2, 4, WOOD[0])
    return s.outline()


def fountain(rng):
    s = shadow(48, 48, 24, 40, 22, 6)
    s.ellipse(24, 32, 22, 11, STONE[2])
    s.ellipse(24, 31, 22, 10, STONE[3])
    s.ellipse(24, 31, 19, 8, ramp('#4aa4dc')[2])
    s.ellipse(24, 29, 17, 5, ramp('#4aa4dc')[3])
    for i in range(10):
        a = i / 10 * 6.28
        s.px(int(24 + np.cos(a) * 15), int(31 + np.sin(a) * 5), ramp('#4aa4dc')[4])
    s.rect(21, 14, 6, 16, STONE[2]); s.vline(26, 14, 16, STONE[1])
    s.ellipse(24, 14, 7, 3, STONE[3]); s.ellipse(24, 13, 5, 2, ramp('#4aa4dc')[3])
    WA = ramp('#9ad8f8')
    for dx in (-6, -3, 3, 6):
        s.line(24, 9, 24 + dx, 13 + abs(dx), WA[3])
    s.rect(23, 4, 2, 9, WA[4])
    return s.outline()


def fence(rng, kind='picket'):
    out = []
    for part in ('left', 'mid', 'right'):
        s = S(16, 16)
        if kind == 'picket':
            s.rect(0, 7, 16, 2, WHITE[2]); s.rect(0, 11, 16, 2, WHITE[2])
            if part == 'left':
                s.rect(0, 0, 0, 0, WHITE[2])
            for x in range(1, 16, 4):
                s.rect(x, 3, 3, 12, WHITE[3]); s.vline(x + 2, 3, 12, WHITE[1]); s.px(x + 1, 2, WHITE[3])
            if part == 'left':
                s.a[:, :1] = 0
            if part == 'right':
                s.a[:, 15:] = 0
        else:  # wooden rail
            for y in (6, 10):
                s.rect(0, y, 16, 2, WOOD[2]); s.hline(0, y, 16, WOOD[3])
            for x in ((0,) if part == 'left' else ()) + (7,) + ((14,) if part == 'right' else ()):
                s.rect(x, 3, 2, 12, WOOD[1]); s.vline(x, 3, 12, WOOD[2])
        s.outline()
        out.append(s)
    return out


def dumpster(rng):
    C = ramp('#3a7a5a')
    s = shadow(32, 32, 16, 29, 15, 3)
    s.rect(2, 10, 28, 16, C[2]); s.vline(29, 10, 16, C[1]); s.hline(2, 25, 28, C[1])
    for x in range(6, 28, 6):
        s.vline(x, 12, 12, C[1])
    s.rect(1, 6, 30, 5, C[3]); s.hline(1, 6, 30, C[4]); s.hline(1, 10, 30, C[1])
    s.rect(3, 26, 3, 3, METAL[0]); s.rect(26, 26, 3, 3, METAL[0])
    return s.outline()


def crate(rng):
    s = S(16, 16)
    s.rect(1, 2, 14, 13, WOOD[2]); s.frame(1, 2, 14, 13, WOOD[1])
    s.line(2, 3, 13, 13, WOOD[1]); s.hline(2, 3, 12, WOOD[3])
    return s.outline()


def planter(rng):
    s = shadow(16, 32, 8, 29, 7, 2)
    s.rect(2, 18, 12, 10, ramp('#c87a50')[2]); s.vline(13, 18, 10, ramp('#c87a50')[1])
    s.rect(1, 17, 14, 2, ramp('#c87a50')[3])
    m = s.ellipse_mask(8, 11, 6, 7) | s.ellipse_mask(5, 14, 4, 3) | s.ellipse_mask(11, 14, 4, 3)
    light_shade(s, m, LEAF, 5, 6, 2.5)
    return s.outline()


def bike_rack(rng):
    s = S(32, 16)
    for x in range(3, 30, 6):
        s.rect(x, 4, 1, 10, METAL[2]); s.rect(x + 4, 4, 1, 10, METAL[1]); s.hline(x, 3, 5, METAL[3])
    s.hline(1, 14, 30, METAL[1])
    return s.outline()


def bicycle(rng, color='#d8443e'):
    C = ramp(color)
    s = shadow(32, 16, 16, 14, 13, 1.5)
    for cx in (7, 25):
        s.ellipse(cx, 10, 5, 5, ramp('#2e2e3a')[2]); s.ellipse(cx, 10, 3.5, 3.5, (0, 0, 0, 0))
        s.px(cx, 10, METAL[2])
    s.line(7, 10, 14, 4, C[2]); s.line(14, 4, 22, 4, C[2]); s.line(22, 4, 25, 10, C[2])
    s.line(14, 4, 16, 10, C[2]); s.line(16, 10, 7, 10, C[1]); s.line(16, 10, 22, 4, C[1])
    s.rect(12, 2, 4, 1, ramp('#2e2e3a')[2]); s.rect(21, 1, 3, 1, METAL[3])
    return s.outline()


def parking_meter(rng):
    s = shadow(16, 32, 8, 29, 3, 1.5)
    s.rect(7, 13, 2, 16, METAL[1])
    s.rect(4, 4, 8, 10, METAL[2]); s.vline(11, 4, 10, METAL[1]); s.hline(4, 4, 8, METAL[3])
    s.rect(5, 6, 6, 3, ramp('#c8f0d8')[2])
    s.px(8, 11, ramp('#f0c030')[2])
    return s.outline()


def newspaper_box(rng):
    C = ramp('#e8b830')
    s = shadow(16, 32, 8, 29, 6, 2)
    s.rect(2, 10, 12, 14, C[2]); s.vline(13, 10, 14, C[1]); s.hline(2, 10, 12, C[3])
    s.rect(4, 12, 8, 6, WHITE[3]); s.hline(5, 14, 6, WHITE[1]); s.hline(5, 16, 4, WHITE[1])
    s.rect(3, 24, 2, 5, METAL[1]); s.rect(11, 24, 2, 5, METAL[1])
    return s.outline()


# ------------------------------------------------------------- vehicles --

def car(kind, d, color):
    """kind: sedan|van|taxi|pickup|police. d: down|up|left|right. 32x32."""
    C = ramp(color)
    T = ramp('#2a2a34')
    s = shadow(32, 32, 16, 27, 13 if d in ('left', 'right') else 10, 4)
    if d in ('left', 'right'):
        L = 2 if kind != 'van' else 1
        Rr = 30 if kind != 'van' else 31
        body_top = 15
        s.rrect(L, body_top, Rr - L, 10, 2, C[2])
        s.hline(L + 1, body_top, Rr - L - 2, C[3])
        s.hline(L, body_top + 8, Rr - L, C[1])
        s.hline(L + 1, body_top + 9, Rr - L - 2, C[0])
        if kind == 'van':
            s.rrect(4, 7, 26, 10, 2, C[2]); s.hline(5, 7, 24, C[3])
            s.rect(22, 9, 6, 6, GLASS[2]); s.rect(6, 9, 14, 5, GLASS[1]); s.vline(13, 9, 5, C[2])
        elif kind == 'pickup':
            s.poly([(16, 8), (25, 8), (28, 15), (14, 15)], C[2])
            s.poly([(17, 9), (24, 9), (26, 14), (17, 14)], GLASS[2])
            s.rect(3, 13, 12, 2, C[1])
        else:
            s.poly([(9, 8), (21, 8), (26, 15), (5, 15)], C[2])
            s.hline(10, 8, 11, C[3])
            s.poly([(10, 9), (15, 9), (15, 14), (7, 14)], GLASS[2])
            s.poly([(17, 9), (21, 9), (24, 14), (17, 14)], GLASS[2])
            s.px(11, 10, GLASS[4]); s.px(18, 10, GLASS[4])
        s.vline(16, body_top + 1, 6, C[1])
        s.px(19, body_top + 3, C[4])
        for wx in (8, 24):
            s.ellipse(wx, 25, 3.6, 3.6, T[2]); s.ellipse(wx, 25, 1.8, 1.8, METAL[3]); s.px(wx - 1, 24, METAL[4])
        s.rect(Rr - 2, body_top + 2, 2, 2, LIGHT)
        s.rect(L, body_top + 2, 2, 2, ramp('#e84a3a')[2])
        if kind == 'taxi':
            s.rect(13, 5, 6, 3, ramp('#f8e8a0')[2]); s.hline(13, 5, 6, WHITE[4])
            for x in range(L + 1, Rr - 1, 4):
                s.rect(x, body_top + 5, 2, 2, T[2])
        if kind == 'police':
            s.rect(12, 5, 3, 3, ramp('#e84a3a')[3]); s.rect(15, 5, 3, 3, ramp('#4a7af0')[3])
            s.rect(L + 1, body_top + 4, Rr - L - 2, 3, WHITE[3])
        if d == 'left':
            s = s.flip_x()
        return s.outline()
    # front/back views
    x0, x1 = 6, 26
    top = 3 if kind == 'van' else 5
    s.rect(x0 - 1, 20, 2, 7, T[2]); s.rect(x1 - 1, 20, 2, 7, T[2])
    s.rrect(x0, top, x1 - x0, 25 - top, 3, C[2])
    s.vline(x1 - 1, top + 2, 20 - top, C[1])
    s.vline(x0, top + 2, 20 - top, C[3])
    front = d == 'down'
    if kind == 'van':
        roof = (top + 1, 13)
        win = (14, 18) if front else (14, 18)
    else:
        roof = (top + (6 if front else 3), 6)
        win = (top + 12, 4) if front else (top + 2, 4)
    if kind != 'pickup' or front:
        s.rect(x0 + 2, roof[0], x1 - x0 - 4, roof[1], C[3])
        s.hline(x0 + 2, roof[0], x1 - x0 - 4, C[4])
    if front:
        wy = roof[0] + roof[1]
        s.poly([(x0 + 2, wy), (x1 - 3, wy), (x1 - 1, wy + 4), (x0, wy + 4)], GLASS[2])
        s.px(x0 + 3, wy + 1, GLASS[4]); s.px(x0 + 4, wy + 1, GLASS[4])
        s.rect(x0, 24, x1 - x0, 3, C[1])
        s.rect(x0 + 1, 22, 3, 2, LIGHT); s.rect(x1 - 4, 22, 3, 2, LIGHT)
        s.rect(x0 + 6, 23, x1 - x0 - 12, 2, T[1])
        if kind == 'pickup':
            pass
        rear_win_y = top + 2
        s.rect(x0 + 3, rear_win_y, x1 - x0 - 6, 2, GLASS[1])
    else:
        if kind == 'pickup':
            s.rect(x0 + 2, top + 2, x1 - x0 - 4, 11, C[1])
            s.rect(x0 + 3, top + 3, x1 - x0 - 6, 9, T[1])
            s.rect(x0 + 2, top + 13, x1 - x0 - 4, 4, C[3])
            s.rect(x0 + 3, top + 14, x1 - x0 - 6, 2, GLASS[1])
        else:
            wy = roof[0] + roof[1]
            s.poly([(x0 + 1, wy), (x1 - 2, wy), (x1 - 3, wy + 3), (x0 + 2, wy + 3)], GLASS[1])
            s.px(x0 + 3, wy, GLASS[3])
            s.rect(x0 + 2, top, x1 - x0 - 4, 2, GLASS[1]) if kind != 'van' else None
        s.rect(x0, 24, x1 - x0, 3, C[1])
        s.rect(x0 + 1, 21, 3, 2, ramp('#e84a3a')[2]); s.rect(x1 - 4, 21, 3, 2, ramp('#e84a3a')[2])
        s.rect(x0 + 8, 22, x1 - x0 - 16, 2, WHITE[2])
    if kind == 'taxi':
        ty = roof[0] + 1
        s.rect(13, ty, 6, 3, ramp('#f8e8a0')[2])
    if kind == 'police':
        ty = roof[0] + 1
        s.rect(11, ty, 5, 2, ramp('#e84a3a')[3]); s.rect(16, ty, 5, 2, ramp('#4a7af0')[3])
    return s.outline()
