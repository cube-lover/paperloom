/* Independent structured-PDF layout model. Coordinates stay in PDF units.
   Host contract: Zotero PDFDocumentProxy.getPageData({pageIndex}). No DOM/vendor code. */
var PaperLoomLayout;
(function(root) {
  'use strict';
  const VERSION='structured-pdf-6';
  const validRect=r=>r && r.length===4 && Array.from(r).every(Number.isFinite) && r[2]>=r[0] && r[3]>=r[1];
  const union=rects=>[Math.min(...rects.map(r=>r[0])),Math.min(...rects.map(r=>r[1])),Math.max(...rects.map(r=>r[2])),Math.max(...rects.map(r=>r[3]))];
  const area=r=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
  const intersection=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  function mode(values,fallback=8) {
    const counts=new Map();for(const n of values)if(Number.isFinite(n)&&n>0){const k=Math.round(n*10)/10;counts.set(k,(counts.get(k)||0)+1);}
    return [...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0]?.[0]||fallback;
  }
  function median(values,fallback=0){if(!values.length)return fallback;const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];}
  const clean=t=>String(t||'').replace(/[ﬀﬁﬂﬃﬄ]/g,c=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl'})[c]).replace(/\u00ad/g,'');
  const normalize=t=>clean(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  function outlineTitles(outline,into=new Set()) {for(const n of outline||[]){if(n.title)into.add(normalize(n.title));outlineTitles(n.items,into);}return into;}
  function readLines(chars,regions=[]) {
    const lines=[];let group=[];
    const flush=()=>{
      if(!group.length)return;
      const usable=group.filter(x=>validRect(x.c.rect));
      if(!usable.length){group=[];return;}
      let text='';
      for(const {c} of group) {
        if(c.ignorable)continue;
        text+=clean(c.u||c.c);if(c.spaceAfter)text+=' ';
      }
      const end=group.at(-1).c, rect=union(usable.map(x=>Array.from(x.c.rect)));
      const size=mode(usable.map(x=>x.c.fontSize));
      lines.push({id:lines.length,owner,start:group[0].i,end:group.at(-1).i+1,text:text.trim(),rect,fontSize:size,
        baseline:median(usable.filter(x=>x.c.fontSize>=size*.9).map(x=>x.c.baseline).filter(Number.isFinite),rect[1]),
        bold:usable.filter(x=>x.c.bold||/bold/i.test(x.c.fontName||'')).length>usable.length*.5,
        italic:usable.filter(x=>x.c.italic||/italic|\.I$/i.test(x.c.fontName||'')).length>usable.length*.5,
        mathRatio:usable.filter(x=>/math|symbol|cmmi|cmsy|cmex/i.test(x.c.fontName||'')).length/usable.length,
        rotation:mode(usable.map(x=>(x.c.rotation||0)+360),360)-360,
        paragraphEnd:!!end.paragraphBreakAfter,joinNext:!!end.ignorable&&/[-‐‑]$/.test(end.c||'')});
      group=[];
    };
    let owner=-1;
    for(let i=0;i<chars.length;i++){
      const c=chars[i],next=validRect(c.rect)?regions.findIndex(r=>intersection(c.rect,r.rect)>area(c.rect)*.5):-1;
      if(group.length&&next!==owner)flush();owner=next;
      group.push({c,i});if(c.lineBreakAfter||c.paragraphBreakAfter)flush();
    }flush();
    // Workers sometimes serialize two poem/prose columns as a single line.
    // Establish a repeated *empty* gutter before paragraph grouping, not by text.
    const gaps=[];for(const l of lines){if(l.owner>=0||l.rotation)continue;const glyphs=chars.slice(l.start,l.end).filter(c=>validRect(c.rect)&&!c.ignorable&&/\S/.test(c.u||c.c||''));for(let i=1;i<glyphs.length;i++){const a=glyphs[i-1],b=glyphs[i];if(b.rect[0]-a.rect[2]>l.fontSize*2.5&&Math.abs((a.baseline||0)-(b.baseline||0))<l.fontSize*.4&&/[A-Za-z]{2}/.test(glyphs.slice(0,i).map(c=>c.u||c.c).join(''))&&/[A-Za-z]{2}/.test(glyphs.slice(i).map(c=>c.u||c.c).join('')))gaps.push({left:a.rect[2],right:b.rect[0],line:l});}}
    const candidate=gaps.map(g=>{const x=g.right-1,hits=gaps.filter(h=>h.left<x&&h.right>x);return {x,hits};}).sort((a,b)=>b.hits.length-a.hits.length)[0];
    if(candidate&&new Set(candidate.hits.map(h=>h.line)).size>=8){
      const x=candidate.x,top=Math.max(...candidate.hits.map(h=>h.line.rect[3])),lastHit=Math.min(...candidate.hits.map(h=>h.line.rect[1])),bottom=Math.max(0,...lines.filter(l=>l.rect[3]<lastHit&&(captionLabel(l.text)||l.rect[0]<x&&l.rect[2]>x)).map(l=>l.rect[3]+.1));
      const band=lines.filter(l=>l.owner<0&&l.rect[3]<=top+.1&&l.rect[1]>=bottom-.1&&!captionLabel(l.text));
      // Any real glyph through the gutter invalidates this band, including full-width prose.
      if(!band.some(l=>chars.slice(l.start,l.end).some(c=>validRect(c.rect)&&c.rect[0]<x&&c.rect[2]>x))){
        const split=[];for(const l of band){const gs=chars.slice(l.start,l.end).map((c,n)=>({c,i:l.start+n}));for(const side of [0,1]){const part=gs.filter(({c})=>validRect(c.rect)&&((c.rect[0]+c.rect[2])/2<x?0:1)===side);if(!part.length)continue;let text='';for(const {c} of part)if(!c.ignorable)text+=clean(c.u||c.c)+(c.spaceAfter?' ':'');const end=part.at(-1).c;split.push({...l,text:text.trim(),rect:union(part.map(({c})=>Array.from(c.rect))),start:part[0].i,end:part.at(-1).i+1,column:side,columnGutter:x,paragraphEnd:!!end.paragraphBreakAfter,joinNext:!!end.ignorable&&/[-‐‑]$/.test(end.c||'')});}}
        const first=lines.indexOf(band[0]),set=new Set(band);const outside=lines.filter(l=>!set.has(l));split.sort((a,b)=>a.column-b.column||b.baseline-a.baseline);outside.splice(first,0,...split);lines.splice(0,lines.length,...outside);
      }
    }
    // Sub/superscript runs may carry a spurious paragraph break in the worker.
    // Rejoin overlapping horizontal fragments on the SAME physical baseline only;
    // never join separate columns, adjacent table cells, or stacked fractions.
    const joined=[];
    for(const line of lines){const prev=joined.at(-1);
      if(prev&&prev.owner===line.owner&&Math.abs(prev.baseline-line.baseline)<Math.min(prev.fontSize,line.fontSize)*.12
        &&Math.abs(prev.fontSize-line.fontSize)<.3&&prev.rotation===line.rotation
        &&line.rect[0]>prev.rect[0]&&line.rect[0]<prev.rect[2]&&line.rect[2]>prev.rect[2]
        &&line.rect[0]>prev.rect[2]-prev.fontSize*1.5){
        prev.text+=(prev.joinNext?'':' ')+line.text;prev.rect=union([prev.rect,line.rect]);prev.end=line.end;
        prev.paragraphEnd=line.paragraphEnd;prev.joinNext=line.joinNext;prev.repairedFragments=true;
      }else joined.push(line);
    }
    return joined;
  }
  const matmul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  function mapRect(m,r){const p=[point(m,r[0],r[1]),point(m,r[0],r[3]),point(m,r[2],r[1]),point(m,r[2],r[3])];return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];}
  function graphics(ops,viewBox,OPS={}) {
    // Numeric fallbacks are the inspected Zotero 9 PDF.js OPS protocol, not path opcodes.
    const codes={save:10,restore:11,transform:12,constructPath:91,paintImageXObject:85,paintInlineImageXObject:86,paintImageMaskXObject:83,...OPS};
    const regions=[],rules=[],paths=[],stack=[];let m=[1,0,0,1,0,0];
    if(!ops)return {regions,rules,diagnostics:['graphics-unavailable']};
    let unsupported=0;
    const addPath=r=>{if(!validRect(r))return;const b=mapRect(m,r),w=b[2]-b[0],h=b[3]-b[1];
      if(w>30&&h<=2)rules.push(b);
      if(w>3&&h>3&&area(b)<area(viewBox)*.45)paths.push(b);
      // Cluster nontrivial vector paths only; rules, glyph-sized marks and page
      // backgrounds alone do not establish a figure region.
    };
    for(let i=0;i<ops.fnArray.length;i++) {
      const op=ops.fnArray[i],a=ops.argsArray[i]||[];
      if(op===codes.save)stack.push([...m]);
      else if(op===codes.restore)m=stack.pop()||[1,0,0,1,0,0];
      else if(op===codes.transform&&a.length===6)m=matmul(m,a);
      else if(op===codes.constructPath) {
        if(typeof a[0]==='number'&&validRect(a[2]))addPath(a[2]);
        else if(Array.isArray(a[0])||ArrayBuffer.isView(a[0])) {
          // Earlier PDF.js: [OPS[], coordinates[], minMax]. Use verified bounds if supplied.
          if(validRect(a[2]))addPath(a[2]);else unsupported++;
        } else unsupported++;
      } else if([codes.paintImageXObject,codes.paintInlineImageXObject,codes.paintImageMaskXObject].includes(op)) {
        const rect=mapRect(m,[0,0,1,1]);
        if(area(rect)>64&&area(rect)<area(viewBox)*.9)regions.push({role:'image',rect,evidence:'image-transform'});
      }
    }
    // Coalesce header rules drawn as separate cell segments. Then detect top/header/bottom
    // triples independently: two tables in one column must not cover the prose between them.
    const merged=[];
    for(const r of [...rules].sort((a,b)=>b[1]-a[1]||a[0]-b[0])) {
      const same=merged.find(x=>Math.abs(x[1]-r[1])<2&&r[0]<=x[2]+3&&r[2]>=x[0]-3);
      if(same){const u=union([same,r]);same.splice(0,4,...u);}else merged.push([...r]);
    }
    const groups=[];
    for(const r of merged){let g=groups.find(g=>Math.abs(g[0][0]-r[0])<3&&Math.abs(g[0][2]-r[2])<3);if(!g){g=[];groups.push(g);}g.push(r);}
    for(const g of groups){g.sort((a,b)=>b[3]-a[3]);for(let i=0;i+2<g.length;){
      const headerGap=g[i][3]-g[i+1][3],bodyGap=g[i+1][3]-g[i+2][3];
      if(headerGap>3&&headerGap<60&&bodyGap>5){const rect=union(g.slice(i,i+3));if(area(rect)<area(viewBox)*.8)regions.push({role:'table',rect,evidence:'aligned-horizontal-rules',ruleCount:3});i+=3;}else i++;
    }}
    // Some publishers leave the first (index) header cell unruled. Require matching
    // full-width outer rules plus an inset header separator, never a two-rule guess.
    const ordered=[...merged].sort((a,b)=>b[3]-a[3]);
    for(let i=0;i<ordered.length;i++){
      const top=ordered[i],width=top[2]-top[0];
      const bottom=ordered.slice(i+1).find(r=>Math.abs(r[0]-top[0])<3&&Math.abs(r[2]-top[2])<3&&top[3]-r[3]>12);
      if(!bottom)continue;
      const header=ordered.find(r=>top[3]-r[3]>3&&top[3]-r[3]<60&&r[1]-bottom[3]>5
        &&r[0]>=top[0]-2&&r[2]<=top[2]+2&&(r[2]-r[0])/width>.75);
      if(!header)continue;
      const rect=union([top,bottom,header]);
      if(area(rect)<area(viewBox)*.8&&!regions.some(p=>p.role==='table'&&intersection(rect,p.rect)>area(rect)*.5))
        regions.push({role:'table',rect,evidence:'outer-rules-inset-header',ruleCount:3});
    }
    const clusters=[];
    for(const rect of paths){const hits=clusters.filter(c=>intersection([c.rect[0]-2,c.rect[1]-2,c.rect[2]+2,c.rect[3]+2],rect)>.1);if(!hits.length)clusters.push({rect,count:1});else{const c=hits[0];c.rect=union([rect,...hits.map(x=>x.rect)]);c.count=1+hits.reduce((n,x)=>n+x.count,0);for(const other of hits.slice(1))clusters.splice(clusters.indexOf(other),1);}}
    for(const c of clusters)if(c.count>=6&&c.rect[2]-c.rect[0]>80&&c.rect[3]-c.rect[1]>50&&area(c.rect)<area(viewBox)*.6&&!regions.some(r=>intersection(r.rect,c.rect)>Math.min(area(r.rect),area(c.rect))*.2))regions.push({role:'image',rect:c.rect,evidence:'vector-path-cluster',pathCount:c.count});
    return {regions,rules,diagnostics:unsupported?['unsupported-paths:'+unsupported]:[]};
  }
  function physicalCells(chars){
    const rows=[];
    for(const c of chars||[]){
      if(c.ignorable||!validRect(c.rect)||!clean(c.u||c.c).trim()||(c.rotation||0)%360)continue;
      const size=c.fontSize||c.rect[3]-c.rect[1],base=Number.isFinite(c.baseline)?c.baseline:c.rect[1];
      let row=rows.find(r=>Math.abs(r.baseline-base)<Math.max(.6,size*.14));
      if(!row){row={baseline:base,chars:[]};rows.push(row);}row.chars.push(c);
    }
    return rows.sort((a,b)=>b.baseline-a.baseline).map(row=>{
      const cells=[];
      for(const c of row.chars.sort((a,b)=>a.rect[0]-b.rect[0])){
        const size=c.fontSize||8,prev=cells.at(-1),gap=prev?c.rect[0]-prev.rect[2]:Infinity;
        if(!prev||gap>Math.max(4,size*.8))cells.push({text:clean(c.u||c.c),rect:Array.from(c.rect),fontSize:size,last:c});
        else{if(prev.last.spaceAfter||gap>size*.22)prev.text+=' ';prev.text+=clean(c.u||c.c);prev.rect=union([prev.rect,Array.from(c.rect)]);prev.last=c;}
      }
      return {baseline:row.baseline,cells:cells.map(({last,...cell})=>cell),rect:union(cells.map(c=>c.rect)),fontSize:mode(cells.map(c=>c.fontSize))};
    });
  }
  const numericCell=t=>/^[+−-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:[Ee][+−-]?\d+)?%?$/.test(t.replace(/\s/g,''))||/^\d+(?::\d+){1,3}$/.test(t.trim())||/^[−–-]$/.test(t.trim());
  function tableStructure(chars,rules=[]){
    // Independent of worker paragraph flags and of the presence of a top rule.
    // Require repeated, densely numeric, geometrically aligned column rows.
    const physical=physicalCells(chars),dense=physical.filter(r=>r.cells.length>=4&&r.cells.filter(c=>numericCell(c.text)).length>=3&&r.cells.filter(c=>numericCell(c.text)).length/r.cells.length>=.5);
    const groups=[];
    for(const row of dense){
      const prev=groups.at(-1)?.at(-1),aligned=prev&&row.cells.filter(c=>prev.cells.some(p=>Math.abs((p.rect[0]+p.rect[2]-c.rect[0]-c.rect[2])/2)<Math.max(row.fontSize,prev.fontSize)*1.3)).length;
      if(prev&&prev.baseline-row.baseline<Math.max(row.fontSize,prev.fontSize)*2.4&&aligned>=Math.min(prev.cells.length,row.cells.length)*.7)groups.at(-1).push(row);else groups.push([row]);
    }
    const tables=[];
    for(const body of groups){
      if(body.length<2)continue;
      const count=mode(body.map(r=>r.cells.length),0),consistent=body.filter(r=>r.cells.length===count);if(consistent.length<body.length*.7)continue;
      const brect=union(body.map(r=>r.rect)),font=mode(body.map(r=>r.fontSize));
      const columns=Array.from({length:count},(_,i)=>({left:Math.min(...consistent.map(r=>r.cells[i].rect[0])),right:Math.max(...consistent.map(r=>r.cells[i].rect[2])),center:median(consistent.map(r=>(r.cells[i].rect[0]+r.cells[i].rect[2])/2))}));
      if(columns.some((c,i)=>i&&c.left<columns[i-1].right))continue;
      const spans=r=>r[0]<=brect[0]+font&&r[2]>=brect[2]-font;
      const separator=rules.filter(r=>spans(r)&&r[1]>=brect[3]&&r[1]-brect[3]<font*2).sort((a,b)=>a[1]-b[1])[0];
      const bottom=rules.filter(r=>spans(r)&&r[3]<=brect[1]&&brect[1]-r[3]<font*2).sort((a,b)=>b[3]-a[3])[0];
      const low=separator?separator[3]:brect[3]+font*.25;
      const possibleTop=rules.filter(r=>spans(r)&&r[1]>low+font&&r[1]<low+font*7).sort((a,b)=>a[1]-b[1])[0];
      if(body.length===2&&!(separator&&bottom&&possibleTop))continue;
      const high=possibleTop?possibleTop[1]:low+font*6;
      const edges=[Math.min(brect[0]-font*.3,separator?.[0]??brect[0]),...columns.slice(1).map((c,i)=>(columns[i].right+c.left)/2),Math.max(brect[2]+font*.3,separator?.[2]??brect[2])];
      const headers=Array.from({length:count},()=>[]);
      for(const row of physical){if(row.rect[1]<low||row.rect[3]>high||row.fontSize>font*1.15)continue;
        for(const c of row.cells){const center=(c.rect[0]+c.rect[2])/2,index=columns.map((col,i)=>({i,d:Math.abs(center-col.center)})).sort((a,b)=>a.d-b.d)[0]?.i;
          const span=index==null?0:edges[index+1]-edges[index];
          if(index!=null&&center>=edges[0]&&center<=edges.at(-1)&&Math.abs(center-columns[index].center)<span*.65&&c.rect[2]-c.rect[0]<span*1.65&&!numericCell(c.text))headers[index].push(c);
        }
      }
      // Headers must establish most column identities; without them the data body
      // remains protected but no header is guessed or sent to translation.
      const confirmed=headers.filter(h=>h.length).length>=Math.ceil(count*.7);
      if(body.length===2&&!confirmed)continue;
      // Wider multi-line headers own the same column as their data, not a
      // narrow number's ink width. Boundaries fall in real inter-column gutters.
      if(confirmed)for(let i=1;i<count;i++){
        const left=Math.max(columns[i-1].right,...headers[i-1].map(c=>c.rect[2])),right=Math.min(columns[i].left,...headers[i].map(c=>c.rect[0]));
        if(right>left)edges[i]=(left+right)/2;
      }
      const headerCells=confirmed?headers.map((runs,column)=>{
        if(!runs.length)return null;runs.sort((a,b)=>b.rect[3]-a.rect[3]);const ink=union(runs.map(c=>c.rect));
        return {column,text:runs.map(c=>c.text).join(' '),inkRect:ink,rect:[edges[column]+.8,low+1,edges[column+1]-.8,Math.min(high-1,Math.max(...headers.flat().map(c=>c.rect[3]))+font*.3)],fontSize:font};
      }).filter(Boolean):[];
      const rect=[separator?.[0]??brect[0],bottom?.[1]??brect[1],separator?.[2]??brect[2],headerCells.length?Math.max(...headerCells.map(c=>c.rect[3])):brect[3]];
      tables.push({role:'table',rect,evidence:separator&&bottom?'numeric-columns-two-rules':'repeated-numeric-columns',rowCount:body.length,columnCount:count,columns,headerCells,bodyCells:body.flatMap((r,row)=>r.cells.map((c,column)=>({...c,row,column}))),separator:separator||null});
    }
    return tables;
  }
  function textTables(chars,rules){
    // Text examples have a repeated label/value gutter rather than numeric columns.
    // Pair adjacent equal-width rules, reject caption/prose bands, then join only
    // touching bands. Do not trust the three-rule grouping across figure captions.
    const physical=physicalCells(chars),groups=[];
    for(const r of rules){let g=groups.find(g=>Math.abs(g[0][0]-r[0])<2&&Math.abs(g[0][2]-r[2])<2);if(!g){g=[];groups.push(g);}if(!g.some(x=>Math.abs(x[1]-r[1])<1))g.push(r);}
    const tables=[];
    for(const group of groups){
      group.sort((a,b)=>b[1]-a[1]);let run=[];
      const finish=()=>{if(run.reduce((n,b)=>n+b.keys.length,0)>=2||run.some(b=>b.keys.some(r=>/^(?:(?:Correct|Incorrect)\s+)?(?:Context|Answer)|^Target Completion/i.test(r.cells[0].text)))){const cells=run.flatMap(b=>b.cells),wordTask=cells.some(c=>/\b(?:unscramble|anagrams?)\b/i.test(c.text));if(wordTask)for(const c of cells)if(c.column===1){const prompt=/\b(?:unscramble|anagrams?)\b/i.test(c.text);if(prompt)c.preserveLiterals=c.text.match(/:\s*([^:]+?)\s*=\s*$/)?.slice(1)||[];else c.preserveSource=true;}tables.push({role:'text-table',evidence:'ruled-label-value-rows',rect:[run[0].top[0],run.at(-1).bottom[3],run[0].top[2],run[0].top[1]],cells});}run=[];};
      for(let i=0;i+1<group.length;i++){
        const top=group[i],bottom=group[i+1],rows=physical.filter(r=>r.rect[1]>bottom[3]&&r.rect[3]<top[1]&&r.rect[0]>=top[0]-1&&r.rect[2]<=top[2]+1);
        const keys=rows.filter(r=>r.cells.length>=2&&/[→⇒]\s*$/.test(r.cells[0].text));
        if(!keys.length||rows.some(r=>/^\s*(?:Figure|Fig\.|Table)\s+[A-Z0-9]/i.test(r.cells[0]?.text||''))){finish();continue;}
        const edge=Math.max(...keys.map(r=>r.cells[0].rect[2])),right=Math.min(...keys.map(r=>r.cells[1].rect[0]));
        if(right-edge<3||keys.some(r=>Math.abs(r.cells[0].rect[2]-edge)>2)||rows.some(r=>!keys.includes(r)&&r.rect[0]<right-Math.max(2,r.fontSize*.25))){finish();continue;}
        const cells=[];
        for(let k=0;k<keys.length;k++){
          const key=keys[k],from=rows.indexOf(key),to=k+1<keys.length?rows.indexOf(keys[k+1]):rows.length,lines=rows.slice(from,to);
          const lower=k+1<keys.length?(lines.at(-1).rect[1]+keys[k+1].rect[3])/2:bottom[3]+2;
          const upper=k?(rows[from-1].rect[1]+key.rect[3])/2:top[1]-2;
          const gutter=(edge+right)/2;
          const push=(parts,rect,column)=>{if(!parts.length)return;const ink=union(parts.map(c=>c.rect));cells.push({text:parts.map(c=>c.text).join(' '),inkRect:ink,rect,fontSize:key.fontSize,column});};
          push([key.cells[0]],[top[0]+1,lower,gutter-.8,upper],0);
          push(lines.flatMap((r,n)=>n?r.cells:r.cells.slice(1)),[gutter+.8,lower,top[2]-1,upper],1);
        }
        if(run.length&&Math.abs(run.at(-1).gutter-(edge+right)/2)>5)finish();
        run.push({top,bottom,keys,cells,gutter:(edge+right)/2});
      }finish();
    }return tables;
  }
  function ruledTextTables(chars,rules){
    const physical=physicalCells(chars),groups=[];for(const r of rules){let g=groups.find(g=>Math.abs(g[0][0]-r[0])<2&&Math.abs(g[0][2]-r[2])<2);if(!g){g=[];groups.push(g);}g.push(r);}
    const tables=[];
    for(const group of groups){group.sort((a,b)=>b[1]-a[1]);let bands=[];
      const finish=()=>{if(bands.length<3){bands=[];return;}const labels=bands.map(b=>b.rows[0].cells[0]),values=bands.map(b=>b.rows[0].cells.slice(1));const edge=Math.max(...labels.map(c=>c.rect[2])),right=Math.min(...values.flat().map(c=>c.rect[0]));
       if(right-edge<4||Math.max(...labels.map(c=>c.rect[0]))-Math.min(...labels.map(c=>c.rect[0]))>2){bands=[];return;}
       const first=bands[0],last=bands.at(-1),gutter=(edge+right)/2,cells=[];let top=first.top[1];
       const header=physical.find(r=>r.rect[1]>top&&r.rect[1]-top<r.fontSize&&r.cells.length===2&&Math.abs(r.cells[0].rect[0]-labels[0].rect[0])<2&&r.cells[1].rect[0]>=right-3);
       const join=parts=>{let out='';for(let i=0;i<parts.length;i++){const prev=parts[i-1],part=parts[i];const hyphen=prev&&chars.some(c=>c.ignorable&&/[-‐‑]/.test(c.c||'')&&Math.abs(c.rect[0]-prev.rect[2])<1&&Math.abs(c.rect[1]-prev.rect[1])<1);out+=(i&&!hyphen?' ':'')+part.text;}return out;};
       const add=(parts,rect,column,row)=>cells.push({text:join(parts),inkRect:union(parts.map(c=>c.rect)),rect,fontSize:parts[0].fontSize,column,row});
       if(header){top=header.rect[3]+2;add([header.cells[0]],[first.top[0]+1,first.top[1]+1,gutter-.8,top],0,-1);add([header.cells[1]],[gutter+.8,first.top[1]+1,first.top[2]-1,top],1,-1);}
       for(const [row,b] of bands.entries()){add([b.rows[0].cells[0]],[b.top[0]+1,b.bottom[3]+1,gutter-.8,b.top[1]-1],0,row);add(b.rows.flatMap((r,i)=>i?r.cells:r.cells.slice(1)),[gutter+.8,b.bottom[3]+1,b.top[2]-1,b.top[1]-1],1,row);}
       tables.push({role:'text-table',rect:[first.top[0],last.bottom[3],first.top[2],top],evidence:'ruled-repeated-two-column-text',rowCount:bands.length,columnCount:2,cells});bands=[];};
      for(let i=0;i+1<group.length;i++){const top=group[i],bottom=group[i+1],rows=physical.filter(r=>r.rect[1]>bottom[3]&&r.rect[3]<top[1]&&r.rect[0]>=top[0]&&r.rect[2]<=top[2]);const head=rows[0];
       if(!head||head.cells.length!==2||head.cells[0].text.length>40||/[→⇒]/.test(head.cells[0].text)||top[1]-bottom[3]>head.fontSize*5||rows.some(r=>captionLabel(r.cells[0]?.text||''))||rows.slice(1).some(r=>r.rect[0]<head.cells[1].rect[0]-3)){finish();continue;}
       bands.push({top,bottom,rows});
      }finish();
    }return tables;
  }
  function sparseRuledCells(chars,region,rules){
    // Three-rule descriptive inventory tables: rows may have only one or two
    // numeric entries. Use physical cells and row gaps, not dense-table quotas.
    const rows=physicalCells(chars).filter(r=>intersection(r.rect,region.rect)>area(r.rect)*.98);
    if(rows.length<3)return null;
    const nums=rows.flatMap(r=>r.cells).filter(c=>numericCell(c.text));
    if(nums.length<4||rows.filter(r=>r.cells.length>=2).length<3)return null;
    const columns=[];for(const c of nums){const x=(c.rect[0]+c.rect[2])/2;let col=columns.find(a=>Math.abs(a.x-x)<c.fontSize);if(col)col.n++;else columns.push({x,n:1});}
    if(!columns.some(c=>c.n>=3))return null;
    const cells=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],lower=i+1<rows.length?(row.rect[1]+rows[i+1].rect[3])/2:region.rect[1]+1,
        upper=i?(rows[i-1].rect[1]+row.rect[3])/2:region.rect[3]-1;
      for(let j=0;j<row.cells.length;j++){
        const c=row.cells[j];if(numericCell(c.text)||!/[A-Za-z]{3,}/.test(c.text)||/^\d+(?:\.\d+)?\s*[A-Za-z%]+$/.test(c.text))continue;
        const left=j?(row.cells[j-1].rect[2]+c.rect[0])/2:region.rect[0]-1,
          right=j+1<row.cells.length?(c.rect[2]+row.cells[j+1].rect[0])/2:region.rect[2]+1;
        const nearby=rules.filter(r=>r[0]<c.rect[2]&&r[2]>c.rect[0]);
        const bottom=Math.max(lower,c.rect[1]-1.2,...nearby.filter(r=>r[3]<=c.rect[1]).map(r=>r[3]+.5));
        const top=Math.min(upper,c.rect[3]+1.5,...nearby.filter(r=>r[1]>=c.rect[3]).map(r=>r[1]-.5));
        if(bottom>=c.rect[1]||top<=c.rect[3])continue;
        cells.push({text:c.text,inkRect:c.rect,rect:[Math.max(left,c.rect[0]-1),bottom,Math.min(right,c.rect[2]+c.fontSize*3),top],fontSize:c.fontSize,column:j,row:i});
      }
    }
    return cells.length?{...region,role:'table',evidence:'sparse-ruled-inventory',cells}:null;
  }
  function regionModel(data,operatorList,OPS){
    const drawing=graphics(operatorList,Array.from(data.viewBox),OPS),numeric=tableStructure(data.chars,drawing.rules),text=textTables(data.chars,drawing.rules);
    const ruled=ruledTextTables(data.chars,drawing.rules),tables=[...numeric,...text,...ruled],regions=drawing.regions.filter(r=>r.role!=='table'),lines=readLines(data.chars);
    // Rule triples are proposals, not authoritative table extents. Prefer the
    // complete aligned grid when its own columns are contained by the same rules.
    // Never merge two column tables merely because a wider guess intersects them.
    const rules=drawing.regions.filter(r=>r.role==='table');
    for(const t of tables){
      const conflict=rules.some(r=>intersection(r.rect,t.rect)>.1&&(t.rect[0]<r.rect[0]-3||t.rect[2]>r.rect[2]+3));
      if(conflict&&t.evidence==='repeated-numeric-columns')continue;
      regions.push(t);
    }
    for(const r of rules){
      if(regions.some(t=>['table','text-table'].includes(t.role)&&intersection(t.rect,r.rect)>Math.min(area(t.rect),area(r.rect))*.15))continue;
      // A line-count heuristic can bridge separate examples and their captions.
      // Evidence from actual text is required to retain a fallback rule box.
      if(lines.some(l=>captionLabel(l.text)&&intersection(l.rect,r.rect)>area(l.rect)*.25))continue;
      // Fraction bars from separate equations are not a tall table. Reject a
      // rule proposal cutting through several complete prose lines on both sides.
      if(lines.filter(l=>l.rect[0]<r.rect[0]-l.fontSize&&l.rect[2]>r.rect[2]+l.fontSize&&l.rect[1]>r.rect[1]&&l.rect[3]<r.rect[3]&&(l.text.match(/[A-Za-z]{3,}/g)||[]).length>=4).length>=3)continue;
      regions.push(sparseRuledCells(data.chars,r,drawing.rules)||r);
    }
    return {...drawing,regions,tables:regions.filter(r=>['table','text-table'].includes(r.role))};
  }
  function frameConflicts(rect,regions){return (regions||[]).filter(r=>intersection(rect,r.rect)>.1);}
  // Classification and translation policy are separate: captions are prose outside
  // graphic regions; a printed table of contents is navigation, not a body heading.
  const captionLabel=t=>t.match(/^\s*(?:Table|Figure|Fig\.)\s*(?:(?:[A-Z]\.?\s*)?\d+(?:\.\d+)*(?:[a-z])?|[IVXLCDM]+)(?=\s|[.:：]|$)([.:：])?\s*(.*)$/i);
  function markContents(lines) {
    const heading=t=>/^(?:table\s+of\s+contents|contents|list\s+of\s+(?:figures|tables)|目\s*录|图\s*目\s*录|表\s*目\s*录)(?:\s*\(?continued\)?)?$/i.test(t.trim());
    const heads=lines.map((l,i)=>heading(l.text)?i:-1).filter(i=>i>=0);
    const rows=[];
    for(let i=0;i<lines.length;i++){
      const l=lines[i],m=l.text.match(/^(.*\S)(?:\s+|[.·…．]{2,})(\d{1,4}|[ivxlcdm]{1,8})\s*$/i);if(!m)continue;
      const title=m[1].replace(/[.·…．\s]+$/g,'');
      if(!/[A-Za-z\u3400-\u9fff]{2}/.test(title)||/[.!?。！？]$/.test(title))continue;
      const leader=/(?:[.·．]\s*){3,}|…{2,}/.test(l.text);
      const entry=/^(?:(?:\d+(?:\.\d+)*|[A-Z])\.?\s+\S|第.{1,8}[章节]|摘要|参考文献|附录|References\b|Abstract\b)/.test(title);
      if(leader||entry||heads.length)rows.push({i,l,leader,entry});
    }
    // Repeated right edges are the page-number column. A single figure reference
    // or a section heading ending in a number is not a contents page.
    const aligned=rows.filter(a=>rows.filter(b=>Math.abs(a.l.rect[2]-b.l.rect[2])<Math.max(3,a.l.fontSize)).length>=3);
    const headed=heads.some(i=>aligned.filter(a=>a.i>i).length>=3);
    const leaders=aligned.filter(a=>a.leader).length;
    const meaningful=lines.filter(l=>/[A-Za-z\u3400-\u9fff]{2}/.test(l.text)).length;
    if(!headed&&!(leaders>=3&&aligned.length/Math.max(1,meaningful)>=.55))return;
    const first=aligned[0]?.i,last=aligned.at(-1)?.i;if(first==null)return;
    const included=new Set(aligned.map(a=>a.i));for(const i of heads)if(i<last)included.add(i);
    // Wrapped entry titles have no trailing page number. Include only short,
    // non-sentence runs bounded on both sides by proven entries, not whole pages.
    for(let i=first;i<last;i++)if(!included.has(i)){
      const l=lines[i];if(l.text.length<140&&!/[.!?。！？]$/.test(l.text)&&!captionLabel(l.text)
        &&included.has(i-1)&&aligned.some(a=>a.i===i+1))included.add(i);
    }
    for(const i of included){lines[i].role='contents';lines[i].reason=headed?'contents-heading-page-column':'contents-leaders-page-column';}
  }
  function classify(line,{viewBox,bodyFont,titles,regions},previous) {
    const t=line.text,r=line.rect,words=(t.match(/\b[a-zA-Z]{2,}\b|[\u3400-\u9fff]/g)||[]).length;
    const covered=regions.find(p=>intersection(r,p.rect)>area(r)*.25);
    if(covered)return [covered.role,covered.evidence];
    if(line.rotation%360)return ['rotated-text','rotated-glyphs'];
    if(!t)return ['empty','empty'];
    if(/^\s*(?:©|https?:\/\/|\(?https?:\/\/creativecommons|\d{4}-\d{4}\/|E-mail addresses?:|\*+\s*Corresponding|journal homepage:|Contents lists available)/i.test(t))return ['metadata','publisher-contact'];
    if(titles.has(normalize(t)) || /^(?:abstract|references|bibliography|acknowledg(?:e)?ments|appendix(?:\s+\w+)?|参考文献|摘要|附录)$/i.test(t))return ['heading','outline-or-heading'];
    // Decimal measurements (65.67 Mt) and run-in subsection prose are not headings.
    // Apply sentence checks to the title part, not to the section-number punctuation.
    const numbered=t.match(/^(?:\d{1,2}(?:\.\d+)+\.?|\d{1,2}\.)\s+([A-Z][\s\S]*)$/);
    const continuous=previous&&!previous.paragraphEnd&&previous.role==='body'
      &&previous.baseline-line.baseline>0&&previous.baseline-line.baseline<line.fontSize*1.7
      &&Math.abs(previous.fontSize-line.fontSize)<line.fontSize*.1
      &&Math.min(previous.rect[2],r[2])>Math.max(previous.rect[0],r[0]);
    if(numbered&&line.fontSize>=bodyFont*.9&&line.paragraphEnd
      &&!/^(?:Mt|Gt|kg|Mg|MW|GW|CO2)\b/.test(numbered[1])&&!/[.!?]\s+[A-Z]|[.!?]$/.test(numbered[1])
      &&(!continuous||line.bold&&!previous.bold||line.italic&&!previous.italic))return ['heading','numbered-heading-context'];
    if(line.fontSize>bodyFont*1.4&&/[a-z]{3}/i.test(t))return ['title','large-font'];
    if(/^(?:article info|keywords:|Article history:)$/i.test(t))return ['metadata','front-matter'];
    // A caption-only page has no body font to compare against. Explicit labels still count.
    const caption=captionLabel(t);
    if(caption&&(!caption[2]||caption[1]||line.fontSize<bodyFont*.9)&&(!continuous||line.fontSize<bodyFont*.9)
      &&(!!caption[1]||!/^(?:shows?|illustrates?|presents?|summari[sz]es?|depicts?|describes?|provides?|lists?)\b/i.test(caption[2])))return ['caption','caption-label'];
    // Formula identifiers such as Etot/bulk inflate a simple word count. A display
    // equation with a short identifier LHS and several operators is not prose.
    const equation=/^[\s(]*[A-Za-zΑ-ω][\w\s[\]{}^µ−+-]{0,28}=/.test(t)
      &&(t.match(/[=+−∑∫∏]/g)||[]).length>=2&&!/\b(?:is|are|was|were|where|using|we|the|and|for|with|of)\b/i.test(t);
    const equationTail=/^[+−-]\s*[A-Za-zΑ-ω]/.test(t)&&/[+−=]/.test(t.slice(1))&&/\(\d+\)\s*$/.test(t)
      &&!/\b(?:is|are|where|using|we|the|and|for|with|of)\b/i.test(t);
    // Display operators and conditional branches are mathematical notation,
    // including Times-font fragments whose PDF mathRatio is zero.
    const mathOperator=/^(?:max|min)\s+.{0,90}\(\d+[a-z]?\)[,.;]?$/i.test(t)
      ||/^(?:s\.\s*t\.|else|otherwise)\s*$/i.test(t)
      ||t.length<100&&/\b(?:else|min|max|if)\b/i.test(t)&&(/[≤≥<>∑∫]/.test(t)||/[A-Za-z]\w*\s*\([^)]*\)/.test(t))&&!/\b(?:the|this|that|we|our|which|where|when|then|and|network)\b/i.test(t);
    if(mathOperator)return ['formula','display-operator-or-branch'];
    if(equation||equationTail||line.mathRatio>.22&&words<7 || /[∑∫∏√¼½]|1⁄4/.test(t)&&words<9 || /[=]/.test(t)&&words<3 || t.length<3 || !/[a-zA-Z\u3400-\u9fff]/.test(t))return ['formula','symbol-or-label'];
    if(line.fontSize<bodyFont*.84)return ['small-text','small-font'];
    return ['body','prose'];
  }
  function parsePage(data,{pageIndex=data.pageIndex||0,outline=[],operatorList,OPS}={}) {
    if(!validRect(data.viewBox)||!Array.isArray(data.chars))throw new Error('PDF 结构化字符数据无效');
    const viewBox=Array.from(data.viewBox),lines=[],bodyFont=mode(data.chars.map(c=>c.fontSize));
    const drawing=regionModel(data,operatorList,OPS),titles=outlineTitles(outline);
    lines.push(...readLines(data.chars,drawing.regions));
    const env={viewBox,bodyFont,titles,regions:drawing.regions};
    for(let i=0;i<lines.length;i++){
      const line=lines[i],prev=lines[i-1];[line.role,line.reason]=classify(line,env,prev);
      if(prev?.role==='caption'&&(!prev.paragraphEnd||!/\.[\])”"']?$/.test(prev.text)||/^[a-z]/.test(line.text)||/^(?:Table|Figure|Fig\.)\s*\d+[.:]?\s*$/i.test(prev.text))
        &&['body','small-text'].includes(line.role)&&Math.abs(line.fontSize-prev.fontSize)<.3
        &&Math.abs(line.rect[0]-prev.rect[0])<line.fontSize&&prev.baseline-line.baseline>0
        &&prev.baseline-line.baseline<line.fontSize*1.8){line.role='caption';line.reason='caption-label-continuation';}
    }
    markContents(lines);
    // A short citation/year line at a paragraph end belongs to the preceding prose,
    // while a displayed equation keeps its independent math classification.
    for(let i=1;i<lines.length;i++){
      const a=lines[i-1],b=lines[i];
      if(b.role==='formula'&&a.role==='body'&&!a.paragraphEnd&&/^[\d\s(),;.e–-]+$/.test(b.text)
        &&a.baseline-b.baseline>0&&a.baseline-b.baseline<a.fontSize*1.6&&Math.abs(a.rect[0]-b.rect[0])<a.fontSize*2&&Math.abs(a.fontSize-b.fontSize)<.3){b.role='body';b.reason='prose-citation-tail';}
    }
    for(let i=0;i<lines.length;i++){
      const b=lines[i];
      if(b.role==='body'&&b.text.length<20&&(/[A-Z].*[A-Z]/.test(b.text)||/^(?:exp|log|ln|sin|cos|tan|lim|max|min)\b/.test(b.text)||/^[A-Za-z]\s+d[txyz]$/.test(b.text))
        &&[lines[i-1],lines[i+1]].some(a=>a?.role==='formula'&&Math.abs(a.rect[1]-b.rect[1])<b.fontSize*3)) {b.role='formula';b.reason='equation-neighbour';}
    }
    // Geometry supplements (rather than replaces) the worker's paragraph flags.
    const boundary=(i,group)=>{
      const line=lines[i],prev=group.at(-1);if(!prev)return 'page-start';
      const overlap=Math.min(prev.rect[2],line.rect[2])-Math.max(prev.rect[0],line.rect[0]);
      const gap=prev.baseline-line.baseline,size=line.fontSize;
      if(line.role==='contents'||prev.role==='contents')return 'contents-entry';
      if(prev.role==='caption'&&line.role==='caption'){
        if(captionLabel(line.text))return 'caption-start';
        if(line.reason==='caption-label-continuation')return null;
      }
      if(['table','text-table','image'].includes(line.role)||['table','text-table','image'].includes(prev.role))return 'spatial-owner';
      const workerBreakIsSpurious=prev.role==='body'&&line.role==='body'
        &&Math.abs(prev.fontSize-size)<.3&&gap>size*.7&&gap<size*1.6
        &&Math.abs(line.rect[0]-Math.min(...group.map(l=>l.rect[0])))<size*.35
        &&overlap>Math.min(prev.rect[2]-prev.rect[0],line.rect[2]-line.rect[0])*.7
        &&!/[.!?。！？][\])”"']?$/.test(prev.text)&&/^[a-z\d(]/.test(line.text)
        &&(intersection(prev.rect,line.rect)>0||prev.repairedFragments);
      if(prev.paragraphEnd&&!workerBreakIsSpurious)return 'pdf-paragraph';
      if(prev.role!==line.role)return 'role-change';
      if(line.rect[3]>prev.rect[3]+prev.fontSize*.5||overlap<Math.min(prev.rect[2]-prev.rect[0],line.rect[2]-line.rect[0])*.25)return 'column-change';
      if(Math.abs(size-prev.fontSize)>prev.fontSize*.18)return 'font-change';
      if(gap>prev.fontSize*2)return 'large-line-gap';
      if(line.role!=='body'||prev.joinNext||gap<size*.7)return null;
      const neighbour=l=>l&&l.role==='body'&&Math.abs(l.fontSize-size)<size*.1
        &&Math.min(l.rect[2],line.rect[2])>Math.max(l.rect[0],line.rect[0]);
      const next=lines[i+1],capital=/^[\s“"'(\[]*[A-Z\u3400-\u9fff]/.test(line.text);
      if(capital&&neighbour(next)&&line.baseline-next.baseline>0&&line.baseline-next.baseline<size*1.7
        &&line.rect[0]-next.rect[0]>size*.7&&Math.abs(prev.rect[0]-next.rect[0])<size*.35)return 'first-line-indent';
      const right=Math.max(...group.map(l=>l.rect[2]),line.rect[2]);
      if(capital&&/[.!?。！？][\])”"']?$/.test(prev.text)&&right-prev.rect[2]>Math.max(size*2,(right-line.rect[0])*.14)
        &&Math.abs(prev.rect[0]-line.rect[0])<size*.35)return 'short-terminal-line';
      const spacing=[];
      for(let j=Math.max(1,i-3);j<Math.min(lines.length,i+4);j++){
        if(j===i||!neighbour(lines[j])||!neighbour(lines[j-1]))continue;
        const delta=lines[j-1].baseline-lines[j].baseline;if(delta>size*.7&&delta<size*2)spacing.push(delta);
      }
      if(spacing.length>=3&&gap>median(spacing)*1.45)return 'local-line-gap';
      return null;
    };
    const blocks=[];let group=[],boundaryReason='page-start';
    const flush=()=>{
      if(!group.length)return;
      const rect=union(group.map(l=>l.rect));let text='';
      for(let i=0;i<group.length;i++)text+=(i&&!group[i-1].joinNext?' ':'')+group[i].text;
      const size=mode(group.map(l=>l.fontSize)),delta=group.slice(1).map((l,i)=>group[i].baseline-l.baseline).filter(n=>n>size*.7&&n<size*2.5);
      const role=group[0].role,id='p'+pageIndex+'c'+group[0].start+'-'+group.at(-1).end;
      blocks.push({id,pageIndex,role,text,rect,sourceRange:[group[0].start,group.at(-1).end],lines:group,
        typography:{fontSize:size,bold:role==='title'||role==='heading'||group[0].bold,italic:group.every(l=>l.italic),
          indent:group.length>1?Math.max(0,group[0].rect[0]-Math.min(...group.slice(1).map(l=>l.rect[0]))):0,
          lineHeight:Math.min(1.65,Math.max(1.15,median(delta,size*1.28)/size))},
        evidence:[...new Set(group.map(l=>l.reason)),'boundary:'+boundaryReason],eligible:['body','title','heading','caption'].includes(role)});
      group=[];
    };
    for(let i=0;i<lines.length;i++) {
      const reason=boundary(i,group);if(reason){flush();boundaryReason=reason;}
      group.push(lines[i]);
    }flush();
    // Full-title outline match may span more than one line.
    for(const b of blocks)if(['body','title','heading'].includes(b.role)&&titles.has(normalize(b.text))){b.role=b.typography.fontSize>bodyFont*1.4?'title':'heading';b.typography.bold=true;b.eligible=true;b.evidence.push('outline-title');}
    // Publisher cover sheets and the article's first page may be separate pages.
    // Author/contact/date metadata stays native even when the article starts on p2.
    const title=blocks.find(b=>b.role==='title'&&titles.has(normalize(b.text)));
    const abstract=blocks.find(b=>/^abstract$/i.test(b.text));
    const cover=blocks.some(b=>/^To cite this article:/i.test(b.text))&&blocks.some(b=>/^You may also like/i.test(b.text));
    if(title)for(const b of blocks){
      if(b===title)continue;
      const front=abstract&&b.rect[3]<title.rect[1]&&b.rect[1]>abstract.rect[3];
      if(cover||front||b.rect[1]>title.rect[3]){b.role='metadata';b.eligible=false;b.evidence.push(cover?'publisher-cover-sheet':'article-front-matter');}
    }
    // A glyph bounding box is not a typesetting frame. Allocate leading from local
    // whitespace, using immutable ink and midpoint ownership to avoid order-dependent
    // overlaps. Short one-line continuations may use space ABOVE, not cover next prose.
    for(const b of blocks)b.inkRect=[...b.rect];
    for(const b of blocks){
      if(!b.eligible)continue;
      const size=b.typography.fontSize,r=b.inkRect;
      let upper=viewBox[3],lower=viewBox[1];
      for(const other of blocks){const q=other.inkRect;if(other===b||q[2]<=r[0]||q[0]>=r[2])continue;
        if(q[1]>=r[3])upper=Math.min(upper,(q[1]+r[3])/2-.15);
        if(q[3]<=r[1])lower=Math.max(lower,(q[3]+r[1])/2+.15);
      }
      for(const p of drawing.regions){const q=p.rect;if(q[2]<=r[0]||q[0]>=r[2])continue;
        if(q[1]>=r[3])upper=Math.min(upper,q[1]-.2);
        if(q[3]<=r[1])lower=Math.max(lower,q[3]+.2);
      }
      let top=Math.min(upper,r[3]+size*.12),bottom=Math.max(lower,r[1]-size*.3);
      const needed=size*(b.lines.length*b.typography.lineHeight+.44)+.5;
      // Reserve natural line-box leading for every paragraph, not only one-line
      // headings. Never inflate all fonts by 20% and then hide short translations.
      bottom=Math.max(lower,Math.min(bottom,top-needed));
      top=Math.min(upper,Math.max(top,bottom+needed));
      b.rect=[r[0],Math.min(r[1],bottom),r[2],Math.max(r[3],top)];
      b.frameLimits={top:upper,bottom:lower};
    }
    for(const b of blocks){
      if(!b.eligible)continue;
      const collisions=frameConflicts(b.rect,drawing.regions);
      if(collisions.length){b.eligible=false;b.role='layout-conflict';b.evidence.push('frame-protected-region-conflict');b.conflicts=collisions.map(r=>({role:r.role,rect:r.rect}));}
    }
    if(pageIndex===0){
      const title=blocks.find(b=>b.role==='title'&&titles.has(normalize(b.text)));
      const abstract=blocks.find(b=>/^abstract$/i.test(b.text));
      for(const b of blocks){
        if(title&&b!==title&&b.rect[1]>title.rect[3]){b.role='metadata';b.eligible=false;b.evidence.push('publisher-above-title');}
        if(title&&abstract&&b.role==='body'&&b.rect[3]<title.rect[1]&&b.rect[1]>abstract.rect[3]&&(b.text.match(/,/g)||[]).length>=4){b.role='metadata';b.eligible=false;b.evidence.push('author-list');}
      }
    }
    const textual=lines.filter(l=>/[A-Za-z\u3400-\u9fff]{2}/.test(l.text)),tocCount=textual.filter(l=>l.role==='contents').length;
    return {index:pageIndex,kind:tocCount>=3&&tocCount/textual.length>=.6?'contents':'content',viewBox,bodyFont,lines,blocks,protectedRegions:drawing.regions,diagnostics:drawing.diagnostics};
  }
  function finalize(pages,{skipReferences=true,skipHeadings=false}={}) {
    const sorted=[...pages].sort((a,b)=>a.index-b.index),repeats=new Map();
    for(const p of sorted)for(const b of p.blocks){const r=b.rect,v=p.viewBox,h=v[3]-v[1];
      if(b.typography.fontSize<=p.bodyFont*.92&&(r[1]>v[3]-h*.1||r[3]<v[1]+h*.08)){
        const sig=normalize(b.text.replace(/\d+/g,''));if(sig.length<10)continue;
        if(!repeats.has(sig))repeats.set(sig,new Set());repeats.get(sig).add(p.index);
      }
    }
    let references=false;const order=[];
    for(const p of sorted)for(const b of p.blocks){
      const sig=normalize(b.text.replace(/\d+/g,'')),r=b.rect,v=p.viewBox,h=v[3]-v[1];
      if((repeats.get(sig)?.size||0)>=2&&(r[1]>v[3]-h*.1||r[3]<v[1]+h*.08)) {b.role='running-header';b.eligible=false;b.evidence.push('repeated-margin-text');}
      if(b.role!=='contents'&&/^(?:references|bibliography|参考文献)\s*$/i.test(b.text))references=true;
      if(b.role!=='contents'&&/^(?:appendix\b|supplementary\b|附录)/i.test(b.text))references=false;
      b.section=references?'references':'body';
      b.skipReason=!b.eligible?b.role:skipReferences&&references?'references':skipHeadings&&['title','heading'].includes(b.role)?'heading':null;
      order.push(b);
    }
    // Link language continuations, but keep distinct visual rectangles; never span a column gap.
    const prose=order.filter(b=>b.eligible&&b.role==='body');
    for(let i=1;i<prose.length;i++){const a=prose[i-1],b=prose[i];
      const crosses=b.pageIndex!==a.pageIndex||b.rect[3]>a.rect[3]+a.typography.fontSize;
      if(crosses&&!a.skipReason&&!b.skipReason&&a.section===b.section&&!/[.!?。！？][\])”"']?$/.test(a.text)
        &&(/^[a-z(]/.test(b.text)||/\b(?:and|or|of|the|to|by|in|from|with)\s*$/i.test(a.text))&&b.typography.indent<a.typography.fontSize*.5){b.continuesFrom=a.id;a.continuesTo=b.id;}
    }
    return {version:VERSION,pages:sorted,readingOrder:order.map(b=>b.id),blocks:order};
  }
  function projection(rect,viewport) {
    if(!validRect(rect)||!viewport?.transform||viewport.transform.length!==6)throw new Error('缺少 PDF 页面投影');
    const [a,b,c,d]=viewport.transform,[x,y]=point(viewport.transform,rect[0],rect[3]);
    return {width:rect[2]-rect[0],height:rect[3]-rect[1],matrix:[a,b,-c,-d,x,y],bounds:mapRect(viewport.transform,rect)};
  }
  const api={VERSION,regionModel,frameConflicts,textTables,physicalCells,tableStructure,numericCell,readLines,parsePage,finalize,projection,graphics,mode,validRect,union,intersection,area,matmul,mapRect};
  PaperLoomLayout=root.PaperLoomLayout=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
