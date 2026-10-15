// UML-to-C Compiler (JS port) — supports native + xtUML VM envelope
const _TYPE_MAP = { string:'string', integer:'int', int:'int', real:'float', float:'float', double:'double', boolean:'bool', bool:'bool', datetime:'string' };
function _mapType(raw){ const m=String(raw).match(/inst_ref<\s*(\w+)\s*>/); return m?`${m[1]}_t*`:(_TYPE_MAP[String(raw).toLowerCase()]||raw); }
function _parseOps(rawOps){
  const out=[];
  for(const s0 of (rawOps||[])){
    const s=s0.trim();
    const m=s.match(/(\w+)\s*\((.*?)\)\s*(?::\s*(\w+))?$/);
    if(!m){ out.push({name:s, return_type:'void'}); continue; }
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
      const aname=a.attribute_name||'unnamed';
      const raw=a.data_type||'string';
      const ctype=_mapType(raw);
      attrs.push({name:aname,type:ctype,default:a.default_value,is_id:a.attribute_type==='naming_attribute'});
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
    const cls={name:cname,attributes:attrs,operations:ops};
    if(sm&&sm.states.length){ cls.is_active=true; cls.state_machine=sm; }
    if(entry.is_external) cls.is_external=true;
    classes.push(cls);
  }
  const rels=[];
  for(const r of (data.relationships||[])){
    const src=idToName[String(r.from_class)]||String(r.from_class||'');
    const tgt=idToName[String(r.to_class)]||String(r.to_class||'');
    if(!src||!tgt) continue;
    let rtype=r.type||'association'; if(rtype==='binary') rtype='association';
    rels.push({name:r.rel_id||'',type:rtype,source:src,target:tgt,source_role:r.from_class_role,target_role:r.to_class_role});
  }
  return {name:data.sub_name||data.sub_id||data.name||'UnnamedModel',classes,relationships:rels};
}
class UMLToC {
    constructor() { this.model=null; this.generatedFiles={}; }
    compile(rawText){
        try{
            let data;
            const t = String(rawText||'').trim();
            const looksXtuml = t.startsWith('// BP') || t.includes('persistence-version') || /^\s*within\s+/im.test(t);
            const hasXtParser = typeof parseXtumlText==='function';
            const hasCheck = typeof isXtumlText==='function';
            const isXt = hasCheck ? isXtumlText(t) : looksXtuml;
            if((isXt||looksXtuml) && hasXtParser){
                data=parseXtumlText(t);
            } else if((isXt||looksXtuml) && !hasXtParser){
                throw new Error('xtuml_parser.js not loaded — hard refresh (Ctrl+F5)');
            } else { data=JSON.parse(t); data=_normalizeXtuml(data); }
            this.model=this.buildModel(data);
            this.validate();
            this.generateCode();
            return{success:true,files:this.generatedFiles};
        }catch(error){ return{success:false,error:error.message}; }
    }
    buildModel(data){ return{ name:data.name||'UnnamedModel', classes:data.classes||[], relationships:data.relationships||[] }; }
    validate(){
        if(!this.model.classes||this.model.classes.length===0) throw new Error('Model must contain at least one class');
        this.model.classes.forEach((cls,i)=>{ if(!cls.name) throw new Error(`Class at index ${i} missing name`); });
    }
    generateCode(){
        this.generatedFiles={};
        this.model.classes.forEach(cls=>{
            this.generatedFiles[`${cls.name}.h`]=this.generateHeader(cls);
            this.generatedFiles[`${cls.name}.c`]=this.generateSource(cls);
        });
        this.generatedFiles['main.c']=this.generateMain();
    }
    generateHeader(cls){
        const guard=`${cls.name.toUpperCase()}_H`;
        let code=[];
        code.push(`#ifndef ${guard}`); code.push(`#define ${guard}`); code.push('');
        code.push('#include "runtime_c/uml_types.h"');
        if(cls.is_active&&cls.state_machine) code.push('#include "runtime_c/uml_event_queue.h"');
        code.push(''); code.push(`/* ${cls.name} Class Interface */`); code.push('');
        code.push(`typedef struct ${cls.name}_s ${cls.name}_t;`); code.push('');
        // Forward typedef for every other class referenced by attributes/params (inst_ref)
        const refs=new Set();
        const scan=t=>{ const m=String(t||'').match(/^(\w+)_t\*$/); if(m && m[1]!==cls.name) refs.add(m[1]); };
        (cls.attributes||[]).forEach(a=>scan(a.type));
        (cls.operations||[]).forEach(op=>(op.parameters||[]).forEach(p=>scan(p.type)));
        refs.forEach(r=>code.push(`typedef struct ${r}_s ${r}_t;`));
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
        if(cls.is_active&&cls.state_machine) code.push(`    ${cls.name}_State current_state;`);
        code.push('};'); code.push('');
        code.push(`${cls.name}_t* ${cls.name}_create(void);`);
        code.push(`void ${cls.name}_destroy(${cls.name}_t* self);`); code.push('');
        (cls.operations||[]).forEach(op=>{
            const params=this.formatParams(op.parameters);
            code.push(`${op.return_type||'void'} ${cls.name}_${op.name}(${cls.name}_t* self${params?', '+params:''});`);
        });
        if(cls.is_active&&cls.state_machine){ code.push(''); code.push(`void ${cls.name}_dispatch_event(${cls.name}_t* self, ${cls.name}_Event evt);`); }
        code.push(''); code.push(`#endif /* ${guard} */`);
        return code.join('\n');
    }
    generateSource(cls){
        let code=[];
        code.push(`#include "${cls.name}.h"`); code.push('#include "runtime_c/uml_port.h"'); code.push('#include <string.h>'); code.push('');
        code.push(`/* ${cls.name} Implementation */`); code.push('');
        code.push(`static ${cls.name}_t s_instance;`); code.push('static bool s_instance_allocated = false;'); code.push('');
        code.push(`${cls.name}_t* ${cls.name}_create(void) {`);
        code.push('    if (s_instance_allocated) {'); code.push('        return NULL;'); code.push('    }'); code.push('');
        code.push(`    ${cls.name}_t* self = &s_instance;`); code.push('    memset(self, 0, sizeof(*self));'); code.push('    s_instance_allocated = true;');
        (cls.attributes||[]).forEach(attr=>{
            if(attr.default===undefined||attr.default===null||attr.default==='') return;
            if(this.mapType(attr.type)==='uml_string_t') code.push(`    uml_string_set(&self->${attr.name}, "${String(attr.default).replace(/"/g,'\\"')}");`);
            else code.push(`    self->${attr.name} = ${attr.default};`);
        });
        if(cls.is_active&&cls.state_machine){
            const initial=cls.state_machine.states.find(s=>s.is_initial);
            if(initial) code.push(`    self->current_state = ${cls.name.toUpperCase()}_STATE_${initial.name.toUpperCase()};`);
        }
        code.push('    return self;'); code.push('}'); code.push('');
        code.push(`void ${cls.name}_destroy(${cls.name}_t* self) {`);
        code.push('    if (self == &s_instance) {'); code.push('        s_instance_allocated = false;'); code.push('    }'); code.push('}'); code.push('');
        (cls.operations||[]).forEach(op=>{
            const params=this.formatParams(op.parameters);
            code.push(`${op.return_type||'void'} ${cls.name}_${op.name}(${cls.name}_t* self${params?', '+params:''}) {`);
            if(op.body){
                const lines=op.body.split('\n');
                lines.forEach(line=>{ line=line.trim(); if(line){ line=line.replace(/self\.(\w+)/g,'self->$1'); code.push(`    ${line};`);} });
            } else code.push('    // TODO: Implement');
            if(op.return_type&&op.return_type!=='void') code.push(`    return (${op.return_type})0;`);
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
        code.push(''); code.push('int main(void) {'); code.push('    /* Initialize your application here */'); code.push('    '); code.push('    return 0;'); code.push('}');
        return code.join('\n');
    }
    mapType(umlType){
        if(!umlType) return 'int';
        if(umlType.endsWith('_t*')||umlType.endsWith('*')) return umlType;
        const m={int:'int32_t',integer:'int32_t',bool:'bool',boolean:'bool',string:'uml_string_t',float:'float',double:'double'};
        return m[umlType.toLowerCase()]||umlType;
    }
    formatParams(params){
        if(!params||params.length===0) return '';
        return params.map(p=>`${this.mapType(p.type)} ${p.name}`).join(', ');
    }
}
// Export for Node/CLI tests; xtuml_parser.js loads separately in browser
if(typeof module!=='undefined' && module.exports) module.exports={UMLToC};
if(typeof window!=='undefined') window.UMLToC=UMLToC;
