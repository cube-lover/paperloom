#!/usr/bin/env python3
"""Local chart OCR. All polygons remain in original input pixels, in reading order."""
from pathlib import Path
import argparse
import json
import math
import re
import sys


def box_bounds(points):
    return [min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points)]


def reading_quad(rect, angle=0):
    """Order TL/TR/BR/BL of the DESKEWED reading frame in source image space.

    angle is PIL's counterclockwise rotation applied to the crop for recognition.
    No axis-aligned reboxing after this operation: it would lose reading direction.
    """
    l, t, r, b = rect
    corners = [[l, t], [r, t], [r, b], [l, b]]
    start = {0: 0, 90: 1, 180: 2, 270: 3}[angle]
    return corners[start:] + corners[:start]


def overlap_ratio(a, b):
    intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area = lambda r: max(0, r[2] - r[0]) * max(0, r[3] - r[1])
    return intersection / max(1, min(area(a), area(b)))


def merge_passes(rows, incoming):
    for row in incoming:
        rect = box_bounds(row['polygon'])
        matches = [old for old in rows if overlap_ratio(box_bounds(old['polygon']), rect) > .55]
        if not matches:
            rows.append(row)
        elif len(matches) == 1 and row['score'] > matches[0]['score'] + .005 and not (
                len(re.sub(r'\s+', '', row['text'])) < len(re.sub(r'\s+', '', matches[0]['text'])) * .8):
            # Preserve evidence when changing text, not just the winning string.
            old = matches[0]
            if re.sub(r'\s+', '', old['text']) != re.sub(r'\s+', '', row['text']):
                row['previousText'] = old['text']
            rows[rows.index(old)] = row
    return rows


def enhance_rows(engine, image, rows):
    """Re-recognize actual label crops; 90/270 compares both reading directions."""
    from PIL import Image
    width, height = image.size
    for row in rows[:1000]:
        rect = box_bounds(row['polygon'])
        l, t, r, b = rect
        vertical = b - t > (r - l) * 1.6
        # Horizontal detection alone has no orientation flag. Always compare
        # both directions, including high-scoring labels, before allowing replace.
        crop_rect = (max(0, math.floor(l - 2)), max(0, math.floor(t - 2)),
                     min(width, math.ceil(r + 2)), min(height, math.ceil(b + 2)))
        crop = image.crop(crop_rect)
        factor = min(4, max(1, 48 / max(1, min(crop.size))))
        crop = crop.resize((round(crop.width * factor), round(crop.height * factor)), Image.Resampling.LANCZOS)
        candidates = []
        for angle in ([90, 270] if vertical else [0, 180]):
            result = engine(crop.rotate(angle, expand=True), use_det=False, use_cls=False, use_rec=True)
            if result.txts and result.scores:
                text, score = str(result.txts[0]).strip(), float(result.scores[0])
                if text:
                    candidates.append((score, text, angle))
        candidates.sort(reverse=True)
        if not candidates:
            row['directionVerified'] = not vertical
            continue
        score, text, angle = candidates[0]
        margin = score - (candidates[1][0] if len(candidates) > 1 else 0)
        same = re.sub(r'\s+', '', text).lower() == re.sub(r'\s+', '', row['text']).lower()
        complete = len(re.sub(r'\s+', '', text)) >= len(re.sub(r'\s+', '', row['text'])) * .8
        accepted = score >= .94 and complete and (vertical or angle == 180 and margin > .2 and row['score'] < .94 or score > row['score'] + .005)
        if accepted:
            if row['text'] != text:
                row['previousText'] = row['text']
            row.update(text=text, score=score, polygon=reading_quad(rect, angle),
                       rotation=angle, directionVerified=margin > .08,
                       recognitionPass='local-upscale', directionMargin=round(margin, 5))
        elif not vertical:
            same = re.sub(r'\s+', '', text).lower() == re.sub(r'\s+', '', row['text']).lower()
            # Reading direction is evidence independent of exact transcription.
            # Tiny raster confusions (I/l, punctuation) in a long, complete line
            # do not imply upside-down text. Keep the original source unchanged.
            from difflib import SequenceMatcher
            a = re.sub(r'\s+', '', text).lower()
            b = re.sub(r'\s+', '', row['text']).lower()
            agreement = SequenceMatcher(None, a, b).ratio()
            stable_long = len(b) >= 12 and complete and agreement >= .97 and score >= .95 and row['score'] >= .98 and margin > .2
            row['directionVerified'] = bool(angle == 0 and ((same and score >= .94 and margin > .08) or stable_long))
            row['orientationAgreement'] = round(agreement, 5)
            if row['directionVerified'] and len(b)>=12:
                row['polygon'] = reading_quad(rect, 0)
            # Yes/No are branch labels, not variables; two upright passes agree
            # on their text and the reversed pass must be clearly worse.
            if b in ('yes','no') and same and angle==0 and score>=.96 and margin>.2:
                row['directionVerified']=True; row['rotation']=0
            row['textConfirmed'] = bool(angle == 0 and same and score >= .99 and row['score'] >= .99)
            row['directionMargin'] = round(margin, 5)
            if row['directionVerified']:
                row['rotation'] = 0
        elif vertical:
            # Keep source text available for review, but do not invent orientation.
            row['directionVerified'] = False
    return rows


def refine_ink(image, rows, only_branches=False):
    """Trim detection padding to measured dark ink, preserving separation of rows.
    Only axis-aligned horizontal labels; never force a rotated/skewed title flat.
    """
    import numpy as np
    rgb = np.asarray(image.convert('RGB'))
    for row in rows:
        if only_branches and row.get('directionEvidence')!='upright-flow-neighbours': continue
        if row.get('rotation', 0) != 0 or not row.get('directionVerified') or row.get('score', 0) < .94:
            continue
        l,t,r,b = box_bounds(row['polygon']); w,h = r-l,b-t
        if w <= h or h < 3: continue
        x0,y0,x1,y1 = max(0,int(l)),max(0,int(t)),min(image.width,math.ceil(r)),min(image.height,math.ceil(b))
        im=rgb[y0:y1,x0:x1]; hi=im.max(axis=2);lo=im.min(axis=2)
        dark=(hi<155)&((hi.astype(int)-lo.astype(int))<40)
        ys,xs=np.nonzero(dark)
        if len(xs)<4: continue
        # Long rules or a connected neighbour at an edge are not glyph bounds.
        if dark.sum(axis=1).max() > max(12,im.shape[1]*.82): continue
        top,bottom=y0+int(ys.min()),y0+int(ys.max())+1
        if bottom-top>h*.96: continue
        # Distinct glyph bounds and available row frame. Retain antialias margins;
        # use only the empty gap to adjacent OCR rows, never steal their pixels.
        ink=[max(0,x0+int(xs.min())-2),max(0,top-2),min(image.width,x0+int(xs.max())+3),min(image.height,bottom+2)]
        rect=list(ink)
        for direction in [-1,1]:
            edge=1 if direction<0 else 3
            limit=max(0,ink[1]-3) if direction<0 else min(image.height,ink[3]+3)
            for other in rows:
                if other is row: continue
                a=box_bounds(other['polygon'])
                if min(a[2],ink[2])<=max(a[0],ink[0]): continue
                if direction<0 and a[3]<=top: limit=max(limit,(a[3]+top)/2)
                if direction>0 and a[1]>=bottom: limit=min(limit,(a[1]+bottom)/2)
            rect[edge]=limit
        if any(overlap_ratio(rect,box_bounds(other['polygon']))>.02 for other in rows if other is not row): continue
        row['sourcePolygon']=reading_quad(ink);row['polygon']=reading_quad(rect);row['inkRefined']=True
    return rows


def group_flow_boxes(image, rows):
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
        # If an inset cuts an isolated descender, use the clear inner edge one
        # pixel closer to the contour. Never cross the contour or a drawn rule.
        for edge in range(4):
            strip = grey[frame[1]:frame[3], frame[0]:frame[2]]
            boundary = [strip[:,0],strip[0,:],strip[:,-1],strip[-1,:]][edge]
            if np.any(boundary < 155):
                trial = frame[:]; trial[edge] += -1 if edge < 2 else 1
                part = grey[trial[1]:trial[3],trial[0]:trial[2]]
                new_boundary = [part[:,0],part[0,:],part[:,-1],part[-1,:]][edge]
                if np.all(new_boundary >= 210): frame = trial
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
                           'fontSize':float(np.median([box_bounds(r.get('sourcePolygon',r['polygon']))[3]-box_bounds(r.get('sourcePolygon',r['polygon']))[1] for _,r in inside]))/.85,
                           'flowEvidence':{'version':2,'interior':frame,'background':bg,'unexplainedInk':0},
                           'recognitionPass':'closed-flow-node','members':[r['text'] for _,r in inside]})
            consumed.update(i for i,_ in inside)
    return [r for i,r in enumerate(rows) if i not in consumed]+groups


def verify_flow_branches(image, rows):
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


def recognize(input_path, runtime_dir, model_dir):
    sys.path.insert(0, str(Path(runtime_dir).resolve()))
    from PIL import Image
    source = Path(input_path).resolve()
    if not source.is_file() or source.stat().st_size > 24 * 1024 * 1024:
        raise ValueError('Image file missing or too large')
    with Image.open(source) as image:
        width, height = image.size
        if not (8 <= width <= 6000 and 8 <= height <= 6000) or width * height > 16_000_000:
            raise ValueError('Image dimensions outside limits')
        image.verify()
    with Image.open(source) as image_file:
        image = image_file.convert('RGB')
    from rapidocr import RapidOCR, OCRVersion, ModelType
    model_dir = Path(model_dir).resolve()
    models = {kind: model_dir / (kind + '.onnx') for kind in ['det', 'rec', 'cls']}
    if not all(path.is_file() for path in models.values()):
        raise ValueError('OCR models not installed')
    engine = RapidOCR(params={
        'Global.log_level': 'critical',
        'Det.model_path': str(models['det']), 'Rec.model_path': str(models['rec']),
        'Cls.model_path': str(models['cls']),
        'Det.ocr_version': OCRVersion.PPOCRV4, 'Det.model_type': ModelType.MOBILE,
        'Rec.ocr_version': OCRVersion.PPOCRV4, 'Rec.model_type': ModelType.MOBILE,
        'EngineConfig.onnxruntime.intra_op_num_threads': 2,
        'EngineConfig.onnxruntime.inter_op_num_threads': 1,
    })

    def detect(img, origin=(0, 0), scale=(1, 1)):
        result = engine(img)
        rows = []
        if result.boxes is not None:
            for box, text, score in zip(result.boxes, result.txts, result.scores):
                points = [[float(x) / scale[0] + origin[0], float(y) / scale[1] + origin[1]] for x, y in box]
                if len(points) != 4 or not all(math.isfinite(v) for point in points for v in point):
                    continue
                rows.append({'polygon': points, 'text': str(text)[:2000], 'score': float(score), 'rotation': 0})
        return rows

    rows = detect(image)
    # Overlapping local tiles recover small horizontal legends skipped at whole-
    # region detection scale. Actual resize ratios (not nominal 2x) map back.
    tile, step = 1000, 800
    xs = list(range(0, max(1, width - tile + step), step))
    ys = list(range(0, max(1, height - tile + step), step))
    passes = 0
    if len(xs) * len(ys) <= 12:
        for y in ys:
            for x in xs:
                crop = image.crop((x, y, min(width, x + tile), min(height, y + tile)))
                scaled = crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.LANCZOS)
                merge_passes(rows, detect(scaled, (x, y), (scaled.width / crop.width, scaled.height / crop.height)))
                passes += 1
    # A rotated whole-image pass sees a complete vertical axis title rather than
    # two overlapping word fragments. Transform corners back before any merge.
    rotated = image.rotate(90, expand=True)
    vertical_rows = detect(rotated)
    for candidate in vertical_rows:
        points = [[width - y, x] for x, y in candidate['polygon']]
        rect = box_bounds(points)
        if rect[3] - rect[1] < (rect[2] - rect[0]) * 2 or candidate['score'] < .94:
            continue
        candidate['polygon'] = reading_quad(rect, 270)
        candidate['rotation'] = 270
        candidate['recognitionPass'] = 'rotated-whole-image'
        matches = [old for old in rows if overlap_ratio(box_bounds(old['polygon']), rect) > .55]
        if matches and all(re.sub(r'\s+', '', old['text']).lower() in re.sub(r'\s+', '', candidate['text']).lower() or old['score'] < .94 for old in matches):
            candidate['previousText'] = ' | '.join(old['text'] for old in matches)
            rows = [old for old in rows if old not in matches]
            rows.append(candidate)
        elif not matches:
            rows.append(candidate)
    rows = group_flow_boxes(image, refine_ink(image, enhance_rows(engine, image, rows)))
    rows = refine_ink(image, verify_flow_branches(image, rows), only_branches=True)
    return {'version': 1, 'engine': 'RapidOCR-local', 'width': width, 'height': height,
            'localPasses': passes, 'lines': rows[:1000]}


def main():
    parser = argparse.ArgumentParser()
    for key in ['input', 'output', 'runtime', 'models']:
        parser.add_argument('--' + key, required=True)
    args = parser.parse_args()
    try:
        result = recognize(args.input, args.runtime, args.models)
    except Exception:
        result = {'version': 1, 'error': 'Local OCR failed; verify runtime and model installation'}
    output = Path(args.output)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    temporary.replace(output)
    return 1 if result.get('error') else 0


if __name__ == '__main__':
    raise SystemExit(main())
