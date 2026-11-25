# compiler/parser/xmi_loader.py
"""Parser XMI (XML Metadata Interchange) standar UML 2.x -> IR Model (stdlib xml.etree.ElementTree)."""
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List
from ..ir.ir_builder import IRBuilder
from ..ir.metamodel import Model


class XMIModelLoader:
    """Mem-parsing dokumen XMI 2.x (Eclipse Papyrus / Enterprise Architect / StarUML export) ke IR Model."""

    def __init__(self):
        self.ir_builder = IRBuilder()

    @staticmethod
    def _get_xmi_attr(elem: ET.Element, local_name: str, default: str = "") -> str:
        for k, v in elem.attrib.items():
            if k == local_name or k.endswith(f"}}{local_name}") or k.endswith(f":{local_name}"):
                return v
        return default

    def parse_xmi_text(self, xml_text: str) -> Dict[str, Any]:
        """Parse string XML/XMI ke dictionary native compiler."""
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            raise ValueError(f"Invalid XMI/XML syntax: {e}") from e

        model_elem = root
        for el in root.iter():
            tag_local = el.tag.split("}")[-1].split(":")[-1]
            xmi_type = self._get_xmi_attr(el, "type")
            if tag_local == "Model" or xmi_type in ("uml:Model", "uml:Package"):
                model_elem = el
                break

        model_name = model_elem.attrib.get("name", "XMIModel")
        classes: List[Dict[str, Any]] = []
        relationships: List[Dict[str, Any]] = []
        id_to_class_name: Dict[str, str] = {}

        # Pass 1: Kumpulkan semua uml:Class
        for el in model_elem.iter():
            tag_local = el.tag.split("}")[-1].split(":")[-1]
            xmi_type = self._get_xmi_attr(el, "type")
            if tag_local == "Class" or xmi_type == "uml:Class":
                cname = el.attrib.get("name", "")
                cid = self._get_xmi_attr(el, "id", cname)
                if cname:
                    id_to_class_name[cid] = cname

        # Pass 2: Ekstrak atribut, operasi, dan relasi
        for el in model_elem.iter():
            tag_local = el.tag.split("}")[-1].split(":")[-1]
            xmi_type = self._get_xmi_attr(el, "type")

            if tag_local == "Class" or xmi_type == "uml:Class":
                cname = el.attrib.get("name")
                if not cname:
                    continue

                attrs: List[Dict[str, Any]] = []
                ops: List[Dict[str, Any]] = []

                for child in el:
                    ctag = child.tag.split("}")[-1].split(":")[-1]
                    ctype = self._get_xmi_attr(child, "type")

                    if ctag in ("ownedAttribute", "Attribute") or ctype == "uml:Property":
                        aname = child.attrib.get("name", "")
                        atype = child.attrib.get("type", "int")
                        # Cek sub-elemen <type href="...#//Float"/>
                        type_el = child.find("type")
                        if type_el is not None:
                            href = type_el.attrib.get("href", "")
                            if "#" in href:
                                atype = href.split("#")[-1].strip("/").lower()
                        if atype in id_to_class_name:
                            # Ini atribut asosiasi
                            target_cls = id_to_class_name[atype]
                            relationships.append({
                                "name": f"R{len(relationships) + 1}",
                                "type": "association",
                                "source": cname,
                                "target": target_cls,
                                "target_role": aname or target_cls.lower(),
                            })
                        else:
                            attrs.append({
                                "name": aname,
                                "type": atype,
                                "visibility": child.attrib.get("visibility", "private"),
                                "default": child.attrib.get("defaultValue"),
                            })

                    elif ctag in ("ownedOperation", "Operation") or ctype == "uml:Operation":
                        oname = child.attrib.get("name", "")
                        ret_type = child.attrib.get("returnType", "void")
                        params: List[Dict[str, str]] = []
                        for p_el in child:
                            ptag = p_el.tag.split("}")[-1].split(":")[-1]
                            if ptag in ("ownedParameter", "Parameter"):
                                direction = p_el.attrib.get("direction", "in")
                                ptype = p_el.attrib.get("type", "int")
                                if direction == "return":
                                    ret_type = ptype
                                else:
                                    params.append({
                                        "name": p_el.attrib.get("name", f"arg{len(params)}"),
                                        "type": ptype,
                                    })
                        ops.append({
                            "name": oname,
                            "return_type": ret_type,
                            "parameters": params,
                            "visibility": child.attrib.get("visibility", "public"),
                            "body": child.attrib.get("body"),
                        })

                classes.append({
                    "name": cname,
                    "attributes": attrs,
                    "operations": ops,
                })

            elif tag_local == "Association" or xmi_type == "uml:Association":
                src = el.attrib.get("source", "")
                tgt = el.attrib.get("target", "")
                src_name = id_to_class_name.get(src, src)
                tgt_name = id_to_class_name.get(tgt, tgt)
                if src_name and tgt_name:
                    relationships.append({
                        "name": el.attrib.get("name", f"R{len(relationships) + 1}"),
                        "type": "association",
                        "source": src_name,
                        "target": tgt_name,
                        "target_role": el.attrib.get("targetRole"),
                    })

        return {
            "name": model_name,
            "classes": classes,
            "relationships": relationships,
        }

    def load(self, xmi_path: str) -> Model:
        path = Path(xmi_path)
        if not path.exists():
            raise FileNotFoundError(f"XMI file not found: {xmi_path}")
        data = self.parse_xmi_text(path.read_text(encoding="utf-8"))
        model = self.ir_builder.build_from_dict(data)
        errors = model.validate()
        if errors:
            raise ValueError("XMI Model validation failed:\n" + "\n".join(errors))
        return model
