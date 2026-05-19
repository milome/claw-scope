from __future__ import annotations

import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
BACKGROUND = ROOT / "public/images/covers/clawscope-cover-bg-v3.png"
ICON = ROOT / "icon-source.png"
OUT_DIR = ROOT / "public/images/covers"
LOCALE = os.environ.get("COVER_LOCALE", "zh").strip().lower()
IS_EN = LOCALE in {"en", "eng", "english"}
OUTPUT_VERSION = "v4"
OUTPUT_SUFFIX = "-en" if IS_EN else ""
OUT_STATIC = OUT_DIR / f"clawscope-cover-{OUTPUT_VERSION}-final{OUTPUT_SUFFIX}.png"
OUT_WEBP = OUT_DIR / f"clawscope-cover-{OUTPUT_VERSION}-animated{OUTPUT_SUFFIX}.webp"
OUT_GIF = OUT_DIR / f"clawscope-cover-{OUTPUT_VERSION}-animated{OUTPUT_SUFFIX}.gif"
OUT_META = OUT_DIR / f"clawscope-cover-{OUTPUT_VERSION}-final{OUTPUT_SUFFIX}.meta.txt"

LATIN_FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
LATIN_FONT = Path(r"C:\Windows\Fonts\segoeui.ttf")
SC_FONT = Path(r"C:\Windows\Fonts\NotoSansSC-VF.ttf")

CANVAS = (3840, 2160)
ICON_CENTER = (860, 1080)
ICON_SIZE = 900


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def ease_in_out(value: float) -> float:
    return 0.5 - 0.5 * math.cos(math.tau * value)


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color[0], color[1], color[2], alpha


def radial_layer(size: tuple[int, int], inner: tuple[int, int, int, int], outer: tuple[int, int, int, int]) -> Image.Image:
    width, height = size
    y, x = np.ogrid[-1:1:height * 1j, -1:1:width * 1j]
    distance = np.sqrt(x * x + y * y)
    t = np.clip(distance, 0, 1) ** 1.35
    inner_arr = np.array(inner, dtype=np.float32)
    outer_arr = np.array(outer, dtype=np.float32)
    arr = inner_arr * (1 - t[..., None]) + outer_arr * t[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def paste_center(base: Image.Image, layer: Image.Image, center: tuple[float, float]) -> None:
    x = int(round(center[0] - layer.width / 2))
    y = int(round(center[1] - layer.height / 2))
    base.alpha_composite(layer, (x, y))


def scaled_alpha(mask: Image.Image, factor: float) -> Image.Image:
    return mask.point(lambda p: max(0, min(255, int(p * factor))))


def layer_from_alpha(size: tuple[int, int], color: tuple[int, int, int], alpha: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", size, (*color, 0))
    layer.putalpha(alpha)
    return layer


def bezier(points: tuple[tuple[float, float], tuple[float, float], tuple[float, float], tuple[float, float]], steps: int = 80) -> list[tuple[float, float]]:
    p0, p1, p2, p3 = points
    result: list[tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        result.append((x, y))
    return result


def scale_points(points: list[tuple[float, float]], scale: float) -> list[tuple[float, float]]:
    return [(x * scale, y * scale) for x, y in points]


def draw_polyline(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: tuple[int, int, int, int], width: int) -> None:
    if len(points) > 1:
        draw.line(points, fill=fill, width=max(1, width), joint="curve")


def draw_flow(
    overlay: Image.Image,
    points: list[tuple[float, float]],
    color: tuple[int, int, int],
    scale: float,
    phase: float,
    alpha: int = 92,
    width: int = 10,
) -> None:
    soft = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    soft_draw = ImageDraw.Draw(soft)
    draw_polyline(soft_draw, points, rgba(color, alpha), int(width * scale))
    overlay.alpha_composite(soft.filter(ImageFilter.GaussianBlur(max(1, int(4 * scale)))))

    crisp = ImageDraw.Draw(overlay)
    draw_polyline(crisp, points, rgba(color, min(210, alpha + 70)), max(1, int(3 * scale)))

    if len(points) < 2:
        return

    for offset, radius, dot_alpha in ((0.0, 13, 220), (0.22, 8, 150), (0.45, 5, 110)):
        idx = int(((phase + offset) % 1) * (len(points) - 1))
        x, y = points[idx]
        r = max(2, int(radius * scale))
        crisp.ellipse((x - r, y - r, x + r, y + r), fill=rgba(color, dot_alpha))
        crisp.ellipse((x - r * 0.42, y - r * 0.42, x + r * 0.42, y + r * 0.42), fill=(255, 255, 255, min(220, dot_alpha)))


def draw_icon(base: Image.Image, scale: float, phase: float = 0.0, animated: bool = False) -> None:
    icon_size = int(round(ICON_SIZE * scale))
    center = (ICON_CENTER[0] * scale, ICON_CENTER[1] * scale)
    source = Image.open(ICON).convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    alpha = source.getchannel("A")

    glow_strength = 1.0 + (0.12 * math.sin(math.tau * phase) if animated else 0.0)
    halo_size = int(round(1350 * scale))
    halo = radial_layer(
        (halo_size, halo_size),
        (190, 250, 255, int(160 * glow_strength)),
        (190, 250, 255, 0),
    ).filter(ImageFilter.GaussianBlur(max(1, int(18 * scale))))
    paste_center(base, halo, center)

    coral = radial_layer(
        (int(1100 * scale), int(900 * scale)),
        (255, 112, 94, int(62 * glow_strength)),
        (255, 112, 94, 0),
    ).filter(ImageFilter.GaussianBlur(max(1, int(28 * scale))))
    paste_center(base, coral, (center[0] - 190 * scale, center[1] - 70 * scale))

    blue_alpha = scaled_alpha(alpha.filter(ImageFilter.GaussianBlur(max(1, int(18 * scale)))), 0.18)
    blue_glow = layer_from_alpha((icon_size, icon_size), (72, 218, 255), blue_alpha)
    base.alpha_composite(
        blue_glow,
        (
            int(round(center[0] - icon_size / 2)),
            int(round(center[1] - icon_size / 2)),
        ),
    )

    coral_alpha = scaled_alpha(alpha.filter(ImageFilter.GaussianBlur(max(1, int(24 * scale)))), 0.10)
    coral_glow = layer_from_alpha((icon_size, icon_size), (255, 96, 78), coral_alpha)
    base.alpha_composite(
        coral_glow,
        (
            int(round(center[0] - icon_size / 2 - 28 * scale)),
            int(round(center[1] - icon_size / 2 - 12 * scale)),
        ),
    )

    outer = alpha.filter(ImageFilter.GaussianBlur(max(1, int(10 * scale))))
    inner = alpha.filter(ImageFilter.GaussianBlur(max(1, int(2 * scale))))
    edge_alpha = scaled_alpha(ImageChops.subtract(outer, inner), 0.46)
    edge_glow = layer_from_alpha((icon_size, icon_size), (235, 255, 255), edge_alpha)
    base.alpha_composite(
        edge_glow,
        (
            int(round(center[0] - icon_size / 2 - 2 * scale)),
            int(round(center[1] - icon_size / 2 - 4 * scale)),
        ),
    )

    bevel = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
    bevel_draw = ImageDraw.Draw(bevel)
    bevel_draw.rounded_rectangle(
        (
            8 * scale,
            8 * scale,
            icon_size - 8 * scale,
            icon_size - 8 * scale,
        ),
        radius=118 * scale,
        outline=(255, 255, 255, 120),
        width=max(1, int(5 * scale)),
    )
    bevel_draw.arc(
        (
            18 * scale,
            18 * scale,
            icon_size - 18 * scale,
            icon_size - 18 * scale,
        ),
        start=198,
        end=318,
        fill=(128, 245, 255, 112),
        width=max(1, int(8 * scale)),
    )
    bevel_draw.arc(
        (
            20 * scale,
            20 * scale,
            icon_size - 20 * scale,
            icon_size - 20 * scale,
        ),
        start=36,
        end=128,
        fill=(255, 125, 98, 80),
        width=max(1, int(7 * scale)),
    )
    bevel.putalpha(ImageChops.multiply(bevel.getchannel("A"), alpha))
    base.alpha_composite(
        bevel,
        (
            int(round(center[0] - icon_size / 2)),
            int(round(center[1] - icon_size / 2)),
        ),
    )

    base.alpha_composite(source, (int(round(center[0] - icon_size / 2)), int(round(center[1] - icon_size / 2))))


def draw_badge(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, color: tuple[int, int, int], scale: float) -> None:
    label_font = font(LATIN_FONT_BOLD, max(10, int(39 * scale)))
    pad_x = 30 * scale
    pad_y = 18 * scale
    dot = 17 * scale
    box = draw.textbbox((0, 0), text, font=label_font)
    width = (box[2] - box[0]) + pad_x * 2 + dot * 2
    height = (box[3] - box[1]) + pad_y * 2
    x, y = xy
    radius = height / 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=radius, fill=(255, 255, 255, 128), outline=rgba(color, 115), width=max(1, int(2 * scale)))
    draw.ellipse((x + pad_x, y + height / 2 - dot / 2, x + pad_x + dot, y + height / 2 + dot / 2), fill=rgba(color, 230))
    draw.text((x + pad_x + dot + 16 * scale, y + height / 2), text, font=label_font, fill=(22, 68, 92, 235), anchor="lm")


def draw_typography(base: Image.Image, scale: float) -> None:
    veil = radial_layer(
        (int(1780 * scale), int(1040 * scale)),
        (255, 255, 255, 120),
        (255, 255, 255, 0),
    ).filter(ImageFilter.GaussianBlur(max(1, int(24 * scale))))
    paste_center(base, veil, (2220 * scale, 920 * scale))

    draw = ImageDraw.Draw(base)
    title_font = font(LATIN_FONT_BOLD, max(24, int(286 * scale)))
    slogan_font = font(LATIN_FONT_BOLD if IS_EN else SC_FONT, max(20, int((98 if IS_EN else 116) * scale)))
    sub_font = font(LATIN_FONT if IS_EN else SC_FONT, max(12, int((60 if IS_EN else 68) * scale)))
    label_font = font(LATIN_FONT_BOLD, max(10, int(42 * scale)))

    x = 1420 * scale
    y = 560 * scale
    badge_text = "OPENCLAW ECOSYSTEM"
    badge_w = draw.textlength(badge_text, font=label_font) + 148 * scale
    badge_h = 78 * scale
    draw.rounded_rectangle(
        (x, y - 108 * scale, x + badge_w, y - 108 * scale + badge_h),
        radius=badge_h / 2,
        fill=(255, 255, 255, 132),
        outline=(14, 165, 233, 128),
        width=max(1, int(2 * scale)),
    )
    draw.ellipse(
        (x + 30 * scale, y - 84 * scale, x + 58 * scale, y - 56 * scale),
        fill=(14, 165, 233, 235),
    )
    draw.ellipse(
        (x + 66 * scale, y - 84 * scale, x + 94 * scale, y - 56 * scale),
        fill=(244, 91, 77, 225),
    )
    draw.line((x + 58 * scale, y - 70 * scale, x + 66 * scale, y - 70 * scale), fill=(13, 148, 136, 200), width=max(1, int(4 * scale)))
    draw.text((x + 116 * scale, y - 70 * scale), badge_text, font=label_font, fill=(13, 71, 95, 235), anchor="lm")

    title = "ClawScope"
    draw.text((x + 10 * scale, y + 14 * scale), title, font=title_font, fill=(255, 255, 255, 135), stroke_width=max(1, int(3 * scale)), stroke_fill=(255, 255, 255, 120))
    draw.text((x, y), title, font=title_font, fill=(5, 37, 66, 255), stroke_width=max(1, int(3 * scale)), stroke_fill=(255, 255, 255, 145))

    slogan = "Memory Made Visible, Evolution Enabled" if IS_EN else "记忆可见，进化可期"
    sy = y + 370 * scale
    slogan_color = (4, 50, 76, 255)
    # Same-color micro-offsets create weight without a visible shadow or outline.
    for dx, dy in ((0, 0), (1 * scale, 0), (0, 1 * scale), (1 * scale, 1 * scale)):
        draw.text((x + dx, sy + dy), slogan, font=slogan_font, fill=slogan_color)

    sub = (
        "OpenClaw memory visibility, search, and evolution workspace"
        if IS_EN
        else "OpenClaw 生态里的记忆可视化、知识检索与 Agent 进化工作台"
    )
    draw.text(
        (x, sy + 154 * scale),
        sub,
        font=sub_font,
        fill=(3, 45, 67, 255),
        stroke_width=max(1, int(2 * scale)),
        stroke_fill=(195, 249, 255, 190),
    )

    chips = [
        ("Gateway", (14, 165, 233)),
        ("Agents", (139, 92, 246)),
        ("Memory", (6, 182, 212)),
        ("Knowledge Graph", (16, 185, 129)),
        ("Evolution Diff", (244, 91, 77)),
        ("Rollback", (245, 158, 11)),
    ]
    cx = x
    cy = sy + 280 * scale
    for text, color in chips:
        draw_badge(draw, (cx, cy), text, color, scale)
        text_width = draw.textlength(text, font=font(LATIN_FONT_BOLD, max(10, int(39 * scale))))
        cx += text_width + 150 * scale
        if cx > 3600 * scale:
            cx = x
            cy += 92 * scale


def draw_ecosystem_overlay(base: Image.Image, scale: float, phase: float, animated: bool) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))

    raw_paths = [
        (((1260, 840), (1610, 640), (2040, 690), (2410, 860)), (14, 165, 233), 0.08),
        (((1300, 1080), (1700, 970), (2050, 1120), (2480, 1170)), (16, 185, 129), 0.34),
        (((1250, 1320), (1580, 1530), (2060, 1460), (2620, 1490)), (244, 91, 77), 0.58),
        (((1420, 1250), (1880, 1300), (2220, 1040), (2950, 1190)), (139, 92, 246), 0.72),
    ]

    for raw, color, offset in raw_paths:
        points = scale_points(bezier(raw, 95), scale)
        local_phase = (phase + offset) % 1 if animated else offset
        draw_flow(overlay, points, color, scale, local_phase)

    draw = ImageDraw.Draw(overlay)
    ripple_centers = [(3000 * scale, 1265 * scale), (2460 * scale, 895 * scale)]
    for center_x, center_y in ripple_centers:
        for i in range(3):
            p = (phase + i / 3) % 1 if animated else i / 3
            radius = (70 + 210 * p) * scale
            alpha = int(115 * (1 - p))
            draw.ellipse(
                (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
                outline=(14, 165, 233, alpha),
                width=max(1, int(5 * scale)),
            )

    hub = (2530 * scale, 1390 * scale)
    pulse = 1.0 + (0.16 * math.sin(math.tau * phase) if animated else 0.0)
    for radius, color, alpha in ((98, (14, 165, 233), 60), (64, (255, 255, 255), 150), (34, (14, 165, 233), 220)):
        r = radius * scale * pulse
        draw.ellipse((hub[0] - r, hub[1] - r, hub[0] + r, hub[1] + r), fill=rgba(color, alpha))
    draw.ellipse(
        (hub[0] - 30 * scale, hub[1] - 30 * scale, hub[0] + 30 * scale, hub[1] + 30 * scale),
        outline=(255, 255, 255, 220),
        width=max(1, int(4 * scale)),
    )

    base.alpha_composite(overlay)


def render(scale: float = 1.0, phase: float = 0.0, animated: bool = False) -> Image.Image:
    width = int(round(CANVAS[0] * scale))
    height = int(round(CANVAS[1] * scale))
    base = Image.open(BACKGROUND).convert("RGBA")
    if scale != 1.0:
        base = base.resize((width, height), Image.Resampling.LANCZOS)

    # This is a soft wash, not an icon container; it hides model noise under the future app icon.
    focus = radial_layer(
        (int(1320 * scale), int(1320 * scale)),
        (210, 255, 255, 120),
        (210, 255, 255, 0),
    ).filter(ImageFilter.GaussianBlur(max(1, int(30 * scale))))
    paste_center(base, focus, (ICON_CENTER[0] * scale, ICON_CENTER[1] * scale))

    draw_ecosystem_overlay(base, scale, phase, animated)
    draw_icon(base, scale, phase, animated)
    draw_typography(base, scale)
    return base.convert("RGB")


def save_animated() -> None:
    webp_scale = 0.5
    gif_scale = 1 / 3
    frame_count = 24
    duration = 70

    webp_frames = [render(webp_scale, i / frame_count, True) for i in range(frame_count)]
    webp_frames[0].save(
        OUT_WEBP,
        save_all=True,
        append_images=webp_frames[1:],
        duration=duration,
        loop=0,
        quality=82,
        method=4,
    )

    gif_frames = [frame.resize((1280, 720), Image.Resampling.LANCZOS) for frame in webp_frames]
    palette = gif_frames[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
    paletted = [palette] + [frame.quantize(palette=palette) for frame in gif_frames[1:]]
    paletted[0].save(
        OUT_GIF,
        save_all=True,
        append_images=paletted[1:],
        duration=duration,
        loop=0,
        optimize=True,
        disposal=2,
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    static = render(1.0, 0.0, False)
    static.save(OUT_STATIC, quality=96)
    save_animated()

    OUT_META.write_text(
        "\n".join(
            [
                "ClawScope README cover post-processing",
                f"locale={LOCALE}",
                f"background={BACKGROUND}",
                f"icon={ICON}",
                f"static={OUT_STATIC}",
                f"animated_webp={OUT_WEBP}",
                f"animated_gif={OUT_GIF}",
                f"canvas={CANVAS[0]}x{CANVAS[1]}",
                f"icon_display={ICON_SIZE}x{ICON_SIZE}",
                f"icon_center={ICON_CENTER}",
                "icon_policy=uniform upscale from icon-source.png, preserve silhouette/proportions/colors/transparency; no redraw or recolor",
                "motion_language=flowing memory currents, pulsing knowledge nodes, semantic search ripples, OpenClaw ecosystem paths, evolution diff streams",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    for path in (OUT_STATIC, OUT_WEBP, OUT_GIF, OUT_META):
        print(path.relative_to(ROOT), path.stat().st_size)


if __name__ == "__main__":
    main()
