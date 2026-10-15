// UI Logic and Event Handlers
const compiler = new UMLToC();
let generatedFiles = {};
let currentFile = '';

// Default example model
const defaultModel = {
  "name": "DoorSystem",
  "classes": [
    {
      "name": "Door",
      "is_active": true,
      "attributes": [
        {
          "name": "id",
          "type": "int",
          "is_id": true
        },
        {
          "name": "is_locked",
          "type": "bool",
          "default": "false"
        }
      ],
      "operations": [
        {
          "name": "lock",
          "return_type": "void",
          "body": "self.is_locked = true"
        },
        {
          "name": "unlock",
          "return_type": "void",
          "body": "self.is_locked = false"
        }
      ],
      "state_machine": {
        "events": [
          {"name": "open", "id": 1},
          {"name": "close", "id": 2},
          {"name": "lock", "id": 3},
          {"name": "unlock", "id": 4}
        ],
        "states": [
          {"name": "Closed", "id": 0, "is_initial": true},
          {"name": "Open", "id": 1},
          {"name": "Locked", "id": 2}
        ],
        "transitions": [
          {"from": "Closed", "to": "Open", "event": "open"},
          {"from": "Open", "to": "Closed", "event": "close"},
          {"from": "Closed", "to": "Locked", "event": "lock"},
          {"from": "Locked", "to": "Closed", "event": "unlock"}
        ]
      }
    }
  ],
  "relationships": []
};

// DOM Elements
const jsonEditor = document.getElementById('jsonEditor');
const outputEditor = document.getElementById('outputEditor');
const jsonLineNumbers = document.getElementById('jsonLineNumbers');
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
const statusText = document.getElementById('statusText');
const statusInfo = document.getElementById('statusInfo');

// Initialize with default model
jsonEditor.value = JSON.stringify(defaultModel, null, 2);
updateLineNumbers(jsonEditor, jsonLineNumbers);
// Auto-compile default model so C OUTPUT not empty/error on first load
setTimeout(() => compileBtn.click(), 50);

// Update line numbers
function updateLineNumbers(editor, lineNumbersDiv) {
    const lines = editor.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
    }
    lineNumbersDiv.textContent = numbers;
}

// Sync scroll
jsonEditor.addEventListener('scroll', () => {
    jsonLineNumbers.scrollTop = jsonEditor.scrollTop;
});

outputEditor.addEventListener('scroll', () => {
    outputLineNumbers.scrollTop = outputEditor.scrollTop;
});

// Update line numbers on input
jsonEditor.addEventListener('input', () => {
    updateLineNumbers(jsonEditor, jsonLineNumbers);
});

outputEditor.addEventListener('input', () => {
    updateLineNumbers(outputEditor, outputLineNumbers);
});

// Fill file selector with EVERY generated file (all classes + main.c)
function populateFileSelect() {
    const names = Object.keys(generatedFiles);
    outputFileSelect.innerHTML = names
        .map(name => `<option value="${name}">${name}</option>`)
        .join('');
    currentFile = names[0] || '';
}

// Compile button
compileBtn.addEventListener('click', () => {
    const jsonText = jsonEditor.value.trim();

    if (!jsonText) {
        setStatus('error', 'Please enter a JSON model');
        return;
    }

    setStatus('compiling', 'Compiling...');

    setTimeout(() => {
        const result = compiler.compile(jsonText);

        if (result.success) {
            generatedFiles = result.files;
            populateFileSelect();
            displayCurrentFile();

            const fileCount = Object.keys(generatedFiles).length;
            setStatus('success', `Successfully generated ${fileCount} files`);
        } else {
            outputEditor.value = `Error: ${result.error}`;
            updateLineNumbers(outputEditor, outputLineNumbers);
            setStatus('error', result.error);
        }
    }, 100);
});

// Display currently selected file
function displayCurrentFile() {
    outputEditor.value = generatedFiles[currentFile] || '';
    updateLineNumbers(outputEditor, outputLineNumbers);
}

// Output file selector
outputFileSelect.addEventListener('change', (e) => {
    currentFile = e.target.value;
    displayCurrentFile();
});

// Format JSON
formatJsonBtn.addEventListener('click', () => {
    try {
        const obj = JSON.parse(jsonEditor.value);
        jsonEditor.value = JSON.stringify(obj, null, 2);
        updateLineNumbers(jsonEditor, jsonLineNumbers);
        setStatus('success', 'JSON formatted');
    } catch (error) {
        setStatus('error', 'Invalid JSON: ' + error.message);
    }
});

// Clear JSON
clearJsonBtn.addEventListener('click', () => {
    if (confirm('Clear all JSON input?')) {
        jsonEditor.value = '';
        updateLineNumbers(jsonEditor, jsonLineNumbers);
        setStatus('ready', 'Cleared');
    }
});

// Copy output
copyOutputBtn.addEventListener('click', () => {
    outputEditor.select();
    document.execCommand('copy');
    setStatus('success', 'Code copied to clipboard');
});

// Clear output
clearOutputBtn.addEventListener('click', () => {
    if (!outputEditor.value.trim() && Object.keys(generatedFiles).length === 0) {
        setStatus('ready', 'Output already empty');
        return;
    }
    if (confirm('Clear C output?')) {
        generatedFiles = {};
        currentFile = '';
        outputEditor.value = '';
        updateLineNumbers(outputEditor, outputLineNumbers);
        outputFileSelect.innerHTML = '<option value="">- no output -</option>';
        setStatus('ready', 'Output cleared');
    }
});

// Open JSON file
openJsonBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    // multi .xtuml -> concat before parse; single JSON/.xtuml -> as-is
    const texts = await Promise.all(files.map(f=>f.text()));
    if(files.length===1){
        jsonEditor.value = texts[0];
    } else {
        // tag each file so parser sees all 'within' blocks
        jsonEditor.value = texts.join('\n\n// ===== ' + files.map(f=>f.name).join(', ') + ' =====\n');
    }
    updateLineNumbers(jsonEditor, jsonLineNumbers);
    // auto-compile after load
    setTimeout(()=>compileBtn.click(), 80);
    setStatus('success', `Loaded ${files.map(f=>f.name).join(', ')}`);
});

// Download C code
downloadBtn.addEventListener('click', () => {
    if (Object.keys(generatedFiles).length === 0) {
        setStatus('error', 'No code to download. Compile first.');
        return;
    }

    // Download every generated file (all classes + main.c)
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

// Set status
function setStatus(type, message) {
    statusText.textContent = message;

    const statusBar = document.querySelector('.status-bar');
    statusBar.style.background = {
        'ready': '#007acc',
        'compiling': '#f9a825',
        'success': '#4caf50',
        'error': '#f44336'
    }[type] || '#007acc';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            setStatus('ready', 'Ready');
        }, 3000);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to compile
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileBtn.click();
    }

    // Ctrl/Cmd + S to download
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        downloadBtn.click();
    }
});

// Initial line numbers
updateLineNumbers(outputEditor, outputLineNumbers);
setStatus('ready', 'Ready - Press Ctrl+Enter to compile');
