#!/usr/bin/env python3

from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
JSDOC_CONFIG = ROOT / "docs" / "apidoc.json"
DOCS_DIR = ROOT / "html"
JSDOC = ROOT / "node_modules" / ".bin" / "jsdoc"

if not JSDOC.exists():
    print("JSDoc is not installed. Run `npm install` first.", file=sys.stderr)
    sys.exit(1)

try:
    shutil.rmtree(DOCS_DIR, ignore_errors=True)
    subprocess.run(
        [str(JSDOC), "-c", str(JSDOC_CONFIG)],
        cwd=ROOT,
        check=True,
    )
except subprocess.CalledProcessError as error:
    print(f"JSDoc generation failed: {error}", file=sys.stderr)
    sys.exit(error.returncode or 1)
