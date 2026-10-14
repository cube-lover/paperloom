"""Independent, read-only-source verification of native-text removal.
Uses installed PyMuPDF; writes isolated evidence only, never the Zotero library.
No translation API, model download or upstream application execution.
"""
from pathlib import Path
import hashlib
import json
import time
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'paperloom-review/fit-study/gpt3-public.pdf'
OUT = ROOT / 'validation/native-background-proof'
OUT.mkdir(parents=True, exist_ok=True)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def render(page):
    return page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False, annots=False)


def image_hashes(doc, page):
    return [digest(doc.extract_image(img[0])['image']) for img in page.get_images()]


def numeric_tokens(page):
    return [w[4] for w in page.get_text('words') if any(c.isdigit() for c in w[4])]


def drawing_hash(page):
    # Includes path geometry, colour, width, dash pattern, fill, etc.; seqno can
    # legitimately change when text operations are removed.
    paths = [{k: str(v) for k, v in item.items() if k != 'seqno'} for item in page.get_drawings()]
    return digest(json.dumps(paths, sort_keys=True).encode())


def differences(a, b, rects=()):
    assert (a.width, a.height, a.n) == (b.width, b.height, b.n)
    aa, bb, n = a.samples, b.samples, a.n
    allowed = [(r * fitz.Matrix(2, 2)).irect for r in rects]
    total = outside = 0
    for pos in range(0, len(aa), n):
        if aa[pos:pos+n] == bb[pos:pos+n]:
            continue
        total += 1
        pixel = pos // n
        x, y = pixel % a.width, pixel // a.width
        if not any(r.x0 - 2 <= x < r.x1 + 2 and r.y0 - 2 <= y < r.y1 + 2 for r in allowed):
            outside += 1
    return {'changedPixels': total, 'changedOutsideTargetsWith2pxMargin': outside}


def erase(page, rects):
    for rect in rects:
        page.add_redact_annot(rect, fill=False, cross_out=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                          text=fitz.PDF_REDACT_TEXT_REMOVE)


def synthetic(labels):
    doc = fitz.open()
    p = doc.new_page(width=420, height=220)
    p.draw_rect(p.rect, fill=(.96, .96, .96), color=None)
    p.draw_line((20, 80), (400, 80), color=(.55, .55, .55), width=1, dashes='[4 3]')
    p.draw_polyline([(20, 170), (90, 130), (160, 150), (250, 80), (390, 40)], color=(.1, .4, .9), width=2)
    p.insert_text((330, 200), '90 175B', fontsize=10)
    if labels:
        p.insert_text((50, 84), 'Fine-tuned SOTA', fontsize=12)
        p.insert_text((35, 180), 'Accuracy', fontsize=10, rotate=90)
    return doc


def main():
    start = time.perf_counter()
    original_sha = digest(SOURCE.read_bytes())
    report = {'engine': 'PyMuPDF', 'version': fitz.VersionBind, 'sourceSHA256': original_sha,
              'scope': 'standalone background removal, not an installed plugin test',
              'providerRequests': 0, 'modelRuns': 0}
    with synthetic(True) as labeled, synthetic(False) as truth:
        p = labeled[0]
        rects = [r for text in ('Fine-tuned SOTA', 'Accuracy') for r in p.search_for(text)]
        erase(p, rects)
        diff = differences(render(p), render(truth[0]))
        report['synthetic'] = {'removedCount': len(rects), 'remainingText': p.get_text(),
                               **diff, 'exactBackgroundMatch': diff['changedPixels'] == 0}
        render(p).save(OUT / 'synthetic-clean.png')

    with fitz.open(SOURCE) as source:
        report['pageCount'] = len(source)
        with fitz.open() as doc:
            doc.insert_pdf(source, from_page=18, to_page=18)
            p = doc[0]
            before = render(p)
            nums, drawings, images = numeric_tokens(p), drawing_hash(p), image_hashes(doc, p)
            rects = p.search_for('Fine-tuned SOTA')
            erase(p, rects)
            after = render(p)
            report['page19'] = {'removedCount': len(rects), 'targetStillPresent': bool(p.search_for('Fine-tuned SOTA')),
                                'numericTokensUnchanged': nums == numeric_tokens(p),
                                'drawingGeometryAndStyleUnchanged': drawings == drawing_hash(p),
                                'imageHashesUnchanged': images == image_hashes(doc, p),
                                **differences(before, after, rects)}
            before.save(OUT / 'page19-before.png')
            after.save(OUT / 'page19-clean.png')
            doc.save(OUT / 'page19-clean.pdf')
        p = source[19]
        regions = []
        for info in p.get_image_info(xrefs=True):
            r = fitz.Rect(info['bbox'])
            regions.append({'pixelSize': [info['width'], info['height']], 'bboxTopLeft': list(r),
                            'nativeTextWithin': p.get_text(clip=r).strip(),
                            'scale2Pixels': [round(r.width * 2), round(r.height * 2)]})
        report['page20Images'] = regions
        # Carrier inventory for the reported defects; not a structure-model result.
        report['nativeCarrierChecks'] = [
            {'page': 38, 'religionCellsFound': {s: len(source[37].search_for(s)) for s in
                ['Atheism', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Judaism']}},
            {'page': 48, 'smallTableHeadersFound': {s: len(source[47].search_for(s)) for s in
                ['Participants', 'Recruited', 'Excluded', 'Genders', 'Mean', 'Average']}},
            {'page': 49, 'poemHeadersFound': {s: len(source[48].search_for(s)) for s in
                ['Generated Poem 1', 'Generated Poem 2', 'Generated Poem 3', 'Generated Poem 4']}}
        ]
    report['sourceFileUnchanged'] = digest(SOURCE.read_bytes()) == original_sha
    p = report['page19']
    report['passed'] = (report['sourceFileUnchanged'] and report['synthetic']['exactBackgroundMatch']
                        and p['removedCount'] == 2 and not p['targetStillPresent']
                        and p['numericTokensUnchanged'] and p['drawingGeometryAndStyleUnchanged']
                        and p['imageHashesUnchanged'] and p['changedOutsideTargetsWith2pxMargin'] == 0)
    report['seconds'] = round(time.perf_counter() - start, 3)
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
