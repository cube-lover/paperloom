const fs=require('fs');
function patch(f,edits){let s=fs.readFileSync(f,'utf8');for(const[a,b]of edits){if(s.split(a).length!==2)throw Error(f+' nonunique '+a.slice(0,60));s=s.replace(a,b);}fs.writeFileSync(f,s);}
patch('addon/content/core.js',[
 ["const system = `你是严谨", "const policy=cfg.translationRole==='flow-node'?'\\n当前任务是流程图完整节点翻译：用紧凑中文保留原条件、动作与因果关系。普通英文即使大写亦应翻译，不当作缩写保留：ELECTRIC→电力，GAS→天然气，OIL→石油，HURRICANE→飓风，FLOOD→洪水，intra-network→层内，inter-network→层间。OCR可能将OIL写成OlL/Oll/OLL、GAS写成GAs、连写UpdateOlLinfrastructures；在基础设施语境按石油/天然气理解。真正的缩写CLM、ML、GTA及公式数值照原文保留。不要加括注或英文解释。':'';\n    const system = `你是严谨"],
 ["content: system + (dictionary.length", "content: system + policy + (dictionary.length"],
 ["{ v: VERSION, task, source, context:", "{ v: VERSION, task, source, ...(cfg.translationRole==='flow-node'?{translationRole:'flow-node-v1'}:{}), context:"]
]);
patch('addon/content/graphics.js',[
 ["const result=await this.translate(job.source,cfg,job.context,control);", "const result=await this.translate(job.source,job.rows[0].flowNode?{...cfg,translationRole:'flow-node'}:cfg,job.context,control);"],
 ["if(rows.some(r=>r!==row&&overlap(b,bounds(r.quad))>.1))", "if(rows.some(r=>{if(r===row)return false;const a=bounds(r.sourceQuad||r.quad),cross=overlap(b,a);if(cross<=.1)return false;\n      // A low-confidence punctuation proposal centred outside a fully audited\n      // closed node may have padded corners crossing its edge. The actual node\n      // background evidence, not the punctuation detector, owns that interior.\n      if(row.flowNode&&row.flowEvidence?.version===2&&row.flowEvidence.unexplainedInk===0&&r.origin==='OCR'&&r.review&&r.score<.8&&!r.target&&!/[\\p{L}\\p{N}]/u.test(r.text)&&cross<area(a)*.2&&!inside([(a[0]+a[2])/2,(a[1]+a[3])/2],b))return false;return true;}))"],
 ["inkRefined:!!line.inkRefined,recognitionPass:", "inkRefined:!!line.inkRefined,orientationAgreement:line.orientationAgreement,directionMargin:line.directionMargin,textConfirmed:!!line.textConfirmed,directionEvidence:line.directionEvidence,recognitionPass:"]
]);
patch('addon/content/graphic-evidence.js',[
 ["   if(old.approved||old.review&&!next.inkRefined)", "   const verifiedReading=old.review&&!old.edited&&next.directionVerified===true&&((next.directionEvidence==='upright-flow-neighbours'&&next.textConfirmed&&next.score>=.98)||(next.orientationAgreement>=.97&&next.directionMargin>.2&&normalized(next.text).length>=12&&next.score>=.98));\n   if(old.approved||old.review&&!next.inkRefined&&!verifiedReading)"],
 ["if(next.inkRefined&&!next.review)old.review=false;", "if((next.inkRefined||verifiedReading)&&!next.review)old.review=false;"]
]);
patch('tools/ocr-image.py',[
 ['def recognize(input_path, runtime_dir, model_dir):',`def verify_flow_branches(image, rows):
    # No/ON can both score highly when flipped. Two agreeing upright passes
    # plus several nearby verified closed nodes resolve this *diagram-only*
    # case; isolated labels and unknown text retain their review status.
    nodes = [r for r in rows if r.get('flowNode') and r.get('directionVerified')]
    if len(nodes) < 3: return rows
    for row in rows:
        if row.get('directionVerified') or row.get('rotation',0)!=0 or row['text'].strip().lower() not in ('yes','no'): continue
        if not row.get('textConfirmed') or row.get('orientationAgreement',0)<1 or row.get('score',0)<.98: continue
        a=box_bounds(row['polygon']); cx,cy=(a[0]+a[2])/2,(a[1]+a[3])/2
        near=sum(1 for n in nodes if (lambda b: abs((b[0]+b[2])/2-cx)<image.width*.4 and abs((b[1]+b[3])/2-cy)<image.height*.45)(box_bounds(n['polygon'])))
        if near<3: continue
        row['directionVerified']=True; row['directionEvidence']='upright-flow-neighbours'
        row['polygon']=reading_quad(a)
    return rows


def recognize(input_path, runtime_dir, model_dir):`],
 ["rows = group_flow_boxes(image, rows)", "rows = group_flow_boxes(image, rows)\n    rows = refine_ink(image, verify_flow_branches(image, rows))"]
]);
fs.copyFileSync('tools/ocr-image.py','addon/content/ocr-image.py');
for(const f of ['package.json','addon/manifest.json']){let d=JSON.parse(fs.readFileSync(f));d.version='0.8.35';fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');}
