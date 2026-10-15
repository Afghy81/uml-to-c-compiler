# compiler/codegen/fsm_gen.py
"""Generator khusus untuk state machine (opsional, sebagian besar di class_gen)"""
from ..ir.metamodel import StateMachine, Class
from .c_writer import CWriter


class FSMGenerator:
    """Helper untuk generate FSM-specific code (digunakan oleh ClassGenerator)"""
    
    @staticmethod
    def generate_event_struct(cls: Class) -> str:
        """Generate struct untuk event dengan payload (jika diperlukan)"""
        if not cls.has_state_machine():
            return ""
        
        w = CWriter()
        sm = cls.state_machine
        
        for event in sm.events:
            if event.parameters:
                w.open_block(f"typedef struct")
                w.write(f"{cls.name}_Event event_type;")
                for param in event.parameters:
                    w.write(f"{param['type']} {param['name']};")
                w.close_block(f" {cls.name}_{event.name}_Event_t;")
                w.write()
        
        return w.get_content()
    
    @staticmethod
    def generate_state_table(sm: StateMachine, class_name: str) -> str:
        """Generate state transition table (alternatif dari switch-case)"""
        w = CWriter()
        
        w.write_comment("State transition table [state][event] -> next_state")
        w.write(f"static const {class_name}_State transition_table[][{len(sm.events)}] = {{")
        w.indent()
        
        for state in sm.states:
            w.write(f"/* {state.name} */ {{")
            # TODO: Build actual transition lookup
            w.write("},")
        
        w.dedent()
        w.write("};")
        
        return w.get_content()
