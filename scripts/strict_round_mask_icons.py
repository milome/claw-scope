#!/usr/bin/env python3
"""Apply a strict rounded mask to icon PNGs so no rectangular matte remains."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
ROOT_ICONS = [ROOT / "icon-source.png", ROOT / "icon.png"]
TAURI_ICON_DIR = ROOT / "src-tauri" / "icons"
ALPHA_CUTOFF = 128
SUPER_SAMPLE = 8


def build_mask(size: tuple[int, int]) -> Image.Image:
    width, height = size
    base = min(width, height)
    inset = max(0, round(base * 0.012))
    radius = max(1, round(base * 0.152))

    large_size = (width * SUPER_SAMPLE, height * SUPER_SAMPLE)
    large_mask = Image.new("L", large_size, 0)
    draw = ImageDraw.Draw(large_mask)
    draw.rounded_rectangle(
        (
            inset * SUPER_SAMPLE,
            inset * SUPER_SAMPLE,
            (width - 1 - inset) * SUPER_SAMPLE,
            (height - 1 - inset) * SUPER_SAMPLE,
        ),
        radius=radius * SUPER_SAMPLE,
        fill=255,
    )
    return large_mask.resize(size, Image.Resampling.LANCZOS)


def remask_png(path: Path) -> bool:
    image = Image.open(path).convert("RGBA")
    mask = build_mask(image.size)
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.paste(image, (0, 0), mask)

    changed = False
    pixels = []
    for r, g, b, a in output.getdata():
        if a < ALPHA_CUTOFF:
            if (r, g, b, a) != (0, 0, 0, 0):
                changed = True
            pixels.append((0, 0, 0, 0))
        else:
            pixels.append((r, g, b, a))
    if changed:
        output.putdata(pixels)
        output.save(path)
    return changed


def iter_targets() -> list[Path]:
    files = [path for path in ROOT_ICONS if path.exists()]
    files.extend(sorted(TAURI_ICON_DIR.rglob("*.png")))
    return files


def main() -> None:
    changed_files = []
    for path in iter_targets():
        if remask_png(path):
            changed_files.append(path)
            print(f"normalized {path.relative_to(ROOT)}")

    if not changed_files:
        print("no icon pngs required additional normalization")


if __name__ == "__main__":
    main()
