# compiler/visualizer/__init__.py
"""Stage 1: Visualization & Model Representation Layer (3-View xtUML Visualizer).

Menghasilkan tiga diagram verifikasi visual langsung dari IR xtUML:
  1. ClassDiagramVisualizer  -> xtUML Class Diagram (Mermaid .mmd, Graphviz .dot, ASCII)
  2. StateMachineVisualizer  -> xtUML State Machine Diagram (Mermaid .mmd, Graphviz .dot, ASCII)
  3. ActionDiagramVisualizer -> xtUML Action / OAL Control-Flow Diagram (Mermaid .mmd, Graphviz .dot, ASCII)
"""
from pathlib import Path
from typing import Dict
from ..ir.metamodel import Model
from .class_visualizer import ClassDiagramVisualizer
from .state_visualizer import StateMachineVisualizer
from .action_visualizer import ActionDiagramVisualizer


class XtumlVisualizer:
    """Facade untuk menghasilkan ketiga diagram visualisasi xtUML (Class, State, Action)."""

    def __init__(self, model: Model):
        self.model = model
        self.class_vis = ClassDiagramVisualizer(model)
        self.state_vis = StateMachineVisualizer(model)
        self.action_vis = ActionDiagramVisualizer(model)

    def generate_all_mermaid(self) -> Dict[str, str]:
        """Return dict berisi 3 diagram Mermaid (.mmd) dan 1 laporan Markdown gabungan."""
        cls_mmd = self.class_vis.to_mermaid()
        fsm_mmd = self.state_vis.to_mermaid()
        act_mmd = self.action_vis.to_mermaid()

        combined_md = (
            f"# Visual Verification Report: `{self.model.name}` (xtUML 3-View IR)\n\n"
            f"## 1. xtUML Class Diagram\n\n```mermaid\n{cls_mmd}\n```\n\n"
            f"## 2. xtUML State Machine Diagram\n\n```mermaid\n{fsm_mmd}\n```\n\n"
            f"## 3. xtUML Action Diagram (OAL Control-Flow Graph)\n\n```mermaid\n{act_mmd}\n```\n"
        )
        return {
            "model_class.mmd": cls_mmd,
            "model_state.mmd": fsm_mmd,
            "model_action.mmd": act_mmd,
            "model_verification.md": combined_md,
        }

    def generate_all_dot(self) -> Dict[str, str]:
        """Return dict berisi 3 diagram Graphviz (.dot)."""
        return {
            "model_class.dot": self.class_vis.to_dot(),
            "model_state.dot": self.state_vis.to_dot(),
            "model_action.dot": self.action_vis.to_dot(),
        }

    def to_ascii_report(self) -> str:
        """Render laporan ASCII 3-View xtUML untuk output terminal CLI."""
        sep = "=" * 92
        return (
            f"{sep}\n"
            f" STAGE 1: XTUML 3-VIEW VISUAL VERIFICATION ({self.model.name})\n"
            f"{sep}\n\n"
            f"{self.class_vis.to_ascii()}\n\n"
            f"{self.state_vis.to_ascii()}\n\n"
            f"{self.action_vis.to_ascii()}\n"
            f"{sep}"
        )

    def save_all(self, output_dir: str) -> Dict[str, Path]:
        """Simpan seluruh artefak visualisasi (.mmd, .dot, .md) ke direktori output."""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        saved: Dict[str, Path] = {}

        for name, content in self.generate_all_mermaid().items():
            p = out / name
            p.write_text(content, encoding="utf-8")
            saved[name] = p

        for name, content in self.generate_all_dot().items():
            p = out / name
            p.write_text(content, encoding="utf-8")
            saved[name] = p

        return saved


__all__ = [
    "ClassDiagramVisualizer",
    "StateMachineVisualizer",
    "ActionDiagramVisualizer",
    "XtumlVisualizer",
]
