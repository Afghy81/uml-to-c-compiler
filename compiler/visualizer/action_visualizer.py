# compiler/visualizer/action_visualizer.py
"""Visualizer untuk xtUML Action Diagram (OAL Control-Flow & Data-Access Graph)."""
from typing import List, Tuple
from ..ir.metamodel import Model
from ..parser.oal_parser import OALParser, OALStatement


class ActionDiagramVisualizer:
    """Membangun visualisasi xtUML Action Diagram (OAL CFG) dari Operation body & State entry actions."""

    def __init__(self, model: Model):
        self.model = model
        self.oal_parser = OALParser()

    def _collect_action_blocks(self) -> List[Tuple[str, str, List[OALStatement]]]:
        """Kumpulkan semua blok OAL dari Operation dan State Entry/Exit Action."""
        blocks: List[Tuple[str, str, List[OALStatement]]] = []
        for cls in self.model.classes.values():
            for op in cls.operations:
                if op.body and op.body.strip():
                    stmts = self.oal_parser.parse(op.body)
                    blocks.append((f"{cls.name}_op_{op.name}", f"Operation {cls.name}::{op.name}()", stmts))
            if cls.has_state_machine() and cls.state_machine:
                for idx, state in enumerate(cls.state_machine.states, start=1):
                    if state.entry_action and state.entry_action.strip():
                        stmts = self.oal_parser.parse(state.entry_action)
                        blocks.append(
                            (
                                f"{cls.name}_state_{state.name}",
                                f"State @state_num({idx}) {cls.name}::{state.name} (Entry OAL)",
                                stmts,
                            )
                        )
        return blocks

    @staticmethod
    def _escape_mermaid(text: str) -> str:
        return text.replace('"', "'").replace("[", "(").replace("]", ")")

    def to_mermaid(self) -> str:
        """Hasilkan diagram alir Mermaid `flowchart TD` untuk semua blok OAL (Action Diagram)."""
        lines: List[str] = ["flowchart TD"]
        blocks = self._collect_action_blocks()

        if not blocks:
            lines.append('    EMPTY(["No OAL Action Blocks Defined"])')
            return "\n".join(lines)

        for prefix, title, stmts in blocks:
            safe_prefix = "".join(c if c.isalnum() or c == "_" else "_" for c in prefix)
            lines.append(f'    subgraph {safe_prefix}["Action Diagram: {self._escape_mermaid(title)}"]')
            start_id = f"{safe_prefix}_START"
            end_id = f"{safe_prefix}_END"
            lines.append(f'        {start_id}(["START: {self._escape_mermaid(title)}"])')

            prev_ids: List[Tuple[str, str]] = [(start_id, "")]
            if_stack: List[dict] = []

            for idx, stmt in enumerate(stmts, start=1):
                nid = f"{safe_prefix}_N{idx}"
                raw_clean = self._escape_mermaid(stmt.raw.rstrip(";"))

                if stmt.type == "if":
                    cond = self._escape_mermaid(stmt.tokens.get("condition", raw_clean))
                    lines.append(f'        {nid}{{"OAL if:\\n{cond}"}}')
                    for pid, lbl in prev_ids:
                        edge = f' -->|"{lbl}"| ' if lbl else " --> "
                        lines.append(f"        {pid}{edge}{nid}")
                    if_stack.append({"if_node": nid, "end_exits": [], "in_else": False})
                    prev_ids = [(nid, "True")]

                elif stmt.type == "elif":
                    cond = self._escape_mermaid(stmt.tokens.get("condition", raw_clean))
                    lines.append(f'        {nid}{{"OAL elif:\\n{cond}"}}')
                    if if_stack:
                        top = if_stack[-1]
                        top["end_exits"].extend(prev_ids)
                        last_if = top["if_node"]
                        lines.append(f'        {last_if} -->|"False"| {nid}')
                        top["if_node"] = nid
                        prev_ids = [(nid, "True")]

                elif stmt.type == "else":
                    if if_stack:
                        top = if_stack[-1]
                        top["end_exits"].extend(prev_ids)
                        top["in_else"] = True
                        prev_ids = [(top["if_node"], "False")]

                elif stmt.type == "end_if":
                    if if_stack:
                        top = if_stack.pop()
                        merged = list(top["end_exits"]) + list(prev_ids)
                        if not top["in_else"]:
                            merged.append((top["if_node"], "False"))
                        prev_ids = merged

                elif stmt.type in ("while", "for"):
                    cond = self._escape_mermaid(stmt.tokens.get("condition", raw_clean))
                    lines.append(f'        {nid}{{"OAL {stmt.type}:\\n{cond}"}}')
                    for pid, lbl in prev_ids:
                        edge = f' -->|"{lbl}"| ' if lbl else " --> "
                        lines.append(f"        {pid}{edge}{nid}")
                    prev_ids = [(nid, "Loop")]

                elif stmt.type == "end_for":
                    continue

                else:
                    label = f"OAL {stmt.type}:\\n{raw_clean}"
                    lines.append(f'        {nid}["{label}"]')
                    for pid, lbl in prev_ids:
                        edge = f' -->|"{lbl}"| ' if lbl else " --> "
                        lines.append(f"        {pid}{edge}{nid}")
                    prev_ids = [(nid, "")]

            lines.append(f'        {end_id}(["END"])')
            for pid, lbl in prev_ids:
                edge = f' -->|"{lbl}"| ' if lbl else " --> "
                lines.append(f"        {pid}{edge}{end_id}")
            lines.append("    end")

        return "\n".join(lines)

    def to_dot(self) -> str:
        """Hasilkan Graphviz `.dot` untuk xtUML Action Diagram (OAL CFG)."""
        lines: List[str] = [
            f'digraph "{self.model.name}_ActionDiagrams" {{',
            '    rankdir=TB;',
            '    node [shape=box, style=rounded, fontname="Consolas", fontsize=10];',
            '    edge [fontname="Consolas", fontsize=9];',
        ]
        blocks = self._collect_action_blocks()
        for prefix, title, stmts in blocks:
            safe_prefix = "".join(c if c.isalnum() or c == "_" else "_" for c in prefix)
            lines.append(f'    subgraph "cluster_{safe_prefix}" {{')
            lines.append(f'        label="Action Diagram: {title}";')
            prev = f"{safe_prefix}_START"
            lines.append(f'        "{prev}" [label="START", shape=oval];')
            for idx, stmt in enumerate(stmts, start=1):
                if stmt.type in ("else", "end_if", "end_for"):
                    continue
                nid = f"{safe_prefix}_N{idx}"
                shape = "diamond" if stmt.type in ("if", "elif", "while", "for") else "box"
                clean = stmt.raw.replace('"', "'")
                lines.append(f'        "{nid}" [label="[{stmt.type}]\\n{clean}", shape={shape}];')
                lines.append(f'        "{prev}" -> "{nid}";')
                prev = nid
            end_id = f"{safe_prefix}_END"
            lines.append(f'        "{end_id}" [label="END", shape=oval];')
            lines.append(f'        "{prev}" -> "{end_id}";')
            lines.append("    }")
        lines.append("}")
        return "\n".join(lines)

    def to_ascii(self) -> str:
        """Hasilkan wireframe ASCII untuk xtUML Action Diagram (OAL CFG)."""
        lines: List[str] = ["[VIEW 3/3] XTUML ACTION DIAGRAM (Parsed OAL AST Control-Flow & Data-Access Graph)"]
        lines.append("-" * 78)
        blocks = self._collect_action_blocks()
        if not blocks:
            lines.append("  (No OAL action bodies defined in operations or states)")
            return "\n".join(lines)

        for _, title, stmts in blocks:
            lines.append(f"  Context: {title}")
            lines.append("    ([START])")
            indent = 0
            for stmt in stmts:
                if stmt.type in ("elif", "else", "end_if", "end_for"):
                    indent = max(0, indent - 1)
                pad = "    " * indent
                lines.append(f"       |{pad}")
                lines.append(f"       v{pad}")
                if stmt.type in ("if", "elif", "while", "for"):
                    lines.append(f"    {pad}<OAL {stmt.type}: {stmt.raw}>")
                    indent += 1
                elif stmt.type in ("else", "end_if", "end_for"):
                    lines.append(f"    {pad}[OAL {stmt.type}]")
                    if stmt.type == "else":
                        indent += 1
                else:
                    lines.append(f"    {pad}[OAL {stmt.type}: {stmt.raw}]")
            lines.append("       |")
            lines.append("       v")
            lines.append("    ([END])")
            lines.append("")

        return "\n".join(lines)
