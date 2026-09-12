#!/usr/bin/env python3
"""Bake the hero's neon spill into a single image.

The spill is the light the lit strokes throw onto the flat page behind them.
Distance to that page varies across the mark's width, so the light is tight at
one edge and diffuse at the other -- which CSS can only express by stacking
blurred, masked copies. That came to twenty filtered layers compositing on
every frame, and it lagged the page.

None of it is dynamic: it never changes after its fade-in. So it is rendered
here instead, once, into one image the browser simply draws.

One-off asset pipeline, NOT part of the site build -- it needs librsvg's
rsvg-convert and Pillow. Re-run it when the mark or the band table changes:

    python3 website/scripts/render-spill.py
"""

import pathlib
import re
import subprocess
import tempfile

from PIL import Image, ImageColor, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
SOURCE = REPO / "website/public/logo/mailgrail.svg"
OUT = REPO / "website/public/logo/spill.webp"

# Rendered wide enough that a 95px blur at display size stays smooth. The
# output is nothing but soft gradients, so it survives scaling easily.
WIDTH = 1600
STROKE = 26

# Bands across the mark's width, far edge first. `span` is the band's slice of
# that width as (start, full-in, full-out, end); the spans overlap so
# neighbouring bands cross-fade instead of banding.
#
# The tightest band still gets a little blur: with none it reads as a duplicate
# outline rather than as light landing on a surface. The contact end is
# compressed into the first fifth of the width and the diffuse end given the
# rest, because that is how a lifted edge behaves -- sharpness is lost quickly
# at first and then the light just keeps spreading.
#
# Weight *rises* with blur rather than falling. Distance does dim light, but
# the blur already does that: a 95px blur spreads a stroke's energy so thin it
# vanishes on its own. Falling weights on top of that dimmed it twice and the
# spill died out well before the near edge.
BANDS = [
    (5, 0.72, (0.00, 0.00, 0.09, 0.22)),
    (14, 0.80, (0.07, 0.19, 0.31, 0.46)),
    (30, 0.88, (0.28, 0.42, 0.55, 0.70)),
    (56, 0.95, (0.52, 0.66, 0.78, 0.92)),
    (95, 1.00, (0.74, 0.88, 1.00, 1.00)),
]

LAYERS = [
    ("mg-envelope", "#D7DADD", 0.44),
    ("mg-grail", "#FFC840", 1.00),
]


def render_layer(layer_id: str, colour: str, tmp: pathlib.Path) -> Image.Image:
    """Rasterise one layer of the mark on its own, at STROKE weight."""
    svg = SOURCE.read_text()
    head = svg.split("<g ", 1)[0]

    group = re.search(
        rf'<g id="{layer_id}".*?</g>', svg, re.S
    ).group(0)
    group = re.sub(r'stroke="[^"]*"', f'stroke="{colour}"', group, count=1)

    head = re.sub(r'stroke-width="\d+"', f'stroke-width="{STROKE}"', head)

    path = tmp / f"{layer_id}.svg"
    path.write_text(f"{head}{group}\n</svg>\n")

    png = tmp / f"{layer_id}.png"
    subprocess.run(
        ["rsvg-convert", "-w", str(WIDTH), "-h", str(WIDTH), str(path), "-o", str(png)],
        check=True,
    )
    return Image.open(png).convert("RGBA")


def band_mask(size: int, span) -> Image.Image:
    """A horizontal ramp: transparent, up to full across the band, back down."""
    a, b, c, d = (int(v * size) for v in span)
    mask = Image.new("L", (size, 1), 0)
    px = mask.load()
    for x in range(size):
        if x < a or x > d:
            v = 0
        elif x < b:
            v = 255 * (x - a) // max(1, b - a)
        elif x <= c:
            v = 255
        else:
            v = 255 * (d - x) // max(1, d - c)
        px[x, 0] = max(0, min(255, v))
    return mask.resize((size, size))


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        out = Image.new("RGBA", (WIDTH, WIDTH), (0, 0, 0, 0))

        for layer_id, colour, layer_weight in LAYERS:
            base = render_layer(layer_id, colour, tmp)

            # The layer is one flat colour, so all the blur has to carry is
            # coverage. Blurring the RGBA image instead would average the
            # stroke's colour against the transparent black around it -- PIL
            # blurs channels independently, unpremultiplied -- and the halo
            # would come out both fainter and dirtier than CSS's, which blurs
            # premultiplied. Blurring the alpha alone is exact here.
            coverage = base.getchannel("A")
            flat = Image.new("RGBA", base.size, ImageColor.getrgb(colour) + (0,))

            for blur, weight, span in BANDS:
                # blur radius scales with the render size, since the CSS values
                # are in display pixels against a ~1088px mark
                radius = blur * WIDTH / 1088

                alpha = coverage.filter(ImageFilter.GaussianBlur(radius))
                alpha = alpha.point(lambda v, w=weight * layer_weight: int(v * w))
                alpha = Image.composite(
                    alpha, Image.new("L", alpha.size, 0), band_mask(WIDTH, span)
                )

                band = flat.copy()
                band.putalpha(alpha)

                out = Image.alpha_composite(out, band)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        out.save(OUT, "WEBP", quality=88, method=6)

    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(REPO)} ({WIDTH}x{WIDTH}, {kb:.0f} KB)")


if __name__ == "__main__":
    main()
