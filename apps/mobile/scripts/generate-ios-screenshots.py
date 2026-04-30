#!/usr/bin/env python3
"""
TurbotaAI – iOS App Store screenshot generator
Target: 1284 × 2778 px (iPhone 14 Pro Max / 6.7-inch)
Run: python3 apps/mobile/scripts/generate-ios-screenshots.py
"""

from PIL import Image, ImageDraw, ImageFont
import os, sys

# ── dimensions ────────────────────────────────────────────────────────────────
W, H = 1284, 2778
OUT  = os.path.join(os.path.dirname(__file__), "..", "appstore-screenshots")
ICON = os.path.join(os.path.dirname(__file__), "..", "assets", "icon.png")
os.makedirs(OUT, exist_ok=True)

# ── brand colours ─────────────────────────────────────────────────────────────
PRIMARY       = "#7c3aed"
PRIMARY_DARK  = "#6d28d9"
PRIMARY_LIGHT = "#ede9fe"
BG            = "#f8fafc"
SURFACE       = "#ffffff"
SURFACE_ALT   = "#f1f5f9"
TEXT          = "#0f172a"
TEXT_SEC      = "#64748b"
TEXT_MUT      = "#94a3b8"
BORDER        = "#e2e8f0"
SUCCESS       = "#16a34a"
SUCCESS_LIGHT = "#dcfce7"
USER_BUBBLE   = "#7c3aed"
AI_BUBBLE     = "#f0fdf4"
AI_BORDER     = "#bbf7d0"

def hex2rgb(h, alpha=255):
    h = h.lstrip("#")
    r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    return (r, g, b, alpha)

# ── helpers ───────────────────────────────────────────────────────────────────
def new_canvas(bg=BG):
    img = Image.new("RGBA", (W, H), hex2rgb(bg))
    return img, ImageDraw.Draw(img)

def load_font(size, bold=False):
    """Best-effort font loading; falls back to default."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold
            else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def rounded_rect(draw, xy, radius, fill, outline=None, outline_width=2):
    x0, y0, x1, y1 = xy
    fill_rgb = hex2rgb(fill) if isinstance(fill, str) else fill
    out_rgb  = hex2rgb(outline) if isinstance(outline, str) else outline
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                           fill=fill_rgb,
                           outline=out_rgb if outline else None,
                           width=outline_width)

def draw_status_bar(draw, dark=False):
    """iOS-style status bar at top."""
    color = TEXT if dark else TEXT
    f = load_font(28, bold=True)
    draw.text((60, 70), "9:41", fill=hex2rgb(color), font=f)
    # battery / signal dots (simplified)
    for i in range(4):
        bx = W - 120 + i * 22
        draw.rounded_rectangle([bx, 72, bx+14, 88], radius=2, fill=hex2rgb(color))
    draw.rounded_rectangle([W-60, 68, W-48, 92], radius=2, fill=hex2rgb(color))

def draw_app_icon_small(canvas, x, y, size=56):
    """Paste a small rounded app icon."""
    try:
        icon = Image.open(ICON).convert("RGBA").resize((size, size), Image.LANCZOS)
        # round corners on icon
        mask = Image.new("L", (size, size), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, size, size], radius=size//4, fill=255)
        icon.putalpha(mask)
        canvas.paste(icon, (x, y), icon)
    except Exception:
        pass

def draw_tab_bar(draw, active="home"):
    """iOS tab bar at bottom."""
    bar_h = 120
    by = H - bar_h
    draw.rectangle([0, by, W, H], fill=hex2rgb(SURFACE))
    draw.line([(0, by), (W, by)], fill=hex2rgb(BORDER), width=2)
    tabs = [("🏠", "Home"), ("💬", "Chat"), ("🕐", "History"), ("👤", "Account")]
    tab_w = W // len(tabs)
    f_icon = load_font(38)
    f_lbl  = load_font(24)
    for i, (icon_ch, label) in enumerate(tabs):
        cx = i * tab_w + tab_w // 2
        col = PRIMARY if label.lower() == active else TEXT_MUT
        draw.text((cx, by + 14), icon_ch, fill=hex2rgb(col), font=f_icon, anchor="mt")
        draw.text((cx, by + 70), label, fill=hex2rgb(col), font=f_lbl, anchor="mt")

def text_block(draw, text, x, y, font, fill, max_width=None, align="left"):
    """Draw text, wrapping if max_width given. Returns final y."""
    if max_width is None:
        draw.text((x, y), text, font=font, fill=hex2rgb(fill) if isinstance(fill,str) else fill)
        bb = font.getbbox(text)
        return y + (bb[3] - bb[1]) + 8
    words = text.split()
    line, lines = "", []
    for w in words:
        test = (line + " " + w).strip()
        bb = font.getbbox(test)
        if bb[2] - bb[0] <= max_width:
            line = test
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    cy = y
    for ln in lines:
        draw.text((x, cy), ln, font=font,
                  fill=hex2rgb(fill) if isinstance(fill,str) else fill,
                  anchor="lt" if align=="left" else "mt")
        bb = font.getbbox(ln)
        cy += (bb[3] - bb[1]) + 10
    return cy

# ── SCREEN 1: Home / Main Assistant ───────────────────────────────────────────
def gen_home():
    canvas, draw = new_canvas(BG)
    draw_status_bar(draw)

    # Top header
    draw.rectangle([0, 0, W, 220], fill=hex2rgb(SURFACE))
    draw.line([(0, 220), (W, 220)], fill=hex2rgb(BORDER), width=2)
    draw_app_icon_small(canvas, 60, 80, size=80)
    f_title = load_font(42, bold=True)
    draw.text((164, 96), "TurbotaAI", fill=hex2rgb(TEXT), font=f_title)
    f_sub = load_font(28)
    draw.text((164, 150), "Your AI Companion", fill=hex2rgb(TEXT_SEC), font=f_sub)

    # Trial badge
    badge_x, badge_y = W - 260, 90
    rounded_rect(draw, [badge_x, badge_y, badge_x+190, badge_y+52],
                 radius=26, fill=PRIMARY_LIGHT)
    f_badge = load_font(26, bold=True)
    draw.text((badge_x + 95, badge_y + 26), "Trial (5 left)",
              fill=hex2rgb(PRIMARY), font=f_badge, anchor="mm")

    # Welcome text
    f_hero = load_font(54, bold=True)
    draw.text((W//2, 330), "Hello 👋", fill=hex2rgb(TEXT), font=f_hero, anchor="mt")
    f_desc = load_font(32)
    draw.text((W//2, 410), "Choose how you'd like to connect",
              fill=hex2rgb(TEXT_SEC), font=f_desc, anchor="mt")

    # 4 feature cards
    cards = [
        ("💬", "Chat with AI",       "Text conversation with your AI companion",       PRIMARY,   "#f5f3ff"),
        ("🎙️", "Voice Assistant",    "Hands-free voice conversation",                  "#10b981", "#ecfdf5"),
        ("🎥", "Video Assistant",    "Face-to-face video consultation",                "#0ea5e9", "#f0f9ff"),
        ("👤", "Account",            "Manage your profile and subscription",           "#8b5cf6", "#faf5ff"),
    ]
    card_margin = 48
    card_gap    = 28
    card_w      = W - card_margin * 2
    card_h      = 210
    cy          = 490
    f_card_title = load_font(36, bold=True)
    f_card_desc  = load_font(28)
    f_emoji      = load_font(56)

    for emoji, title, desc, accent, card_bg in cards:
        rounded_rect(draw, [card_margin, cy, card_margin + card_w, cy + card_h],
                     radius=24, fill=card_bg, outline=BORDER, outline_width=1)
        # accent bar
        draw.rounded_rectangle([card_margin, cy, card_margin+8, cy+card_h],
                                radius=4, fill=hex2rgb(accent))
        # emoji
        draw.text((card_margin + 48, cy + card_h//2 - 4), emoji,
                  fill=(0,0,0,255), font=f_emoji, anchor="lm")
        # title
        draw.text((card_margin + 128, cy + 52), title,
                  fill=hex2rgb(TEXT), font=f_card_title)
        # desc
        draw.text((card_margin + 128, cy + 100), desc,
                  fill=hex2rgb(TEXT_SEC), font=f_card_desc)
        # arrow
        draw.text((card_margin + card_w - 64, cy + card_h//2),
                  "›", fill=hex2rgb(accent), font=load_font(64, bold=True), anchor="mm")
        cy += card_h + card_gap

    draw_tab_bar(draw, active="home")

    out = os.path.join(OUT, "01-main.png")
    canvas.convert("RGB").save(out, "PNG")
    print(f"  ✓ {out}")
    return out

# ── SCREEN 2: Chat / AI Interaction ───────────────────────────────────────────
def gen_chat():
    canvas, draw = new_canvas(BG)
    draw_status_bar(draw)

    # Nav header
    draw.rectangle([0, 0, W, 200], fill=hex2rgb(SURFACE))
    draw.line([(0, 200), (W, 200)], fill=hex2rgb(BORDER), width=2)
    draw.text((80, 110), "‹", fill=hex2rgb(PRIMARY), font=load_font(72, bold=True))
    draw.text((W//2, 110), "Chat with AI",
              fill=hex2rgb(TEXT), font=load_font(44, bold=True), anchor="mm")

    # Chat messages
    messages = [
        ("user",
         "I've been feeling really anxious about work lately. I can't stop overthinking everything."),
        ("ai",
         "I hear you — that constant mental loop is exhausting. When you notice the overthinking starting, "
         "what tends to trigger it most? Is it specific tasks, certain people, or just the general workload?"),
        ("user",
         "Mostly deadlines. I panic as soon as I see a due date and my brain just spirals."),
        ("ai",
         "That makes a lot of sense. Deadlines create a sense of urgency that can hijack your nervous system. "
         "One thing that helps many people is breaking the task into the smallest possible first step — "
         "not the whole project, just the very next action. Would you like to try that together right now?"),
    ]

    pad   = 48
    cy    = 230
    f_msg = load_font(30)
    max_w = W - pad * 2 - 140

    for role, text in messages:
        is_user = role == "user"
        words   = text.split()
        lines, cur = [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if f_msg.getbbox(t)[2] <= max_w:
                cur = t
            else:
                if cur: lines.append(cur)
                cur = w
        if cur: lines.append(cur)

        line_h   = 40
        bubble_h = len(lines) * line_h + 40
        bubble_w = min(max_w + 60, W - 160)

        if is_user:
            bx = W - pad - bubble_w
            rounded_rect(draw, [bx, cy, bx + bubble_w, cy + bubble_h],
                         radius=20, fill=USER_BUBBLE)
            ty = cy + 20
            for ln in lines:
                draw.text((bx + 24, ty), ln, fill=(255,255,255,255), font=f_msg)
                ty += line_h
        else:
            bx = pad + 60
            rounded_rect(draw, [bx, cy, bx + bubble_w, cy + bubble_h],
                         radius=20, fill=AI_BUBBLE, outline=AI_BORDER)
            # small AI avatar dot
            draw.ellipse([pad, cy + bubble_h//2 - 20, pad + 40, cy + bubble_h//2 + 20],
                         fill=hex2rgb(SUCCESS_LIGHT), outline=hex2rgb(SUCCESS))
            draw.text((pad + 20, cy + bubble_h//2), "AI",
                      fill=hex2rgb(SUCCESS), font=load_font(20, bold=True), anchor="mm")
            ty = cy + 20
            for ln in lines:
                draw.text((bx + 24, ty), ln, fill=hex2rgb(TEXT), font=f_msg)
                ty += line_h

        cy += bubble_h + 28

    # Input bar
    input_y = H - 200
    draw.rectangle([0, input_y - 20, W, H], fill=hex2rgb(SURFACE))
    draw.line([(0, input_y - 20), (W, input_y - 20)], fill=hex2rgb(BORDER), width=2)
    rounded_rect(draw, [48, input_y + 10, W - 140, input_y + 90],
                 radius=45, fill=SURFACE_ALT, outline=BORDER)
    draw.text((90, input_y + 50), "Type a message…",
              fill=hex2rgb(TEXT_MUT), font=load_font(32), anchor="lm")
    # Send button
    draw.ellipse([W - 120, input_y + 10, W - 40, input_y + 90],
                 fill=hex2rgb(PRIMARY))
    draw.text((W - 80, input_y + 50), "➤",
              fill=(255,255,255,255), font=load_font(36, bold=True), anchor="mm")

    out = os.path.join(OUT, "02-chat.png")
    canvas.convert("RGB").save(out, "PNG")
    print(f"  ✓ {out}")
    return out

# ── SCREEN 3: Premium / Account ───────────────────────────────────────────────
def gen_premium():
    canvas, draw = new_canvas(BG)
    draw_status_bar(draw)

    # Header gradient simulation (two-tone rect)
    draw.rectangle([0, 0, W, 520], fill=hex2rgb(PRIMARY))
    draw.rectangle([0, 400, W, 520], fill=hex2rgb(PRIMARY_DARK))

    # App icon in header
    draw_app_icon_small(canvas, W//2 - 56, 130, size=112)

    draw.text((W//2, 280), "TurbotaAI Premium",
              fill=(255,255,255,255), font=load_font(50, bold=True), anchor="mt")
    draw.text((W//2, 356), "Unlimited access to your AI companion",
              fill=(220,210,255,255), font=load_font(30), anchor="mt")

    # White card
    card_top = 470
    rounded_rect(draw, [48, card_top, W - 48, H - 200],
                 radius=32, fill=SURFACE)

    cy = card_top + 60

    # Status row
    rounded_rect(draw, [96, cy, W - 96, cy + 90],
                 radius=20, fill=SUCCESS_LIGHT)
    draw.text((W//2, cy + 45), "✓  Premium Active",
              fill=hex2rgb(SUCCESS), font=load_font(36, bold=True), anchor="mm")
    cy += 130

    # Feature list
    features = [
        ("💬", "Unlimited chat messages"),
        ("🎙️", "Voice conversations, hands-free"),
        ("🎥", "Face-to-face video sessions"),
        ("🌍", "Supports 20+ languages"),
        ("🔒", "Private & secure — your data is yours"),
    ]
    f_feat = load_font(34)
    f_icon_feat = load_font(40)
    for icon_ch, feat_text in features:
        draw.text((110, cy + 4), icon_ch, fill=hex2rgb(PRIMARY), font=f_icon_feat)
        draw.text((186, cy + 8), feat_text, fill=hex2rgb(TEXT), font=f_feat)
        draw.line([(96, cy + 74), (W - 96, cy + 74)], fill=hex2rgb(BORDER), width=1)
        cy += 84

    cy += 20

    # Price block
    rounded_rect(draw, [96, cy, W - 96, cy + 160],
                 radius=24, fill=PRIMARY_LIGHT)
    draw.text((W//2, cy + 44), "Monthly Plan",
              fill=hex2rgb(PRIMARY_DARK), font=load_font(34, bold=True), anchor="mt")
    draw.text((W//2, cy + 96), "$12 / month",
              fill=hex2rgb(PRIMARY), font=load_font(52, bold=True), anchor="mt")
    cy += 200

    # Subscribe button
    rounded_rect(draw, [96, cy, W - 96, cy + 110],
                 radius=28, fill=PRIMARY)
    draw.text((W//2, cy + 55), "Subscribe Now",
              fill=(255,255,255,255), font=load_font(42, bold=True), anchor="mm")

    draw_tab_bar(draw, active="account")

    out = os.path.join(OUT, "03-premium.png")
    canvas.convert("RGB").save(out, "PNG")
    print(f"  ✓ {out}")
    return out

# ── SCREEN 4: Voice / Video landing (bonus) ───────────────────────────────────
def gen_voice():
    canvas, draw = new_canvas(BG)
    draw_status_bar(draw)

    # Full-bleed gradient header
    draw.rectangle([0, 0, W, H // 2 + 100], fill=hex2rgb("#0f172a"))
    # Subtle radial glow around mic
    for r in range(320, 0, -20):
        alpha = int(40 * (1 - r/320))
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd   = ImageDraw.Draw(glow)
        gd.ellipse([W//2 - r, 520 - r, W//2 + r, 520 + r],
                   fill=(124, 58, 237, alpha))
        canvas = Image.alpha_composite(canvas, glow)
    draw = ImageDraw.Draw(canvas)

    draw_app_icon_small(canvas, W//2 - 40, 140, size=80)
    draw.text((W//2, 256), "Voice Assistant",
              fill=(255,255,255,255), font=load_font(52, bold=True), anchor="mt")
    draw.text((W//2, 330), "Speak naturally, listen deeply",
              fill=(180,160,255,255), font=load_font(32), anchor="mt")

    # Mic button
    mic_cx, mic_cy, mic_r = W//2, 520, 130
    draw.ellipse([mic_cx-mic_r-20, mic_cy-mic_r-20, mic_cx+mic_r+20, mic_cy+mic_r+20],
                 fill=(124, 58, 237, 60))
    draw.ellipse([mic_cx-mic_r, mic_cy-mic_r, mic_cx+mic_r, mic_cy+mic_r],
                 fill=hex2rgb(PRIMARY))
    draw.text((mic_cx, mic_cy), "🎙️",
              fill=(255,255,255,255), font=load_font(110), anchor="mm")

    draw.text((W//2, mic_cy + mic_r + 48), "Tap to speak",
              fill=(180,160,255,255), font=load_font(36), anchor="mt")

    # Bottom card with description
    card_top = H // 2 + 160
    rounded_rect(draw, [48, card_top, W - 48, H - 160],
                 radius=32, fill=SURFACE)

    cy = card_top + 60
    draw.text((W//2, cy), "How it works",
              fill=hex2rgb(TEXT), font=load_font(40, bold=True), anchor="mt")
    cy += 80
    steps = [
        ("1", "Tap the mic button to begin"),
        ("2", "Speak your thoughts freely"),
        ("3", "AI responds in your language"),
    ]
    f_step = load_font(32)
    f_num  = load_font(30, bold=True)
    for num, step_text in steps:
        draw.ellipse([96, cy, 148, cy + 52],
                     fill=hex2rgb(PRIMARY_LIGHT))
        draw.text((122, cy + 26), num,
                  fill=hex2rgb(PRIMARY), font=f_num, anchor="mm")
        draw.text((174, cy + 26), step_text,
                  fill=hex2rgb(TEXT), font=f_step, anchor="lm")
        cy += 80

    draw_tab_bar(draw, active="home")

    out = os.path.join(OUT, "04-voice.png")
    canvas.convert("RGB").save(out, "PNG")
    print(f"  ✓ {out}")
    return out

# ── run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Generating {W}×{H} App Store screenshots → {OUT}/")
    files = [gen_home(), gen_chat(), gen_premium(), gen_voice()]

    print("\nVerification:")
    all_ok = True
    for f in files:
        img = Image.open(f)
        ok  = img.size == (W, H)
        kb  = os.path.getsize(f) // 1024
        status = "✓" if ok else "✗ WRONG SIZE"
        print(f"  {status}  {os.path.basename(f)}  {img.size[0]}×{img.size[1]}  {kb} KB")
        if not ok:
            all_ok = False
    print()
    if all_ok:
        print("All screenshots ready for App Store Connect.")
    else:
        print("Some screenshots have wrong dimensions — check output above.")
        sys.exit(1)
