const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./harness.cjs');

test('bootstrap loads all modules, registers resources and cleans up in a simulated host', async t => {
  const { context, Zotero } = await createHarness(t);
  let registered = false, released = false;
  context.fetch = async () => { throw new Error('Network forbidden in bootstrap test'); };
  context.Blob = Blob;
  Zotero.initializationPromise = Promise.resolve(); Zotero.getMainWindows = () => [];
  context.Services.io = { newURI: value => value };
  context.Components.classes['@mozilla.org/addons/addon-manager-startup;1'] = {
    getService: () => ({ registerChrome: () => { registered = true; return { destruct: () => { released = true; } }; } })
  };
  context.Components.interfaces.amIAddonManagerStartup = {};
  const targets = new WeakMap();
  context.Services.scriptloader = { loadSubScript: (uri, target) => {
    if (!targets.has(target)) targets.set(target, vm.createContext(target));
    const name = uri.replace('file:///mock-addon/', '');
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../addon', name), 'utf8'), targets.get(target), { filename: name });
  } };
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../addon/bootstrap.js'), 'utf8'), context, { filename: 'bootstrap.js' });
  await context.startup({ id: 'paperloom@local.research', version: '0.2.0', rootURI: 'file:///mock-addon/' });
  assert.equal(registered, true); assert.equal(typeof Zotero.PaperLoom.summarize, 'function'); assert.ok(Zotero.PaperLoom.config);
  assert.equal(typeof Zotero.PaperLoom.prepareNativeBackgrounds,'function');
  assert.equal(Zotero.PaperLoom.devChannel,undefined);
  await context.shutdown(); assert.equal(released, true); assert.equal(Zotero.PaperLoom, undefined);
});

test('explicit development marker starts mailbox on bootstrap without script-window injection',async t=>{
 const {context,Zotero,dir,IOUtils}=await createHarness(t);context.fetch=async()=>{throw Error('Network forbidden');};context.Blob=Blob;context.setTimeout=()=>1;context.clearTimeout=()=>{};
 Zotero.initializationPromise=Promise.resolve();Zotero.getMainWindows=()=>[];Zotero.Reader._readers=[];context.Services.io={newURI:v=>v};context.Components.interfaces.amIAddonManagerStartup={};context.Components.classes['@mozilla.org/addons/addon-manager-startup;1']={getService:()=>({registerChrome:()=>({destruct(){}})})};
 const targets=new WeakMap(),mailbox=path.join(dir,'dev-mailbox');context.Services.scriptloader={loadSubScript:(uri,target)=>{
  if(!targets.has(target))targets.set(target,vm.createContext(target));const name=uri.replace('file:///mock-addon/','');
  const code=name==='content/dev-build.js'?'var CubeDevelopmentBuild='+JSON.stringify({enabled:true,directory:mailbox})+';':fs.readFileSync(path.resolve(__dirname,'../addon',name),'utf8');vm.runInContext(code,targets.get(target),{filename:name});
 }};
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../addon/bootstrap.js'),'utf8'),context);await context.startup({id:'paperloom@local.research',version:'0.8.14',rootURI:'file:///mock-addon/'});
 assert.ok(Zotero.PaperLoom.devChannel);assert.equal(await IOUtils.exists(path.join(mailbox,'session.json')),true);assert.equal(Zotero.PaperLoom.devChannelError,undefined);
 await context.shutdown();assert.equal(await IOUtils.exists(path.join(mailbox,'session.json')),false);
});
