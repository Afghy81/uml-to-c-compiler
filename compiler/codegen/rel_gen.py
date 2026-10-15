# compiler/codegen/rel_gen.py
"""Generator untuk relationship navigation code"""
from typing import List
from ..ir.metamodel import Model, Relationship, RelationType, Multiplicity, Association
from .c_writer import CWriter


class RelationshipGenerator:
    """Generate navigation functions untuk relationships"""
    
    def __init__(self, model: Model):
        self.model = model
    
    def generate_relationship_header(self) -> str:
        """Generate header dengan semua navigation functions"""
        if not self.model.relationships:
            return ""
        
        w = CWriter()
        guard = "MODEL_RELATIONSHIPS_H"
        
        w.write(f"#ifndef {guard}")
        w.write(f"#define {guard}")
        w.write()
        
        # Include all class headers
        for cls_name in self.model.classes.keys():
            w.write(f'#include "{cls_name}.h"')
        w.write()
        
        w.write_section_header("Relationship Navigation Functions")
        
        for rel in self.model.relationships:
            self._generate_rel_functions_decl(rel, w)
        
        w.write(f"#endif /* {guard} */")
        return w.get_content()
    
    def generate_relationship_source(self) -> str:
        """Generate source dengan implementasi navigation"""
        if not self.model.relationships:
            return ""
        
        w = CWriter()
        w.write('#include "relationships.h"')
        w.write('#include <stddef.h>')
        w.write()
        
        for rel in self.model.relationships:
            self._generate_rel_functions_impl(rel, w)
        
        return w.get_content()
    
    def _generate_rel_functions_decl(self, rel: Relationship, w: CWriter):
        """Generate function declarations untuk satu relationship"""
        src = rel.source_class
        tgt = rel.target_class
        
        # Navigate from source to target
        if isinstance(rel, Association) and rel.is_navigable_target:
            if rel.target_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.write(f"{tgt}_t* {src}_get_{tgt}({src}_t* self);")
            else:
                w.write(f"{tgt}_t** {src}_get_{tgt}_set({src}_t* self, size_t* count);")
        
        # Navigate from target to source (if bidirectional)
        if isinstance(rel, Association) and rel.is_navigable_source:
            if rel.source_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.write(f"{src}_t* {tgt}_get_{src}({tgt}_t* self);")
            else:
                w.write(f"{src}_t** {tgt}_get_{src}_set({tgt}_t* self, size_t* count);")
        
        # Relate/unrelate functions
        w.write(f"void {src}_relate_{tgt}({src}_t* src, {tgt}_t* tgt);")
        w.write(f"void {src}_unrelate_{tgt}({src}_t* src, {tgt}_t* tgt);")
        w.write()
    
    def _generate_rel_functions_impl(self, rel: Relationship, w: CWriter):
        """Generate function implementations (stub, perlu storage management)"""
        src = rel.source_class
        tgt = rel.target_class
        
        w.write_comment(f"Relationship: {src} -> {tgt}")
        
        # Navigate source->target (stub)
        if isinstance(rel, Association) and rel.is_navigable_target:
            if rel.target_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.open_block(f"{tgt}_t* {src}_get_{tgt}({src}_t* self)")
                w.write("// TODO: Implement navigation using association storage")
                w.write("return NULL;")
                w.close_block()
            else:
                w.open_block(f"{tgt}_t** {src}_get_{tgt}_set({src}_t* self, size_t* count)")
                w.write("// TODO: Implement many-navigation")
                w.write("*count = 0;")
                w.write("return NULL;")
                w.close_block()
        
        # Relate function (stub)
        w.open_block(f"void {src}_relate_{tgt}({src}_t* src, {tgt}_t* tgt)")
        w.write("// TODO: Store association link")
        w.write("(void)src; (void)tgt;")
        w.close_block()
        w.write()
        
        # Unrelate function (stub)
        w.open_block(f"void {src}_unrelate_{tgt}({src}_t* src, {tgt}_t* tgt)")
        w.write("// TODO: Remove association link")
        w.write("(void)src; (void)tgt;")
        w.close_block()
        w.write()
