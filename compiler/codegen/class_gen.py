# compiler/codegen/class_gen.py
"""Generator untuk struct dan fungsi C dari UML Class"""
from typing import Dict, List
from ..ir.metamodel import Class, Model, Attribute, Operation
from .c_writer import CWriter
from ..parser.oal_parser import OALParser


class ClassGenerator:
    """Generate C struct dan function untuk UML Class"""
    
    def __init__(self, model: Model):
        self.model = model
        self.oal_parser = OALParser()
    
    def generate_header(self, cls: Class) -> str:
        """Generate header file (.h) untuk class"""
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
        
        # Forward declaration
        w.write(f"typedef struct {cls.name}_s {cls.name}_t;")
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
        
        if cls.has_state_machine():
            w.write(f"{cls.name}_State current_state;")
        
        w.close_block(";")
        w.write()
        
        # Function declarations
        w.write_comment("Lifecycle functions")
        w.write(f"{cls.name}_t* {cls.name}_create(void);")
        w.write(f"void {cls.name}_destroy({cls.name}_t* self);")
        w.write()
        
        # Getters/setters
        for attr in cls.attributes:
            w.write(f"{attr.to_c_type()} {cls.name}_get_{attr.name}(const {cls.name}_t* self);")
            w.write(f"void {cls.name}_set_{attr.name}({cls.name}_t* self, {attr.to_c_type()} value);")
        w.write()
        
        # Operations
        for op in cls.operations:
            params = self._format_params(op.parameters, cls.name)
            w.write(f"{op.return_type} {cls.name}_{op.name}({cls.name}_t* self{', ' + params if params else ''});")
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
        """Generate source file (.c) untuk class"""
        w = CWriter()
        
        w.write(f'#include "{cls.name}.h"')
        w.write('#include "runtime_c/uml_port.h"')
        w.write('#include <string.h>')
        w.write()
        
        w.write_section_header(f"{cls.name} Implementation")
        
        # Static instance (simplified, no pool for now)
        w.write_comment("Static instance storage")
        w.write(f"static {cls.name}_t s_instance;")
        w.write(f"static bool s_instance_allocated = false;")
        w.write()
        
        # State names (if FSM)
        if cls.has_state_machine():
            self._generate_state_names(cls, w)
        
        # Constructor
        w.write_comment("Constructor")
        w.open_block(f"{cls.name}_t* {cls.name}_create(void)")
        w.open_block("if (s_instance_allocated)")
        w.write("return NULL; // Only one instance supported")
        w.close_block()
        w.write()
        w.write(f"{cls.name}_t* self = &s_instance;")
        w.write("memset(self, 0, sizeof(*self));")
        w.write("s_instance_allocated = true;")
        
        # Initialize attributes dengan default values
        for attr in cls.attributes:
            if attr.default_value:
                if attr.to_c_type() == 'UMLString':
                    w.write(f'umlstring_set(&self->{attr.name}, "{attr.default_value}");')
                else:
                    w.write(f"self->{attr.name} = {attr.default_value};")
        
        if cls.has_state_machine():
            initial = cls.state_machine.get_initial_state()
            if initial:
                w.write(f"self->current_state = {cls.name.upper()}_STATE_{initial.name.upper()};")
        
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
        
        # Operations
        self._generate_operations(cls, w)
        
        # FSM dispatcher
        if cls.has_state_machine():
            self._generate_fsm_dispatcher(cls, w)
        
        return w.get_content()
    
    def _generate_fsm_enums(self, cls: Class, w: CWriter):
        """Generate enum untuk states dan events"""
        sm = cls.state_machine
        
        w.write_comment("State enumeration")
        w.open_block(f"typedef enum")
        for state in sm.states:
            w.write(f"{cls.name.upper()}_STATE_{state.name.upper()} = {state.state_id},")
        w.close_block(f" {cls.name}_State;")
        w.write()
        
        w.write_comment("Event enumeration")
        w.open_block(f"typedef enum")
        for event in sm.events:
            w.write(f"{cls.name.upper()}_EVENT_{event.name.upper()} = {event.event_id},")
        w.close_block(f" {cls.name}_Event;")
        w.write()
    
    def _generate_state_names(self, cls: Class, w: CWriter):
        """Generate state name lookup table"""
        w.open_block(f"const char* {cls.name}_state_name({cls.name}_State state)")
        w.open_block("switch (state)")
        for state in cls.state_machine.states:
            w.write(f'case {cls.name.upper()}_STATE_{state.name.upper()}: return "{state.name}";')
        w.write('default: return "UNKNOWN";')
        w.close_block()
        w.close_block()
        w.write()
    
    def _generate_accessors(self, cls: Class, w: CWriter):
        """Generate getter/setter functions"""
        for attr in cls.attributes:
            c_type = attr.to_c_type()
            
            # Getter
            w.open_block(f"{c_type} {cls.name}_get_{attr.name}(const {cls.name}_t* self)")
            w.write(f"return self->{attr.name};")
            w.close_block()
            w.write()
            
            # Setter
            w.open_block(f"void {cls.name}_set_{attr.name}({cls.name}_t* self, {c_type} value)")
            w.write(f"self->{attr.name} = value;")
            w.close_block()
            w.write()
    
    def _generate_operations(self, cls: Class, w: CWriter):
        """Generate operation/method implementations"""
        for op in cls.operations:
            params = self._format_params(op.parameters, cls.name)
            w.open_block(f"{op.return_type} {cls.name}_{op.name}({cls.name}_t* self{', ' + params if params else ''})")
            
            has_return = False
            if op.body:
                # Parse OAL and generate C
                stmts = self.oal_parser.parse(op.body)
                # detect explicit return in body
                has_return = any(s.type == 'return' or 'return' in s.raw.lower() for s in stmts)
                c_code = self.oal_parser.to_c_code(stmts, {'indent': 0})
                for line in c_code.split('\n'):
                    w.write(line)
            else:
                w.write("// TODO: Implement")
            
            if op.return_type != 'void' and not has_return:
                w.write(f"return ({op.return_type})0;")
            
            w.close_block()
            w.write()
    
    def _generate_fsm_dispatcher(self, cls: Class, w: CWriter):
        """Generate state machine event dispatcher"""
        sm = cls.state_machine
        
        w.write_comment("State machine event dispatcher")
        w.open_block(f"void {cls.name}_dispatch_event({cls.name}_t* self, {cls.name}_Event evt)")
        
        w.write(f'{cls.name}_State old_state = self->current_state;')
        w.write(f'{cls.name}_State new_state = old_state;')
        w.write()
        
        w.write_comment("State transition logic")
        w.open_block("switch (old_state)")
        
        # Group transitions by source state
        state_transitions: Dict[str, List] = {}
        for trans in sm.transitions:
            if trans.from_state not in state_transitions:
                state_transitions[trans.from_state] = []
            state_transitions[trans.from_state].append(trans)
        
        for state in sm.states:
            w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")
            
            if state.name in state_transitions:
                w.open_block("switch (evt)")
                for trans in state_transitions[state.name]:
                    w.open_block(f"case {cls.name.upper()}_EVENT_{trans.event.upper()}:")
                    
                    if trans.guard:
                        w.open_block(f"if ({trans.guard})")
                    
                    if trans.action:
                        stmts = self.oal_parser.parse(trans.action)
                        c_code = self.oal_parser.to_c_code(stmts, {'indent': 0})
                        for line in c_code.split('\n'):
                            w.write(line)
                    
                    w.write(f"new_state = {cls.name.upper()}_STATE_{trans.to_state.upper()};")
                    
                    if trans.guard:
                        w.close_block()
                    
                    w.write("break;")
                    w.close_block()  # Close case block
                
                w.write("default: break;")
                w.close_block()  # Close inner switch
            
            w.write("break;")
            w.close_block()  # Close state case
        
        w.close_block()
        w.write()
        
        w.write_comment("Execute state transition")
        w.open_block("if (new_state != old_state)")
        
        # Exit action
        w.write_comment("Exit old state")
        w.open_block("switch (old_state)")
        for state in sm.states:
            if state.exit_action:
                w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")
                stmts = self.oal_parser.parse(state.exit_action)
                c_code = self.oal_parser.to_c_code(stmts, {'indent': 0})
                for line in c_code.split('\n'):
                    w.write(line)
                w.write("break;")
                w.close_block()
        w.write("default: break;")
        w.close_block()
        w.write()
        
        w.write("self->current_state = new_state;")
        w.write()
        
        # Entry action
        w.write_comment("Enter new state")
        w.open_block("switch (new_state)")
        for state in sm.states:
            if state.entry_action:
                w.open_block(f"case {cls.name.upper()}_STATE_{state.name.upper()}:")
                stmts = self.oal_parser.parse(state.entry_action)
                c_code = self.oal_parser.to_c_code(stmts, {'indent': 0})
                for line in c_code.split('\n'):
                    w.write(line)
                w.write("break;")
                w.close_block()
        w.write("default: break;")
        w.close_block()
        
        w.close_block()
        
        w.close_block()
        w.write()
    
    def _format_params(self, params: List[Dict[str, str]], class_name: str) -> str:
        """Format parameter list untuk function signature"""
        if not params:
            return ""
        return ", ".join([f"{p['type']} {p['name']}" for p in params])
