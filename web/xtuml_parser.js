// web/xtuml_parser.js — BP .xtuml text -> native {name,classes,relationships}
function parseXtumlText(raw){
  const strip = raw.replace(/\/\/[^\n]*/g,'');
  const reWithin = /within\s+([^;]+?)\s+is/gi;
  const reClass = /class\s+'?([^'\s]+)'?\s+is([\s\S]*?)end\s+class\s*;/gi;
  const reAttr = /^\s*'?(\w+)'?\s*:\s*(\w+)\s*;/gim;
  const reEventNum = /@event_num\((\d+)\)\s*\r?\n\s*(?:class\s+)?event\s+'?([^';\n\r]+)'?/gi;
  const reEventSimple = /^\s*event\s+'?([^';\n\r]+)'?/gim;
  const reState = /@state_num\((\d+)\)[^;]*\r?\n\s*@dialect\([^)]*\)\s*\r?\n\s*state\s+'?([^';\n\r]+)'?/gi;
  const reTrans = /transition\s+'?([^'\s\[]+)'?\s*\[([^\]]+)\]\s*=>\s*'?([^'\s\r]+)'?\s*is/gi;
  const rePkg = /package\s+'?([\w-]+)'?/gi;
  let withins=[], m;
  while((m=reWithin.exec(strip))!==null) withins.push(m[1].replace(/'/g,'').trim());
  const lastWithin = withins[withins.length-1]||'';
  const segs = lastWithin.split('::').map(s=>s.replace(/'/g,'').trim()).filter(Boolean);
  const owner = segs[segs.length-1]||null;
  const classes={};
  let cm;
  while((cm=reClass.exec(strip))!==null){
    const cname=cm[1].replace(/'/g,'').trim(), body=cm[2];
    const attrs=[];
    let am; const aRe=new RegExp(reAttr.source,reAttr.flags);
    while((am=aRe.exec(body))!==null) attrs.push({name:am[1],type:am[2],is_id:false});
    if(!classes[cname]) classes[cname]={name:cname,attributes:attrs,events:[],states:[],transitions:[]};
    else if(!classes[cname].attributes.length) classes[cname].attributes=attrs;
  }
  if(!Object.keys(classes).length && owner) classes[owner]={name:owner,attributes:[],events:[],states:[],transitions:[]};
  const cls = owner ? classes[owner] : Object.values(classes)[0];
  if(cls){
    let em;
    while((em=reEventNum.exec(strip))!==null){
      const id=parseInt(em[1],10), name=em[2].replace(/'/g,'').trim();
      if(!cls.events.some(e=>e.name===name)) cls.events.push({name,id});
    }
    let sm2; const sRe=new RegExp(reEventSimple.source,reEventSimple.flags);
    while((sm2=sRe.exec(strip))!==null){
      const name=sm2[1].replace(/'/g,'').trim();
      if(!cls.events.some(e=>e.name===name)) cls.events.push({name,id:Math.max(0,...cls.events.map(e=>e.id))+1});
    }
    let sm;
    while((sm=reState.exec(strip))!==null){
      const num=parseInt(sm[1],10), name=sm[2].replace(/'/g,'').trim();
      if(!cls.states.some(s=>s.name===name)) cls.states.push({name,id:num-1,is_initial:num===1});
    }
    let tm;
    while((tm=reTrans.exec(strip))!==null){
      const src=tm[1].replace(/'/g,'').trim(), evt=tm[2].replace(/'/g,'').trim(), dst=tm[3].replace(/'/g,'').trim();
      cls.transitions.push({from:src,to:dst,event:evt});
      if(!cls.events.some(e=>e.name===evt)) cls.events.push({name:evt,id:Math.max(0,...cls.events.map(e=>e.id))+1});
      for(const sn of [src,dst]) if(!cls.states.some(s=>s.name===sn)) cls.states.push({name:sn,id:Math.max(-1,...cls.states.map(s=>s.id))+1,is_initial:false});
    }
    if(cls.states.length && !cls.states.some(s=>s.is_initial)) cls.states[0].is_initial=true;
  }
  let top='UnnamedModel'; let pm; rePkg.lastIndex=0;
  while((pm=rePkg.exec(strip))!==null){ top=pm[1].replace(/'/g,'').trim(); break; }
  if(top==='UnnamedModel' && segs.length) top=segs[0];
  const outClasses=Object.values(classes).map(c=>{
    const e={name:c.name,attributes:c.attributes};
    if(c.events.length||c.states.length){
      const sm={events:c.events,states:c.states,transitions:c.transitions};
      if(c.states.length){ e.is_active=true; e.state_machine=sm; } else e.state_machine=sm;
    }
    return e;
  });
  return {name:top, classes:outClasses, relationships:[]};
}
function isXtumlText(s){ return typeof s==='string' && s.includes('persistence-version') && s.includes('within') && s.includes('BP '); }
