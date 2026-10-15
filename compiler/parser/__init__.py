# compiler/parser/__init__.py
"""Parser untuk model UML (JSON) dan OAL"""
from .json_loader import JSONModelLoader
from .oal_parser import OALParser

__all__ = ['JSONModelLoader', 'OALParser']
