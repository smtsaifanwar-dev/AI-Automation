/* Payment Follow-up core: pure, deterministic, no DOM. Money = integer minor units (paise/cents). */
(function(g){
const EXP={JPY:0,KRW:0,VND:0,KWD:3,BHD:3,OMR:3},ex=c=>EXP[c]??2,MAXI=BigInt(Number.MAX_SAFE_INTEGER);
const pad=n=>String(n).padStart(2,'0'),nk=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const uid=()=>(g.crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));
function parseMoney(s,cur){
 if(s==null||String(s).trim()==='')return{v:null};
 let t=String(s).trim(),neg=false;
 if(/^\(.*\)$/.test(t)){neg=true;t=t.slice(1,-1)}
 t=t.replace(/^(rs\.?|inr|usd|eur|gbp)\s*/i,'').replace(/[₹$€£,\s]/g,'');
 if(t[0]==='-'){neg=!neg;t=t.slice(1)}
 if(!/^\d+(\.\d+)?$/.test(t))return{v:null,err:'Not a valid amount'};
 const[i,f='']=t.split('.'),e=ex(cur);let n=BigInt(i+f.padEnd(e,'0').slice(0,e)),rounded=false;
 if(f.length>e){rounded=/[1-9]/.test(f.slice(e));if(+f[e]>=5)n+=1n}
 if(n>MAXI)return{v:null,err:'Amount too large'};
 return{v:Number(neg?-n:n),rounded};
}
function plain(v,c){if(v==null)return'';const e=ex(c),s=String(Math.abs(v)).padStart(e+1,'0');return(v<0?'-':'')+(e?s.slice(0,-e)+'.'+s.slice(-e):s)}
function fmt(v,c){if(v==null)return'–';const p=plain(v,c),neg=p[0]==='-',[i,f]=p.replace('-','').split('.');return(neg?'-':'')+BigInt(i).toLocaleString('en-IN')+(f?'.'+f:'')}
const iso=(y,m,d)=>{if(y<100)y+=2000;const t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null};
function parseDate(s,order){
 s=String(s??'').trim();if(!s)return{iso:null};let m;
 if(m=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:[ T].*)?$/))return{iso:iso(+m[1],+m[2],+m[3])};
 if(m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/)){let a=+m[1],b=+m[2],d=a,mo=b,amb=a<=12&&b<=12&&a!==b;
  if(order==='MDY'){d=b;mo=a}if(mo>12&&d<=12)[d,mo]=[mo,d];return{iso:iso(+m[3],mo,d),amb}}
 return{iso:null};
}
const U=s=>Date.UTC(...s.split('-').map((x,i)=>i===1?x-1:+x));
const daysBetween=(a,b)=>Math.round((U(b)-U(a))/864e5);
const addDays=(d,n)=>new Date(U(d)+n*864e5).toISOString().slice(0,10);
function todayISO(tz){try{return new Intl.DateTimeFormat('en-CA',{timeZone:tz}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}}

function classify(inv,pays,today,S){
 const mine=pays.filter(p=>p.invoiceId===inv.id&&!p.void),paid=mine.reduce((a,p)=>a+p.amount,0),fl=[],c=inv.currency,soon=S.dueSoonDays??3;
 if(inv.hold==='cancelled')return{paid,bal:0,status:'Cancelled',daysOver:0,daysTo:null,flags:fl,open:false,partial:false};
 if(inv.total==null)return{paid,bal:null,status:'Invalid',daysOver:0,daysTo:null,flags:['Missing invoice amount'],open:false,partial:false};
 if(inv.total<0)fl.push('Negative invoice amount');
 if(mine.some(p=>p.amount<0))fl.push('Negative payment');
 const bal=inv.total-paid;
 if(!inv.dueDate)fl.push('Missing due date (not treated as overdue)');
 if(!inv.customer)fl.push('Missing customer');
 if(inv.repOut!=null&&inv.repOut!==bal)fl.push(`Source outstanding ${fmt(inv.repOut,c)} differs from calculated ${fmt(bal,c)}`);
 const rs=(inv.repStatus||'').toLowerCase();
 if(/paid/.test(rs)&&!/un|part/.test(rs)&&bal>0)fl.push('Source says paid but a balance remains');
 if(/^(unpaid|pending|overdue)/.test(rs)&&bal<=0)fl.push('Source says unpaid but balance is zero');
 const daysTo=inv.dueDate?daysBetween(today,inv.dueDate):null,daysOver=daysTo!=null&&daysTo<0?-daysTo:0;
 let status;
 if(bal<0){status='Overpaid';fl.push('Payments exceed invoice total (kept as recorded)')}
 else if(bal===0)status='Paid';
 else if(inv.hold==='disputed')status='Disputed';else if(inv.hold==='on_hold')status='On Hold';
 else if(daysOver>0)status='Overdue';else if(daysTo!=null&&daysTo<=soon)status='Due Soon';else status=paid>0?'Partially Paid':'Unpaid';
 return{paid,bal,status,daysOver,daysTo,partial:paid>0&&bal>0,flags:fl,open:bal>0};
}
/* Transparent rules, no prediction: overdue tier + above-median balance + contact history. */
function priority(r,sinceContact,med){
 if(!r.open)return{lvl:'–',why:[],s:-1};
 if(r.inv.prio)return{lvl:r.inv.prio,why:['Set manually'],s:{High:99,Medium:50,Low:10}[r.inv.prio]||0};
 if(r.status==='Disputed'||r.status==='On Hold')return{lvl:'Hold',why:[r.status],s:-0.5};
 let s=0;const why=[],d=r.daysOver;
 if(d>0){s+=d>60?40:d>30?30:d>14?20:10;why.push(d+' days overdue')}
 if(med!=null&&r.bal>=med){s+=10;why.push('Balance at/above median')}
 if(d>0&&sinceContact==null){s+=10;why.push('Never contacted')}else if(sinceContact!=null&&sinceContact<3){s-=10;why.push('Contacted recently')}
 return{lvl:s>=40?'High':s>=20?'Medium':'Low',why,s};
}
function rowsOf(M,today){
 const rs=M.inv.map(inv=>{const c=classify(inv,M.pay,today,M.S),cs=M.con.filter(x=>x.invoiceId===inv.id).map(x=>x.date).sort(),
  ts=M.tsk.filter(x=>x.invoiceId===inv.id&&x.status!=='done').map(x=>x.date).sort(),
  lp=M.pay.filter(p=>p.invoiceId===inv.id&&!p.void&&p.date).map(p=>p.date).sort().pop()||null;
  return{inv,...c,last:cs.pop()||null,next:ts[0]||null,lastPay:lp}}),by={},med={};
 rs.filter(r=>r.open).forEach(r=>(by[r.inv.currency]=by[r.inv.currency]||[]).push(r.bal));
 for(const k in by){const a=by[k].sort((x,y)=>x-y);med[k]=a[a.length>>1]}
 rs.forEach(r=>{r.pr=priority(r,r.last?daysBetween(r.last,today):null,med[r.inv.currency])});return rs;
}
/* Per-currency totals only; currencies are never summed together. */
function totals(rs,today){const T={};rs.forEach(r=>{if(!r.open)return;const t=T[r.inv.currency]=T[r.inv.currency]||{out:0,over:0,due7:0,n:0};
 t.out+=r.bal;t.n++;if(r.daysOver>0)t.over+=r.bal;if(r.daysTo!=null&&r.daysTo>=0&&r.daysTo<=7)t.due7+=r.bal});return T}

/* ---- reminders ---- */
const TPL={upcoming:{label:'Friendly upcoming-due',ok:r=>r.open&&r.daysTo>0},today:{label:'Due today',ok:r=>r.open&&r.daysTo===0},
 overdue1:{label:'Polite overdue',ok:r=>r.open&&r.daysOver>0},overdue2:{label:'Firm but professional overdue',ok:r=>r.open&&r.daysOver>0},
 partial:{label:'Partial-payment balance',ok:r=>r.partial},thanks:{label:'Payment confirmation / thank you',ok:r=>r.paid>0}};
function recommend(r){if(!r.open)return r.paid>0?'thanks':null;
 if(r.daysOver>14)return'overdue2';if(r.partial)return'partial';if(r.daysOver>0)return'overdue1';if(r.daysTo===0)return'today';return r.daysTo>0?'upcoming':null}
function draft(key,r,S){
 const t=TPL[key],i=r.inv,c=i.currency,m=x=>`${c} ${fmt(x,c)}`;
 if(!t.ok(r))return{blocked:key.startsWith('overdue')?'Not overdue: this invoice is not past its due date, so an overdue message would be inaccurate.':'This template does not match the invoice’s current state.'};
 const miss=[];if(!i.customer)miss.push('customer name');if(!i.invoiceNo)miss.push('invoice number');if(!S.sender)miss.push('sender name (Settings)');
 const ref=i.invoiceNo?`invoice ${i.invoiceNo}`:'your invoice',due=i.dueDate?`, due on ${i.dueDate}`:'';
 const B={upcoming:`This is a friendly reminder that ${ref} for ${m(r.bal)}${due} is coming up for payment.`,
  today:`This is a reminder that ${ref} for ${m(r.bal)} is due today.`,
  overdue1:`This is a polite reminder regarding ${ref} for ${m(r.bal)}${due}.\n\nOur records show that the balance is still outstanding.`,
  overdue2:`We are following up on ${ref} for ${m(r.bal)}, which was due on ${i.dueDate} and is now ${r.daysOver} days past due. Please arrange payment at your earliest convenience, or let us know when we can expect it.`,
  partial:`Thank you for your payment of ${m(r.paid)} towards ${ref}. Our records show a remaining balance of ${m(r.bal)}${due}.`,
  thanks:`Thank you — we have received ${m(r.paid)} towards ${ref}. ${r.bal>0?'The remaining balance is '+m(r.bal)+'.':'The invoice is now fully paid.'}`}[key];
 const tail=key==='thanks'?'':'\n\nIf you have already made the payment, please disregard this message or share the payment reference so we can update our records.'+(S.instr?'\n\nPayment details:\n'+S.instr:'');
 return{subject:(key==='thanks'?'Payment received':'Payment reminder')+(i.invoiceNo?' — Invoice '+i.invoiceNo:''),
  body:`${i.customer?'Hello '+i.customer+',':'Hello,'}\n\n${B}${tail}\n\nPlease let us know if you have any questions.\n\nRegards${S.sender?',\n'+S.sender:''}`,missing:miss};
}
/* ---- import ---- */
const AL={invoiceNo:'invoicenumber invoiceno billnumber billno invno invoice',customer:'customer client buyer customername clientname buyername',
 email:'customeremail email emailid clientemail',phone:'customerphone phone mobile mobileno phoneno contact',company:'company customercompany',
 invoiceDate:'invoicedate billdate invoicedateiso',dueDate:'duedate paymentdue duedateiso',total:'invoiceamount total grandtotal grandtotalreported amount',
 paid:'amountpaid paidamount paid',outstanding:'outstanding balancedue balance outstandingbalance',currency:'currency cur',status:'paymentstatus status',
 notes:'notes remarks',supplier:'supplier seller vendor suppliername'};
function autoMap(h){const map={},amb={};
 for(const f in AL){const set=AL[f].split(' '),c=h.filter(x=>set.includes(nk(x)));if(c.length===1)map[f]=c[0];else if(c.length>1)amb[f]=c}
 const used={};for(const f in map)(used[map[f]]=used[map[f]]||[]).push(f);
 for(const k in used)if(used[k].length>1)used[k].forEach(f=>{delete map[f];amb[f]=[k]});return{map,amb}}
const dk=i=>i.invoiceNo?nk(i.invoiceNo)+'|'+nk(i.customer)+'|'+i.currency:'x|'+nk(i.customer)+'|'+i.invoiceDate+'|'+i.total+'|'+i.currency;
function inferOrder(v,def){let a=0,b=0;v.forEach(x=>{const m=String(x||'').match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]\d{2,4}$/);if(m){if(+m[1]>12)a=1;if(+m[2]>12)b=1}});return b&&!a?'MDY':a&&!b?'DMY':def}
function stageRows(rows,map,S,existing){
 const g=(r,f)=>map[f]?r[map[f]]:undefined,res={good:[],dup:[],bad:[],skip:[]},seen=new Map(existing.map(i=>[dk(i),'an already-saved invoice']));
 const ord={};['invoiceDate','dueDate'].forEach(f=>ord[f]=inferOrder(rows.map(r=>g(r,f)),S.order));
 const me=nk(S.business),str=(r,f)=>String(g(r,f)??'').trim();
 rows.forEach((r,idx)=>{const n=idx+2,cust=str(r,'customer');
  if(map.supplier){const sup=nk(g(r,'supplier')),cn=nk(cust);
   if(!me){res.skip.push({n,why:'Set your business name in Settings first, so customer invoices can be told apart from vendor bills'});return}
   const isSup=sup&&(sup.includes(me)||me.includes(sup)),isBuy=cn&&(cn.includes(me)||me.includes(cn));
   if(!isSup){res.skip.push({n,why:isBuy?'Vendor bill (you are the buyer), not a customer receivable':'Supplier does not match your business name, so direction is unclear'});return}}
  const cur=str(r,'currency').toUpperCase()||S.cur,warn=[];
  if(!/^[A-Z]{3}$/.test(cur)){res.bad.push({n,why:'Invalid currency "'+cur+'"'});return}
  if(!str(r,'currency'))warn.push('No currency in file; default '+S.cur+' used');
  const P=f=>parseMoney(g(r,f),cur),t=P('total'),pd=P('paid'),ou=P('outstanding'),e=[t,pd,ou].find(x=>x.err);
  if(e){res.bad.push({n,why:e.err});return}
  [t,pd,ou].forEach(x=>x.rounded&&warn.push('Amount rounded to currency precision'));
  if([t,pd,ou].some(x=>(x.v??0)<0)){res.bad.push({n,why:'Negative amount'});return}
  let total=t.v;if(total==null){if(ou.v==null){res.bad.push({n,why:'No invoice amount or outstanding balance'});return}total=ou.v+(pd.v||0);warn.push('Total derived from outstanding + paid')}
  const D=f=>{const raw=str(r,f),p=parseDate(raw,ord[f]);if(raw&&!p.iso)warn.push(`Invalid ${f} "${raw}" ignored`);if(p.amb)warn.push(`${f} read as ${ord[f]}`);return p.iso};
  const inv={id:uid(),invoiceNo:str(r,'invoiceNo'),customer:cust,email:str(r,'email'),phone:str(r,'phone'),company:str(r,'company'),invoiceDate:D('invoiceDate'),dueDate:D('dueDate'),
   currency:cur,total,repPaid:pd.v,repOut:ou.v,repStatus:str(r,'status'),hold:null,prio:null,notes:str(r,'notes'),created:new Date().toISOString(),src:'import',audit:[]};
  if(/cancel/i.test(inv.repStatus)){inv.hold='cancelled';warn.push('Source status is cancelled')}
  const k=dk(inv),w=seen.get(k);if(w){res.dup.push({n,why:`${inv.invoiceNo||'(no number)'} ${inv.customer}: duplicate of ${w}`});return}
  seen.set(k,'row '+n);res.good.push({n,inv,paid:pd.v>0?pd.v:0,warn})});
 return res;
}
/* ---- export ---- */
const S1=v=>typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v,SP=v=>typeof v==='string'&&/^\+?[0-9][0-9 ()-]{5,19}$/.test(v)?v:S1(v);
const num=(v,c)=>v==null?'':parseFloat(plain(v,c));
function sheets(M,today){
 const rs=rowsOf(M,today),inv=r=>r.inv,H=[['Invoice no.','Customer','Email','Phone','Invoice date','Due date','Currency','Invoice total','Amount paid','Outstanding','Days overdue','Status','Priority','Last follow-up','Next follow-up','Flags']];
 const line=r=>[S1(inv(r).invoiceNo),S1(inv(r).customer),S1(inv(r).email),SP(inv(r).phone),inv(r).invoiceDate||'',inv(r).dueDate||'',inv(r).currency,num(inv(r).total,inv(r).currency),num(r.paid,inv(r).currency),num(r.bal,inv(r).currency),r.daysOver||0,r.status,r.pr.lvl,r.last||'',r.next||'',S1(r.flags.join('; '))];
 const byId=Object.fromEntries(M.inv.map(i=>[i.id,i])),nm=id=>byId[id]?S1(byId[id].invoiceNo||byId[id].customer):'';
 const open=rs.filter(r=>r.open).sort((a,b)=>b.pr.s-a.pr.s);
 const T=totals(rs,today);
 return{'Outstanding Invoices':[...H,...open.map(line)],'All Invoices':[...H,...rs.map(line)],
  'Payment History':[['Invoice','Payment date','Amount','Currency','Reference','Method','Notes','Voided'],...M.pay.map(p=>[nm(p.invoiceId),p.date||'(from import)',num(p.amount,p.currency),p.currency,S1(p.ref||''),S1(p.method||''),S1(p.notes||''),p.void?'yes':''])],
  'Follow-up History':[['Invoice','Type','Date','Channel','Outcome / note','Next follow-up','Status'],...M.con.map(c=>[nm(c.invoiceId),'Contact logged',c.date,c.channel,S1(c.outcome||''),'',S1(c.tpl||'')]),...M.tsk.map(t=>[nm(t.invoiceId),'Scheduled',t.date,'','','',t.status])],
  'Reminder Drafts':[['Invoice','Customer','Template','Subject','Message','Needs review'],...open.map(r=>{const k=recommend(r),d=k?draft(k,r,M.S):null;return[S1(inv(r).invoiceNo),S1(inv(r).customer),k?TPL[k].label:'(add a due date)',d&&!d.blocked?S1(d.subject):'',d&&!d.blocked?d.body:'',d&&d.missing?d.missing.join(', '):'']})],
  'Validation Flags':[['Invoice','Customer','Flag'],...rs.flatMap(r=>r.flags.map(f=>[S1(inv(r).invoiceNo),S1(inv(r).customer),S1(f)]))],
  'Summary':[['Currency','Open invoices','Outstanding','Overdue amount','Due in 7 days'],...Object.entries(T).map(([c,t])=>[c,t.n,num(t.out,c),num(t.over,c),num(t.due7,c)]),['As of',today]]};
}
const csv=a=>'\uFEFF'+a.map(r=>r.map(v=>{v=v==null?'':String(v);return/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\r\n');
const API={parseMoney,fmt,plain,parseDate,todayISO,daysBetween,addDays,classify,priority,rowsOf,totals,TPL,recommend,draft,autoMap,stageRows,sheets,csv,S1,SP,uid,nk};
if(typeof module!=='undefined')module.exports=API;else g.PF=API;
})(typeof globalThis!=='undefined'?globalThis:window);
