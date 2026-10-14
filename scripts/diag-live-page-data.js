/* Read only structured PDF data for the currently observed item 381. */
var PaperLoomLivePagesPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,r=Zotero.Reader._readers.find(r=>r.itemID===381),s=app.inplace.get(r);
 if(!s)throw Error('Observed session missing');const pages=[],operators=[];
 for(let i=0;i<s.pdf.numPages;i++){
  const data=h.Components.utils.waiveXrays(await s.pdf.getPageData(h.Components.utils.cloneInto({pageIndex:i},s.win)));
  pages.push({pageIndex:i,viewBox:Array.from(data.viewBox),chars:Array.from(data.chars,c=>({c:c.c,u:c.u,rect:Array.from(c.rect),fontSize:c.fontSize,baseline:c.baseline,fontName:c.fontName,bold:c.bold,italic:c.italic,rotation:c.rotation,spaceAfter:c.spaceAfter,ignorable:c.ignorable,lineBreakAfter:c.lineBreakAfter,paragraphBreakAfter:c.paragraphBreakAfter}))});
  operators.push(await app.readOperatorGeometry(await s.pdf.getPage(i+1)));
 }
 const outlineData=await s.pdf.getOutline();const titles=items=>Array.from(items||[],n=>({title:String(n.title||''),items:titles(n.items)}));
 const report={pages,operators,outline:titles(outlineData)};
 await h.IOUtils.writeUTF8('D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\.local\\live-page-data.json',JSON.stringify(report));return {pages:pages.length};
})();
