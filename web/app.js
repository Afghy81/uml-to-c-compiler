// ============================================================================
// xtUML Compiler Web Application — 3-Mode Interactive Workspace (app.js)
// Single Source of Truth: window.canonicalXtUmlJson
// Syncs across: 1. Visual  <-->  2. Parsing (XML/XMI)  <-->  3. Translasi (JSON -> C)
// ============================================================================

const compiler = new UMLToC();
let generatedFiles = {};
let currentFile = '';
let activeTab = 'visual';
let activeVisualSubview = 'class';

// Editor Zoom State (default 14px, clamped 10px..32px)
const EDITOR_DEFAULT_FONT_SIZE = 14;
const EDITOR_MIN_FONT_SIZE = 10;
const EDITOR_MAX_FONT_SIZE = 32;

// Preset 1: Model Sensor & Controller (sesuai spesifikasi pengujian utama)
const sensorPresetModel = {
  "name": "SmartThermalMonitor",
  "classes": [
    {
      "name": "Sensor",
      "key_letters": "SEN",
      "is_active": true,
      "attributes": [
        {
          "name": "suhu",
          "type": "float",
          "visibility": "private",
          "default_value": "0.0f"
        }
      ],
      "operations": [
        {
          "name": "bacaData",
          "return_type": "void",
          "visibility": "public",
          "parameters": [],
          "body": "self.suhu = 27.5f"
        }
      ],
      "state_machine": {
        "events": [
          { "name": "StartSampling", "id": 1 },
          { "name": "SampleOK", "id": 2 },
          { "name": "Overheat", "id": 3 },
          { "name": "Reset", "id": 4 }
        ],
        "states": [
          {
            "name": "Idle",
            "id": 0,
            "is_initial": true,
            "entry_action": "self.suhu = 0.0f;"
          },
          {
            "name": "Sampling",
            "id": 1,
            "is_initial": false,
            "entry_action": "self.bacaData();\nselect one ctrl related by self->CTL[R1];\nif (not_empty ctrl)\n  if (self.suhu > ctrl.batas_suhu)\n    generate SEN3:Overheat() to self;\n  end if;\nend if;"
          },
          {
            "name": "OverheatAlert",
            "id": 2,
            "is_initial": false,
            "entry_action": "select one ctrl related by self->CTL[R1];\nif (not_empty ctrl)\n  ctrl.alarm_aktif = true;\nend if;"
          }
        ],
        "transitions": [
          { "from": "Idle", "to": "Sampling", "event": "StartSampling" },
          { "from": "Sampling", "to": "Idle", "event": "SampleOK" },
          { "from": "Sampling", "to": "OverheatAlert", "event": "Overheat" },
          { "from": "OverheatAlert", "to": "Idle", "event": "Reset" }
        ]
      }
    },
    {
      "name": "Controller",
      "key_letters": "CTL",
      "is_active": false,
      "attributes": [
        {
          "name": "batas_suhu",
          "type": "float",
          "visibility": "public",
          "default_value": "30.0f"
        },
        {
          "name": "alarm_aktif",
          "type": "bool",
          "visibility": "public",
          "default_value": "false"
        }
      ],
      "operations": [
        {
          "name": "cekAmbangBatas",
          "return_type": "bool",
          "visibility": "public",
          "parameters": [
            { "name": "suhu_ukur", "type": "float" }
          ],
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
      "target_role": "controller"
    }
  ]
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
        { "name": "id", "type": "int", "visibility": "private", "is_id": true },
        { "name": "is_locked", "type": "bool", "visibility": "private", "default": "false" }
      ],
      "operations": [
        { "name": "lock", "return_type": "void", "parameters": [], "body": "self.is_locked = true" },
        { "name": "unlock", "return_type": "void", "parameters": [], "body": "self.is_locked = false" }
      ],
      "state_machine": {
        "events": [
          { "name": "open", "id": 1 },
          { "name": "close", "id": 2 },
          { "name": "lock", "id": 3 },
          { "name": "unlock", "id": 4 }
        ],
        "states": [
          { "name": "Closed", "id": 0, "is_initial": true, "entry_action": "self.is_locked = false;" },
          { "name": "Open", "id": 1, "is_initial": false, "entry_action": "" },
          { "name": "Locked", "id": 2, "is_initial": false, "entry_action": "self.is_locked = true;" }
        ],
        "transitions": [
          { "from": "Closed", "to": "Open", "event": "open" },
          { "from": "Open", "to": "Closed", "event": "close" },
          { "from": "Closed", "to": "Locked", "event": "lock" },
          { "from": "Locked", "to": "Closed", "event": "unlock" }
        ]
      }
    }
  ],
  "relationships": []
};

// Canonical Single Source of Truth
window.canonicalXtUmlJson = JSON.parse(JSON.stringify(sensorPresetModel));

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
const classCardsGrid = document.getElementById('classCardsGrid');
const relationshipsBar = document.getElementById('relationshipsBar');
const stateDiagramCanvas = document.getElementById('stateDiagramCanvas');
const actionDiagramCanvas = document.getElementById('actionDiagramCanvas');

// Parsing Tab Elements
const parseXmlBtn = document.getElementById('parseXmlBtn');
const uploadXmlBtn = document.getElementById('uploadXmlBtn');
const loadSensorXmlBtn = document.getElementById('loadSensorXmlBtn');
const parsingStatusBadge = document.getElementById('parsingStatusBadge');
const parsingIdentificationLogs = document.getElementById('parsingIdentificationLogs');
const parsingAstTable = document.getElementById('parsingAstTable');

// Utility: HTML Escaping
function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Update line numbers for any textarea editor
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
        visual: '1. Visual (Interactive UML Modeler)',
        parsing: '2. Parsing (XML/XMI Syntactic & Semantic Inspector)',
        translasi: '3. Translasi UML (Original Input Preserved | Ctrl+Scroll Zoom)'
    };
    if (statusInfo) {
        statusInfo.textContent = `Mode: ${labelMap[tabName] || tabName} | Canonical JSON Synced`;
    }
}

modeTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        switchModeTab(btn.getAttribute('data-tab'));
    });
});

// Sub-views inside Tab 1 (`1. Visual`: Class Diagram, State Diagram, Action OAL Diagram)
subViewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        activeVisualSubview = btn.getAttribute('data-subview');
        subViewButtons.forEach(b => b.classList.toggle('active', b === btn));
        visualSubviewClass.classList.toggle('active', activeVisualSubview === 'class');
        visualSubviewState.classList.toggle('active', activeVisualSubview === 'state');
        visualSubviewAction.classList.toggle('active', activeVisualSubview === 'action');
    });
});

// ============================================================================
// 2. SINGLE SOURCE OF TRUTH SYNCHRONIZATION (`syncCanonicalState`)
// ============================================================================
// Note: When `source` is 'translasi-input', 'compile-btn', or 'file-load',
// `jsonEditor.value` in `3. Translasi UML` is strictly preserved (never overwritten)
// so original xtUML JSON / .xtuml text remains 100% untouched!
const PRESERVE_TRANSLASI_SOURCES = new Set(['translasi-input', 'compile-btn', 'file-load']);

function syncCanonicalState(newModel, source = 'init', autoCompile = true) {
    if (!newModel || !Array.isArray(newModel.classes)) return;

    // Deep copy to keep state clean
    window.canonicalXtUmlJson = JSON.parse(JSON.stringify(newModel));

    // A) Sync Tab 1: Visual UML Diagram & Interactive Builder
    renderVisualWorkspace(window.canonicalXtUmlJson);

    // B) Sync Tab 2: XML/XMI Input & Semantic Identification Inspector
    if (source !== 'parsing-input' && xmlEditor) {
        xmlEditor.value = modelToXmlXmi(window.canonicalXtUmlJson);
        updateLineNumbers(xmlEditor, xmlLineNumbers);
    }
    renderParsingInspector(window.canonicalXtUmlJson);

    // C) Sync Tab 3: Translasi JSON Editor ONLY when change originated outside Tab 3 / Compile
    if (!PRESERVE_TRANSLASI_SOURCES.has(source) && jsonEditor) {
        jsonEditor.value = JSON.stringify(window.canonicalXtUmlJson, null, 2);
        updateLineNumbers(jsonEditor, jsonLineNumbers);
    }

    // D) Update sync badge
    if (syncBadge) {
        syncBadge.textContent = `● Synced (${window.canonicalXtUmlJson.classes.length} Class, ${(window.canonicalXtUmlJson.relationships || []).length} Rel)`;
    }

    // E) Auto-compile to C OUTPUT
    if (autoCompile) {
        compileCanonicalModelToC();
    }
}

// ============================================================================
// 3. TAB 1 RENDERING: `1. Visual` (SVG Blueprint + Class Cards + FSM + OAL)
// ============================================================================
function renderVisualWorkspace(model) {
    renderSvgClassDiagram(model);
    renderVisualClassCards(model);
    renderRelationshipsBar(model);
    renderVisualStateDiagram(model);
    renderVisualActionDiagram(model);
    populateRelationshipFormSelects(model);
}

function renderSvgClassDiagram(model) {
    if (!svgDiagramContainer) return;
    const classes = model.classes || [];
    if (classes.length === 0) {
        svgDiagramContainer.innerHTML = '<div style="color:#858585;padding:12px;">Belum ada Class. Klik "+ Tambah Class" atau muat file/preset untuk membuat model visual.</div>';
        return;
    }

    const boxWidth = 230;
    const gapX = 75;
    const padX = 24;
    const padY = 20;
    const totalW = Math.max(540, classes.length * boxWidth + (classes.length - 1) * gapX + padX * 2);

    let maxBoxH = 140;
    const boxMetrics = classes.map((cls, idx) => {
        const attrs = cls.attributes || [];
        const ops = cls.operations || [];
        const hHeader = 44;
        const hAttrs = Math.max(28, attrs.length * 18 + 12);
        const hOps = Math.max(36, (ops.length + 1) * 18 + 12);
        const totalH = hHeader + hAttrs + hOps;
        if (totalH > maxBoxH) maxBoxH = totalH;
        return {
            cls,
            x: padX + idx * (boxWidth + gapX),
            y: padY,
            w: boxWidth,
            h: totalH,
            hHeader,
            hAttrs,
            hOps
        };
    });

    const totalH = maxBoxH + padY * 2 + 20;
    const classPosMap = {};
    boxMetrics.forEach(m => { classPosMap[m.cls.name] = m; });

    let svg = `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;font-family:Consolas,monospace;">`;
    svg += `
      <defs>
        <marker id="umlArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,1 L9,5 L0,9 z" fill="#4ec9b0" />
        </marker>
      </defs>
    `;

    // Draw Relationship Arrows first
    (model.relationships || []).forEach((rel, rIdx) => {
        const srcM = classPosMap[rel.source];
        const tgtM = classPosMap[rel.target];
        if (!srcM || !tgtM || srcM === tgtM) return;

        const rname = rel.name || `R${rIdx + 1}`;
        const leftToRight = srcM.x < tgtM.x;
        const x1 = leftToRight ? srcM.x + srcM.w : srcM.x;
        const x2 = leftToRight ? tgtM.x : tgtM.x + tgtM.w;
        const y1 = srcM.y + 45;
        const y2 = tgtM.y + 45;
        const midX = (x1 + x2) / 2;

        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4ec9b0" stroke-width="2" marker-end="url(#umlArrow)" />`;
        svg += `<rect x="${midX - 28}" y="${y1 - 18}" width="56" height="16" rx="3" fill="#1e1e1e" stroke="#4ec9b0" stroke-width="1"/>`;
        svg += `<text x="${midX}" y="${y1 - 6}" fill="#4ec9b0" font-size="10" text-anchor="middle" font-weight="bold">${escapeHtml(rname)}</text>`;
    });

    // Draw Class Boxes
    boxMetrics.forEach(m => {
        const cls = m.cls;
        const kl = cls.key_letters || cls.KL || cls.name.slice(0, 3).toUpperCase();
        const isAct = Boolean(cls.is_active);
        const strokeColor = isAct ? '#4ec9b0' : '#007acc';
        const headerFill = isAct ? '#14493f' : '#094771';

        svg += `<g transform="translate(${m.x}, ${m.y})">`;
        svg += `<rect x="0" y="0" width="${m.w}" height="${m.h}" rx="5" fill="#252526" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<rect x="1" y="1" width="${m.w - 2}" height="${m.hHeader}" rx="4" fill="${headerFill}"/>`;
        svg += `<text x="${m.w / 2}" y="15" fill="#9cdcfe" font-size="10" text-anchor="middle">&lt;&lt;${isAct ? 'Active ' : ''}Class | KL: ${escapeHtml(kl)}&gt;&gt;</text>`;
        svg += `<text x="${m.w / 2}" y="34" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle">${escapeHtml(cls.name)}</text>`;

        // Divider 1
        svg += `<line x1="0" y1="${m.hHeader}" x2="${m.w}" y2="${m.hHeader}" stroke="${strokeColor}" stroke-width="1"/>`;

        // Attributes
        const attrs = cls.attributes || [];
        if (attrs.length === 0) {
            svg += `<text x="10" y="${m.hHeader + 18}" fill="#777" font-size="11">(no attributes)</text>`;
        } else {
            attrs.forEach((a, i) => {
                const sym = (a.visibility === 'public') ? '+' : '-';
                svg += `<text x="10" y="${m.hHeader + 18 + i * 18}" fill="#d4d4d4" font-size="11">${sym} ${escapeHtml(a.name)} : <tspan fill="#4ec9b0">${escapeHtml(a.type)}</tspan></text>`;
            });
        }

        // Divider 2
        const yOps = m.hHeader + m.hAttrs;
        svg += `<line x1="0" y1="${yOps}" x2="${m.w}" y2="${yOps}" stroke="${strokeColor}" stroke-width="1"/>`;

        // Lifecycle + Methods
        svg += `<text x="10" y="${yOps + 18}" fill="#9cdcfe" font-size="11">+ ${escapeHtml(cls.name)}_init(self) : void</text>`;
        (cls.operations || []).forEach((op, i) => {
            const ret = op.return_type || 'void';
            svg += `<text x="10" y="${yOps + 36 + i * 18}" fill="#dcdcaa" font-size="11">+ ${escapeHtml(op.name)}() : <tspan fill="#4ec9b0">${escapeHtml(ret)}</tspan></text>`;
        });

        svg += `</g>`;
    });

    svg += `</svg>`;
    svgDiagramContainer.innerHTML = svg;
}

function renderVisualClassCards(model) {
    if (!classCardsGrid) return;
    const classes = model.classes || [];

    classCardsGrid.innerHTML = classes.map((cls, cIdx) => {
        const kl = cls.key_letters || cls.KL || cls.name.slice(0, 3).toUpperCase();
        const attrs = cls.attributes || [];
        const ops = cls.operations || [];

        const attrListHtml = attrs.map((a, aIdx) => {
            const sym = a.visibility === 'public' ? '+' : '-';
            const dval = a.default_value !== undefined ? a.default_value : a.default;
            return `
                <div class="uml-member-item">
                    <span class="member-sig">
                        <span class="member-vis">${sym}</span>${escapeHtml(a.name)} : <span class="member-type">${escapeHtml(a.type)}</span>${dval ? ` = ${escapeHtml(dval)}` : ''}
                    </span>
                    <button class="mini-btn-danger" data-action="del-attr" data-cidx="${cIdx}" data-aidx="${aIdx}" title="Hapus atribut">✕</button>
                </div>
            `;
        }).join('') || '<div style="color:#777;font-size:11px;padding:2px 0;">(Belum ada atribut)</div>';

        const opListHtml = ops.map((op, oIdx) => {
            const pstr = (op.parameters || []).map(p => `${p.type} ${p.name}`).join(', ');
            const ret = op.return_type || 'void';
            return `
                <div class="uml-member-item" title="${escapeHtml(op.body ? 'OAL: ' + op.body : 'Method')}">
                    <span class="member-sig">
                        <span class="member-vis">+</span>${escapeHtml(op.name)}(${escapeHtml(pstr)}) : <span class="member-type">${escapeHtml(ret)}</span>
                    </span>
                    <button class="mini-btn-danger" data-action="del-op" data-cidx="${cIdx}" data-oidx="${oIdx}" title="Hapus metode">✕</button>
                </div>
            `;
        }).join('');

        return `
            <div class="uml-class-card ${cls.is_active ? 'active-class' : ''}">
                <div class="uml-card-header">
                    <div>
                        <span class="uml-stereotype">&laquo;${cls.is_active ? 'Active Class' : 'Class'} | KL: ${escapeHtml(kl)}&raquo;</span>
                        <span class="uml-class-title">${escapeHtml(cls.name)}</span>
                    </div>
                    <button class="mini-btn-danger" data-action="del-class" data-cidx="${cIdx}" title="Hapus Class ${escapeHtml(cls.name)}">🗑️ Hapus</button>
                </div>

                <!-- Attributes Compartment -->
                <div class="uml-compartment">
                    <div class="compartment-title">
                        <span>Attributes (Struct Fields)</span>
                    </div>
                    ${attrListHtml}
                    <div class="member-add-row">
                        <input type="text" placeholder="nama (mis: suhu)" id="attrName_${cIdx}" style="flex:1;min-width:70px;">
                        <select id="attrType_${cIdx}">
                            <option value="float">float</option>
                            <option value="int">int</option>
                            <option value="bool">bool</option>
                            <option value="string">string</option>
                            <option value="double">double</option>
                        </select>
                        <select id="attrVis_${cIdx}">
                            <option value="private">- priv</option>
                            <option value="public">+ pub</option>
                        </select>
                        <button class="mini-btn mini-btn-accent" data-action="add-attr" data-cidx="${cIdx}">+ Attr</button>
                    </div>
                </div>

                <!-- Operations / Methods Compartment -->
                <div class="uml-compartment">
                    <div class="compartment-title">
                        <span>Methods (C Procedural Functions)</span>
                    </div>
                    <div class="uml-member-item">
                        <span class="member-sig" style="color:#9cdcfe;">
                            <span class="member-vis">+</span>${escapeHtml(cls.name)}_init(${escapeHtml(cls.name)}* self) : <span class="member-type">void</span>
                        </span>
                        <span style="font-size:10px;color:#858585;">auto</span>
                    </div>
                    ${opListHtml}
                    <div class="member-add-row">
                        <input type="text" placeholder="metode (mis: bacaData)" id="opName_${cIdx}" style="flex:1;min-width:85px;">
                        <select id="opRet_${cIdx}">
                            <option value="void">void</option>
                            <option value="float">float</option>
                            <option value="int">int</option>
                            <option value="bool">bool</option>
                        </select>
                        <input type="text" placeholder="OAL (mis: self.suhu = 27.5f)" id="opBody_${cIdx}" style="flex:1;min-width:90px;">
                        <button class="mini-btn mini-btn-primary" data-action="add-op" data-cidx="${cIdx}">+ Method</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRelationshipsBar(model) {
    if (!relationshipsBar) return;
    const rels = model.relationships || [];
    if (rels.length === 0) {
        relationshipsBar.innerHTML = '<span style="font-size:12px;color:#858585;">Relasi Antar-Class: Belum ada relasi (klik "+ Relasi (R1..Rn)" di atas untuk menghubungkan struct pointer).</span>';
        return;
    }

    const pills = rels.map((r, rIdx) => {
        const rname = r.name || `R${rIdx + 1}`;
        const role = r.target_role || r.target.toLowerCase();
        return `
            <span class="rel-pill">
                <strong>[${escapeHtml(rname)}]</strong>
                ${escapeHtml(r.source)} ──► ${escapeHtml(r.target)}
                <span style="color:#9cdcfe;">(${escapeHtml(r.target)}* ${escapeHtml(role)})</span>
                <button class="mini-btn-danger" data-action="del-rel" data-ridx="${rIdx}" title="Hapus relasi">✕</button>
            </span>
        `;
    }).join('');

    relationshipsBar.innerHTML = `<div style="font-size:11px;color:#9cdcfe;margin-bottom:4px;font-weight:600;">RELASI ASOSIASI / KOMPOSISI (STRUCT POINTERS):</div>${pills}`;
}

function renderVisualStateDiagram(model) {
    if (!stateDiagramCanvas) return;
    const activeClasses = (model.classes || []).filter(c => c.is_active && c.state_machine && (c.state_machine.states || []).length > 0);
    if (activeClasses.length === 0) {
        stateDiagramCanvas.innerHTML = '<div class="diagram-card">Model saat ini tidak memiliki Active Class dengan State Machine. Centang "Active (FSM)" saat membuat Class atau muat Preset Sensor / Door.</div>';
        return;
    }

    stateDiagramCanvas.innerHTML = activeClasses.map(cls => {
        const sm = cls.state_machine;
        const kl = cls.key_letters || cls.name.slice(0, 3).toUpperCase();
        const statesHtml = (sm.states || []).map((s, idx) => {
            const entry = s.entry_action || s.entry || '// (no entry OAL)';
            return `
                <div class="fsm-state-node ${s.is_initial ? 'initial-state' : ''}">
                    <div class="fsm-state-header">
                        <span>@state_num(${idx + 1}) ${escapeHtml(s.name)}</span>
                        ${s.is_initial ? '<span>[INITIAL *]</span>' : ''}
                    </div>
                    <div class="fsm-state-body">entry /\n${escapeHtml(entry)}</div>
                </div>
            `;
        }).join('');

        const transHtml = (sm.transitions || []).map(t => `
            <span class="rel-pill" style="border-color:#569cd6;">
                (${escapeHtml(t.from)}) ──[ <strong>${escapeHtml(t.event)}</strong> ]──► (${escapeHtml(t.to)})
            </span>
        `).join('');

        return `
            <div class="diagram-card">
                <div class="diagram-card-title">🔄 xtUML State Machine Diagram — ${escapeHtml(cls.name)} (KL: ${escapeHtml(kl)})</div>
                <div class="fsm-states-flow">${statesHtml}</div>
                <div style="margin-top:10px;font-size:11px;color:#9cdcfe;font-weight:600;">TRANSISI EVENT (${escapeHtml(cls.name)}_dispatch_event):</div>
                <div style="margin-top:4px;">${transHtml}</div>
            </div>
        `;
    }).join('');
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
        actionDiagramCanvas.innerHTML = '<div class="diagram-card">Belum ada blok Action OAL pada metode atau state. Tambahkan OAL seperti <code>self.suhu = 27.5f</code> pada metode Class.</div>';
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
// 4. TAB 1 INTERACTIVE EVENT HANDLERS (Visual Modeler Mutations)
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

    const newCls = {
        name: cname,
        key_letters: kl,
        is_active: isAct,
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
    document.getElementById('addClassForm').classList.add('hidden');

    syncCanonicalState(model, 'visual');
    setStatus('success', `Visual: Class '${cname}' ditambahkan & disinkronkan ke JSON`);
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
        target_multiplicity: '1',
        target_role: role
    });

    document.getElementById('addRelForm').classList.add('hidden');
    syncCanonicalState(model, 'visual');
    setStatus('success', `Visual: Relasi ${rname} (${src} -> ${tgt}) ditambahkan`);
});

// Event Delegation for Class Card buttons (+ Attr, + Method, Delete Attr/Method/Class)
classCardsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const cIdx = parseInt(btn.getAttribute('data-cidx'), 10);
    const model = JSON.parse(JSON.stringify(window.canonicalXtUmlJson));
    const cls = model.classes[cIdx];
    if (!cls) return;

    if (action === 'del-class') {
        const removedName = cls.name;
        model.classes.splice(cIdx, 1);
        model.relationships = (model.relationships || []).filter(
            r => r.source !== removedName && r.target !== removedName
        );
        syncCanonicalState(model, 'visual');
        setStatus('success', `Class '${removedName}' dihapus`);
    } else if (action === 'add-attr') {
        const nameEl = document.getElementById(`attrName_${cIdx}`);
        const typeEl = document.getElementById(`attrType_${cIdx}`);
        const visEl = document.getElementById(`attrVis_${cIdx}`);
        const aname = (nameEl.value || '').trim().replace(/\s+/g, '_');
        if (!aname) {
            setStatus('error', 'Masukkan nama atribut terlebih dahulu');
            return;
        }
        cls.attributes = cls.attributes || [];
        cls.attributes.push({
            name: aname,
            type: typeEl.value,
            visibility: visEl.value,
            default_value: typeEl.value === 'float' ? '0.0f' : (typeEl.value === 'bool' ? 'false' : '0')
        });
        syncCanonicalState(model, 'visual');
        setStatus('success', `Atribut '${aname} (${typeEl.value})' ditambahkan ke ${cls.name}`);
    } else if (action === 'del-attr') {
        const aIdx = parseInt(btn.getAttribute('data-aidx'), 10);
        cls.attributes.splice(aIdx, 1);
        syncCanonicalState(model, 'visual');
    } else if (action === 'add-op') {
        const nameEl = document.getElementById(`opName_${cIdx}`);
        const retEl = document.getElementById(`opRet_${cIdx}`);
        const bodyEl = document.getElementById(`opBody_${cIdx}`);
        const oname = (nameEl.value || '').trim().replace(/\s+/g, '_').replace(/\(\)$/, '');
        if (!oname) {
            setStatus('error', 'Masukkan nama metode terlebih dahulu');
            return;
        }
        cls.operations = cls.operations || [];
        cls.operations.push({
            name: oname,
            return_type: retEl.value,
            visibility: 'public',
            parameters: [],
            body: (bodyEl.value || '').trim()
        });
        syncCanonicalState(model, 'visual');
        setStatus('success', `Metode '${oname}()' ditambahkan ke ${cls.name}`);
    } else if (action === 'del-op') {
        const oIdx = parseInt(btn.getAttribute('data-oidx'), 10);
        cls.operations.splice(oIdx, 1);
        syncCanonicalState(model, 'visual');
    }
});

relationshipsBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="del-rel"]');
    if (!btn) return;
    const rIdx = parseInt(btn.getAttribute('data-ridx'), 10);
    const model = JSON.parse(JSON.stringify(window.canonicalXtUmlJson));
    model.relationships.splice(rIdx, 1);
    syncCanonicalState(model, 'visual');
});

// ============================================================================
// 5. TAB 2: `2. Parsing` (XML / XMI Analysis & Entity Tagging Inspector)
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

    // Human-readable identification logs (e.g. "Teridentifikasi Class: Sensor — memiliki atribut suhu (tipe: float) dan metode bacaData()")
    parsingIdentificationLogs.innerHTML = inspection.logs.map(item => `
        <div class="id-log-card" data-class="${escapeHtml(item.className)}">
            🔍 <strong>${item.html}</strong>
        </div>
    `).join('');

    // AST / IR Entity Tagging Table
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
// 6. TAB 3: `3. Translasi UML` (Non-Destructive Compilation & Live Sync)
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

// Live sync when editing/pasting in Tab 3 (`3. Translasi UML`) WITHOUT overwriting jsonEditor.value
let jsonDebounceTimer = null;
jsonEditor.addEventListener('input', () => {
    updateLineNumbers(jsonEditor, jsonLineNumbers);
    clearTimeout(jsonDebounceTimer);
    jsonDebounceTimer = setTimeout(() => {
        const raw = jsonEditor.value.trim();
        if (!raw) return;
        const result = compiler.compile(raw);
        if (result.success && result.model) {
            // 'translasi-input' preserves jsonEditor.value untouched while syncing Visual, Parsing & C OUTPUT
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

// Top Toolbar: Compile / Translate Button (Strictly Non-Destructive to jsonEditor.value)
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
                // 'compile-btn' is in PRESERVE_TRANSLASI_SOURCES so jsonEditor.value is NEVER overwritten
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
document.getElementById('loadSensorPresetBtn').addEventListener('click', () => {
    syncCanonicalState(sensorPresetModel, 'preset');
    setStatus('success', 'Loaded Preset: Sensor (float suhu, bacaData()) & Controller');
});

document.getElementById('loadDoorPresetBtn').addEventListener('click', () => {
    syncCanonicalState(doorPresetModel, 'preset');
    setStatus('success', 'Loaded Preset: DoorSystem FSM');
});

// Format JSON (formats in-place without replacing original xtUML schema with normalized IR)
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
// 7. TRASH / BIN RESET BUTTON ON LEFT PANEL (`resetLeftPanelInputs`)
// ============================================================================
function resetLeftPanelInputs() {
    // 1. Clear Tab 3 Translasi editor
    if (jsonEditor) {
        jsonEditor.value = '';
        updateLineNumbers(jsonEditor, jsonLineNumbers);
    }
    // 2. Clear Tab 2 Parsing XML editor
    if (xmlEditor) {
        xmlEditor.value = '';
        updateLineNumbers(xmlEditor, xmlLineNumbers);
    }
    // 3. Reset file inputs so same file can be re-selected
    if (fileInput) fileInput.value = '';
    if (xmlFileInput) xmlFileInput.value = '';

    // 4. Reset canonical model & re-render Visual + Parsing tabs cleanly
    window.canonicalXtUmlJson = { name: 'EmptyModel', classes: [], relationships: [] };
    renderVisualWorkspace(window.canonicalXtUmlJson);
    renderParsingInspector(window.canonicalXtUmlJson);

    if (syncBadge) {
        syncBadge.textContent = '● Reset (0 Class, 0 Rel)';
    }
    setStatus('ready', 'Cleared');
}

clearJsonBtn.addEventListener('click', () => {
    resetLeftPanelInputs();
});

// Copy output
copyOutputBtn.addEventListener('click', () => {
    outputEditor.select();
    document.execCommand('copy');
    setStatus('success', 'C code copied to clipboard');
});

// Clear right C OUTPUT panel
clearOutputBtn.addEventListener('click', () => {
    generatedFiles = {};
    currentFile = '';
    outputEditor.value = '';
    updateLineNumbers(outputEditor, outputLineNumbers);
    outputFileSelect.innerHTML = '<option value="">- no output -</option>';
    setStatus('ready', 'Output cleared');
});

// Open JSON / XML / xtUML file from Top Toolbar (Preserves exact file text in 3. Translasi UML)
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
    setStatus('success', `Loaded ${files.map(f => f.name).join(', ')}`);
});

// Download C code
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
// 8. `Ctrl + Mouse Wheel` FONT ZOOM FOR BOTH LEFT & RIGHT TEXT EDITORS
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

// Attach Ctrl + Wheel Zoom to Left Editors (Translasi JSON/xtUML & Parsing XML) and Right Editor (C OUTPUT)
attachEditorWheelZoom(jsonEditor, jsonLineNumbers, 'Left Editor (Translasi)');
attachEditorWheelZoom(xmlEditor, xmlLineNumbers, 'Left Editor (XML Parsing)');
attachEditorWheelZoom(outputEditor, outputLineNumbers, 'Right Editor (C OUTPUT)');

// Expose helpers for testing
window.resetLeftPanelInputs = resetLeftPanelInputs;
window.zoomEditorFontSize = zoomEditorFontSize;
window.applyEditorFontSize = applyEditorFontSize;

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

// Keyboard shortcuts
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

// Initialize workspace on load with Sensor model synced across 1. Visual, 2. Parsing, 3. Translasi, and C OUTPUT
syncCanonicalState(sensorPresetModel, 'init', true);
setStatus('ready', 'Ready — 1. Visual ↔ 2. Parsing ↔ 3. Translasi Synced');
