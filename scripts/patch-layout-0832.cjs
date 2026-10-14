const fs=require('fs'),f='addon/content/layout.js';let s=fs.readFileSync(f,'utf8');function once(a,b){if(s.split(a).length!==2)throw Error('not unique '+a);s=s.replace(a,b);}
once("const VERSION='structured-pdf-5';","const VERSION='structured-pdf-6';");
once('  function regionModel(data,operatorList,OPS){',`  function sparseRuledCells(chars,region,rules){
    // Three-rule descriptive inventory tables: rows may have only one or two
    // numeric entries. Use physical cells and row gaps, not dense-table quotas.
    const rows=physicalCells(chars).filter(r=>intersection(r.rect,region.rect)>area(r.rect)*.98);
    if(rows.length<3)return null;
    const nums=rows.flatMap(r=>r.cells).filter(c=>numericCell(c.text));
    if(nums.length<4||rows.filter(r=>r.cells.length>=2).length<3)return null;
    const columns=[];for(const c of nums){const x=(c.rect[0]+c.rect[2])/2;let col=columns.find(a=>Math.abs(a.x-x)<c.fontSize);if(col)col.n++;else columns.push({x,n:1});}
    if(!columns.some(c=>c.n>=3))return null;
    const cells=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],lower=i+1<rows.length?(row.rect[1]+rows[i+1].rect[3])/2:region.rect[1]+1,
        upper=i?(rows[i-1].rect[1]+row.rect[3])/2:region.rect[3]-1;
      for(let j=0;j<row.cells.length;j++){
        const c=row.cells[j];if(numericCell(c.text)||!/[A-Za-z]{3,}/.test(c.text)||/^\\d+(?:\\.\\d+)?\\s*[A-Za-z%]+$/.test(c.text))continue;
        const left=j?(row.cells[j-1].rect[2]+c.rect[0])/2:region.rect[0]+.7,
          right=j+1<row.cells.length?(c.rect[2]+row.cells[j+1].rect[0])/2:region.rect[2]-.7;
        const nearby=rules.filter(r=>r[0]<c.rect[2]&&r[2]>c.rect[0]);
        const bottom=Math.max(lower,c.rect[1]-1.2,...nearby.filter(r=>r[3]<=c.rect[1]).map(r=>r[3]+.5));
        const top=Math.min(upper,c.rect[3]+1.5,...nearby.filter(r=>r[1]>=c.rect[3]).map(r=>r[1]-.5));
        if(bottom>=c.rect[1]||top<=c.rect[3])continue;
        cells.push({text:c.text,inkRect:c.rect,rect:[Math.max(left,c.rect[0]-1),bottom,Math.min(right,c.rect[2]+c.fontSize*3),top],fontSize:c.fontSize,column:j,row:i});
      }
    }
    return cells.length?{...region,role:'text-table',evidence:'sparse-ruled-inventory',cells}:null;
  }
  function regionModel(data,operatorList,OPS){`);
once('      regions.push(r);\n    }\n    return {...drawing,regions,tables:', '      regions.push(sparseRuledCells(data.chars,r,drawing.rules)||r);\n    }\n    return {...drawing,regions,tables:');
once('const captionLabel=t=>t.match(/', 'const captionLabel=t=>t.match(/'); // caption expression handled precisely below
once('(?:[A-Z]\\.?\\s*)?\\d+(?:\\.\\d+)*(?:[a-z])?(?=', '(?:(?:[A-Z]\\.?\\s*)?\\d+(?:\\.\\d+)*(?:[a-z])?|[IVXLCDM]+)(?=');
once("    if(equation||equationTail||line.mathRatio",`    // Display operators and conditional branches are mathematical notation,
    // including Times-font fragments whose PDF mathRatio is zero.
    const mathOperator=/^(?:max|min)\\s+.{0,90}\\(\\d+[a-z]?\\)[,.;]?$/i.test(t)
      ||/^(?:s\\.\\s*t\\.|else|otherwise)\\s*$/i.test(t)
      ||t.length<100&&/\\b(?:else|min|max|if)\\b/i.test(t)&&(/[≤≥<>∑∫]/.test(t)||/[A-Za-z]\\w*\\s*\\([^)]*\\)/.test(t))&&!/\\b(?:the|this|that|we|our|which|where|when|then|and|network)\\b/i.test(t);
    if(mathOperator)return ['formula','display-operator-or-branch'];
    if(equation||equationTail||line.mathRatio`);
fs.writeFileSync(f,s);
