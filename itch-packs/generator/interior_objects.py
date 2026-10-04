"""Floors, walls and furniture for the interiors pack (3/4 top-down, 16px grid)."""
import numpy as np

from core import S, draw_text, hx, light_shade, ramp, shadow, with_alpha

WOOD = ramp('#b07a46')
DARKWOOD = ramp('#7a5034')
LIGHTWOOD = ramp('#d8b07a')
METAL = ramp('#9aa4b4')
WHITE = ramp('#eeeae2')
GLASS = ramp('#86c8ea')
LEAF = ramp('#4e9e3e')
BLACK = ramp('#34323e')
POT = ramp('#c87a50')
FABRIC = {'red': '#c8504a', 'blue': '#4a6ab8', 'green': '#5a9a5a', 'mustard': '#d8a83a',
          'pink': '#e892b0', 'gray': '#8a8a9a', 'teal': '#3a9a9a', 'purple': '#8a6ac0'}


def _sh(w, h, a=60):
    s = S(w, h)
    s.rect(1, h - 3, w - 2, 3, (20, 16, 40, a))
    return s


# --------------------------------------------------------------- floors --

def floor_planks(rng, R):
    s = S(16, 16, R[2])
    for y in range(0, 16, 4):
        s.hline(0, y + 3, 16, R[1])
        off = (y // 4 * 7) % 16
        s.vline((off + 0) % 16, y, 3, R[1])
        s.vline((off + 9) % 16, y, 3, R[1])
        s.hline((off + 1) % 16, y, 4, R[3])
    for _ in range(8):
        x, y = int(rng.integers(16)), int(rng.integers(16))
        if s.get(x, y)[:3] == R[2][:3]:
            s.px(x, y, R[3] if rng.random() < .5 else R[1])
    return s


def floor_checker(rng, c1, c2):
    a, b = ramp(c1), ramp(c2)
    s = S(16, 16)
    for ty in range(2):
        for tx in range(2):
            R = a if (tx + ty) % 2 == 0 else b
            s.rect(tx * 8, ty * 8, 8, 8, R[2])
            s.hline(tx * 8, ty * 8, 8, R[3])
            s.vline(tx * 8 + 7, ty * 8, 8, R[1])
    return s


def floor_tiles(rng, c):
    R = ramp(c)
    s = S(16, 16, R[2])
    for y in range(16):
        for x in range(16):
            if x % 8 == 7 or y % 8 == 7:
                s.px(x, y, R[1])
            elif x % 8 == 0 or y % 8 == 0:
                s.px(x, y, R[3])
    s.px(2, 2, R[4]); s.px(10, 10, R[4])
    return s


def floor_carpet(rng, c):
    R = ramp(c)
    s = S(16, 16, R[2])
    for _ in range(40):
        s.px(int(rng.integers(16)), int(rng.integers(16)), R[1] if rng.random() < .5 else R[3])
    return s


def floor_herringbone(rng, c):
    R = ramp(c)
    s = S(16, 16, R[2])
    for y in range(16):
        for x in range(16):
            k = (x + y) % 8
            j = (x - y) % 8
            if (x // 4 + y // 4) % 2 == 0:
                if k == 0:
                    s.px(x, y, R[1])
            else:
                if j == 0:
                    s.px(x, y, R[1])
            if (x + 2 * y) % 11 == 0:
                s.px(x, y, R[3])
    return s


# ---------------------------------------------------------------- walls --

def wall(rng, c, pattern='plain', accent=None):
    """16x32 wall face: 4px dark cap, wallpaper, wainscot / baseboard."""
    R = ramp(c)
    A = ramp(accent) if accent else R
    s = S(16, 32, R[2])
    if pattern == 'stripes':
        for x in range(0, 16, 4):
            s.vline(x, 4, 24, R[3]); s.vline(x + 1, 4, 24, R[3])
    elif pattern == 'dots':
        for y in range(6, 26, 5):
            for x in range((y // 5 % 2) * 4 + 2, 16, 8):
                s.px(x, y, A[3] if accent else R[4]); s.px(x + 1, y, A[2] if accent else R[3])
    elif pattern == 'wood':
        W = ramp(c)
        for x in range(0, 16, 4):
            s.vline(x + 3, 4, 26, W[1]); s.vline(x, 4, 26, W[3])
    elif pattern == 'brick':
        for y in range(4, 30):
            row = (y - 4) // 4
            if (y - 4) % 4 == 3:
                s.hline(0, y, 16, R[1])
            else:
                for x in range(16):
                    if (x + (4 if row % 2 else 0)) % 8 == 7:
                        s.px(x, y, R[1])
    elif pattern == 'wainscot':
        s.rect(0, 18, 16, 10, A[2])
        s.hline(0, 18, 16, A[4]); s.hline(0, 19, 16, A[3])
        for x in (3, 11):
            s.frame(x - 2, 21, 6, 6, A[1])
    elif pattern == 'tiles':
        for y in range(4, 30):
            for x in range(16):
                if x % 4 == 3 or (y - 4) % 4 == 3:
                    s.px(x, y, R[1])
                elif x % 4 == 0 or (y - 4) % 4 == 0:
                    s.px(x, y, R[3])
    s.rect(0, 0, 16, 4, BLACK[1])  # wall top cap (seen from above)
    s.hline(0, 3, 16, BLACK[2])
    s.rect(0, 4, 16, 1, R[1])       # shadow under the cap
    s.rect(0, 29, 16, 3, WHITE[1] if pattern != 'wood' else DARKWOOD[1])  # baseboard
    s.hline(0, 29, 16, WHITE[3] if pattern != 'wood' else DARKWOOD[3])
    return s


def wall_top():
    s = S(16, 16, BLACK[1])
    s.rect(1, 1, 14, 14, BLACK[2])
    return s


# ------------------------------------------------------------ furniture --

def bed(rng, color, double=False):
    C = ramp(color)
    w = 32 if double else 16
    s = _sh(w, 32)
    s.rect(0, 0, w, 7, DARKWOOD[2]); s.hline(0, 0, w, DARKWOOD[3]); s.hline(0, 6, w, DARKWOOD[1])  # headboard
    s.rect(1, 6, w - 2, 23, WHITE[2])
    for px_ in ([2, 17] if double else [2]):
        s.rrect(px_, 7, 12, 6, 2, WHITE[3]); s.hline(px_ + 1, 12, 10, WHITE[1])
    s.rect(1, 14, w - 2, 15, C[2]); s.hline(1, 14, w - 2, C[3]); s.rect(1, 15, w - 2, 1, C[4])
    s.hline(1, 28, w - 2, C[1])
    for y in range(18, 27, 4):
        s.hline(3, y, w - 6, C[3])
    s.rect(0, 28, w, 2, DARKWOOD[1])
    return s.outline()


def sofa(rng, color, d='down'):
    C = ramp(color)
    s = _sh(32, 24)
    if d == 'down':
        s.rect(1, 2, 30, 9, C[1]); s.hline(1, 2, 30, C[2])        # back
        s.rect(4, 10, 24, 8, C[2]); s.hline(4, 10, 24, C[3])      # seat
        s.vline(16, 10, 8, C[1])
        for x in (0, 27):
            s.rect(x, 7, 5, 13, C[2]); s.hline(x, 7, 5, C[3]); s.vline(x + 4, 7, 13, C[1])
        s.rect(1, 18, 30, 3, C[0])
        s.rect(2, 21, 2, 1, DARKWOOD[1]); s.rect(28, 21, 2, 1, DARKWOOD[1])
    else:  # up (seen from behind)
        s.rect(1, 6, 30, 14, C[1]); s.hline(1, 6, 30, C[2]); s.hline(1, 7, 30, C[3])
        for x in (0, 27):
            s.rect(x, 4, 5, 14, C[2]); s.hline(x, 4, 5, C[3])
        s.rect(1, 19, 30, 2, C[0])
    return s.outline()


def armchair(rng, color):
    C = ramp(color)
    s = _sh(16, 24)
    s.rect(2, 2, 12, 10, C[1]); s.hline(2, 2, 12, C[2])
    s.rect(3, 10, 10, 7, C[2]); s.hline(3, 10, 10, C[3])
    for x in (0, 12):
        s.rect(x, 7, 4, 12, C[2]); s.hline(x, 7, 4, C[3]); s.vline(x + 3, 7, 12, C[1])
    s.rect(1, 18, 14, 3, C[0])
    return s.outline()


def table(rng, w=32, h=32, R=WOOD, cloth=None):
    s = _sh(w, h)
    top_h = h - 10
    s.rect(1, 2, w - 2, top_h, R[2]); s.hline(1, 2, w - 2, R[3]); s.hline(1, 3, w - 2, R[4])
    for y in range(6, top_h, 5):
        s.hline(2, y, w - 4, R[3])
    if cloth:
        Cl = ramp(cloth)
        s.rect(5, 4, w - 10, top_h - 4, Cl[2]); s.hline(5, 4, w - 10, Cl[3])
        for x in range(6, w - 6, 3):
            s.px(x, top_h - 1, Cl[1])
    s.rect(1, top_h + 2, w - 2, 3, R[1])
    for x in (2, w - 5):
        s.rect(x, top_h + 5, 3, h - top_h - 8, R[0])
    return s.outline()


def chair(rng, R=WOOD, d='down', cushion=None):
    s = _sh(16, 24)
    Cu = ramp(cushion) if cushion else R
    if d == 'down':
        s.rect(3, 1, 10, 9, R[2]); s.hline(3, 1, 10, R[3]); s.rect(5, 3, 6, 5, R[1])
        s.rect(2, 10, 12, 4, Cu[2]); s.hline(2, 10, 12, Cu[3])
        s.rect(2, 14, 12, 2, R[1])
        for x in (3, 11):
            s.rect(x, 16, 2, 5, R[0])
    elif d == 'up':
        s.rect(2, 9, 12, 4, Cu[2]); s.hline(2, 9, 12, Cu[3]); s.rect(2, 13, 12, 2, R[1])
        for x in (3, 11):
            s.rect(x, 15, 2, 6, R[0])
        s.rect(3, 4, 10, 10, R[2]); s.hline(3, 4, 10, R[3]); s.vline(12, 4, 10, R[1])
    else:
        s.rect(4, 11, 9, 4, Cu[2]); s.hline(4, 11, 9, Cu[3])
        bx = 3 if d == 'right' else 11
        s.rect(bx, 2, 2, 13, R[2]); s.vline(bx + 1, 2, 13, R[1])
        s.rect(4, 15, 9, 2, R[1])
        for x in (4, 11):
            s.rect(x, 17, 2, 4, R[0])
    return s.outline()


def bookshelf(rng, wide=False):
    w = 32 if wide else 16
    s = _sh(w, 32)
    s.rect(0, 0, w, 30, DARKWOOD[2]); s.hline(0, 0, w, DARKWOOD[3]); s.vline(w - 1, 0, 30, DARKWOOD[1])
    cols = ['#c8504a', '#4a6ab8', '#5a9a5a', '#d8a83a', '#8a6ac0', '#e8e4dc', '#3a9a9a', '#e892b0']
    for sy in (3, 12, 21):
        s.rect(2, sy, w - 4, 8, DARKWOOD[0])
        x = 2
        while x < w - 3:
            bw = int(rng.integers(1, 3))
            bh = int(rng.integers(5, 8))
            if rng.random() < 0.12:
                x += 2
                continue
            B = ramp(cols[int(rng.integers(len(cols)))])
            s.rect(x, sy + 8 - bh, bw, bh, B[2])
            s.px(x, sy + 8 - bh, B[3])
            x += bw
        s.hline(1, sy + 8, w - 2, DARKWOOD[3])
    return s.outline()


def wardrobe(rng, R=WOOD):
    s = _sh(32, 32)
    s.rect(0, 0, 32, 30, R[2]); s.hline(0, 0, 32, R[4]); s.hline(0, 1, 32, R[3])
    s.vline(16, 3, 26, R[0]); s.vline(31, 0, 30, R[1])
    for x in (3, 19):
        s.frame(x, 4, 10, 22, R[1])
    s.rect(14, 13, 1, 4, hx('#f0d060')); s.rect(18, 13, 1, 4, hx('#f0d060'))
    s.rect(1, 28, 30, 2, R[0])
    return s.outline()


def dresser(rng, R=WOOD):
    s = _sh(32, 24)
    s.rect(0, 2, 32, 19, R[2]); s.hline(0, 2, 32, R[4]); s.hline(0, 3, 32, R[3])
    for y in (7, 13):
        s.hline(1, y, 30, R[0])
        for x in (8, 23):
            s.rect(x, y + 2, 2, 1, hx('#f0d060'))
    s.vline(16, 7, 13, R[0])
    s.rect(1, 20, 30, 2, R[0])
    return s.outline()


def nightstand(rng, R=WOOD):
    s = _sh(16, 24)
    s.rect(1, 6, 14, 14, R[2]); s.hline(1, 6, 14, R[4]); s.hline(1, 7, 14, R[3])
    s.hline(2, 12, 12, R[0]); s.rect(7, 14, 2, 1, hx('#f0d060'))
    # little lamp on top
    s.rect(7, 2, 2, 4, METAL[1]); s.poly([(4, 0), (11, 0), (12, 4), (3, 4)], ramp('#f0d890')[2])
    return s.outline()


def tv_stand(rng):
    s = _sh(32, 32)
    s.rect(0, 20, 32, 9, DARKWOOD[2]); s.hline(0, 20, 32, DARKWOOD[3]); s.hline(1, 24, 30, DARKWOOD[0])
    s.rect(3, 2, 26, 16, BLACK[0]); s.rect(4, 3, 24, 14, ramp('#3a5a8a')[1])
    s.line(6, 14, 14, 5, ramp('#3a5a8a')[3]); s.line(8, 15, 16, 6, ramp('#3a5a8a')[2])
    s.rect(14, 18, 4, 2, BLACK[1])
    return s.outline()


def desk_computer(rng):
    s = _sh(32, 32)
    s.rect(0, 12, 32, 8, LIGHTWOOD[2]); s.hline(0, 12, 32, LIGHTWOOD[4]); s.hline(0, 19, 32, LIGHTWOOD[1])
    for x in (1, 28):
        s.rect(x, 20, 3, 9, LIGHTWOOD[1])
    s.rect(8, 1, 16, 11, BLACK[1]); s.rect(9, 2, 14, 8, ramp('#4ab0d8')[2])
    s.hline(10, 4, 8, ramp('#4ab0d8')[4]); s.hline(10, 6, 10, ramp('#4ab0d8')[3])
    s.rect(14, 11, 4, 2, BLACK[0])
    s.rect(9, 15, 12, 3, WHITE[2]); s.hline(9, 15, 12, WHITE[3])
    s.rect(23, 15, 3, 3, WHITE[2])
    return s.outline()


def fridge(rng, color='#e6e4de'):
    C = ramp(color)
    s = _sh(16, 32)
    s.rect(1, 0, 14, 30, C[2]); s.hline(1, 0, 14, C[4]); s.vline(14, 0, 30, C[1])
    s.hline(1, 11, 14, C[0])
    s.rect(11, 4, 1, 5, METAL[1]); s.rect(11, 14, 1, 8, METAL[1])
    s.rect(3, 15, 3, 3, ramp('#f06a7a')[2]); s.rect(6, 17, 2, 2, ramp('#f8d048')[2])
    return s.outline()


def stove(rng):
    s = _sh(16, 32)
    s.rect(0, 10, 16, 20, WHITE[2]); s.hline(0, 10, 16, WHITE[4])
    for (x, y) in ((3, 12), (10, 12), (3, 16), (10, 16)):
        s.ellipse(x + 1.5, y + 1.5, 2.5, 1.8, BLACK[1])
    s.rect(2, 20, 12, 8, BLACK[1]); s.rect(3, 21, 10, 5, ramp('#4a3a3a')[2]); s.hline(3, 21, 10, ramp('#ff8a3a')[2])
    s.hline(3, 19, 10, METAL[2])
    s.rect(1, 2, 14, 7, METAL[2]); s.hline(1, 2, 14, METAL[3]); s.hline(1, 8, 14, METAL[0])  # hood
    return s.outline()


def counter(rng, kind='plain', R=WHITE, top=None):
    T = ramp(top) if top else ramp('#6a6a7a')
    s = _sh(16, 32)
    s.rect(0, 10, 16, 6, T[2]); s.hline(0, 10, 16, T[4]); s.hline(0, 15, 16, T[1])
    s.rect(0, 16, 16, 14, R[2]); s.vline(15, 16, 14, R[1]); s.hline(0, 16, 16, R[0])
    s.frame(2, 18, 12, 10, R[1]); s.rect(6, 20, 4, 1, METAL[2])
    if kind == 'sink':
        s.rect(3, 11, 10, 4, METAL[1]); s.rect(4, 12, 8, 2, METAL[0])
        s.rect(7, 7, 2, 4, METAL[2]); s.rect(7, 7, 4, 1, METAL[3])
    elif kind == 'microwave':
        s.rect(2, 3, 12, 8, BLACK[2]); s.rect(3, 4, 7, 6, ramp('#3a3a4a')[1]); s.px(12, 5, ramp('#4ad06a')[2])
    elif kind == 'coffee':
        s.rect(4, 3, 8, 8, BLACK[2]); s.rect(6, 7, 3, 3, WHITE[3]); s.px(10, 4, ramp('#e84a3a')[2])
    elif kind == 'plant':
        s.rect(6, 7, 4, 4, POT[2])
        s.ellipse(8, 5, 4, 3, LEAF[2]); s.px(7, 4, LEAF[3])
    return s.outline()


def washer(rng):
    s = _sh(16, 24)
    s.rect(1, 2, 14, 19, WHITE[2]); s.hline(1, 2, 14, WHITE[4]); s.vline(14, 2, 19, WHITE[1])
    s.hline(1, 6, 14, WHITE[1]); s.px(11, 4, ramp('#4ad06a')[2]); s.px(3, 4, METAL[1]); s.px(5, 4, METAL[1])
    s.ellipse(8, 13.5, 4.5, 4.5, METAL[1]); s.ellipse(8, 13.5, 3.2, 3.2, ramp('#7ab8e0')[2])
    s.px(6, 12, WHITE[4])
    return s.outline()


def toilet(rng):
    s = _sh(16, 24)
    s.rect(3, 1, 10, 7, WHITE[2]); s.hline(3, 1, 10, WHITE[4]); s.px(11, 3, METAL[2])
    s.ellipse(8, 13, 6, 5, WHITE[2]); s.ellipse(8, 12.5, 4, 3, ramp('#a8d8f0')[2]); s.ellipse(8, 12.5, 4.6, 3.6, WHITE[3])
    s.ellipse(8, 12.5, 3.4, 2.4, ramp('#a8d8f0')[2])
    s.rect(5, 17, 6, 4, WHITE[1])
    return s.outline()


def bathtub(rng):
    s = _sh(32, 24)
    s.rrect(0, 2, 32, 19, 4, WHITE[2]); s.hline(2, 2, 28, WHITE[4])
    s.rrect(3, 5, 26, 11, 3, ramp('#8ac8e8')[2]); s.hline(5, 6, 10, ramp('#8ac8e8')[4])
    s.rect(1, 16, 30, 4, WHITE[1])
    s.rect(26, 3, 3, 2, METAL[2])
    return s.outline()


def bath_sink(rng):
    s = _sh(16, 32)
    s.rect(3, 0, 10, 9, METAL[3]); s.rect(4, 1, 8, 7, GLASS[2]); s.px(5, 2, GLASS[4]); s.px(6, 2, GLASS[4])  # mirror
    s.rect(1, 11, 14, 5, WHITE[3]); s.ellipse(8, 13, 4, 1.6, ramp('#a8d8f0')[2])
    s.rect(7, 9, 2, 3, METAL[2])
    s.rect(5, 16, 6, 12, WHITE[2]); s.vline(10, 16, 12, WHITE[1])
    return s.outline()


def plant(rng, kind=0):
    s = _sh(16, 32 if kind != 2 else 16)
    h = s.h
    s.rect(4, h - 10, 8, 7, POT[2]); s.vline(11, h - 10, 7, POT[1]); s.rect(3, h - 11, 10, 2, POT[3])
    if kind == 0:  # monstera-ish
        m = s.ellipse_mask(8, h - 19, 6, 7) | s.ellipse_mask(4, h - 15, 3.5, 3) | s.ellipse_mask(12, h - 15, 3.5, 3)
        light_shade(s, m, LEAF, 5, h - 25, 2.5)
        s.line(8, h - 12, 8, h - 22, LEAF[1])
    elif kind == 1:  # tall snake plant
        for i, x in enumerate((5, 7, 9, 11)):
            top = h - 26 + (i % 2) * 4
            s.rect(x, top, 2, h - 11 - top, LEAF[2 + i % 2]); s.vline(x, top, h - 11 - top, LEAF[1])
            s.px(x, top, LEAF[4])
    else:  # succulent small
        s.ellipse(8, h - 12, 4, 2.5, ramp('#7ac0a0')[2]); s.px(7, h - 13, ramp('#7ac0a0')[4])
    return s.outline()


def floor_lamp(rng):
    s = _sh(16, 32)
    s.rect(7, 8, 2, 20, METAL[1]); s.rect(4, 27, 8, 2, METAL[0])
    s.poly([(4, 1), (11, 1), (13, 8), (2, 8)], ramp('#f0d890')[2])
    s.hline(2, 8, 12, ramp('#f0d890')[1]); s.hline(4, 1, 8, ramp('#f0d890')[4])
    s.outline()
    g = S(16, 32)
    g.ellipse(8, 9, 8, 6, (255, 240, 170, 45))
    g.blit(s, 0, 0)
    return g


def rug(rng, color, w=32, h=32, pattern='border'):
    C = ramp(color)
    s = S(w, h)
    s.rrect(0, 0, w, h, 2, C[2])
    if pattern == 'border':
        s.frame(2, 2, w - 4, h - 4, C[3]); s.frame(4, 4, w - 8, h - 8, C[1])
        s.ellipse(w / 2, h / 2, w / 6, h / 6, C[3])
    elif pattern == 'stripes':
        for y in range(2, h - 2, 4):
            s.hline(1, y, w - 2, C[3])
    else:  # round
        s = S(w, h)
        s.ellipse(w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.5, C[2])
        s.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, C[3])
        s.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, C[1])
    return s


def window_wall(rng, curtain=None):
    s = S(16, 32)
    s.rect(1, 6, 14, 16, WHITE[3]); s.rect(2, 7, 12, 14, ramp('#9ad8f8')[2])
    s.rect(2, 7, 12, 3, ramp('#9ad8f8')[3]); s.vline(8, 7, 14, WHITE[3]); s.hline(2, 14, 12, WHITE[3])
    s.px(3, 18, ramp('#9ad8f8')[4]); s.px(4, 17, ramp('#9ad8f8')[4])
    s.hline(0, 22, 16, WHITE[1])
    if curtain:
        C = ramp(curtain)
        s.hline(0, 5, 16, DARKWOOD[1])
        for x0 in (0, 12):
            s.rect(x0, 5, 4, 19, C[2]); s.vline(x0 + 1, 6, 17, C[1]); s.vline(x0 + 3 if x0 else x0, 6, 17, C[3])
    return s.outline()


def door_wall(rng, R=WOOD):
    s = S(16, 32)
    s.rect(1, 6, 14, 26, WHITE[3])
    s.rect(2, 7, 12, 25, R[2]); s.vline(13, 7, 25, R[1])
    s.frame(4, 9, 8, 8, R[1]); s.frame(4, 19, 8, 10, R[1])
    s.px(11, 19, hx('#f0d060'))
    return s


def painting(rng, w=16, h=16):
    s = S(w, h)
    s.rect(1, 3, w - 2, h - 6, DARKWOOD[2]); s.rect(2, 4, w - 4, h - 8, ramp('#9ad8f8')[3])
    sky = ramp(['#9ad8f8', '#f8b878', '#c8a8e8'][int(rng.integers(3))])
    s.rect(2, 4, w - 4, h - 8, sky[3])
    s.poly([(2, h - 5), (w // 2 - 1, 6), (w - 3, h - 5)], ramp('#5a9a6a')[2])
    s.ellipse(w - 5, 6.5, 1.6, 1.6, ramp('#f8e070')[3])
    return s.outline()


def clock(rng):
    s = S(16, 16)
    s.ellipse(8, 8, 5.5, 5.5, DARKWOOD[2]); s.ellipse(8, 8, 4.4, 4.4, WHITE[3])
    s.vline(8, 5, 4, BLACK[1]); s.hline(8, 8, 3, BLACK[1])
    return s.outline()


def shelf_wall(rng):
    s = S(32, 16)
    s.rect(1, 11, 30, 2, WOOD[2]); s.hline(1, 11, 30, WOOD[3])
    s.rect(3, 6, 5, 5, POT[2]); s.ellipse(5.5, 5, 3, 2, LEAF[2])
    for i, x in enumerate(range(11, 20, 2)):
        B = ramp(['#c8504a', '#4a6ab8', '#d8a83a', '#5a9a5a', '#8a6ac0'][i])
        s.rect(x, 4 + (i % 2), 2, 7 - (i % 2), B[2])
    s.rect(23, 7, 6, 4, WHITE[3]); s.rect(24, 6, 4, 1, ramp('#e892b0')[2])
    return s.outline()


def piano(rng):
    s = _sh(32, 32)
    s.rect(1, 0, 30, 20, BLACK[2]); s.hline(1, 0, 30, BLACK[3]); s.rect(3, 3, 26, 6, BLACK[1])
    s.rect(1, 16, 30, 5, WHITE[3])
    for x in range(2, 30, 2):
        s.vline(x, 16, 5, WHITE[1])
    for x in range(3, 29, 4):
        s.rect(x, 16, 1, 3, BLACK[0])
    s.rect(1, 21, 30, 3, BLACK[1])
    for x in (2, 27):
        s.rect(x, 24, 3, 5, BLACK[0])
    return s.outline()


def bin_(rng):
    s = _sh(16, 16)
    s.rect(4, 4, 8, 9, METAL[2]); s.vline(11, 4, 9, METAL[1]); s.rect(3, 3, 10, 2, METAL[3])
    return s.outline()


def cat(rng, color='#e8a050', d='down', f=0):
    C = ramp(color)
    s = shadow(16, 16, 8, 14, 5, 1.5)
    if d in ('down', 'up'):
        s.ellipse(8, 10, 4, 4, C[2])
        s.ellipse(8, 6, 3.6, 3.2, C[2])
        s.poly([(5, 2), (6, 5), (4, 5)], C[2]); s.poly([(11, 2), (12, 5), (10, 5)], C[2])
        if d == 'down':
            s.px(6, 6, BLACK[0]); s.px(10, 6, BLACK[0]); s.px(8, 7, ramp('#f08aa0')[2])
            s.rect(6, 12, 2, 2, C[3]); s.rect(9, 12, 2, 2, C[3])
        else:
            s.line(8, 13, 11 + (f % 2), 15, C[1])
    else:
        s.ellipse(8, 10, 5, 3.4, C[2]); s.hline(4, 8, 8, C[3])
        hx_ = 12 if d == 'right' else 4
        s.ellipse(hx_, 7, 3, 2.8, C[2])
        s.poly([(hx_ - 2, 3), (hx_ - 1, 6), (hx_ - 3, 6)], C[2]); s.poly([(hx_ + 1, 3), (hx_ + 2, 6), (hx_, 6)], C[2])
        s.px(hx_ + (1 if d == 'right' else -1), 7, BLACK[0])
        tx = 3 if d == 'right' else 13
        s.line(tx, 9, tx + (-1 if d == 'right' else 1), 5 + f % 2, C[1])
        lg = (0, 1, 0, -1)[f]
        for x in (6, 10):
            s.rect(x + lg * (1 if x == 6 else -1), 12, 1, 2, C[1])
    for _ in range(3):
        x, y = int(rng.integers(5, 11)), int(rng.integers(8, 12))
        if s.get(x, y)[3] == 255:
            s.px(x, y, C[1])
    return s.outline()
