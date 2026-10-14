const fs=require('fs');const f='addon/content/graphics.js';let s=fs.readFileSync(f,'utf8');function once(a,b){if(s.split(a).length!==2)throw Error('Not unique '+a);s=s.replace(a,b);}once('flowNode:!!line.flowNode,members:line.members||null,inkRefined','flowNode:!!line.flowNode,flowEvidence:line.flowEvidence||null,members:line.members||null,inkRefined');
once('row.background=iw>0&&ih>0?plainBackground(ctx.getImageData(ix,iy,iw,ih),{textBounds}):null;',`row.background=iw>0&&ih>0?plainBackground(ctx.getImageData(ix,iy,iw,ih),{textBounds}):null;
          // Verify the complete node interior, not sparse word-sized strips.
          if(row.flowNode&&row.flowEvidence?.version===2&&iw>0&&ih>0&&typeof CubeGraphicInk!=='undefined'){
            const m=CubeGraphicInk.mask(ctx.getImageData(ix,iy,iw,ih));if(m?.uniform&&Math.abs(m.background-row.flowEvidence.background)<=3)row.background='rgb('+[m.background,m.background,m.background].join(',')+')';
          }`);
const a='cx.setTransform(scale*inv[0]/sx,scale*inv[1]/sx,scale*inv[2]/sy,scale*inv[3]/sy,scale*inv[4],scale*inv[5]);';if(s.split(a).length!==3)throw Error('Expected two sampling transforms');s=s.replaceAll(a,'cx.setTransform(cv.width/p.width*inv[0]/sx,cv.height/p.height*inv[1]/sx,cv.width/p.width*inv[2]/sy,cv.height/p.height*inv[3]/sy,cv.width/p.width*inv[4],cv.height/p.height*inv[5]);');
once('row.inkPatch={version:4,quad:JSON.stringify(row.quad),url:cv.toDataURL()};','row.inkPatch={version:5,quad:JSON.stringify(row.quad),uniform:!!m.uniform,background:m.background,url:cv.toDataURL()};');
once('row.inkPatch?.version===4','row.inkPatch?.version===5');
once("if(fits){box.style.background=nativePatch?'transparent':row.background||'transparent';if(nativePatch||mask)","if(fits){box.style.background=nativePatch?'transparent':row.background||'transparent';if(!nativePatch&&row.inkPatch?.version===5&&row.inkPatch?.uniform&&mask){box.style.background='rgb('+Array(3).fill(row.inkPatch.background).join(',')+')';mask=null;}if(nativePatch||mask)");
once("if(box.dataset.mode!=='replace'){box.dataset.mode='hotspot';box.style.borderBottom='.5px dotted #1684bb';","if(box.dataset.mode!=='replace'){box.dataset.mode='hotspot';");
once('这里查看进度、蓝线原因和校订。蓝色虚线表示已有译文但原位显示尚未通过检查；悬停查看原因与中文。','这里查看进度、未覆盖原因和校订。未通过原位检查的区域保持原图，不再常驻蓝色虚线；悬停或键盘聚焦查看原因与中文。');
fs.writeFileSync(f,s);
