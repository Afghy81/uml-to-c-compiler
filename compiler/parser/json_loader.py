# compiler/parser/json_loader.py
"""Load dan validasi JSON model UML — mendukung dua format:
  1) format native: {name, classes:[{name, attributes,...}], ...}
  2) format xtUML VM (ref_xtuml_python/xtumlVM.json): {type:'subsystem', sub_name, model:[...], relationships, events}
"""
import json
import re
from pathlib import Path
from typing import Dict, Any, List
from ..ir.ir_builder import IRBuilder
from ..ir.metamodel import Model


_TYPE_MAP = {"string": "string", "integer": "int", "int": "int", "real": "float",
             "float": "float", "double": "double", "boolean": "bool", "bool": "bool", "datetime": "string"}


def _parse_operations(raw_ops: List[str]) -> List[Dict[str, Any]]:
    out = []
    for op in raw_ops or []:
        s = op.strip()
        m = re.match(r"(\w+)\s*\((.*?)\)\s*(?::\s*(\w+))?$", s)
        if not m:
            out.append({"name": s, "return_type": "void"})
            continue
        name, params_str, ret = m.groups()
        params = []
        if params_str.strip():
            for p in params_str.split(","):
                p = p.strip()
                if ":" in p:
                    pn, pt = [x.strip() for x in p.split(":", 1)]
                    params.append({"name": pn, "type": _TYPE_MAP.get(pt.lower(), pt)})
                elif p:
                    params.append({"name": p, "type": "string"})
        out.append({"name": name, "return_type": ret or "void", "parameters": params})
    return out


def _normalize_xtuml(data: Dict[str, Any]) -> Dict[str, Any]:
    is_xtuml = "model" in data and isinstance(data["model"], list) and any(
        isinstance(x, dict) and x.get("type") == "class" for x in data["model"])
    if not is_xtuml:
        return data

    id_to_name: Dict[str, str] = {}
    for e in data["model"]:
        if e.get("type") == "class" and e.get("class_id"):
            id_to_name[str(e["class_id"])] = e.get("class_name", e["class_id"])

    events_by_class: Dict[str, List[Dict]] = {}
    for ev in data.get("events", []):
        events_by_class.setdefault(str(ev.get("class_id", "")), []).append(ev)

    classes = []
    for entry in data["model"]:
        if entry.get("type") != "class":
            continue
        cid = str(entry.get("class_id", ""))
        cname = entry.get("class_name", f"Class{cid}")
        attrs = []
        for a in entry.get("attributes", []):
            aname = a.get("attribute_name", "unnamed")
            raw_type = a.get("data_type", "string")
            mref = re.match(r"inst_ref<(\w+)>", raw_type)
            if mref:
                ctype = f"{mref.group(1)}_t*"
            else:
                ctype = _TYPE_MAP.get(raw_type.lower(), raw_type)
            attrs.append({"name": aname, "type": ctype, "default": a.get("default_value"),
                          "is_id": a.get("attribute_type") == "naming_attribute"})
        ops = _parse_operations(entry.get("operations", []))

        raw_states = entry.get("states", []) or []
        sm = None
        if raw_states or cid in events_by_class:
            ev_map: Dict[str, Dict] = {}
            eid = 1
            for ev in events_by_class.get(cid, []):
                ename = ev["event_name"]
                raw_eid = re.sub(r"\D", "", ev.get("event_id", ""))
                plist = []
                for p in ev.get("parameters", []):
                    if ":" in p:
                        pn, pt = [x.strip() for x in p.split(":", 1)]
                        plist.append({"name": pn, "type": _TYPE_MAP.get(pt.lower(), pt)})
                ev_map[ename] = {"name": ename, "id": int(raw_eid) if raw_eid else eid, "parameters": plist}
                eid += 1
            for s in raw_states:
                for ename in s.get("state_event", []) or []:
                    if ename not in ev_map:
                        ev_map[ename] = {"name": ename, "id": eid}
                        eid += 1
            states = []
            for idx, s in enumerate(raw_states):
                states.append({"name": s.get("state_name", f"S{idx}"),
                               "id": int(s.get("state_id", idx)),
                               "is_initial": idx == 0, "entry": s.get("action")})
            transitions = []
            for s in raw_states:
                src, dst = s.get("state_name"), s.get("next_state")
                for ename in s.get("state_event", []) or []:
                    if src and dst and ename:
                        transitions.append({"from": src, "to": dst, "event": ename})
            sm = {"events": list(ev_map.values()), "states": states, "transitions": transitions}

        cls_dict: Dict[str, Any] = {"name": cname, "attributes": attrs, "operations": ops}
        if sm and sm["states"]:
            cls_dict["is_active"] = True
            cls_dict["state_machine"] = sm
        if entry.get("is_external"):
            cls_dict["is_external"] = True
        classes.append(cls_dict)

    rels = []
    for r in data.get("relationships", []):
        src = id_to_name.get(str(r.get("from_class", "")), str(r.get("from_class", "")))
        tgt = id_to_name.get(str(r.get("to_class", "")), str(r.get("to_class", "")))
        if not src or not tgt:
            continue
        rtype = r.get("type", "association")
        if rtype == "binary":
            rtype = "association"
        rels.append({"name": r.get("rel_id", ""), "type": rtype, "source": src, "target": tgt,
                     "source_role": r.get("from_class_role"), "target_role": r.get("to_class_role")})

    return {"name": data.get("sub_name") or data.get("sub_id") or "UnnamedModel",
            "classes": classes, "relationships": rels}


class JSONModelLoader:
    """Load model UML dari file JSON"""

    def __init__(self):
        self.ir_builder = IRBuilder()

    def load(self, json_path: str) -> Model:
        """Load model dari file JSON"""
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {json_path}")

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {json_path}:{e.lineno}:{e.colno} — {e.msg}") from e

        # Normalize xtUML envelope → native (no-op jika bukan xtUML)
        data = _normalize_xtuml(data)

        # Basic schema validation
        errors = self._validate_schema(data)
        if errors:
            raise ValueError(f"Invalid model schema:\n" + "\n".join(errors))

        # Build IR
        model = self.ir_builder.build_from_dict(data)

        # Validate semantic
        semantic_errors = model.validate()
        if semantic_errors:
            raise ValueError(f"Model validation failed:\n" + "\n".join(semantic_errors))

        return model

    def load_dict(self, data: Dict[str, Any]) -> Model:
        """Load langsung dari dict (dipakai web/test tanpa file)."""
        data = _normalize_xtuml(data)
        errors = self._validate_schema(data)
        if errors:
            raise ValueError("Invalid model schema:\n" + "\n".join(errors))
        model = self.ir_builder.build_from_dict(data)
        se = model.validate()
        if se:
            raise ValueError("Model validation failed:\n" + "\n".join(se))
        return model

    def _validate_schema(self, data: Dict[str, Any]) -> List[str]:
        """Validasi struktur JSON dasar"""
        errors = []

        if 'name' not in data:
            errors.append("Missing required field: 'name'")

        if 'classes' not in data:
            errors.append("Missing required field: 'classes'")
        elif not isinstance(data['classes'], list):
            errors.append("Field 'classes' must be an array")
        else:
            for i, cls in enumerate(data['classes']):
                cls_errors = self._validate_class(cls, i)
                errors.extend(cls_errors)

        if 'relationships' in data and not isinstance(data['relationships'], list):
            errors.append("Field 'relationships' must be an array")

        return errors

    def _validate_class(self, cls: Dict[str, Any], index: int) -> List[str]:
        """Validasi struktur class"""
        errors = []
        prefix = f"classes[{index}]"

        if 'name' not in cls:
            errors.append(f"{prefix}: missing 'name'")

        if 'attributes' in cls:
            if not isinstance(cls['attributes'], list):
                errors.append(f"{prefix}.attributes: must be array")
            else:
                for j, attr in enumerate(cls['attributes']):
                    if 'name' not in attr:
                        errors.append(f"{prefix}.attributes[{j}]: missing 'name'")
                    if 'type' not in attr:
                        errors.append(f"{prefix}.attributes[{j}]: missing 'type'")

        if 'state_machine' in cls:
            sm = cls['state_machine']
            if 'states' not in sm:
                errors.append(f"{prefix}.state_machine: missing 'states'")
            if 'transitions' not in sm:
                errors.append(f"{prefix}.state_machine: missing 'transitions'")

        return errors
