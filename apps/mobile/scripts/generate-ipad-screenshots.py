#!/usr/bin/env python3
"""
TurbotaAI – iPad App Store screenshot generator
Source:  apps/mobile/appstore-screenshots/  (1284×2778 iPhone PNGs)
Output:  apps/mobile/appstore-screenshots-ipad/  (2048×2732 iPad PNGs)

Composition strategy
────────────────────
iPad canvas: 2048×2732
iPhone screenshot scaled to 2600 px tall (preserving aspect ratio → ~1201 px wide)
Centred vertically (66 px top/bottom padding) and horizontally.
Left/right panels (~424 px each) filled with a matching brand gradient so the
result looks intentional — not a naked phone floated on white.

Usage
─────
python3 apps/mobile/scripts/generate-ipad-screenshots.py
"""

import os, sys, math
from PIL import Image, ImageDraw, ImageFilter

# ── paths ─────────────────────────────────────────────────────────────────────
HERE   = os.path.dirname(os.path.abspath(__file__))
SRC    = os.path.join(HERE, "..", "appstore-screenshots")
OUT    = os.path.join(HERE, "..", "appstore-screenshots-ipad")
ICON   = os.path.join(HERE, "..", "assets", "icon.png")
os.makedirs(OUT, exist_ok=True)

# ── dimensions ────────────────────────────────────────────────────────────────
W, H        = 2048, 2732   # iPad target
PHONE_H     = 2600         # scaled phone height (66 px pad top + bottom)
PHONE_SCALE = PHONE_H / 2778
PHONE_W     = round(1284 * PHONE_SCALE)   # ≈ 1201
PAD_Y       = (H - PHONE_H) // 2          # ≈ 66 px
PAD_X       = (W - PHONE_W) // 2          # ≈ 424 px

# ── colours (must match mobile theme.ts) ──────────────────────────────────────
PRIMARY       = (124, 58, 237)
PRIMARY_DARK  = (109, 40, 217)
PRIMARY_LIGHT = (237, 233, 254)
BG            = (248, 250, 252)
SURFACE       = (255, 255, 255)
TEXT          = (15, 23, 42)
TEXT_SEC      = (100, 116, 139)
BORDER        = (226, 232, 240)

# ── per-screen panel configurations ──────────────────────────────────────────
# Each screen has its own panel gradient so it complements the screenshot content.
PANEL_CONFIGS = {
    "01-main":    {"top": (237, 233, 254), "bot": (221, 214, 254)},  # light purple
    "02-chat":    {"top": (240, 253, 244), "bot": (220, 252, 231)},  # light green (AI bubbles)
    "03-premium": {"top": (109,  40, 217), "bot": ( 91,  33, 182)},  # deep purple (matches header)
    "04-voice":   {"top": ( 15,  23,  42), "bot": ( 30,  41,  59)},  # dark (matches voice screen)
}
PANEL_TEXT_DARK  = {"01-main", "02-chat"}   # use dark text in panels
PANEL_TEXT_LIGHT = {"03-premium", "04-voice"}

def hex_or_rgb(c):
    if isinstance(c, str):
        h = c.lstrip("#")
        return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), 255)
    return (*c, 255) if len(c) == 3 else c

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i]) * t) for i in range(3))

def make_gradient(width, height, top_col, bot_col):
    """Vertical gradient image."""
    img = Image.new("RGB", (width, height))
    for y in range(height):
        t = y / max(height-1, 1)
        img.putpixel((0, y), lerp_color(top_col, bot_col, t))
    # Stretch the 1-px-wide gradient to full width
    img = img.resize((width, height), Image.NEAREST)
    return img

def drop_shadow(phone_img, radius=28, offset=(0, 12), shadow_col=(0,0,0,90)):
    """Return a shadow layer the same size as the iPad canvas."""
    shadow_layer = Image.new("RGBA", (W, H), (0,0,0,0))
    # Draw blurred shadow where the phone sits
    s = Image.new("RGBA", (PHONE_W + radius*4, PHONE_H + radius*4), (0,0,0,0))
    sd = ImageDraw.Draw(s)
    sd.rectangle([radius*2, radius*2, radius*2+PHONE_W, radius*2+PHONE_H],
                 fill=shadow_col)
    s = s.filter(ImageFilter.GaussianBlur(radius=radius))
    sx = PAD_X - radius*2 + offset[0]
    sy = PAD_Y - radius*2 + offset[1]
    shadow_layer.paste(s, (sx, sy), s)
    return shadow_layer

def phone_frame(draw, x, y, w, h, radius=40):
    """Draw a thin dark border around the phone screenshot to simulate a bezel."""
    draw.rounded_rectangle([x-3, y-3, x+w+3, y+h+3],
                            radius=radius+3, fill=None,
                            outline=(30,20,50,180), width=4)

def panel_decoration(canvas, key, cfg):
    """Draw brand decoration in the left/right panels."""
    draw  = ImageDraw.Draw(canvas)
    dark  = key in PANEL_TEXT_DARK
    col   = TEXT if dark else SURFACE

    # Subtle large circle (brand geometry)
    circle_r = 260
    # Left panel centre
    lx = PAD_X // 2
    ly = H // 2
    for r, a in [(circle_r+40, 18), (circle_r, 35)]:
        draw.ellipse([lx-r, ly-r, lx+r, ly+r],
                     fill=(*lerp_color(cfg["top"], cfg["bot"], 0.5), a))

    # Right panel centre
    rx = W - PAD_X // 2
    for r, a in [(circle_r+40, 18), (circle_r, 35)]:
        draw.ellipse([rx-r, ly-r, rx+r, ly+r],
                     fill=(*lerp_color(cfg["top"], cfg["bot"], 0.5), a))

    # App name + tagline, vertically centred in left panel
    try:
        from PIL import ImageFont
        def lf(sz, bold=False):
            for p in [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            ]:
                if os.path.exists(p):
                    return ImageFont.truetype(p, sz)
            return ImageFont.load_default()

        # Left panel text stack
        panel_cx = PAD_X // 2
        text_col  = (*col, 255) if isinstance(col, tuple) else (255,255,255,255)
        muted_col = (*lerp_color(col, (128,128,128), 0.3), 200)

        # App icon
        try:
            icon = Image.open(ICON).convert("RGBA")
            icon_size = 120
            icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
            mask = Image.new("L", (icon_size, icon_size), 0)
            md   = ImageDraw.Draw(mask)
            md.rounded_rectangle([0,0,icon_size,icon_size], radius=icon_size//4, fill=255)
            icon.putalpha(mask)
            ix = panel_cx - icon_size // 2
            iy = H // 2 - 260
            canvas.paste(icon, (ix, iy), icon)
        except Exception:
            pass

        # "TurbotaAI"
        f_name = lf(52, bold=True)
        draw.text((panel_cx, H//2 - 100), "TurbotaAI",
                  fill=text_col, font=f_name, anchor="mt")
        # tagline
        taglines = {
            "01-main":    "Your AI Companion",
            "02-chat":    "Chat. Anytime.",
            "03-premium": "Go Premium",
            "04-voice":   "Speak Freely",
        }
        f_tag = lf(34)
        draw.text((panel_cx, H//2 - 28), taglines.get(key, "AI Companion"),
                  fill=muted_col, font=f_tag, anchor="mt")
    except Exception:
        pass


def process(src_name, dst_name):
    key = src_name.replace(".png", "")
    cfg = PANEL_CONFIGS.get(key, PANEL_CONFIGS["01-main"])

    # 1 — Load and scale iPhone screenshot
    phone = Image.open(os.path.join(SRC, src_name)).convert("RGBA")
    phone = phone.resize((PHONE_W, PHONE_H), Image.LANCZOS)

    # 2 — Background: gradient panels
    canvas = Image.new("RGBA", (W, H), (255,255,255,255))

    # Left panel gradient
    lp = make_gradient(PAD_X + 60, H, cfg["top"], cfg["bot"]).convert("RGBA")
    canvas.paste(lp, (0, 0))

    # Right panel gradient
    rp = make_gradient(PAD_X + 60, H, cfg["top"], cfg["bot"]).convert("RGBA")
    canvas.paste(rp, (W - PAD_X - 60, 0))

    # Centre strip same as BG (matches phone edges so transition is smooth)
    mid = Image.new("RGBA", (PHONE_W + 120, H), (*BG, 255))
    canvas.paste(mid, (PAD_X - 60, 0))

    # 3 — Panel decorations (circles + text)
    panel_decoration(canvas, key, cfg)

    # 4 — Drop shadow
    shadow = drop_shadow(phone)
    canvas = Image.alpha_composite(canvas, shadow)

    # 5 — Paste phone screenshot
    canvas.paste(phone, (PAD_X, PAD_Y), phone)

    # 6 — Thin bezel line around phone
    draw = ImageDraw.Draw(canvas)
    phone_frame(draw, PAD_X, PAD_Y, PHONE_W, PHONE_H)

    # 7 — Save as RGB PNG
    out_path = os.path.join(OUT, dst_name)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


PAIRS = [
    ("01-main.png",    "01-main-ipad.png"),
    ("02-chat.png",    "02-chat-ipad.png"),
    ("03-premium.png", "03-premium-ipad.png"),
    ("04-voice.png",   "04-voice-ipad.png"),
]

if __name__ == "__main__":
    print(f"Generating {W}×{H} iPad screenshots → {OUT}/")
    results = []
    for src, dst in PAIRS:
        path = process(src, dst)
        results.append(path)
        print(f"  ✓  {dst}")

    print("\nVerification:")
    all_ok = True
    for path in results:
        img    = Image.open(path)
        ok     = img.size == (W, H)
        kb     = os.path.getsize(path) // 1024
        status = "✓" if ok else "✗ WRONG SIZE"
        print(f"  {status}  {os.path.basename(path)}  {img.size[0]}×{img.size[1]}  {kb} KB")
        if not ok:
            all_ok = False
    print()
    if all_ok:
        print("All iPad screenshots ready for App Store Connect.")
    else:
        print("ERROR: dimension mismatch — check output above.")
        sys.exit(1)
