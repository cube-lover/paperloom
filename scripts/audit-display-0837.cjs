const fs=require('fs');
const s=JSON.parse(fs.readFileSync(process.argv[2]||'.local/dev-channel/archives/100e87ba-0ac3-43e6-8570-b82165c79124/snapshot.json','utf8'));
const G=require('../addon/content/graphics');
const norm=v=>String(v||'').replace(/\s+/g,'').toLowerCase();
for(const g of s.graphics||[]){
 const pages=[...new Set(g.rows.map(r=>r.pageIndex))];
 let blocked=0,total=0,coll=0,reasons=new Map();
 for(const p of pages){const rows=g.rows.filter(r=>r.pageIndex===p),t=rows.filter(r=>r.target&&!r.legacyLayout);
  for(const r of t){total++;const reason=G.replacementReason(r,rows);if(!reason)continue;blocked++;reasons.set(reason,(reasons.get(reason)||0)+1);if(/相交/.test(reason))coll++;}}
 console.log('=== item',g.itemID,'pages',pages.length,'paintable',total,'blocked',blocked,'collision',coll);
 console.log('   reasons',JSON.stringify([...reasons]));
 const risk=[];
 for(const p of pages){const rows=g.rows.filter(r=>r.pageIndex===p),t=rows.filter(r=>r.target&&!r.legacyLayout);
  for(const r of t){const b=G.bounds(r.quad);for(const x of t){if(x.id===r.id)continue;if(norm(x.text)===norm(r.text)||norm(r.text).includes(norm(x.text))||norm(x.text).includes(norm(r.text)))continue;
   const a=G.bounds(x.quad),cross=Math.max(0,Math.min(b[2],a[2])-Math.max(b[0],a[0]))*Math.max(0,Math.min(b[3],a[3])-Math.max(b[1],a[1]));
   const share=cross/Math.max(1,Math.min((b[2]-b[0])*(b[3]-b[1]),(a[2]-a[0])*(a[3]-a[1])));
   if(share>.2)risk.push([p+1,r.text,x.text,+share.toFixed(2),G.replacementReason(r,rows),G.replacementReason(x,rows)]);}}}
 const live=risk.filter(x=>!x[4]&&!x[5]);
 console.log('   overlapping different-text pairs',risk.length,'both-displayed',live.length);
 for(const x of live.slice(8))console.log('     ',JSON.stringify(x));
}
