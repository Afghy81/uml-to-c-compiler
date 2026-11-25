# compiler/codegen/rel_gen.py
"""Generator untuk relationship navigation code (R1..Rn)."""
from ..ir.metamodel import Model, Relationship, Multiplicity, Association
from .c_writer import CWriter


class RelationshipGenerator:
    """Generate navigation functions untuk relationships."""

    def __init__(self, model: Model):
        self.model = model

    def generate_relationship_header(self) -> str:
        if not self.model.relationships:
            return ""

        w = CWriter()
        guard = "MODEL_RELATIONSHIPS_H"

        w.write(f"#ifndef {guard}")
        w.write(f"#define {guard}")
        w.write()

        for cls_name in self.model.classes.keys():
            w.write(f'#include "{cls_name}.h"')
        w.write()

        w.write_section_header("Relationship Navigation Functions")

        for rel in self.model.relationships:
            self._generate_rel_functions_decl(rel, w)

        w.write(f"#endif /* {guard} */")
        return w.get_content()

    def generate_relationship_source(self) -> str:
        if not self.model.relationships:
            return ""

        w = CWriter()
        w.write('#include "relationships.h"')
        w.write('#include <stddef.h>')
        w.write()

        for idx, rel in enumerate(self.model.relationships, start=1):
            self._generate_rel_functions_impl(rel, idx, w)

        return w.get_content()

    def _generate_rel_functions_decl(self, rel: Relationship, w: CWriter):
        src = rel.source_class
        tgt = rel.target_class

        if isinstance(rel, Association) and rel.is_navigable_target:
            if rel.target_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.write(f"{tgt}_t* {src}_get_{tgt}({src}_t* self);")
            else:
                w.write(f"{tgt}_t** {src}_get_{tgt}_set({src}_t* self, size_t* count);")

        if isinstance(rel, Association) and rel.is_navigable_source:
            if rel.source_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.write(f"{src}_t* {tgt}_get_{src}({tgt}_t* self);")
            else:
                w.write(f"{src}_t** {tgt}_get_{src}_set({tgt}_t* self, size_t* count);")

        w.write(f"void {src}_relate_{tgt}({src}_t* src, {tgt}_t* tgt);")
        w.write(f"void {src}_unrelate_{tgt}({src}_t* src, {tgt}_t* tgt);")
        w.write()

    def _generate_rel_functions_impl(self, rel: Relationship, idx: int, w: CWriter):
        src = rel.source_class
        tgt = rel.target_class
        rname = rel.name or f"R{idx}"
        role = rel.target_role or f"{rname}_{tgt.lower()}"

        w.write_comment(f"Relationship {rname}: {src} -> {tgt}")

        if isinstance(rel, Association) and rel.is_navigable_target:
            if rel.target_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.open_block(f"{tgt}_t* {src}_get_{tgt}({src}_t* self)")
                w.write(f"return (self != NULL) ? self->{role} : NULL;")
                w.close_block()
                w.write()
            else:
                w.open_block(f"{tgt}_t** {src}_get_{tgt}_set({src}_t* self, size_t* count)")
                w.write("(void)self;")
                w.write("if (count != NULL) { *count = 0; }")
                w.write("return NULL;")
                w.close_block()
                w.write()

        if isinstance(rel, Association) and rel.is_navigable_source:
            if rel.source_mult in [Multiplicity.ONE, Multiplicity.ZERO_ONE]:
                w.open_block(f"{src}_t* {tgt}_get_{src}({tgt}_t* self)")
                w.write("(void)self;")
                w.write("return NULL;")
                w.close_block()
                w.write()
            else:
                w.open_block(f"{src}_t** {tgt}_get_{src}_set({tgt}_t* self, size_t* count)")
                w.write("(void)self;")
                w.write("if (count != NULL) { *count = 0; }")
                w.write("return NULL;")
                w.close_block()
                w.write()

        w.open_block(f"void {src}_relate_{tgt}({src}_t* src, {tgt}_t* tgt)")
        w.open_block("if (src != NULL)")
        w.write(f"src->{role} = tgt;")
        w.close_block()
        w.close_block()
        w.write()

        w.open_block(f"void {src}_unrelate_{tgt}({src}_t* src, {tgt}_t* tgt)")
        w.write("(void)tgt;")
        w.open_block("if (src != NULL)")
        w.write(f"src->{role} = NULL;")
        w.close_block()
        w.close_block()
        w.write()
