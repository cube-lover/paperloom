/* Geometry evidence evolves independently of translations and manual revisions.
   Deliberately does not migrate changed text or split/merged semantic units.
 */
var CubeGraphicEvidence;
(function(root){'use strict';
 const rect=q=>[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];
 const area=r=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);
 const intersect=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const normalized=t=>String(t||'').replace(/\s+/g,'');
 function match(old,next){
  if(old.legacyLayout||old.pageIndex!==next.pageIndex||normalized(old.text)!==normalized(next.text)||next.review||next.score<.94||next.directionVerified!==true)return false;
  const a=rect(old.sourceQuad||old.quad),b=rect(next.sourceQuad||next.quad),overlap=intersect(a,b),af=rect(old.quad),bf=rect(next.quad);
  return area(a)>0&&area(b)>0&&intersect(b,bf)>=area(b)*.95&&intersect(af,bf)/Math.max(1,Math.min(area(af),area(bf)))>=.7&&overlap/Math.min(area(a),area(b))>=.85&&Math.max(area(a),area(b))/Math.min(area(a),area(b))<=2.5;
 }
 function reconcile(existing,candidates){
  const updates=[],suggestions=[];
  for(const next of candidates){
   const hits=existing.filter(old=>match(old,next));
   // Both directions must be unique; matching short labels across a table is unsafe.
   if(hits.length!==1||candidates.filter(n=>match(hits[0],n)).length!==1)continue;
   const old=hits[0],fields=['quad','sourceQuad','origin','score','directionVerified','rotation','recognitionPass','background','backgroundSample','autoValidated','fontSize','preserveSource','preserveLiterals','inkRefined','inkPatch','flowNode','flowEvidence','members'];
   const changed=fields.some(k=>JSON.stringify(old[k])!==JSON.stringify(next[k]));if(!changed)continue;
   // User-approved geometry/source remains authoritative. Target-only edits are
   // preserved and do not prevent a separately verified geometry refresh.
   const verifiedReading=old.review&&!old.edited&&next.directionVerified===true&&((next.directionEvidence==='upright-flow-neighbours'&&next.textConfirmed&&next.score>=.98)||(next.orientationAgreement>=.97&&next.directionMargin>.2&&normalized(next.text).length>=12&&next.score>=.98));
   if(old.approved||old.review&&!next.inkRefined&&!verifiedReading){suggestions.push({id:old.id,next});continue;}
   const before=Object.fromEntries(fields.map(k=>[k,old[k]]));
   (old.geometryHistory||=[]).push({version:1,evidence:before});
   for(const k of fields)if(Object.hasOwn(next,k))old[k]=next[k];
   if((next.inkRefined||verifiedReading)&&!next.review)old.review=false;
   old.geometryRevision=(old.geometryRevision||0)+1;
   updates.push(old.id);
  }
  return {updates,suggestions};
 }
 function adoptFlowNode(existing,next){
  const b=rect(next.quad),hits=existing.filter(r=>{
   if(r.legacyLayout||r.pageIndex!==next.pageIndex)return false;
   const a=rect(r.sourceQuad||r.quad),cx=(a[0]+a[2])/2,cy=(a[1]+a[3])/2;
   // OCR padding may straddle the node border. Bind by the ink centre plus
   // substantial overlap, while retaining neighbours outside this node.
   return cx>b[0]&&cx<b[2]&&cy>b[1]&&cy<b[3]&&intersect(a,b)>area(a)*.7;
  });
  if(hits.some(r=>r.id===next.id))return {existing:true};
  if(hits.some(r=>r.edited||r.approved)){for(const r of hits)r.flowSuggestion={text:next.text,quad:next.quad};return {blocked:true};}
  const exact=hits.filter(r=>normalized(r.text).toLowerCase()===normalized(next.text).toLowerCase());
  if(hits.length===1&&exact.length===1){next.target=exact[0].target;next.history=exact[0].history;}
  for(const r of hits){r.legacyLayout=true;r.selected=false;r.supersededBy=next.id;}
  next.previousIDs=hits.map(r=>r.id);return {archived:hits.length};
 }
 function adoptAxisTitle(existing,next){
  if(next.origin!=='OCR'||next.score<.97||!next.directionVerified||![90,270].includes(next.rotation))return {};
  const b=rect(next.quad),hits=existing.filter(r=>!r.legacyLayout&&r.pageIndex===next.pageIndex&&intersect(rect(r.quad),b)>area(rect(r.quad))*.85);
  if(hits.length<2||hits.some(r=>r.id===next.id))return {};
  const norm=t=>normalized(t).toLowerCase().replace(/[^a-z0-9]/g,''),text=norm(next.text);
  if(hits.some(r=>!text.includes(norm(r.text))&&r.score>=.94&&!r.review))return {};
  if(hits.some(r=>r.edited||r.approved)){for(const r of hits)r.axisSuggestion={text:next.text,quad:next.quad};return {blocked:true};}
  for(const r of hits){r.legacyLayout=true;r.selected=false;r.supersededBy=next.id;}next.previousIDs=hits.map(r=>r.id);return {archived:hits.length};
 }
 const api={match,reconcile,adoptFlowNode,adoptAxisTitle};CubeGraphicEvidence=root.CubeGraphicEvidence=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
