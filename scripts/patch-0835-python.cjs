const fs=require('fs');
function patch(f,edits){let s=fs.readFileSync(f,'utf8');for(const[a,b]of edits){if(s.split(a).length!==2)throw Error(f+' nonunique '+a.slice(0,60));s=s.replace(a,b);}fs.writeFileSync(f,s);}
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
 ["rows = group_flow_boxes(image, refine_ink(image, enhance_rows(engine, image, rows)))", "rows = group_flow_boxes(image, refine_ink(image, enhance_rows(engine, image, rows)))\n    rows = refine_ink(image, verify_flow_branches(image, rows), only_branches=True)"]
]);
fs.copyFileSync('tools/ocr-image.py','addon/content/ocr-image.py');
for(const f of ['package.json','addon/manifest.json']){let d=JSON.parse(fs.readFileSync(f));d.version='0.8.35';fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');}
