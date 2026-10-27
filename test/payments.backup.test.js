// Backup reminder in Payment Follow-up (jsdom): node test/payments.backup.test.js   (needs: npm i jsdom xlsx)
const {JSDOM}=require('jsdom'),X=require('xlsx'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','payments.html'),'utf8').replace(/<script src=[^>]*><\/script>/g,'').replace(/<script>window\.XLSX\|\|[^<]*<\/script>/,'');
let pass=0,fail=0;const ok=(n,c,x)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n,c?'':(x||''))};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function page(store){const errs=[];const d=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){w.XLSX=X;w.confirm=()=>true;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){w.__dl=this.download};if(store)for(const k in store)w.localStorage.setItem(k,store[k]);w.addEventListener('error',e=>errs.push(e.message))}});return{w:d.window,errs}}
const day=n=>{const x=new Date();x.setDate(x.getDate()-n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
(async()=>{
 let {w,errs}=page();const $=s=>w.document.querySelector(s),warn=()=>$('#warn').textContent;
 ok('B1 empty app: no backup nag',!/backup/i.test(warn()));
 $('[data-a=demo]').click();await wait(50);$('[data-a=commit]').click();await wait(80);
 ok('B2 after importing invoices the app says there is no backup yet',/no backup yet/.test(warn()),warn());
 $('#warn [data-a=bsnz]').click();await wait(30);ok('B3 "Remind me later" hides it',!/backup/i.test(warn()));
 const ls=w.localStorage;ls.setItem('bpPF.snooze',day(4));w.eval('render()');ok('B4 reminder returns after the 3-day snooze',/no backup yet/.test(warn()));
 $('#warn [data-a=backup]').click();await wait(30);
 ok('B5 backup downloads a JSON file and remembers the date',/payment-followup-backup_.*\.json$/.test(w.__dl||'')&&ls.getItem('bpPF.lastBackup')===w.eval('today()'),String(w.__dl));
 ok('B6 no nag right after a backup',!/backup/i.test(warn()));
 ls.setItem('bpPF.lastBackup',day(3));w.eval('render()');ok('B7 a 3-day-old backup is still fine',!/backup/i.test(warn()));
 ls.setItem('bpPF.lastBackup',day(9));w.eval('render()');ok('B8 a 9-day-old backup triggers a reminder that says how old',/Last backup: 9 days ago/.test(warn()),warn());
 ok('B9 the data itself was not touched by any of this',JSON.parse(ls.getItem('bpPaymentFollowUp.v1')).inv.length===8);
 ok('B10 no runtime errors',errs.length===0,errs.join());
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})();
