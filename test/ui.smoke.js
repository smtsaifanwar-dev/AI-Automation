// jsdom smoke test of the real UI: node test/ui.smoke.js  (needs: npm i jsdom xlsx)
const {JSDOM}=require('jsdom'),X=require('xlsx'),fs=require('fs');const errs=[];
const csv='Invoice No,Customer,Email,Mobile,Invoice Date,Due Date,Total,Amount Paid,Currency\nINV-1,Ravi,r@x.com,09876543210,01/09/2026,15/09/2026,"10,000.00",4000,INR\nINV-1,Ravi,r@x.com,09876543210,01/09/2026,15/09/2026,"10,000.00",4000,INR\nINV-2,Sam,,,01/10/2026,,250.50,0,USD\nINV-3,Bad,,,,,abc,,INR\n';
const html=fs.readFileSync('payments.html','utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<script>window\.XLSX\|\|[^<]*<\/script>/,'');
const d=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){w.XLSX=X;w.addEventListener('error',e=>errs.push(e.message));w.confirm=()=>true}});
const w=d.window,$=s=>w.document.querySelector(s),click=s=>$(s).click();
(async()=>{
 const f=new w.File([csv],'pay.csv');f.arrayBuffer=async()=>Buffer.from(csv).buffer.slice(0,Buffer.byteLength(csv));
 Object.defineProperty($('#fi'),'files',{value:[f]});$('#fi').dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,50));
 const log=(n,c)=>console.log(c?'PASS':'FAIL',n);log('mapping UI shown after file load',/Column mapping/.test($('#main').textContent));
 click('#an');log('analyze: 2 ready, 1 duplicate, 1 invalid',/2 ready/.test($('#main').textContent)&&/1 duplicates/.test($('#main').textContent)&&/1 invalid/.test($('#main').textContent));
 click('[data-a=commit]');log('commit -> overview with per-currency totals',/INR/.test($('#main').textContent)&&/USD/.test($('#main').textContent));
 click('#an');click('#an');log('re-analyze is idempotent (still 2 invoices)',JSON.parse(w.localStorage.getItem('bpPaymentFollowUp.v1')).inv.length===2);
 const st=JSON.parse(w.localStorage.getItem('bpPaymentFollowUp.v1'));log('imported paid kept as payment event (4000.00 = 400000)',st.pay.length===1&&st.pay[0].amount===400000);
 w.document.querySelector('[data-a=tab][data-v=inv]').click();click('[data-a=open]');log('detail opens',!$('#dlg').hidden);
 $('#pa').value='1000';$('#pd').value='2026-10-20';click('[data-a=pay]');const s2=JSON.parse(w.localStorage.getItem('bpPaymentFollowUp.v1'));log('payment recorded, history preserved (2 events)',s2.pay.length===2);
 click('[data-a=close]');w.document.querySelector('[data-a=tab][data-v=rem]').click();log('reminder draft rendered',/Hello Ravi|Hello Sam/.test($('#rb').value));
 w.document.querySelector('[data-a=tab][data-v=imp]').click();w.document.querySelector('[data-a=tab][data-v=set]').click();
 log('no runtime errors',errs.length===0);if(errs.length)console.log(errs);process.exit(0)})();
