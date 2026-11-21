// UML-to-C Compiler (JS port) — supports native JSON, xtUML VM envelope, BridgePoint .xtuml, and UML XML/XMI 2.x
const _TYPE_MAP = { string:'string', integer:'int', int:'int', real:'float', float:'float', double:'double', boolean:'bool', bool:'bool', datetime:'string', void:'void' };
function _mapType(raw){ const m=String(raw||'int').match(/inst_ref<\s*(\w+)\s*>/); return m?`${m[1]}_t*`:(_TYPE_MAP[String(raw||'int').toLowerCase()]||raw); }
function _parseOps(rawOps){
  const out=[];
  for(const s0 of (rawOps||[])){
    if(typeof s0==='object' && s0!==null){
      out.push({
        name: s0.name||'op',
        return_type: s0.return_type||'void',
        parameters: Array.isArray(s0.parameters)?s0.parameters:(Array.isArray(s0.params)?s0.params:[]),
        visibility: s0.visibility||'public',
        body: s0.body||''
      });
      continue;
    }
    const s=String(s0).trim();
    const m=s.match(/(\w+)\s*\((.*?)\)\s*(?::\s*(\w+))?$/);
    if(!m){ out.push({name:s, return_type:'void', parameters:[]}); continue; }
    const [,name,paramsStr,ret]=m;
    const params=[];
    if(paramsStr.trim()){
      for(const p of paramsStr.split(',')){
        const t=p.trim(); if(!t) continue;
        if(t.includes(':')){ const [pn,pt]=t.split(':').map(x=>x.trim()); params.push({name:pn,type:_mapType(pt)}); }
        else params.push({name:t,type:'string'});
      }
    }
    out.push({name, return_type: ret||'void', parameters: params});
  }
  return out;
}

function _normalizeXtuml(data){
  const isXtuml = Array.isArray(data.model) && data.model.some(x=>x && x.type==='class');
  if(!isXtuml) return data;
  const idToName={};
  for(const e of data.model) if(e.type==='class'&&e.class_id) idToName[String(e.class_id)]=e.class_name;
  const eventsByClass={};
  for(const ev of (data.events||[])) (eventsByClass[String(ev.class_id)]||(eventsByClass[String(ev.class_id)]=[])).push(ev);
  const classes=[];
  for(const entry of data.model){
    if(entry.type!=='class') continue;
    const cid=String(entry.class_id||'');
    const cname=entry.class_name||`Class${cid}`;
    const attrs=[];
    for(const a of (entry.attributes||[])){
      const aname=a.attribute_name||a.name||'unnamed';
      const raw=a.data_type||a.type||'string';
      const ctype=_mapType(raw);
      attrs.push({
        name:aname,
        type:ctype,
        visibility:a.visibility||'private',
        default:a.default_value!==undefined?a.default_value:a.default,
        is_id:a.attribute_type==='naming_attribute'||Boolean(a.is_id)
      });
    }
    const ops=_parseOps(entry.operations||[]);
    let sm=null;
    const rawStates=entry.states||[];
    if(rawStates.length || eventsByClass[cid]){
      const evMap={}; let eid=1;
      for(const ev of (eventsByClass[cid]||[])){
        const ename=ev.event_name;
        const rawId=(ev.event_id||'').replace(/\D/g,'');
        const plist=[];
        for(const p of (ev.parameters||[])) if(p.includes(':')){ const[pn,pt]=p.split(':').map(x=>x.trim()); plist.push({name:pn,type:(_TYPE_MAP[pt.toLowerCase()]||pt)}); }
        evMap[ename]={name:ename,id: rawId?parseInt(rawId,10):eid, parameters: plist}; eid++;
      }
      for(const s of rawStates) for(const en of (s.state_event||[])) if(!evMap[en]){ evMap[en]={name:en,id:eid}; eid++; }
      const states=rawStates.map((s,idx)=>({name:s.state_name||`S${idx}`,id:parseInt(s.state_id,10)||idx,is_initial:idx===0,entry:s.action}));
      const transitions=[];
      for(const s of rawStates){ const src=s.state_name, dst=s.next_state; for(const en of (s.state_event||[])) if(src&&dst&&en) transitions.push({from:src,to:dst,event:en}); }
      sm={events:Object.values(evMap),states,transitions};
    }
    const cls={name:cname,key_letters:entry.KL||cname.slice(0,3).toUpperCase(),attributes:attrs,operations:ops};
    if(sm&&sm.states.length){ cls.is_active=true; cls.state_machine=sm; }
    if(entry.is_external) cls.is_external=true;
    classes.push(cls);
  }
  const rels=[];
  for(const r of (data.relationships||[])){
    const src=idToName[String(r.from_class)]||String(r.from_class||r.source||'');
    const tgt=idToName[String(r.to_class)]||String(r.to_class||r.target||'');
    if(!src||!tgt) continue;
    let rtype=r.type||'association'; if(rtype==='binary') rtype='association';
    rels.push({name:r.rel_id||r.name||'',type:rtype,source:src,target:tgt,source_role:r.from_class_role||r.source_role,target_role:r.to_class_role||r.target_role});
  }
  return {name:data.sub_name||data.sub_id||data.name||'UnnamedModel',classes,relationships:rels};
}

/**
 * Buat log identifikasi bahasa manusia & daftar entitas AST dari model
 */
function buildSemanticInspection(model) {
  const logs = [];
  const astEntities = [];

  (model.classes || []).forEach(cls => {
    const attrs = cls.attributes || [];
    const ops = cls.operations || [];

    astEntities.push({
      category: 'CLASS',
      entity: `Class("${cls.name}")`,
      details: `KL: ${cls.key_letters || cls.name.slice(0, 3).toUpperCase()}, active: ${Boolean(cls.is_active)}`
    });

    attrs.forEach(a => {
      const vis = a.visibility || 'private';
      astEntities.push({
        category: 'ATTRIBUTE',
        entity: `Field(name="${a.name}", type="${a.type}", visibility="${vis}")`,
        details: `Owner: ${cls.name} → C member: ${a.type === 'int' ? 'int32_t' : a.type} ${a.name};`
      });
    });

    ops.forEach(op => {
      const ret = op.return_type || 'void';
      const params = (op.parameters || []).map(p => `${p.name}:${p.type}`).join(', ');
      astEntities.push({
        category: 'METHOD',
        entity: `Method(name="${op.name}", return_type="${ret}", params=[${params}])`,
        details: `Owner: ${cls.name} → C fn: ${ret} ${cls.name}_${op.name}(${cls.name}* self${params ? ', ...' : ''});`
      });
    });

    const attrDesc = attrs.length > 0
      ? attrs.map(a => `atribut \`${a.name}\` (tipe: \`${a.type}\`)`).join(', ')
      : 'tanpa atribut';
    const opDesc = ops.length > 0
      ? ops.map(o => {
          const p = (o.parameters || []).map(x => `${x.type} ${x.name}`).join(', ');
          return `metode \`${o.name}(${p})\``;
        }).join(', ')
      : 'tanpa metode';

    logs.push({
      className: cls.name,
      text: `Teridentifikasi Class: ${cls.name} — memiliki ${attrDesc} dan ${opDesc}`,
      html: `Teridentifikasi Class: <code>${cls.name}</code> — memiliki ${
        attrs.length > 0
          ? attrs.map(a => `atribut <code>${a.name}</code> (tipe: <code>${a.type}</code>)`).join(', ')
          : 'tanpa atribut'
      } dan ${
        ops.length > 0
          ? ops.map(o => `metode <code>${o.name}()</code>`).join(', ')
          : 'tanpa metode'
      }`
    });
  });

  (model.relationships || []).forEach((r, idx) => {
    const rname = r.name || `R${idx + 1}`;
    astEntities.push({
      category: 'RELATIONSHIP',
      entity: `Relationship(name="${rname}", source="${r.source}", target="${r.target}")`,
      details: `Struct pointer: ${r.target}* ${r.target_role || r.target.toLowerCase()};`
    });
  });

  return { logs, astEntities };
}

/**
 * Parse XML / XMI Diagram (OMG UML XMI 2.x maupun Simple UML XML) ke Canonical xtUML JSON
 * Bekerja di Browser maupun Node.js (tanpa ketergantungan eksternal).
 */
function parseXmlOrXmiToModel(xmlText) {
  const raw = String(xmlText || '').trim();
  if (!raw || !raw.startsWith('<')) {
    throw new Error('Input XML/XMI kosong atau tidak diawali tag XML (<...>)');
  }

  // Validasi keseimbangan tag dasar
  const cleanNoDecl = raw.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!cleanNoDecl.includes('>')) {
    throw new Error('Sintaks XML/XMI tidak valid');
  }

  const getAttr = (attrStr, name) => {
    const prefix = name.includes(':') ? '(?:^|\\s)' : '(?:^|\\s)';
    const re = new RegExp(`${prefix}${name}\\s*=\\s*["']([^"']*)["']`, 'i');
    const m = String(attrStr || '').match(re);
    return m ? m[1].trim() : '';
  };

  let modelName = 'SensorSystemModel';
  const modelMatch = cleanNoDecl.match(/<(?:uml:)?Model\b([^>]*)>/i) || cleanNoDecl.match(/<model\b([^>]*)>/i);
  if (modelMatch) {
    modelName = getAttr(modelMatch[1], 'name') || modelName;
  }

  const classes = [];
  const relationships = [];
  const idToClass = {};

  // Match baik <packagedElement xmi:type="uml:Class" ...>...</packagedElement>, <uml:Class ...>...</uml:Class>, atau <class ...>...</class>
  const classBlockRe = /<(?:packagedElement|uml:Class|Class)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:packagedElement|uml:Class|Class)>)/gi;
  let cm;
  while ((cm = classBlockRe.exec(cleanNoDecl)) !== null) {
    const headerAttrs = cm[1] || '';
    const innerXml = cm[2] || '';
    const xmiType = getAttr(headerAttrs, 'xmi:type') || getAttr(headerAttrs, 'xsi:type') || getAttr(headerAttrs, 'type');

    // Jika packagedElement tapi bukan uml:Class (misal uml:Association), cek apakah relasi
    if (cm[0].toLowerCase().startsWith('<packagedelement') && xmiType && !xmiType.toLowerCase().endsWith('class')) {
      if (xmiType.toLowerCase().includes('association')) {
        const rname = getAttr(headerAttrs, 'name') || `R${relationships.length + 1}`;
        const src = getAttr(headerAttrs, 'source');
        const tgt = getAttr(headerAttrs, 'target');
        const role = getAttr(headerAttrs, 'targetRole') || getAttr(headerAttrs, 'role');
        if (src && tgt) {
          relationships.push({
            name: rname,
            type: 'association',
            source: src,
            target: tgt,
            source_multiplicity: '0..*',
            target_multiplicity: '1',
            target_role: role || tgt.toLowerCase()
          });
        }
      }
      continue;
    }

    const cname = getAttr(headerAttrs, 'name');
    if (!cname) continue;
    const cid = getAttr(headerAttrs, 'id') || cname;
    const kl = getAttr(headerAttrs, 'key_letters') || getAttr(headerAttrs, 'KL') || cname.slice(0, 3).toUpperCase();
    const isActive = getAttr(headerAttrs, 'isActive') === 'true' || getAttr(headerAttrs, 'is_active') === 'true';
    idToClass[cid] = cname;

    const attributes = [];
    const operations = [];

    // Ekstrak <ownedAttribute .../> atau <attribute .../>
    const attrRe = /<(?:ownedAttribute|uml:Property|attribute|field)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ownedAttribute|uml:Property|attribute|field)>)/gi;
    let am;
    while ((am = attrRe.exec(innerXml)) !== null) {
      const aHeader = am[1] || '';
      const aInner = am[2] || '';
      const aname = getAttr(aHeader, 'name');
      if (!aname) {
        throw new Error(`Class '${cname}' memiliki tag atribut tanpa properti 'name'`);
      }
      let atype = getAttr(aHeader, 'type') || getAttr(aHeader, 'data_type');
      if (!atype && aInner) {
        const hrefM = aInner.match(/href\s*=\s*["'][^"']*#\/\/(\w+)["']/i);
        if (hrefM) atype = hrefM[1].toLowerCase();
      }
      if (!atype) {
        throw new Error(`Class '${cname}': atribut '${aname}' tidak memiliki tipe data ('type')`);
      }
      const vis = getAttr(aHeader, 'visibility') || 'private';
      const dval = getAttr(aHeader, 'defaultValue') || getAttr(aHeader, 'default') || undefined;
      attributes.push({
        name: aname,
        type: _mapType(atype),
        visibility: vis,
        ...(dval !== undefined && dval !== '' ? { default_value: dval } : {})
      });
    }

    // Ekstrak <ownedOperation ...> atau <operation ...> atau <method ...>
    const opRe = /<(?:ownedOperation|uml:Operation|operation|method)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ownedOperation|uml:Operation|operation|method)>)/gi;
    let om;
    while ((om = opRe.exec(innerXml)) !== null) {
      const oHeader = om[1] || '';
      const oInner = om[2] || '';
      const oname = getAttr(oHeader, 'name');
      if (!oname) {
        throw new Error(`Class '${cname}' memiliki tag metode/operasi tanpa properti 'name'`);
      }
      let retType = getAttr(oHeader, 'returnType') || getAttr(oHeader, 'return_type') || getAttr(oHeader, 'type') || 'void';
      const vis = getAttr(oHeader, 'visibility') || 'public';
      let body = getAttr(oHeader, 'body') || '';
      const params = [];

      if (oInner) {
        const paramRe = /<(?:ownedParameter|parameter|param)\b([^>]*?)\/?>/gi;
        let pm;
        while ((pm = paramRe.exec(oInner)) !== null) {
          const pHeader = pm[1] || '';
          const dir = getAttr(pHeader, 'direction') || 'in';
          const ptype = getAttr(pHeader, 'type') || 'int';
          if (dir === 'return') {
            retType = ptype;
          } else {
            const pname = getAttr(pHeader, 'name') || `arg${params.length + 1}`;
            params.push({ name: pname, type: _mapType(ptype) });
          }
        }
        const bodyMatch = oInner.match(/<(?:body|oal)>([\s\S]*?)<\/(?:body|oal)>/i);
        if (bodyMatch) body = bodyMatch[1].trim();
      }

      operations.push({
        name: oname,
        return_type: _mapType(retType),
        visibility: vis,
        parameters: params,
        ...(body ? { body } : {})
      });
    }

    // Ekstrak opsional <stateMachine> di dalam class
    let stateMachine = undefined;
    const smMatch = innerXml.match(/<(?:stateMachine|state_machine)\b[^>]*>([\s\S]*?)<\/(?:stateMachine|state_machine)>/i);
    if (smMatch) {
      const smInner = smMatch[1];
      const states = [];
      const events = [];
      const transitions = [];
      const stRe = /<state\b([^>]*?)\/?>/gi;
      let stm;
      while ((stm = stRe.exec(smInner)) !== null) {
        const sH = stm[1];
        states.push({
          name: getAttr(sH, 'name') || `State${states.length}`,
          id: parseInt(getAttr(sH, 'id') || String(states.length), 10),
          is_initial: getAttr(sH, 'is_initial') === 'true' || states.length === 0,
          entry_action: getAttr(sH, 'entry_action') || getAttr(sH, 'entry') || ''
        });
      }
      const trRe = /<transition\b([^>]*?)\/?>/gi;
      let trm;
      while ((trm = trRe.exec(smInner)) !== null) {
        const tH = trm[1];
        const evName = getAttr(tH, 'event') || 'tick';
        if (!events.some(e => e.name === evName)) {
          events.push({ name: evName, id: events.length + 1 });
        }
        transitions.push({
          from: getAttr(tH, 'from'),
          to: getAttr(tH, 'to'),
          event: evName
        });
      }
      if (states.length > 0) {
        stateMachine = { events, states, transitions };
      }
    }

    const clsObj = {
      name: cname,
      key_letters: kl,
      is_active: Boolean(isActive || stateMachine),
      attributes,
      operations
    };
    if (stateMachine) clsObj.state_machine = stateMachine;
    classes.push(clsObj);
  }

  // Ekstrak tag <association> atau <relationship> standalone
  const relRe = /<(?:association|relationship|uml:Association)\b([^>]*?)\/?>/gi;
  let rm;
  while ((rm = relRe.exec(cleanNoDecl)) !== null) {
    const rH = rm[1] || '';
    const srcRaw = getAttr(rH, 'source') || getAttr(rH, 'from');
    const tgtRaw = getAttr(rH, 'target') || getAttr(rH, 'to');
    const src = idToClass[srcRaw] || srcRaw;
    const tgt = idToClass[tgtRaw] || tgtRaw;
    if (src && tgt) {
      const rname = getAttr(rH, 'name') || getAttr(rH, 'id') || `R${relationships.length + 1}`;
      if (!relationships.some(x => x.name === rname && x.source === src && x.target === tgt)) {
        relationships.push({
          name: rname,
          type: getAttr(rH, 'type') || 'association',
          source: src,
          target: tgt,
          source_multiplicity: getAttr(rH, 'sourceMultiplicity') || '0..*',
          target_multiplicity: getAttr(rH, 'targetMultiplicity') || '1',
          target_role: getAttr(rH, 'targetRole') || getAttr(rH, 'role') || tgt.toLowerCase()
        });
      }
    }
  }

  if (classes.length === 0) {
    throw new Error('Tidak ditemukan elemen Class (<packagedElement xmi:type="uml:Class"> atau <class name="...">) di dalam XML/XMI');
  }

  const model = {
    name: modelName,
    classes,
    relationships
  };
  const inspection = buildSemanticInspection(model);
  return {
    success: true,
    model,
    logs: inspection.logs,
    astEntities: inspection.astEntities
  };
}

/**
 * Konversi Canonical xtUML JSON ke dokumen XMI 2.x standar
 */
function modelToXmlXmi(model) {
  if (!model || !Array.isArray(model.classes)) return '';
  const esc = s => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xmi:XMI xmi:version="2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">',
    `  <uml:Model xmi:id="model_root" name="${esc(model.name || 'xtUMLModel')}">`
  ];

  (model.classes || []).forEach((cls, cIdx) => {
    const kl = cls.key_letters || cls.KL || cls.name.slice(0, 3).toUpperCase();
    lines.push(
      `    <packagedElement xmi:type="uml:Class" xmi:id="cls_${cIdx + 1}" name="${esc(cls.name)}" key_letters="${esc(kl)}" isActive="${Boolean(cls.is_active)}">`
    );
    (cls.attributes || []).forEach((attr, aIdx) => {
      const dval = attr.default_value !== undefined ? attr.default_value : attr.default;
      const dAttr = dval !== undefined && dval !== null && dval !== '' ? ` defaultValue="${esc(dval)}"` : '';
      lines.push(
        `      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_${cIdx + 1}_${aIdx + 1}" name="${esc(attr.name)}" type="${esc(attr.type || 'float')}" visibility="${esc(attr.visibility || 'private')}"${dAttr}/>`
      );
    });
    (cls.operations || []).forEach((op, oIdx) => {
      const params = op.parameters || [];
      const body = op.body || '';
      const ret = op.return_type || 'void';
      if (params.length === 0 && !body) {
        lines.push(
          `      <ownedOperation xmi:type="uml:Operation" xmi:id="op_${cIdx + 1}_${oIdx + 1}" name="${esc(op.name)}" returnType="${esc(ret)}" visibility="${esc(op.visibility || 'public')}"/>`
        );
      } else {
        lines.push(
          `      <ownedOperation xmi:type="uml:Operation" xmi:id="op_${cIdx + 1}_${oIdx + 1}" name="${esc(op.name)}" returnType="${esc(ret)}" visibility="${esc(op.visibility || 'public')}"${body ? ` body="${esc(body)}"` : ''}>`
        );
        params.forEach((p, pIdx) => {
          lines.push(
            `        <ownedParameter xmi:id="param_${cIdx + 1}_${oIdx + 1}_${pIdx + 1}" name="${esc(p.name)}" type="${esc(p.type || 'float')}" direction="in"/>`
          );
        });
        lines.push('      </ownedOperation>');
      }
    });
    lines.push('    </packagedElement>');
  });

  (model.relationships || []).forEach((rel, rIdx) => {
    const rname = rel.name || `R${rIdx + 1}`;
    const role = rel.target_role || (rel.target ? rel.target.toLowerCase() : '');
    lines.push(
      `    <packagedElement xmi:type="uml:Association" xmi:id="rel_${rIdx + 1}" name="${esc(rname)}" source="${esc(rel.source)}" target="${esc(rel.target)}" targetRole="${esc(role)}"/>`
    );
  });

  lines.push('  </uml:Model>');
  lines.push('</xmi:XMI>');
  return lines.join('\n');
}

class UMLToC {
    constructor() { this.model=null; this.generatedFiles={}; this.visualizations={}; this.inspection={logs:[],astEntities:[]}; }
    compile(rawText){
        try{
            let data;
            const t = String(rawText||'').trim();
            const looksXtuml = t.startsWith('// BP') || t.includes('persistence-version') || /^\s*within\s+/im.test(t);
            const looksXml = t.startsWith('<');
            const hasXtParser = typeof parseXtumlText==='function';
            const hasCheck = typeof isXtumlText==='function';
            const isXt = hasCheck ? isXtumlText(t) : looksXtuml;
            if (looksXml) {
                const parsedXml = parseXmlOrXmiToModel(t);
                data = parsedXml.model;
            } else if((isXt||looksXtuml) && hasXtParser){
                data=parseXtumlText(t);
            } else if((isXt||looksXtuml) && !hasXtParser){
                throw new Error('xtuml_parser.js not loaded — hard refresh (Ctrl+F5)');
            } else { data=JSON.parse(t); data=_normalizeXtuml(data); }
            this.model=this.buildModel(data);
            this.validate();
            this.generateCode();
            this.visualizations=this.generateVisualizations();
            this.inspection=buildSemanticInspection(this.model);
            return{
                success:true,
                files:this.generatedFiles,
                visualizations:this.visualizations,
                inspection:this.inspection,
                model:this.model
            };
        }catch(error){ return{success:false,error:error.message}; }
    }
    buildModel(data){ return{ name:data.name||'UnnamedModel', classes:data.classes||[], relationships:data.relationships||[] }; }
    validate(){
        if(!this.model.classes||this.model.classes.length===0) throw new Error('Model must contain at least one class');
        const seenCls=new Set();
        this.model.classes.forEach((cls,i)=>{
            if(!cls.name) throw new Error(`Class at index ${i} missing name`);
            if(seenCls.has(cls.name)) throw new Error(`Duplicate class name: ${cls.name}`);
            seenCls.add(cls.name);
        });
    }
    generateCode(){
        this.generatedFiles={};
        this.model.classes.forEach(cls=>{
            this.generatedFiles[`${cls.name}.h`]=this.generateHeader(cls);
            this.generatedFiles[`${cls.name}.c`]=this.generateSource(cls);
        });
        this.generatedFiles['main.c']=this.generateMain();
    }
    generateVisualizations(){
        const clsLines=['classDiagram'];
        const fsmLines=['stateDiagram-v2'];
        const actLines=['flowchart TD'];
        (this.model.classes||[]).forEach(cls=>{
            const kl=cls.key_letters||cls.KL||cls.name.slice(0,3).toUpperCase();
            clsLines.push(`    class ${cls.name} {`);
            clsLines.push(`        <<${cls.is_active?'Active Class':'Class'} | KL: ${kl}>>`);
            (cls.attributes||[]).forEach(a=>clsLines.push(`        -${this.mapType(a.type)} ${a.name}`));
            clsLines.push(`        +${cls.name}_init(${cls.name}_t* self) void`);
            (cls.operations||[]).forEach(op=>clsLines.push(`        +${op.name}() ${op.return_type||'void'}`));
            clsLines.push('    }');
            if(cls.is_active&&cls.state_machine){
                const sm=cls.state_machine;
                const init=(sm.states||[]).find(s=>s.is_initial)||(sm.states||[])[0];
                if(init) fsmLines.push(`    [*] --> ${cls.name}_${init.name} : ${cls.name}_init`);
                (sm.states||[]).forEach((s,idx)=>{
                    const sid=`${cls.name}_${s.name}`;
                    fsmLines.push(`    state "@state_num(${idx+1}) ${cls.name}::${s.name}" as ${sid}`);
                    const entry=s.entry||s.entry_action;
                    if(entry){
                        actLines.push(`    subgraph ${sid}_act["Action Diagram: ${cls.name}::State[${s.name}]"]`);
                        actLines.push(`        ${sid}_S(["START"]) --> ${sid}_B["${String(entry).replace(/"/g,"'").replace(/\n/g,'\\n')}"] --> ${sid}_E(["END"])`);
                        actLines.push('    end');
                    }
                });
                (sm.transitions||[]).forEach(tr=>fsmLines.push(`    ${cls.name}_${tr.from} --> ${cls.name}_${tr.to} : ${tr.event}`));
            }
            (cls.operations||[]).forEach(op=>{
                if(op.body){
                    const oid=`${cls.name}_op_${op.name}`;
                    actLines.push(`    subgraph ${oid}["Action Diagram: ${cls.name}::${op.name}()"]`);
                    actLines.push(`        ${oid}_S(["START"]) --> ${oid}_B["${String(op.body).replace(/"/g,"'").replace(/\n/g,'\\n')}"] --> ${oid}_E(["END"])`);
                    actLines.push('    end');
                }
            });
        });
        (this.model.relationships||[]).forEach((r,i)=>clsLines.push(`    ${r.source} --> ${r.target} : ${r.name||'R'+(i+1)}`));
        return { classDiagram: clsLines.join('\n'), stateDiagram: fsmLines.join('\n'), actionDiagram: actLines.join('\n') };
    }
    _getOutgoingRels(cls){
        const out=[];
        const attrNames=new Set((cls.attributes||[]).map(a=>a.name));
        (this.model.relationships||[]).forEach((r,idx)=>{
            if(r.source===cls.name && r.target){
                const rname=r.name||`R${idx+1}`;
                const field=r.target_role||`${rname}_${r.target.toLowerCase()}`;
                out.push({rel_name:rname,target_class:r.target,field,already:attrNames.has(field)});
            }
        });
        return out;
    }
    generateHeader(cls){
        const guard=`${cls.name.toUpperCase()}_H`;
        const outRels=this._getOutgoingRels(cls);
        let code=[];
        code.push(`#ifndef ${guard}`); code.push(`#define ${guard}`); code.push('');
        code.push('#include "runtime_c/uml_types.h"');
        if(cls.is_active&&cls.state_machine) code.push('#include "runtime_c/uml_event_queue.h"');
        code.push(''); code.push(`/* ${cls.name} Class Interface */`); code.push('');
        code.push(`typedef struct ${cls.name}_s ${cls.name}_t;`);
        code.push(`typedef ${cls.name}_t ${cls.name};`); code.push('');
        const refs=new Set();
        const scan=t=>{ const m=String(t||'').match(/^(\w+)_t\*$/); if(m && m[1]!==cls.name) refs.add(m[1]); };
        (cls.attributes||[]).forEach(a=>scan(a.type));
        (cls.operations||[]).forEach(op=>(op.parameters||[]).forEach(p=>scan(p.type)));
        outRels.forEach(r=>{ if(r.target_class!==cls.name) refs.add(r.target_class); });
        refs.forEach(r=>{
            code.push(`typedef struct ${r}_s ${r}_t;`);
            code.push(`typedef ${r}_t ${r};`);
        });
        if(refs.size) code.push('');
        if(cls.is_active&&cls.state_machine){
            const sm=cls.state_machine;
            code.push('typedef enum {');
            sm.states.forEach(s=>code.push(`    ${cls.name.toUpperCase()}_STATE_${s.name.toUpperCase()} = ${s.id},`));
            code.push(`} ${cls.name}_State;`); code.push('');
            code.push('typedef enum {');
            sm.events.forEach(e=>code.push(`    ${cls.name.toUpperCase()}_EVENT_${e.name.toUpperCase()} = ${e.id},`));
            code.push(`} ${cls.name}_Event;`); code.push('');
        }
        code.push(`struct ${cls.name}_s {`);
        code.push('    UML_InstanceHeader_t header;');
        (cls.attributes||[]).forEach(attr=>{ code.push(`    ${this.mapType(attr.type)} ${attr.name};`); });
        outRels.forEach(r=>{ if(!r.already) code.push(`    ${r.target_class}_t* ${r.field};`); });
        if(cls.is_active&&cls.state_machine) code.push(`    ${cls.name}_State current_state;`);
        code.push('};'); code.push('');
        code.push(`void ${cls.name}_init(${cls.name}_t* self);`);
        code.push(`${cls.name}_t* ${cls.name}_create(void);`);
        code.push(`void ${cls.name}_destroy(${cls.name}_t* self);`); code.push('');
        outRels.forEach(r=>{
            code.push(`void ${cls.name}_relate_${r.rel_name}(${cls.name}_t* self, ${r.target_class}_t* target);`);
            code.push(`void ${cls.name}_unrelate_${r.rel_name}(${cls.name}_t* self);`);
        });
        if(outRels.length) code.push('');
        (cls.operations||[]).forEach(op=>{
            const params=this.formatParams(op.parameters);
            const ret=op.return_type?this.mapType(op.return_type):'void';
            code.push(`${ret} ${cls.name}_${op.name}(${cls.name}_t* self${params?', '+params:''});`);
        });
        if(cls.is_active&&cls.state_machine){ code.push(''); code.push(`void ${cls.name}_dispatch_event(${cls.name}_t* self, ${cls.name}_Event evt);`); }
        code.push(''); code.push(`#endif /* ${guard} */`);
        return code.join('\n');
    }
    generateSource(cls){
        const outRels=this._getOutgoingRels(cls);
        let code=[];
        code.push(`#include "${cls.name}.h"`);
        outRels.forEach(r=>{ if(r.target_class!==cls.name) code.push(`#include "${r.target_class}.h"`); });
        code.push('#include "runtime_c/uml_port.h"'); code.push('#include <string.h>'); code.push('');
        code.push(`/* ${cls.name} Implementation */`); code.push('');
        code.push(`static ${cls.name}_t s_instance;`); code.push('static bool s_instance_allocated = false;'); code.push('');
        code.push(`void ${cls.name}_init(${cls.name}_t* self) {`);
        code.push('    if (self == NULL) return;');
        code.push('    memset(self, 0, sizeof(*self));');
        (cls.attributes||[]).forEach(attr=>{
            const dval=attr.default!==undefined?attr.default:attr.default_value;
            if(dval===undefined||dval===null||dval==='') return;
            if(this.mapType(attr.type)==='uml_string_t') code.push(`    uml_string_set(&self->${attr.name}, "${String(dval).replace(/"/g,'\\"')}");`);
            else code.push(`    self->${attr.name} = ${dval};`);
        });
        outRels.forEach(r=>{ if(!r.already) code.push(`    self->${r.field} = NULL;`); });
        if(cls.is_active&&cls.state_machine){
            const initial=cls.state_machine.states.find(s=>s.is_initial)||cls.state_machine.states[0];
            if(initial) code.push(`    self->current_state = ${cls.name.toUpperCase()}_STATE_${initial.name.toUpperCase()};`);
        }
        code.push('}'); code.push('');
        code.push(`${cls.name}_t* ${cls.name}_create(void) {`);
        code.push('    if (s_instance_allocated) {'); code.push('        return NULL;'); code.push('    }'); code.push('');
        code.push(`    ${cls.name}_t* self = &s_instance;`);
        code.push('    memset(self, 0, sizeof(*self));');
        code.push('    s_instance_allocated = true;');
        (cls.attributes||[]).forEach(attr=>{
            const dval=attr.default!==undefined?attr.default:attr.default_value;
            if(dval===undefined||dval===null||dval==='') return;
            if(this.mapType(attr.type)==='uml_string_t') code.push(`    uml_string_set(&self->${attr.name}, "${String(dval).replace(/"/g,'\\"')}");`);
            else code.push(`    self->${attr.name} = ${dval};`);
        });
        outRels.forEach(r=>{ if(!r.already) code.push(`    self->${r.field} = NULL;`); });
        if(cls.is_active&&cls.state_machine){
            const initial=cls.state_machine.states.find(s=>s.is_initial)||cls.state_machine.states[0];
            if(initial) code.push(`    self->current_state = ${cls.name.toUpperCase()}_STATE_${initial.name.toUpperCase()};`);
        }
        code.push('    return self;'); code.push('}'); code.push('');
        code.push(`void ${cls.name}_destroy(${cls.name}_t* self) {`);
        code.push('    if (self == &s_instance) {'); code.push('        s_instance_allocated = false;'); code.push('    }'); code.push('}'); code.push('');
        outRels.forEach(r=>{
            code.push(`void ${cls.name}_relate_${r.rel_name}(${cls.name}_t* self, ${r.target_class}_t* target) {`);
            code.push(`    if (self != NULL) self->${r.field} = target;`);
            code.push('}'); code.push('');
            code.push(`void ${cls.name}_unrelate_${r.rel_name}(${cls.name}_t* self) {`);
            code.push(`    if (self != NULL) self->${r.field} = NULL;`);
            code.push('}'); code.push('');
        });
        (cls.operations||[]).forEach(op=>{
            const params=this.formatParams(op.parameters);
            const ret=op.return_type?this.mapType(op.return_type):'void';
            code.push(`${ret} ${cls.name}_${op.name}(${cls.name}_t* self${params?', '+params:''}) {`);
            code.push('    (void)self;');
            let hasRet=false;
            if(op.body){
                const lines=op.body.split('\n');
                lines.forEach(line=>{
                    line=line.trim().replace(/;$/,'');
                    if(line){
                        if(/^return\b/.test(line)) hasRet=true;
                        line=line.replace(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g,'$1->$2');
                        code.push(`    ${line};`);
                    }
                });
            } else code.push('    /* Method body */');
            if(ret&&ret!=='void'&&!hasRet) code.push(`    return (${ret})0;`);
            code.push('}'); code.push('');
        });
        if(cls.is_active&&cls.state_machine){
            code.push(`void ${cls.name}_dispatch_event(${cls.name}_t* self, ${cls.name}_Event evt) {`);
            code.push(`    ${cls.name}_State old_state = self->current_state;`);
            code.push(`    ${cls.name}_State new_state = old_state;`); code.push('');
            code.push('    switch (old_state) {');
            const sm=cls.state_machine;
            sm.states.forEach(state=>{
                code.push(`        case ${cls.name.toUpperCase()}_STATE_${state.name.toUpperCase()}: {`);
                const transitions=sm.transitions.filter(t=>t.from===state.name);
                if(transitions.length>0){
                    code.push('            switch (evt) {');
                    transitions.forEach(trans=>{
                        code.push(`                case ${cls.name.toUpperCase()}_EVENT_${trans.event.toUpperCase()}: {`);
                        code.push(`                    new_state = ${cls.name.toUpperCase()}_STATE_${trans.to.toUpperCase()};`);
                        code.push('                    break;'); code.push('                }');
                    });
                    code.push('                default: break;'); code.push('            }');
                }
                code.push('            break;'); code.push('        }');
            });
            code.push('    }'); code.push(''); code.push('    self->current_state = new_state;'); code.push('}'); code.push('');
        }
        return code.join('\n');
    }
    generateMain(){
        let code=[];
        code.push(`/* Generated main for ${this.model.name} */`);
        this.model.classes.forEach(cls=>code.push(`#include "${cls.name}.h"`));
        code.push(''); code.push('int main(void) {');
        (this.model.classes||[]).forEach(cls=>{
            const v=cls.name.toLowerCase();
            code.push(`    ${cls.name} ${v};`);
            code.push(`    ${cls.name}_init(&${v});`);
        });
        code.push('    return 0;'); code.push('}');
        return code.join('\n');
    }
    mapType(umlType){
        if(!umlType) return 'int32_t';
        if(umlType.endsWith('_t*')||umlType.endsWith('*')) return umlType;
        const m={int:'int32_t',integer:'int32_t',bool:'bool',boolean:'bool',string:'uml_string_t',float:'float',real:'float',double:'double',void:'void'};
        return m[umlType.toLowerCase()]||umlType;
    }
    formatParams(params){
        if(!params||params.length===0) return '';
        return params.map(p=>`${this.mapType(p.type)} ${p.name}`).join(', ');
    }
}
if(typeof module!=='undefined' && module.exports) {
    module.exports={UMLToC, parseXmlOrXmiToModel, modelToXmlXmi, buildSemanticInspection};
}
if(typeof window!=='undefined') {
    window.UMLToC=UMLToC;
    window.parseXmlOrXmiToModel=parseXmlOrXmiToModel;
    window.modelToXmlXmi=modelToXmlXmi;
    window.buildSemanticInspection=buildSemanticInspection;
}
