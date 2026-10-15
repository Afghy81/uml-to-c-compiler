// Integration Tests for UML-to-C Compiler Web Interface
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
