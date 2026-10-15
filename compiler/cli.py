#!/usr/bin/env python3
# compiler/cli.py
"""CLI — menerima JSON atau .xtuml mentah (file/dir/workspace BridgePoint)."""
import argparse, sys
from pathlib import Path
from .parser.json_loader import JSONModelLoader
from .parser.xtuml_loader import XtumlModelLoader
from .codegen.class_gen import ClassGenerator
from .codegen.rel_gen import RelationshipGenerator


def _is_xtuml_input(p: Path) -> bool:
    if not p.exists(): return False
    if p.is_file() and p.suffix.lower() == ".xtuml": return True
    if p.is_dir(): return any(p.rglob("*.xtuml"))
    # JSON file dengan ekstensi lain tapi isi xtUML? cek header
    try:
        head = p.read_text(encoding="utf-8", errors="ignore")[:800]
        if "persistence-version" in head and "BP " in head: return True
    except Exception: pass
    return False


def _load_model(path: str, verbose=False):
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Input not found: {path}")
    use_xtuml = _is_xtuml_input(p)
    loader = XtumlModelLoader() if use_xtuml else JSONModelLoader()
    if verbose: print(f"Input type: {'xtUML BridgePoint' if use_xtuml else 'JSON'}")
    return loader.load(str(p)), use_xtuml


def main():
    parser = argparse.ArgumentParser(
        description="UML-to-C Model Compiler — JSON atau .xtuml BridgePoint langsung -> C",
        epilog="Contoh:\n"
               "  python -m compiler.cli model.json -o output\n"
               "  python -m compiler.cli VendingMachine.xtuml -o output\n"
               "  python -m compiler.cli \"C:\\BridgePoint\\workspace\\pppl_project\" -o output\n"
               "  python -m compiler.cli model.json -o output --dump-json imported.json",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model", help="Input: .json, .xtuml, atau folder/workspace BridgePoint")
    parser.add_argument("-o", "--output", default="output", help="Output directory")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--dump-json", metavar="FILE", help="Simpan JSON native hasil normalisasi (debug)")
    args = parser.parse_args()

    if args.verbose: print(f"Loading: {args.model}")
    try:
        model, is_xtuml = _load_model(args.model, args.verbose)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr); return 1

    if args.verbose:
        print(f"Model: {model.name}  Classes: {len(model.classes)}  Relationships: {len(model.relationships)}")

    if args.dump_json:
        import json
        d = {"name": model.name,
             "classes": [{"name": k, "attributes": [{"name": a.name, "type": a.type} for a in v.attributes],
                          **({"is_active": True, "state_machine": {"events": [{"name": e.name, "id": e.event_id} for e in v.state_machine.events] if v.state_machine else [],
                                                                "states": [{"name": s.name, "id": s.state_id, "is_initial": s.is_initial} for s in v.state_machine.states] if v.state_machine else [],
                                                                "transitions": [{"from": t.from_state, "to": t.to_state, "event": t.event} for t in v.state_machine.transitions] if v.state_machine else []}} if v.state_machine else {})}
                         for k,v in model.classes.items()],
             "relationships": []}
        Path(args.dump_json).write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
        if args.verbose: print(f"JSON dumped: {args.dump_json}")

    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    cg = ClassGenerator(model)
    for n, cls in model.classes.items():
        if args.verbose: print(f"  -> {n}.h/.c")
        (out/f"{n}.h").write_text(cg.generate_header(cls), encoding="utf-8")
        (out/f"{n}.c").write_text(cg.generate_source(cls), encoding="utf-8")
    if model.relationships:
        if args.verbose: print("  -> relationships.h/.c")
        rg = RelationshipGenerator(model)
        (out/"relationships.h").write_text(rg.generate_relationship_header(), encoding="utf-8")
        (out/"relationships.c").write_text(rg.generate_relationship_source(), encoding="utf-8")
    (out/"app_types.h").write_text('#ifndef APP_TYPES_H\n#define APP_TYPES_H\n\n#include "runtime_c/uml_types.h"\n\n#endif\n', encoding="utf-8")
    main_c = f'/* Generated for {model.name} ({ "xtUML" if is_xtuml else "JSON"}) */\n#include "app_types.h"\n' + "".join(f'#include "{n}.h"\n' for n in model.classes) + '\nint main(void){ return 0; }\n'
    (out/"main.c").write_text(main_c, encoding="utf-8")
    print(f"[SUCCESS] Code generation complete: {out}  ({len(model.classes)} class{'es' if len(model.classes)!=1 else ''})")
    return 0

if __name__ == "__main__": sys.exit(main())
