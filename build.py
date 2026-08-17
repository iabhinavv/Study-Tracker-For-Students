#!/usr/bin/env python3
"""Build index.html from src/ — inlines the CSS and every src/js/*.js file, in
name order, into src/index.template.html.

    python3 build.py

Nothing else to install; the output is one self-contained file that runs from
file:// with no server and no network.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"


def main() -> int:
    template = (SRC / "index.template.html").read_text(encoding="utf-8")
    css = (SRC / "app.css").read_text(encoding="utf-8")

    js_files = sorted((SRC / "js").glob("*.js"))
    if not js_files:
        print("no js files found in src/js", file=sys.stderr)
        return 1

    chunks = []
    for f in js_files:
        chunks.append("/* ===== %s ===== */\n%s" % (f.name, f.read_text(encoding="utf-8").rstrip()))
    js = "\n\n".join(chunks)

    # Guard: a literal </script> inside the JS would close the tag early.
    if re.search(r"</script", js, re.I):
        print("refusing to build: JS contains a literal </script>", file=sys.stderr)
        return 1

    html = (template
            .replace("{{CSS_FILE}}", "built from src/app.css")
            .replace("{{CSS}}", css)
            .replace("{{JS}}", js))
    OUT.write_text(html, encoding="utf-8")
    kb = len(html.encode("utf-8")) / 1024
    print("wrote %s  (%.0f KB, %d js files)" % (OUT.name, kb, len(js_files)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
