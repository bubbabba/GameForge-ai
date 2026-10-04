"""v2 prototype: true top-down (3/4 overhead) style test.

Key rules vs v1:
- Camera looks DOWN at ~60deg: roofs, canopies and car roofs dominate; front faces are short.
- One light from top-left; every object casts a soft shadow to the bottom-right.
- Textures are built from shaped clusters (tufts, stones), not per-pixel noise.
- Characters: 6-frame walk with real arm swing + head bob, 4-frame idle with blink.
"""
import numpy as np

from core import S, hx, ramp, shift, with_alpha, save_gif, YELLOW_H as YELLOW_HUE

SH = (24, 18, 48, 85)          # cast-shadow colour
G = ramp('#6cc04a')
G_DARK = ramp('#4f9e3e')


def value_noise(w, h, cell, rng):
    gw, gh = w // cell, h // cell
    grid = rng.random((gh, gw))
    yy, xx = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xx.astype(int), yy.astype(int)
    fx, fy = xx - x0, yy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = grid[y0 % gh, x0 % gw]; b = grid[y0 % gh, (x0 + 1) % gw]
    c = grid[(y0 + 1) % gh, x0 % gw]; d = grid[(y0 + 1) % gh, (x0 + 1) % gw]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def tuft(s, x, y, R, big=False):
    """A shaped grass tuft: dark base, mid blades, lit tips."""
    pts_dark = [(0, 0), (-1, 0), (1, 0)]
    pts_mid = [(-1, -1), (1, -1), (0, -1)]
    pts_lit = [(-2, -2), (0, -2), (2, -2)] if big else [(-1, -2), (1, -2)]
    for dx, dy in pts_dark:
        s.px((x + dx) % s.w, (y + dy) % s.h, R[1])
    for dx, dy in pts_mid:
        s.px((x + dx) % s.w, (y + dy) % s.h, R[2])
    for dx, dy in pts_lit:
        s.px((x + dx) % s.w, (y + dy) % s.h, R[3])


def grass_field(w, h, rng):
    s = S(w, h, G[2])
    n = value_noise(w, h, 16, rng)
    s.a[n > 0.62] = shift(G[2], YELLOW_HUE, 0.01, -0.04, +0.05)
    s.a[n < 0.30] = shift(G[2], dv=-0.035)
    for _ in range(w * h // 70):
        x, y = int(rng.integers(w)), int(rng.integers(h))
        tuft(s, x, y, G, rng.random() < 0.3)
    for _ in range(w * h // 900):  # flower clusters
        x, y = int(rng.integers(w)), int(rng.integers(h))
        c = ramp(['#ffffff', '#f6d24a', '#f07a9a', '#9a8af0'][int(rng.integers(4))])
        for dx, dy in ((0, 0), (2, 1), (-1, 2), (1, 3)):
            s.px((x + dx) % w, (y + dy) % h, c[3]); s.px((x + dx) % w, (y + dy + 1) % h, G[1])
    for _ in range(w * h // 1400):  # pebbles
        x, y = int(rng.integers(w)), int(rng.integers(h))
        P = ramp('#a8a4a0')
        s.px(x, y, P[3]); s.px((x + 1) % w, y, P[2]); s.px(x, (y + 1) % h, P[1]); s.px((x + 1) % w, (y + 1) % h, P[0])
    return s


def stone_path(w, h, rng):
    P = ramp('#c9b896')
    s = S(w, h, ramp('#a8946e')[1])
    for y0 in range(0, h, 6):
        off = int(rng.integers(0, 6))
        x = -off
        while x < w:
            sw = int(rng.integers(5, 9))
            m = s.rrect_mask(x + 1, y0 + 1, sw - 1, 5, 2)
            s.a[m] = P[2]
            s.hline(max(0, x + 2), y0 + 1, max(0, sw - 3), P[4])
            s.hline(max(0, x + 2), y0 + 5, max(0, sw - 3), P[1])
            x += sw
    return s


# ---------------------------------------------------------- building --

def house_topdown(rng, wt=5, roof='#d0574d', wall='#efe2c0', roof_rows=3.5):
    """Hip-roofed house seen from above at 3/4. Sprite includes its cast shadow."""
    W = wt * 16
    roof_h = int(roof_rows * 16)
    wall_h = 28
    pad = 10                                  # room for shadow on the right/bottom
    s = S(W + pad, roof_h + wall_h + 6)
    R, Wl = ramp(roof), ramp(wall)
    ridge_y = roof_h // 3
    inset = W // 4
    # cast shadow (bottom-right)
    s.poly([(W, 8), (W + pad, 8 + pad), (W + pad, roof_h + wall_h + 6), (pad, roof_h + wall_h + 6),
            (pad, roof_h + wall_h), (W, roof_h + wall_h)], SH)
    # front wall
    wy = roof_h - 4
    s.rect(4, wy, W - 8, wall_h, Wl[2])
    s.rect(4, wy, W - 8, 5, Wl[0])              # deep shadow under eave
    s.rect(4, wy + 5, W - 8, 2, Wl[1])
    for xx in range(4, W - 4, 8):               # siding seams
        pass
    for yy in range(wy + 9, wy + wall_h - 3, 4):
        s.hline(4, yy, W - 8, Wl[1])
    s.vline(W - 5, wy, wall_h, Wl[1])
    s.rect(4, wy + wall_h - 3, W - 8, 3, ramp('#8e8a96')[1])   # foundation
    # windows & door
    door_x = W // 2 - 6
    for col in range(wt):
        cx = col * 16 + 8
        if abs(cx - W // 2) < 9:
            D = ramp('#3f6fb0')
            s.rect(door_x - 1, wy + 8, 14, 20, ramp('#efeee6')[2])
            s.rect(door_x, wy + 9, 12, 19, D[2]); s.vline(door_x + 11, wy + 9, 19, D[1])
            s.rect(door_x + 2, wy + 11, 8, 5, ramp('#9fd8f4')[2]); s.px(door_x + 2, wy + 11, ramp('#9fd8f4')[4])
            s.px(door_x + 9, wy + 19, hx('#f6d24a'))
            s.rect(door_x - 3, wy + wall_h - 1, 18, 3, ramp('#b0aab4')[3])
        else:
            GL = ramp('#86c4e8')
            s.rect(cx - 5, wy + 9, 10, 10, ramp('#f4f2ea')[2])
            s.rect(cx - 4, wy + 10, 8, 8, GL[1])
            s.rect(cx - 4, wy + 14, 8, 4, GL[2])
            s.px(cx - 3, wy + 15, GL[4]); s.px(cx - 2, wy + 14, GL[4]); s.px(cx + 2, wy + 11, GL[3])
            s.vline(cx, wy + 10, 8, ramp('#f4f2ea')[2])
            s.hline(cx - 6, wy + 19, 12, ramp('#f4f2ea')[1])
            # flower box
            s.rect(cx - 5, wy + 20, 10, 3, ramp('#a06a3c')[2])
            for i in range(0, 10, 2):
                s.px(cx - 5 + i, wy + 19, ramp(['#f07a9a', '#f6d24a', '#ffffff'][i % 3])[2])
                s.px(cx - 4 + i, wy + 19, G[2])
    # roof planes
    back = [(0, 2), (W, 2), (W - inset, ridge_y), (inset, ridge_y)]
    left = [(0, 2), (inset, ridge_y), (0, roof_h)]
    right = [(W, 2), (W - inset, ridge_y), (W, roof_h)]
    front = [(inset, ridge_y), (W - inset, ridge_y), (W, roof_h), (0, roof_h)]
    s.poly(back, R[3]); s.poly(left, R[3]); s.poly(right, R[1]); s.poly(front, R[2])
    fm = s.poly_mask(front)
    lm = s.poly_mask(left)
    rm = s.poly_mask(right)
    bm = s.poly_mask(back)
    # shingle courses following each plane
    for yy in range(ridge_y + 4, roof_h, 4):
        row = (yy - ridge_y) // 4
        for xx in range(W):
            if fm[yy, xx]:
                s.px(xx, yy, R[1])
                if (xx + row * 3) % 7 == 0 and fm[yy - 1, xx]:
                    s.px(xx, yy - 1, R[1]); s.px(xx, yy - 2, R[1])
                if (xx + row * 3) % 7 == 1 and fm[yy - 3, xx]:
                    s.px(xx, yy - 3, R[3])
            if lm[yy, xx] and (xx + yy) % 5 == 0:
                s.px(xx, yy, R[2])
            if rm[yy, xx] and (yy - xx) % 5 == 0:
                s.px(xx, yy, R[0])
    for yy in range(4, ridge_y, 3):
        for xx in range(W):
            if bm[yy, xx] and xx % 6 == (yy // 3) % 6:
                s.px(xx, yy, R[2])
    # hip lines + ridge
    s.line(0, 2, inset, ridge_y, R[4]); s.line(W - 1, 2, W - inset, ridge_y, R[0])
    s.line(inset, ridge_y, 0, roof_h - 1, R[4]); s.line(W - inset, ridge_y, W - 1, roof_h - 1, R[0])
    s.hline(inset, ridge_y, W - 2 * inset, R[4]); s.hline(inset, ridge_y + 1, W - 2 * inset, R[3])
    # eave lip
    s.rect(0, roof_h - 2, W, 2, R[0]); s.hline(0, roof_h - 3, W, R[1])
    # chimney (sits on back plane, casts its own shadow)
    B = ramp('#b45c48')
    cx = W - inset - 4
    s.poly([(cx + 7, 1), (cx + 12, 6), (cx + 12, 14), (cx + 7, 14)], with_alpha(R[0], 255))
    s.rect(cx, -1 + 1, 7, 12, B[2]); s.vline(cx + 6, 0, 12, B[1]); s.rect(cx, 0, 7, 3, B[3])
    s.rect(cx + 1, 1, 5, 1, B[0])
    # skylight on front plane
    sx, sy = inset - 4, ridge_y + 8
    s.rect(sx, sy, 9, 7, ramp('#e8e4dc')[1]); s.rect(sx + 1, sy + 1, 7, 5, ramp('#86c4e8')[1])
    s.px(sx + 2, sy + 2, ramp('#86c4e8')[4]); s.px(sx + 3, sy + 2, ramp('#86c4e8')[3])
    shadow_layer = s.a.copy()
    s.outline()
    s.a[(shadow_layer[..., 3] > 0) & (shadow_layer[..., 3] < 255)] = SH
    return s


# --------------------------------------------------------------- tree --

def leaf_cluster(s, cx, cy, r, L):
    m = s.ellipse_mask(cx, cy, r, r * 0.9)
    s.a[m] = L[2]
    yy, xx = np.mgrid[0:s.h, 0:s.w]
    d_light = (xx - (cx - r * 0.35)) ** 2 + (yy - (cy - r * 0.4)) ** 2
    s.a[m & (d_light < (r * 0.55) ** 2)] = L[3]
    s.a[m & (d_light < (r * 0.25) ** 2)] = L[4]
    lower = m & ~s.ellipse_mask(cx - r * 0.2, cy - r * 0.25, r * 0.95, r * 0.85)
    s.a[lower] = L[1]


def tree_topdown(rng, size=48, leaf='#4fa53e'):
    L = ramp(leaf)
    w = h = size
    s = S(w + 8, h + 6)
    s.ellipse(w / 2 + 6, h - 6, w * 0.42, h * 0.16, SH)                     # cast shadow
    T = ramp('#7a5034')
    s.rect(w // 2 - 2, h - 16, 5, 11, T[2]); s.vline(w // 2 + 2, h - 16, 11, T[1])
    s.px(w // 2 - 3, h - 6, T[1]); s.px(w // 2 + 3, h - 6, T[1])
    r = w * 0.2
    order = [(0.5, 0.62, 1.15), (0.28, 0.55, 1.0), (0.72, 0.55, 1.0), (0.36, 0.36, 1.0),
             (0.64, 0.36, 1.0), (0.5, 0.22, 0.95), (0.5, 0.46, 1.05)]
    for fx, fy, k in order:
        leaf_cluster(s, w * fx, h * fy, r * k, L)
    for _ in range(int(w * 0.6)):  # leaf sparkle
        x, y = int(rng.integers(w)), int(rng.integers(h))
        if tuple(s.a[y, x]) == tuple(L[2]):
            s.px(x, y, L[3])
    sh = s.a.copy()
    s.outline()
    s.a[(sh[..., 3] > 0) & (sh[..., 3] < 255)] = SH
    return s


# ---------------------------------------------------------------- car --

def car_topdown(color, d='down'):
    """Car seen from above. Base drawing faces DOWN; other directions are rotations,
    with a 2px side face added on the bottom edge for left/right (3/4 view)."""
    C = ramp(color)
    GL = ramp('#2e3a52')
    s = S(24, 36)
    s.rrect(2, 2, 20, 32, 5, C[2])
    s.rrect(2, 2, 20, 32, 5, C[2])
    # side shading (light from top-left)
    s.vline(2, 7, 22, C[3]); s.vline(21, 7, 22, C[1])
    # trunk (top) / hood (bottom) since it faces down
    s.hline(5, 3, 14, C[3])
    s.poly([(5, 8), (18, 8), (17, 12), (6, 12)], GL[2])             # rear window
    s.rect(6, 12, 12, 9, C[3]); s.hline(6, 12, 12, C[4])            # roof
    s.poly([(6, 21), (17, 21), (19, 26), (4, 26)], GL[2])           # windscreen
    s.px(6, 22, GL[4]); s.px(7, 22, GL[3]); s.px(8, 23, GL[3])
    s.line(12, 28, 12, 32, C[1])                                    # hood crease
    s.rect(4, 31, 3, 2, hx('#fff2a0')); s.rect(17, 31, 3, 2, hx('#fff2a0'))
    s.rect(4, 3, 3, 1, hx('#e8443a')); s.rect(17, 3, 3, 1, hx('#e8443a'))
    s.px(1, 20, C[1]); s.px(22, 20, C[1])                          # mirrors
    for wy in (6, 24):
        s.rect(1, wy, 1, 5, GL[0]); s.rect(22, wy, 1, 5, GL[0])
    out = s
    if d == 'up':
        out = S(24, 36); out.a = s.a[::-1].copy()
    elif d in ('left', 'right'):
        rot = np.rot90(s.a, 1 if d == 'right' else -1).copy()
        out = S(36, 24 + 3)
        out.a[0:24] = rot
        # 3px visible side face along the bottom edge (body + wheels)
        body = out.a[23].copy()
        for i, row in enumerate((C[1], C[0], C[0])):
            m = out.a[23 - 0][..., 3] == 255
            out.a[24 + i][m] = row
        for wx in (6, 26):
            out.rect(wx, 24, 5, 3, GL[0]); out.hline(wx + 1, 24, 3, ramp('#8a8a96')[2])
    sh = S(out.w + 4, out.h + 4)
    sh.rrect(4, 4, out.w - 2, out.h - 2, 5, SH)
    sh.blit(out.copy().outline() if False else out, 0, 0)
    res = S(sh.w, sh.h)
    res.a = sh.a
    shadow_mask = (res.a[..., 3] > 0) & (res.a[..., 3] < 255)
    body = S(res.w, res.h); body.a = res.a.copy(); body.a[shadow_mask] = 0
    body.outline()
    body.a[shadow_mask & (body.a[..., 3] == 0)] = SH
    return body


# ---------------------------------------------------------- character --

SKIN = ramp('#f6d2b2')
EYE = hx('#2b2233')


def char_frame(d, phase, anim='walk', spec=None):
    """16x32. anim walk: phase 0..5, idle: 0..3."""
    sp = spec or {}
    H = ramp(sp.get('hair', '#6b3e2a'))
    Sh = ramp(sp.get('shirt', '#e0564a'))
    P = ramp(sp.get('pants', '#3a4d80'))
    Fo = ramp(sp.get('shoes', '#3b2f36'))
    K = ramp(sp.get('skin', '#f6d2b2'))
    s = S(16, 32)
    s.ellipse(8, 30.5, 5, 1.6, SH)
    if anim == 'walk':
        bob = (0, -1, 0, 0, -1, 0)[phase]
        swing = (2, 1, 0, -2, -1, 0)[phase]     # +: left leg forward
    else:
        bob = (0, 0, 1, 1)[phase]
        swing = 0
    blink = anim == 'idle' and phase == 3
    by = 18 + bob        # torso top
    # legs
    if d in ('down', 'up'):
        for lx, sgn in ((5, 1), (8, -1)):
            v = sgn * swing                       # +2 forward .. -2 back
            hgt = 4 + (1 if v >= 1 else 0) - (2 if v <= -2 else (1 if v == -1 else 0))
            s.rect(lx, 25, 3, hgt, P[2]); s.vline(lx + 2, 25, hgt, P[1])
            fy = 25 + hgt
            s.rect(lx, fy, 3, 2, Fo[2]); s.px(lx, fy, Fo[3])
    else:
        fwd = 1 if d == 'right' else -1
        front, back_ = 6 + fwd * swing, 6 - fwd * swing
        for lx, shade, sh2, lift in ((back_, P[1], Fo[1], 0), (front, P[2], Fo[2], 1 if abs(swing) == 1 else 0)):
            s.rect(lx, 25, 3, 4 - lift, shade)
            s.rect(lx + (1 if fwd > 0 else -1) * (1 if lx == front and swing else 0), 29 - lift, 3, 2, sh2)
    # torso
    if d in ('down', 'up'):
        s.rect(4, by, 8, 7, Sh[2])
        s.rect(4, by + 5, 8, 2, Sh[1])
        s.vline(11, by, 7, Sh[1]); s.vline(4, by, 5, Sh[3])
        if d == 'down':
            s.rect(7, by, 2, 1, K[1])
            s.vline(8, by + 1, 4, Sh[1])        # shirt placket
        # arms with swing (vertical offset of hands)
        for ax, sgn in ((3, -1), (12, 1)):
            off = sgn * swing // 2 if anim == 'walk' else 0
            s.rect(ax, by + 1 + max(0, off), 1, 4, Sh[2] if ax == 3 else Sh[1])
            s.px(ax, by + 5 + max(0, off), K[2])
            s.px(ax, by + 1, Sh[3] if ax == 3 else Sh[1])
    else:
        s.rect(5, by, 6, 7, Sh[2]); s.rect(5, by + 5, 6, 2, Sh[1])
        s.vline(10 if d == 'right' else 5, by, 7, Sh[1])
        fwd = 1 if d == 'right' else -1
        hand = 7 + fwd * (swing // 2 + 1)
        s.rect(hand, by + 1, 2, 4, Sh[1]); s.rect(hand, by + 5, 2, 1, K[2])
    # head (bigger, rounder)
    hy = 11.5 + bob
    m = s.ellipse_mask(8, hy, 6.4, 6.0)
    s.a[m] = K[2]
    yy, xx = np.mgrid[0:32, 0:16]
    s.a[m & ((xx - 8) * 0.5 + (yy - hy) > 3.5)] = K[1]
    ey = int(hy + 1)
    if d == 'down':
        for ex in (5, 10):
            if blink:
                s.hline(ex, ey + 1, 2, EYE) if False else s.px(ex, ey + 1, EYE)
            else:
                s.rect(ex, ey, 1, 2, EYE); s.px(ex, ey, hx('#ffffff'))
        s.px(4, ey + 2, ramp('#f28c8c')[3]); s.px(11, ey + 2, ramp('#f28c8c')[3])
        s.px(8, ey + 3, K[0])
    elif d in ('left', 'right'):
        ex = 11 if d == 'right' else 4
        if blink:
            s.px(ex, ey + 1, EYE)
        else:
            s.rect(ex, ey, 1, 2, EYE); s.px(ex, ey, hx('#ffffff'))
        s.px(ex + (1 if d == 'right' else -1) * -2, ey + 2, ramp('#f28c8c')[3])
    # hair: volume cap + fringe + strands, bounces 1px late
    hb = bob if phase % 3 != 1 else 0
    cap = s.ellipse_mask(8, hy - 1.5 + hb, 7.0, 5.6)
    if d == 'down':
        hair = cap & (yy <= hy - 1.5 + hb)
        hair |= (xx <= 2) & (yy >= hy - 2 + hb) & (yy <= hy + 4 + hb) & s.ellipse_mask(8, hy, 7.2, 7.4)
        hair |= (xx >= 13) & (yy >= hy - 2 + hb) & (yy <= hy + 4 + hb) & s.ellipse_mask(8, hy, 7.2, 7.4)
        fringe_y = int(hy - 2 + hb)
        s.a[hair] = H[2]
        for x in range(3, 13):
            if x % 3 != 2:
                s.px(x, fringe_y + 1, H[2])
            if x % 3 == 0:
                s.px(x, fringe_y + 2, H[1])
    elif d == 'up':
        hair = s.ellipse_mask(8, hy + hb, 7.0, 6.6) & (yy <= hy + 6)
        s.a[hair] = H[2]
        s.a[hair & (yy >= hy + 3 + hb)] = H[1]
    else:
        back = (xx <= 6) if d == 'right' else (xx >= 9)
        hair = cap & ((yy <= hy - 2 + hb) | (back & (yy <= hy + 4 + hb)))
        s.a[hair] = H[2]
        fx = 12 if d == 'right' else 3
        s.px(fx, int(hy - 2 + hb), H[2]); s.px(fx - (1 if d == 'right' else -1), int(hy - 1 + hb), H[1])
    # hair shine band
    band = hair & (np.abs((yy - (hy - 4 + hb)) + (xx - 6) * 0.4) < 0.8)
    s.a[band] = H[4]
    s.outline()
    s.a[(s.a[..., 3] > 0) & (s.a[..., 3] < 255)] = SH
    return s


def char_sheets(spec=None):
    dirs = ['down', 'left', 'right', 'up']
    walk = S(16 * 6, 32 * 4)
    idle = S(16 * 4, 32 * 4)
    for r, d in enumerate(dirs):
        for f in range(6):
            walk.blit(char_frame(d, f, 'walk', spec), f * 16, r * 32)
        for f in range(4):
            idle.blit(char_frame(d, f, 'idle', spec), f * 16, r * 32)
    return walk, idle


# ---------------------------------------------------------------- demo --

if __name__ == '__main__':
    import os
    out = '/tmp/claude-0/-home-user-gameforge-ai/649db843-c660-580b-8bb3-140f0df61160/scratchpad/v2'
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(4)
    W, Hh = 320, 208
    scene = grass_field(W, Hh, rng)
    path = stone_path(48, Hh, rng)
    scene.blit(path, 136, 0)
    for x in (135, 184):
        scene.vline(x, 0, Hh, G[1])
    scene.blit(house_topdown(rng), 20, 24)
    scene.blit(house_topdown(rng, 4, '#4a6fb5', '#f2d3c9'), 200, 20)
    scene.blit(tree_topdown(rng), 100, 120)
    scene.blit(tree_topdown(rng, 40, '#e88fb4'), 260, 130)
    scene.blit(tree_topdown(rng, 36), 4, 150)
    scene.blit(car_topdown('#e0564a', 'down'), 146, 60)
    scene.blit(car_topdown('#3fa8c8', 'right'), 190, 165)
    specs = [None, {'hair': '#2e2834', 'shirt': '#48b06a', 'pants': '#4a3a32', 'skin': '#c98b62'},
             {'hair': '#eac262', 'shirt': '#7a5ad8', 'pants': '#2e2e3a'}]
    for i, (x, y, d) in enumerate(((70, 112, 'down'), (150, 130, 'up'), (230, 104, 'left'))):
        scene.blit(char_frame(d, 0, 'walk', specs[i]), x, y)
    scene.save(f'{out}/v2_scene.png', 3)
    # car directions
    cs = S(4 * 44, 44, G[2])
    for i, d in enumerate(('down', 'left', 'right', 'up')):
        cs.blit(car_topdown('#e0564a', d), 4 + i * 44, 2)
    cs.save(f'{out}/v2_cars.png', 4)
    # character sheet + gif
    walk, idle = char_sheets()
    sheet = S(96 + 64 + 12, 128 + 8, G[2])
    sheet.blit(walk, 4, 4); sheet.blit(idle, 104, 4)
    sheet.save(f'{out}/v2_character_sheet.png', 4)
    frames = []
    for f in range(12):
        fr = S(4 * 22 + 10, 2 * 36 + 6, G[2])
        for i, d in enumerate(('down', 'left', 'right', 'up')):
            fr.blit(char_frame(d, f % 6, 'walk', specs[i % 3]), 6 + i * 22, 2)
            fr.blit(char_frame(d, (f // 3) % 4, 'idle', specs[(i + 1) % 3]), 6 + i * 22, 38)
        frames.append(fr)
    save_gif(frames, f'{out}/v2_walk_idle.gif', 5, 110, bg=(108, 192, 74))
    print(out)
