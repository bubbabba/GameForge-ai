"""Tiny pixel-art toolkit used by the pack generators.

Everything is drawn procedurally into RGBA numpy arrays so packs are fully
reproducible from a seed.
"""
import colorsys
import os

import numpy as np
from PIL import Image, ImageDraw

TILE = 16
CLEAR = (0, 0, 0, 0)


# ---------------------------------------------------------------- colour --

def hx(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def _hue_toward(h, target, amt):
    d = (target - h + 0.5) % 1.0 - 0.5
    step = max(-amt, min(amt, d))
    return (h + step) % 1.0


def shift(c, hue_to=None, hue_amt=0.0, ds=0.0, dv=0.0):
    r, g, b = [x / 255 for x in c[:3]]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if hue_to is not None:
        h = _hue_toward(h, hue_to, hue_amt)
    s = min(1, max(0, s + ds))
    v = min(1, max(0, v + dv))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (round(r * 255), round(g * 255), round(b * 255), c[3] if len(c) > 3 else 255)


BLUE_H, YELLOW_H = 0.66, 0.14


def ramp(base):
    """5-step hue-shifted ramp. 0 = darkest, 2 = base, 4 = lightest.

    Shadows lean toward blue/purple, highlights toward warm yellow, which is
    what gives hand-made pixel art its rich look.
    """
    b = hx(base) if isinstance(base, str) else base
    return [
        shift(b, BLUE_H, 0.06, +0.10, -0.38),
        shift(b, BLUE_H, 0.03, +0.05, -0.18),
        b,
        shift(b, YELLOW_H, 0.03, -0.08, +0.12),
        shift(b, YELLOW_H, 0.05, -0.18, +0.24),
    ]


def outline_of(c):
    return shift(c, BLUE_H, 0.08, +0.15, -0.62)


def with_alpha(c, a):
    return (c[0], c[1], c[2], a)


# ---------------------------------------------------------------- sprite --

class S:
    """An RGBA sprite canvas."""

    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)
        if fill is not None:
            self.a[:, :] = fill

    # -- primitives
    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = c

    def get(self, x, y):
        return tuple(int(v) for v in self.a[y, x])

    def rect(self, x, y, w, h, c):
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1] = c

    def hline(self, x, y, w, c):
        self.rect(x, y, w, 1, c)

    def vline(self, x, y, h, c):
        self.rect(x, y, 1, h, c)

    def frame(self, x, y, w, h, c):
        self.hline(x, y, w, c)
        self.hline(x, y + h - 1, w, c)
        self.vline(x, y, h, c)
        self.vline(x + w - 1, y, h, c)

    def ellipse_mask(self, cx, cy, rx, ry):
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        return ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1.0

    def ellipse(self, cx, cy, rx, ry, c):
        self.a[self.ellipse_mask(cx, cy, rx, ry)] = c

    def poly_mask(self, pts):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon(pts, fill=255)
        return np.array(im) > 0

    def poly(self, pts, c):
        self.a[self.poly_mask(pts)] = c

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def rrect_mask(self, x, y, w, h, r):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=r, fill=255)
        return np.array(im) > 0

    def rrect(self, x, y, w, h, r, c):
        self.a[self.rrect_mask(x, y, w, h, r)] = c

    # -- composition
    def blit(self, o, x, y):
        sx0, sy0 = max(0, -x), max(0, -y)
        dx0, dy0 = max(0, x), max(0, y)
        w = min(o.w - sx0, self.w - dx0)
        h = min(o.h - sy0, self.h - dy0)
        if w <= 0 or h <= 0:
            return
        src = o.a[sy0:sy0 + h, sx0:sx0 + w].astype(np.float32) / 255
        dst = self.a[dy0:dy0 + h, dx0:dx0 + w].astype(np.float32) / 255
        sa, da = src[..., 3:4], dst[..., 3:4]
        oa = sa + da * (1 - sa)
        rgb = np.where(oa > 0, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6), 0)
        out = np.concatenate([rgb, oa], axis=-1)
        self.a[dy0:dy0 + h, dx0:dx0 + w] = np.round(out * 255).astype(np.uint8)

    def copy(self):
        n = S(self.w, self.h)
        n.a = self.a.copy()
        return n

    def crop(self, x, y, w, h):
        n = S(w, h)
        n.a = self.a[y:y + h, x:x + w].copy()
        return n

    def flip_x(self):
        n = S(self.w, self.h)
        n.a = self.a[:, ::-1].copy()
        return n

    def opaque(self):
        return self.a[..., 3] == 255

    def outline(self, inner=False):
        """Dark, hue-shifted outline around opaque pixels (4-neighbour)."""
        op = self.opaque()
        out = self.a.copy()
        H, W = op.shape
        for y in range(H):
            for x in range(W):
                if op[y, x]:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < W and 0 <= ny < H and op[ny, nx]:
                        out[y, x] = outline_of(tuple(self.a[ny, nx]))
                        break
        self.a = out
        return self

    def edge_darken(self):
        """Turn the outermost opaque ring into an outline (for sprites drawn to the edge)."""
        op = self.opaque()
        out = self.a.copy()
        H, W = op.shape
        for y in range(H):
            for x in range(W):
                if not op[y, x]:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if not (0 <= nx < W and 0 <= ny < H) or not op[ny, nx]:
                        out[y, x] = outline_of(tuple(self.a[y, x]))
                        break
        self.a = out
        return self

    def img(self):
        return Image.fromarray(self.a, 'RGBA')

    def save(self, path, scale=1):
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        im = self.img()
        if scale != 1:
            im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        im.save(path)


def shadow(w, h, cx, cy, rx, ry, a=70):
    s = S(w, h)
    s.ellipse(cx, cy, rx, ry, (20, 16, 40, a))
    return s


def speckle(s, rng, colors, density, region=None, mask=None):
    x0, y0, w, h = region or (0, 0, s.w, s.h)
    n = int(w * h * density)
    for _ in range(n):
        x, y = x0 + int(rng.integers(w)), y0 + int(rng.integers(h))
        if mask is not None and not mask[y, x]:
            continue
        s.px(x, y, colors[int(rng.integers(len(colors)))])


def light_shade(s, mask, r, lx, ly, spread):
    """Shade a mask with ramp r using distance from a light point."""
    yy, xx = np.mgrid[0:s.h, 0:s.w]
    d = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2) / spread
    idx = np.clip(4 - d.astype(int), 1, 4)
    for i in range(1, 5):
        s.a[mask & (idx == i)] = r[i]


# ------------------------------------------------------------- pixel font --

FONT = {
    'A': "010101111101101", 'B': "110101110101110", 'C': "011100100100011", 'D': "110101101101110",
    'E': "111100110100111", 'F': "111100110100100", 'G': "011100101101011", 'H': "101101111101101",
    'I': "111010010010111", 'J': "001001001101010", 'K': "101101110101101", 'L': "100100100100111",
    'M': "101111111101101", 'N': "110101101101101", 'O': "010101101101010", 'P': "110101110100100",
    'Q': "010101101110011", 'R': "110101110101101", 'S': "011100010001110", 'T': "111010010010010",
    'U': "101101101101111", 'V': "101101101101010", 'W': "101101111111101", 'X': "101101010101101",
    'Y': "101101010010010", 'Z': "111001010100111", '0': "111101101101111", '1': "010110010010111",
    '2': "110001010100111", '3': "110001010001110", '4': "101101111001001", '5': "111100110001110",
    '6': "011100110101010", '7': "111001010010010", '8': "010101010101010", '9': "010101011001110",
    ' ': "000000000000000", '-': "000000111000000", '.': "000000000000010", '!': "010010010000010",
    ':': "000010000010000", '&': "010101010101011", "'": "010010000000000", '/': "001001010100100",
    '+': "000010111010000", ',': "000000000010100", 'x': "000101010101000",
}


def text_width(t, scale=1, gap=1):
    return (len(t) * (3 + gap) - gap) * scale


def draw_text(s, x, y, t, c, scale=1, gap=1, shadow_c=None):
    for i, ch in enumerate(t):
        g = FONT.get(ch, FONT.get(ch.upper(), FONT[' ']))
        ox = x + i * (3 + gap) * scale
        for k, bit in enumerate(g):
            if bit == '1':
                gx, gy = ox + (k % 3) * scale, y + (k // 3) * scale
                if shadow_c is not None:
                    s.rect(gx + scale, gy + scale, scale, scale, shadow_c)
                s.rect(gx, gy, scale, scale, c)


# ----------------------------------------------------------------- export --

class Packer:
    """Shelf-packs sprites on a 16px grid into one sheet."""

    def __init__(self, width=256):
        self.width = width
        self.items = []

    def add(self, name, spr):
        self.items.append((name, spr))

    def build(self):
        def cell(v):
            return -(-v // TILE) * TILE
        items = sorted(self.items, key=lambda it: (-cell(it[1].h), -cell(it[1].w)))
        x = y = shelf = 0
        placed = []
        for name, spr in items:
            w, h = cell(spr.w), cell(spr.h)
            if x + w > self.width:
                x, y, shelf = 0, y + shelf, 0
            placed.append((name, spr, x, y))
            x += w
            shelf = max(shelf, h)
        sheet = S(self.width, y + shelf)
        atlas = {}
        for name, spr, px_, py_ in placed:
            sheet.blit(spr, px_, py_)
            atlas[name] = {'x': px_, 'y': py_, 'w': spr.w, 'h': spr.h}
        return sheet, atlas


def save_scaled(spr, root, rel, scales=(1, 2, 3)):
    """Save into root/16x16/rel, root/32x32/rel, root/48x48/rel."""
    for sc in scales:
        sz = TILE * sc
        spr.save(os.path.join(root, f'{sz}x{sz}', rel), sc)


def tiled_tsx(path, name, image_rel, w, h, tile=TILE):
    cols = w // tile
    count = cols * (h // tile)
    with open(path, 'w') as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<tileset version="1.10" tiledversion="1.10.2" name="{name}" tilewidth="{tile}" '
                f'tileheight="{tile}" tilecount="{count}" columns="{cols}">\n'
                f' <image source="{image_rel}" width="{w}" height="{h}"/>\n</tileset>\n')


def save_gif(frames, path, scale=3, duration=160, bg=(34, 32, 52)):
    ims = []
    for fr in frames:
        base = Image.new('RGBA', (fr.w, fr.h), bg + (255,))
        base.alpha_composite(fr.img())
        ims.append(base.convert('RGB').resize((fr.w * scale, fr.h * scale), Image.NEAREST))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=duration, loop=0)
