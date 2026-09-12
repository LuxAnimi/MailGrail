#!/usr/bin/env python3
"""Bake the hero's cast light into a single bitmap.

The light is two full-size blurs, the wider of them 84px, and a blur's filter
region grows with its radius -- it is much the most expensive thing the hero
draws. It is also completely static: once it has faded in it never changes, and
it is deliberately held out of the pointer parallax. So it is rendered once,
here, into an image the browser simply draws.

It is baked by screenshotting the real page rather than by reimplementing the
projection offline. The light is a nested-perspective projection of the mark
from the light's camera, and any second implementation of that would be free to
disagree with the CSS; a screenshot cannot.

The trick that makes the capture exact is that the projection is defined
entirely in terms of the mark box -- perspective-origin, transform-origin and
the mask are all percentages of it -- so moving that box somewhere convenient
changes where the light lands and nothing about what it looks like. The box is
therefore pinned at (MARGIN, MARGIN) at its reference size and the window sized
to match, which makes the screenshot its own crop.

The two absolute lengths, the 845px focal distance and the blur radii, are the
exception: those do not scale with the box, so the bake is exact only at the
reference size. The hero hides the light below 60rem, so in practice it is only
ever shown between a 768px and an 800px box -- at worst about 4% off.

One-off asset pipeline, NOT part of the site build. Needs chromium and Pillow.
Re-run it whenever the light, the tilts, or the mark itself change:

    npm run bake:glow
"""

import functools
import http.server
import os
import pathlib
import re
import socketserver
import subprocess
import tempfile
import threading

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE.parent
REPO = WEB.parent
DIST = WEB / "dist"
OUT = WEB / "public/logo/glow.webp"

# The mark box at its reference size: min(50rem, 80vw), so 800px at any viewport
# wide enough to show the light at all.
BOX = 800

# Room around the box for the blur to spread into. The widest band is 84px, and
# a Gaussian is spent by about 3 sigma, so 320 clears it with room over.
MARGIN = 320
SIZE = BOX + MARGIN * 2

# Everything but the light, hidden; the light itself pinned to a known rect and
# frozen at its resting state rather than mid fade-in.
OVERRIDE = f"""
<style id="bake">
  /* The bake build already renders the light on its own -- no copy, no scrim,
     no mark -- so all that is left is to clear the page chrome and pin the
     mark box to a known rect.

     The hero sits inside <main><div class="wrap">, and .hero__mark is
     positioned against .hero rather than the viewport, so the wrapper's
     gutters and max-width have to be flattened too or the capture lands
     somewhere other than where the window was sized for. */
  html, body {{ background: transparent !important; }}
  body > *:not(main) {{ display: none !important; }}
  .wrap > *:not(.hero) {{ display: none !important; }}
  main, .wrap {{
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
  }}

  .hero {{
    position: absolute !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }}
  .hero__glowbox {{
    position: absolute !important;
    left: {MARGIN}px !important;
    top: {MARGIN}px !important;
    right: auto !important;
    bottom: auto !important;
    width: {BOX}px !important;
    height: {BOX}px !important;
    translate: none !important;
  }}
  .hero__lightbox {{ animation: none !important; opacity: 1 !important; }}

</style>
"""


def build(bake: bool) -> None:
    env = dict(os.environ)
    if bake:
        env["MG_BAKE_GLOW"] = "1"
    else:
        env.pop("MG_BAKE_GLOW", None)
    subprocess.run(
        ["npm", "run", "site:build"], cwd=REPO, env=env, check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def main() -> None:
    build(bake=True)

    html = (DIST / "index.html").read_text()
    if "hero__lightbox" not in html:
        raise SystemExit("bake build produced no .hero__lightbox -- is the flag wired up?")
    html = re.sub(r"</head>", OVERRIDE + "</head>", html, count=1)

    shot = DIST / "_bake.html"
    shot.write_text(html)
    try:
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td)

            # Served over HTTP, not opened as a file. The built page links its
            # stylesheet as /MailGrail/_astro/*.css, and under file:// that
            # absolute path resolves against the filesystem root and quietly
            # 404s -- the capture then comes out with no scoped CSS at all,
            # which looks like a mark that has lost its tilt rather than like a
            # missing stylesheet. The symlink reproduces the base path so those
            # absolute URLs resolve.
            (tmp / "MailGrail").symlink_to(DIST)
            handler = functools.partial(
                http.server.SimpleHTTPRequestHandler, directory=str(tmp)
            )
            httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
            httpd.allow_reuse_address = True
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            port = httpd.server_address[1]

            png = tmp / "glow.png"
            try:
                subprocess.run(
                    [
                        "chromium", "--headless", "--disable-gpu", "--no-sandbox",
                        "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--default-background-color=00000000",
                        f"--window-size={SIZE},{SIZE}",
                        "--virtual-time-budget=8000",
                        f"--screenshot={png}",
                        f"http://127.0.0.1:{port}/MailGrail/_bake.html",
                    ],
                    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
            finally:
                httpd.shutdown()
                httpd.server_close()

            im = Image.open(png).convert("RGBA")
            if im.size != (SIZE, SIZE):
                im = im.resize((SIZE, SIZE), Image.LANCZOS)
            if not im.getbbox():
                raise SystemExit("captured nothing -- did the override hide the light too?")
            OUT.parent.mkdir(parents=True, exist_ok=True)
            im.save(OUT, "WEBP", quality=92, method=6)
    finally:
        if shot.exists():
            shot.unlink()

    build(bake=False)

    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(REPO)} ({SIZE}x{SIZE}, {kb:.0f} KB)")


if __name__ == "__main__":
    main()
