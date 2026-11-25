# compiler/visualizer/state_visualizer.py
"""Visualizer untuk xtUML State Machine Diagram (Mermaid stateDiagram-v2, Graphviz DOT, & ASCII)."""
from typing import List
from ..ir.metamodel import Model, Class


class StateMachineVisualizer:
    """Membangun visualisasi xtUML State Machine Diagram dari IR Model."""

    def __init__(self, model: Model):
        self.model = model

    @staticmethod
    def _sanitize_id(name: str) -> str:
        return "".join(c if c.isalnum() or c == "_" else "_" for c in name)

    def to_mermaid(self) -> str:
        """Hasilkan diagram Mermaid `stateDiagram-v2` untuk seluruh kelas aktif."""
        lines: List[str] = ["stateDiagram-v2"]
        active_classes = [c for c in self.model.classes.values() if c.has_state_machine()]

        if not active_classes:
            lines.append("    note right of NoActiveFSM : Model memiliki 0 State Machine aktif")
            lines.append("    [*] --> NoActiveFSM")
            return "\n".join(lines)

        for cls in active_classes:
            sm = cls.state_machine
            assert sm is not None
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            lines.append(f"    %% State Machine for {cls.name} (KL: {kl})")

            initial = sm.get_initial_state() or (sm.states[0] if sm.states else None)
            if initial:
                sid = f"{cls.name}_{self._sanitize_id(initial.name)}"
                lines.append(f"    [*] --> {sid} : {cls.name}_init(&self)")

            for idx, state in enumerate(sm.states, start=1):
                sid = f"{cls.name}_{self._sanitize_id(state.name)}"
                lines.append(f'    state "@state_num({idx}) {cls.name}::{state.name}" as {sid}')
                if state.entry_action and state.entry_action.strip():
                    lines.append(f"    {sid} : entry /")
                    for raw_line in state.entry_action.strip().splitlines():
                        clean = raw_line.strip()
                        if clean and not clean.startswith("//"):
                            safe = clean.replace(":", " :: ").replace('"', "'")
                            lines.append(f"    {sid} : {safe}")

            evt_id_map = {e.name: e.event_id for e in sm.events}
            for trans in sm.transitions:
                src_id = f"{cls.name}_{self._sanitize_id(trans.from_state)}"
                dst_id = f"{cls.name}_{self._sanitize_id(trans.to_state)}"
                ev_num = evt_id_map.get(trans.event, 1)
                guard_str = f" [{trans.guard}]" if trans.guard else ""
                lines.append(f"    {src_id} --> {dst_id} : {kl}{ev_num}_{trans.event}{guard_str}")

        return "\n".join(lines)

    def to_dot(self) -> str:
        """Hasilkan Graphviz `.dot` untuk xtUML State Machine Diagram."""
        lines: List[str] = [
            f'digraph "{self.model.name}_StateMachines" {{',
            '    rankdir=TB;',
            '    node [shape=Mrecord, fontname="Consolas", fontsize=10];',
            '    edge [fontname="Consolas", fontsize=9];',
        ]

        active_classes = [c for c in self.model.classes.values() if c.has_state_machine()]
        for cls in active_classes:
            sm = cls.state_machine
            assert sm is not None
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            lines.append(f'    subgraph "cluster_{cls.name}" {{')
            lines.append(f'        label="State Machine: {cls.name} (KL: {kl})";')
            lines.append(f'        "{cls.name}__init" [shape=point, width=0.2];')

            initial = sm.get_initial_state() or (sm.states[0] if sm.states else None)
            if initial:
                lines.append(
                    f'        "{cls.name}__init" -> "{cls.name}_{initial.name}" [label="{cls.name}_init"];'
                )

            for idx, state in enumerate(sm.states, start=1):
                entry_preview = ""
                if state.entry_action and state.entry_action.strip():
                    preview_lines = [
                        l.strip().replace('"', "'").replace("{", "(").replace("}", ")")
                        for l in state.entry_action.strip().splitlines()
                        if l.strip() and not l.strip().startswith("//")
                    ][:4]
                    entry_preview = "|entry /\\l" + "\\l".join(preview_lines) + "\\l"
                lines.append(
                    f'        "{cls.name}_{state.name}" '
                    f'[label="{{@state_num({idx}) {state.name}{entry_preview}}}"];'
                )

            for trans in sm.transitions:
                lines.append(
                    f'        "{cls.name}_{trans.from_state}" -> "{cls.name}_{trans.to_state}" '
                    f'[label="{trans.event}"];'
                )
            lines.append("    }")

        lines.append("}")
        return "\n".join(lines)

    def to_ascii(self) -> str:
        """Hasilkan wireframe ASCII untuk xtUML State Machine Diagram."""
        lines: List[str] = ["[VIEW 2/3] XTUML STATE MACHINE DIAGRAM (Lifecycle States, Events, & Transitions)"]
        lines.append("-" * 78)

        active_classes = [c for c in self.model.classes.values() if c.has_state_machine()]
        if not active_classes:
            lines.append("  (No active state machines defined in this model)")
            return "\n".join(lines)

        for cls in active_classes:
            sm = cls.state_machine
            assert sm is not None
            kl = getattr(cls, "key_letters", None) or cls.name[:3].upper()
            lines.append(f"  Active Class: {cls.name} (KL: {kl})")
            lines.append("  States:")
            for idx, s in enumerate(sm.states, start=1):
                init_tag = " [INITIAL (*)]" if s.is_initial else ""
                lines.append(f"    + @state_num({idx}) {s.name} (enum: {cls.name.upper()}_STATE_{s.name.upper()} = {s.state_id}){init_tag}")
                if s.entry_action and s.entry_action.strip():
                    for al in s.entry_action.strip().splitlines():
                        if al.strip():
                            lines.append(f"        entry OAL | {al.strip()}")
            lines.append("  Transitions:")
            for t in sm.transitions:
                g = f" [guard: {t.guard}]" if t.guard else ""
                lines.append(f"    * ({t.from_state}) ---[ {t.event}{g} ]---> ({t.to_state})")
            lines.append("")

        return "\n".join(lines)
