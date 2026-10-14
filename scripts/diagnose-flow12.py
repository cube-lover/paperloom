import sys,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'.local/ocr-runtime'))
import cv2,numpy as np
im=cv2.imread(str(root/'.local/flow12/source.png'));grey=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
rows=json.loads((root/'.local/flow12/rows-before-group.json').read_text())
bd=lambda row:[min(p[0] for p in row['polygon']),min(p[1] for p in row['polygon']),max(p[0] for p in row['polygon']),max(p[1] for p in row['polygon'])]
for threshold in [140,180,210]:
 bw=cv2.threshold(grey,threshold,255,cv2.THRESH_BINARY_INV)[1];contours,_=cv2.findContours(bw,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE);boxes=[]
 for c in contours:
  x,y,w,h=cv2.boundingRect(c);p=cv2.approxPolyDP(c,cv2.arcLength(c,True)*.015,True)
  if w<60 or h<30 or w*h>grey.size*.3 or len(p)!=4 or cv2.contourArea(c)<w*h*.93:continue
  if any(abs(x-X)+abs(y-Y)+abs(w-W)+abs(h-H)<20 for X,Y,W,H in boxes):continue
  boxes.append((x,y,w,h))
 print('THRESHOLD',threshold,len(boxes))
 for x,y,w,h in sorted(boxes,key=lambda b:(b[1],b[0])):
  inside=[r for r in rows if (lambda a:a[0]>x+2 and a[2]<x+w-2 and a[1]>y+2 and a[3]<y+h-2)(bd(r))];sub=grey[y+4:y+h-4,x+4:x+w-4];mask=np.zeros(sub.shape,bool)
  for r in inside:
   a=bd(r);l=max(0,int(a[0]-x-6));t=max(0,int(a[1]-y-6));rr=min(sub.shape[1],int(np.ceil(a[2]-x)));bb=min(sub.shape[0],int(np.ceil(a[3]-y)));mask[t:bb,l:rr]=True
  print([x,y,w,h],len(inside),'extraInk',np.count_nonzero((sub<150)&~mask),'bad',[(r['text'],round(r['score'],3),r.get('directionVerified')) for r in inside if r['score']<.94 or not r.get('directionVerified')])
