#!/usr/bin/env python3
# compiler/cli.py
"""CLI — 3-Stage xtUML/UML-to-C MDA Compiler (Visualization, Parsing, ANSI C Translation)."""
import argparse
import shutil
import sys
from pathlib import Path
from .parser.json_loader import JSONModelLoader
from .parser.xtuml_loader import XtumlModelLoader
from .parser.xmi_loader import XMIModelLoader
from .codegen.class_gen import ClassGenerator
from .codegen.rel_gen import RelationshipGenerator
from .visualizer import XtumlVisualizer


def _detect_input_format(p: Path) -> str:
    """Deteksi format input: 'xtuml', 'xmi', atau 'json'."""
    if not p.exists():
        return "json"
    if p.is_file():
        suf = p.suffix.lower()
        if suf == ".xtuml":
            return "xtuml"
        if suf in (".xmi", ".xml", ".uml"):
            return "xmi"
    if p.is_dir() and any(p.rglob("*.xtuml")):
        return "xtuml"
    try:
        head = p.read_text(encoding="utf-8", errors="ignore")[:800].lstrip()
        if "persistence-version" in head and "BP " in head:
            return "xtuml"
        if head.startswith("<?xml") or "<xmi:" in head or "<uml:Model" in head:
            return "xmi"
    except Exception:
        pass
    return "json"


def _load_model(path: str, verbose: bool = False):
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Input not found: {path}")
    fmt = _detect_input_format(p)
    if fmt == "xtuml":
        loader = XtumlModelLoader()
    elif fmt == "xmi":
        loader = XMIModelLoader()
    else:
        loader = JSONModelLoader()
    if verbose:
        print(f"[STAGE 2 - PARSER] Input format detected: {fmt.upper()}")
    return loader.load(str(p)), fmt


def _copy_runtime_headers(out_dir: Path):
    """Salin header runtime_c ke output/runtime_c agar output mandiri saat dikompilasi."""
    repo_root = Path(__file__).resolve().parent.parent
    src_runtime = repo_root / "runtime_c"
    if not src_runtime.exists():
        return
    dst_runtime = out_dir / "runtime_c"
    dst_runtime.mkdir(parents=True, exist_ok=True)
    for hfile in src_runtime.glob("*.h"):
        shutil.copy2(hfile, dst_runtime / hfile.name)


def main():
    parser = argparse.ArgumentParser(
        description="UML-to-C MDA Compiler — 3-Stage Pipeline (xtUML Class/State/Action Visualizer + ANSI C Translator)",
        epilog=(
            "Contoh:\n"
            "  python -m compiler.cli examples/sensor_xtuml.json -o output --visualize -v\n"
            "  python -m compiler.cli examples/door_model.json -o output\n"
            "  python -m compiler.cli VendingMachine.xtuml -o output --visualize\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("model", help="Input: .json, .xtuml, .xmi, atau folder/workspace BridgePoint")
    parser.add_argument("-o", "--output", default="output", help="Output directory")
    parser.add_argument("-v", "--verbose", action="store_true", help="Tampilkan log detail tiap stage")
    parser.add_argument(
        "--visualize",
        action="store_true",
        help="Hasilkan artefak Stage 1 (Class, State, Action Mermaid .mmd & Graphviz .dot) + ASCII dump",
    )
    parser.add_argument("--dump-json", metavar="FILE", help="Simpan JSON native hasil normalisasi (debug)")
    args = parser.parse_args()

    if args.verbose:
        print(f"[STAGE 2 - PARSER] Loading: {args.model}")
    try:
        model, fmt = _load_model(args.model, args.verbose)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        return 1

    if args.verbose:
        print(
            f"[STAGE 2 - PARSER] Model: {model.name} | "
            f"Classes: {len(model.classes)} | Relationships: {len(model.relationships)}"
        )

    if args.dump_json:
        import json
        d = {
            "name": model.name,
            "classes": [
                {
                    "name": k,
                    "attributes": [{"name": a.name, "type": a.type} for a in v.attributes],
                    **(
                        {
                            "is_active": True,
                            "state_machine": {
                                "events": [{"name": e.name, "id": e.event_id} for e in v.state_machine.events]
                                if v.state_machine
                                else [],
                                "states": [
                                    {"name": s.name, "id": s.state_id, "is_initial": s.is_initial}
                                    for s in v.state_machine.states
                                ]
                                if v.state_machine
                                else [],
                                "transitions": [
                                    {"from": t.from_state, "to": t.to_state, "event": t.event}
                                    for t in v.state_machine.transitions
                                ]
                                if v.state_machine
                                else [],
                            },
                        }
                        if v.state_machine
                        else {}
                    ),
                }
                for k, v in model.classes.items()
            ],
            "relationships": [],
        }
        Path(args.dump_json).write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
        if args.verbose:
            print(f"[STAGE 2 - PARSER] JSON dumped: {args.dump_json}")

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    _copy_runtime_headers(out)

    # Stage 1: Visualization & Model Representation Layer (3 xtUML Diagrams)
    visualizer = XtumlVisualizer(model)
    vis_files = visualizer.save_all(str(out))
    if args.visualize or args.verbose:
        for vname in vis_files:
            print(f"  [STAGE 1 - VISUAL] -> {vname}")
    if args.visualize:
        print(visualizer.to_ascii_report())

    # Stage 3: Translation Layer (OOP/FSM/OAL -> Procedural ANSI C)
    cg = ClassGenerator(model)
    for n, cls in model.classes.items():
        if args.verbose:
            print(f"  [STAGE 3 - CODEGEN] -> {n}.h / {n}.c")
        (out / f"{n}.h").write_text(cg.generate_header(cls), encoding="utf-8")
        (out / f"{n}.c").write_text(cg.generate_source(cls), encoding="utf-8")

    if model.relationships:
        if args.verbose:
            print("  [STAGE 3 - CODEGEN] -> relationships.h / relationships.c")
        rg = RelationshipGenerator(model)
        (out / "relationships.h").write_text(rg.generate_relationship_header(), encoding="utf-8")
        (out / "relationships.c").write_text(rg.generate_relationship_source(), encoding="utf-8")

    (out / "app_types.h").write_text(
        '#ifndef APP_TYPES_H\n#define APP_TYPES_H\n\n#include "runtime_c/uml_types.h"\n\n#endif\n',
        encoding="utf-8",
    )
    main_c = (
        f"/* Generated for {model.name} ({fmt.upper()}) */\n"
        '#include "app_types.h"\n'
        + "".join(f'#include "{n}.h"\n' for n in model.classes)
        + "\nint main(void){ return 0; }\n"
    )
    if not (out / "main.c").exists() or "/* CUSTOM_TEST_HARNESS */" not in (out / "main.c").read_text(encoding="utf-8", errors="ignore"):
        (out / "main.c").write_text(main_c, encoding="utf-8")

    print(
        f"[SUCCESS] Code generation complete: {out}  "
        f"({len(model.classes)} class{'es' if len(model.classes) != 1 else ''}, "
        f"{len(vis_files)} visual artifacts)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
