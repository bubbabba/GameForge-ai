"""Chibi 16x32 characters: 4 directions x 4-frame walk, built from layers."""
import numpy as np

from core import S, hx, ramp

SKINS = ['#f8d8bc', '#ecb88e', '#c98b62', '#9a6342', '#6b4229']
HAIRS = {'black': '#2e2834', 'brown': '#734a30', 'blonde': '#eac262', 'ginger': '#c8582e',
         'blue': '#4a72cc', 'pink': '#ee92ba', 'silver': '#c4c6d2', 'green': '#4aa070'}
CLOTH = ['#d84a4a', '#4a7ad8', '#48b06a', '#f0c040', '#9a5ad0', '#f08a3a', '#3ab0b8', '#e8e4dc',
         '#3a3e4e', '#e86aa0', '#8a6a4a', '#6a8a3a']
PANTS = ['#3a4a7a', '#2e2e3a', '#6a5040', '#4a5a4a', '#8a8a96', '#5a3a5a']
HAIR_STYLES = ['short', 'spiky', 'long', 'bob', 'ponytail', 'buzz', 'bun', 'curly']
DIRS = ['down', 'left', 'right', 'up']
EYE = hx('#2a2030')


def _legs(s, d, f, pants, shoes, bob):
    """Legs + shoes. f in 0..3 walk frame."""
    P, Sh = pants, shoes
    if d in ('down', 'up'):
        lo = {0: (0, 0), 1: (1, -1), 2: (0, 0), 3: (-1, 1)}[f]
        for i, (x, dy) in enumerate(((5, lo[0]), (8, lo[1]))):
            h = 4 + dy
            s.rect(x, 25, 3, h, P[2])
            s.vline(x + 2, 25, h, P[1])
            s.rect(x, 25 + h, 3, 2, Sh[1])
            s.hline(x, 25 + h, 2, Sh[2])
    else:
        stride = {0: 0, 1: 2, 2: 0, 3: -2}[f]
        back, front = (6 - stride // 2 * 0, 6), (6, 6)
        bx, fx = 6 - stride // 2, 6 + stride // 2
        if d == 'left':
            bx, fx = fx, bx
        s.rect(bx, 25, 3, 4, P[1])
        s.rect(bx, 29, 3, 2, Sh[0])
        s.rect(fx, 25, 3, 4, P[2])
        s.rect(fx, 29, 3, 2, Sh[1])
        s.hline(fx, 29, 2, Sh[2])


def _torso(s, d, f, shirt, skin, bob, dress=False):
    C, K = shirt, skin
    y0 = 18 + bob
    if d in ('down', 'up'):
        s.rect(4, y0, 8, 7, C[2])
        s.vline(11, y0, 7, C[1])
        s.hline(4, y0 + 6, 8, C[1])
        if d == 'down':
            s.hline(6, y0, 4, C[3])  # collar light
            s.px(7, y0, K[2]); s.px(8, y0, K[2])
        swing = {0: 0, 1: 1, 2: 0, 3: -1}[f]
        for ax, sw in ((3, swing), (12, -swing)):
            s.rect(ax, y0 + sw, 1, 5, C[1] if ax == 12 else C[2])
            s.px(ax, y0 + 5 + sw, K[2])
        if dress:
            s.rect(4, y0 + 6, 8, 3, C[2])
            s.hline(3, y0 + 8, 10, C[1])
    else:
        s.rect(5, y0, 6, 7, C[2])
        s.vline(10 if d == 'right' else 5, y0, 7, C[1])
        s.hline(5, y0 + 6, 6, C[1])
        swing = {0: 0, 1: 2, 2: 0, 3: -2}[f]
        if d == 'left':
            swing = -swing
        ax = 7 + (1 if swing > 0 else (-1 if swing < 0 else 0))
        s.rect(ax, y0 + 1, 2, 4, C[1])
        s.rect(ax, y0 + 5, 2, 1, K[2])
        if dress:
            s.rect(4, y0 + 6, 8, 3, C[2])
            s.hline(4, y0 + 8, 8, C[1])


def _head(s, d, skin, bob, blush=True):
    K = skin
    m = s.ellipse_mask(8, 12.5 + bob, 6, 5.6)
    s.a[m] = K[2]
    # shade right/bottom edge
    yy, xx = np.mgrid[0:s.h, 0:s.w]
    shade = m & (((xx - 8) * 0.6 + (yy - 12 - bob)) > 4.2)
    s.a[shade] = K[1]
    y = 13 + bob
    if d == 'down':
        for ex in (5, 10):
            s.rect(ex, y, 1, 2, EYE)
            s.px(ex, y, hx('#ffffff'))
            s.px(ex, y + 1, EYE)
        if blush:
            s.px(4, y + 2, K[1]); s.px(11, y + 2, K[1])
    elif d in ('left', 'right'):
        ex = 11 if d == 'right' else 4
        s.rect(ex, y, 1, 2, EYE)
        s.px(ex, y, hx('#ffffff'))
        bx = 9 if d == 'right' else 6
        if blush:
            s.px(bx, y + 2, K[1])


def _hair(s, d, style, H, bob):
    b = bob
    top = s.ellipse_mask(8, 11 + b, 6.6, 5.2)
    yy, xx = np.mgrid[0:s.h, 0:s.w]
    if style == 'buzz':
        m = top & (yy <= 10 + b)
    else:
        m = top & (yy <= 12 + b)
    if d == 'down':
        if style not in ('buzz',):
            m &= ~((yy >= 11 + b) & (xx >= 4) & (xx <= 11))
            # bangs
            for x in range(4, 12):
                if (x + (1 if style == 'spiky' else 0)) % 3 != 0:
                    s.px(x, 11 + b, H[2])
        if style in ('long', 'bob', 'curly'):
            ln = {'long': 21, 'bob': 16, 'curly': 18}[style]
            m |= (xx <= 3) & (xx >= 1) & (yy >= 9 + b) & (yy <= ln + b)
            m |= (xx >= 12) & (xx <= 14) & (yy >= 9 + b) & (yy <= ln + b)
    elif d == 'up':
        m = s.ellipse_mask(8, 12 + b, 6.6, 6.0)
        if style == 'buzz':
            m &= yy <= 14 + b
        elif style in ('long',):
            m |= (xx >= 2) & (xx <= 13) & (yy >= 12 + b) & (yy <= 22 + b)
        elif style in ('bob', 'curly'):
            m |= (xx >= 2) & (xx <= 13) & (yy >= 12 + b) & (yy <= 17 + b)
    else:  # side
        back = (xx <= 7) if d == 'right' else (xx >= 8)
        m = top & ((yy <= 11 + b) | back)
        m &= yy <= 15 + b
        if style == 'buzz':
            m = top & ((yy <= 10 + b) | (back & (yy <= 13 + b)))
        if style in ('long', 'bob', 'curly'):
            ln = {'long': 21, 'bob': 16, 'curly': 18}[style]
            bx0, bx1 = (2, 6) if d == 'right' else (9, 13)
            m |= (xx >= bx0) & (xx <= bx1) & (yy >= 10 + b) & (yy <= ln + b)
    s.a[m] = H[2]
    # shading: light streak top-left, dark lower edge
    hl = m & (((xx - 5) ** 2 + (yy - 8 - b) ** 2) < 6)
    s.a[hl] = H[3]
    dk = m & (yy >= 14 + b)
    s.a[dk] = H[1]
    if style == 'spiky':
        for x in (4, 7, 10, 12):
            s.px(x, 5 + b, H[2]); s.px(x, 6 + b, H[2])
    if style == 'ponytail':
        if d == 'down':
            s.rect(13, 12 + b, 2, 6, H[1])
        elif d == 'up':
            s.rect(7, 16 + b, 2, 6, H[1]); s.vline(7, 16 + b, 6, H[2])
        else:
            px = 2 if d == 'right' else 12
            s.rect(px, 11 + b, 2, 7, H[1])
    if style == 'bun':
        s.ellipse(8, 5.5 + b, 2.6, 2.2, H[2]); s.px(7, 5 + b, H[3])
    if style == 'curly':
        for x in range(2, 14, 2):
            s.px(x, 6 + b + (x % 4 == 0), H[3])


def frame(spec, d, f, layers=('body', 'outfit', 'hair')):
    s = S(16, 32)
    bob = -1 if f in (1, 3) else 0
    skin, hair, shirt, pants = (ramp(spec['skin']), ramp(spec['hair']), ramp(spec['shirt']), ramp(spec['pants']))
    shoes = ramp(spec.get('shoes', '#4a3a3a'))
    if 'body' in layers:
        under = ramp('#d8d4cc')
        _legs(s, d, f, ramp(spec['skin']), skin, bob)
        _torso(s, d, f, under, skin, bob)
    if 'outfit' in layers:
        _legs(s, d, f, pants, shoes, bob)
        _torso(s, d, f, shirt, skin, bob, dress=spec.get('dress', False))
    if 'body' in layers:
        _head(s, d, skin, bob)
    if 'hair' in layers:
        _hair(s, d, spec['style'], hair, bob)
    return s


def sheet(spec, layers=('body', 'outfit', 'hair'), outline=True):
    """64x128: columns = walk frames, rows = down, left, right, up."""
    sh = S(64, 128)
    for r, d in enumerate(DIRS):
        for f in range(4):
            fr = frame(spec, d, f, layers)
            if outline:
                fr.outline()
            sh.blit(fr, f * 16, r * 32)
    return sh


def random_spec(rng, i=0):
    return {
        'skin': SKINS[int(rng.integers(len(SKINS)))],
        'hair': list(HAIRS.values())[int(rng.integers(len(HAIRS)))],
        'style': HAIR_STYLES[i % len(HAIR_STYLES)],
        'shirt': CLOTH[int(rng.integers(len(CLOTH)))],
        'pants': PANTS[int(rng.integers(len(PANTS)))],
        'shoes': ['#4a3a3a', '#2a2a34', '#e8e4dc', '#8a4a2a'][int(rng.integers(4))],
        'dress': bool(rng.random() < 0.2),
    }
