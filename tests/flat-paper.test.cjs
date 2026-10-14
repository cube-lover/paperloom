const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHarness}=require('./harness.cjs');
async function setup(t){const h=await createHarness(t);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../addon/content/graphics.js'),'utf8'),h.context,{filename:'graphics.js'});h.context.PaperLoomGraphics.attach(h.app,h.C);return h.app;}
function pixels(rows){const data=new Uint8ClampedArray(rows.flat(2));return {data,width:rows[0].length/4|0,height:rows.length};}
const white=[255,255,255,255],blue=[46,96,190,255],dark=[20,20,20,255];
test('flat paper colour is the lightest dominant colour, coloured bars and glyphs are excluded',async t=>{
  const app=await setup(t);
  assert.equal(app.graphicFlatPaperColor(pixels([[white,white,blue,white],[white,dark,white,blue],[white,white,white,white]])),'rgb(255,255,255)');
  // 彩条过半时也不能把它当纸面：仍然选亮的那一簇。
  assert.equal(app.graphicFlatPaperColor(pixels([[blue,blue,white],[blue,blue,white],[blue,blue,white]])),'rgb(255,255,255)');
  assert.equal(app.graphicFlatPaperColor(pixels([[250,250,246,255],[250,250,246,255]])),'rgb(250,250,246)');
  assert.equal(app.graphicFlatPaperColor({data:new Uint8ClampedArray(0)}),null);
});
