/* Offline use of the inspected Zotero PDF.js renderer, not a host UI test. */
const fs=require('node:fs/promises'),path=require('node:path'),url=require('node:url'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),N=require('../addon/content/native-background.js'),L=require('../addon/content/layout.js');
const canvas=require('../.local/native-render-runtime/node_modules/@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,ImageData:canvas.ImageData,Path2D:canvas.Path2D});
class CanvasFactory {create(w,h){const c=canvas.createCanvas(w,h);return {canvas:c,context:c.getContext('2d')};}reset(x,w,h){x.canvas.width=w;x.canvas.height=h;}destroy(x){x.canvas.width=0;x.canvas.height=0;}}
(async()=>{
 const out=path.join(ROOT,'validation/native-pdfjs-'+Date.now());await fs.mkdir(out,{recursive:true});
 const source=path.resolve(ROOT,'../paperloom-review/fit-study/gpt3-public.pdf');
 const python='D:/Users/Administrator/Pi-Agent/home/tools/uv/zotero-mcp-server/Scripts/python.exe';
 const prep=`import pathlib,json,hashlib,pymupdf as f\np=pathlib.Path(${JSON.stringify(source)});d=f.open(p);page=d[18];inv=~page.transformation_matrix\nlabels=[{'id':'label'+str(i),'text':'Fine-tuned SOTA','sourceQuad':[list(pt*inv) for pt in [r.tl,r.tr,r.br,r.bl]]} for i,r in enumerate(page.search_for('Fine-tuned SOTA'))]\npathlib.Path(${JSON.stringify(path.join(out,'request.json'))}).write_text(json.dumps({'version':1,'sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'pageIndex':18,'labels':labels}),encoding='utf8')`;
 let run=cp.spawnSync(python,['-c',prep],{encoding:'utf8'});if(run.status)throw Error(run.stderr);
 run=cp.spawnSync(python,[path.join(ROOT,'tools/native-background.py'),'--input',source,'--request',path.join(out,'request.json'),'--output-dir',path.join(out,'artifact')],{encoding:'utf8'});if(run.status)throw Error(run.stdout);
 const pdfjs=await import(url.pathToFileURL(path.join(ROOT,'.local/magic-analysis/zotero/pdf.mjs')));
 pdfjs.GlobalWorkerOptions.workerSrc=url.pathToFileURL(path.join(ROOT,'.local/magic-analysis/zotero/pdf.worker.mjs')).href;
 const load=async f=>pdfjs.getDocument({data:new Uint8Array(await fs.readFile(f)),CanvasFactory,disableFontFace:true,isEvalSupported:false,enableXfa:false,useSystemFonts:false,useWasm:false});
 const tasks=[];const render=async(f,n)=>{const task=await load(f);tasks.push(task);const d=await task.promise,p=await d.getPage(n),vp=p.getViewport({scale:2,rotation:0}),cv=canvas.createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await p.render({canvas:cv,canvasContext:cv.getContext('2d'),viewport:vp,annotationMode:0}).promise;return {cv,vp,image:cv.getContext('2d').getImageData(0,0,cv.width,cv.height)};};
 const report={scope:'offline Zotero PDF.js modules with Node canvas; not installed-host validation',renderer:pdfjs.version,passed:false};
 try{
  const a=await render(source,19),b=await render(path.join(out,'artifact/original.pdf'),1),c=await render(path.join(out,'artifact/clean.pdf'),1),m=JSON.parse(await fs.readFile(path.join(out,'artifact/manifest.json'),'utf8'));
  const rects=m.labels.map(l=>L.mapRect(Array.from(c.vp.transform),l.eraseRect));report.original=N.pixelAudit(a.image,b.image,[]);report.rawErase=N.pixelAudit(b.image,c.image,rects);const composed=N.composeLocal(a.image,c.image,rects);report.erase=N.pixelAudit(a.image,composed,rects);const cv=canvas.createCanvas(composed.width,composed.height),im=cv.getContext('2d').createImageData(composed.width,composed.height);im.data.set(composed.data);cv.getContext('2d').putImageData(im,0,0);await fs.writeFile(path.join(out,'composite.png'),cv.toBuffer('image/png'));
  report.geometry=JSON.stringify(a.vp.transform)===JSON.stringify(b.vp.transform)&&JSON.stringify(b.vp.transform)===JSON.stringify(c.vp.transform);
  report.passed=report.geometry&&report.original.passed&&report.erase.passed;
  for(const [name,x]of [['source',a],['unchanged',b],['clean',c]])await fs.writeFile(path.join(out,name+'.png'),x.cv.toBuffer('image/png'));
 }finally{for(const t of tasks)await t.destroy();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({directory:out,...report},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
