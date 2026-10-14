const fs=require('fs');
const s=JSON.parse(fs.readFileSync(process.argv[2]||'.local/dev-channel/archives/100e87ba-0ac3-43e6-8570-b82165c79124/snapshot.json','utf8'));
const G=require('../addon/content/graphics');
const item=Number(process.argv[3]||428),want=Number(process.argv[4]||0);
for(const g of s.graphics||[]){if(g.itemID!==item)continue;
 const pages=[...new Set(g.rows.map(r=>r.pageIndex))];
 for(const p of pages){if(want&&p+1!==want)continue;
  const rows=g.rows.filter(r=>r.pageIndex===p);
  for(const r of rows){if(!r.target||r.legacyLayout)continue;const reason=G.replacementReason(r,rows);
   if(!reason)continue;if(!/相交/.test(reason))continue;
   const hits=[];
   for(const x of rows){if(x.id===r.id)continue;
    const without=rows.filter(y=>y.id!==x.id),withPeer=G.replacementReason(r,rows),none=G.replacementReason(r,without);
    if(/相交/.test(withPeer)&&!/相交/.test(none))hits.push({t:x.text,tg:x.target,box:G.bounds(x.quad).slice(0,4).map(v=>Math.round(v))});}
   console.log('page',p+1,'BLOCK',String(r.text).slice(0,60),'=>',String(r.target).slice(0,40),'box',G.bounds(r.quad).slice(0,4).map(v=>Math.round(v)));
   for(const h of hits)console.log('    blocker',JSON.stringify(String(h.t).slice(0,70)),'=>',JSON.stringify(String(h.tg).slice(0,30)),'box',h.box);}}
}
