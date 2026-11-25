// Integration Tests for UML-to-C Compiler Web Interface (3-Stage Interactive Workspace)
class CompilerTests {
    constructor() {
        this.compiler = new UMLToC();
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    assert(condition, testName) {
        if (condition) {
            this.passed++;
            this.results.push(`✓ ${testName}`);
            console.log(`✓ ${testName}`);
        } else {
            this.failed++;
            this.results.push(`✗ ${testName}`);
            console.error(`✗ ${testName}`);
        }
    }

    // Test 1: Valid JSON parsing
    testValidJsonParsing() {
        const validJson = JSON.stringify({
            name: "TestModel",
            classes: [{name: "TestClass", attributes: []}]
        });
        
        const result = this.compiler.compile(validJson);
        this.assert(result.success === true, "Valid JSON parsing");
        this.assert(result.files !== undefined, "Generated files exist");
    }

    // Test 2: Invalid JSON handling
    testInvalidJsonHandling() {
        const invalidJson = "{invalid json";
        const result = this.compiler.compile(invalidJson);
        this.assert(result.success === false, "Invalid JSON rejected");
        this.assert(result.error !== undefined, "Error message provided");
    }

    // Test 3: Model validation
    testModelValidation() {
        const emptyModel = JSON.stringify({name: "Test", classes: []});
        const result = this.compiler.compile(emptyModel);
        this.assert(result.success === false, "Empty classes rejected");
    }

    // Test 4: Class without name
    testClassNameValidation() {
        const noNameClass = JSON.stringify({
            name: "Test",
            classes: [{attributes: []}]
        });
        const result = this.compiler.compile(noNameClass);
        this.assert(result.success === false, "Class without name rejected");
    }

    // Test 5: Header generation
    testHeaderGeneration() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                attributes: [{name: "id", type: "int"}]
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.success === true, "Header generation success");
        this.assert(result.files["Door.h"] !== undefined, "Door.h exists");
        this.assert(result.files["Door.h"].includes("#ifndef DOOR_H"), "Header guard present");
        this.assert(result.files["Door.h"].includes("typedef struct Door_s Door_t"), "Typedef present");
    }

    // Test 6: Source generation
    testSourceGeneration() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{name: "Door", attributes: []}]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.c"] !== undefined, "Door.c exists");
        this.assert(result.files["Door.c"].includes("Door_create"), "Constructor generated");
        this.assert(result.files["Door.c"].includes("Door_destroy"), "Destructor generated");
    }

    // Test 7: State machine generation
    testStateMachineGeneration() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                is_active: true,
                attributes: [],
                state_machine: {
                    states: [{name: "Closed", id: 0, is_initial: true}],
                    events: [{name: "open", id: 1}],
                    transitions: []
                }
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.h"].includes("Door_State"), "State enum generated");
        this.assert(result.files["Door.h"].includes("Door_Event"), "Event enum generated");
        this.assert(result.files["Door.c"].includes("Door_dispatch_event"), "FSM dispatcher generated");
    }

    // Test 8: Operations generation
    testOperationsGeneration() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                attributes: [],
                operations: [{
                    name: "lock",
                    return_type: "void",
                    body: "self.locked = true"
                }]
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.h"].includes("Door_lock"), "Operation declared in header");
        this.assert(result.files["Door.c"].includes("Door_lock"), "Operation defined in source");
    }

    // Test 9: Type mapping
    testTypeMapping() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Test",
                attributes: [
                    {name: "a", type: "int"},
                    {name: "b", type: "bool"},
                    {name: "c", type: "string"}
                ]
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Test.h"].includes("int32_t a"), "int mapped to int32_t");
        this.assert(result.files["Test.h"].includes("bool b"), "bool mapped correctly");
        this.assert(result.files["Test.h"].includes("uml_string_t c"), "string mapped to uml_string_t");
    }

    // Test 10: Default values
    testDefaultValues() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                attributes: [{name: "locked", type: "bool", default: "false"}]
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.c"].includes("self->locked = false"), "Default value initialized");
    }

    // Test 11: Main file generation
    testMainGeneration() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{name: "Door", attributes: []}]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["main.c"] !== undefined, "main.c generated");
        this.assert(result.files["main.c"].includes("int main(void)"), "main function present");
        this.assert(result.files["main.c"].includes('#include "Door.h"'), "Class header included");
    }

    // Test 12: Multiple files
    testMultipleFiles() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{name: "Door", attributes: []}]
        });
        
        const result = this.compiler.compile(model);
        const fileCount = Object.keys(result.files).length;
        this.assert(fileCount === 3, "Three files generated (Door.h, Door.c, main.c)");
    }

    // Test 13: FSM transitions
    testFSMTransitions() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                is_active: true,
                attributes: [],
                state_machine: {
                    states: [
                        {name: "Closed", id: 0, is_initial: true},
                        {name: "Open", id: 1}
                    ],
                    events: [{name: "open", id: 1}],
                    transitions: [{from: "Closed", to: "Open", event: "open"}]
                }
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.c"].includes("DOOR_STATE_CLOSED"), "Source state present");
        this.assert(result.files["Door.c"].includes("DOOR_STATE_OPEN"), "Target state present");
        this.assert(result.files["Door.c"].includes("DOOR_EVENT_OPEN"), "Event present");
    }

    // Test 14: OAL translation
    testOALTranslation() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                attributes: [{name: "locked", type: "bool"}],
                operations: [{
                    name: "lock",
                    return_type: "void",
                    body: "self.locked = true"
                }]
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.c"].includes("self->locked = true"), "OAL self.attr converted to self->attr");
    }

    // Test 15: Initial state
    testInitialState() {
        const model = JSON.stringify({
            name: "Test",
            classes: [{
                name: "Door",
                is_active: true,
                attributes: [],
                state_machine: {
                    states: [{name: "Closed", id: 0, is_initial: true}],
                    events: [],
                    transitions: []
                }
            }]
        });
        
        const result = this.compiler.compile(model);
        this.assert(result.files["Door.c"].includes("DOOR_STATE_CLOSED"), "Initial state set in constructor");
    }

    // Test 16: End-to-End Sensor XML Parsing -> Identification Log -> JSON Sync -> C Translation
    testSensorXmlToJsonToCPipeline() {
        const sensorXml = `<?xml version="1.0" encoding="UTF-8"?>
        <uml:Model xmlns:xmi="http://www.omg.org/XMI" xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML" name="ThermalModel">
            <packagedElement xmi:type="uml:Class" xmi:id="cls_sensor" name="Sensor" key_letters="SEN">
                <ownedAttribute xmi:type="uml:Property" name="suhu" type="float" visibility="private" defaultValue="0.0f"/>
                <ownedOperation xmi:type="uml:Operation" name="bacaData" returnType="void" visibility="public" body="self.suhu = 27.5f"/>
            </packagedElement>
        </uml:Model>`;

        const parseFn = typeof parseXmlOrXmiToModel === 'function'
            ? parseXmlOrXmiToModel
            : (window && window.parseXmlOrXmiToModel);
        const parsed = parseFn(sensorXml);

        this.assert(parsed.success === true, "Sensor XML/XMI parsed successfully");
        this.assert(
            parsed.logs.some(l => l.text.includes("Teridentifikasi Class: Sensor — memiliki atribut `suhu` (tipe: `float`) dan metode `bacaData()`")),
            "Parser identifies Sensor class, attribute suhu (float), and method bacaData()"
        );

        const cRes = this.compiler.compile(JSON.stringify(parsed.model));
        this.assert(cRes.success === true, "Synced Sensor JSON compiled to C");
        this.assert(cRes.files["Sensor.h"].includes("float suhu;"), "Sensor.h contains float suhu;");
        this.assert(cRes.files["Sensor.h"].includes("void Sensor_bacaData(Sensor_t* self);"), "Sensor.h contains Sensor_bacaData(Sensor_t* self)");
        this.assert(cRes.files["Sensor.c"].includes("self->suhu = 27.5f;"), "Sensor.c contains translated method body");
    }

    // Test 17: Preserve Original xtUML Input, Ctrl+Wheel Zoom, and Trash/Bin Reset
    testPreserveInputZoomAndReset() {
        const originalXtumlEnvelope = '{\n  "type": "subsystem",\n  "sub_id": "vm1",\n  "sub_name": "vending_machine_qris",\n  "model": [\n    {\n      "type": "class",\n      "class_id": "1",\n      "class_name": "Product",\n      "KL": "PRD",\n      "attributes": [\n        { "attribute_type": "naming_attribute", "attribute_name": "productCode", "data_type": "string" }\n      ],\n      "operations": ["checkStock()"],\n      "states": []\n    }\n  ]\n}';
        const res = this.compiler.compile(originalXtumlEnvelope);
        this.assert(res.success === true, "Original xtUML VM envelope compiles directly");
        this.assert(res.files["Product.h"] !== undefined, "Product.h generated from xtUML VM envelope");

        // Verify DOM-level preservation, zoom, and reset if running in browser DOM
        if (typeof document !== 'undefined' && document.getElementById) {
            const jEd = document.getElementById('jsonEditor');
            const jLn = document.getElementById('jsonLineNumbers');
            const oEd = document.getElementById('outputEditor');
            const oLn = document.getElementById('outputLineNumbers');
            const clrBtn = document.getElementById('clearJsonBtn');
            if (jEd && oEd && typeof window.zoomEditorFontSize === 'function') {
                const prevText = jEd.value;
                const prevModel = window.canonicalXtUmlJson
                    ? JSON.parse(JSON.stringify(window.canonicalXtUmlJson))
                    : null;

                jEd.value = originalXtumlEnvelope;
                if (typeof syncCanonicalState === 'function') {
                    syncCanonicalState(res.model, 'compile-btn', false);
                }
                this.assert(jEd.value === originalXtumlEnvelope, "Original xtUML input preserved verbatim after compilation");

                const z1 = window.zoomEditorFontSize(jEd, jLn, -100, false);
                const z2 = window.zoomEditorFontSize(oEd, oLn, -100, false);
                this.assert(z1 === 15 && jEd.style.fontSize === '15px', "Left editor Ctrl+Wheel zoom in updates font size");
                this.assert(z2 === 15 && oEd.style.fontSize === '15px', "Right editor Ctrl+Wheel zoom in updates font size");
                window.zoomEditorFontSize(jEd, jLn, 0, true);
                window.zoomEditorFontSize(oEd, oLn, 0, true);

                if (clrBtn && typeof window.resetLeftPanelInputs === 'function') {
                    window.resetLeftPanelInputs();
                    this.assert(jEd.value === '', "Trash button clears left input editor");
                }

                // Restore user's state after test finishes
                if (prevModel && typeof syncCanonicalState === 'function') {
                    syncCanonicalState(prevModel, 'init', true);
                }
                if (prevText) {
                    jEd.value = prevText;
                    if (typeof updateLineNumbers === 'function') updateLineNumbers(jEd, jLn);
                }
            }
        }
    }

    // Run all tests
    runAll() {
        console.log("=== Running UML-to-C Compiler Tests ===\n");
        
        this.testValidJsonParsing();
        this.testInvalidJsonHandling();
        this.testModelValidation();
        this.testClassNameValidation();
        this.testHeaderGeneration();
        this.testSourceGeneration();
        this.testStateMachineGeneration();
        this.testOperationsGeneration();
        this.testTypeMapping();
        this.testDefaultValues();
        this.testMainGeneration();
        this.testMultipleFiles();
        this.testFSMTransitions();
        this.testOALTranslation();
        this.testInitialState();
        this.testSensorXmlToJsonToCPipeline();
        this.testPreserveInputZoomAndReset();
        
        console.log("\n=== Test Results ===");
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Total: ${this.passed + this.failed}`);
        console.log(`Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        
        return {
            passed: this.passed,
            failed: this.failed,
            results: this.results
        };
    }
}

// Export for browser console
window.CompilerTests = CompilerTests;

// Auto-run tests if in test mode
if (window.location.search.includes('test=true')) {
    window.addEventListener('DOMContentLoaded', () => {
        const tests = new CompilerTests();
        const results = tests.runAll();
        
        // Display results in UI
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            statusBar.innerHTML = `
                <span>Tests: ${results.passed} passed, ${results.failed} failed</span>
                <span>${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}% success rate</span>
            `;
            statusBar.style.background = results.failed === 0 ? '#4caf50' : '#f44336';
        }
    });
}
