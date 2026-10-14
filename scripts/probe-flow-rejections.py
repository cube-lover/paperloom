import sys,pathlib,importlib.util,json
R=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'.local/ocr-runtime'))
from PIL import Image
sp=importlib.util.spec_from_file_location('o',R/'tools/ocr-image.py');o=importlib.util.module_from_spec(sp);sp.loader.exec_module(o)
rows=json.loads((R/'.local/flow12/rows-before-group.json').read_text())
def trace(frame,event,arg):
 if frame.f_code.co_name=='group_flow_boxes' and event=='line' and frame.f_lineno in [176,179,180,181,184,186,193,194,196,199,200,203]:
  v=frame.f_locals
  if v.get('y',0)>750 and v.get('y',0)<765 and v.get('x',999)<100:
   print(frame.f_lineno,{k:v[k] for k in ['x','y','w','h','frame','bg'] if k in v})
   if 'border' in v:print('border',v['border'].min(), len(v['border']),sum(abs(v['border'].astype(int)-v.get('bg',255))>15))
 return trace
sys.settrace(trace);out=o.group_flow_boxes(Image.open(R/'.local/flow12/source.png'),rows);sys.settrace(None)
print('members',[(r['text'],r.get('directionVerified'),r.get('directionMargin'),r.get('textConfirmed')) for r in rows if r['text'].startswith(('Update OlL','Is it'))])
