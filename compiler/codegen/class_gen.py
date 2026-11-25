# compiler/codegen/class_gen.py
"""Stage 3: Translator & Code Generator untuk struct, FSM, dan fungsi ANSI C dari xtUML/UML Class."""
import re
from typing import Dict, List, Any
from ..ir.metamodel import Class, Model, Attribute
from .c_writer import CWriter
from ..parser.oal_parser import OALParser


class ClassGenerator:
    """Generate C struct, lifecycle helpers, relationship helpers, FSM, dan method C untuk UML Class."""

    def __init__(self, model: Model):
        self.model = model
        self.oal_parser = OALParser()

    def _get_outgoing_rels(self, cls: Class) -> List[Dict[str, str]]:
        """Ambil daftar relasi keluar (di mana cls adalah source_class)."""
        out: List[Dict[str, str]] = []
        existing_attrs = {a.name for a in cls.attributes}
        for idx, rel in enumerate(self.model.relationships, start=1):
            if rel.source_class == cls.name:
                rname = rel.name or f"R{idx}"
                role = rel.target_role or f"{rname}_{rel.target_class.lower()}"
                out.append({
                    "rel_name": rname,
                    "target_class": rel.target_class,
                    "field": role,
                    "already_in_attrs": "true" if role in existing_attrs else "",
                })
        return out

    def _build_rel_map(self, cls: Class) -> Dict[str, Dict[str, str]]:
        rel_map: Dict[str, Dict[str, str]] = {}
        for item in self._get_outgoing_rels(cls):
            rel_map[item["rel_name"]] = {
                "target_class": item["target_class"],
                "field": item["field"],
            }
        return rel_map

    def generate_header(self, cls: Class) -> str:
        """Generate header file (.h) untuk class."""
        w = CWriter()
        guard = f"{cls.name.upper()}_H"

        w.write(f"#ifndef {guard}")
        w.write(f"#define {guard}")
        w.write()
        w.write('#include "runtime_c/uml_types.h"')
        w.write('#include "runtime_c/uml_pool.h"')

        if cls.has_state_machine():
            w.write('#include "runtime_c/uml_event_queue.h"')

        w.write()
        w.write_section_header(f"{cls.name} Class Interface")

        # Forward declaration + alias OOP (Sensor_t dan Sensor)
        w.write(f"typedef struct {cls.name}_s {cls.name}_t;")
        w.write(f"typedef {cls.name}_t {cls.name};")
        w.write()

        # Forward declarations untuk kelas lain yang direferensikan oleh atribut/parameter/relasi
        refs = set()
        for attr in cls.attributes:
            m = re.match(r"^(\w+?)(?:_t)?\*$", attr.to_c_type().strip())
            if m and m.group(1) != cls.name and m.group(1) in self.model.classes:
                refs.add(m.group(1))
        for op in cls.operations:
            for p in op.parameters:
                ptype = Attribute("_p", p.get("type", "int")).to_c_type()
                m = re.match(r"^(\w+?)(?:_t)?\*$", ptype.strip())
                if m and m.group(1) != cls.name and m.group(1) in self.model.classes:
                    refs.add(m.group(1))
        outgoing_rels = self._get_outgoing_rels(cls)
        for rinfo in outgoing_rels:
            if rinfo["target_class"] != cls.name:
                refs.add(rinfo["target_class"])

        for ref_cls in sorted(refs):
            w.write(f"typedef struct {ref_cls}_s {ref_cls}_t;")
            w.write(f"typedef {ref_cls}_t {ref_cls};")
        if refs:
            w.write()

        # Enums untuk state machine
        if cls.has_state_machine():
            self._generate_fsm_enums(cls, w)

        # Struct definition
        w.write_comment(f"{cls.name} structure")
        w.open_block(f"struct {cls.name}_s")
        w.write("UML_InstanceHeader_t header;")

        for attr in cls.attributes:
            w.write(f"{attr.to_c_type()} {attr.name};")

        for rinfo in outgoing_rels:
            if not rinfo["already_in_attrs"]:
                w.write(f"{rinfo['target_class']}_t* {rinfo['field']};")

        if cls.has_state_machine():
            w.write(f"{cls.name}_State current_state;")

        w.close_block(";")
        w.write()

        # Lifecycle functions
        w.write_comment("Lifecycle functions")
        w.write(f"void {cls.name}_init({cls.name}_t* self);")
        w.write(f"{cls.name}_t* {cls.name}_create(void);")
        w.write(f"void {cls.name}_destroy({cls.name}_t* self);")
        w.write()

        # Getters/setters untuk atribut
        for attr in cls.attributes:
            w.write(f"{attr.to_c_type()} {cls.name}_get_{attr.name}(const {cls.name}_t* self);")
            w.write(f"void {cls.name}_set_{attr.name}({cls.name}_t* self, {attr.to_c_type()} value);")
        if cls.attributes:
            w.write()

        # Relationship link helpers (R1..Rn)
        if outgoing_rels:
            w.write_comment("Relationship link helpers")
            for rinfo in outgoing_rels:
                tgt = rinfo["target_class"]
                rname = rinfo["rel_name"]
                fld = rinfo["field"]
                w.write(f"void {cls.name}_relate_{rname}({cls.name}_t* self, {tgt}_t* target);")
                w.write(f"void {cls.name}_unrelate_{rname}({cls.name}_t* self);")
                if not rinfo["already_in_attrs"]:
                    w.write(f"{tgt}_t* {cls.name}_get_{fld}(const {cls.name}_t* self);")
                    w.write(f"void {cls.name}_set_{fld}({cls.name}_t* self, {tgt}_t* target);")
            w.write()

        # Operations / Methods dengan Explicit Context Pointer
        if cls.operations:
            w.write_comment("Methods (Operations with explicit self pointer)")
            for op in cls.operations:
                params = self._format_params(op.parameters)
                ret_c = op.c_return_type()
                w.write(f"{ret_c} {cls.name}_{op.name}({cls.name}_t* self{', ' + params if params else ''});")
            w.write()

        # FSM functions
        if cls.has_state_machine():
            w.write_comment("State machine functions")
            w.write(f"void {cls.name}_dispatch_event({cls.name}_t* self, {cls.name}_Event evt);")
            w.write(f"const char* {cls.name}_state_name({cls.name}_State state);")
            w.write()

        w.write(f"#endif /* {guard} */")
        return w.get_content()

    def generate_source(self, cls: Class) -> str:
        """Generate source file (.c) untuk class."""
        w = CWriter()
        outgoing_rels = self._get_outgoing_rels(cls)

        w.write(f'#include "{cls.name}.h"')
        for rinfo in outgoing_rels:
            if rinfo["target_class"] != cls.name and rinfo["target_class"] in self.model.classes:
                w.write(f'#include "{rinfo["target_class"]}.h"')
        w.write('#include "runtime_c/uml_port.h"')
        w.write('#include <string.h>')
        w.write()

        w.write_section_header(f"{cls.name} Implementation")

        # Static instance storage
        w.write_comment("Static instance storage")
        w.write(f"static {cls.name}_t s_instance;")
        w.write("static bool s_instance_allocated = false;")
        w.write()

        # State names lookup (if FSM)
        if cls.has_state_machine():
            self._generate_state_names(cls, w)

        # Default Initializer (ClassName_init)
        w.write_comment("Default Lifecycle Initializer")
        w.open_block(f"void {cls.name}_init({cls.name}_t* self)")
        w.open_block("if (self == NULL)")
        w.write("return;")
        w.close_block()
        w.write("memset(self, 0, sizeof(*self));")
        w.write("self->header.is_allocated = true;")

        for attr in cls.attributes:
            if attr.default_value is not None and str(attr.default_value) != "":
                ctype = attr.to_c_type()
                if ctype in ('UMLString', 'uml_string_t'):
                    w.write(f'uml_string_set(&self->{attr.name}, "{attr.default_value}");')
                elif ctype == 'bool':
                    bval = "true" if str(attr.default_value).lower() in ("true", "1") else "false"
                    w.write(f"self->{attr.name} = {bval};")
                else:
                    w.write(f"self->{attr.name} = {attr.default_value};")

        for rinfo in outgoing_rels:
            if not rinfo["already_in_attrs"]:
                w.write(f"self->{rinfo['field']} = NULL;")

        if cls.has_state_machine() and cls.state_machine:
            initial = cls.state_machine.get_initial_state() or (
                cls.state_machine.states[0] if cls.state_machine.states else None
            )
            if initial:
                w.write(f"self->current_state = {cls.name.upper()}_STATE_{initial.name.upper()};")

        w.close_block()
        w.write()

        # Constructor (ClassName_create)
        w.write_comment("Constructor (Static Pool Singleton)")
        w.open_block(f"{cls.name}_t* {cls.name}_create(void)")
        w.open_block("if (s_instance_allocated)")
        w.write("return NULL;")
        w.close_block()
        w.write(f"{cls.name}_t* self = &s_instance;")
        w.write("s_instance_allocated = true;")
        w.write(f"{cls.name}_init(self);")
        w.write("return self;")
        w.close_block()
        w.write()

        # Destructor
        w.write_comment("Destructor")
        w.open_block(f"void {cls.name}_destroy({cls.name}_t* self)")
        w.open_block("if (self == &s_instance)")
        w.write("s_instance_allocated = false;")
        w.close_block()
        w.close_block()
        w.write()

        # Getters/Setters
        self._generate_accessors(cls, w)

        # Relationship link helpers
        self._generate_relationship_helpers(cls, outgoing_rels, w)

        # Operations
        self._generate_operations(cls, w)

        # FSM dispatcher
        if cls.has_state_machine():
            self._generate_fsm_dispatcher(cls, w)

        return w.get_content()

    def _generate_fsm_enums(self, cls: Class, w: CWriter):
        sm = cls.state_machine
        assert sm is not None

        w.write_comment("State enumeration")
        w.open_block("typedef enum")
        for state in sm.states:
            w.write(f"{cls.name.upper()}_STATE_{state.name.upper()} = {state.state_id},")
        w.close_block(f" {cls.name}_State;")
        w.write()

        w.write_comment("Event enumeration")
        w.open_block("typedef enum")
        for event in sm.events:
            w.write(f"{cls.name.upper()}_EVENT_{event.name.upper()} = {event.event_id},")
        w.close_block(f" {cls.name}_Event;")
        w.write()

    def _generate_state_names(self, cls: Class, w: CWriter):
        assert cls.state_machine is not None
        w.open_block(f"const char* {cls.name}_state_name({cls.name}_State state)")
        w.open_block("switch (state)")
        for state in cls.state_machine.states:
            w.write(f'case {cls.name.upper()}_STATE_{state.name.upper()}: return "{state.name}";')
        w.write('default: return "UNKNOWN";')
        w.close_block()
        w.close_block()
        w.write()

    def _generate_accessors(self, cls: Class, w: CWriter):
        for attr in cls.attributes:
            c_type = attr.to_c_type()

            w.open_block(f"{c_type} {cls.name}_get_{attr.name}(const {cls.name}_t* self)")
            w.write(f"return self->{attr.name};")
            w.close_block()
            w.write()

            w.open_block(f"void {cls.name}_set_{attr.name}({cls.name}_t* self, {c_type} value)")
            w.open_block("if (self != NULL)")
            w.write(f"self->{attr.name} = value;")
            w.close_block()
            w.close_block()
            w.write()

    def _generate_relationship_helpers(self, cls: Class, outgoing_rels: List[Dict[str, str]], w: CWriter):
        for rinfo in outgoing_rels:
            tgt = rinfo["target_class"]
            rname = rinfo["rel_name"]
            fld = rinfo["field"]

            w.open_block(f"void {cls.name}_relate_{rname}({cls.name}_t* self, {tgt}_t* target)")
            w.open_block("if (self != NULL)")
            w.write(f"self->{fld} = target;")
            w.close_block()
            w.close_block()
            w.write()

            w.open_block(f"void {cls.name}_unrelate_{rname}({cls.name}_t* self)")
            w.open_block("if (self != NULL)")
            w.write(f"self->{fld} = NULL;")
            w.close_block()
            w.close_block()
            w.write()

            if not rinfo["already_in_attrs"]:
                w.open_block(f"{tgt}_t* {cls.name}_get_{fld}(const {cls.name}_t* self)")
                w.write(f"return (self != NULL) ? self->{fld} : NULL;")
                w.close_block()
                w.write()

                w.open_block(f"void {cls.name}_set_{fld}({cls.name}_t* self, {tgt}_t* target)")
                w.open_block("if (self != NULL)")
                w.write(f"self->{fld} = target;")
                w.close_block()
                w.close_block()
                w.write()

    def _generate_operations(self, cls: Class, w: CWriter):
        rel_map = self._build_rel_map(cls)
        for op in cls.operations:
            params = self._format_params(op.parameters)
            ret_c = op.c_return_type()
            w.open_block(f"{ret_c} {cls.name}_{op.name}({cls.name}_t* self{', ' + params if params else ''})")
            w.write("(void)self;")
            for p in op.parameters:
                w.write(f"(void){p['name']};")

            has_return = False
            if op.body and op.body.strip():
                stmts = self.oal_parser.parse(op.body)
                has_return = any(s.type == 'return' or 'return' in s.raw.lower() for s in stmts)
                c_code = self.oal_parser.to_c_code(
                    stmts, {'indent': 0, 'class_name': cls.name, 'rel_map': rel_map}
                )
                for line in c_code.split('\n'):
                    if line.strip():
                        w.write(line)
            else:
                w.write("/* Default no-op implementation */")

            if ret_c != 'void' and not has_return:
                w.write(f"return ({ret_c})0;")

            w.close_block()
            w.write()

    def _generate_fsm_dispatcher(self, cls: Class, w: CWriter):
        sm = cls.state_machine
        assert sm is not None
        rel_map = self._build_rel_map(cls)

        w.write_comment("State machine event dispatcher")
        w.open_block(f"void {cls.name}_dispatch_event({cls.name}_t* self, {cls.name}_Event evt)")
        w.open_block("if (self == NULL)")
        w.write("return;")
        w.close_block()
        w.write("(void)evt;")
        w.write(f"{cls.name}_State old_state = self->current_state;")
        w.write(f"{cls.name}_State new_state = old_state;")
        w.write()

        w.write_comment("State transition logic")
        w.open_block("switch (old_state)")

        state_transitions: Dict[str, List[Any]] = {}
        for trans in sm.transitions:
            state_transitions.setdefault(trans.from_state, []).append(trans)

        for state in sm.states:
            w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")

            if state.name in state_transitions:
                w.open_block("switch (evt)")
                for trans in state_transitions[state.name]:
                    w.open_block(f"case {cls.name.upper()}_EVENT_{trans.event.upper()}:")

                    if trans.guard:
                        guard_c = self.oal_parser._translate_expr(trans.guard)
                        w.open_block(f"if ({guard_c})")

                    if trans.action:
                        stmts = self.oal_parser.parse(trans.action)
                        c_code = self.oal_parser.to_c_code(
                            stmts, {'indent': 0, 'class_name': cls.name, 'rel_map': rel_map}
                        )
                        for line in c_code.split('\n'):
                            if line.strip():
                                w.write(line)

                    w.write(f"new_state = {cls.name.upper()}_STATE_{trans.to_state.upper()};")

                    if trans.guard:
                        w.close_block()

                    w.write("break;")
                    w.close_block()

                w.write("default: break;")
                w.close_block()

            w.write("break;")
            w.close_block()

        w.write("default: break;")
        w.close_block()
        w.write()

        w.write_comment("Execute state transition")
        w.open_block("if (new_state != old_state)")

        if any(s.exit_action for s in sm.states):
            w.write_comment("Exit old state")
            w.open_block("switch (old_state)")
            for state in sm.states:
                if state.exit_action:
                    w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")
                    stmts = self.oal_parser.parse(state.exit_action)
                    c_code = self.oal_parser.to_c_code(
                        stmts, {'indent': 0, 'class_name': cls.name, 'rel_map': rel_map}
                    )
                    for line in c_code.split('\n'):
                        if line.strip():
                            w.write(line)
                    w.write("break;")
                    w.close_block()
            w.write("default: break;")
            w.close_block()
            w.write()

        w.write("self->current_state = new_state;")
        w.write()

        if any(s.entry_action for s in sm.states):
            w.write_comment("Enter new state (xtUML Action Diagram OAL Entry)")
            w.open_block("switch (new_state)")
            for state in sm.states:
                if state.entry_action:
                    w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")
                    stmts = self.oal_parser.parse(state.entry_action)
                    c_code = self.oal_parser.to_c_code(
                        stmts, {'indent': 0, 'class_name': cls.name, 'rel_map': rel_map}
                    )
                    for line in c_code.split('\n'):
                        if line.strip():
                            w.write(line)
                    w.write("break;")
                    w.close_block()
            w.write("default: break;")
            w.close_block()

        w.close_block()
        w.close_block()
        w.write()

    def _format_params(self, params: List[Dict[str, str]]) -> str:
        if not params:
            return ""
        formatted = []
        for p in params:
            c_type = Attribute("_p", p['type']).to_c_type()
            formatted.append(f"{c_type} {p['name']}")
        return ", ".join(formatted)
