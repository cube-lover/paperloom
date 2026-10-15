const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const {createHarness}=require('./harness.cjs');const InPlace=require('../addon/content/inplace.js'),L=require('../addon/content/layout.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await delay(5);}throw Error('timeout');}
async function setup(t){const {app,C,context}=await createHarness(t);InPlace.attach(app,C,L);
 // Preserve notice lifetimes: the generic harness compresses timers to 1 ms,
 // which otherwise hides a 12-second notice before the 5-ms assertion poll.
 const fast=context.setTimeout,longTimers=[];context.setTimeout=(fn,ms)=>{if(ms<9000)return fast(fn,ms);const timer=setTimeout(fn,ms);longTimers.push(timer);return timer;};t.after(()=>longTimers.forEach(clearTimeout));
 const dom=new JSDOM('<div class="toolbar" style="overflow:hidden"></div>');t.after(()=>dom.window.close());
 const doc=dom.window.document,reader={itemID:12,_iframeWindow:dom.window};
 const append=n=>doc.querySelector('.toolbar').appendChild(n);app.buildReaderButton(doc,reader,append);
 t.after(()=>{for(const v of [...app.readerButtons?.get(reader)||[]])v.dispose();app.clearInPlace(reader);});
 return {app,reader,doc,button:doc.querySelector('.pl-reader-action button'),append};}
test('first click acknowledges synchronously; second click cancels before PDF startup',async t=>{
 const {app,reader,button}=await setup(t);let calls=0;app.translateInPlace=async()=>{calls++;};
 button.click();assert.equal(button.dataset.state,'starting');assert.match(button.title,/取消/);assert.equal(button.disabled,false);
 button.click();assert.equal(button.dataset.state,'idle');await delay(10);assert.equal(calls,0);assert.equal(app.inplaceActions.size,0);
});
test('cancelled iframe wait releases lock immediately and old completion cannot cancel replacement',async t=>{
 const {app,reader,button}=await setup(t);let release,calls=0;
 app.ensureSecondaryPdfWin=()=>{calls++;return new Promise(r=>release=r);};
 button.click();await until(()=>calls===1);button.click();assert.equal(app.inplaceStarting.size,0);
 button.click();await until(()=>calls===2);const newer=app.inplaceTokens.get(reader);release(null);await delay(10);
 // The first wait remains unresolved; cancellation raced it, so the second startup was permitted.
 assert.ok(newer);assert.equal(button.dataset.state,'error');assert.equal(app.inplaceStarting.size,0);
});
test('startup failure appears inline rather than a blocking alert',async t=>{
 const {app,button,doc}=await setup(t);let alerts=0;app.alert=()=>alerts++;app.ensureSecondaryPdfWin=async()=>{throw Error('PDF 尚未就绪');};
 button.click();await until(()=>button.dataset.state==='error');assert.equal(alerts,0);assert.match(doc.querySelector('.pl-reader-notice').textContent,/PDF/);assert.equal(doc.querySelector('.pl-reader-notice').hidden,false);
});
test('button pause/resume and reveal do not call translate again',async t=>{
 const {app,reader,button}=await setup(t);let translations=0,pumps=0;app.translateInPlace=()=>translations++;
 const s={stage:'ready',workers:1,queue:[],paused:false,hidden:false,pump:()=>pumps++,settle(){},doc:reader._iframeWindow.document,update:()=>app.refreshReaderButton(reader)};
 app.inplace=new Map([[reader,s]]);t.after(()=>app.inplace.clear());
 app.refreshReaderButton(reader);assert.equal(button.dataset.state,'running');button.click();assert.equal(button.dataset.state,'paused');button.click();assert.equal(pumps,1);
 s.workers=0;app.refreshReaderButton(reader);button.click();assert.equal(button.dataset.state,'hidden');button.click();assert.equal(button.dataset.state,'ready');assert.equal(translations,0);
 app.inplace.clear();
});
test('menu escapes clipped toolbar, remains independent during startup and closes on Escape',async t=>{
 const {app,button,doc}=await setup(t);app.translateInPlace=()=>new Promise(()=>{});button.click();
 const caret=doc.querySelector('.pl-menu-button'),menu=doc.querySelector('.pl-reader-menu');caret.click();
 assert.equal(menu.parentNode,doc.body);assert.equal(menu.style.position,'fixed');assert.equal(menu.style.display,'block');assert.equal(caret.getAttribute('aria-expanded'),'true');
 doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(menu.style.display,'none');
});
test('toolbar regeneration disposes old portalled menus and buttons',async t=>{
 const {app,reader,doc,append}=await setup(t);for(let i=0;i<20;i++)app.buildReaderButton(doc,reader,append);
 assert.equal(doc.querySelectorAll('.pl-reader-action').length,1);assert.equal(doc.querySelectorAll('.pl-reader-menu').length,1);assert.equal(app.readerButtons.get(reader).size,1);
});

test('addon update restores an existing reader toolbar exactly once',async t=>{
 const {app}=await createHarness(t);const dom=new JSDOM('<div class=toolbar><div class=end></div></div>');t.after(()=>dom.window.close());const reader={_iframeWindow:dom.window};
 app.ensureReaderButton(reader);app.ensureReaderButton(reader);assert.equal(dom.window.document.querySelectorAll('.pl-main-button').length,1);assert.doesNotThrow(()=>app.ensureReaderButton({get _iframeWindow(){throw Error('dead');}}));
 for(const v of app.readerButtons.get(reader))v.dispose();
});

test('mouse press gives immediate local feedback despite host pointer prevention; release clicks once',async t=>{
 const {app,button,doc}=await setup(t);let calls=0,hostDown=0;app.activateReaderButton=()=>calls++;
 const host=e=>{hostDown++;e.preventDefault();};doc.defaultView.addEventListener('pointerdown',host);
 const down=new doc.defaultView.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0});
 button.dispatchEvent(down);assert.equal(button.classList.contains('pl-pressed'),true);assert.equal(calls,0);assert.equal(hostDown,0);
 button.dispatchEvent(new doc.defaultView.MouseEvent('pointerup',{bubbles:true,button:0}));assert.equal(button.classList.contains('pl-pressed'),false);assert.equal(calls,0);
 button.dispatchEvent(new doc.defaultView.MouseEvent('click',{bubbles:true,detail:1,button:0}));assert.equal(calls,1);
 doc.defaultView.removeEventListener('pointerdown',host);
});
test('double-click does not undo first activation; separate and keyboard clicks remain immediate',async t=>{
 const {app,button,doc}=await setup(t);let calls=0;app.activateReaderButton=()=>calls++;
 const click=detail=>button.dispatchEvent(new doc.defaultView.MouseEvent('click',{bubbles:true,detail,button:0}));
 click(1);assert.equal(calls,1);click(2);assert.equal(calls,1);click(3);assert.equal(calls,1);
 click(1);assert.equal(calls,2);click(0);assert.equal(calls,3);
});
test('pointer cancellation and leaving pressed button reset feedback without activation',async t=>{
 const {app,button,doc}=await setup(t);let calls=0;app.activateReaderButton=()=>calls++;
 for(const end of ['pointercancel','pointerleave']){
  button.dispatchEvent(new doc.defaultView.MouseEvent('pointerdown',{bubbles:true,button:0}));
  button.dispatchEvent(new doc.defaultView.MouseEvent(end,{bubbles:true,button:0}));
  assert.equal(button.classList.contains('pl-pressed'),false);assert.equal(calls,0);
 }
 button.dispatchEvent(new doc.defaultView.MouseEvent('pointerdown',{bubbles:true,button:2}));assert.equal(button.classList.contains('pl-pressed'),false);
});
test('hidden paused or running sessions reveal with one click without dispatching or pausing work',async t=>{
 const {app,reader,button,doc}=await setup(t);let pumps=0,settles=0;
 const viewer=doc.createElement('div');viewer.id='viewer';viewer.className='pl-hide-translations';doc.body.appendChild(viewer);
 const s={stage:'ready',workers:0,queue:[{}],paused:true,hidden:true,pump:()=>pumps++,settle:()=>settles++,doc,update:()=>app.refreshReaderButton(reader)};
 app.inplace=new Map([[reader,s]]);t.after(()=>app.inplace.clear());app.refreshReaderButton(reader);
 assert.equal(button.dataset.state,'hidden');button.click();assert.equal(s.hidden,false);assert.equal(s.paused,true);assert.equal(pumps,0);assert.equal(viewer.classList.contains('pl-hide-translations'),false);
 s.hidden=true;s.paused=false;s.workers=1;app.refreshReaderButton(reader);button.click();assert.equal(s.hidden,false);assert.equal(s.paused,false);assert.equal(pumps,0);assert.equal(settles,0);
 app.inplace.clear();
});
test('caret click opens immediately and ignores the second half of a double-click',async t=>{
 const {doc}=await setup(t),caret=doc.querySelector('.pl-menu-button'),menu=doc.querySelector('.pl-reader-menu');
 for(const detail of [1,2])caret.dispatchEvent(new doc.defaultView.MouseEvent('click',{bubbles:true,detail}));
 assert.equal(menu.style.display,'block');assert.equal(caret.getAttribute('aria-expanded'),'true');
 caret.dispatchEvent(new doc.defaultView.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(menu.style.display,'none');
});

test('custom controls explicitly leave native window drag region and keep stable hit width',async t=>{
 const {doc,button}=await setup(t);assert.match(doc.querySelector('.pl-reader-action style').textContent,/-moz-window-dragging:no-drag/);
 assert.equal(button.style.width,'106px');
});
test('Cube toolbar uses supplied raster icon, compact controls and keeps progress updates from removing the image',async t=>{
 const {app,reader,doc,button}=await setup(t);assert.equal(button.style.height,'24px');assert.equal(button.style.width,'106px');const icon=button.querySelector('img');assert.ok(icon.src.endsWith('content/icon-32.png'));assert.equal(icon.width,18);assert.match(button.textContent,/Cube/);
 app.refreshReaderButton(reader,'test');assert.equal(button.querySelector('img'),icon);assert.equal(button.getAttribute('aria-label'),button.textContent);assert.equal(doc.querySelector('.pl-auto-graphics'),null);
});
