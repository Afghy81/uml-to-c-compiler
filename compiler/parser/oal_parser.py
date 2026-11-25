# compiler/parser/oal_parser.py
"""Parser untuk xtUML OAL (Object Action Language) -> Action AST & Procedural ANSI C."""
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class OALStatement:
    """Representasi statement OAL pada Action Diagram."""
    type: str  # 'create', 'select_one', 'select_any', 'select_many', 'assign', 'relate', 'unrelate', 'delete', 'generate', 'if', 'elif', 'else', 'end_if', 'while', 'for', 'end_for', 'return', 'call', 'expression'
    raw: str
    tokens: Dict[str, Any]


class OALParser:
    """Parser OAL ke AST untuk Action Diagram Visualizer (Stage 1) dan C Translator (Stage 3)."""

    PATTERNS = {
        'create': r'^create\s+object\s+instance\s+(\w+)\s+of\s+(\w+)$',
        'select_one': r'^select\s+one\s+(\w+)\s+related\s+by\s+([\w\->\.\[\]]+)$',
        'select_any': r'^select\s+any\s+(\w+)\s+from\s+instances\s+of\s+(\w+)(?:\s+where\s+(.+))?$',
        'select_many': r'^select\s+many\s+(\w+)\s+related\s+by\s+([\w\->\.\[\]]+)$',
        'assign': r'^(?:assign\s+)?(\w+)\.(\w+)\s*=\s*(.+)$',
        'relate': r'^relate\s+(\w+)\s+to\s+([\w\->\.\[\]]+)\s+across\s+(\w+)$',
        'unrelate': r'^unrelate\s+(\w+)\s+from\s+([\w\->\.\[\]]+)\s+across\s+(\w+)$',
        'delete': r'^delete\s+object\s+instance\s+(\w+)$',
        'generate': r'^generate\s+([\w:]+)(?:\s*\((.*?)\))?(?:\s+to\s+([\w\->\.\[\]]+))?$',
        'if': r'^if\s*\(?(.*?)\)?$',
        'else': r'^else$',
        'elif': r'^elif\s*\(?(.*?)\)?$',
        'end_if': r'^end\s+if$',
        'while': r'^while\s*\(?(.*?)\)?$',
        'for': r'^for\s+each\s+(\w+)\s+in\s+(\w+)$',
        'end_for': r'^end\s+for$',
        'return': r'^return(?:\s+(.+))?$',
        'call': r'^(\w+)\.(\w+)\s*\((.*?)\)$',
    }

    def parse(self, oal_text: str) -> List[OALStatement]:
        """Parse OAL text ke list of OALStatement."""
        if not oal_text or not oal_text.strip():
            return []

        statements: List[OALStatement] = []
        for raw_line in oal_text.split('\n'):
            line = raw_line.strip()
            if not line or line.startswith('//') or line.startswith('/*'):
                continue
            # Strip inline comments and trailing semicolon
            line = re.sub(r'//.*$', '', line).strip()
            if line.endswith(';'):
                line = line[:-1].strip()
            if not line:
                continue

            stmt = self._parse_line(line)
            if stmt:
                statements.append(stmt)

        return statements

    def _parse_line(self, line: str) -> Optional[OALStatement]:
        """Parse satu baris OAL."""
        # Check exact keywords first ('else', 'end if', 'end for')
        for stmt_type in ('else', 'end_if', 'end_for', 'create', 'select_one', 'select_any',
                          'select_many', 'relate', 'unrelate', 'delete', 'generate',
                          'if', 'elif', 'while', 'for', 'return', 'assign', 'call'):
            pattern = self.PATTERNS[stmt_type]
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                tokens = self._extract_tokens(stmt_type, match)
                return OALStatement(type=stmt_type, raw=line, tokens=tokens)

        return OALStatement(type='expression', raw=line, tokens={'expr': line})

    def _extract_tokens(self, stmt_type: str, match) -> Dict[str, Any]:
        groups = match.groups()
        if stmt_type == 'create':
            return {'var': groups[0], 'class': groups[1]}
        elif stmt_type == 'select_one':
            return {'var': groups[0], 'navigation': groups[1]}
        elif stmt_type == 'select_any':
            return {
                'var': groups[0],
                'class': groups[1],
                'where': groups[2] if len(groups) > 2 and groups[2] else None,
            }
        elif stmt_type == 'select_many':
            return {'var': groups[0], 'navigation': groups[1]}
        elif stmt_type == 'assign':
            return {'target': groups[0], 'attr': groups[1], 'value': groups[2].strip()}
        elif stmt_type == 'relate':
            return {'source': groups[0], 'target': groups[1], 'rel': groups[2]}
        elif stmt_type == 'unrelate':
            return {'source': groups[0], 'target': groups[1], 'rel': groups[2]}
        elif stmt_type == 'delete':
            return {'var': groups[0]}
        elif stmt_type == 'generate':
            raw_evt = groups[0]
            evt_name = raw_evt.split(':')[-1] if ':' in raw_evt else raw_evt
            return {
                'event': evt_name,
                'raw_event': raw_evt,
                'params': groups[1] if len(groups) > 1 and groups[1] else None,
                'target': groups[2] if len(groups) > 2 and groups[2] else 'self',
            }
        elif stmt_type in ('if', 'elif', 'while'):
            return {'condition': groups[0].strip()}
        elif stmt_type == 'for':
            return {'var': groups[0], 'collection': groups[1]}
        elif stmt_type == 'return':
            return {'value': groups[0].strip() if groups[0] else ''}
        elif stmt_type == 'call':
            return {'target': groups[0], 'method': groups[1], 'args': groups[2].strip()}
        return {}

    @staticmethod
    def _translate_expr(expr: str) -> str:
        """Konversi ekspresi OAL (self.x, not_empty v, empty v, and/or) ke ekspresi C valid."""
        if not expr:
            return expr
        out = expr.strip()
        if out.endswith(';'):
            out = out[:-1].strip()
        # not_empty var -> (var != NULL)
        out = re.sub(r'\bnot_empty\s+(\w+)', r'(\1 != NULL)', out, flags=re.IGNORECASE)
        out = re.sub(r'\bempty\s+(\w+)', r'(\1 == NULL)', out, flags=re.IGNORECASE)
        # logical operators
        out = re.sub(r'\band\b', '&&', out, flags=re.IGNORECASE)
        out = re.sub(r'\bor\b', '||', out, flags=re.IGNORECASE)
        out = re.sub(r'\bnot\b', '!', out, flags=re.IGNORECASE)
        # self.attr -> self->attr (hindari angka float seperti 27.5f)
        out = re.sub(r'\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)', r'\1->\2', out)
        return out

    def to_c_code(self, statements: List[OALStatement], ctx: Optional[Dict[str, Any]] = None) -> str:
        """Generate kode ANSI C dari list OALStatement."""
        ctx = ctx or {}
        c_lines: List[str] = []
        indent = ctx.get('indent', 0)
        class_name = ctx.get('class_name', '')
        rel_map: Dict[str, Dict[str, str]] = ctx.get('rel_map', {})

        def ind() -> str:
            return "    " * max(0, indent)

        for stmt in statements:
            if stmt.type == 'create':
                cls_t = stmt.tokens['class']
                var = stmt.tokens['var']
                c_lines.append(f"{ind()}{cls_t}_t* {var} = {cls_t}_create();")

            elif stmt.type == 'assign':
                tgt = stmt.tokens['target']
                attr = stmt.tokens['attr']
                val = self._translate_expr(stmt.tokens['value'])
                c_lines.append(f"{ind()}{tgt}->{attr} = {val};")

            elif stmt.type == 'select_one':
                var = stmt.tokens['var']
                nav = stmt.tokens['navigation']
                m_rel = re.search(r'\[(R\d+)\]', nav)
                rel_id = m_rel.group(1) if m_rel else ""
                if rel_id and rel_id in rel_map:
                    rinfo = rel_map[rel_id]
                    c_lines.append(f"{ind()}{rinfo['target_class']}_t* {var} = self->{rinfo['field']};")
                else:
                    c_lines.append(f"{ind()}/* OAL select_one: {stmt.raw} */")

            elif stmt.type == 'relate':
                src = stmt.tokens['source']
                tgt = stmt.tokens['target']
                rel_id = stmt.tokens['rel']
                if rel_id in rel_map:
                    field_name = rel_map[rel_id]['field']
                    c_lines.append(f"{ind()}{src}->{field_name} = {tgt};")
                else:
                    c_lines.append(f"{ind()}/* OAL relate: {stmt.raw} */")

            elif stmt.type == 'unrelate':
                src = stmt.tokens['source']
                rel_id = stmt.tokens['rel']
                if rel_id in rel_map:
                    field_name = rel_map[rel_id]['field']
                    c_lines.append(f"{ind()}{src}->{field_name} = NULL;")
                else:
                    c_lines.append(f"{ind()}/* OAL unrelate: {stmt.raw} */")

            elif stmt.type == 'generate':
                evt = stmt.tokens['event']
                tgt = stmt.tokens['target']
                if tgt == 'self' and class_name:
                    c_lines.append(
                        f"{ind()}{class_name}_dispatch_event(self, {class_name.upper()}_EVENT_{evt.upper()});"
                    )
                elif tgt == 'self':
                    c_lines.append(f"{ind()}self->fsm.dispatch(self, {evt.upper()}_EVENT);")
                else:
                    c_lines.append(f"{ind()}/* OAL generate {evt} to {tgt} */")

            elif stmt.type == 'delete':
                var = stmt.tokens['var']
                c_lines.append(f"{ind()}{var}_destroy({var});")

            elif stmt.type == 'call':
                tgt = stmt.tokens['target']
                method = stmt.tokens['method']
                args = self._translate_expr(stmt.tokens['args'])
                if tgt == 'self' and class_name:
                    c_lines.append(
                        f"{ind()}{class_name}_{method}(self{', ' + args if args else ''});"
                    )
                else:
                    c_lines.append(f"{ind()}/* OAL call: {tgt}.{method}({args}) */")

            elif stmt.type == 'if':
                cond = self._translate_expr(stmt.tokens['condition'])
                c_lines.append(f"{ind()}if ({cond}) {{")
                indent += 1

            elif stmt.type == 'elif':
                indent = max(0, indent - 1)
                cond = self._translate_expr(stmt.tokens['condition'])
                c_lines.append(f"{ind()}}} else if ({cond}) {{")
                indent += 1

            elif stmt.type == 'else':
                indent = max(0, indent - 1)
                c_lines.append(f"{ind()}}} else {{")
                indent += 1

            elif stmt.type == 'end_if':
                indent = max(0, indent - 1)
                c_lines.append(f"{ind()}}}")

            elif stmt.type == 'while':
                cond = self._translate_expr(stmt.tokens['condition'])
                c_lines.append(f"{ind()}while ({cond}) {{")
                indent += 1

            elif stmt.type == 'for':
                var = stmt.tokens['var']
                coll = stmt.tokens['collection']
                c_lines.append(f"{ind()}FOR_EACH({var}, {coll}) {{")
                indent += 1

            elif stmt.type == 'end_for':
                indent = max(0, indent - 1)
                c_lines.append(f"{ind()}}}")

            elif stmt.type == 'return':
                val = self._translate_expr(stmt.tokens['value'])
                if val:
                    c_lines.append(f"{ind()}return {val};")
                else:
                    c_lines.append(f"{ind()}return;")

            elif stmt.type == 'expression':
                expr = self._translate_expr(stmt.tokens['expr'])
                c_lines.append(f"{ind()}{expr};")

        return "\n".join(c_lines)
