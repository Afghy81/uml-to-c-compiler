#!/usr/bin/env python3
# compiler/parser/xtuml_loader.py
"""BridgePoint .xtuml -> native dict -> IR Model. Stdlib only."""
from __future__ import annotations
import re
from pathlib import Path
from typing import Dict, Any, List

# absolute import — works both as `python -m compiler.cli` and via pyrefly
# (relative `from ..ir` fails type-checker when file opened standalone)
try:
    from compiler.ir.ir_builder import IRBuilder  # type: ignore[import]
except ImportError:  # fallback when run as script without package context
    from ..ir.ir_builder import IRBuilder  # pyrefly: ignore[missing-import]

RE_WITHIN = re.compile(r"within\s+([^;]+?)\s+is", re.I)
RE_KEYLETTERS = re.compile(r'@key_letters\("([^"]+)"\)')
RE_EVENT_NUM = re.compile(r"@event_num\((\d+)\)\s*\n\s*(?:class\s+)?event\s+'?([^';\n]+)'?", re.I)
RE_EVENT_SIMPLE = re.compile(r"^\s*event\s+'?([^';\n]+)'?", re.I | re.M)
RE_STATE = re.compile(r"@state_num\((\d+)\)[^;]*\n\s*@dialect\([^)]*\)\s*\n\s*state\s+'?([^';\n]+)'?", re.I)
RE_TRANSITION = re.compile(r"transition\s+'?([^'\s\[]+)'?\s*\[([^]]+)\]\s*=>\s*'?([^'\s]+)'?\s*is", re.I)
RE_CLASS = re.compile(r"class\s+'?([^'\s]+)'?\s+is(.*?)end\s+class\s*;", re.I | re.S)
RE_ATTR = re.compile(r"^\s*'?(\w+)'?\s*:\s*(\w+)\s*;", re.I | re.M)
RE_PACKAGE = re.compile(r"package\s+'?([\w-]+)'?", re.I)

def _strip(s: str) -> str: return re.sub(r"//[^\n]*", "", s)

def _parse_file(p: Path) -> dict:
    raw = p.read_text(encoding="utf-8", errors="ignore")
    t = _strip(raw)
    m = RE_WITHIN.search(t)
    within = m.group(1).strip().replace("'", "") if m else ""
    segs = [s.strip().strip("'") for s in within.split("::") if s.strip()]
    km = RE_KEYLETTERS.search(t)
    return {"path": p, "within": within, "segs": segs, "text": t, "key_letters": km.group(1) if km else None}

def _find_xtumls(root: Path) -> List[Path]:
    if root.is_file() and root.suffix == ".xtuml": return [root]
    return sorted(root.rglob("*.xtuml"))

def xtuml_to_dict(root: Path) -> Dict[str, Any]:
    """Workspace/dir/file -> native {name, classes, relationships} dict."""
    files = _find_xtumls(root)
    if not files: raise FileNotFoundError(f"No .xtuml found under {root}")
    parsed = [_parse_file(p) for p in files]
    classes: Dict[str, dict] = {}
    def _owner(segs): return segs[-1] if segs else None
    for pf in parsed:
        for m in RE_CLASS.finditer(pf["text"]):
            cname, body = m.group(1).strip("'"), m.group(2)
            attrs = [{"name": am.group(1), "type": am.group(2), "is_id": False} for am in RE_ATTR.finditer(body)]
            if cname not in classes:
                within = "::".join(pf["segs"][:-1]) if len(pf["segs"])>1 else pf["within"]
                classes[cname] = {"name": cname, "fqn": "::".join(pf["segs"]) or cname, "within": within,
                                  "attributes": attrs, "events": [], "states": [], "transitions": []}
            elif not classes[cname]["attributes"]: classes[cname]["attributes"] = attrs
            if pf["key_letters"]: classes[cname]["key_letters"] = pf["key_letters"]
    for pf in parsed:
        owner = _owner(pf["segs"])
        if owner not in classes: continue
        cls = classes[owner]; t = pf["text"]
        for em in RE_EVENT_NUM.finditer(t):
            num, ename = int(em.group(1)), em.group(2).strip().strip("'")
            if not any(e["name"]==ename for e in cls["events"]): cls["events"].append({"name": ename, "id": num})
        for em in RE_EVENT_SIMPLE.finditer(t):
            ename = em.group(1).strip().strip("'")
            if not any(e["name"]==ename for e in cls["events"]):
                nid = max([e["id"] for e in cls["events"]], default=0)+1
                cls["events"].append({"name": ename, "id": nid})
        for sm in RE_STATE.finditer(t):
            num, sname = int(sm.group(1)), sm.group(2).strip().strip("'")
            if not any(s["name"]==sname for s in cls["states"]):
                cls["states"].append({"name": sname, "id": num-1, "is_initial": num==1})
        for tm in RE_TRANSITION.finditer(t):
            src, evt, dst = tm.group(1).strip("'"), tm.group(2).strip("'"), tm.group(3).strip("'")
            cls["transitions"].append({"from": src, "to": dst, "event": evt})
            if not any(e["name"]==evt for e in cls["events"]):
                cls["events"].append({"name": evt, "id": max([e["id"] for e in cls["events"]], default=0)+1})
            for sn in (src, dst):
                if not any(s["name"]==sn for s in cls["states"]):
                    cls["states"].append({"name": sn, "id": max([s["id"] for s in cls["states"]], default=-1)+1, "is_initial": False})
    for c in classes.values():
        if c["states"] and not any(s.get("is_initial") for s in c["states"]): c["states"][0]["is_initial"]=True
    top = "UnnamedModel"
    for pf in parsed:
        if pf["within"] and "::" not in pf["within"]:
            pm = RE_PACKAGE.search(pf["text"])
            if pm: top = pm.group(1).strip("'"); break
    if top=="UnnamedModel" and parsed[0]["segs"]: top = parsed[0]["segs"][0]
    # emit native compiler dict
    out = []
    for cname, c in classes.items():
        entry: Dict[str,Any] = {"name": cname, "attributes": c["attributes"]}
        if c.get("events") or c.get("states"):
            sm = {"events": c["events"], "states": c["states"], "transitions": c["transitions"]}
            if c["states"]: entry["is_active"]=True; entry["state_machine"]=sm
            elif c["events"]: entry["state_machine"]=sm
        out.append(entry)
    return {"name": top, "classes": out, "relationships": []}

class XtumlModelLoader:
    def load(self, path: str):
        d = xtuml_to_dict(Path(path))
        model = IRBuilder().build_from_dict(d)
        errs = model.validate()
        if errs: raise ValueError("Model validation failed:\n"+"\n".join(errs))
        return model
    def load_dict(self, text: str):
        """text is raw .xtuml content -> treat as single file"""
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)/"tmp.xtuml"; p.write_text(text, encoding="utf-8")
            d = xtuml_to_dict(p)
        model = IRBuilder().build_from_dict(d)
        errs = model.validate()
        if errs: raise ValueError("Model validation failed:\n"+"\n".join(errs))
        return model
