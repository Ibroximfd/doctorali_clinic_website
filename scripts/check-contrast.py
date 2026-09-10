"""
WCAG AA audit of the design tokens — run it after touching the palette.

    python3 scripts/check-contrast.py src/app/globals.css

It checks the pairs the UI actually renders, which is the part a colour picker
cannot tell you: body text on each of the three surfaces, a solid fill with its
own foreground token, and — the one that catches everything — each status
colour as TEXT INSIDE ITS OWN 12% TINT, because that is how every chip and pill
in the panel is built. Exits non-zero if anything fails.
"""
import sys, re, json

def hex_to_rgb(h):
    h = h.strip().lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lum(rgb):
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(fg, bg):
    a, b = lum(hex_to_rgb(fg)), lum(hex_to_rgb(bg))
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

def over(fg, bg, alpha):
    """Composite `fg` at `alpha` over `bg` — what a `bg-x/12` chip really is."""
    f, b = hex_to_rgb(fg), hex_to_rgb(bg)
    return "#%02x%02x%02x" % tuple(round(f[i] * alpha + b[i] * (1 - alpha)) for i in range(3))

def parse(css, selector):
    block = re.search(selector + r"\s*\{(.*?)\n\}", css, re.S).group(1)
    return dict(re.findall(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", block))

css = open(sys.argv[1]).read()
themes = {"light": parse(css, r":root"), "dark": parse(css, r"\.dark")}

FAIL = []
for name, t in themes.items():
    surf, alt, bg = t["surface"], t["surface-alt"], t["background"]
    checks = []
    # Body text on the three surfaces.
    for fg in ["text-primary", "text-secondary", "text-tertiary", "foreground", "muted-foreground"]:
        for bgname, bgv in (("surface", surf), ("surface-alt", alt), ("background", bg)):
            checks.append((f"{fg} on {bgname}", t[fg], bgv, 4.5))
    # Solid buttons.
    checks.append(("primary-foreground on primary", t["primary-foreground"], t["primary"], 4.5))
    checks.append(("danger-foreground on danger", t["danger-foreground"], t["danger"], 4.5))
    # Status text inside its own 12% tint — how every chip in the app is built.
    for token in ["primary", "primary-dark", "success", "warning", "danger", "info", "gold"]:
        checks.append((f"{token} in 12% chip", t[token], over(t[token], surf, 0.12), 4.5))
        checks.append((f"{token} plain on surface", t[token], surf, 4.5))
    for label, fg, bgv, need in checks:
        r = ratio(fg, bgv)
        mark = "ok " if r >= need else "FAIL"
        if r < need:
            FAIL.append((name, label, round(r, 2)))
        print(f"{name:5} {mark} {r:5.2f}  {label:38} {fg} on {bgv}")
    print()

print("FAILURES:", len(FAIL))
for f in FAIL:
    print("  ", f)

sys.exit(1 if FAIL else 0)
