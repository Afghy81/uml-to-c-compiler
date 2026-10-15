# compiler/ir/__init__.py
"""Intermediate Representation and Metamodel"""
from .metamodel import (
    Model, Class, Attribute, Operation, State, Transition,
    Relationship, Association, Event, ActionLanguage
)
from .ir_builder import IRBuilder

__all__ = [
    'Model', 'Class', 'Attribute', 'Operation', 'State', 'Transition',
    'Relationship', 'Association', 'Event', 'ActionLanguage', 'IRBuilder'
]
