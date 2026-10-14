const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../addon/content/graphic-ink.js'),G=require('../addon/content/graphics.js');
test('glyph mask preserves coloured curve and long grey dashed rules',()=>{const w=100,h=30,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,c)=>data.set([...c,255],(y*w+x)*4);for(let x=0;x<w;x++){put(x,24,[180,180,180]);put(x,26,[250,90,10]);}for(const l of [10,22,34]){for(let y=7;y<18;y++)for(let x=l;x<l+2;x++)put(x,y,[20,20,20]);for(let x=l;x<l+7;x++)for(let y=16;y<18;y++)put(x,y,[20,20,20]);}const m=I.mask({width:w,height:h,data});assert.ok(m.glyphs>=3);assert.ok(m.erased>0);for(let x=0;x<w;x++){assert.deepEqual(Array.from(m.data.slice((24*w+x)*4,(24*w+x)*4+4)),[180,180,180,255]);assert.deepEqual(Array.from(m.data.slice((26*w+x)*4,(26*w+x)*4+4)),[250,90,10,255]);}});
test('uncertain OCR stays displayable for machine-reviewed rows while skew and missing evidence do not',()=>{const row={text:'Score',target:'得分',quad:G.quad([0,0,50,12]),origin:'OCR',score:.8,review:true,directionVerified:true};assert.equal(G.replacementReason(row,[]),'');assert.equal(G.replacementReason({...row,inkValidated:true},[]),'');assert.equal(G.replacementReason({...row,quad:[[0,0],[50,0],[55,12],[0,12]]},[]),'斜切标签定位待核对');assert.equal(G.replacementReason({...row,target:''},[]),'尚未翻译');});

test('uniform neutral island erases all antialias shades but preserves its grey background',()=>{const w=100,h=30,data=new Uint8ClampedArray(w*h*4);for(let n=0;n<w*h;n++)data.set([235,235,235,255],n*4);for(const l of [10,25,40])for(let y=8;y<21;y++)for(let x=l;x<l+8;x++)data.set([x===l?215:20,x===l?215:20,x===l?215:20,255],(y*w+x)*4);const m=I.mask({width:w,height:h,data});assert.ok(m.uniform);assert.equal(m.background,235);assert.equal(m.data[(10*w+10)*4],235);assert.equal(m.data[(10*w+10)*4+3],255);});

test('dark-core corner-dash fallback rejects long faint gridlines',()=>{
 const w=230,h=30,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,v)=>data.set([v,v,v,255],(y*w+x)*4);
 for(let x=0;x<w;x++)put(x,14,195);
 for(let l=10;l<180;l+=20)for(let y=6;y<23;y++)for(let x=l;x<l+4;x++)put(x,y,20);
 assert.equal(I.mask({width:w,height:h,data},{edgeDashes:true}),null);
});
test('tall isolated I glyph is text, not a vertical rule',()=>{
 const w=100,h=50,data=new Uint8ClampedArray(w*h*4).fill(238);
 for(let n=3;n<data.length;n+=4)data[n]=255;
 for(let y=10;y<38;y++)for(let x=20;x<22;x++)data.set([15,15,15,255],(y*w+x)*4);
 const m=I.mask({width:w,height:h,data});assert.ok(m?.uniform);
});
test('real diamond borders retain pixels while old letter cores disappear',{skip:!require('fs').existsSync(require('path').join(__dirname,'../.local/native-render-runtime/node_modules/@napi-rs/canvas'))},async()=>{
 const cv=require('../.local/native-render-runtime/node_modules/@napi-rs/canvas'),path=require('path');
 for(const id of [1,3,7]){const im=await cv.loadImage(path.join(__dirname,'fixtures/flow12/diamond-'+id+'.png')),c=cv.createCanvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);const before=x.getImageData(0,0,c.width,c.height),m=I.mask(before)||I.mask(before,{edgeDashes:true});assert.ok(m?.complete);const w=c.width,h=c.height;
 // Top/bottom two rows are dashed borders, independent from the letter cores.
 for(const y of [0,1,h-2,h-1])for(let xx=0;xx<w;xx++)assert.deepEqual(Array.from(m.data.slice((y*w+xx)*4,(y*w+xx)*4+4)),Array.from(before.data.slice((y*w+xx)*4,(y*w+xx)*4+4)));
 let residual=0;for(let y=4;y<h-5;y++)for(let xx=2;xx<w-2;xx++)if(m.data[(y*w+xx)*4]<180)residual++;assert.equal(residual,0);
 }
});
