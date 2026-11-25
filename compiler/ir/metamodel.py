# compiler/ir/metamodel.py
"""Core metamodel classes untuk representasi xtUML / UML model (Class, State Machine, Action OAL)."""
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
    """Atribut/Field kelas UML/xtUML."""
    name: str
    type: str
    visibility: str = "private"
    default_value: Optional[str] = None
    is_id: bool = False
    relationship_id: Optional[str] = None

    def to_c_type(self) -> str:
        """Map UML/xtUML primitive type ke ANSI C / C99 type."""
        type_map = {
            'int': 'int32_t',
            'integer': 'int32_t',
            'bool': 'bool',
            'boolean': 'bool',
            'string': 'UMLString',
            'float': 'float',
            'real': 'float',
            'double': 'double',
            'uint': 'uint32_t',
            'byte': 'uint8_t',
            'void': 'void',
        }
        return type_map.get(self.type.lower(), self.type)


# Alias sesuai spesifikasi ARCHITECTURE_PLAN.md: Field(name="suhu", type="float", ...)
Field = Attribute


@dataclass
class Operation:
    """Operasi/Method kelas UML/xtUML."""
    name: str
    return_type: str = "void"
    parameters: List[Dict[str, str]] = field(default_factory=list)
    visibility: str = "public"
    body: Optional[str] = None  # OAL action language
    params: Optional[List[Dict[str, str]]] = None
    parsed_oal: List[Any] = field(default_factory=list)

    def __post_init__(self):
        if self.params is not None and not self.parameters:
            self.parameters = list(self.params)
        else:
            self.params = self.parameters

    def c_return_type(self) -> str:
        if not self.return_type or self.return_type.lower() == "void":
            return "void"
        return Attribute("_ret", self.return_type).to_c_type()


# Alias sesuai spesifikasi ARCHITECTURE_PLAN.md: Method(name="bacaData", return_type="void", params=[])
Method = Operation


@dataclass
class Event:
    """Event untuk xtUML state machine."""
    name: str
    event_id: int
    parameters: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class State:
    """State dalam xtUML state machine."""
    name: str
    state_id: int
    entry_action: Optional[str] = None  # OAL
    exit_action: Optional[str] = None   # OAL
    is_initial: bool = False
    is_final: bool = False
    parsed_entry_oal: List[Any] = field(default_factory=list)


@dataclass
class Transition:
    """Transisi antar state."""
    from_state: str
    to_state: str
    event: str
    guard: Optional[str] = None   # OAL condition
    action: Optional[str] = None  # OAL action


@dataclass
class StateMachine:
    """State machine untuk kelas aktif xtUML."""
    states: List[State] = field(default_factory=list)
    transitions: List[Transition] = field(default_factory=list)
    events: List[Event] = field(default_factory=list)

    def get_state(self, name: str) -> Optional[State]:
        return next((s for s in self.states if s.name == name), None)

    def get_initial_state(self) -> Optional[State]:
        return next((s for s in self.states if s.is_initial), None)


@dataclass
class Relationship:
    """Relasi antar kelas (R1..Rn)."""
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
    """Asosiasi khusus dengan navigability."""
    is_navigable_source: bool = True
    is_navigable_target: bool = True


@dataclass
class Class:
    """Kelas UML/xtUML."""
    name: str
    attributes: List[Attribute] = field(default_factory=list)
    operations: List[Operation] = field(default_factory=list)
    state_machine: Optional[StateMachine] = None
    is_active: bool = False
    is_abstract: bool = False
    parent_class: Optional[str] = None
    key_letters: Optional[str] = None
    is_external: bool = False

    def get_id_attribute(self) -> Optional[Attribute]:
        """Cari atribut identifier ({I})."""
        return next((a for a in self.attributes if a.is_id), None)

    def has_state_machine(self) -> bool:
        return self.state_machine is not None and len(self.state_machine.states) > 0


@dataclass
class ActionLanguage:
    """OAL action language statement block."""
    raw_text: str
    context: str  # 'transition', 'state_entry', 'state_exit', 'operation'


@dataclass
class Model:
    """Model UML/xtUML lengkap (root container IR)."""
    name: str
    classes: Dict[str, Class] = field(default_factory=dict)
    relationships: List[Relationship] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_class(self, cls: Class):
        self.classes[cls.name] = cls

    def get_class(self, name: str) -> Optional[Class]:
        return self.classes.get(name)

    def get_relationships_for_class(self, class_name: str) -> List[Relationship]:
        """Ambil semua relasi yang melibatkan kelas tertentu."""
        return [
            r for r in self.relationships
            if r.source_class == class_name or r.target_class == class_name
        ]

    def validate(self) -> List[str]:
        """Validasi semantik ketat (Strict Semantic Analysis)."""
        errors = []

        for cls_name, cls in self.classes.items():
            if not cls_name or not cls_name.strip():
                errors.append("Class name cannot be empty")

            # Cek duplikasi atribut & tipe atribut kosong
            seen_attrs = set()
            for attr in cls.attributes:
                if not attr.name or not attr.name.strip():
                    errors.append(f"Class '{cls.name}': attribute missing name")
                elif attr.name in seen_attrs:
                    errors.append(f"Class '{cls.name}': duplicate attribute '{attr.name}'")
                seen_attrs.add(attr.name)

                if not attr.type or not str(attr.type).strip():
                    errors.append(f"Class '{cls.name}': attribute '{attr.name}' missing type")

            # Cek duplikasi method & validitas parameter
            seen_ops = set()
            for op in cls.operations:
                if not op.name or not op.name.strip():
                    errors.append(f"Class '{cls.name}': operation missing name")
                elif op.name in seen_ops:
                    errors.append(f"Class '{cls.name}': duplicate operation '{op.name}'")
                seen_ops.add(op.name)

                for p_idx, param in enumerate(op.parameters):
                    if not isinstance(param, dict) or not param.get("name") or not param.get("type"):
                        errors.append(
                            f"Class '{cls.name}', operation '{op.name}': invalid parameter at index {p_idx}"
                        )

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
                initials = [s for s in sm.states if s.is_initial]
                if len(initials) > 1:
                    errors.append(
                        f"Class '{cls.name}': multiple initial states {[s.name for s in initials]} — expected exactly one"
                    )
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
