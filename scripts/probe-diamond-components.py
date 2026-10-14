import sys,pathlib
R=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'.local/ocr-runtime'))
import cv2
for i in [1,3,7]:
 im=cv2.imread(str(R/f'.local/flow12/masks/{i}-source.png'),0);h,w=im.shape
 n,lab,stats,c=cv2.connectedComponentsWithStats((im<225).astype('uint8'),8)
 print(i,w,h)
 for x,y,cw,ch,p in stats[1:]:
  if x==0 or y==0 or x+cw==w or y+ch==h: print('edge',x,y,cw,ch,p)
