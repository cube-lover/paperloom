/* Deterministic neutral-background text masks; never synthesize curves or rules. */
var CubeGraphicInk;
(function(root){'use strict';
 function mask(image,{edgeDashes=false}={}){
  const {width:w,height:h,data}=image;if(w<5||h<5)return null;
  const histogram=new Uint32Array(256),grey=new Uint8Array(w*h),neutral=new Uint8Array(w*h);
  for(let n=0;n<w*h;n++){const j=n*4,hi=Math.max(data[j],data[j+1],data[j+2]),lo=Math.min(data[j],data[j+1],data[j+2]);grey[n]=Math.round((hi+lo)/2);if(hi-lo<18&&data[j+3]>250){neutral[n]=1;if(lo>=180)histogram[grey[n]]++;}}
  let bg=255;for(let k=180;k<256;k++)if(histogram[k]>histogram[bg])bg=k;
  let paper=0;for(let k=Math.max(180,bg-3);k<=Math.min(255,bg+3);k++)paper+=histogram[k];let border=0,cleanBorder=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1){border++;if(neutral[y*w+x]&&Math.abs(grey[y*w+x]-bg)<12)cleanBorder++;}if(paper<w*h*.15||cleanBorder<border*.8)return null;
  // Separate dark glyph cores from light antialias bridges to dashed borders.
  const ink=n=>neutral[n]&&grey[n]<bg-(edgeDashes?80:30),seen=new Uint8Array(w*h),components=[];
  for(let n=0;n<w*h;n++){
   if(seen[n]||!ink(n))continue;seen[n]=1;const stack=[n],pixels=[];let l=w,t=h,r=0,b=0;
   while(stack.length){const a=stack.pop(),x=a%w,y=Math.floor(a/w);pixels.push(a);l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx>=0&&yy>=0&&xx<w&&yy<h&&!seen[k]&&ink(k)){seen[k]=1;stack.push(k);}}}
   components.push({pixels,l,t,r,b});
  }
  const protectedInk=new Uint8Array(w*h),glyphs=[];
  // The dark-core pass is only for tiny labels with corner dashes. Faint
  // long plot rules must still veto it, even when darker letters cross them.
  if(edgeDashes){
   if(bg<250||h>w*.25||!neutral.every(Boolean))return null;
   for(let y=0;y<h;y++){let run=0;for(let x=0;x<w;x++){run=grey[y*w+x]<bg-30?run+1:0;if(run>Math.max(12,w*.75))return null;}}
   for(let x=0;x<w;x++){let run=0;for(let y=0;y<h;y++){run=grey[y*w+x]<bg-30?run+1:0;if(run>Math.max(18,h*.9))return null;}}
  }
  for(const c of components){const cw=c.r-c.l+1,ch=c.b-c.t+1;
   let maxRow=0,maxCol=0;const yy=new Uint32Array(ch),xx=new Uint32Array(cw);for(const n of c.pixels){maxRow=Math.max(maxRow,++yy[Math.floor(n/w)-c.t]);maxCol=Math.max(maxCol,++xx[n%w-c.l]);}
   const edgeDash=edgeDashes&&bg>=250&&ch<=Math.max(2,h*.16)&&cw>=3&&cw/ch>=1.7&&(c.t<=1||c.b>=h-2)&&(c.l<w*.12||c.r>w*.88);
   const rule=edgeDash||(cw/ch>5&&cw>12&&maxRow>cw*.92)||(ch/cw>8&&ch>18&&maxCol>ch*.92&&(c.t===0||c.b===h-1));
   if(rule){c.edgeDash=edgeDash;for(const n of c.pixels)protectedInk[n]=1;continue;}
   if((c.l===0||c.r===w-1)&&(c.t===0||c.b===h-1))return null;
   glyphs.push(c);
  }
  if(!glyphs.some(c=>c.pixels.length>=4))return null;
  if(edgeDashes){const ds=components.filter(c=>c.edgeDash);if(ds.length<3||!ds.some(c=>c.l<w*.12)||!ds.some(c=>c.r>w*.88)||glyphs.filter(c=>c.b-c.t>h*.25).length<3)return null;}
  // A long stroke sharing a text row may actually be a blurred word. Reject
  // rather than erase a tiny fragment and leave the rest of the English visible.
  if(components.some(c=>!c.edgeDash&&c.pixels.some(n=>protectedInk[n])&&glyphs.some(g=>Math.min(c.b,g.b)>=Math.max(c.t,g.t))))return null;
  // Retain the entire raster halo around verified rules, not just dark cores.
  // If a glyph core intersects that halo the source is genuinely ambiguous.
  const ruleHalo=new Uint8Array(protectedInk);
  for(let n=0;n<w*h;n++)if(protectedInk[n]){const x=n%w,y=Math.floor(n/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h)ruleHalo[yy*w+xx]=1;}}
  if(edgeDashes){
   // Recover lighter disconnected dash samples from the same corner corridor;
   // antialiasing can leave a dash with no core below the dark threshold.
   for(let n=0;n<w*h;n++){const x=n%w,y=Math.floor(n/w);if((y<=1||y>=h-2)&&(x<w*.15||x>w*.85))ruleHalo[n]=1;}
  }
  if(glyphs.some(c=>c.pixels.some(n=>ruleHalo[n])))return null;
  const out=new Uint8ClampedArray(data);let erased=0;
  const changed=new Uint8Array(w*h);
  // A fully neutral, rule-free island with a uniform paper border is an
  // independently verified text frame. Fill it consistently so zoom-dependent
  // PDF antialiasing cannot leak the old English around a sparse high-res mask.
  const uniform=neutral.every(Boolean)&&!protectedInk.some(Boolean)&&cleanBorder>=border*.9;
  if(uniform){for(let n=0;n<w*h;n++){out[n*4]=out[n*4+1]=out[n*4+2]=bg;out[n*4+3]=255;}return {width:w,height:h,data:out,glyphs:glyphs.length,erased:w*h,background:bg,uniform:true};}
  for(const c of glyphs)for(const n of c.pixels){const x=n%w,y=Math.floor(n/w);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy,k=yy*w+xx,j=k*4;if(xx<0||yy<0||xx>=w||yy>=h||!neutral[k]||ruleHalo[k])continue;
    // An ambiguous coloured crossing invalidates the mask rather than whitening it.
    if(!changed[k])erased++;changed[k]=1;out[j]=out[j+1]=out[j+2]=bg;out[j+3]=255;
   }
  }
  return {width:w,height:h,data:out,glyphs:glyphs.length,erased,background:bg,complete:true};
 }
 CubeGraphicInk={mask};root.CubeGraphicInk=CubeGraphicInk;if(typeof module==='object'&&module.exports)module.exports=CubeGraphicInk;
})(globalThis);
