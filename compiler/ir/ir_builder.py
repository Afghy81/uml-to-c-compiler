# compiler/ir/ir_builder.py
"""Builder untuk konstruksi IR dari parsed JSON model"""
from typing import Dict, Any, List
from .metamodel import (
    Model, Class, Attribute, Operation, State, Transition,
    StateMachine, Event, Relationship, Association,
    RelationType, Multiplicity
)


class IRBuilder:
    """Membangun IR dari dict hasil parse JSON"""
    
    def __init__(self):
        self.model = None
    
    def build_from_dict(self, data: Dict[str, Any]) -> Model:
        """Entry point: build model dari dict"""
        model_name = data.get('name', 'UnnamedModel')
        self.model = Model(name=model_name)
        
        # Build classes — reject duplicate names (otherwise silently overwrites)
        seen = set()
        for cls_data in data.get('classes', []):
            name = cls_data.get('name')
            if name in seen:
                raise ValueError(f"Duplicate class name: '{name}'")
            if name:
                seen.add(name)
            cls = self._build_class(cls_data)
            self.model.add_class(cls)
        
        # Build relationships
        for rel_data in data.get('relationships', []):
            rel = self._build_relationship(rel_data)
            self.model.relationships.append(rel)
        
        # Store metadata
        self.model.metadata = data.get('metadata', {})
        
        return self.model
    
    def _build_class(self, data: Dict[str, Any]) -> Class:
        """Build Class dari dict"""
        cls = Class(
            name=data['name'],
            is_active=data.get('is_active', False),
            is_abstract=data.get('is_abstract', False),
            parent_class=data.get('parent', None)
        )
        
        # Attributes
        for attr_data in data.get('attributes', []):
            attr = Attribute(
                name=attr_data['name'],
                type=attr_data['type'],
                visibility=attr_data.get('visibility', 'private'),
                default_value=attr_data.get('default', None),
                is_id=attr_data.get('is_id', False)
            )
            cls.attributes.append(attr)
        
        # Operations
        for op_data in data.get('operations', []):
            op = Operation(
                name=op_data['name'],
                return_type=op_data.get('return_type', 'void'),
                parameters=op_data.get('parameters', []),
                visibility=op_data.get('visibility', 'public'),
                body=op_data.get('body', None)
            )
            cls.operations.append(op)
        
        # State machine
        if 'state_machine' in data:
            cls.state_machine = self._build_state_machine(data['state_machine'])
        
        return cls
    
    def _build_state_machine(self, data: Dict[str, Any]) -> StateMachine:
        """Build StateMachine dari dict"""
        sm = StateMachine()
        
        # Events
        for evt_data in data.get('events', []):
            event = Event(
                name=evt_data['name'],
                event_id=evt_data.get('id', 0),
                parameters=evt_data.get('parameters', [])
            )
            sm.events.append(event)
        
        # States
        for state_data in data.get('states', []):
            state = State(
                name=state_data['name'],
                state_id=state_data.get('id', 0),
                entry_action=state_data.get('entry', None),
                exit_action=state_data.get('exit', None),
                is_initial=state_data.get('is_initial', False),
                is_final=state_data.get('is_final', False)
            )
            sm.states.append(state)
        
        # Transitions
        for trans_data in data.get('transitions', []):
            trans = Transition(
                from_state=trans_data['from'],
                to_state=trans_data['to'],
                event=trans_data['event'],
                guard=trans_data.get('guard', None),
                action=trans_data.get('action', None)
            )
            sm.transitions.append(trans)
        
        return sm
    
    def _build_relationship(self, data: Dict[str, Any]) -> Relationship:
        """Build Relationship dari dict"""
        if 'source' not in data or 'target' not in data:
            raise ValueError(f"Relationship missing 'source'/'target': {data}")
        rel_type_str = data.get('type', 'association').lower()
        try:
            rel_type = RelationType(rel_type_str)
        except ValueError:
            raise ValueError(f"Unknown relationship type '{rel_type_str}' — expected one of {[e.value for e in RelationType]}")
        
        source_mult = self._parse_multiplicity(data.get('source_multiplicity', data.get('source_mult', '1')))
        target_mult = self._parse_multiplicity(data.get('target_multiplicity', data.get('target_mult', '1')))
        
        if 'navigability' in data:
            # Association dengan navigability
            return Association(
                name=data.get('name', ''),
                rel_type=rel_type,
                source_class=data['source'],
                target_class=data['target'],
                source_mult=source_mult,
                target_mult=target_mult,
                source_role=data.get('source_role', None),
                target_role=data.get('target_role', None),
                is_navigable_source=data['navigability'].get('source', True),
                is_navigable_target=data['navigability'].get('target', True)
            )
        else:
            return Relationship(
                name=data.get('name', ''),
                rel_type=rel_type,
                source_class=data['source'],
                target_class=data['target'],
                source_mult=source_mult,
                target_mult=target_mult,
                source_role=data.get('source_role', None),
                target_role=data.get('target_role', None)
            )
    
    def _parse_multiplicity(self, mult_str: str) -> Multiplicity:
        """Parse string multiplicity ke enum"""
        mult_map = {
            '1': Multiplicity.ONE,
            '0..1': Multiplicity.ZERO_ONE,
            '0..*': Multiplicity.MANY,
            '*': Multiplicity.MANY,
            '1..*': Multiplicity.ONE_MANY
        }
        return mult_map.get(mult_str.strip(), Multiplicity.ONE)
