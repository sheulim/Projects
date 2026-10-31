#!/usr/bin/env python3
"""Production-grade quality gate for web pages (bold-premium-ui skill).

Runs as a Claude Code PostToolUse hook after Write/Edit. Reads the hook JSON
from stdin, checks the written .html/.htm file, and reports back:
  - BLOCKERS  -> Claude is told to fix them before continuing
  - WARNINGS  -> passed to Claude as advice
Non-HTML files are ignored silently.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser


class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []          # (tag, attrs-dict)
        self.h1 = 0
        self.headings = []
        self.in_title = False
        self.title = ""
        self.in_btn = None
        self.btn_text = ""
        self.empty_buttons = 0

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        self.tags.append((tag, a))
        if tag == "h1":
            self.h1 += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.headings.append(int(tag[1]))
        if tag == "title":
            self.in_title = True
        if tag in ("button", "a"):
            self.in_btn = (tag, a)
            self.btn_text = ""

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if self.in_btn and tag == self.in_btn[0]:
            a = self.in_btn[1]
            if not self.btn_text.strip() and not a.get("aria-label") and not a.get("title"):
                self.empty_buttons += 1
            self.in_btn = None

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_btn is not None:
            self.btn_text += data


def check(path, html):
    blockers, warnings = [], []
    low = html.lower()
    s = Scan()
    try:
        s.feed(html)
    except Exception as e:  # malformed markup
        blockers.append(f"HTML could not be parsed cleanly: {e}")

    def has(tag, **want):
        for t, a in s.tags:
            if t == tag and all(re.search(v, a.get(k, ""), re.I) for k, v in want.items()):
                return True
        return False

    # --- Document basics (blockers) ---
    if not low.lstrip().startswith("<!doctype html"):
        blockers.append("Missing <!doctype html> at the top of the file.")
    if not has("html", lang=r".+"):
        blockers.append('<html> has no lang attribute (e.g. lang="en").')
    if not has("meta", charset=r"utf-?8"):
        blockers.append('Missing <meta charset="utf-8">.')
    if not has("meta", name=r"^viewport$"):
        blockers.append('Missing responsive <meta name="viewport" content="width=device-width, initial-scale=1">.')
    if not s.title.strip():
        blockers.append("Missing or empty <title>.")
    if s.h1 != 1:
        blockers.append(f"Page must have exactly one <h1> (found {s.h1}).")

    # --- Accessibility (blockers) ---
    no_alt = sum(1 for t, a in s.tags if t == "img" and "alt" not in a)
    if no_alt:
        blockers.append(f"{no_alt} <img> tag(s) without alt text.")
    if s.empty_buttons:
        blockers.append(f"{s.empty_buttons} button/link(s) with no text or aria-label.")
    uses_motion = re.search(r"@keyframes|animation\s*:|transition\s*:|animate\(|gsap|scroll-timeline|animation-timeline", low)
    if uses_motion and "prefers-reduced-motion" not in low:
        blockers.append("Uses animation/transition but has no @media (prefers-reduced-motion) fallback.")
    for t, a in s.tags:
        if t == "a" and a.get("target") == "_blank" and "noopener" not in a.get("rel", ""):
            blockers.append('A link opens in a new tab without rel="noopener".')
            break

    # --- Content honesty (blockers) ---
    if re.search(r"lorem ipsum", low):
        blockers.append("Lorem ipsum filler text is still on the page.")

    # --- Design-system rules from bold-premium-ui (warnings) ---
    if ":root" not in low or "--" not in low:
        warnings.append("No design tokens on :root (colour/spacing/type should be CSS custom properties).")
    if "prefers-color-scheme" not in low:
        warnings.append("No dark-mode handling (@media (prefers-color-scheme: dark)).")
    families = set()
    for m in re.finditer(r"fonts\.googleapis\.com/css2?\?([^\"'>]+)", html):
        for fam in re.findall(r"family=([^&:\"']+)", m.group(1)):
            families.add(fam.replace("+", " "))
    if len(families) > 2:
        warnings.append(f"{len(families)} web-font families loaded ({', '.join(sorted(families))}); skill allows max 2.")
    off_grid = set()
    for prop, val in re.findall(r"\b(padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:\s*([^;}{]+)", html, re.I):
        for n in re.findall(r"(?<![\d.])(\d+(?:\.\d+)?)px", val):
            f = float(n)
            if f > 2 and f % 4 != 0:
                off_grid.add(n + "px")
    if off_grid:
        warnings.append("Spacing values off the 8pt/4pt grid: " + ", ".join(sorted(off_grid, key=lambda x: float(x[:-2]))[:10]))
    levels = s.headings
    for prev, cur in zip(levels, levels[1:]):
        if cur > prev + 1:
            warnings.append(f"Heading level skips from h{prev} to h{cur}.")
            break
    if not has("meta", name=r"^description$"):
        warnings.append("No <meta name=\"description\"> (SEO / link previews).")
    if not has("meta", property=r"^og:"):
        warnings.append("No Open Graph tags (og:title / og:image) for social sharing.")
    if re.search(r"\b(TODO|FIXME)\b", html):
        warnings.append("TODO/FIXME markers left in the file.")
    if re.search(r"console\.log\(", html):
        warnings.append("console.log() left in production code.")
    placeholders = re.findall(r"\[(?:[A-Z][^\]\n]{2,40})\]", re.sub(r"<script.*?</script>", "", html, flags=re.S))
    if placeholders:
        warnings.append(f"{len(placeholders)} content placeholder(s) still to fill, e.g. {placeholders[0]}.")
    imgs_no_lazy = sum(1 for t, a in s.tags if t == "img" and a.get("loading") != "lazy")
    if imgs_no_lazy > 1:
        warnings.append(f"{imgs_no_lazy} images without loading=\"lazy\" (keep only the hero eager).")
    size_kb = len(html.encode()) / 1024
    if size_kb > 500:
        warnings.append(f"File is {size_kb:.0f} KB; consider splitting assets or compressing embedded images.")
    return blockers, warnings


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    ti = data.get("tool_input") or {}
    tr = data.get("tool_response") or {}
    path = ti.get("file_path") or (tr.get("filePath") if isinstance(tr, dict) else None)
    if not path or not re.search(r"\.html?$", path, re.I) or not os.path.isfile(path):
        return 0
    with open(path, encoding="utf-8", errors="replace") as fh:
        html = fh.read()
    blockers, warnings = check(path, html)
    name = os.path.relpath(path, os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
    if not blockers and not warnings:
        print(json.dumps({"systemMessage": f"Web quality gate: {name} passed all checks."}))
        return 0
    lines = [f"Web quality gate report for {name}:"]
    if blockers:
        lines.append("BLOCKERS (fix before presenting the page):")
        lines += [f"  - {b}" for b in blockers]
    if warnings:
        lines.append("WARNINGS (fix unless there is a deliberate reason; mention any you keep):")
        lines += [f"  - {w}" for w in warnings]
    report = "\n".join(lines)
    summary = f"Web quality gate: {name} - {len(blockers)} blocker(s), {len(warnings)} warning(s)."
    out = {"systemMessage": summary}
    if blockers:
        out.update({"decision": "block", "reason": report})
    else:
        out["hookSpecificOutput"] = {"hookEventName": "PostToolUse", "additionalContext": report}
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
