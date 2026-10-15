# compiler/codegen/c_writer.py
"""Utility untuk menulis kode C dengan indentasi dan format yang konsisten"""
from typing import List
from pathlib import Path


class CWriter:
    """Writer untuk file C dengan helper formatting"""
    
    def __init__(self):
        self.indent_level = 0
        self.lines: List[str] = []
    
    def write(self, text: str = ""):
        """Write satu baris dengan indentasi"""
        if text:
            indent = "    " * self.indent_level
            self.lines.append(indent + text)
        else:
            self.lines.append("")
    
    def write_block(self, lines: List[str]):
        """Write multiple lines"""
        for line in lines:
            self.write(line)
    
    def indent(self):
        """Increase indent level"""
        self.indent_level += 1
    
    def dedent(self):
        """Decrease indent level"""
        if self.indent_level > 0:
            self.indent_level -= 1
    
    def open_block(self, header: str = ""):
        """Write header and open brace, increase indent"""
        if header:
            self.write(header + " {")
        else:
            self.write("{")
        self.indent()
    
    def close_block(self, suffix: str = ""):
        """Decrease indent and close brace"""
        self.dedent()
        if suffix:
            self.write("}" + suffix)
        else:
            self.write("}")
    
    def write_comment(self, comment: str, style: str = "//"):
        """Write comment line"""
        if style == "//":
            self.write(f"// {comment}")
        else:
            self.write(f"/* {comment} */")
    
    def write_section_header(self, title: str):
        """Write formatted section header"""
        self.write()
        self.write(f"/* {'=' * 70} */")
        self.write(f"/* {title.center(68)} */")
        self.write(f"/* {'=' * 70} */")
        self.write()
    
    def get_content(self) -> str:
        """Get all written content as string"""
        return "\n".join(self.lines)
    
    def save(self, filepath: str):
        """Save content to file"""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(self.get_content())
    
    def reset(self):
        """Clear all content and reset indent"""
        self.lines.clear()
        self.indent_level = 0
