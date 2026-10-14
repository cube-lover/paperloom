import sys, pathlib, json, importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.local/ocr-runtime'))
import pymupdf as fitz
from PIL import Image
sp=importlib.util.spec_from_file_location('ocr',ROOT/'tools/ocr-image.py'); o=importlib.util.module_from_spec(sp);sp.loader.exec_module(o)
source=ROOT/'.local/dev-channel/archives/f71cc0fd-e16e-4ccd-8a61-bd36ef3423c3/source-428.pdf'
p=fitz.open(source)[11];rect=p.get_image_rects(p.get_images()[0][0])[0];print(rect)
out=ROOT/'.local/flow12';out.mkdir(exist_ok=True)
p.get_pixmap(matrix=fitz.Matrix(3.59259259259,3.59259259259),clip=rect).save(out/'source.png')
orig=o.group_flow_boxes
def group(image,rows):
 (out/'rows-before-group.json').write_text(json.dumps(rows),encoding='utf8')
 return orig(image,rows)
o.group_flow_boxes=group
result=o.recognize(out/'source.png',ROOT/'.local/ocr-runtime',ROOT/'.local/ocr-models')
(out/'ocr.json').write_text(json.dumps(result),encoding='utf8')
print('lines',len(result['lines']),'nodes',sum(bool(r.get('flowNode')) for r in result['lines']))
