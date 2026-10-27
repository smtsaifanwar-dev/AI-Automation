// Home-page smart drop zone (jsdom): node test/home.smart.test.js   (needs: npm i jsdom xlsx)
const {JSDOM}=require('jsdom'),X=require('xlsx'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n,c?'':(x||''))};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const xl=(head,rows)=>{const wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([head,...(rows||[])]),'S');return X.write(wb,{type:'buffer',bookType:'xlsx'})};
function page(withX){const errs=[],calls=[];const d=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,beforeParse(w){
  w.BP_XTIMEOUT=60;w.TextDecoder=require('util').TextDecoder;if(withX)w.XLSX=Object.assign({},X,{read:(a,o)=>X.read(typeof a==='string'?a:Buffer.from(new Uint8Array(a)),Object.assign({},o,{type:typeof a==='string'?o.type:'buffer'}))});
  w.addEventListener('error',e=>errs.push(e.message))}});
 const w=d.window;w.open=(t,f)=>{calls.push([t,f&&f.map(x=>x.name)]);return Promise.resolve()};return{w,errs,calls}}
async function drop(w,buf,name){const f=new w.File([buf],name),inp=w.document.querySelector('#i-smart');Object.defineProperty(inp,'files',{value:[f],configurable:true});inp.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(250)}
const q=(w,s)=>w.document.querySelector(s);
(async()=>{
 let {w,errs,calls}=page(true);
 await drop(w,xl(['Invoice No','Customer','Invoice Date','Due Date','Total','Amount Paid'],[['A1','Ravi','2026-09-01','2026-10-01',1000,0]]),'receivables.xlsx');
 ok('H1 payment sheet goes straight to Payment Follow-up',calls.length===1&&calls[0][0]==='payments'&&calls[0][1][0]==='receivables.xlsx',JSON.stringify(calls));
 ok('H1 note says what happened and offers the other tool',/Payment Follow-up/.test(q(w,'#n-smart').textContent)&&/Use the Excel cleaner instead/.test(q(w,'#n-smart').textContent));
 q(w,'#n-smart [data-sw]').click();await wait(30);
 ok('H2 "Not right?" button reopens the same file in the cleaner',calls.length===2&&calls[1][0]==='clean'&&calls[1][1][0]==='receivables.xlsx');
 await drop(w,xl(['Name','Email','Phone','City'],[['A','a@x.com','98765','Jaipur']]),'customers.xlsx');
 ok('H3 customer list goes to the Excel cleaner',calls.length===3&&calls[2][0]==='clean');
 ok('H3 note offers payments instead',/Use Payment Follow-up instead/.test(q(w,'#n-smart').textContent));
 const n0=calls.length;await drop(w,xl(['Invoice No','Customer','Date','Amount'],[['A1','Ravi','2026-09-01',5]]),'register.xlsx');
 ok('H4 unsure sheet does NOT open anything; it asks',calls.length===n0&&q(w,'#choose').classList.contains('on'));
 ok('H4 the likely choice is highlighted and the reason is shown',q(w,'#choose [data-x=payments]').classList.contains('sug')&&/found invoice number/.test(q(w,'#e-smart').textContent),q(w,'#e-smart').textContent);
 q(w,'#choose [data-x=clean]').click();ok('H4 user choice is respected',calls.length===n0+1&&calls[n0][0]==='clean'&&!q(w,'#choose').classList.contains('on'));
 const csv=Buffer.from('Invoice No,Customer,Due Date,Balance\nA1,Ravi,2026-10-01,500\n');await drop(w,csv,'ledger.csv');
 ok('H5 CSV is detected too',calls[calls.length-1][0]==='payments');
 await drop(w,Buffer.from('%PDF-1.4 fake'),'bill.pdf');ok('H6 PDF invoices open the invoice tool at once',calls[calls.length-1][0]==='invoice');
 const n1=calls.length;await drop(w,Buffer.from('this is not a spreadsheet at all'),'broken.xlsx');
 ok('H7 an unreadable spreadsheet falls back to asking (never crashes)',calls.length===n1&&q(w,'#choose').classList.contains('on'));
 await drop(w,Buffer.from('x'),'notes.txt');ok('H8 unsupported type gives a clear message',/Unsupported/.test(q(w,'#e-smart').textContent));
 // second drop quickly replaces first
 ok('H9 no JS errors',errs.length===0,errs.join());
 // offline / library cannot load: ask instead of hanging
 ({w,errs,calls}=page(false));const t0=Date.now();await drop(w,xl(['Invoice No','Customer','Due Date','Total'],[]),'x.xlsx');await wait(300);
 ok('H10 if the reader library cannot load, the user is asked (no endless "Looking inside…")',q(w,'#choose').classList.contains('on')&&!/Looking inside/.test(q(w,'#e-smart').textContent)&&calls.length===0,q(w,'#e-smart').textContent);
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})();
