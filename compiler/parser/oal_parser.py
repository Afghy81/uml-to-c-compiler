# compiler/parser/oal_parser.py
"""Parser sederhana untuk OAL (Object Action Language)"""
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class OALStatement:
    """Representasi statement OAL"""
    type: str  # 'create', 'select', 'assign', 'relate', 'unrelate', 'delete', 'generate', 'control'
    raw: str
    tokens: Dict[str, Any]


class OALParser:
    """Parser OAL ke AST sederhana (pattern matching)"""
    
    # Regex patterns untuk OAL statements
    PATTERNS = {
        'create': r'create\s+object\s+instance\s+(\w+)\s+of\s+(\w+)',
        'select_one': r'select\s+one\s+(\w+)\s+related\s+by\s+([\w\->\.]+)',
        'select_any': r'select\s+any\s+(\w+)\s+from\s+instances\s+of\s+(\w+)(?:\s+where\s+(.+))?',
        'select_many': r'select\s+many\s+(\w+)\s+related\s+by\s+([\w\->\.]+)',
        'assign': r'(\w+)\.(\w+)\s*=\s*(.+)',
        'relate': r'relate\s+(\w+)\s+to\s+(\w+)\s+across\s+(\w+)',
        'unrelate': r'unrelate\s+(\w+)\s+from\s+(\w+)\s+across\s+(\w+)',
        'delete': r'delete\s+object\s+instance\s+(\w+)',
        'generate': r'generate\s+(\w+)(?:\s+to\s+(\w+))?(?:\s*\((.*)\))?',
        'if': r'if\s*\((.*)\)',
        'else': r'else',
        'elif': r'elif\s*\((.*)\)',
        'end_if': r'end\s+if',
        'while': r'while\s*\((.*)\)',
        'for': r'for\s+each\s+(\w+)\s+in\s+(\w+)',
        'end_for': r'end\s+for',
        'return': r'return\s+(.+)',
    }
    
    def parse(self, oal_text: str) -> List[OALStatement]:
        """Parse OAL text ke list of statements"""
        if not oal_text or not oal_text.strip():
            return []
        
        statements = []
        lines = [line.strip() for line in oal_text.split('\n') if line.strip() and not line.strip().startswith('//')]
        
        for line in lines:
            stmt = self._parse_line(line)
            if stmt:
                statements.append(stmt)
        
        return statements
    
    def _parse_line(self, line: str) -> Optional[OALStatement]:
        """Parse single line OAL"""
        for stmt_type, pattern in self.PATTERNS.items():
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                tokens = self._extract_tokens(stmt_type, match)
                return OALStatement(type=stmt_type, raw=line, tokens=tokens)
        
        # Fallback: expression or unknown
        return OALStatement(type='expression', raw=line, tokens={'expr': line})
    
    def _extract_tokens(self, stmt_type: str, match) -> Dict[str, Any]:
        """Extract tokens dari regex match"""
        groups = match.groups()
        
        # Return based on statement type
        if stmt_type == 'create':
            return {'var': groups[0], 'class': groups[1]}
        elif stmt_type == 'select_one':
            return {'var': groups[0], 'navigation': groups[1]}
        elif stmt_type == 'select_any':
            return {'var': groups[0], 'class': groups[1], 'where': groups[2] if len(groups) > 2 and groups[2] else None}
        elif stmt_type == 'select_many':
            return {'var': groups[0], 'navigation': groups[1]}
        elif stmt_type == 'assign':
            return {'target': groups[0], 'attr': groups[1], 'value': groups[2]}
        elif stmt_type == 'relate':
            return {'source': groups[0], 'target': groups[1], 'rel': groups[2]}
        elif stmt_type == 'unrelate':
            return {'source': groups[0], 'target': groups[1], 'rel': groups[2]}
        elif stmt_type == 'delete':
            return {'var': groups[0]}
        elif stmt_type == 'generate':
            return {
                'event': groups[0],
                'target': groups[1] if len(groups) > 1 and groups[1] else 'self',
                'params': groups[2] if len(groups) > 2 and groups[2] else None
            }
        elif stmt_type in ('if', 'elif', 'while'):
            return {'condition': groups[0]}
        elif stmt_type == 'for':
            return {'var': groups[0], 'collection': groups[1]}
        elif stmt_type == 'return':
            return {'value': groups[0]}
        else:
            return {}
    
    def to_c_code(self, statements: List[OALStatement], ctx: Dict[str, Any]) -> str:
        """Generate C code dari OAL statements (simplified)"""
        c_lines = []
        indent = ctx.get('indent', 0)
        ind = "    " * indent
        
        for stmt in statements:
            if stmt.type == 'create':
                c_lines.append(f"{ind}{stmt.tokens['class']}_t* {stmt.tokens['var']} = {stmt.tokens['class']}_create();")
            
            elif stmt.type == 'assign':
                c_lines.append(f"{ind}{stmt.tokens['target']}->{stmt.tokens['attr']} = {stmt.tokens['value']};")
            
            elif stmt.type == 'generate':
                evt = stmt.tokens['event']
                tgt = stmt.tokens['target']
                params = stmt.tokens.get('params', '')
                if tgt == 'self':
                    c_lines.append(f"{ind}self->fsm.dispatch(self, {evt.upper()}_EVENT{', ' + params if params else ''});")
                else:
                    c_lines.append(f"{ind}{tgt}->fsm.dispatch({tgt}, {evt.upper()}_EVENT{', ' + params if params else ''});")
            
            elif stmt.type == 'delete':
                c_lines.append(f"{ind}{stmt.tokens['var']}_destroy({stmt.tokens['var']});")
            
            elif stmt.type == 'if':
                c_lines.append(f"{ind}if ({stmt.tokens['condition']}) {{")
            
            elif stmt.type == 'elif':
                c_lines.append(f"{ind}}} else if ({stmt.tokens['condition']}) {{")
            
            elif stmt.type == 'else':
                c_lines.append(f"{ind}}} else {{")
            
            elif stmt.type == 'end_if':
                c_lines.append(f"{ind}}}")
            
            elif stmt.type == 'while':
                c_lines.append(f"{ind}while ({stmt.tokens['condition']}) {{")
            
            elif stmt.type == 'for':
                var = stmt.tokens['var']
                coll = stmt.tokens['collection']
                c_lines.append(f"{ind}FOR_EACH({var}, {coll}) {{")
            
            elif stmt.type == 'end_for':
                c_lines.append(f"{ind}}}")
            
            elif stmt.type == 'return':
                c_lines.append(f"{ind}return {stmt.tokens['value']};")
            
            elif stmt.type == 'expression':
                c_lines.append(f"{ind}{stmt.tokens['expr']};")
        
        return "\n".join(c_lines)
