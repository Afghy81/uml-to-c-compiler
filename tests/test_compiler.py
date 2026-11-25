#!/usr/bin/env python3
# tests/test_compiler.py
"""Comprehensive 3-Stage MDA Compiler Test Suite (Stage 1 Visualizer, Stage 2 Parser/IR, Stage 3 ANSI C Codegen)."""
import sys
from pathlib import Path

# Add compiler root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from compiler.ir.metamodel import Class, Field, Method
from compiler.parser.json_loader import JSONModelLoader
from compiler.parser.xmi_loader import XMIModelLoader
from compiler.parser.oal_parser import OALParser
from compiler.codegen.class_gen import ClassGenerator
from compiler.codegen.rel_gen import RelationshipGenerator
from compiler.visualizer import (
    XtumlVisualizer,
    ClassDiagramVisualizer,
    StateMachineVisualizer,
    ActionDiagramVisualizer,
)


def test_load_door_model():
    """Test loading door example model."""
    model_path = REPO_ROOT / "examples" / "door_model.json"

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
    """Test code generation for Door."""
    model_path = REPO_ROOT / "examples" / "door_model.json"

    loader = JSONModelLoader()
    model = loader.load(str(model_path))

    gen = ClassGenerator(model)
    door = model.classes["Door"]

    header = gen.generate_header(door)
    source = gen.generate_source(door)

    assert "#ifndef DOOR_H" in header
    assert "typedef struct Door_s Door_t;" in header
    assert "typedef Door_t Door;" in header
    assert "Door_State" in header
    assert "Door_Event" in header
    assert "void Door_init(Door_t* self);" in header
    assert "Door_create" in header

    assert "void Door_init(Door_t* self)" in source
    assert "Door_create(void)" in source
    assert "Door_destroy" in source
    assert "Door_dispatch_event" in source

    print("PASS: test_generate_door_code")


def test_oal_parsing():
    """Test OAL parser for xtUML Action Diagram statements."""
    parser = OALParser()

    # Test assign
    stmts = parser.parse("self.suhu = 27.5f;")
    assert len(stmts) == 1
    assert stmts[0].type == "assign"
    assert stmts[0].tokens["attr"] == "suhu"

    # Test create
    stmts = parser.parse("create object instance d of Door")
    assert len(stmts) == 1
    assert stmts[0].type == "create"
    assert stmts[0].tokens["class"] == "Door"

    # Test generate
    stmts = parser.parse("generate SEN3:Overheat() to self;")
    assert len(stmts) == 1
    assert stmts[0].type == "generate"
    assert stmts[0].tokens["event"] == "Overheat"

    # Test select_one + if not_empty
    stmts = parser.parse("select one ctrl related by self->CTL[R1];\nif (not_empty ctrl)\n  ctrl.alarm_aktif = true;\nend if;")
    assert [s.type for s in stmts] == ["select_one", "if", "assign", "end_if"]

    print("PASS: test_oal_parsing")


def test_stage2_sensor_ir_and_strict_validation():
    """Test Stage 2 Parsing Layer & Reference Example Sensor(float suhu, void bacaData())."""
    sensor_path = REPO_ROOT / "examples" / "sensor_xtuml.json"
    loader = JSONModelLoader()
    model = loader.load(str(sensor_path))

    assert "Sensor" in model.classes
    assert "Controller" in model.classes
    sensor = model.classes["Sensor"]
    assert sensor.name == "Sensor"
    assert sensor.key_letters == "SEN"

    # Verify Field(name="suhu", type="float", visibility="private")
    suhu_attr = next((a for a in sensor.attributes if a.name == "suhu"), None)
    assert suhu_attr is not None
    assert isinstance(suhu_attr, Field)
    assert suhu_attr.type == "float"
    assert suhu_attr.to_c_type() == "float"
    assert suhu_attr.visibility == "private"

    # Verify Method(name="bacaData", return_type="void", params=[])
    baca_op = next((o for o in sensor.operations if o.name == "bacaData"), None)
    assert baca_op is not None
    assert isinstance(baca_op, Method)
    assert baca_op.return_type == "void"
    assert baca_op.params == []

    # Verify strict semantic validation catches duplicate class and missing target class
    bad_dict = {
        "name": "BadModel",
        "classes": [
            {"name": "Sensor", "attributes": [{"name": "suhu", "type": "float"}]},
        ],
        "relationships": [
            {"name": "R99", "type": "association", "source": "Sensor", "target": "NonExistentClass"}
        ],
    }
    try:
        loader.load_dict(bad_dict)
        assert False, "Expected ValueError for dangling relationship target"
    except ValueError as e:
        assert "NonExistentClass" in str(e)

    # Verify XMI parser also extracts Sensor class cleanly
    sample_xmi = """<?xml version="1.0" encoding="UTF-8"?>
    <uml:Model xmlns:xmi="http://www.omg.org/XMI" xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML" name="SensorXMI">
        <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Sensor">
            <ownedAttribute xmi:type="uml:Property" name="suhu" type="float" visibility="private" defaultValue="0.0f"/>
            <ownedOperation xmi:type="uml:Operation" name="bacaData" returnType="void" visibility="public"/>
        </packagedElement>
    </uml:Model>
    """
    xmi_loader = XMIModelLoader()
    xmi_dict = xmi_loader.parse_xmi_text(sample_xmi)
    xmi_model = xmi_loader.ir_builder.build_from_dict(xmi_dict)
    assert "Sensor" in xmi_model.classes
    assert xmi_model.classes["Sensor"].attributes[0].name == "suhu"
    assert xmi_model.classes["Sensor"].operations[0].name == "bacaData"

    print("PASS: test_stage2_sensor_ir_and_strict_validation")


def test_stage1_xtuml_3view_visualizer():
    """Test Stage 1 Visualization Layer (xtUML Class, State Machine, and Action OAL Diagrams)."""
    sensor_path = REPO_ROOT / "examples" / "sensor_xtuml.json"
    model = JSONModelLoader().load(str(sensor_path))

    vis = XtumlVisualizer(model)
    mmd_map = vis.generate_all_mermaid()
    dot_map = vis.generate_all_dot()
    ascii_report = vis.to_ascii_report()

    # 1. Class Diagram checks
    assert "classDiagram" in mmd_map["model_class.mmd"]
    assert "class Sensor" in mmd_map["model_class.mmd"]
    assert "float suhu" in mmd_map["model_class.mmd"]
    assert "bacaData()" in mmd_map["model_class.mmd"]
    assert "R1" in mmd_map["model_class.mmd"]

    # 2. State Machine Diagram checks
    assert "stateDiagram-v2" in mmd_map["model_state.mmd"]
    assert "Sensor_Idle" in mmd_map["model_state.mmd"]
    assert "Sensor_Sampling" in mmd_map["model_state.mmd"]
    assert "SEN1_StartSampling" in mmd_map["model_state.mmd"]

    # 3. Action Diagram (OAL CFG) checks
    assert "flowchart TD" in mmd_map["model_action.mmd"]
    assert "OAL assign:" in mmd_map["model_action.mmd"]
    assert "OAL select_one:" in mmd_map["model_action.mmd"]
    assert "OAL if:" in mmd_map["model_action.mmd"]

    # 4. DOT & ASCII checks
    assert "digraph" in dot_map["model_class.dot"]
    assert "[VIEW 1/3] XTUML CLASS DIAGRAM" in ascii_report
    assert "[VIEW 2/3] XTUML STATE MACHINE DIAGRAM" in ascii_report
    assert "[VIEW 3/3] XTUML ACTION DIAGRAM" in ascii_report

    print("PASS: test_stage1_xtuml_3view_visualizer")


def test_stage3_generate_sensor_c_and_harness():
    """Test Stage 3 Translation Layer for Sensor & Controller and emit output/ files."""
    sensor_path = REPO_ROOT / "examples" / "sensor_xtuml.json"
    model = JSONModelLoader().load(str(sensor_path))

    out_dir = REPO_ROOT / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save visual artifacts
    XtumlVisualizer(model).save_all(str(out_dir))

    # Generate C headers and sources
    cg = ClassGenerator(model)
    for cname, cls in model.classes.items():
        (out_dir / f"{cname}.h").write_text(cg.generate_header(cls), encoding="utf-8")
        (out_dir / f"{cname}.c").write_text(cg.generate_source(cls), encoding="utf-8")

    rg = RelationshipGenerator(model)
    (out_dir / "relationships.h").write_text(rg.generate_relationship_header(), encoding="utf-8")
    (out_dir / "relationships.c").write_text(rg.generate_relationship_source(), encoding="utf-8")

    # Write comprehensive test harness main.c
    harness_c = """/* CUSTOM_TEST_HARNESS: End-to-End Verification for Sensor & Controller */
#include <stdio.h>
#include <assert.h>
#include <math.h>
#include "Sensor.h"
#include "Controller.h"
#include "relationships.h"

int main(void) {
    Sensor s;
    Controller ctrl;

    /* 1. Verify Lifecycle Helpers: Sensor_init(&s) & Controller_init(&ctrl) */
    Controller_init(&ctrl);
    Sensor_init(&s);

    assert(fabsf(s.suhu - 0.0f) < 1e-5f);
    assert(s.controller == NULL);
    assert(s.current_state == SENSOR_STATE_IDLE);
    assert(fabsf(ctrl.batas_suhu - 30.0f) < 1e-5f);
    assert(ctrl.alarm_aktif == false);
    printf("[1/5] PASS: Sensor_init(&s) & Controller_init(&ctrl) initialized fields safely.\\n");

    /* 2. Verify Method Translation: Sensor_bacaData(&s) */
    Sensor_bacaData(&s);
    assert(fabsf(s.suhu - 27.5f) < 1e-5f);
    printf("[2/5] PASS: Sensor_bacaData(&s) updated s.suhu = %.2f C.\\n", s.suhu);

    /* 3. Verify Association Relationship R1 (Sensor -> Controller) */
    Sensor_relate_R1(&s, &ctrl);
    assert(s.controller == &ctrl);
    bool alarm = Controller_cekAmbangBatas(s.controller, s.suhu);
    assert(alarm == false);
    printf("[3/5] PASS: Relationship R1 linked (s.controller == &ctrl), cekAmbangBatas(27.5 <= 30.0) == false.\\n");

    /* 4. Verify State Machine & OAL Entry Action (Normal Sampling) */
    s.suhu = 0.0f;
    Sensor_dispatch_event(&s, SENSOR_EVENT_STARTSAMPLING);
    assert(s.current_state == SENSOR_STATE_SAMPLING);
    assert(fabsf(s.suhu - 27.5f) < 1e-5f);
    Sensor_dispatch_event(&s, SENSOR_EVENT_SAMPLEOK);
    assert(s.current_state == SENSOR_STATE_IDLE);
    printf("[4/5] PASS: FSM Idle -> Sampling (OAL entry executed bacaData) -> Idle.\\n");

    /* 5. Verify State Machine & OAL Entry Action (Overheat Branch via R1 Navigation) */
    Controller_set_batas_suhu(&ctrl, 25.0f);
    Sensor_dispatch_event(&s, SENSOR_EVENT_STARTSAMPLING);
    /* Since 27.5f > 25.0f, OAL entry action in Sampling self-generates SEN3:Overheat -> OverheatAlert */
    assert(s.current_state == SENSOR_STATE_OVERHEATALERT);
    assert(ctrl.alarm_aktif == true);
    printf("[5/5] PASS: FSM Overheat OAL branch triggered -> State: %s, ctrl.alarm_aktif = true.\\n",
           Sensor_state_name(s.current_state));

    printf("[SUCCESS] All End-to-End UML-to-C assertions passed with zero errors!\\n");
    return 0;
}
"""
    (out_dir / "main.c").write_text(harness_c, encoding="utf-8")
    print("PASS: test_stage3_generate_sensor_c_and_harness")


if __name__ == '__main__':
    test_load_door_model()
    test_generate_door_code()
    test_oal_parsing()
    test_stage2_sensor_ir_and_strict_validation()
    test_stage1_xtuml_3view_visualizer()
    test_stage3_generate_sensor_c_and_harness()
    print("\nAll tests passed!")
