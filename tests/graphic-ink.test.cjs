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

// 用户报"外边框脏、有小黑斑"：带颜色的抗锯齿像素以前既不算墨迹也不被擦。
test('coloured antialias around a glyph is erased while coloured rules stay',()=>{
 const w=60,h=24,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,c)=>data.set([...c,255],(y*w+x)*4);
 for(let y=6;y<16;y++)for(let x=12;x<18;x++)put(x,y,[25,25,25]);           // 字身
 for(let x=10;x<20;x++){put(x,5,[120,140,205]);put(x,16,[120,140,205]);}   // 蓝色抗锯齿边
 for(let y=15;y<17;y++)for(let x=30;x<58;x++)put(x,y,[250,90,10]);         // 远处彩色色带
 const m=I.mask({width:w,height:h,data});
 assert.ok(m&&m.complete,'掩膜要成立');
 assert.deepEqual(Array.from(m.data.slice((5*w+14)*4,(5*w+14)*4+4)),[255,255,255,255],'蓝色抗锯齿要被擦成纸面');
 assert.deepEqual(Array.from(m.data.slice((16*w+14)*4,(16*w+14)*4+4)),[255,255,255,255]);
 assert.deepEqual(Array.from(m.data.slice((15*w+40)*4,(15*w+40)*4+4)),[250,90,10,255],'远处的彩色色带不能被擦');
});

test('isolated neutral specks in a neutral glyph frame are cleaned, long rules are kept',()=>{
 const w=80,h=26,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,c)=>data.set([...c,255],(y*w+x)*4);
 for(let y=8;y<18;y++)for(const l of [10,26,42])for(let x=l;x<l+2;x++)put(x,y,[22,22,22]);
 put(60,20,[30,30,30]);put(61,20,[30,30,30]);put(60,21,[30,30,30]);         // 孤立 3px 暗点
 for(let x=0;x<w;x++)put(x,24,[180,180,180]);                              // 长灰线
 const m=I.mask({width:w,height:h,data});
 assert.ok(m&&m.complete);
 assert.deepEqual(Array.from(m.data.slice((20*w+60)*4,(20*w+60)*4+4)),[255,255,255,255],'孤立暗点要被清掉');
 assert.deepEqual(Array.from(m.data.slice((24*w+30)*4,(24*w+30)*4+4)),[180,180,180,255],'长直线要保留');
});

// 近纸面的文字框整块铺纸面色，带受保护长线的框仍只擦字形。
test('near-paper text frames are filled flat while protected rules survive',()=>{
 const w=90,h=28,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,c)=>data.set([...c,255],(y*w+x)*4);
 for(let y=9;y<19;y++)for(const l of [12,30,48])for(let x=l;x<l+2;x++)put(x,y,[25,25,25]);
 put(70,10,[90,130,200]);put(71,10,[90,130,200]);put(70,11,[90,130,200]);   // 零星彩色碎片
 const flat=I.mask({width:w,height:h,data},{flatFill:true});
 assert.ok(flat&&flat.flat,'近纸面文字框要走整块铺');
 assert.deepEqual(Array.from(flat.data.slice((10*w+70)*4,(10*w+70)*4+4)),[90,130,200,255],'远处彩色小标记不是已验证字形，必须保留');
 assert.deepEqual(Array.from(flat.data.slice((14*w+12)*4,(14*w+12)*4+4)),[255,255,255,255],'英文要不见');
 const d2=new Uint8ClampedArray(data);for(let x=0;x<w;x++)d2.set([180,180,180,255],(24*w+x)*4);
 const ruled=I.mask({width:w,height:h,data:d2},{flatFill:true});
 assert.ok(ruled&&ruled.flat,'表格框要走铺平');
 assert.deepEqual(Array.from(ruled.data.slice((24*w+40)*4,(24*w+40)*4+4)),[180,180,180,255],'表格线要保留');
 assert.deepEqual(Array.from(ruled.data.slice((14*w+12)*4,(14*w+12)*4+4)),[255,255,255,255],'框里的文字碎片一起铺掉');
 const band=new Uint8ClampedArray(data);for(let x=0;x<w;x++)for(let y=0;y<3;y++)band.set([230,40,60,255],((1+y)*w+x)*4);
 const keepColour=I.mask({width:w,height:h,data:band},{flatFill:true});
 assert.ok(keepColour&&!keepColour.flat,'整条彩条在框里时不能铺平');
 assert.deepEqual(Array.from(keepColour.data.slice((2*w+50)*4,(2*w+50)*4+4)),[230,40,60,255],'彩条要保留');
});
