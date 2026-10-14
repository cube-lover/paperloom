const fs=require('fs');fs.mkdirSync('tests/fixtures/flow12',{recursive:true});for(const [a,b] of [['.local/flow12/source.png','source.png'],['.local/flow12/rows-before-group.json','rows.json'],['.local/flow12/ocr.json','ocr.json']])fs.copyFileSync(a,'tests/fixtures/flow12/'+b);
for(const i of [1,3,7])fs.copyFileSync('.local/flow12/masks/'+i+'-source.png','tests/fixtures/flow12/diamond-'+i+'.png');
fs.appendFileSync('tests/test_graphic_ocr.py',`
class FlowRegressionTest(unittest.TestCase):
    def test_faint_borders_and_ocr_padding_recover_all_24_rectangular_nodes(self):
        sys.path.insert(0,str(ROOT / '.local/ocr-runtime'))
        from PIL import Image
        rows=json.loads((ROOT/'tests/fixtures/flow12/rows.json').read_text())
        with Image.open(ROOT/'tests/fixtures/flow12/source.png') as image:
            result=OCR.group_flow_boxes(image,rows)
        nodes=[r for r in result if r.get('flowNode')]
        self.assertEqual(len(nodes),24)
        self.assertEqual(sum(len(r['members']) for r in nodes)+len(result)-len(nodes),len(rows))
        self.assertTrue(all(r['flowEvidence']['version']==2 for r in nodes))
        # Each six multi-line dependency nodes is a complete sentence frame.
        dependencies=[r for r in nodes if 'consideringbuffers' in r['text'].replace(' ','')]
        self.assertEqual(len(dependencies),6)
        self.assertTrue(all(len(r['members'])==3 for r in dependencies))

    def test_coloured_crossing_invalidates_node_interior(self):
        sys.path.insert(0,str(ROOT / '.local/ocr-runtime'))
        from PIL import Image,ImageDraw
        rows=json.loads((ROOT/'tests/fixtures/flow12/rows.json').read_text())
        with Image.open(ROOT/'tests/fixtures/flow12/source.png') as source:
            image=source.convert('RGB')
        ImageDraw.Draw(image).line((905,195,1380,195), fill=(0,100,230),width=2)
        result=OCR.group_flow_boxes(image,rows)
        self.assertFalse(any(r.get('flowNode') and 165<r['polygon'][0][1]<180 for r in result))
`);
fs.appendFileSync('tests/graphic-ink.test.cjs',`
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
`);
fs.appendFileSync('tests/graphic-evidence.test.cjs',`
test('node migration uses ink ownership even when old display padding straddles border',()=>{
 const a={...old(),edited:false,quad:[[5,30],[110,30],[110,1],[5,1]],sourceQuad:q(10)},n={id:'node',pageIndex:2,flowNode:true,text:'Complete node',quad:[[5,24],[110,24],[110,6],[5,6]]};
 const out=E.adoptFlowNode([a],n);assert.equal(out.archived,1);assert.equal(a.target,'人工校订');
});
`);
fs.appendFileSync('tests/graphics.test.cjs',`
test('fallback is invisible at rest but retains reason, tooltip and keyboard access',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);const dom=new JSDOM('<div></div><section></section>');t.after(()=>dom.window.close());const r={...row(),approved:false,background:null},s={rows:[r],replace:true,panel:dom.window.document.querySelector('section'),update(){}};
 const box=app.paintGraphicLabel(s,r,dom.window.document.querySelector('div'),{transform:transforms[0]});assert.equal(box.dataset.mode,'hotspot');assert.ok(box.dataset.fallback);assert.equal(box.style.borderBottom,'0px');assert.equal(box.tabIndex,0);assert.match(box.title,/已有译文/);
});
`);
