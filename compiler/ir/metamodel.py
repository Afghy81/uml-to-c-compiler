# compiler/ir/metamodel.py
"""Core metamodel classes untuk representasi UML model"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class RelationType(Enum):
    ASSOCIATION = "association"
    AGGREGATION = "aggregation"
    COMPOSITION = "composition"
    GENERALIZATION = "generalization"


class Multiplicity(Enum):
    ONE = "1"
    ZERO_ONE = "0..1"
    MANY = "0..*"
    ONE_MANY = "1..*"


@dataclass
class Attribute:
    """Atribut kelas UML"""
    name: str
    type: str
    visibility: str = "private"
    default_value: Optional[str] = None
    is_id: bool = False
    
    def to_c_type(self) -> str:
        """Map UML type ke C type"""
        type_map = {
            'int': 'int32_t',
            'integer': 'int32_t',
            'bool': 'bool',
            'boolean': 'bool',
            'string': 'UMLString',
            'float': 'float',
            'double': 'double',
            'uint': 'uint32_t',
            'byte': 'uint8_t'
        }
        return type_map.get(self.type.lower(), self.type)


@dataclass
class Operation:
    """Operasi/method kelas UML"""
    name: str
    return_type: str = "void"
    parameters: List[Dict[str, str]] = field(default_factory=list)
    visibility: str = "public"
    body: Optional[str] = None  # OAL action language


@dataclass
class Event:
    """Event untuk state machine"""
    name: str
    event_id: int
    parameters: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class State:
    """State dalam state machine"""
    name: str
    state_id: int
    entry_action: Optional[str] = None  # OAL
    exit_action: Optional[str] = None   # OAL
    is_initial: bool = False
    is_final: bool = False


@dataclass
class Transition:
    """Transisi antar state"""
    from_state: str
    to_state: str
    event: str
    guard: Optional[str] = None  # OAL condition
    action: Optional[str] = None  # OAL action


@dataclass
class StateMachine:
    """State machine untuk kelas aktif"""
    states: List[State] = field(default_factory=list)
    transitions: List[Transition] = field(default_factory=list)
    events: List[Event] = field(default_factory=list)
    
    def get_state(self, name: str) -> Optional[State]:
        return next((s for s in self.states if s.name == name), None)
    
    def get_initial_state(self) -> Optional[State]:
        return next((s for s in self.states if s.is_initial), None)


@dataclass
class Relationship:
    """Relasi antar kelas"""
    name: str
    rel_type: RelationType
    source_class: str
    target_class: str
    source_mult: Multiplicity
    target_mult: Multiplicity
    source_role: Optional[str] = None
    target_role: Optional[str] = None


@dataclass
class Association(Relationship):
    """Asosiasi khusus dengan attribut tambahan"""
    is_navigable_source: bool = True
    is_navigable_target: bool = True


@dataclass
class Class:
    """Kelas UML"""
    name: str
    attributes: List[Attribute] = field(default_factory=list)
    operations: List[Operation] = field(default_factory=list)
    state_machine: Optional[StateMachine] = None
    is_active: bool = False
    is_abstract: bool = False
    parent_class: Optional[str] = None
    
    def get_id_attribute(self) -> Optional[Attribute]:
        """Cari atribut identifier"""
        return next((a for a in self.attributes if a.is_id), None)
    
    def has_state_machine(self) -> bool:
        return self.state_machine is not None and len(self.state_machine.states) > 0


@dataclass
class ActionLanguage:
    """OAL action language statement"""
    raw_text: str
    context: str  # 'transition', 'state_entry', 'state_exit', 'operation'


@dataclass
class Model:
    """Model UML lengkap (root container)"""
    name: str
    classes: Dict[str, Class] = field(default_factory=dict)
    relationships: List[Relationship] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_class(self, cls: Class):
        self.classes[cls.name] = cls
    
    def get_class(self, name: str) -> Optional[Class]:
        return self.classes.get(name)
    
    def get_relationships_for_class(self, class_name: str) -> List[Relationship]:
        """Ambil semua relasi yang melibatkan kelas tertentu"""
        return [r for r in self.relationships 
                if r.source_class == class_name or r.target_class == class_name]
    
    def validate(self) -> List[str]:
        """Validasi konsistensi model"""
        errors = []
        
        # Cek relasi referensi kelas yang ada
        for rel in self.relationships:
            if rel.source_class not in self.classes:
                errors.append(f"Relationship '{rel.name}': source class '{rel.source_class}' not found")
            if rel.target_class not in self.classes:
                errors.append(f"Relationship '{rel.name}': target class '{rel.target_class}' not found")
        
        # Cek parent class exists untuk inheritance
        for cls in self.classes.values():
            if cls.parent_class and cls.parent_class not in self.classes:
                errors.append(f"Class '{cls.name}': parent class '{cls.parent_class}' not found")
        
        # Cek kelas aktif punya state machine + FSM internal consistency
        for cls in self.classes.values():
            if cls.is_active and not cls.has_state_machine():
                errors.append(f"Active class '{cls.name}' has no state machine")
            if cls.state_machine:
                sm = cls.state_machine
                # duplicate state/event names
                seen_states = set()
                for s in sm.states:
                    if s.name in seen_states:
                        errors.append(f"Class '{cls.name}': duplicate state '{s.name}'")
                    seen_states.add(s.name)
                seen_evts = set()
                for e in sm.events:
                    if e.name in seen_evts:
                        errors.append(f"Class '{cls.name}': duplicate event '{e.name}'")
                    seen_evts.add(e.name)
                # exactly one initial (warn if >1, error if 0 for active)
                initials = [s for s in sm.states if s.is_initial]
                if len(initials) > 1:
                    errors.append(f"Class '{cls.name}': multiple initial states { [s.name for s in initials] } — expected exactly one")
                # transitions reference existing states/events
                event_names = {e.name for e in sm.events}
                state_names = {s.name for s in sm.states}
                for t in sm.transitions:
                    if t.from_state not in state_names:
                        errors.append(f"Class '{cls.name}': transition from unknown state '{t.from_state}'")
                    if t.to_state not in state_names:
                        errors.append(f"Class '{cls.name}': transition to unknown state '{t.to_state}'")
                    if t.event not in event_names:
                        errors.append(f"Class '{cls.name}': transition on unknown event '{t.event}'")
        
        return errors
