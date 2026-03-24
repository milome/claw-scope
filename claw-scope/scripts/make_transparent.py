#!/usr/bin/env python3
"""Remove background residue (light blue, white halo) from logo to achieve clean transparency."""
from pathlib import Path
from typing import List

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("pip install Pillow numpy")
    raise

ICONS = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
PUBLIC = Path(__file__).resolve().parent.parent / "public"
SRC = ICONS / "icon.png"
OUT_ICON = ICONS / "icon.png"
OUT_LOGO = PUBLIC / "logo.png"


def sample_corner_colors(arr: np.ndarray, n: int = 8) -> List[List[float]]:
    """Sample background-ish colors from corners and edges."""
    h, w = arr.shape[:2]
    samples = []
    for i in range(n):
        x = min(i * w // (n + 2), w - 1)
        y = min(i * h // (n + 2), h - 1)
        for (cx, cy) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
            if arr.ndim == 3 and arr.shape[-1] >= 3:
                samples.append(arr[cy, cx, :3].astype(float).tolist())
    return samples[:16]


def rgb_to_transparent(img: Image.Image) -> Image.Image:
    arr = np.array(img)
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr, np.full_like(arr, 255)], axis=-1)
    elif arr.shape[-1] == 3:
        arr = np.concatenate([arr, np.full((*arr.shape[:2], 1), 255)], axis=-1)

    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    # 1. Direct masks: light blue / cyan / white (wider ranges)
    light_blue = (r > 170) & (g > 195) & (b > 215)
    near_white = (r > 225) & (g > 225) & (b > 225)
    cyan_tint = (b > 200) & (g > 200) & (r < g + 30)  # cyan-ish
    pale_blue = (r > 160) & (g > 180) & (b > 200) & ((r + g + b) > 500)

    mask = light_blue | near_white | cyan_tint | pale_blue

    # 2. Static reference colors (light blue gradient, cyan, white)
    refs = [
        [200, 225, 248],
        [210, 232, 250],
        [220, 235, 250],
        [225, 240, 252],
        [228, 242, 253],
        [235, 245, 255],
        [240, 248, 255],
        [248, 250, 255],
        [255, 255, 255],
    ]
    dist_threshold = 95  # more aggressive
    for ref in refs:
        dr = r.astype(float) - ref[0]
        dg = g.astype(float) - ref[1]
        db = b.astype(float) - ref[2]
        dist = np.sqrt(dr * dr + dg * dg + db * db)
        mask = mask | (dist < dist_threshold)

    # 3. Sample corners/edges and key out similar pixels
    corner_refs = sample_corner_colors(arr)
    for ref in corner_refs:
        if sum(ref) > 400:  # only use light pixels as bg
            dr = r.astype(float) - ref[0]
            dg = g.astype(float) - ref[1]
            db = b.astype(float) - ref[2]
            dist = np.sqrt(dr * dr + dg * dg + db * db)
            mask = mask | (dist < 85)

    arr[..., 3] = np.where(mask, 0, a)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def main():
    src_path = SRC
    if not src_path.exists():
        print(f"Source not found: {src_path}")
        return

    img = Image.open(src_path).convert("RGBA")
    out = rgb_to_transparent(img)
    out.save(OUT_ICON, "PNG")
    out.save(OUT_LOGO, "PNG")
    print(f"Saved: {OUT_ICON}, {OUT_LOGO}")


if __name__ == "__main__":
    main()
