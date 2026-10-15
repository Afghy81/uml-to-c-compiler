#!/usr/bin/env python3
"""Thin wrapper — use: python -m compiler.cli <xtuml|json> -o output. Kept for compat."""
from pathlib import Path; import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compiler.parser.xtuml_loader import xtuml_to_dict
import json, argparse
def main():
    ap=argparse.ArgumentParser(description="BridgePoint .xtuml -> JSON (wrapper over compiler.parser.xtuml_loader)")
    ap.add_argument("input"); ap.add_argument("-o","--output",default="model.json")
    a=ap.parse_args(); d=xtuml_to_dict(Path(a.input)); Path(a.output).write_text(json.dumps(d,indent=2,ensure_ascii=False),encoding="utf-8")
    print(f"[xtuml_import] {a.input} -> {a.output}  classes={len(d['classes'])}")
if __name__=="__main__": main()
