const fs=require('fs');const f='tools/ocr-image.py';let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),a=s.indexOf('def group_flow_boxes('),b=s.indexOf('\n\ndef recognize(',a);if(a<0||b<0)throw Error('Missing function');s=s.slice(0,a)+`def group_flow_boxes(image, rows):
    """Closed node interiors own text by its ink centre, not OCR padding.

    Threshold sweeps detect faint raster borders; every accepted interior still
    requires full OCR coverage, neutral paper and no unexplained marks. Process
    smallest boxes first, so a group container never swallows its child nodes.
    """
    import cv2
    import numpy as np
    rgb = np.asarray(image.convert('RGB'))
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    boxes = []
    for threshold in [140, 180, 210, 225]:
        bw = cv2.threshold(grey, threshold, 255, cv2.THRESH_BINARY_INV)[1]
        contours, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        for c in contours:
            x,y,w,h = cv2.boundingRect(c)
            if w < 60 or h < 30 or w*h > image.width*image.height*.3: continue
            p = cv2.approxPolyDP(c, cv2.arcLength(c, True)*.015, True)
            if len(p) != 4 or cv2.contourArea(c) < w*h*.93: continue
            candidates.append((x,y,w,h))
        # Inner contour first: outer contours may include a border/shadow.
        for x,y,w,h in sorted(candidates, key=lambda b:b[2]*b[3]):
            if any(abs(x-X)+abs(y-Y)+abs(w-W)+abs(h-H)<20 for X,Y,W,H in boxes): continue
            boxes.append((x,y,w,h))
    if len(boxes) < 3: return rows
    consumed, groups = set(), []
    for x,y,w,h in sorted(boxes, key=lambda b:b[2]*b[3]):
        frame = [x+2,y+2,x+w-2,y+h-2]
        inside = []
        for i,row in enumerate(rows):
            a = box_bounds(row.get('sourcePolygon', row['polygon']))
            cx,cy = (a[0]+a[2])/2, (a[1]+a[3])/2
            if frame[0]<cx<frame[2] and frame[1]<cy<frame[3]:
                # Padding may touch a border; source extending far outside is
                # genuinely another node, not a licence to whiten that node.
                if a[0]<x-3 or a[2]>x+w+3 or a[1]<y-3 or a[3]>y+h+3: break
                inside.append((i,row))
        else:
            if not inside or any(i in consumed for i,_ in inside): continue
            if any(row.get('score',0)<.94 or row.get('rotation',0)!=0 for _,row in inside): continue
            consensus = sum(bool(r.get('directionVerified')) for _,r in inside)>=2
            if any(not r.get('directionVerified') and not r.get('textConfirmed') and not
                   (consensus and len(r['text'].strip())<=3 and r.get('score',0)>=.96) for _,r in inside): continue
            sub = grey[frame[1]:frame[3], frame[0]:frame[2]]
            colours = rgb[frame[1]:frame[3], frame[0]:frame[2]]
            if np.any(colours.max(axis=2).astype(int)-colours.min(axis=2).astype(int)>18): continue
            explained = np.zeros(sub.shape, dtype=bool)
            for _,r in inside:
                a = box_bounds(r['polygon'])
                l,t = max(0,int(a[0]-frame[0]-2)),max(0,int(a[1]-frame[1]-2))
                rr,bb = min(sub.shape[1],math.ceil(a[2]-frame[0]+2)),min(sub.shape[0],math.ceil(a[3]-frame[1]+2))
                explained[t:bb,l:rr] = True
            if np.count_nonzero((sub<180)&~explained)>3: continue
            border = np.concatenate([sub[0,:],sub[-1,:],sub[:,0],sub[:,-1]])
            hist = np.bincount(sub.ravel(), minlength=256); hist[:180]=0; bg=int(hist.argmax())
            if np.count_nonzero(abs(border.astype(int)-bg)>15)>len(border)*.025: continue
            # Border must enclose *all* actual text; do not cut descenders to
            # create an apparently clean rectangle. A marginal case stays OCR.
            if np.any(border<155): continue
            inside.sort(key=lambda it:(box_bounds(it[1]['polygon'])[1],box_bounds(it[1]['polygon'])[0]))
            ys,xs = np.nonzero(sub<bg-30)
            if len(xs)<4: continue
            ink = [frame[0]+int(xs.min()),frame[1]+int(ys.min()),frame[0]+int(xs.max())+1,frame[1]+int(ys.max())+1]
            groups.append({'text':' '.join(r['text'] for _,r in inside),
                           'score':min(r['score'] for _,r in inside),
                           'polygon':reading_quad(frame), 'sourcePolygon':reading_quad(ink),
                           'rotation':0,'directionVerified':True,'flowNode':True,
                           'flowEvidence':{'version':2,'interior':frame,'background':bg,'unexplainedInk':0},
                           'recognitionPass':'closed-flow-node','members':[r['text'] for _,r in inside]})
            consumed.update(i for i,_ in inside)
    return [r for i,r in enumerate(rows) if i not in consumed]+groups
`+s.slice(b);fs.writeFileSync(f,s);fs.copyFileSync(f,'addon/content/ocr-image.py');
