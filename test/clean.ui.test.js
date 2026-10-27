// Real-UI test of the Excel cleaner (jsdom): node test/clean.ui.test.js   (needs: npm i jsdom xlsx)
const {JSDOM}=require('jsdom'),X=require('xlsx'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),R=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=R('src/clean.src.html').replace('/*CLEANVAL*/',()=>R('src/clean-values.js')).replace(/<script src=[^>]*><\/script>/g,'').replace(/<script>window\.XLSX\|\|[^<]*<\/script>/,'');
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n,c?'':(x||''))};
const rep=(v,n)=>Array(n).fill(v);
function mk(rows,head,extra){const wb=X.utils.book_new(),ws=X.utils.aoa_to_sheet([head,...rows]);if(extra)extra(ws);X.utils.book_append_sheet(wb,ws,'Data');return X.write(wb,{type:'buffer',bookType:'xlsx'})}
async function open(buf,name){
 const errs=[];const d=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,beforeParse(w){
  w.XLSX=Object.assign({},X,{read:(a,o)=>X.read(typeof a==='string'?a:Buffer.from(new Uint8Array(a)),Object.assign({},o,{type:typeof a==='string'?o.type:'buffer'})),write:(wb,o)=>X.write(wb,Object.assign({},o,{type:o.type==='array'?'buffer':o.type})),writeFile:(wb,nm)=>{w.__saved=[wb,nm]}});
  w.addEventListener('error',e=>errs.push(e.message));w.HTMLElement.prototype.scrollIntoView=function(){}}});
 const w=d.window,f=new w.File([buf],name),inp=w.document.querySelector('#fi');
 Object.defineProperty(inp,'files',{value:[f],configurable:true});inp.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,500));return{w,errs}}
const q=(w,s)=>w.document.querySelector(s),qa=(w,s)=>[...w.document.querySelectorAll(s)];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 // ---- S1: a customer list with case variants AND a typo
 const city=[...rep('Delhi',30),...rep('delhi',2),'Mumbay',...rep('Mumbai',25),...rep('Jaipur',15),'Jaipur '];
 const rows=city.map((c,i)=>[1001+i,'Cust '+i,c,100+i,'Paid']);
 let {w,errs}=await open(mk(rows,['Order ID','Customer','City','Amount','Status']),'sales.xlsx');
 const th=()=>qa(w,'th.hc').find(x=>x.dataset.col==='City');
 ok('S1 file loads, no JS errors',errs.length===0&&!!th(),errs.join());
 ok('S1 header shows a "≠" badge for suspicious spellings',!!th().querySelector('.wb.sv'));
 const bad=qa(w,'td.sv').map(x=>x.textContent);ok('S1 the typo cell is highlighted in the table',bad.includes('Mumbay'),JSON.stringify(bad));
 th().click();const ed=q(w,'#ed');
 ok('S1 header click opens the "All values" dropdown',ed.classList.contains('on')&&!!ed.querySelector('.vx'));
 const txt=ed.querySelector('#vxl').textContent;ok('S1 every unique value is listed with counts',/Delhi/.test(txt)&&/Mumbai/.test(txt)&&/Mumbay/.test(txt)&&/Jaipur/.test(txt)&&/×25/.test(txt),txt.slice(0,200));
 ok('S1 typo row says what it is a typo of',/typo of “Mumbai”/.test(txt));
 // search
 const s=ed.querySelector('#vxs');s.value='mumb';s.dispatchEvent(new w.Event('input',{bubbles:true}));ok('S1 search narrows the list',qa(w,'#vxl .vxr').length===2);
 s.value='';s.dispatchEvent(new w.Event('input',{bubbles:true}));
 // one-value fix
 const mergeBtn=qa(w,'#ed [data-vx=merge]');ok('S1 one-click "→ Mumbai" button exists',mergeBtn.some(b=>/Mumbai/.test(b.textContent)));
 mergeBtn.find(b=>/Mumbai/.test(b.textContent)).click();await wait(150);
 let vals=w.eval('DATA.RR.map(r=>r.d.City)');ok('S1 Mumbay became Mumbai',!vals.includes('Mumbay')&&vals.filter(v=>v==='Mumbai').length===26);
 ok('S1 undo toast offered',/Undo/.test(q(w,'#toast').textContent));
 q(w,'#toast [data-a=mundo]').click();await wait(80);
 vals=w.eval('DATA.RR.map(r=>r.d.City)');ok('S1 Undo brings Mumbay back',vals.includes('Mumbay'));
 // fix all
 th().click();q(w,'#ed [data-vx=fixall]')?q(w,'#ed [data-vx=fixall]').click():null;await wait(150);
 vals=w.eval('DATA.RR.map(r=>r.d.City)');ok('S1 "Fix all" leaves only clean categories',[...new Set(vals)].sort().join()==='Delhi,Jaipur,Mumbai',[...new Set(vals)].join());
 ok('S1 badge disappears once fixed',!th().querySelector('.wb.sv'));
 // filter
 th().click();const chk=qa(w,'#vxl input[data-vx=tog]').find(c=>/Jaipur/.test(c.closest('.vxr').textContent));chk.checked=true;chk.dispatchEvent(new w.Event('change',{bubbles:true}));
 q(w,'#ed [data-vx=filter]').click();
 ok('S1 filter shows only ticked values (Jaipur = 16 rows)',qa(w,'#pvw tbody tr').length===16&&/Showing only rows where/.test(q(w,'#pvw').textContent),String(qa(w,'#pvw tbody tr').length));
 q(w,'#pvw [data-a=vclr]').click();ok('S1 clearing the filter restores all rows',qa(w,'#pvw tbody tr').length===74);
 // download keeps the original sheet and the edits
 w.eval('dls()');await wait(100);const sv=w.__saved;
 ok('S1 download saved',!!sv&&/sales_cleaned\.xlsx$/.test(sv[1]));
 if(sv){const names=sv[0].SheetNames;ok('S1 workbook has Cleaned + Original sheet',names.includes('Cleaned')&&names.includes('Original - Data'),names.join());
  const cl=X.utils.sheet_to_json(sv[0].Sheets.Cleaned),cs=new Set(cl.map(r=>r.City||r.city));ok('S1 downloaded Cleaned sheet has the fixed spellings',[...cs].sort().join()==='Delhi,Jaipur,Mumbai',[...cs].join());
  const ap=X.utils.sheet_to_json(sv[0].Sheets['Applied Changes']);ok('S1 the change log records "Edited by you"',ap.some(r=>/Edited by you/.test(r.Reason)))}
 ok('S1 no runtime errors after all that',errs.length===0,errs.join());

 // ---- S2: file with ONLY a typo (no automatic step finds anything): manual fixes must still apply and download
 const c2=[...rep('Mumbai',30),'Mumbay',...rep('Pune',20)];
 ({w,errs}=await open(mk(c2.map((c,i)=>[2001+i,c]),['Order ID','City']),'typo.xlsx'));
 const th2=qa(w,'th.hc').find(x=>x.dataset.col==='City');ok('S2 typo-only file still gets the badge',!!th2.querySelector('.wb.sv'));
 th2.click();q(w,'#ed [data-vx=fixall]').click();await wait(150);
 ok('S2 fix applies even though no cleaning step ran',!w.eval('DATA.RR.map(r=>r.d.City)').includes('Mumbay'));
 ok('S2 download button is enabled',!q(w,'.bar2 [data-a=dl]').disabled);
 w.eval('dls()');await wait(100);ok('S2 download works with zero cleaning steps',!!w.__saved&&!q(w,'#err').textContent,q(w,'#err').textContent);
 if(w.__saved){const cl=X.utils.sheet_to_json(w.__saved[0].Sheets.Cleaned);ok('S2 downloaded file has no typo',!cl.some(r=>r.City==='Mumbay')&&cl.length===51)}
 // custom value via the "Change to…" box
 th2.click();const ed2=q(w,'#ed');qa(w,'#vxl [data-vx=edit]').find(b=>/Pune/.test(b.closest('.vxr').textContent)).click();
 q(w,'#vxi').value='Pune City';q(w,'#ed [data-vx=apply]').click();await wait(150);
 ok('S2 "Change to…" renames a whole category',w.eval('DATA.RR.filter(r=>r.d.City==="Pune City").length')===20);
 ok('S2 no runtime errors',errs.length===0,errs.join());

 // ---- S3: formulas / merged cells / errors are explained up front
 ({w,errs}=await open(mk([[1,2,null],[3,4,5]],['A','B','C'],ws=>{ws.D2={t:'n',f:'A2+B2',v:3};ws.D3={t:'n',f:'A3+B3',v:7};ws['!ref']='A1:D3';ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:1}}]}),'f.xlsx'));
 const xn=q(w,'#xn');ok('S3 warning appears for formulas + merged cells',!xn.classList.contains('hid')&&/2<\/b> formula/.test(xn.innerHTML)&&/merged/.test(xn.innerHTML),xn.innerHTML);
 ok('S3 it says where the original is kept',/Original - Data/.test(xn.textContent));
 // ---- S4: plain file shows no warning
 ({w,errs}=await open(mk([[1,'a'],[2,'b']],['A','B']),'p.xlsx'));ok('S4 clean file: no warning banner',q(w,'#xn').classList.contains('hid'));
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})();
