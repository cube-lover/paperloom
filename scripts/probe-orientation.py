import sys,pathlib,json,importlib.util
R=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'.local/ocr-runtime'))
from rapidocr import RapidOCR,OCRVersion,ModelType
from PIL import Image
sp=importlib.util.spec_from_file_location('o',R/'tools/ocr-image.py');o=importlib.util.module_from_spec(sp);sp.loader.exec_module(o)
p={f'{k.title()}.model_path':str(R/'.local/ocr-models'/f'{k}.onnx') for k in ['det','rec','cls']};p.update({'Global.log_level':'critical','Det.ocr_version':OCRVersion.PPOCRV4,'Rec.ocr_version':OCRVersion.PPOCRV4,'Det.model_type':ModelType.MOBILE,'Rec.model_type':ModelType.MOBILE,'EngineConfig.onnxruntime.intra_op_num_threads':2,'EngineConfig.onnxruntime.inter_op_num_threads':1})
e=RapidOCR(params=p)
rows=json.loads((R/'.local/flow12/rows-before-group.json').read_text());im=Image.open(R/'.local/flow12/source.png')
for row in rows:
 if row.get('directionVerified') or len(row['text'])<12:continue
 print('SOURCE',row['text'],row['polygon'],row.get('orientationAgreement'))
 l,t,r,b=o.box_bounds(row['polygon'])
 for pad in [0,2,4]:
  crop=im.crop((int(l)-pad,int(t)-pad,int(r)+pad,int(b)+pad));factor=48/crop.height;crop=crop.resize((round(crop.width*factor),48))
  for a in [0,180]:
   out=e(crop.rotate(a,expand=True),use_det=False,use_cls=False,use_rec=True);print(pad,a,out.txts,out.scores)
