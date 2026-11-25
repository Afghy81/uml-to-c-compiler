# compiler/ir/__init__.py
from .metamodel import (
    Model, Class, Attribute, Field, Operation, Method,
    State, Transition, StateMachine, Event,
    Relationship, Association, RelationType, Multiplicity, ActionLanguage
)
from .ir_builder import IRBuilder

__all__ = [
    'Model', 'Class', 'Attribute', 'Field', 'Operation', 'Method',
    'State', 'Transition', 'StateMachine', 'Event',
    'Relationship', 'Association', 'RelationType', 'Multiplicity',
    'ActionLanguage', 'IRBuilder'
]
