# compiler/visualizer/class_visualizer.py
"""Visualizer untuk xtUML Class Diagram (Mermaid classDiagram, Graphviz DOT, & ASCII)."""
from typing import List
from ..ir.metamodel import Model, Class, Relationship, RelationType


class ClassDiagramVisualizer:
    """Membangun visualisasi xtUML Class Diagram dari IR Model."""

    def __init__(self, model: Model):
        self.model = model

    @staticmethod
    def _vis_symbol(visibility: str) -> str:
        return {"public": "+", "private": "-", "protected": "#"}.get(visibility.lower(), "-")

    def to_mermaid(self) -> str:
        """Hasilkan diagram Mermaid `classDiagram` dari IR."""
        lines: List[str] = ["classDiagram"]

        for cls in self.model.classes.values():
            lines.append(f"    class {cls.name} {{")
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            if getattr(cls, "is_external", False):
                lines.append(f"        <<External Entity | KL: {kl}>>")
            elif cls.is_active or cls.has_state_machine():
                lines.append(f"        <<Active Class | KL: {kl}>>")
            else:
                lines.append(f"        <<Class | KL: {kl}>>")

            for attr in cls.attributes:
                sym = self._vis_symbol(attr.visibility)
                tag = " {I}" if attr.is_id else ""
                lines.append(f"        {sym}{attr.to_c_type()} {attr.name}{tag}")

            # Tampilkan pointer relasi yang dimiliki class sebagai source
            for rel in self.model.relationships:
                if rel.source_class == cls.name:
                    role = rel.target_role or f"{rel.name}_{rel.target_class.lower()}"
                    already_attr = any(a.name == role or rel.target_class in a.type for a in cls.attributes)
                    if not already_attr:
                        lines.append(f"        -{rel.target_class}* {role}")

            # Lifecycle helper wajib
            lines.append(f"        +{cls.name}_init({cls.name}* self) void")

            for op in cls.operations:
                sym = self._vis_symbol(op.visibility)
                params_str = ", ".join(
                    f"{p.get('type', 'int')} {p.get('name', 'arg')}" for p in op.parameters
                )
                lines.append(f"        {sym}{op.name}({params_str}) {op.return_type}")

            if cls.has_state_machine():
                lines.append(f"        +{cls.name}_dispatch_event({cls.name}* self, {cls.name}_Event evt) void")

            lines.append("    }")

        # Inheritance
        for cls in self.model.classes.values():
            if cls.parent_class and cls.parent_class in self.model.classes:
                lines.append(f"    {cls.parent_class} <|-- {cls.name} : extends")

        # Relationships (R1..Rn)
        for idx, rel in enumerate(self.model.relationships, start=1):
            rname = rel.name or f"R{idx}"
            arrow = "-->"
            if rel.rel_type == RelationType.COMPOSITION:
                arrow = "*-->"
            elif rel.rel_type == RelationType.AGGREGATION:
                arrow = "o-->"
            elif rel.rel_type == RelationType.GENERALIZATION:
                arrow = "--|>"

            role_label = f" ({rel.target_role})" if rel.target_role else ""
            src_m = rel.source_mult.value
            tgt_m = rel.target_mult.value
            lines.append(
                f'    {rel.source_class} "{src_m}" {arrow} "{tgt_m}" {rel.target_class} : {rname}{role_label}'
            )

        return "\n".join(lines)

    def to_dot(self) -> str:
        """Hasilkan Graphviz `.dot` untuk xtUML Class Diagram."""
        lines: List[str] = [
            f'digraph "{self.model.name}_ClassDiagram" {{',
            '    rankdir=LR;',
            '    node [shape=record, fontname="Consolas", fontsize=10];',
            '    edge [fontname="Consolas", fontsize=9];',
        ]

        for cls in self.model.classes.values():
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            attr_rows = []
            for a in cls.attributes:
                sym = self._vis_symbol(a.visibility)
                attr_rows.append(f"{sym} {a.name} : {a.to_c_type()}\\l")
            for rel in self.model.relationships:
                if rel.source_class == cls.name:
                    role = rel.target_role or f"{rel.name}_{rel.target_class.lower()}"
                    attr_rows.append(f"- {role} : {rel.target_class}*\\l")

            op_rows = [f"+ {cls.name}_init(self : {cls.name}*) : void\\l"]
            for op in cls.operations:
                sym = self._vis_symbol(op.visibility)
                pstr = ", ".join(f"{p.get('name', 'p')}:{p.get('type', 'int')}" for p in op.parameters)
                op_rows.append(f"{sym} {op.name}({pstr}) : {op.return_type}\\l")

            label = f"{{{cls.name} [KL: {kl}]|{''.join(attr_rows)}|{''.join(op_rows)}}}"
            lines.append(f'    "{cls.name}" [label="{label}"];')

        for idx, rel in enumerate(self.model.relationships, start=1):
            rname = rel.name or f"R{idx}"
            role = f" ({rel.target_role})" if rel.target_role else ""
            lines.append(
                f'    "{rel.source_class}" -> "{rel.target_class}" '
                f'[label="{rname}{role} [{rel.source_mult.value}..{rel.target_mult.value}]"];'
            )

        lines.append("}")
        return "\n".join(lines)

    def to_ascii(self) -> str:
        """Hasilkan wireframe ASCII untuk xtUML Class Diagram."""
        lines: List[str] = ["[VIEW 1/3] XTUML CLASS DIAGRAM (Entities, Attributes, Methods, & Associations)"]
        lines.append("-" * 78)

        for cls in self.model.classes.values():
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            stereotype = "<<External Entity>>" if getattr(cls, "is_external", False) else (
                "<<Active Class>>" if cls.is_active or cls.has_state_machine() else "<<Class>>"
            )
            header = f"{stereotype} {cls.name} (KL: {kl})"
            attr_lines = []
            for a in cls.attributes:
                sym = self._vis_symbol(a.visibility)
                dflt = f" = {a.default_value}" if a.default_value is not None else ""
                id_tag = " {I}" if a.is_id else ""
                attr_lines.append(f" {sym} {a.name} : {a.type} -> C:{a.to_c_type()}{dflt}{id_tag}")
            for rel in self.model.relationships:
                if rel.source_class == cls.name:
                    role = rel.target_role or f"{rel.name}_{rel.target_class.lower()}"
                    attr_lines.append(f" - {role} : {rel.target_class}* {{Rel: {rel.name or 'R1'}}}")
            if not attr_lines:
                attr_lines.append(" (no attributes)")

            op_lines = [f" + {cls.name}_init({cls.name}* self) : void"]
            for op in cls.operations:
                sym = self._vis_symbol(op.visibility)
                pstr = ", ".join(f"{p.get('type', 'int')} {p.get('name', 'p')}" for p in op.parameters)
                op_lines.append(
                    f" {sym} {cls.name}_{op.name}({cls.name}* self{', ' + pstr if pstr else ''}) : {op.return_type}"
                )

            width = max(len(header) + 4, max(len(x) for x in attr_lines + op_lines) + 2, 44)
            border = "+" + "-" * width + "+"
            lines.append(f"  {border}")
            lines.append(f"  |{header.center(width)}|")
            lines.append(f"  {border}")
            for al in attr_lines:
                lines.append(f"  |{al.ljust(width)}|")
            lines.append(f"  {border}")
            for ol in op_lines:
                lines.append(f"  |{ol.ljust(width)}|")
            lines.append(f"  {border}")
            lines.append("")

        if self.model.relationships:
            lines.append("  Associations / Relationships:")
            for idx, rel in enumerate(self.model.relationships, start=1):
                rname = rel.name or f"R{idx}"
                role = f" (role: {rel.target_role})" if rel.target_role else ""
                lines.append(
                    f"    * [{rname}] {rel.source_class} ({rel.source_mult.value}) "
                    f"--[{rel.rel_type.value}]--> ({rel.target_mult.value}) {rel.target_class}{role}"
                )
        return "\n".join(lines)
