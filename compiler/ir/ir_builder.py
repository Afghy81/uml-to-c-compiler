# compiler/ir/ir_builder.py
"""Builder untuk konstruksi IR (Class, State Machine, Action OAL) dari parsed model."""
from typing import Dict, Any
from .metamodel import (
    Model, Class, Attribute, Operation, State, Transition,
    StateMachine, Event, Relationship, Association,
    RelationType, Multiplicity
)


class IRBuilder:
    """Membangun Strongly-Typed IR dari dict hasil parse JSON / xtUML / XMI."""

    def __init__(self):
        from ..parser.oal_parser import OALParser
        self.model = None
        self.oal_parser = OALParser()

    def build_from_dict(self, data: Dict[str, Any]) -> Model:
        """Entry point: build model dari dict."""
        model_name = data.get('name', 'UnnamedModel')
        self.model = Model(name=model_name)

        seen = set()
        for cls_data in data.get('classes', []):
            name = cls_data.get('name')
            if name in seen:
                raise ValueError(f"Duplicate class name: '{name}'")
            if name:
                seen.add(name)
            cls = self._build_class(cls_data)
            self.model.add_class(cls)

        for rel_data in data.get('relationships', []):
            rel = self._build_relationship(rel_data)
            self.model.relationships.append(rel)

        self.model.metadata = data.get('metadata', {})
        return self.model

    def _build_class(self, data: Dict[str, Any]) -> Class:
        """Build Class dari dict."""
        cls = Class(
            name=data['name'],
            is_active=data.get('is_active', False),
            is_abstract=data.get('is_abstract', False),
            parent_class=data.get('parent', None),
            key_letters=data.get('key_letters', data.get('KL', None)),
            is_external=data.get('is_external', False),
        )

        seen_attrs = set()
        for attr_data in data.get('attributes', []):
            aname = attr_data['name']
            if aname in seen_attrs:
                raise ValueError(f"Class '{cls.name}': duplicate attribute '{aname}'")
            seen_attrs.add(aname)
            raw_default = attr_data.get('default', attr_data.get('default_value', None))
            attr = Attribute(
                name=aname,
                type=attr_data['type'],
                visibility=attr_data.get('visibility', 'private'),
                default_value=str(raw_default) if raw_default is not None else None,
                is_id=attr_data.get('is_id', False),
                relationship_id=attr_data.get('relationship_id', None),
            )
            cls.attributes.append(attr)

        seen_ops = set()
        for op_data in data.get('operations', []):
            oname = op_data['name']
            if oname in seen_ops:
                raise ValueError(f"Class '{cls.name}': duplicate operation '{oname}'")
            seen_ops.add(oname)
            body = op_data.get('body', None)
            params = op_data.get('parameters', op_data.get('params', []))
            op = Operation(
                name=oname,
                return_type=op_data.get('return_type', 'void'),
                parameters=params,
                visibility=op_data.get('visibility', 'public'),
                body=body,
                parsed_oal=self.oal_parser.parse(body) if body else [],
            )
            cls.operations.append(op)

        if 'state_machine' in data and data['state_machine']:
            cls.state_machine = self._build_state_machine(data['state_machine'])

        return cls

    def _build_state_machine(self, data: Dict[str, Any]) -> StateMachine:
        """Build StateMachine dari dict."""
        sm = StateMachine()

        for evt_data in data.get('events', []):
            event = Event(
                name=evt_data['name'],
                event_id=evt_data.get('id', 0),
                parameters=evt_data.get('parameters', []),
            )
            sm.events.append(event)

        for state_data in data.get('states', []):
            entry_act = state_data.get('entry', state_data.get('entry_action', None))
            exit_act = state_data.get('exit', state_data.get('exit_action', None))
            state = State(
                name=state_data['name'],
                state_id=state_data.get('id', 0),
                entry_action=entry_act,
                exit_action=exit_act,
                is_initial=state_data.get('is_initial', False),
                is_final=state_data.get('is_final', False),
                parsed_entry_oal=self.oal_parser.parse(entry_act) if entry_act else [],
            )
            sm.states.append(state)

        for trans_data in data.get('transitions', []):
            trans = Transition(
                from_state=trans_data['from'],
                to_state=trans_data['to'],
                event=trans_data['event'],
                guard=trans_data.get('guard', None),
                action=trans_data.get('action', None),
            )
            sm.transitions.append(trans)

        return sm

    def _build_relationship(self, data: Dict[str, Any]) -> Relationship:
        """Build Relationship dari dict."""
        if 'source' not in data or 'target' not in data:
            raise ValueError(f"Relationship missing 'source'/'target': {data}")
        rel_type_str = data.get('type', 'association').lower()
        try:
            rel_type = RelationType(rel_type_str)
        except ValueError:
            raise ValueError(
                f"Unknown relationship type '{rel_type_str}' — expected one of {[e.value for e in RelationType]}"
            )

        source_mult = self._parse_multiplicity(data.get('source_multiplicity', data.get('source_mult', '1')))
        target_mult = self._parse_multiplicity(data.get('target_multiplicity', data.get('target_mult', '1')))

        if 'navigability' in data:
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
                is_navigable_target=data['navigability'].get('target', True),
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
                target_role=data.get('target_role', None),
            )

    def _parse_multiplicity(self, mult_str: str) -> Multiplicity:
        mult_map = {
            '1': Multiplicity.ONE,
            '0..1': Multiplicity.ZERO_ONE,
            '0..*': Multiplicity.MANY,
            '*': Multiplicity.MANY,
            '1..*': Multiplicity.ONE_MANY,
        }
        return mult_map.get(str(mult_str).strip(), Multiplicity.ONE)
