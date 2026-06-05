"""Genera le icone PWA (PNG) dal crest LMN, replicato con PIL.

SVG sorgente: public/logo-mark.svg (esagono midnight, bordo oro, testo "LMN").
Output: public/icon-192.png, icon-512.png, apple-touch-icon.png (180).
Sfondo NON trasparente (richiesto per le icone della Home / maskable).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parent.parent / "public"

BG = (11, 16, 30)        # midnight pieno (più scuro del crest, per stacco)
HEX_FILL = (16, 23, 42)  # #10172A
GOLD = (224, 168, 46)    # #E0A82E (approx del gradiente oro)
GOLD_SOFT = (240, 205, 116)
INNER = (56, 65, 90)     # #38415A

# Punti dell'esagono nel viewBox 120x120 dell'SVG.
OUTER = [(60, 8), (105, 32), (105, 82), (60, 112), (15, 82), (15, 32)]
INNER_HEX = [(60, 16), (98, 36), (98, 78), (60, 103), (22, 78), (22, 36)]
CROWN = [(60, 30), (71, 38), (67, 51), (53, 51), (49, 38)]

SCALE = 0.82  # margine di sicurezza (maskable safe zone)


def _font(px: int) -> ImageFont.FreeTypeFont:
    for name in ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, px)
        except OSError:
            continue
    return ImageFont.load_default()


def render(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size * SCALE / 120.0

    def m(p):
        return (size / 2 + (p[0] - 60) * s, size / 2 + (p[1] - 60) * s)

    d.polygon([m(p) for p in OUTER], fill=HEX_FILL, outline=GOLD, width=max(2, round(size * 0.028)))
    d.polygon([m(p) for p in INNER_HEX], outline=INNER, width=max(1, round(size * 0.01)))
    d.polygon([m(p) for p in CROWN], outline=GOLD, width=max(1, round(size * 0.014)))

    txt = "LMN"
    fnt = _font(round(30 * s))
    cx, cy = m((60, 80))
    d.text((cx, cy), txt, font=fnt, fill=GOLD_SOFT, anchor="mm")
    return img


for fname, sz in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
    render(sz).save(PUBLIC / fname)
    print("wrote", fname, sz)
