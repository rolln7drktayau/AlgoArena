from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

ROOT = Path(__file__).resolve().parents[1]
FRONT_LOGO = ROOT / "frontend" / "public" / "logo.png"
DESKTOP_ICON_PNG = ROOT / "desktop" / "assets" / "icon.png"
DESKTOP_ICON_ICO = ROOT / "desktop" / "assets" / "icon.ico"
BRANDING_DIR = ROOT / "assets" / "branding"

COL_BG = (11, 18, 32, 255)
COL_BLUE = (59, 130, 246, 255)
COL_BLUE_DIM = (59, 130, 246, 102)
COL_CYAN = (45, 212, 191, 255)
COL_ORANGE = (245, 158, 11, 255)
COL_BLACK = (0, 0, 0, 255)


def bezier_points(p0, p1, p2, p3, steps=180):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1.0 - t
        x = (
            mt ** 3 * p0[0]
            + 3 * mt * mt * t * p1[0]
            + 3 * mt * t * t * p2[0]
            + t ** 3 * p3[0]
        )
        y = (
            mt ** 3 * p0[1]
            + 3 * mt * mt * t * p1[1]
            + 3 * mt * t * t * p2[1]
            + t ** 3 * p3[1]
        )
        pts.append((x, y))
    return pts


def draw_main_icon() -> Image.Image:
    img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle((0, 0, 1024, 1024), radius=200, fill=COL_BG)

    outer_hex = [(512, 180), (815, 355), (815, 705), (512, 880), (209, 705), (209, 355)]
    inner_hex = [(512, 250), (754, 390), (754, 670), (512, 810), (270, 670), (270, 390)]

    d.polygon(outer_hex, outline=COL_BLUE, width=40)
    d.polygon(inner_hex, outline=COL_BLUE_DIM, width=20)

    curve = bezier_points((320, 680), (320, 680), (380, 450), (700, 380), steps=220)
    d.line(curve, fill=COL_CYAN, width=45, joint="curve")

    d.ellipse((320 - 35, 680 - 35, 320 + 35, 680 + 35), fill=COL_ORANGE)
    d.ellipse((480 - 30, 460 - 30, 480 + 30, 460 + 30), fill=COL_CYAN)
    d.ellipse((700 - 35, 380 - 35, 700 + 35, 380 + 35), fill=COL_CYAN)

    return img


def draw_monochrome_icon() -> Image.Image:
    img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    outer_hex = [(512, 180), (815, 355), (815, 705), (512, 880), (209, 705), (209, 355)]
    d.polygon(outer_hex, outline=COL_BLACK, width=60)

    curve = bezier_points((320, 680), (320, 680), (380, 450), (700, 380), steps=220)
    d.line(curve, fill=COL_BLACK, width=50, joint="curve")
    d.ellipse((320 - 45, 680 - 45, 320 + 45, 680 + 45), fill=COL_BLACK)
    d.ellipse((700 - 45, 380 - 45, 700 + 45, 380 + 45), fill=COL_BLACK)

    return img


def draw_wordmark_png(icon_img: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (2400, 600), (255, 255, 255, 0))
    d = ImageDraw.Draw(canvas)

    icon_small = icon_img.resize((320, 320), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon_small, (100, 140))

    font_paths = [
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    title_font = None
    subtitle_font = None
    for fp in font_paths:
        if fp.exists():
            title_font = ImageFont.truetype(str(fp), 220)
            subtitle_font = ImageFont.truetype(str(fp), 54)
            break
    if title_font is None:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()

    d.text((550, 180), "AlgoArena", fill=(11, 18, 32, 255), font=title_font)
    d.text((560, 430), "BENCHMARKING & OPTIMIZATION", fill=(59, 130, 246, 255), font=subtitle_font)

    return canvas


def write_svg_files():
    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    main_svg = """<svg width=\"1024\" height=\"1024\" viewBox=\"0 0 1024 1024\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect width=\"1024\" height=\"1024\" rx=\"200\" fill=\"#0B1220\"/>\n  <path d=\"M512 180L815 355V705L512 880L209 705V355L512 180Z\" stroke=\"#3B82F6\" stroke-width=\"40\" stroke-linejoin=\"round\" opacity=\"0.8\"/>\n  <path d=\"M512 250L754 390V670L512 810L270 670V390L512 250Z\" stroke=\"#3B82F6\" stroke-width=\"20\" stroke-linejoin=\"round\" opacity=\"0.4\"/>\n  <path d=\"M320 680C320 680 380 450 700 380\" stroke=\"#2DD4BF\" stroke-width=\"45\" stroke-linecap=\"round\"/>\n  <circle cx=\"320\" cy=\"680\" r=\"35\" fill=\"#F59E0B\"/>\n  <circle cx=\"480\" cy=\"460\" r=\"30\" fill=\"#2DD4BF\"/>\n  <circle cx=\"700\" cy=\"380\" r=\"35\" fill=\"#2DD4BF\"/>\n</svg>\n"""

    mono_svg = """<svg width=\"1024\" height=\"1024\" viewBox=\"0 0 1024 1024\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M512 180L815 355V705L512 880L209 705V355L512 180Z\" stroke=\"black\" stroke-width=\"60\" stroke-linejoin=\"round\"/>\n  <path d=\"M320 680C320 680 380 450 700 380\" stroke=\"black\" stroke-width=\"50\" stroke-linecap=\"round\"/>\n  <circle cx=\"320\" cy=\"680\" r=\"45\" fill=\"black\"/>\n  <circle cx=\"700\" cy=\"380\" r=\"45\" fill=\"black\"/>\n</svg>\n"""

    wordmark_svg = """<svg width=\"2400\" height=\"600\" viewBox=\"0 0 2400 600\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g transform=\"translate(100, 100) scale(0.4)\">\n    <path d=\"M512 180L815 355V705L512 880L209 705V355L512 180Z\" stroke=\"#3B82F6\" stroke-width=\"40\" stroke-linejoin=\"round\"/>\n    <path d=\"M320 680C320 680 380 450 700 380\" stroke=\"#2DD4BF\" stroke-width=\"45\" stroke-linecap=\"round\"/>\n    <circle cx=\"320\" cy=\"680\" r=\"35\" fill=\"#F59E0B\"/>\n    <circle cx=\"700\" cy=\"380\" r=\"35\" fill=\"#2DD4BF\"/>\n  </g>\n  <text x=\"550\" y=\"380\" font-family=\"Arial, sans-serif\" font-weight=\"bold\" font-size=\"280\" fill=\"#0B1220\">AlgoArena</text>\n  <text x=\"560\" y=\"480\" font-family=\"Arial, sans-serif\" font-size=\"60\" fill=\"#3B82F6\" letter-spacing=\"5\">BENCHMARKING &amp; OPTIMIZATION</text>\n</svg>\n"""

    (BRANDING_DIR / "logo-main.svg").write_text(main_svg, encoding="utf-8")
    (BRANDING_DIR / "logo-monochrome.svg").write_text(mono_svg, encoding="utf-8")
    (BRANDING_DIR / "logo-wordmark.svg").write_text(wordmark_svg, encoding="utf-8")


def main():
    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    main_icon = draw_main_icon()
    mono_icon = draw_monochrome_icon()
    wordmark = draw_wordmark_png(main_icon)

    FRONT_LOGO.parent.mkdir(parents=True, exist_ok=True)
    DESKTOP_ICON_PNG.parent.mkdir(parents=True, exist_ok=True)

    main_icon.save(FRONT_LOGO, format="PNG")
    main_icon.save(DESKTOP_ICON_PNG, format="PNG")
    main_icon.save(
        DESKTOP_ICON_ICO,
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    mono_icon.save(BRANDING_DIR / "logo-monochrome.png", format="PNG")
    wordmark.save(BRANDING_DIR / "logo-wordmark.png", format="PNG")
    write_svg_files()

    print("Generated branding assets:")
    print(f"- {FRONT_LOGO}")
    print(f"- {DESKTOP_ICON_PNG}")
    print(f"- {DESKTOP_ICON_ICO}")
    print(f"- {BRANDING_DIR / 'logo-main.svg'}")
    print(f"- {BRANDING_DIR / 'logo-monochrome.svg'}")
    print(f"- {BRANDING_DIR / 'logo-wordmark.svg'}")


if __name__ == "__main__":
    main()
