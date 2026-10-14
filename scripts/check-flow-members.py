exec(open(__file__.replace('check-flow-members.py','diagnose-flow12.py'),encoding='utf8').read().split('for threshold')[0])
bw=cv2.threshold(grey,210,255,cv2.THRESH_BINARY_INV)[1];contours,_=cv2.findContours(bw,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
boxes=[]
for c in contours:
 x,y,w,h=cv2.boundingRect(c);p=cv2.approxPolyDP(c,cv2.arcLength(c,True)*.015,True)
 if w<60 or h<30 or w*h>grey.size*.3 or len(p)!=4 or cv2.contourArea(c)<w*h*.93:continue
 if any(abs(x-X)+abs(y-Y)+abs(w-W)+abs(h-H)<20 for X,Y,W,H in boxes):continue
 boxes.append((x,y,w,h))
for x,y,w,h in sorted(boxes,key=lambda b:(b[1],b[0])):
 inside=[r for r in rows if (lambda a:(a[0]+a[2])/2>x+2 and (a[0]+a[2])/2<x+w-2 and (a[1]+a[3])/2>y+2 and (a[1]+a[3])/2<y+h-2)(bd(r))];sub=grey[y+2:y+h-2,x+2:x+w-2];mask=np.zeros(sub.shape,bool)
 for r in inside:
  a=bd(r);l=max(0,int(a[0]-x-4));t=max(0,int(a[1]-y-4));rr=min(sub.shape[1],int(np.ceil(a[2]-x)));bb=min(sub.shape[0],int(np.ceil(a[3]-y)));mask[t:bb,l:rr]=True
 print([x,y,w,h],len(inside),'extraInk',np.count_nonzero((sub<150)&~mask),'borderMin',min(sub[0,:].min(),sub[-1,:].min(),sub[:,0].min(),sub[:,-1].min()),'bad',[(r['text'],round(r['score'],3),r.get('directionVerified')) for r in inside if r['score']<.94 or not r.get('directionVerified')])
