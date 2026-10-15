#!/usr/bin/env python3
# tests/test_compiler.py
"""Basic compiler tests"""
import sys
from pathlib import Path

# Add compiler to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from compiler.parser.json_loader import JSONModelLoader
from compiler.codegen.class_gen import ClassGenerator


def test_load_door_model():
    """Test loading door example model"""
    model_path = Path(__file__).parent.parent / "examples" / "door_model.json"
    
    loader = JSONModelLoader()
    model = loader.load(str(model_path))
    
    assert model.name == "DoorSystem"
    assert "Door" in model.classes
    
    door = model.classes["Door"]
    assert door.is_active
    assert len(door.attributes) == 2
    assert door.has_state_machine()
    assert len(door.state_machine.states) == 3
    assert len(door.state_machine.transitions) == 4
    
    print("PASS: test_load_door_model")


def test_generate_door_code():
    """Test code generation for Door"""
    model_path = Path(__file__).parent.parent / "examples" / "door_model.json"
    
    loader = JSONModelLoader()
    model = loader.load(str(model_path))
    
    gen = ClassGenerator(model)
    door = model.classes["Door"]
    
    header = gen.generate_header(door)
    source = gen.generate_source(door)
    
    # Check header contains expected elements
    assert "#ifndef DOOR_H" in header
    assert "typedef struct Door_s Door_t" in header
    assert "Door_State" in header
    assert "Door_Event" in header
    assert "Door_create" in header
    
    # Check source contains implementation
    assert "Door_create(void)" in source
    assert "Door_destroy" in source
    assert "Door_dispatch_event" in source
    
    print("PASS: test_generate_door_code")


def test_oal_parsing():
    """Test OAL parser"""
    from compiler.parser.oal_parser import OALParser
    
    parser = OALParser()
    
    # Test assign
    stmts = parser.parse("self.x = 10")
    assert len(stmts) == 1
    assert stmts[0].type == "assign"
    
    # Test create
    stmts = parser.parse("create object instance d of Door")
    assert len(stmts) == 1
    assert stmts[0].type == "create"
    assert stmts[0].tokens["class"] == "Door"
    
    # Test generate
    stmts = parser.parse("generate open to self")
    assert len(stmts) == 1
    assert stmts[0].type == "generate"
    
    print("PASS: test_oal_parsing")


if __name__ == '__main__':
    test_load_door_model()
    test_generate_door_code()
    test_oal_parsing()
    print("\nAll tests passed!")
