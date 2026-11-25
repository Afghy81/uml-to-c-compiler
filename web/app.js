// ============================================================================
// xtUML Compiler Web Application — 3-Mode Interactive Workspace (app.js)
// Tab 1 (1. Visual): Full-Canvas Draw.io UML Class Diagram & State Machine
// Single Source of Truth: window.canonicalXtUmlJson
// ============================================================================

const compiler = new UMLToC();
let generatedFiles = {};
let currentFile = '';
let activeTab = 'visual';
let activeVisualSubview = 'class';
let editingClassIndex = null;

// Editor Zoom State (default 14px, clamped 10px..32px)
const EDITOR_DEFAULT_FONT_SIZE = 14;
const EDITOR_MIN_FONT_SIZE = 10;
const EDITOR_MAX_FONT_SIZE = 32;

// Preset 0 (Main): Full xtUML Vending Machine QRIS (R1..R10, SalesRecord R8, Reflexive R10, Enumerations, state_transition_table)
const vendingFullPresetRaw = {
  "type": "subsystem",
  "sub_id": "vm1",
  "sub_name": "vending_machine_qris",
  "enumerations": [
    {
      "name": "MachineState",
      "values": ["Idle", "CheckStock", "PaymentInitiated", "WaitingPayment", "Dispensing", "OutOfStock", "Error"]
    },
    {
      "name": "PaymentStatus",
      "values": ["Waiting", "Pending", "Completed", "Failed", "Canceled"]
    }
  ],
  "model": [
    {
      "type": "class",
      "class_id": "1",
      "class_name": "Product",
      "KL": "PRD",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "productCode", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "name", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "price", "data_type": "real" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "stock", "data_type": "integer" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "minStockThreshold", "data_type": "integer", "default_value": 2 },
        { "attribute_type": "referential_attribute", "attribute_name": "R6_inventoryService", "data_type": "inst_ref<InventoryService>", "relationship_id": "R6" },
        { "attribute_type": "referential_attribute", "attribute_name": "R10_fallbackProduct", "data_type": "inst_ref<Product>", "relationship_id": "R10" }
      ],
      "operations": [
        "checkStock(): boolean",
        "reduceStock(quantity: integer): void"
      ],
      "states": []
    },
    {
      "type": "class",
      "class_id": "2",
      "class_name": "VendingMachine",
      "KL": "VM",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "machineId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "currentState", "data_type": "MachineState", "default_value": "Idle" },
        { "attribute_type": "referential_attribute", "attribute_name": "R1_selectedProduct", "data_type": "inst_ref<Product>", "relationship_id": "R1" },
        { "attribute_type": "referential_attribute", "attribute_name": "R2_userInterface", "data_type": "inst_ref<UserInterface>", "relationship_id": "R2" },
        { "attribute_type": "referential_attribute", "attribute_name": "R3_transaction", "data_type": "inst_ref<Transaction>", "relationship_id": "R3" },
        { "attribute_type": "referential_attribute", "attribute_name": "R7_dispenser", "data_type": "inst_ref<Dispenser>", "relationship_id": "R7" }
      ],
      "operations": [
        "handleSelection(p_productCode: string): boolean",
        "initiatePayment(): boolean",
        "verifyPayment(): boolean",
        "dispenseItem(): void",
        "cancelOrder(): void",
        "handleError(): void"
      ],
      "states": [
        {
          "state_id": "1",
          "state_name": "Idle",
          "state_event": ["ProductSelected"],
          "next_state": "CheckStock",
          "action": "select any p from instances of PRD where (selected.productCode == rcvd_evt.p_productCode);\nif (not_empty p)\n relate self to p across R1;\nend if;"
        },
        {
          "state_id": "2",
          "state_name": "CheckStock",
          "state_event": ["StockEmpty"],
          "next_state": "OutOfStock",
          "action": "select one p related by self->PRD[R1];\nif (p.stock > 0)\n generate VM3:PaymentInitiated() to self;\nelse\n generate VM2:StockEmpty() to self;\nend if;"
        },
        {
          "state_id": "3",
          "state_name": "PaymentInitiated",
          "state_event": ["PaymentInitiated"],
          "next_state": "WaitingPayment",
          "action": "create object instance t of TXN;\nassign t.amount = p.price;\nrelate self to t across R3;\nPS::createQR(t_instance:t);\nui.showQR();"
        },
        {
          "state_id": "4",
          "state_name": "WaitingPayment",
          "state_event": ["PaymentSuccess"],
          "next_state": "Dispensing",
          "action": "select one t related by self->TXN[R3];\nassign t.status = \"Completed\";\nDSP::activateMotor();\ngenerate VM6:ItemDispensed() to self;"
        },
        {
          "state_id": "5",
          "state_name": "WaitingPayment_Failed",
          "state_event": ["PaymentFailed"],
          "next_state": "Error",
          "action": "ui.showError(error_msg:\"Payment failed\");\nunrelate self from t across R3;\ndelete object instance t;\ngenerate VM7:Reset() to self;"
        },
        {
          "state_id": "6",
          "state_name": "Dispensing",
          "state_event": ["ItemDispensed"],
          "next_state": "Idle",
          "action": "assign p.stock = p.stock - 1;\nIS::updateStock(productCode: p.productCode, newStock: p.stock);\nui.showMessage(message:\"Item dispensed\");\nunrelate self from p across R1;"
        },
        {
          "state_id": "7",
          "state_name": "OutOfStock",
          "state_event": ["Reset"],
          "next_state": "Idle",
          "action": "ui.showMessage(message:\"Out of stock. Select another item.\");\nunrelate self from self->PRD[R1] across R1;"
        },
        {
          "state_id": "8",
          "state_name": "Error",
          "state_event": ["Reset"],
          "next_state": "Idle",
          "action": "ui.showMessage(message:\"Initializing system. Ready.\");\nunrelate self from self->PRD[R1] across R1;\nunrelate self from self->TXN[R3] across R3;"
        }
      ]
    },
    {
      "type": "class",
      "class_id": "3",
      "class_name": "UserInterface",
      "KL": "UI",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "uiId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "displayStatus", "data_type": "string" }
      ],
      "operations": [
        "displayScreen(): void",
        "receiveInput(): string",
        "showQR(): void",
        "showMessage(message: string): void",
        "showError(error_msg: string): void"
      ],
      "states": []
    },
    {
      "type": "class",
      "class_id": "4",
      "class_name": "Transaction",
      "KL": "TXN",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "transactionId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "amount", "data_type": "real" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "status", "data_type": "PaymentStatus", "default_value": "Pending" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "timestamp", "data_type": "datetime" }
      ],
      "operations": ["logTransaction(): void"],
      "states": []
    },
    {
      "type": "class",
      "class_id": "5",
      "class_name": "Payment",
      "KL": "PAY",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "paymentId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "amount", "data_type": "real" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "status", "data_type": "PaymentStatus", "default_value": "Waiting" }
      ],
      "operations": ["validateAmount(): boolean"],
      "states": []
    },
    {
      "type": "class",
      "class_id": "6",
      "class_name": "PaymentService",
      "KL": "PS",
      "is_external": true,
      "attributes": [],
      "operations": [
        "createQR(t_instance: inst_ref<Transaction>): void",
        "validatePayment(): boolean"
      ],
      "states": []
    },
    {
      "type": "class",
      "class_id": "7",
      "class_name": "InventoryService",
      "KL": "IS",
      "is_external": true,
      "attributes": [],
      "operations": [
        "getStockStatus(): integer",
        "updateStock(productCode: string, newStock: integer): void"
      ],
      "states": []
    },
    {
      "type": "class",
      "class_id": "8",
      "class_name": "Dispenser",
      "KL": "DSP",
      "is_external": true,
      "attributes": [],
      "operations": ["activateMotor(): void"],
      "states": []
    },
    {
      "type": "class",
      "class_id": "9",
      "class_name": "SalesRecord",
      "KL": "SR",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "recordId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "quantitySold", "data_type": "integer" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "unitPriceAtSale", "data_type": "real" }
      ],
      "operations": ["computeLineTotal(): real"],
      "states": []
    },
    {
      "type": "class",
      "class_id": "10",
      "class_name": "QRISPayment",
      "KL": "QRP",
      "attributes": [
        { "attribute_type": "naming_attribute", "attribute_name": "paymentId", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "qrisPayload", "data_type": "string" },
        { "attribute_type": "descriptive_attribute", "attribute_name": "merchantPan", "data_type": "string" }
      ],
      "operations": ["generateQRIS(): string", "verifyQRIS(): boolean"],
      "states": []
    }
  ],
  "relationships": [
    {
      "rel_id": "R1",
      "type": "binary",
      "from_class": "1",
      "from_class_role": "is_selected_by",
      "from_class_multiplicity": "0_star",
      "to_class": "2",
      "to_class_role": "selects",
      "to_class_multiplicity": "0_one",
      "is_referential": true
    },
    {
      "rel_id": "R2",
      "type": "binary",
      "from_class": "2",
      "from_class_role": "interactsThrough",
      "from_class_multiplicity": "1",
      "to_class": "3",
      "to_class_role": "uses",
      "to_class_multiplicity": "1"
    },
    {
      "rel_id": "R3",
      "type": "binary",
      "from_class": "2",
      "from_class_role": "records",
      "from_class_multiplicity": "1",
      "to_class": "4",
      "to_class_role": "is_recorded_by",
      "to_class_multiplicity": "0_star",
      "is_referential": true
    },
    {
      "rel_id": "R4",
      "type": "binary",
      "from_class": "4",
      "from_class_role": "hasPayment",
      "from_class_multiplicity": "1",
      "to_class": "5",
      "to_class_role": "is_recorded_in",
      "to_class_multiplicity": "0_one"
    },
    {
      "rel_id": "R5",
      "type": "binary",
      "from_class": "5",
      "from_class_role": "processedBy",
      "from_class_multiplicity": "0_star",
      "to_class": "6",
      "to_class_role": "processes",
      "to_class_multiplicity": "1"
    },
    {
      "rel_id": "R6",
      "type": "binary",
      "from_class": "1",
      "from_class_role": "managedBy",
      "from_class_multiplicity": "0_star",
      "to_class": "7",
      "to_class_role": "uses",
      "to_class_multiplicity": "1"
    },
    {
      "rel_id": "R7",
      "type": "binary",
      "from_class": "2",
      "from_class_role": "controls",
      "from_class_multiplicity": "1",
      "to_class": "8",
      "to_class_role": "dispenses_for",
      "to_class_multiplicity": "1"
    },
    {
      "rel_id": "R8",
      "type": "associative",
      "from_class": "1",
      "from_class_role": "sold_in",
      "from_class_multiplicity": "1_star",
      "to_class": "4",
      "to_class_role": "includes_item",
      "to_class_multiplicity": "0_star",
      "association_class": "9"
    },
    {
      "rel_id": "R9",
      "type": "generalization",
      "supertype_class_id": "5",
      "subtype_class_ids": ["10"],
      "from_class": "10",
      "to_class": "5",
      "from_class_role": "is_a",
      "to_class_role": "generalizes"
    },
    {
      "rel_id": "R10",
      "type": "binary",
      "from_class": "1",
      "from_class_role": "replaces",
      "from_class_multiplicity": "0_one",
      "to_class": "1",
      "to_class_role": "replaced_by",
      "to_class_multiplicity": "0_one"
    }
  ],
  "events": [
    { "event_id": "VM1", "class_id": "2", "event_name": "ProductSelected", "parameters": ["p_productCode: string"] },
    { "event_id": "VM2", "class_id": "2", "event_name": "StockEmpty", "parameters": [] },
    { "event_id": "VM3", "class_id": "2", "event_name": "PaymentInitiated", "parameters": [] },
    { "event_id": "VM4", "class_id": "2", "event_name": "PaymentSuccess", "parameters": [] },
    { "event_id": "VM5", "class_id": "2", "event_name": "PaymentFailed", "parameters": [] },
    { "event_id": "VM6", "class_id": "2", "event_name": "ItemDispensed", "parameters": [] },
    { "event_id": "VM7", "class_id": "2", "event_name": "Reset", "parameters": [] }
  ],
  "state_transition_table": [
    { "current_state": "Idle", "event_id": "VM1", "event_name": "ProductSelected", "next_state": "CheckStock" },
    { "current_state": "CheckStock", "event_id": "VM3", "event_name": "PaymentInitiated", "next_state": "PaymentInitiated" },
    { "current_state": "CheckStock", "event_id": "VM2", "event_name": "StockEmpty", "next_state": "OutOfStock" },
    { "current_state": "PaymentInitiated", "event_id": "VM3", "event_name": "PaymentInitiated", "next_state": "WaitingPayment" },
    { "current_state": "PaymentInitiated", "event_id": "VM7", "event_name": "Reset", "next_state": "Idle" },
    { "current_state": "WaitingPayment", "event_id": "VM4", "event_name": "PaymentSuccess", "next_state": "Dispensing" },
    { "current_state": "WaitingPayment", "event_id": "VM5", "event_name": "PaymentFailed", "next_state": "WaitingPayment_Failed" },
    { "current_state": "WaitingPayment_Failed", "event_id": "VM5", "event_name": "PaymentFailed", "next_state": "Error" },
    { "current_state": "Dispensing", "event_id": "VM6", "event_name": "ItemDispensed", "next_state": "Idle" },
    { "current_state": "OutOfStock", "event_id": "VM7", "event_name": "Reset", "next_state": "Idle" },
    { "current_state": "Error", "event_id": "VM7", "event_name": "Reset", "next_state": "Idle" }
  ]
};

// Preset 1: Model Sensor & Controller
const sensorPresetModel = {
  "name": "SmartThermalMonitor",
  "classes": [
    {
      "name": "Sensor",
      "key_letters": "SEN",
      "is_active": true,
      "attributes": [
        { "name": "suhu", "type": "float", "raw_type": "float", "visibility": "private", "default_value": "0.0f" }
      ],
      "operations": [
        { "name": "bacaData", "return_type": "void", "raw_return_type": "void", "visibility": "public", "parameters": [], "body": "self.suhu = 27.5f" }
      ],
      "state_machine": {
        "events": [
          { "name": "StartSampling", "event_code": "SEN1", "id": 1 },
          { "name": "SampleOK", "event_code": "SEN2", "id": 2 },
          { "name": "Overheat", "event_code": "SEN3", "id": 3 },
          { "name": "Reset", "event_code": "SEN4", "id": 4 }
        ],
        "states": [
          { "name": "Idle", "id": 0, "is_initial": true, "entry_action": "self.suhu = 0.0f;" },
          { "name": "Sampling", "id": 1, "is_initial": false, "entry_action": "self.bacaData();\nselect one ctrl related by self->CTL[R1];\nif (not_empty ctrl)\n  if (self.suhu > ctrl.batas_suhu)\n    generate SEN3:Overheat() to self;\n  end if;\nend if;" },
          { "name": "OverheatAlert", "id": 2, "is_initial": false, "entry_action": "select one ctrl related by self->CTL[R1];\nif (not_empty ctrl)\n  ctrl.alarm_aktif = true;\nend if;" }
        ],
        "transitions": [
          { "from": "Idle", "to": "Sampling", "event": "StartSampling", "event_id": "SEN1", "label": "StartSampling (SEN1)" },
          { "from": "Sampling", "to": "Idle", "event": "SampleOK", "event_id": "SEN2", "label": "SampleOK (SEN2)" },
          { "from": "Sampling", "to": "OverheatAlert", "event": "Overheat", "event_id": "SEN3", "label": "Overheat (SEN3)" },
          { "from": "OverheatAlert", "to": "Idle", "event": "Reset", "event_id": "SEN4", "label": "Reset (SEN4)" }
        ]
      }
    },
    {
      "name": "Controller",
      "key_letters": "CTL",
      "is_active": false,
      "attributes": [
        { "name": "batas_suhu", "type": "float", "raw_type": "float", "visibility": "public", "default_value": "30.0f" },
        { "name": "alarm_aktif", "type": "bool", "raw_type": "bool", "visibility": "public", "default_value": "false" }
      ],
      "operations": [
        {
          "name": "cekAmbangBatas",
          "return_type": "bool",
          "raw_return_type": "bool",
          "visibility": "public",
          "parameters": [{ "name": "suhu_ukur", "type": "float", "raw_type": "float" }],
          "body": "self.alarm_aktif = (suhu_ukur > self.batas_suhu)\nreturn self.alarm_aktif"
        }
      ]
    }
  ],
  "relationships": [
    {
      "name": "R1",
      "type": "association",
      "source": "Sensor",
      "target": "Controller",
      "source_multiplicity": "0..*",
      "target_multiplicity": "1",
      "source_role": "monitored_by",
      "target_role": "controller"
    }
  ],
  "enumerations": []
};

// Preset 2: Model Door FSM
const doorPresetModel = {
  "name": "DoorSystem",
  "classes": [
    {
      "name": "Door",
      "key_letters": "DR",
      "is_active": true,
      "attributes": [
        { "name": "id", "type": "int", "raw_type": "int", "visibility": "private", "is_id": true },
        { "name": "is_locked", "type": "bool", "raw_type": "bool", "visibility": "private", "default": "false" }
      ],
      "operations": [
        { "name": "lock", "return_type": "void", "raw_return_type": "void", "parameters": [], "body": "self.is_locked = true" },
        { "name": "unlock", "return_type": "void", "raw_return_type": "void", "parameters": [], "body": "self.is_locked = false" }
      ],
      "state_machine": {
        "events": [
          { "name": "open", "event_code": "DR1", "id": 1 },
          { "name": "close", "event_code": "DR2", "id": 2 },
          { "name": "lock", "event_code": "DR3", "id": 3 },
          { "name": "unlock", "event_code": "DR4", "id": 4 }
        ],
        "states": [
          { "name": "Closed", "id": 0, "is_initial": true, "entry_action": "self.is_locked = false;" },
          { "name": "Open", "id": 1, "is_initial": false, "entry_action": "" },
          { "name": "Locked", "id": 2, "is_initial": false, "entry_action": "self.is_locked = true;" }
        ],
        "transitions": [
          { "from": "Closed", "to": "Open", "event": "open", "event_id": "DR1", "label": "open (DR1)" },
          { "from": "Open", "to": "Closed", "event": "close", "event_id": "DR2", "label": "close (DR2)" },
          { "from": "Closed", "to": "Locked", "event": "lock", "event_id": "DR3", "label": "lock (DR3)" },
          { "from": "Locked", "to": "Closed", "event": "unlock", "event_id": "DR4", "label": "unlock (DR4)" }
        ]
      }
    }
  ],
  "relationships": [],
  "enumerations": []
};

// Normalize initial Vending model
const initialNormalizedVending = _normalizeXtuml(JSON.parse(JSON.stringify(vendingFullPresetRaw)));
window.canonicalXtUmlJson = JSON.parse(JSON.stringify(initialNormalizedVending));
window.lastVerificationReport = null;

// DOM Elements
const jsonEditor = document.getElementById('jsonEditor');
const xmlEditor = document.getElementById('xmlEditor');
const outputEditor = document.getElementById('outputEditor');
const jsonLineNumbers = document.getElementById('jsonLineNumbers');
const xmlLineNumbers = document.getElementById('xmlLineNumbers');
const outputLineNumbers = document.getElementById('outputLineNumbers');

const compileBtn = document.getElementById('compileBtn');
const openJsonBtn = document.getElementById('openJsonBtn');
const downloadBtn = document.getElementById('downloadBtn');
const formatJsonBtn = document.getElementById('formatJsonBtn');
const clearJsonBtn = document.getElementById('clearJsonBtn');
const copyOutputBtn = document.getElementById('copyOutputBtn');
const clearOutputBtn = document.getElementById('clearOutputBtn');
const outputFileSelect = document.getElementById('outputFileSelect');
const fileInput = document.getElementById('fileInput');
const xmlFileInput = document.getElementById('xmlFileInput');
const statusText = document.getElementById('statusText');
const statusInfo = document.getElementById('statusInfo');
const syncBadge = document.getElementById('syncBadge');

// Mode Tab Elements
const modeTabButtons = document.querySelectorAll('.mode-tab');
const tabVisual = document.getElementById('tabVisual');
const tabParsing = document.getElementById('tabParsing');
const tabTranslasi = document.getElementById('tabTranslasi');

// Visual Tab Elements
const subViewButtons = document.querySelectorAll('.sub-view-btn');
const visualSubviewClass = document.getElementById('visualSubviewClass');
const visualSubviewState = document.getElementById('visualSubviewState');
const visualSubviewAction = document.getElementById('visualSubviewAction');
const svgDiagramContainer = document.getElementById('svgDiagramContainer');
const stateDiagramCanvas = document.getElementById('stateDiagramCanvas');
const actionDiagramCanvas = document.getElementById('actionDiagramCanvas');
const stmTabClassName = document.getElementById('stmTabClassName');
const diagramVerifyBadge = document.getElementById('diagramVerifyBadge');
const svgZoomReadout = document.getElementById('svgZoomReadout');
const resetDiagramViewBtn = document.getElementById('resetDiagramViewBtn');
const canvasClassEditorPopover = document.getElementById('canvasClassEditorPopover');
const popoverClassTitle = document.getElementById('popoverClassTitle');
const popoverClassBody = document.getElementById('popoverClassBody');
const closePopoverBtn = document.getElementById('closePopoverBtn');

// Parsing Tab Elements
const parseXmlBtn = document.getElementById('parseXmlBtn');
const uploadXmlBtn = document.getElementById('uploadXmlBtn');
const loadSensorXmlBtn = document.getElementById('loadSensorXmlBtn');
const parsingStatusBadge = document.getElementById('parsingStatusBadge');
const parsingIdentificationLogs = document.getElementById('parsingIdentificationLogs');
const parsingAstTable = document.getElementById('parsingAstTable');

function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function updateLineNumbers(editor, lineNumbersDiv) {
    if (!editor || !lineNumbersDiv) return;
    const text = editor.value || '';
    const lines = text ? text.split('\n').length : 1;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
    }
    lineNumbersDiv.textContent = numbers;
}

// ============================================================================
// 1. TAB NAVIGATION (`1. Visual`, `2. Parsing`, `3. Translasi UML`)
// ============================================================================
function switchModeTab(tabName) {
    activeTab = tabName;
    modeTabButtons.forEach(btn => {
        const isTarget = btn.getAttribute('data-tab') === tabName;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    tabVisual.classList.toggle('active', tabName === 'visual');
    tabParsing.classList.toggle('active', tabName === 'parsing');
    tabTranslasi.classList.toggle('active', tabName === 'translasi');

    const labelMap = {
        visual: '1. Visual (Draw.io Full-Canvas UML Visualizer & Editor)',
        parsing: '2. Parsing (XML/XMI Syntactic & Semantic Inspector)',
        translasi: '3. Translasi UML (Original Input Preserved | Ctrl+Scroll Zoom)'
    };
    if (statusInfo) {
        statusInfo.textContent = `Mode: ${labelMap[tabName] || tabName}`;
    }
}

modeTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        switchModeTab(btn.getAttribute('data-tab'));
    });
});

subViewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        activeVisualSubview = btn.getAttribute('data-subview');
        subViewButtons.forEach(b => b.classList.toggle('active', b === btn));
        visualSubviewClass.classList.toggle('active', activeVisualSubview === 'class');
        visualSubviewState.classList.toggle('active', activeVisualSubview === 'state');
        visualSubviewAction.classList.toggle('active', activeVisualSubview === 'action');
        updateZoomReadout();
    });
});

// ============================================================================
// 2. PAN & ZOOM CAMERA ENGINE FOR FULL-CANVAS DRAW.IO SVG VIEWPORTS
// ============================================================================
const panZoomStates = {
    class: { scale: 1, tx: 0, ty: 0, naturalW: 1600, naturalH: 1000, container: svgDiagramContainer },
    state: { scale: 1, tx: 0, ty: 0, naturalW: 1600, naturalH: 800, container: stateDiagramCanvas }
};

function applyPanZoomTransform(key) {
    const st = panZoomStates[key];
    if (!st || !st.container) return;
    const g = st.container.querySelector('g.svg-camera-viewport');
    if (g) {
        g.setAttribute('transform', `translate(${st.tx.toFixed(1)}, ${st.ty.toFixed(1)}) scale(${st.scale.toFixed(3)})`);
    }
    if (activeVisualSubview === key) {
        updateZoomReadout();
    }
}

function updateZoomReadout() {
    if (!svgZoomReadout) return;
    const key = activeVisualSubview === 'state' ? 'state' : 'class';
    const st = panZoomStates[key];
    if (st) {
        svgZoomReadout.textContent = `${Math.round(st.scale * 100)}%`;
    }
}

function fitViewportToContainer(key) {
    const st = panZoomStates[key];
    if (!st || !st.container) return;
    const rect = st.container.getBoundingClientRect();
    const cw = rect.width > 80 ? rect.width : 820;
    const ch = rect.height > 80 ? rect.height : 580;
    const pad = 28;
    const scaleX = (cw - pad * 2) / Math.max(100, st.naturalW);
    const scaleY = (ch - pad * 2) / Math.max(100, st.naturalH);
    st.scale = Math.min(1.25, Math.max(0.28, Math.min(scaleX, scaleY)));
    st.tx = (cw - st.naturalW * st.scale) / 2;
    st.ty = Math.max(12, (ch - st.naturalH * st.scale) / 2);
    applyPanZoomTransform(key);
}

function setupInteractivePanZoom(key, container) {
    if (!container) return;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const st = panZoomStates[key];
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const nextScale = Math.min(3.2, Math.max(0.22, st.scale * factor));
        st.tx = mx - ((mx - st.tx) / st.scale) * nextScale;
        st.ty = my - ((my - st.ty) / st.scale) * nextScale;
        st.scale = nextScale;
        applyPanZoomTransform(key);
    }, { passive: false });

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        const st = panZoomStates[key];
        startX = e.clientX - st.tx;
        startY = e.clientY - st.ty;
        container.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const st = panZoomStates[key];
        st.tx = e.clientX - startX;
        st.ty = e.clientY - startY;
        applyPanZoomTransform(key);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.classList.remove('dragging');
        }
    });
}

setupInteractivePanZoom('class', svgDiagramContainer);
setupInteractivePanZoom('state', stateDiagramCanvas);

if (resetDiagramViewBtn) {
    resetDiagramViewBtn.addEventListener('click', () => {
        fitViewportToContainer('class');
        fitViewportToContainer('state');
        setStatus('ready', 'Tampilan diagram di-reset ke tengah layar');
    });
}

// ============================================================================
// 3. GEOMETRY HELPERS: MIDPOINT SIDE ANCHORS & SEGMENT-BOX INTERSECTION
// ============================================================================

/**
 * Uji apakah segmen garis (x1,y1)->(x2,y2) memotong AABB box [bx, by, bw, bh]
 * menggunakan algoritma Liang-Barsky (dengan margin padding).
 */
function segmentIntersectsBox(x1, y1, x2, y2, box, pad = 3) {
    const minX = box.x - pad;
    const minY = box.y - pad;
    const maxX = box.x + box.w + pad;
    const maxY = box.y + box.h + pad;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
    let u1 = 0.0;
    let u2 = 1.0;

    for (let i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-7) {
            if (q[i] < 0) return false;
        } else {
            const t = q[i] / p[i];
            if (p[i] < 0) {
                if (t > u2) return false;
                if (t > u1) u1 = t;
            } else {
                if (t < u1) return false;
                if (t < u2) u2 = t;
            }
        }
    }
    // Exclude endpoints touching within 1e-4
    return (u2 - u1) > 1e-4 && u2 > 0.01 && u1 < 0.99;
}

/**
 * Dapatkan titik tengah ke-4 sisi kotak (top, bottom, left, right)
 * dengan opsional offset sejajar sepanjang sisi tersebut.
 */
function getBoxSideMidpoint(box, side, parallelOffset = 0) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    switch (side) {
        case 'top':
            return { x: Math.max(box.x + 12, Math.min(box.x + box.w - 12, cx + parallelOffset)), y: box.y, side: 'top' };
        case 'bottom':
            return { x: Math.max(box.x + 12, Math.min(box.x + box.w - 12, cx + parallelOffset)), y: box.y + box.h, side: 'bottom' };
        case 'left':
            return { x: box.x, y: Math.max(box.y + 12, Math.min(box.y + box.h - 12, cy + parallelOffset)), side: 'left' };
        case 'right':
        default:
            return { x: box.x + box.w, y: Math.max(box.y + 12, Math.min(box.y + box.h - 12, cy + parallelOffset)), side: 'right' };
    }
}

/**
 * Pilih pasangan sisi yang saling menghadap antara boxA dan boxB
 * sedemikian rupa sehingga segmen lurus antara titik tengah kedua sisi tersebut:
 *  1) Tidak menembus bagian dalam boxA maupun boxB, dan
 *  2) Tidak menembus kotak ketiga lainnya di dalam allBoxes.
 */
function chooseFacingMidpoints(boxA, boxB, allBoxes, parallelOffset = 0) {
    const cxA = boxA.x + boxA.w / 2;
    const cyA = boxA.y + boxA.h / 2;
    const cxB = boxB.x + boxB.w / 2;
    const cyB = boxB.y + boxB.h / 2;
    const dx = cxB - cxA;
    const dy = cyB - cyA;

    const horizSep = Math.max(0, Math.abs(dx) - (boxA.w + boxB.w) / 2);
    const vertSep = Math.max(0, Math.abs(dy) - (boxA.h + boxB.h) / 2);

    const hSideA = dx >= 0 ? 'right' : 'left';
    const hSideB = dx >= 0 ? 'left' : 'right';
    const vSideA = dy >= 0 ? 'bottom' : 'top';
    const vSideB = dy >= 0 ? 'top' : 'bottom';

    // Candidate facing side pairs ordered by natural alignment
    const candidates = [];
    if (horizSep >= vertSep) {
        candidates.push([hSideA, hSideB]);
        candidates.push([vSideA, vSideB]);
        candidates.push([vSideA, hSideB]);
        candidates.push([hSideA, vSideB]);
    } else {
        candidates.push([vSideA, vSideB]);
        candidates.push([hSideA, hSideB]);
        candidates.push([hSideA, vSideB]);
        candidates.push([vSideA, hSideB]);
    }

    const otherBoxes = (allBoxes || []).filter(b => b.id !== boxA.id && b.id !== boxB.id);

    let bestChoice = null;
    let bestHits = Infinity;
    let bestDist = Infinity;

    for (const [sA, sB] of candidates) {
        const p1 = getBoxSideMidpoint(boxA, sA, parallelOffset);
        const p2 = getBoxSideMidpoint(boxB, sB, parallelOffset);

        // Check if segment enters boxA or boxB interior
        let selfHit = false;
        if (segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, boxA, -2)) selfHit = true;
        if (segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, boxB, -2)) selfHit = true;

        let hits = selfHit ? 10 : 0;
        for (const ob of otherBoxes) {
            if (segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, ob, 4)) {
                hits++;
            }
        }
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (hits < bestHits || (hits === bestHits && dist < bestDist)) {
            bestHits = hits;
            bestDist = dist;
            bestChoice = { p1, p2, hits };
            if (hits === 0) break;
        }
    }
    return bestChoice;
}

// ============================================================================
// 4. DRAW.IO CLASS DIAGRAM LAYOUT & SVG GENERATOR
// ============================================================================
function buildDrawioClassDiagramData(model) {
    const classes = model.classes || [];
    const rels = model.relationships || [];
    const enums = model.enumerations || [];

    // Group reflexive relationships by class name (e.g. R10 on Product)
    const reflexiveByClass = {};
    rels.forEach(r => {
        if (r.source === r.target && r.source) {
            (reflexiveByClass[r.source] || (reflexiveByClass[r.source] = [])).push(r);
        }
    });

    // 1. Measure every class box (3 compartments: Header, Attributes, Operations)
    const CHAR_W = 7.3;
    const LINE_H = 19;
    const classBoxes = classes.map((cls, idx) => {
        const isExt = Boolean(cls.is_external);
        // Filter out referential_attribute (already represented by relationship lines)
        const visibleAttrs = (cls.attributes || []).filter(a => !a.is_referential);
        const attrLines = visibleAttrs.map(a => {
            const rawT = a.raw_type || a.type || 'string';
            const idTag = a.is_id ? ' {id}' : '';
            const dval = a.default_value !== undefined ? a.default_value : a.default;
            const dStr = (dval !== undefined && dval !== null && dval !== '' && !a.is_id) ? ` = ${dval}` : '';
            return `${a.name}: ${rawT}${dStr}${idTag}`;
        });

        // Add reflexive relationships as text rows inside the class box (e.g. "R10 replaces -> Product [0..1]")
        const reflexRels = reflexiveByClass[cls.name] || [];
        reflexRels.forEach(rr => {
            const role = rr.source_role || rr.target_role || 'self';
            const mult = _formatMult(rr.target_multiplicity || rr.source_multiplicity || '0..1');
            attrLines.push(`${rr.name} ${role} -> ${cls.name} [${mult}]`);
        });

        const opLines = (cls.operations || []).map(op => {
            const pstr = (op.parameters || []).map(p => `${p.name}: ${p.raw_type || p.type}`).join(', ');
            const ret = op.raw_return_type || op.return_type || 'void';
            return `${op.name}(${pstr}): ${ret}`;
        });

        const headerLines = isExt ? ['<<external>>', cls.name] : [cls.name];
        const allTextLines = [...headerLines, ...attrLines, ...opLines];
        const maxChars = Math.max(18, ...allTextLines.map(s => s.length));
        const w = Math.max(210, Math.ceil(maxChars * CHAR_W + 28));

        const hHeader = isExt ? 44 : 32;
        const hAttrs = Math.max(24, attrLines.length * LINE_H + 12);
        const hOps = Math.max(24, opLines.length * LINE_H + 12);
        const h = hHeader + hAttrs + hOps;

        return {
            id: cls.name,
            kind: isExt ? 'external' : 'class',
            clsIndex: idx,
            name: cls.name,
            stereotype: isExt ? '<<external>>' : null,
            attrLines,
            opLines,
            reflexiveCount: reflexRels.length,
            w,
            h,
            hHeader,
            hAttrs,
            hOps,
            x: 0,
            y: 0
        };
    });

    // 2. Measure enumeration boxes (<<enumeration>> at periphery/edge of diagram)
    const enumBoxes = enums.map((en, idx) => {
        const valLines = (en.values || []).map(v => String(v));
        const allLines = ['<<enumeration>>', en.name, ...valLines];
        const maxChars = Math.max(16, ...allLines.map(s => s.length));
        const w = Math.max(175, Math.ceil(maxChars * CHAR_W + 26));
        const hHeader = 44;
        const hVals = Math.max(26, valLines.length * LINE_H + 12);
        return {
            id: `enum_${en.name}`,
            kind: 'enumeration',
            name: en.name,
            stereotype: '<<enumeration>>',
            valLines,
            w,
            h: hHeader + hVals,
            hHeader,
            hVals,
            x: 0,
            y: 0
        };
    });

    // 3. Assign Grid Slots (Row, Col) with uniform gap >= 110px
    // Known canonical planar grid for Vending Machine (R1..R10) + general fallback
    const knownGridSlots = {
        'UserInterface':    { row: 0, col: 0 },
        'VendingMachine':   { row: 0, col: 1 },
        'Dispenser':        { row: 0, col: 2 },
        'PaymentService':   { row: 0, col: 3 },
        'InventoryService': { row: 1, col: 0 },
        'Product':          { row: 1, col: 1 },
        'Transaction':      { row: 1, col: 2 },
        'Payment':          { row: 1, col: 3 },
        'SalesRecord':      { row: 2, col: 1.5 },
        'QRISPayment':      { row: 2, col: 3 }
    };

    const occupied = new Set();
    let maxColUsed = 0;
    let maxRowUsed = 0;

    classBoxes.forEach((b, idx) => {
        const preset = knownGridSlots[b.name];
        if (preset && !occupied.has(`${preset.row}_${preset.col}`)) {
            b.gridRow = preset.row;
            b.gridCol = preset.col;
            occupied.add(`${preset.row}_${preset.col}`);
        } else {
            const colsPerRow = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(classBoxes.length))));
            let r = Math.floor(idx / colsPerRow);
            let c = idx % colsPerRow;
            while (occupied.has(`${r}_${c}`)) {
                c++;
                if (c >= colsPerRow) { c = 0; r++; }
            }
            b.gridRow = r;
            b.gridCol = c;
            occupied.add(`${r}_${c}`);
        }
        if (Math.ceil(b.gridCol) > maxColUsed) maxColUsed = Math.ceil(b.gridCol);
        if (b.gridRow > maxRowUsed) maxRowUsed = b.gridRow;
    });

    // Compute column widths and row heights with generous draw.io gutters (>= 115px horiz, >= 95px vert)
    const GAP_X = 125;
    const GAP_Y = 100;
    const START_X = 50;
    const START_Y = 70;

    const colWidths = {};
    const rowHeights = {};
    classBoxes.forEach(b => {
        const cKey = Math.floor(b.gridCol);
        colWidths[cKey] = Math.max(colWidths[cKey] || 230, b.w);
        rowHeights[b.gridRow] = Math.max(rowHeights[b.gridRow] || 150, b.h);
    });

    const colX = {};
    let curX = START_X;
    for (let c = 0; c <= maxColUsed + 1; c++) {
        colX[c] = curX;
        curX += (colWidths[c] || 240) + GAP_X;
    }

    const rowY = {};
    let curY = START_Y;
    for (let r = 0; r <= maxRowUsed + 1; r++) {
        rowY[r] = curY;
        curY += (rowHeights[r] || 160) + GAP_Y;
    }

    classBoxes.forEach(b => {
        const cFloor = Math.floor(b.gridCol);
        const cFrac = b.gridCol - cFloor;
        if (cFrac > 0.01 && colX[cFloor + 1] !== undefined) {
            // Centered under the midpoint between cFloor and cFloor+1 (e.g. SalesRecord under R8)
            const leftRightEdge = colX[cFloor] + (colWidths[cFloor] || b.w);
            const rightLeftEdge = colX[cFloor + 1];
            const midCorridorX = (leftRightEdge + rightLeftEdge) / 2;
            b.x = Math.round(midCorridorX - b.w / 2);
        } else {
            const cellW = colWidths[cFloor] || b.w;
            b.x = Math.round(colX[cFloor] + (cellW - b.w) / 2);
        }
        b.y = Math.round(rowY[b.gridRow]);
    });

    // Place <<enumeration>> boxes neatly in the right-edge periphery column
    const enumStartX = curX + 20;
    let enumCurY = START_Y;
    enumBoxes.forEach(eb => {
        eb.x = Math.round(enumStartX);
        eb.y = Math.round(enumCurY);
        enumCurY += eb.h + 75;
    });

    const allBoxes = [...classBoxes, ...enumBoxes];
    const boxByName = {};
    classBoxes.forEach(b => { boxByName[b.name] = b; });

    // 4. Route all non-reflexive relationships (R1..R9) as single straight segments
    const pairCounts = {};
    const pairSeen = {};
    const externalRels = rels.filter(r => r.source !== r.target && boxByName[r.source] && boxByName[r.target]);

    externalRels.forEach(r => {
        const key = [r.source, r.target].sort().join('::');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
    });

    const connectors = [];
    externalRels.forEach((r, idx) => {
        const boxA = boxByName[r.source];
        const boxB = boxByName[r.target];
        const key = [r.source, r.target].sort().join('::');
        const idxInPair = pairSeen[key] || 0;
        pairSeen[key] = idxInPair + 1;
        const totalInPair = pairCounts[key] || 1;
        const offset = totalInPair > 1 ? (idxInPair - (totalInPair - 1) / 2) * 24 : 0;

        const choice = chooseFacingMidpoints(boxA, boxB, allBoxes, offset);
        const p1 = choice.p1;
        const p2 = choice.p2;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        const rname = r.name || `R${idx + 1}`;
        const roleText = r.target_role || r.source_role || '';
        const labelText = roleText ? `${rname} ${roleText}` : rname;

        const conn = {
            id: rname,
            rel: r,
            source: r.source,
            target: r.target,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            mx,
            my,
            label: labelText,
            sourceMult: _formatMult(r.source_multiplicity || '1'),
            targetMult: _formatMult(r.target_multiplicity || '1'),
            isGeneralization: r.type === 'generalization',
            assocLink: null
        };

        // Association Class dashed straight line (e.g., R8 midpoint -> SalesRecord top midpoint)
        if (r.association_class && boxByName[r.association_class]) {
            const assocBox = boxByName[r.association_class];
            const dyAssoc = (assocBox.y + assocBox.h / 2) - my;
            const assocSide = dyAssoc >= 0 ? 'top' : 'bottom';
            const assocPt = getBoxSideMidpoint(assocBox, assocSide, 0);
            conn.assocLink = {
                targetClass: r.association_class,
                x1: mx,
                y1: my,
                x2: assocPt.x,
                y2: assocPt.y
            };
        }
        connectors.push(conn);
    });

    const maxRight = Math.max(900, ...allBoxes.map(b => b.x + b.w)) + 80;
    const maxBottom = Math.max(620, ...allBoxes.map(b => b.y + b.h)) + 130;

    return {
        modelName: model.name || 'xtUML_Model',
        classBoxes,
        enumBoxes,
        allBoxes,
        connectors,
        reflexiveByClass,
        totalRelationshipsInJson: rels.length,
        width: maxRight,
        height: maxBottom
    };
}

function renderDrawioClassDiagramSvg(model) {
    if (!svgDiagramContainer) return null;
    const classes = model.classes || [];
    if (classes.length === 0) {
        svgDiagramContainer.innerHTML = '<div style="color:#666;padding:32px;text-align:center;font-size:14px;">Belum ada Class di dalam model. Klik <b>+ Tambah Class</b> atau pilih <b>Preset</b> di atas.</div>';
        return null;
    }

    const layout = buildDrawioClassDiagramData(model);
    panZoomStates.class.naturalW = layout.width;
    panZoomStates.class.naturalH = layout.height;

    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" data-diagram="class">`);
    svgParts.push(`
      <defs>
        <marker id="solidArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1.5 L9,5 L0,8.5 Z" fill="#333333" />
        </marker>
        <marker id="hollowTriangle" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M1,1.5 L13,7 L1,12.5 Z" fill="#ffffff" stroke="#333333" stroke-width="1.5" />
        </marker>
      </defs>
    `);

    svgParts.push(`<g class="svg-camera-viewport">`);

    // 1. UML Frame Header (top-left pentagon like reference image "class Library Domain Model")
    const frameTitle = `class ${layout.modelName}`;
    const frameW = Math.max(220, frameTitle.length * 8 + 34);
    svgParts.push(`
      <g class="uml-frame-header">
        <rect x="16" y="14" width="${layout.width - 32}" height="${layout.height - 28}" fill="none" stroke="#999999" stroke-width="1.2" />
        <polygon points="16,14 ${16 + frameW},14 ${16 + frameW},30 ${16 + frameW - 12},42 16,42" fill="#f5f5f5" stroke="#999999" stroke-width="1.2" />
        <text x="28" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#222222"><tspan font-weight="bold">class</tspan> ${escapeHtml(layout.modelName)}</text>
      </g>
    `);

    // 2. Relationship Lines (Single straight <line> segments ONLY — 0 curves, <=2 points)
    const labelBoxes = [];
    layout.connectors.forEach(conn => {
        const markerAttr = conn.isGeneralization ? ' marker-end="url(#hollowTriangle)"' : '';
        svgParts.push(
            `<line class="uml-connector-line" data-rel="${escapeHtml(conn.id)}" data-source="${escapeHtml(conn.source)}" data-target="${escapeHtml(conn.target)}" x1="${conn.x1}" y1="${conn.y1}" x2="${conn.x2}" y2="${conn.y2}" stroke="#333333" stroke-width="1.5"${markerAttr} />`
        );

        // Association Class dashed straight line (e.g. R8 midpoint -> SalesRecord)
        if (conn.assocLink) {
            svgParts.push(
                `<circle cx="${conn.assocLink.x1}" cy="${conn.assocLink.y1}" r="3.5" fill="#333333" />`
            );
            svgParts.push(
                `<line class="uml-connector-line uml-assoc-dashed" data-rel="${escapeHtml(conn.id)}_assoc" data-source="${escapeHtml(conn.source)}" data-target="${escapeHtml(conn.assocLink.targetClass)}" x1="${conn.assocLink.x1}" y1="${conn.assocLink.y1}" x2="${conn.assocLink.x2}" y2="${conn.assocLink.y2}" stroke="#333333" stroke-width="1.5" stroke-dasharray="6,4" />`
            );
        }

        // Multiplicities near both endpoints (unless generalization)
        if (!conn.isGeneralization) {
            const dx = conn.x2 - conn.x1;
            const dy = conn.y2 - conn.y1;
            const len = Math.max(1, Math.hypot(dx, dy));
            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;

            const m1x = conn.x1 + ux * 24 + nx * 12;
            const m1y = conn.y1 + uy * 24 + ny * 12;
            const m2x = conn.x2 - ux * 26 + nx * 12;
            const m2y = conn.y2 - uy * 26 + ny * 12;

            svgParts.push(
                `<rect x="${(m1x - 16).toFixed(1)}" y="${(m1y - 10).toFixed(1)}" width="32" height="14" rx="2" fill="#ffffff" opacity="0.92" />`,
                `<text x="${m1x.toFixed(1)}" y="${m1y.toFixed(1)}" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#222222" text-anchor="middle">${escapeHtml(conn.sourceMult)}</text>`,
                `<rect x="${(m2x - 16).toFixed(1)}" y="${(m2y - 10).toFixed(1)}" width="32" height="14" rx="2" fill="#ffffff" opacity="0.92" />`,
                `<text x="${m2x.toFixed(1)}" y="${m2y.toFixed(1)}" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#222222" text-anchor="middle">${escapeHtml(conn.targetMult)}</text>`
            );
        }

        // Center relationship label ("Rn nama_role") with white background pill & anti-overlap check
        const lblW = Math.ceil(conn.label.length * 6.8 + 14);
        const lblH = 19;
        let lx = conn.mx - lblW / 2;
        let ly = conn.my - lblH / 2;

        // Nudge along line if overlapping another label
        for (let attempt = 0; attempt < 5; attempt++) {
            const hit = labelBoxes.some(lb =>
                lx < lb.x + lb.w + 4 && lx + lblW + 4 > lb.x &&
                ly < lb.y + lb.h + 4 && ly + lblH + 4 > lb.y
            );
            if (!hit) break;
            ly += (attempt % 2 === 0 ? 1 : -1) * (attempt + 1) * 18;
        }
        labelBoxes.push({ id: conn.id, x: lx, y: ly, w: lblW, h: lblH });

        svgParts.push(
            `<g class="uml-edge-label">`,
            `<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${lblW}" height="${lblH}" rx="3" fill="#ffffff" stroke="#c8d1db" stroke-width="1" />`,
            `<text x="${(lx + lblW / 2).toFixed(1)}" y="${(ly + 13.5).toFixed(1)}" font-family="Segoe UI, Arial, sans-serif" font-size="11.5" font-weight="600" fill="#1a1a1a" text-anchor="middle">${escapeHtml(conn.label)}</text>`,
            `</g>`
        );
    });

    // 3. Draw 3-Compartment Class Boxes (Regular #dae8fc/#6c8ebf, External #fff2cc/#d6b656)
    layout.classBoxes.forEach(b => {
        const isExt = b.kind === 'external';
        const headerFill = isExt ? '#fff2cc' : '#dae8fc';
        const strokeColor = isExt ? '#d6b656' : '#6c8ebf';

        svgParts.push(`<g class="drawio-class-node" data-class-name="${escapeHtml(b.name)}" data-cidx="${b.clsIndex}" transform="translate(${b.x}, ${b.y})">`);
        // Main body background
        svgParts.push(`<rect class="box-main-border" x="0" y="0" width="${b.w}" height="${b.h}" fill="#ffffff" stroke="${strokeColor}" stroke-width="1.5" />`);
        // Header compartment
        svgParts.push(`<rect x="0" y="0" width="${b.w}" height="${b.hHeader}" fill="${headerFill}" stroke="${strokeColor}" stroke-width="1.5" />`);

        if (b.stereotype) {
            svgParts.push(`<text x="${b.w / 2}" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#444444" text-anchor="middle">${escapeHtml(b.stereotype)}</text>`);
            svgParts.push(`<text x="${b.w / 2}" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="bold" fill="#111111" text-anchor="middle">${escapeHtml(b.name)}</text>`);
        } else {
            svgParts.push(`<text x="${b.w / 2}" y="21" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="bold" fill="#111111" text-anchor="middle">${escapeHtml(b.name)}</text>`);
        }

        // Attributes Compartment
        b.attrLines.forEach((line, i) => {
            const ty = b.hHeader + 18 + i * 19;
            const isReflexiveLine = /^R\d+\s+/.test(line);
            const fill = isReflexiveLine ? '#0958d9' : '#1f2328';
            const weight = isReflexiveLine ? ' font-weight="600"' : '';
            svgParts.push(`<text x="10" y="${ty}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="${fill}"${weight}>${escapeHtml(line)}</text>`);
        });

        // Divider between Attributes & Operations
        const opStartY = b.hHeader + b.hAttrs;
        svgParts.push(`<line x1="0" y1="${opStartY}" x2="${b.w}" y2="${opStartY}" stroke="${strokeColor}" stroke-width="1.5" />`);

        // Operations Compartment
        b.opLines.forEach((line, i) => {
            const ty = opStartY + 18 + i * 19;
            svgParts.push(`<text x="10" y="${ty}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#1f2328">${escapeHtml(line)}</text>`);
        });

        svgParts.push(`</g>`);
    });

    // 4. Draw <<enumeration>> Boxes at the Right Edge (#f5f5f5 / #999999)
    layout.enumBoxes.forEach(eb => {
        svgParts.push(`<g class="drawio-enum-node" data-enum-name="${escapeHtml(eb.name)}" transform="translate(${eb.x}, ${eb.y})">`);
        svgParts.push(`<rect x="0" y="0" width="${eb.w}" height="${eb.h}" fill="#ffffff" stroke="#999999" stroke-width="1.5" />`);
        svgParts.push(`<rect x="0" y="0" width="${eb.w}" height="${eb.hHeader}" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" />`);
        svgParts.push(`<text x="${eb.w / 2}" y="15" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#555555" text-anchor="middle">&lt;&lt;enumeration&gt;&gt;</text>`);
        svgParts.push(`<text x="${eb.w / 2}" y="34" font-family="Segoe UI, Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#222222" text-anchor="middle">${escapeHtml(eb.name)}</text>`);

        eb.valLines.forEach((val, i) => {
            const ty = eb.hHeader + 18 + i * 19;
            svgParts.push(`<text x="10" y="${ty}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#333333">${escapeHtml(val)}</text>`);
        });
        svgParts.push(`</g>`);
    });



    svgParts.push(`</g></svg>`);
    svgDiagramContainer.innerHTML = svgParts.join('\n');
    layout.labelBoxes = labelBoxes;
    return layout;
}

// ============================================================================
// 5. DRAW.IO STATE MACHINE (VendingMachine) LAYOUT & SVG GENERATOR
// ============================================================================
function summarizeStateAction(rawAction) {
    if (!rawAction || !rawAction.trim()) return ['// Standby / No entry action'];
    const lines = rawAction
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'));

    const summary = [];
    for (const line of lines) {
        if (/^(end if|else|end for)\b/i.test(line)) continue;
        let clean = line.replace(/;$/, '').trim();
        if (clean.length > 36) {
            clean = clean.slice(0, 34) + '...';
        }
        summary.push(clean);
        if (summary.length >= 3) break;
    }
    return summary.length > 0 ? summary : ['// Entry action'];
}

function buildDrawioStateMachineData(model) {
    const classes = model.classes || [];
    // Prefer VendingMachine if present, else first active class with state_machine
    const targetCls = classes.find(c => c.name === 'VendingMachine' && c.state_machine) ||
                      classes.find(c => c.state_machine && (c.state_machine.states || []).length > 0);

    if (!targetCls || !targetCls.state_machine) {
        return null;
    }

    if (stmTabClassName) {
        stmTabClassName.textContent = targetCls.name;
    }

    const sm = targetCls.state_machine;
    const rawStates = sm.states || [];
    const rawTransitions = sm.transitions || [];

    // Separate self-transitions (written inside state box) from external transitions
    const selfTransByState = {};
    const externalTransitions = [];
    rawTransitions.forEach(tr => {
        const lbl = tr.label || (tr.event_id ? `${tr.event} (${tr.event_id})` : tr.event);
        if (tr.from === tr.to) {
            (selfTransByState[tr.from] || (selfTransByState[tr.from] = [])).push(`${lbl} -> ${tr.to}`);
        } else {
            externalTransitions.push({
                from: tr.from,
                to: tr.to,
                event: tr.event,
                event_id: tr.event_id || '',
                label: lbl
            });
        }
    });

    // Measure state boxes (rounded green #d5e8d4 / #82b366)
    const CHAR_W = 7.2;
    const LINE_H = 18;
    const stateBoxes = rawStates.map((st, idx) => {
        const actionSummary = summarizeStateAction(st.entry || st.entry_action || '');
        const selfLines = (selfTransByState[st.name] || []).map(s => `[Self] ${s}`);
        const bodyLines = [...actionSummary, ...selfLines];
        const maxChars = Math.max(st.name.length + 4, ...bodyLines.map(s => s.length));
        const w = Math.max(225, Math.min(275, Math.ceil(maxChars * CHAR_W + 26)));
        const hHeader = 32;
        const hBody = Math.max(46, bodyLines.length * LINE_H + 16);
        return {
            id: st.name,
            name: st.name,
            is_initial: Boolean(st.is_initial || st.name === 'Idle' || idx === 0),
            bodyLines,
            selfCount: selfLines.length,
            w,
            h: hHeader + hBody,
            hHeader,
            hBody,
            x: 0,
            y: 0
        };
    });

    // Collision-free coordinates: main flow left-to-right on upper rows, error & out-of-stock on lower rows
    const knownStateCoords = {
        'Idle':                  { x: 130,  y: 255 },
        'CheckStock':            { x: 465,  y: 65  },
        'PaymentInitiated':      { x: 810,  y: 160 },
        'WaitingPayment':        { x: 1155, y: 160 },
        'Dispensing':            { x: 1495, y: 265 },
        'OutOfStock':            { x: 465,  y: 535 },
        'Error':                 { x: 810,  y: 410 },
        'WaitingPayment_Failed': { x: 1155, y: 410 }
    };

    stateBoxes.forEach((sb, idx) => {
        if (knownStateCoords[sb.name]) {
            sb.x = knownStateCoords[sb.name].x;
            sb.y = knownStateCoords[sb.name].y;
        } else {
            const col = idx % 4;
            const row = Math.floor(idx / 4);
            sb.x = 140 + col * 340;
            sb.y = 90 + row * 220;
        }
    });

    const boxByName = {};
    stateBoxes.forEach(sb => { boxByName[sb.name] = sb; });

    // Initial black circle pseudostate pointing to Idle
    const idleBox = stateBoxes.find(s => s.name === 'Idle') || stateBoxes[0];
    const initCircle = {
        id: '__ INITIAL __',
        cx: Math.max(46, idleBox.x - 68),
        cy: idleBox.y + idleBox.h / 2,
        r: 10,
        targetX: idleBox.x,
        targetY: idleBox.y + idleBox.h / 2
    };

    // Group transitions by unordered state pair for parallel offset (antiparallel rule)
    const pairListMap = {};
    externalTransitions.forEach(tr => {
        if (!boxByName[tr.from] || !boxByName[tr.to]) return;
        const key = [tr.from, tr.to].sort().join('::');
        (pairListMap[key] || (pairListMap[key] = [])).push(tr);
    });

    const pairIndexTracker = {};
    const transitions = [];
    const labelBoxes = [];

    externalTransitions.forEach((tr, idx) => {
        const boxA = boxByName[tr.from];
        const boxB = boxByName[tr.to];
        if (!boxA || !boxB) return;

        const key = [tr.from, tr.to].sort().join('::');
        const group = pairListMap[key] || [tr];
        const kIdx = pairIndexTracker[key] || 0;
        pairIndexTracker[key] = kIdx + 1;

        // Antiparallel or duplicate pair offset: two parallel straight lines with 24px spacing
        const parallelOffset = group.length > 1 ? (kIdx - (group.length - 1) / 2) * 24 : 0;
        const choice = chooseFacingMidpoints(boxA, boxB, stateBoxes, parallelOffset);
        const p1 = choice.p1;
        const p2 = choice.p2;

        // Position label at t along segment and ensure zero overlap with existing labels/boxes
        const lblW = Math.ceil(tr.label.length * 6.8 + 16);
        const lblH = 20;
        const candidateTs = [0.5, 0.36, 0.64, 0.28, 0.72, 0.42, 0.58];
        let bestLx = (p1.x + p2.x) / 2 - lblW / 2;
        let bestLy = (p1.y + p2.y) / 2 - lblH / 2;

        for (const tParam of candidateTs) {
            const cx = p1.x + (p2.x - p1.x) * tParam;
            const cy = p1.y + (p2.y - p1.y) * tParam;
            const lx = cx - lblW / 2;
            const ly = cy - lblH / 2;
            const overlapsLabel = labelBoxes.some(lb =>
                lx < lb.x + lb.w + 6 && lx + lblW + 6 > lb.x &&
                ly < lb.y + lb.h + 6 && ly + lblH + 6 > lb.y
            );
            const overlapsBox = stateBoxes.some(sb =>
                lx < sb.x + sb.w + 2 && lx + lblW + 2 > sb.x &&
                ly < sb.y + sb.h + 2 && ly + lblH + 2 > sb.y
            );
            if (!overlapsLabel && !overlapsBox) {
                bestLx = lx;
                bestLy = ly;
                break;
            }
        }
        labelBoxes.push({ id: `${tr.from}->${tr.to}`, x: bestLx, y: bestLy, w: lblW, h: lblH });

        transitions.push({
            id: `T${idx + 1}`,
            from: tr.from,
            to: tr.to,
            event: tr.event,
            event_id: tr.event_id,
            label: tr.label,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            lx: bestLx,
            ly: bestLy,
            lblW,
            lblH
        });
    });

    const maxRight = Math.max(1100, ...stateBoxes.map(b => b.x + b.w)) + 90;
    const maxBottom = Math.max(620, ...stateBoxes.map(b => b.y + b.h)) + 115;

    return {
        className: targetCls.name,
        stateBoxes,
        initCircle,
        transitions,
        labelBoxes,
        totalStatesInJson: rawStates.length,
        totalTransitionsInJson: rawTransitions.length,
        width: maxRight,
        height: maxBottom
    };
}

function renderDrawioStateMachineSvg(model) {
    if (!stateDiagramCanvas) return null;
    const stmData = buildDrawioStateMachineData(model);
    if (!stmData) {
        stateDiagramCanvas.innerHTML = '<div style="color:#666;padding:32px;text-align:center;font-size:14px;">Model saat ini tidak memiliki State Machine aktif.</div>';
        return null;
    }

    panZoomStates.state.naturalW = stmData.width;
    panZoomStates.state.naturalH = stmData.height;

    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stmData.width} ${stmData.height}" data-diagram="state">`);
    svgParts.push(`
      <defs>
        <marker id="stmArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1.5 L9,5 L0,8.5 Z" fill="#333333" />
        </marker>
      </defs>
    `);

    svgParts.push(`<g class="svg-camera-viewport">`);

    // 1. UML State Diagram Frame Header
    const frameTitle = `stm ${stmData.className} - UML State Diagram (source: state_transition_table)`;
    const frameW = Math.max(360, frameTitle.length * 7.4 + 32);
    svgParts.push(`
      <g class="uml-frame-header">
        <rect x="16" y="14" width="${stmData.width - 32}" height="${stmData.height - 28}" fill="none" stroke="#999999" stroke-width="1.2" />
        <polygon points="16,14 ${16 + frameW},14 ${16 + frameW},30 ${16 + frameW - 12},42 16,42" fill="#f5f5f5" stroke="#999999" stroke-width="1.2" />
        <text x="28" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#222222"><tspan font-weight="bold">stm</tspan> ${escapeHtml(stmData.className)} - UML State Diagram</text>
      </g>
    `);

    // 2. Initial Black Circle & Straight Line to Idle
    const ic = stmData.initCircle;
    svgParts.push(
        `<circle cx="${ic.cx}" cy="${ic.cy}" r="${ic.r}" fill="#111111" stroke="#111111" stroke-width="1.5" />`,
        `<line class="uml-connector-line" data-from="__init__" data-to="Idle" x1="${ic.cx + ic.r}" y1="${ic.cy}" x2="${ic.targetX}" y2="${ic.targetY}" stroke="#333333" stroke-width="1.5" marker-end="url(#stmArrow)" />`
    );

    // 3. Transition Lines (Single straight <line> segments ONLY)
    stmData.transitions.forEach(tr => {
        svgParts.push(
            `<line class="uml-connector-line" data-trans="${escapeHtml(tr.id)}" data-from="${escapeHtml(tr.from)}" data-to="${escapeHtml(tr.to)}" x1="${tr.x1}" y1="${tr.y1}" x2="${tr.x2}" y2="${tr.y2}" stroke="#333333" stroke-width="1.5" marker-end="url(#stmArrow)" />`
        );
    });

    // 4. Rounded State Boxes (#d5e8d4, border #82b366)
    stmData.stateBoxes.forEach(sb => {
        svgParts.push(`<g class="drawio-state-node" data-state-name="${escapeHtml(sb.name)}" transform="translate(${sb.x}, ${sb.y})">`);
        svgParts.push(`<rect x="0" y="0" width="${sb.w}" height="${sb.h}" rx="10" ry="10" fill="#f7fcf6" stroke="#82b366" stroke-width="1.5" />`);
        svgParts.push(`<rect x="0" y="0" width="${sb.w}" height="${sb.hHeader}" rx="10" ry="10" fill="#d5e8d4" stroke="#82b366" stroke-width="1.5" />`);
        svgParts.push(`<line x1="0" y1="${sb.hHeader}" x2="${sb.w}" y2="${sb.hHeader}" stroke="#82b366" stroke-width="1.5" />`);
        svgParts.push(`<text x="${sb.w / 2}" y="21" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="bold" fill="#111111" text-anchor="middle">${escapeHtml(sb.name)}</text>`);

        sb.bodyLines.forEach((line, i) => {
            const ty = sb.hHeader + 18 + i * 18;
            svgParts.push(`<text x="10" y="${ty}" font-family="Consolas, Segoe UI, sans-serif" font-size="11.5" fill="#2b3a29">${escapeHtml(line)}</text>`);
        });
        svgParts.push(`</g>`);
    });

    // 5. Transition Labels (rendered above lines so always crisp and readable)
    stmData.transitions.forEach(tr => {
        svgParts.push(
            `<g class="uml-edge-label">`,
            `<rect x="${tr.lx.toFixed(1)}" y="${tr.ly.toFixed(1)}" width="${tr.lblW}" height="${tr.lblH}" rx="3" fill="#ffffff" stroke="#b7c4b5" stroke-width="1" />`,
            `<text x="${(tr.lx + tr.lblW / 2).toFixed(1)}" y="${(tr.ly + 14).toFixed(1)}" font-family="Segoe UI, Arial, sans-serif" font-size="11.5" font-weight="600" fill="#1a1a1a" text-anchor="middle">${escapeHtml(tr.label)}</text>`,
            `</g>`
        );
    });

    // 6. State Machine Legend
    const legY = stmData.height - 78;
    svgParts.push(`
      <g class="drawio-legend" transform="translate(34, ${legY})">
        <rect x="0" y="0" width="760" height="46" rx="5" fill="#ffffff" stroke="#bdbdbd" stroke-width="1.2" />
        <circle cx="24" cy="23" r="7" fill="#111111" />
        <text x="38" y="27" font-family="Segoe UI, Arial, sans-serif" font-size="11.5" fill="#222222">Initial Point → Idle</text>

        <rect x="165" y="15" width="24" height="16" rx="4" fill="#d5e8d4" stroke="#82b366" stroke-width="1.5" />
        <text x="196" y="27" font-family="Segoe UI, Arial, sans-serif" font-size="11.5" fill="#222222">State (Nama + Ringkasan Entry Action)</text>

        <line x1="435" y1="23" x2="472" y2="23" stroke="#333333" stroke-width="1.5" marker-end="url(#stmArrow)" />
        <text x="480" y="27" font-family="Segoe UI, Arial, sans-serif" font-size="11.5" fill="#222222">Transisi Lurus 1-Segmen</text>
      </g>
    `);

    svgParts.push(`</g></svg>`);
    stateDiagramCanvas.innerHTML = svgParts.join('\n');
    return stmData;
}

// ============================================================================
// 6. AUTOMATED 4-POINT GEOMETRY & PARITY VERIFIER (`verifyDrawioDiagrams`)
// ============================================================================
function verifyDrawioDiagrams(model, clsLayout, stmLayout) {
    const cLayout = clsLayout || buildDrawioClassDiagramData(model);
    const sLayout = stmLayout || buildDrawioStateMachineData(model);

    // Check 1: Parity of counts between JSON and rendered diagram
    const jsonClassCount = (model.classes || []).length;
    const svgClassCount = cLayout ? cLayout.classBoxes.length : 0;
    const jsonRelCount = (model.relationships || []).length;
    const svgRelCount = cLayout
        ? cLayout.connectors.length + Object.values(cLayout.reflexiveByClass || {}).reduce((acc, arr) => acc + arr.length, 0)
        : 0;
    const jsonStateCount = sLayout ? sLayout.totalStatesInJson : 0;
    const svgStateCount = sLayout ? sLayout.stateBoxes.length : 0;
    const jsonTransCount = sLayout ? sLayout.totalTransitionsInJson : 0;
    const svgTransCount = sLayout
        ? sLayout.transitions.length + sLayout.stateBoxes.reduce((acc, b) => acc + (b.selfCount || 0), 0)
        : 0;

    const parityOk = (jsonClassCount === svgClassCount) &&
                     (jsonRelCount === svgRelCount) &&
                     (jsonStateCount === svgStateCount) &&
                     (jsonTransCount === svgTransCount);

    // Check 2: Zero curved paths (C, Q, S, T, A) on connectors and zero polylines > 2 points
    let curvedConnectors = 0;
    let multiPointPolylines = 0;
    if (typeof document !== 'undefined') {
        [svgDiagramContainer, stateDiagramCanvas].forEach(cont => {
            if (!cont) return;
            cont.querySelectorAll('path.uml-connector-line').forEach(p => {
                const d = p.getAttribute('d') || '';
                if (/[CQSTA]/i.test(d)) curvedConnectors++;
            });
            cont.querySelectorAll('polyline').forEach(pl => {
                const pts = (pl.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean);
                if (pts.length > 2) multiPointPolylines++;
            });
        });
    }
    const straightSegmentsOk = (curvedConnectors === 0 && multiPointPolylines === 0);

    // Check 3: Zero lines passing through boxes other than their source & target
    const boxCollisions = [];
    if (cLayout) {
        cLayout.connectors.forEach(conn => {
            cLayout.allBoxes.forEach(box => {
                if (box.id === conn.source || box.id === conn.target) return;
                if (segmentIntersectsBox(conn.x1, conn.y1, conn.x2, conn.y2, box, 2)) {
                    boxCollisions.push(`ClassDiagram ${conn.id} (${conn.source}->${conn.target}) intersects ${box.id}`);
                }
            });
            if (conn.assocLink) {
                cLayout.allBoxes.forEach(box => {
                    if (box.id === conn.assocLink.targetClass || box.id === conn.source || box.id === conn.target) return;
                    if (segmentIntersectsBox(conn.assocLink.x1, conn.assocLink.y1, conn.assocLink.x2, conn.assocLink.y2, box, 2)) {
                        boxCollisions.push(`ClassDiagram ${conn.id}_assoc intersects ${box.id}`);
                    }
                });
            }
        });
    }
    if (sLayout) {
        sLayout.transitions.forEach(tr => {
            sLayout.stateBoxes.forEach(box => {
                if (box.id === tr.from || box.id === tr.to) return;
                if (segmentIntersectsBox(tr.x1, tr.y1, tr.x2, tr.y2, box, 2)) {
                    boxCollisions.push(`StateMachine ${tr.id} (${tr.from}->${tr.to}) intersects ${box.id}`);
                }
            });
        });
    }
    const noBoxIntersectionsOk = boxCollisions.length === 0;

    // Check 4: Zero box-box overlaps and zero text clipping
    const textOrBoxOverlaps = [];
    const checkBoxList = (boxes, prefix) => {
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const b = boxes[j];
                if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
                    textOrBoxOverlaps.push(`${prefix}: Box ${a.id} overlaps ${b.id}`);
                }
            }
        }
    };
    if (cLayout) checkBoxList(cLayout.allBoxes, 'ClassDiagram');
    if (sLayout) checkBoxList(sLayout.stateBoxes, 'StateMachine');
    const noOverlapsOk = textOrBoxOverlaps.length === 0;

    const allPassed = parityOk && straightSegmentsOk && noBoxIntersectionsOk && noOverlapsOk;
    const report = {
        allPassed,
        check1_parity: {
            passed: parityOk,
            classes: `${svgClassCount}/${jsonClassCount}`,
            relationships: `${svgRelCount}/${jsonRelCount}`,
            states: `${svgStateCount}/${jsonStateCount}`,
            transitions: `${svgTransCount}/${jsonTransCount}`
        },
        check2_straightLines: {
            passed: straightSegmentsOk,
            curvedConnectors,
            multiPointPolylines
        },
        check3_noBoxIntersections: {
            passed: noBoxIntersectionsOk,
            collisions: boxCollisions
        },
        check4_noTextOrBoxOverlaps: {
            passed: noOverlapsOk,
            overlaps: textOrBoxOverlaps
        }
    };

    window.lastVerificationReport = report;
    if (diagramVerifyBadge) {
        if (allPassed) {
            diagramVerifyBadge.textContent = `✓ 4/4 Verified (${svgClassCount} Cls, ${svgRelCount} Rel, ${svgStateCount} St, ${svgTransCount} Tr)`;
            diagramVerifyBadge.style.color = '#81c784';
        } else {
            diagramVerifyBadge.textContent = `⚠ Cek Geometri`;
            diagramVerifyBadge.style.color = '#ffb74d';
        }
    }
    return report;
}

// ============================================================================
// 7. ON-CANVAS FLOATING POPOVER EDITOR (Click any Class Box in SVG to Edit)
// ============================================================================
function openClassEditorPopover(cIdx) {
    const model = window.canonicalXtUmlJson;
    if (!model || !model.classes || !model.classes[cIdx]) return;
    editingClassIndex = cIdx;
    const cls = model.classes[cIdx];

    if (!canvasClassEditorPopover || !popoverClassTitle || !popoverClassBody) return;
    popoverClassTitle.textContent = `Edit Class: ${cls.name} (KL: ${cls.key_letters || cls.name.slice(0, 3).toUpperCase()})`;

    const visibleAttrs = (cls.attributes || []).map((a, aIdx) => ({ a, aIdx })).filter(x => !x.a.is_referential);
    const attrsHtml = visibleAttrs.map(({ a, aIdx }) => `
        <div class="uml-member-item">
            <span>${escapeHtml(a.name)} : <strong style="color:#4ec9b0;">${escapeHtml(a.raw_type || a.type)}</strong>${a.is_id ? ' {id}' : ''}</span>
            <button class="mini-btn-danger" data-pop-action="del-attr" data-aidx="${aIdx}">✕</button>
        </div>
    `).join('') || '<div style="color:#858585;font-size:11px;">(Belum ada atribut)</div>';

    const opsHtml = (cls.operations || []).map((op, oIdx) => `
        <div class="uml-member-item">
            <span>${escapeHtml(op.name)}() : <strong style="color:#4ec9b0;">${escapeHtml(op.raw_return_type || op.return_type || 'void')}</strong></span>
            <button class="mini-btn-danger" data-pop-action="del-op" data-oidx="${oIdx}">✕</button>
        </div>
    `).join('') || '<div style="color:#858585;font-size:11px;">(Belum ada operasi)</div>';

    popoverClassBody.innerHTML = `
        <div>
            <div style="font-size:11px;color:#9cdcfe;font-weight:600;margin-bottom:4px;">ATRIBUT:</div>
            ${attrsHtml}
            <div class="member-add-row">
                <input type="text" id="popAttrName" placeholder="nama atribut" style="flex:1;">
                <select id="popAttrType">
                    <option value="string">string</option>
                    <option value="float">float</option>
                    <option value="int">integer</option>
                    <option value="bool">boolean</option>
                </select>
                <button class="mini-btn mini-btn-accent" data-pop-action="add-attr">+ Attr</button>
            </div>
        </div>
        <div style="border-top:1px solid #38383d;padding-top:8px;">
            <div style="font-size:11px;color:#9cdcfe;font-weight:600;margin-bottom:4px;">OPERASI / METODE:</div>
            ${opsHtml}
            <div class="member-add-row">
                <input type="text" id="popOpName" placeholder="namaMetode" style="flex:1;">
                <select id="popOpRet">
                    <option value="void">void</option>
                    <option value="bool">boolean</option>
                    <option value="float">float</option>
                    <option value="int">integer</option>
                </select>
                <button class="mini-btn mini-btn-primary" data-pop-action="add-op">+ Op</button>
            </div>
        </div>
        <div style="border-top:1px solid #38383d;padding-top:8px;display:flex;justify-content:flex-end;">
            <button class="mini-btn mini-btn-danger" data-pop-action="del-class" style="border:1px solid #f44336;padding:4px 10px;">🗑️ Hapus Class ${escapeHtml(cls.name)}</button>
        </div>
    `;
    canvasClassEditorPopover.classList.remove('hidden');
}

if (closePopoverBtn) {
    closePopoverBtn.addEventListener('click', () => {
        canvasClassEditorPopover.classList.add('hidden');
        editingClassIndex = null;
    });
}

if (svgDiagramContainer) {
    svgDiagramContainer.addEventListener('click', (e) => {
        const node = e.target.closest('g.drawio-class-node');
        if (!node) return;
        const cIdx = parseInt(node.getAttribute('data-cidx'), 10);
        if (!isNaN(cIdx)) {
            openClassEditorPopover(cIdx);
        }
    });
}

if (popoverClassBody) {
    popoverClassBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-pop-action]');
        if (!btn || editingClassIndex === null) return;
        const action = btn.getAttribute('data-pop-action');
        const model = JSON.parse(JSON.stringify(window.canonicalXtUmlJson));
        const cls = model.classes[editingClassIndex];
        if (!cls) return;

        if (action === 'del-class') {
            const removed = cls.name;
            model.classes.splice(editingClassIndex, 1);
            model.relationships = (model.relationships || []).filter(r => r.source !== removed && r.target !== removed);
            canvasClassEditorPopover.classList.add('hidden');
            editingClassIndex = null;
            syncCanonicalState(model, 'visual');
            setStatus('success', `Class '${removed}' dihapus dari diagram`);
        } else if (action === 'add-attr') {
            const aname = (document.getElementById('popAttrName').value || '').trim().replace(/\s+/g, '_');
            const atype = document.getElementById('popAttrType').value;
            if (!aname) return;
            cls.attributes = cls.attributes || [];
            cls.attributes.push({ name: aname, type: atype, raw_type: atype, visibility: 'private' });
            syncCanonicalState(model, 'visual');
            openClassEditorPopover(editingClassIndex);
        } else if (action === 'del-attr') {
            const aIdx = parseInt(btn.getAttribute('data-aidx'), 10);
            cls.attributes.splice(aIdx, 1);
            syncCanonicalState(model, 'visual');
            openClassEditorPopover(editingClassIndex);
        } else if (action === 'add-op') {
            const oname = (document.getElementById('popOpName').value || '').trim().replace(/\s+/g, '_').replace(/\(\)$/, '');
            const oret = document.getElementById('popOpRet').value;
            if (!oname) return;
            cls.operations = cls.operations || [];
            cls.operations.push({ name: oname, return_type: oret, raw_return_type: oret, parameters: [] });
            syncCanonicalState(model, 'visual');
            openClassEditorPopover(editingClassIndex);
        } else if (action === 'del-op') {
            const oIdx = parseInt(btn.getAttribute('data-oidx'), 10);
            cls.operations.splice(oIdx, 1);
            syncCanonicalState(model, 'visual');
            openClassEditorPopover(editingClassIndex);
        }
    });
}

// ============================================================================
// 8. SINGLE SOURCE OF TRUTH SYNCHRONIZATION (`syncCanonicalState`)
// ============================================================================
const PRESERVE_TRANSLASI_SOURCES = new Set(['translasi-input', 'compile-btn', 'file-load']);

function syncCanonicalState(newModel, source = 'init', autoCompile = true) {
    if (!newModel || !Array.isArray(newModel.classes)) return;

    window.canonicalXtUmlJson = JSON.parse(JSON.stringify(newModel));

    // A) Render Tab 1: Full-Canvas Draw.io Class Diagram & State Machine
    renderVisualWorkspace(window.canonicalXtUmlJson, source === 'init' || source === 'preset');

    // B) Sync Tab 2: XML/XMI Input & Semantic Identification Inspector
    if (source !== 'parsing-input' && xmlEditor) {
        xmlEditor.value = modelToXmlXmi(window.canonicalXtUmlJson);
        updateLineNumbers(xmlEditor, xmlLineNumbers);
    }
    renderParsingInspector(window.canonicalXtUmlJson);

    // C) Sync Tab 3: Translasi JSON Editor ONLY when change originated outside Tab 3 / Compile
    if (!PRESERVE_TRANSLASI_SOURCES.has(source) && jsonEditor) {
        if (source === 'init-vending') {
            jsonEditor.value = JSON.stringify(vendingFullPresetRaw, null, 2);
        } else {
            jsonEditor.value = JSON.stringify(window.canonicalXtUmlJson, null, 2);
        }
        updateLineNumbers(jsonEditor, jsonLineNumbers);
    }

    if (syncBadge) {
        syncBadge.textContent = `● Synced (${window.canonicalXtUmlJson.classes.length} Class, ${(window.canonicalXtUmlJson.relationships || []).length} Rel)`;
    }

    if (autoCompile) {
        compileCanonicalModelToC();
    }
}

function renderVisualWorkspace(model, shouldFitCamera = false) {
    const clsLayout = renderDrawioClassDiagramSvg(model);
    const stmLayout = renderDrawioStateMachineSvg(model);
    renderVisualActionDiagram(model);
    populateRelationshipFormSelects(model);
    verifyDrawioDiagrams(model, clsLayout, stmLayout);

    if (shouldFitCamera) {
        setTimeout(() => {
            fitViewportToContainer('class');
            fitViewportToContainer('state');
        }, 20);
    } else {
        applyPanZoomTransform('class');
        applyPanZoomTransform('state');
    }
}

function renderVisualActionDiagram(model) {
    if (!actionDiagramCanvas) return;
    const actionBlocks = [];

    (model.classes || []).forEach(cls => {
        (cls.operations || []).forEach(op => {
            if (op.body && op.body.trim()) {
                actionBlocks.push({
                    title: `Operation ${cls.name}::${op.name}() → C: ${cls.name}_${op.name}(${cls.name}* self)`,
                    raw: op.body.trim()
                });
            }
        });
        if (cls.state_machine && Array.isArray(cls.state_machine.states)) {
            cls.state_machine.states.forEach((st, idx) => {
                const entry = st.entry_action || st.entry;
                if (entry && entry.trim()) {
                    actionBlocks.push({
                        title: `State @state_num(${idx + 1}) ${cls.name}::${st.name} (Entry Action OAL)`,
                        raw: entry.trim()
                    });
                }
            });
        }
    });

    if (actionBlocks.length === 0) {
        actionDiagramCanvas.innerHTML = '<div class="diagram-card">Belum ada blok Action OAL pada metode atau state.</div>';
        return;
    }

    actionDiagramCanvas.innerHTML = actionBlocks.map(blk => {
        const lines = blk.raw.split('\n').map(l => l.trim()).filter(Boolean);
        const nodesHtml = lines.map(line => {
            const isBranch = /^(if|elif|else|end if|while|for)\b/i.test(line);
            return `
                <div class="cfg-arrow">│<br>▼</div>
                <div class="cfg-node ${isBranch ? 'cfg-branch' : ''}">${escapeHtml(line)}</div>
            `;
        }).join('');

        return `
            <div class="diagram-card">
                <div class="diagram-card-title">⚡ xtUML Action Diagram (OAL Control-Flow) — ${escapeHtml(blk.title)}</div>
                <div class="cfg-flow-list">
                    <div class="cfg-node cfg-start">([START])</div>
                    ${nodesHtml}
                    <div class="cfg-arrow">│<br>▼</div>
                    <div class="cfg-node cfg-end">([END])</div>
                </div>
            </div>
        `;
    }).join('');
}

function populateRelationshipFormSelects(model) {
    const srcSel = document.getElementById('newRelSource');
    const tgtSel = document.getElementById('newRelTarget');
    if (!srcSel || !tgtSel) return;
    const opts = (model.classes || []).map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    srcSel.innerHTML = opts;
    tgtSel.innerHTML = opts;
    if ((model.classes || []).length > 1) {
        tgtSel.selectedIndex = 1;
    }
}

// ============================================================================
// 9. TAB 1 SUB-TOOLBAR FORMS (+ Tambah Class & + Relasi)
// ============================================================================
document.getElementById('toggleAddClassFormBtn').addEventListener('click', () => {
    document.getElementById('addClassForm').classList.toggle('hidden');
    document.getElementById('addRelForm').classList.add('hidden');
});

document.getElementById('cancelAddClassBtn').addEventListener('click', () => {
    document.getElementById('addClassForm').classList.add('hidden');
});

document.getElementById('confirmAddClassBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('newClassName');
    const klInput = document.getElementById('newClassKL');
    const extChk = document.getElementById('newClassExternal');
    const activeChk = document.getElementById('newClassActive');

    const cname = (nameInput.value || '').trim().replace(/\s+/g, '');
    if (!cname) {
        setStatus('error', 'Nama Class tidak boleh kosong');
        return;
    }
    const model = JSON.parse(JSON.stringify(window.canonicalXtUmlJson));
    if (model.classes.some(c => c.name === cname)) {
        setStatus('error', `Class '${cname}' sudah ada di dalam model`);
        return;
    }
    const kl = (klInput.value || '').trim().toUpperCase() || cname.slice(0, 3).toUpperCase();
    const isAct = activeChk.checked;
    const isExt = extChk && extChk.checked;

    const newCls = {
        name: cname,
        key_letters: kl,
        is_active: isAct,
        is_external: isExt,
        attributes: [],
        operations: []
    };
    if (isAct) {
        newCls.state_machine = {
            events: [{ name: 'step', id: 1 }],
            states: [{ name: 'Idle', id: 0, is_initial: true, entry_action: '' }],
            transitions: []
        };
    }

    model.classes.push(newCls);
    nameInput.value = '';
    klInput.value = '';
    activeChk.checked = false;
    if (extChk) extChk.checked = false;
    document.getElementById('addClassForm').classList.add('hidden');

    syncCanonicalState(model, 'visual');
    setStatus('success', `Visual: Class '${cname}' ditambahkan ke diagram`);
});

document.getElementById('toggleAddRelFormBtn').addEventListener('click', () => {
    document.getElementById('addRelForm').classList.toggle('hidden');
    document.getElementById('addClassForm').classList.add('hidden');
});

document.getElementById('cancelAddRelBtn').addEventListener('click', () => {
    document.getElementById('addRelForm').classList.add('hidden');
});

document.getElementById('confirmAddRelBtn').addEventListener('click', () => {
    const rname = (document.getElementById('newRelName').value || 'R1').trim();
    const src = document.getElementById('newRelSource').value;
    const tgt = document.getElementById('newRelTarget').value;
    const role = (document.getElementById('newRelRole').value || '').trim() || tgt.toLowerCase();
    const multEl = document.getElementById('newRelMult');
    const mult = multEl ? _formatMult(multEl.value) : '1';

    if (!src || !tgt) {
        setStatus('error', 'Pilih Source dan Target Class terlebih dahulu');
        return;
    }

    const model = JSON.parse(JSON.stringify(window.canonicalXtUmlJson));
    model.relationships = model.relationships || [];
    model.relationships.push({
        name: rname,
        type: 'association',
        source: src,
        target: tgt,
        source_multiplicity: '0..*',
        target_multiplicity: mult,
        target_role: role,
        is_reflexive: src === tgt
    });

    document.getElementById('addRelForm').classList.add('hidden');
    syncCanonicalState(model, 'visual');
    setStatus('success', `Visual: Relasi ${rname} (${src} -> ${tgt}) ditambahkan`);
});

// ============================================================================
// 10. TAB 2: `2. Parsing` (XML / XMI Analysis & Entity Tagging Inspector)
// ============================================================================
function renderParsingInspector(model) {
    if (!parsingIdentificationLogs || !parsingAstTable) return;
    const classes = (model && model.classes) ? model.classes : [];
    if (classes.length === 0) {
        if (parsingStatusBadge) {
            parsingStatusBadge.className = 'badge';
            parsingStatusBadge.textContent = 'Ready (0 Class)';
        }
        parsingIdentificationLogs.innerHTML = '<div style="color:#858585;font-size:12px;">Belum ada entitas untuk dianalisis. Masukkan XML/XMI atau JSON.</div>';
        parsingAstTable.innerHTML = '';
        return;
    }

    const inspection = buildSemanticInspection(model);

    if (parsingStatusBadge) {
        parsingStatusBadge.className = 'badge badge-success';
        parsingStatusBadge.textContent = `✓ Valid (${classes.length} Class Teridentifikasi)`;
    }

    parsingIdentificationLogs.innerHTML = inspection.logs.map(item => `
        <div class="id-log-card" data-class="${escapeHtml(item.className)}">
            🔍 <strong>${item.html}</strong>
        </div>
    `).join('');

    const rowsHtml = inspection.astEntities.map(ent => {
        const tagClass = {
            CLASS: 'tag-class',
            ATTRIBUTE: 'tag-attr',
            METHOD: 'tag-method',
            RELATIONSHIP: 'tag-rel'
        }[ent.category] || 'tag-class';

        return `
            <tr>
                <td><span class="entity-tag ${tagClass}">${escapeHtml(ent.category)}</span></td>
                <td><code>${escapeHtml(ent.entity)}</code></td>
                <td style="color:#9cdcfe;">${escapeHtml(ent.details)}</td>
            </tr>
        `;
    }).join('');

    parsingAstTable.innerHTML = `
        <table class="ast-table">
            <thead>
                <tr>
                    <th style="width:110px;">Kategori</th>
                    <th>Intermediate Representation (AST Node)</th>
                    <th>Target Mapping ANSI C</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
}

function executeXmlParsing() {
    const rawXml = (xmlEditor.value || '').trim();
    if (!rawXml) {
        setStatus('error', 'Masukkan atau tempelkan kode XML / XMI terlebih dahulu');
        return;
    }
    try {
        const parsed = parseXmlOrXmiToModel(rawXml);
        syncCanonicalState(parsed.model, 'parsing-input');
        const firstLog = parsed.logs[0] ? parsed.logs[0].text : 'XML berhasil di-parse';
        setStatus('success', firstLog);
    } catch (err) {
        if (parsingStatusBadge) {
            parsingStatusBadge.className = 'badge badge-error';
            parsingStatusBadge.textContent = '✗ XML Parse Error';
        }
        if (parsingIdentificationLogs) {
            parsingIdentificationLogs.innerHTML = `
                <div class="id-log-card" style="border-left-color:#f44336;color:#ffcdd2;">
                    ✗ <strong>Parser Error:</strong> ${escapeHtml(err.message)}
                </div>
            `;
        }
        setStatus('error', err.message);
    }
}

parseXmlBtn.addEventListener('click', executeXmlParsing);

loadSensorXmlBtn.addEventListener('click', () => {
    const sampleSensorXml = modelToXmlXmi(sensorPresetModel);
    xmlEditor.value = sampleSensorXml;
    updateLineNumbers(xmlEditor, xmlLineNumbers);
    executeXmlParsing();
});

uploadXmlBtn.addEventListener('click', () => {
    xmlFileInput.click();
});

xmlFileInput.addEventListener('change', async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    const text = await file.text();
    xmlEditor.value = text;
    updateLineNumbers(xmlEditor, xmlLineNumbers);
    executeXmlParsing();
});

xmlEditor.addEventListener('input', () => {
    updateLineNumbers(xmlEditor, xmlLineNumbers);
});

xmlEditor.addEventListener('scroll', () => {
    xmlLineNumbers.scrollTop = xmlEditor.scrollTop;
});

// ============================================================================
// 11. TAB 3: `3. Translasi UML` (Non-Destructive Compilation & Live Sync)
// ============================================================================
function compileCanonicalModelToC() {
    const jsonText = (jsonEditor && jsonEditor.value.trim())
        ? jsonEditor.value.trim()
        : JSON.stringify(window.canonicalXtUmlJson, null, 2);

    const result = compiler.compile(jsonText);
    if (result.success) {
        generatedFiles = result.files;
        populateFileSelect();
        displayCurrentFile();
        return result;
    } else {
        outputEditor.value = `Error: ${result.error}`;
        updateLineNumbers(outputEditor, outputLineNumbers);
        return result;
    }
}

let jsonDebounceTimer = null;
jsonEditor.addEventListener('input', () => {
    updateLineNumbers(jsonEditor, jsonLineNumbers);
    clearTimeout(jsonDebounceTimer);
    jsonDebounceTimer = setTimeout(() => {
        const raw = jsonEditor.value.trim();
        if (!raw) return;
        const result = compiler.compile(raw);
        if (result.success && result.model) {
            syncCanonicalState(result.model, 'translasi-input', false);
            generatedFiles = result.files;
            populateFileSelect();
            displayCurrentFile();
        }
    }, 250);
});

jsonEditor.addEventListener('scroll', () => {
    jsonLineNumbers.scrollTop = jsonEditor.scrollTop;
});

outputEditor.addEventListener('scroll', () => {
    outputLineNumbers.scrollTop = outputEditor.scrollTop;
});

outputEditor.addEventListener('input', () => {
    updateLineNumbers(outputEditor, outputLineNumbers);
});

function populateFileSelect() {
    const names = Object.keys(generatedFiles);
    const prev = currentFile;
    outputFileSelect.innerHTML = names
        .map(name => `<option value="${name}">${name}</option>`)
        .join('');
    currentFile = names.includes(prev) ? prev : (names[0] || '');
    outputFileSelect.value = currentFile;
}

function displayCurrentFile() {
    outputEditor.value = generatedFiles[currentFile] || '';
    updateLineNumbers(outputEditor, outputLineNumbers);
}

outputFileSelect.addEventListener('change', (e) => {
    currentFile = e.target.value;
    displayCurrentFile();
});

compileBtn.addEventListener('click', () => {
    if (activeTab === 'parsing' && xmlEditor && xmlEditor.value.trim()) {
        try {
            const parsedXml = parseXmlOrXmiToModel(xmlEditor.value.trim());
            syncCanonicalState(parsedXml.model, 'parsing-input', false);
        } catch (err) {
            setStatus('error', err.message);
            return;
        }
    }

    const rawInputText = jsonEditor.value;
    const trimmedInput = rawInputText.trim();
    if (!trimmedInput) {
        setStatus('error', 'Please enter a model in Visual, Parsing, or Translasi');
        return;
    }

    setStatus('compiling', 'Compiling xtUML model to ANSI C...');
    setTimeout(() => {
        const result = compiler.compile(trimmedInput);
        if (result.success) {
            if (result.model) {
                syncCanonicalState(result.model, 'compile-btn', false);
            }
            generatedFiles = result.files;
            populateFileSelect();
            displayCurrentFile();
            const fileCount = Object.keys(generatedFiles).length;
            setStatus('success', `Successfully generated ${fileCount} ANSI C files (${Object.keys(generatedFiles).join(', ')})`);
        } else {
            outputEditor.value = `Error: ${result.error}`;
            updateLineNumbers(outputEditor, outputLineNumbers);
            setStatus('error', result.error);
        }
    }, 20);
});

// Preset Buttons
const loadVendingPresetBtn = document.getElementById('loadVendingPresetBtn');
if (loadVendingPresetBtn) {
    loadVendingPresetBtn.addEventListener('click', () => {
        jsonEditor.value = JSON.stringify(vendingFullPresetRaw, null, 2);
        updateLineNumbers(jsonEditor, jsonLineNumbers);
        const norm = _normalizeXtuml(JSON.parse(JSON.stringify(vendingFullPresetRaw)));
        syncCanonicalState(norm, 'compile-btn', true);
        fitViewportToContainer('class');
        fitViewportToContainer('state');
        setStatus('success', 'Loaded Preset: Vending Machine QRIS (R1..R10 + state_transition_table)');
    });
}

document.getElementById('loadSensorPresetBtn').addEventListener('click', () => {
    syncCanonicalState(sensorPresetModel, 'preset');
    setStatus('success', 'Loaded Preset: Sensor (float suhu, bacaData()) & Controller');
});

document.getElementById('loadDoorPresetBtn').addEventListener('click', () => {
    syncCanonicalState(doorPresetModel, 'preset');
    setStatus('success', 'Loaded Preset: DoorSystem FSM');
});

// Format JSON
formatJsonBtn.addEventListener('click', () => {
    try {
        const obj = JSON.parse(jsonEditor.value);
        jsonEditor.value = JSON.stringify(obj, null, 2);
        updateLineNumbers(jsonEditor, jsonLineNumbers);
        const result = compiler.compile(jsonEditor.value);
        if (result.success && result.model) {
            syncCanonicalState(result.model, 'translasi-input', false);
            generatedFiles = result.files;
            populateFileSelect();
            displayCurrentFile();
        }
        setStatus('success', 'JSON formatted');
    } catch (error) {
        setStatus('error', 'Invalid JSON: ' + error.message);
    }
});

// ============================================================================
// 12. TRASH / BIN RESET BUTTON ON LEFT PANEL (`resetLeftPanelInputs`)
// ============================================================================
function resetLeftPanelInputs() {
    if (jsonEditor) {
        jsonEditor.value = '';
        updateLineNumbers(jsonEditor, jsonLineNumbers);
    }
    if (xmlEditor) {
        xmlEditor.value = '';
        updateLineNumbers(xmlEditor, xmlLineNumbers);
    }
    if (fileInput) fileInput.value = '';
    if (xmlFileInput) xmlFileInput.value = '';
    if (canvasClassEditorPopover) canvasClassEditorPopover.classList.add('hidden');

    window.canonicalXtUmlJson = { name: 'EmptyModel', classes: [], relationships: [], enumerations: [] };
    renderVisualWorkspace(window.canonicalXtUmlJson, false);
    renderParsingInspector(window.canonicalXtUmlJson);

    if (syncBadge) {
        syncBadge.textContent = '● Reset (0 Class, 0 Rel)';
    }
    setStatus('ready', 'Cleared');
}

clearJsonBtn.addEventListener('click', () => {
    resetLeftPanelInputs();
});

copyOutputBtn.addEventListener('click', () => {
    outputEditor.select();
    document.execCommand('copy');
    setStatus('success', 'C code copied to clipboard');
});

clearOutputBtn.addEventListener('click', () => {
    generatedFiles = {};
    currentFile = '';
    outputEditor.value = '';
    updateLineNumbers(outputEditor, outputLineNumbers);
    outputFileSelect.innerHTML = '<option value="">- no output -</option>';
    setStatus('ready', 'Output cleared');
});

openJsonBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const texts = await Promise.all(files.map(f => f.text()));
    const firstText = texts[0].trim();

    if (firstText.startsWith('<')) {
        xmlEditor.value = texts[0];
        updateLineNumbers(xmlEditor, xmlLineNumbers);
        switchModeTab('parsing');
        executeXmlParsing();
        return;
    }

    if (files.length === 1) {
        jsonEditor.value = texts[0];
    } else {
        jsonEditor.value = texts.join('\n\n// ===== ' + files.map(f => f.name).join(', ') + ' =====\n');
    }
    updateLineNumbers(jsonEditor, jsonLineNumbers);
    compileBtn.click();
    setTimeout(() => {
        fitViewportToContainer('class');
        fitViewportToContainer('state');
    }, 60);
    setStatus('success', `Loaded ${files.map(f => f.name).join(', ')}`);
});

downloadBtn.addEventListener('click', () => {
    if (Object.keys(generatedFiles).length === 0) {
        setStatus('error', 'No code to download. Compile first.');
        return;
    }
    Object.entries(generatedFiles).forEach(([filename, content]) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
    setStatus('success', `Downloaded ${Object.keys(generatedFiles).length} files`);
});

// ============================================================================
// 13. `Ctrl + Mouse Wheel` FONT ZOOM FOR BOTH LEFT & RIGHT TEXT EDITORS
// ============================================================================
function applyEditorFontSize(editor, lineNumbersDiv, sizePx) {
    if (!editor) return EDITOR_DEFAULT_FONT_SIZE;
    const clamped = Math.min(EDITOR_MAX_FONT_SIZE, Math.max(EDITOR_MIN_FONT_SIZE, Math.round(sizePx)));
    editor.dataset.fontSize = String(clamped);
    editor.style.fontSize = `${clamped}px`;
    editor.style.lineHeight = '1.6';
    if (lineNumbersDiv) {
        lineNumbersDiv.style.fontSize = `${clamped}px`;
        lineNumbersDiv.style.lineHeight = '1.6';
        lineNumbersDiv.scrollTop = editor.scrollTop;
    }
    return clamped;
}

function zoomEditorFontSize(editor, lineNumbersDiv, deltaY, reset = false) {
    if (!editor) return EDITOR_DEFAULT_FONT_SIZE;
    if (reset) {
        return applyEditorFontSize(editor, lineNumbersDiv, EDITOR_DEFAULT_FONT_SIZE);
    }
    const current = parseInt(editor.dataset.fontSize || '', 10) ||
                    parseInt((typeof getComputedStyle === 'function' ? getComputedStyle(editor).fontSize : ''), 10) ||
                    EDITOR_DEFAULT_FONT_SIZE;
    const step = deltaY < 0 ? 1 : -1;
    return applyEditorFontSize(editor, lineNumbersDiv, current + step);
}

function attachEditorWheelZoom(editor, lineNumbersDiv, label) {
    if (!editor) return;
    applyEditorFontSize(editor, lineNumbersDiv, EDITOR_DEFAULT_FONT_SIZE);

    const wrapper = editor.closest('.editor-wrapper') || editor;
    wrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const newSize = zoomEditorFontSize(editor, lineNumbersDiv, e.deltaY, false);
            const pct = Math.round((newSize / EDITOR_DEFAULT_FONT_SIZE) * 100);
            if (statusInfo) {
                statusInfo.textContent = `${label} Zoom: ${newSize}px (${pct}%) — Ctrl+0 to reset`;
            }
        }
    }, { passive: false });

    editor.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
            e.preventDefault();
            const resetSize = zoomEditorFontSize(editor, lineNumbersDiv, 0, true);
            if (statusInfo) {
                statusInfo.textContent = `${label} Zoom: ${resetSize}px (100%)`;
            }
        }
    });
}

attachEditorWheelZoom(jsonEditor, jsonLineNumbers, 'Left Editor (Translasi)');
attachEditorWheelZoom(xmlEditor, xmlLineNumbers, 'Left Editor (XML Parsing)');
attachEditorWheelZoom(outputEditor, outputLineNumbers, 'Right Editor (C OUTPUT)');

// Expose helpers for testing & verification
window.resetLeftPanelInputs = resetLeftPanelInputs;
window.zoomEditorFontSize = zoomEditorFontSize;
window.applyEditorFontSize = applyEditorFontSize;
window.buildDrawioClassDiagramData = buildDrawioClassDiagramData;
window.buildDrawioStateMachineData = buildDrawioStateMachineData;
window.verifyDrawioDiagrams = verifyDrawioDiagrams;

function setStatus(type, message) {
    if (!statusText) return;
    statusText.textContent = message;
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
        statusBar.style.background = {
            'ready': '#007acc',
            'compiling': '#f9a825',
            'success': '#4caf50',
            'error': '#f44336'
        }[type] || '#007acc';
    }
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            setStatus('ready', 'Ready');
        }, 3500);
    }
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileBtn.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        downloadBtn.click();
    }
});

// Initialize workspace on load with Full Vending Machine (R1..R10 + state_transition_table)
if (jsonEditor) {
    jsonEditor.value = JSON.stringify(vendingFullPresetRaw, null, 2);
    updateLineNumbers(jsonEditor, jsonLineNumbers);
}
syncCanonicalState(initialNormalizedVending, 'init-vending', true);
setTimeout(() => {
    fitViewportToContainer('class');
    fitViewportToContainer('state');
}, 40);
setStatus('ready', 'Ready — Draw.io Full-Canvas Class & State Machine Visualizer Active');
