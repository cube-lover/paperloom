#!/usr/bin/env python3
"""Native PDF text-only removal worker. PyMuPDF installed separately (AGPL/commercial).
No network, translation, raster inpainting or changes to the input file.
Contract: original PDF coordinates (unrotated, bottom-left), not display pixels.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import unicodedata

VERSION = 'native-text-1'
MAX_BYTES = 80 * 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(text):
    return ''.join(unicodedata.normalize('NFKC', text).split()).replace('\u00ad', '')


def validate(request):
    if not isinstance(request, dict) or request.get('version') != 1:
        raise ValueError('invalid_request_version')
    if not re.fullmatch(r'[a-f0-9]{64}', request.get('sourceSHA256', '')):
        raise ValueError('source_digest_required')
    page = request.get('pageIndex')
    if isinstance(page, bool) or not isinstance(page, int) or page < 0:
        raise ValueError('invalid_page_index')
    labels = request.get('labels')
    if not isinstance(labels, list) or not 1 <= len(labels) <= 200:
        raise ValueError('invalid_label_count')
    ids = set()
    for label in labels:
        if not isinstance(label, dict):
            raise ValueError('invalid_label')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', label.get('id', '')) or label['id'] in ids:
            raise ValueError('invalid_label_id')
        ids.add(label['id'])
        if not isinstance(label.get('text'), str) or not 1 <= len(label['text']) <= 6000:
            raise ValueError('invalid_source_text')
        q = label.get('sourceQuad')
        if not isinstance(q, list) or len(q) != 4 or any(not isinstance(p, list) or len(p) != 2 or
                any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) for v in p) for p in q):
            raise ValueError('invalid_source_quad')
        cross = [(q[(i+1)%4][0]-q[i][0])*(q[(i+2)%4][1]-q[(i+1)%4][1]) -
                 (q[(i+1)%4][1]-q[i][1])*(q[(i+2)%4][0]-q[(i+1)%4][0]) for i in range(4)]
        if not (all(x > 1e-6 for x in cross) or all(x < -1e-6 for x in cross)):
            raise ValueError('nonconvex_source_quad')
    return request


def contains(q, x, y):
    signs = [(q[(i+1)%4][0]-q[i][0])*(y-q[i][1]) - (q[(i+1)%4][1]-q[i][1])*(x-q[i][0]) for i in range(4)]
    return all(s >= -0.02 for s in signs) or all(s <= 0.02 for s in signs)


def chars(page):
    return [{'c': c['c'], 'bbox': list(c['bbox'])} for b in page.get_text('rawdict')['blocks']
            if 'lines' in b for line in b['lines'] for span in line['spans'] for c in span['chars']]


def character_equivalent(expected, actual, tolerance=.01):
    # Content streams are reserialized with slightly different decimal precision.
    # Require identical characters/counts and at most 0.01 PDF pt geometric drift.
    a, b = {}, {}
    for c in expected:
        if c['c'].strip(): a.setdefault(c['c'], []).append(c['bbox'])
    for c in actual:
        if c['c'].strip(): b.setdefault(c['c'], []).append(c['bbox'])
    if a.keys() != b.keys(): return False
    for key in a:
        aa, bb = sorted(a[key]), sorted(b[key])
        if len(aa) != len(bb) or any(abs(x-y)>tolerance for r,s in zip(aa,bb) for x,y in zip(r,s)): return False
    return True


def stable_paths(page):
    return [{k: str(v) for k, v in d.items() if k != 'seqno'} for d in page.get_drawings()]


def images(doc, page):
    return [sha(doc.extract_image(i[0])['image']) for i in page.get_images()]


def generate(source, request, output):
    import pymupdf as fitz
    validate(request)
    source, output = Path(source).resolve(), Path(output).resolve()
    if source.suffix.lower() != '.pdf' or source.stat().st_size > MAX_BYTES:
        raise ValueError('invalid_or_oversize_pdf')
    data = source.read_bytes()
    if sha(data) != request['sourceSHA256']:
        raise ValueError('source_digest_mismatch')
    if output.exists():
        raise ValueError('output_must_be_new_directory')
    # New immutable artifact folder; input, original and clean never share paths.
    output.mkdir(parents=True)
    with fitz.open(stream=data, filetype='pdf') as src, fitz.open() as doc:
        if src.needs_pass or request['pageIndex'] >= len(src):
            raise ValueError('encrypted_or_missing_page')
        doc.insert_pdf(src, from_page=request['pageIndex'], to_page=request['pageIndex'], links=False, annots=False, widgets=False)
        page = doc[0]
        rotation = page.rotation
        page.set_rotation(0)  # get a crop-aware PDF→MuPDF matrix also for rotated pages
        transform, inverse = page.transformation_matrix, ~page.transformation_matrix
        original_chars = chars(page)
        before_paths, before_images = stable_paths(page), images(doc, page)
        selected = set()
        accepted = []
        for label in request['labels']:
            q = [list(fitz.Point(p) * transform) for p in label['sourceQuad']]
            indices = [i for i, c in enumerate(original_chars) if contains(q, (c['bbox'][0]+c['bbox'][2])/2, (c['bbox'][1]+c['bbox'][3])/2)]
            text = ''.join(original_chars[i]['c'] for i in indices)
            if not indices or canonical(text) != canonical(label['text']):
                raise ValueError('source_text_mismatch:' + label['id'])
            if selected.intersection(indices):
                raise ValueError('overlapping_source_labels:' + label['id'])
            selected.update(indices)
            rects = [fitz.Rect(original_chars[i]['bbox']) for i in indices if original_chars[i]['c'].strip()]
            if not rects:
                raise ValueError('empty_label:' + label['id'])
            ink = fitz.Rect(rects[0])
            for r in rects[1:]:
                ink |= r
            accepted.append({'id': label['id'], 'text': label['text'], 'sourceQuad': label['sourceQuad'],
                             'eraseRect': list(ink * inverse), 'characters': len(indices)})
        # Save an unchanged single page for same-renderer differential validation.
        page.set_rotation(rotation)
        original = doc.tobytes(garbage=4, deflate=True)
        page.set_rotation(0)
        for i in selected:
            r = fitz.Rect(original_chars[i]['bbox'])
            x, y = (r.x0+r.x1)/2, (r.y0+r.y1)/2
            # A small interior rectangle targets the glyph, NOT the expanded
            # translation frame. Whole-page character audit rejects collateral.
            dx, dy = min(.15, r.width*.15), min(.15, r.height*.15)
            if dx <= 0 or dy <= 0:
                raise ValueError('degenerate_glyph')
            page.add_redact_annot(fitz.Rect(x-dx,y-dy,x+dx,y+dy), fill=False, cross_out=False)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
        expected = [c for i,c in enumerate(original_chars) if i not in selected]
        if not character_equivalent(expected, chars(page)):
            raise ValueError('collateral_character_change')
        if stable_paths(page) != before_paths or images(doc,page) != before_images:
            raise ValueError('nontext_content_change')
        page.set_rotation(rotation)
        clean = doc.tobytes(garbage=4, deflate=True)
        # Verify again after serialization, not only against the in-memory page.
        with fitz.open(stream=clean, filetype='pdf') as check:
            check[0].set_rotation(0)
            if not character_equivalent(expected, chars(check[0])):
                raise ValueError('serialized_character_change')
        if sha(source.read_bytes()) != request['sourceSHA256']:
            raise ValueError('source_changed_during_job')
        manifest = {'version':1, 'engine':VERSION, 'engineVersion':fitz.VersionBind,
                    'sourceSHA256':request['sourceSHA256'], 'pageIndex':request['pageIndex'],
                    'requestSHA256':sha(json.dumps(request,sort_keys=True,separators=(',',':')).encode()),
                    'coordinateSpace':'pdf-user-space', 'rotation':rotation,
                    'labels':accepted, 'originalSHA256':sha(original), 'cleanSHA256':sha(clean),
                    'checks':{'remainingCharactersUnchanged':True,'drawingGeometryAndStyleUnchanged':True,
                              'imageHashesUnchanged':True,'sourceUnchanged':True},
                    'characterPositionTolerancePt':.01, 'renderVerified':False}
        (output/'original.pdf').write_bytes(original)
        (output/'clean.pdf').write_bytes(clean)
        (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        return manifest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True)
    parser.add_argument('--request',required=True)
    parser.add_argument('--output-dir',required=True)
    args=parser.parse_args()
    try:
        p=Path(args.request)
        if p.stat().st_size > 2*1024*1024:
            raise ValueError('oversize_request')
        result=generate(args.input,json.loads(p.read_text(encoding='utf-8')),args.output_dir)
        print(json.dumps({'ok':True,'labels':len(result['labels']),'engine':VERSION}))
    except Exception as e:
        # Fixed worker error codes only; paths/library/provider settings are private.
        code=str(e) if isinstance(e,ValueError) and re.fullmatch(r'[a-z_]+(?::[A-Za-z0-9_-]+)?',str(e)) else 'native_worker_failed'
        print(json.dumps({'ok':False,'error':code}))
        sys.exit(1)

if __name__=='__main__':
    main()
