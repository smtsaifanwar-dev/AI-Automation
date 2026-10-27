const CFG={maxMB:15,maxFiles:30,tol:1,lineTol:.5};/* tol = allowed difference (in currency units) between reported and calculated totals; lineTol = same, for quantity × unit price on one line */
const AMT=['subtotal','discount','freight','cgst','sgst','igst','roundoff','total'];
const LBL={docType:'Document type',invNo:'Invoice number',invDate:'Invoice date',dueDate:'Due date',po:'PO number',vendor:'Supplier',vGst:'Supplier GSTIN',buyer:'Buyer',bGst:'Buyer GSTIN',cur:'Currency',subtotal:'Subtotal',discount:'Discount',freight:'Freight / shipping',cgst:'CGST',sgst:'SGST',igst:'IGST',roundoff:'Round-off',total:'Grand total'};
const GRP=[['Document',['docType','invNo','invDate','dueDate','po']],['Supplier and buyer',['vendor','vGst','buyer','bGst']],['Amounts',['cur','subtotal','discount','freight','cgst','sgst','igst','roundoff','total']]];
const CL={high:['High','ok'],med:['Medium','wa'],low:['Low','er'],missing:['Not found',''],edited:['Edited','']};
const GST=/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,DT=/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}[ \-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ \-,]+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[ ]+\d{1,2}(?:st|nd|rd|th)?,?[ ]+\d{4})/i;
const fmt=n=>n==null||isNaN(n)?'–':n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const kb=n=>n<1048576?Math.max(1,Math.round(n/1024))+' KB':(n/1048576).toFixed(1)+' MB';
/* Reads one money value. Understands 1,18,000.00 (Indian), 1,234.50, 1.234,50 (European), "1 234,50", 5000/-, Rs 5,000, (1,000) and -500.
   Returns null for empty input and NaN when the text is not a usable number. */
function pa(s){if(s==null||s==='')return null;let t=String(s).trim();
 const ng=/^\(.*\)$/.test(t)||/^-/.test(t)||/^(?:rs\.?|inr|usd|eur|gbp|[\u20B9$\u20AC\u00A3])\s*-/i.test(t);
 t=t.replace(/\/-\s*$/,'').replace(/(?:rs\.?|inr|usd|eur|gbp|[\u20B9$\u20AC\u00A3])/gi,'').replace(/[^\d.,\s]/g,'').trim();
 if(/\s/.test(t)){if(/^\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(t))t=t.replace(/\s/g,'');else return NaN}
 if(!/\d/.test(t))return NaN;
 const lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
 if(lc>=0&&ld>=0){t=lc>ld?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'')}
 else if(lc>=0){t=/^\d{1,3}(?:,\d{2})*,\d{3}$|^\d{1,3}(?:,\d{3})+$/.test(t)?t.replace(/,/g,''):/^\d+,\d{1,2}$/.test(t)?t.replace(',','.'):t.replace(/,/g,'')}
 else if((t.match(/\./g)||[]).length>1){t=/^\d{1,3}(?:\.\d{3})+$/.test(t)?t.replace(/\./g,''):NaN}
 const v=parseFloat(t);return isNaN(v)?NaN:(ng?-v:v)}
const num=v=>typeof v==='number'?v:(v==null||v===''?null:pa(v));
const nrm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
function pdte(s){if(!s)return null;s=String(s).trim();let m,y,mo,d,amb=false;const M='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
 if(m=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)){y=+m[1];mo=+m[2];d=+m[3]}
 else if(m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)){d=+m[1];mo=+m[2];y=+m[3];if(y<100)y+=2000;amb=d<=12&&mo<=12&&d!==mo}
 else if(m=s.match(/^(\d{1,2})[ \-]([a-z]{3})[a-z]*[ \-,]+(\d{2,4})$/i)){d=+m[1];mo=M.indexOf(m[2].toLowerCase())+1;y=+m[3];if(y<100)y+=2000}
 else if(m=s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i)){mo=M.indexOf(m[1].toLowerCase())+1;d=+m[2];y=+m[3]}
 else return null;
 const t=new Date(Date.UTC(y,mo-1,d));if(!mo||t.getUTCFullYear()!==y||t.getUTCMonth()!==mo-1||t.getUTCDate()!==d)return{bad:true};
 return{iso:y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),amb}}
const isoOf=v=>{const p=pdte(v);return p&&p.iso?p.iso:''};

/* Text pieces on one row become one cell only when they nearly touch. A wider gap starts a new column, so side-by-side blocks (supplier | buyer | details) stay apart. */
function mkCells(it){const cs=[];it.forEach(([x,s,w,h])=>{const t=s.trim(),l=cs[cs.length-1];
  if(l&&x-l.x2<=.6*h){l.s+=(x-l.x2>.15*h?' ':'')+t;l.x2=x+w}else cs.push({x,x2:x+w,s:t})});return cs}
function amt(s){s=s.replace(/\d+(?:[.,]\d+)?\s*%/g,'');let m,l=null;const re=/(?:\u20B9|rs\.?|inr|usd|\$|\u20AC|\u00A3)?\s*(-?\(?\d[\d.,]*\)?)/gi;while((m=re.exec(s)))l=m[1];return l?pa(l.replace(/[.,]+(?=\)?$)/,'')):null}
function fa(L,re,not,nl){for(let i=0;i<L.length;i++){const t=L[i].t;if(re.test(t)&&!(not&&not.test(t))&&!isHdr(L[i])){let v=amt(t);if(v==null&&nl&&L[i+1]&&!isHdr(L[i+1]))v=amt(L[i+1].t);if(v!=null&&!isNaN(v))return{v,c:'high',p:L[i].p}}}return null}
function ft(L,re){for(const x of L){const m=x.t.match(re);if(m&&m[1])return{v:m[1].trim(),c:'high',p:x.p}}return null}
/* Like ft, but tries each cell on its own first, so text from a neighbouring column (a phone number, say) is never read as part of the match. */
function ftc(L,re){for(const x of L)for(const c of cellsOf(x)){const m=c.s.match(re);if(m&&m[1])return{v:m[1].trim(),c:'high',p:x.p}}return ft(L,re)}

/* ---------- layout: cells, party blocks, item table ---------- */
const rnd=v=>Math.round(v*100)/100;
const cellsOf=x=>x.cells||(()=>{let p=0;return x.t.split(/ {2,}/).filter(Boolean).map(s=>{const c={x:p,x2:p+s.length*5,s};p+=s.length*5+40;return c})})();
const CTX=/^(?:phone|ph|tel|telephone|mobile|mob|cell|whatsapp|e-?mail|email|fax|web(?:site)?|url|gstin|gst|pan|cin|address|contact|upi|bank|a\/c|ifsc)\b/i;
/* True for phone, email, web, tax-id or mostly-numeric lines. These are never a company name. */
const looksContact=s=>{s=String(s??'').trim();if(!s)return false;const d=s.replace(/\D/g,'').length;return CTX.test(s)||/@/.test(s)||/^(?:https?:\/\/|www\.)/i.test(s)||(d>=6&&d/s.replace(/\s/g,'').length>.5)};
const nameOK=s=>{s=String(s??'').trim();return s.replace(/[^A-Za-z]/g,'').length>=3&&!looksContact(s)};
const GL=/(?:gstin|gst\s*(?:no\.?|number|in))(?:\/uin)?\s*[:\-]?\s*([0-9A-Z]{10,16})/i,GB=/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;
const gstIn=s=>{let m=s.match(GL);if(m)return m[1].toUpperCase();m=s.match(GB);return m?m[0]:null};
const PO=/\b(?:p\.?\s?o\.?|purchase\s*order)(?:\s*(?:no\.?|number|num|#)\s*[:\-#]?|\s*[:\-#])\s*([A-Z0-9][A-Z0-9\/\-_.]{2,24})/i;

/* Party labels: who a block of text belongs to. 'other' (ship to, invoice details) is not a party we extract, but it still ends the column before it. */
const PLB=[['seller',/^(?:(?:details\s*of\s*)?supplier|seller|vendor|sold\s*by|billed?\s*from|from|remit(?:ted)?\s*to|payee)\b/i],['buyer',/^(?:to(?=\s*[:\-\u2013]|\s*$)|(?:details\s*of\s*)?receiver|bill(?:ed)?\s*to|buyer|customer(?:\s*name)?|sold\s*to|invoice\s*to|client|recipient)\b/i],['other',/^(?:ship(?:ped)?\s*to|deliver(?:y|ed)?\s*to|consignee|invoice\s*details|bill\s*details|place\s*of\s*supply)\b/i]];
function partyLabel(s){s=String(s).trim();for(const[role,re]of PLB){const m=s.match(re);if(m){const tail=s.slice(m[0].length),sep=/^\s*(?:name\s*)?[:\-–]/i.test(tail);let rest=tail.replace(/^\s*(?:name\s*)?[:\-–]?\s*/i,'').trim();if(/^(?:details?|info(?:rmation)?|address|name)$/i.test(rest))rest='';return{role,rest,sep}}}return null}
/* Find the supplier and buyer from labels and column positions. A label alone in its cell (SUPPLIER, BILL TO) owns the lines under it, within its own column.
   A label with a value after a colon (Bill To: Name) owns that value. Nothing is guessed from another column. */
function parties(L,T){const lim=T?T.head:L.length,out={seller:null,buyer:null,hdr:-1};
 for(let i=0;i<lim;i++){const cs=cellsOf(L[i]);
  cs.forEach((c,j)=>{const lb=partyLabel(c.s);if(!lb||lb.role==='other'||out[lb.role])return;
   if(lb.rest){if(lb.sep&&nameOK(lb.rest)){out[lb.role]={v:lb.rest,p:L[i].p,gst:null,inline:true};if(out.hdr<0||i<out.hdr)out.hdr=i}return}
   const start=c.x-3,nx=cs.slice(j+1).find(z=>z.x>c.x+3),end=nx?nx.x-3:(cs.length===1?c.x+12:Infinity),lines=[];let prevY=L[i].y,pitch=0;
   for(let k=i+1;k<lim&&lines.length<8;k++){if(L[k].p!==L[i].p)break;const gap=prevY-L[k].y;if(k>i+1&&!pitch)pitch=gap;
    if(k>i+1&&gap>Math.max(24,2.2*(pitch||10)))break;
    const inb=cellsOf(L[k]).filter(z=>z.x>=start&&z.x<end);if(inb.some(z=>partyLabel(z.s)))break;
    if(inb.length)lines.push(inb.map(z=>z.s).join(' '));prevY=L[k].y}
   out[lb.role]={v:lines.find(nameOK)||null,p:L[i].p,gst:gstIn(lines.join('\n')),inline:false};if(out.hdr<0||i<out.hdr)out.hdr=i})}
 return out}
/* Last resort when the invoice has no supplier label: the first plausible name on page 1 above the table, read cell by cell (never a whole row). */
function sellerFB(L,T,P,bn){const lim=Math.min(T?T.head:L.length,P.hdr>=0?P.hdr:L.length),SK=/\b(?:invoice|bill\s*of|original|duplicate|triplicate|gstin|page|date|tax|due|total|sub\s*total|subtotal|amount|currency|supplier|details|copy|qty|quantity|rate|vat|cgst|sgst|igst|balance|payment|terms|description|particulars)\b/i;
 for(let i=0;i<lim;i++){if(L[i].p>1)break;for(const c of cellsOf(L[i])){if(SK.test(c.s)||/^\s*(?:sub\s*total|subtotal)\s*$/i.test(c.s)||DT.test(c.s)||partyLabel(c.s)||!nameOK(c.s)||c.s.replace(/[^A-Za-z]/g,'').length<4||c.s===bn)continue;return{v:c.s,c:i<5?'med':'low',p:L[i].p}}}return null}

/* Item table. Header words decide which column is which. Every header cell, mapped or not, marks where a column starts,
   and a value belongs to the column whose start is the last one at or left of the value's centre. That works for left- and right-aligned numbers. */
const HK=[['sr',/^(?:#|sr\.?(?:\s*no\.?)?|s\.?\s*no\.?|sl\.?(?:\s*no\.?)?)$/i],['hsn',/^(?:hsn(?:\s*\/?\s*sac)?(?:\s*code)?|sac(?:\s*code)?)$/i],['qty',/^(?:qty|quantity|qnty|no\.?\s*of\s*(?:units|items))\.?$/i],['taxable',/^taxable(?:\s*(?:value|amount|amt))?$/i],['price',/^(?:unit\s*price|rate(?:\s*\/\s*unit)?|price|unit\s*cost)$/i],['amount',/^(?:amount|amt|line\s*total|total|net\s*amount|value)$/i],['desc',/^(?:description(?:\s*of\s*(?:goods|services))?|item(?:\s*description)?|particulars|product(?:\s*description)?)$/i]];
const hkey=s=>{s=String(s).replace(/\(.*?\)|[₹$€£]/g,'').trim();for(const[k,re]of HK)if(re.test(s))return k;return null};
const isHdr=x=>cellsOf(x).filter(c=>hkey(c.s)).length>=3;
const STOP=/^(?:sub\s*-?\s*total|total|grand\s*total|cgst|sgst|igst|utgst|discount|freight|shipping|round[\s-]*off|amount\s*in\s*words|tax\s*summary|notes?\b|terms|payment|bank|authori[sz]ed|net\s*(?:amount|payable|total)|invoice\s*(?:total|value)|bill\s*amount|amount\s*due|total\s*(?:payable|invoice)|balance|amount\s*(?:paid|payable|due)|taxable\s*(?:value|amount))/i;
function tableHead(L){for(let i=0;i<L.length;i++){const cols=cellsOf(L[i]).map(c=>({...c,key:hkey(c.s)})),ks=new Set(cols.map(c=>c.key).filter(Boolean));
 if(ks.size>=3&&ks.has('desc')&&(ks.has('taxable')||ks.has('amount')||ks.has('price'))&&(ks.has('qty')||ks.has('hsn')||ks.has('price')))return{i,cols}}return null}
function scanTable(L){const th=tableHead(L);if(!th)return null;const cols=th.cols,items=[];let end=L.length,last=null,pitch=0;
 const colOf=c=>{const m=(c.x+c.x2)/2;let j=0;cols.forEach((h,k)=>{if(m>=h.x-3)j=k});return j},val=s=>{if(s==null)return null;const v=pa(s);return v==null||isNaN(v)?null:v};
 for(let k=th.i+1;k<L.length;k++){const cs=cellsOf(L[k]);if(!cs.length)continue;
  const row={};cs.forEach(c=>{const j=colOf(c),key=cols[j].key||'_'+j;row[key]=(row[key]?row[key]+' ':'')+c.s});
  const sr=row.sr!=null&&/^\d+$/.test(row.sr.trim());
  if(!sr&&STOP.test(cs[0].s)){end=k;break}
  if(!sr&&isHdr(L[k]))continue;/* header repeated on a later page */
  const q=val(row.qty),pr=val(row.price),vk=row.taxable!=null?'taxable':'amount',tv=val(row[vk]),d=(row.desc||'').trim();
  if(q==null&&pr==null&&tv==null){/* text only: the wrapped end of the description above, if it sits directly under it */
   if(d&&last&&!row.hsn&&!sr&&last.p===L[k].p&&last.y-L[k].y<=1.5*(pitch||14)){last.it.desc+=' '+d;last.y=L[k].y}continue}
  if(!d&&tv==null)continue;
  const it={no:sr?+row.sr.trim():items.length+1,desc:d,hsn:(row.hsn||'').trim()||null,qty:q,price:pr,taxable:tv,col:tv!=null?cols.find(h=>h.key===vk).s:null,p:L[k].p};
  it.calc=q!=null&&pr!=null?rnd(q*pr):null;it.diff=it.calc!=null&&tv!=null?rnd(tv-it.calc):null;
  if(last)pitch=last.y-L[k].y;items.push(it);last={it,y:L[k].y,p:L[k].p}}
 return{head:th.i,end,items}}
function rates(La){const o={};[['cgst',/\bcgst\b/i],['sgst',/\b(?:sgst|utgst)\b/i],['igst',/\bigst\b/i]].forEach(([k,re])=>{for(const x of La){if(re.test(x.t)){const m=x.t.match(/(\d+(?:\.\d+)?)\s*%/);if(m){o[k]=parseFloat(m[1]);break}}}});return o}

/* Returns the header fields (f, unchanged shape), the item rows, and any tax rates read from labels such as "CGST (9%)". Source values only; nothing is calculated here. */
function parseAll(L){const f={},set=(k,o)=>{f[k]=o||{v:null,c:'missing'}},txt=L.map(x=>x.t).join('\n'),T=scanTable(L),La=T?L.filter((_,i)=>i<T.head||i>=T.end):L,P=parties(L,T);
 const dt=!L.length?null:/credit\s*note/i.test(txt)?'Credit note':/debit\s*note/i.test(txt)?'Debit note':/pro\s*forma/i.test(txt)?'Pro forma invoice':/tax\s*invoice/i.test(txt)?'Tax invoice':/invoice/i.test(txt)?'Invoice':'Unknown';
 set('docType',dt?{v:dt,c:dt==='Unknown'?'low':'med'}:null);
 set('invNo',ft(L,/(?:invoice|inv|bill|credit\s*note|debit\s*note)\s*(?:no\.?|number|num|#)\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\/\-_.]{1,29})/i));
 let a=null;for(const x of L){if(/date/i.test(x.t)&&!/due/i.test(x.t)){const m=x.t.match(DT);if(m){a={v:m[1],c:'high',p:x.p};break}}}
 if(!a)for(const x of L){const m=x.t.match(DT);if(m){a={v:m[1],c:'low',p:x.p};break}}
 set('invDate',a);a=null;for(const x of L){if(/due/i.test(x.t)){const m=x.t.match(DT);if(m){a={v:m[1],c:'high',p:x.p};break}}}set('dueDate',a);
 set('po',ftc(L,PO));
 /* GSTINs belong to the party whose block they sit in. Only without a party layout do they fall back to the order found, at medium confidence. */
 const G=[];L.forEach(x=>{for(const m of x.t.matchAll(/(?:gstin|gst\s*(?:no\.?|number|in))(?:\/uin)?\s*[:\-]?\s*([0-9A-Z]{10,16})/gi))if(!G.some(g=>g.v===m[1].toUpperCase()))G.push({v:m[1].toUpperCase(),p:x.p});
  for(const m of x.t.matchAll(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g))if(!G.some(g=>g.v===m[0]))G.push({v:m[0],p:x.p})});
 const sg=P.seller&&P.seller.gst,bg=P.buyer&&P.buyer.gst,sOpen=!P.seller||P.seller.inline,bOpen=!P.buyer||P.buyer.inline;
 const vg=sg?{v:sg,c:'high',p:P.seller.p}:sOpen?(G.find(g=>g.v!==bg)?{...G.find(g=>g.v!==bg),c:'med'}:null):null;
 set('vGst',vg);
 set('bGst',bg?{v:bg,c:'high',p:P.buyer.p}:bOpen?(G.find(g=>g.v!==(vg&&vg.v))?{...G.find(g=>g.v!==(vg&&vg.v)),c:'med'}:null):null);
 const bn=P.buyer&&P.buyer.v;
 set('vendor',P.seller&&P.seller.v?{v:P.seller.v,c:'high',p:P.seller.p}:sellerFB(L,T,P,bn));
 set('buyer',bn?{v:bn,c:'high',p:P.buyer.p}:null);
 const cu=/₹|\brs\b\.?|\binr\b/i.test(txt)?'INR':/\$|\busd\b/i.test(txt)?'USD':/€|\beur\b/i.test(txt)?'EUR':/£|\bgbp\b/i.test(txt)?'GBP':null;const cu2=cu||(/\b(?:cgst|sgst|igst|gstin)\b/i.test(txt)||GB.test(txt)?'INR':null);set('cur',cu2?{v:cu2,c:'med'}:null);
 /* Amount labels are searched outside the item table, so a column header such as "Taxable Value" or an item row can never be read as a total. */
 set('subtotal',fa(La,/sub\s*-?\s*total|total\s*before\s*tax|taxable\s*(?:value|amount)|net\s*amount/i,/words/i,true));
 set('discount',fa(La,/discount/i));set('freight',fa(La,/freight|shipping|delivery\s*charge/i));
 set('cgst',fa(La,/cgst/i));set('sgst',fa(La,/sgst|utgst/i));set('igst',fa(La,/igst/i));set('roundoff',fa(La,/round[\s-]*off/i));
 let t=fa(La,/grand\s*total|total\s*amount|amount\s*payable|net\s*payable|invoice\s*total|total\s*due/i,/before\s*tax|words/i,true);
 if(!t){const s2=fa(La,/net\s*total|invoice\s*value|bill\s*amount|total\s*payable|amount\s*due|balance\s*due/i,/before\s*tax|words|sub/i,true);if(s2)t={...s2,c:'med'}}
 if(!t){for(let i=La.length-1;i>=0;i--){if(/^total\b/i.test(La[i].t)&&!/sub/i.test(La[i].t)){const v=amt(La[i].t);if(v!=null&&!isNaN(v)){t={v,c:'med',p:La[i].p};break}}}}
 set('total',t);return{f,items:T?T.items:[],rates:rates(La)}}
const parse=L=>parseAll(L).f;

/* ---------- validation ---------- */
function validate(r){const f=r.f,F=[],add=(id,sev,field,msg,src,exp,act)=>F.push({id,sev,field,msg,src:src??'',exp:exp??'',act:act||''});
 if(r.noText)add('R0','critical','document','No readable text was found (scanned PDF or image).'+(r.ocrMsg?' OCR was tried but '+r.ocrMsg.replace(/^./,c=>c.toLowerCase()):''),'','','Enter the fields by hand using the preview next to them.');
 if(r.ocr)add('R0o','info','document','This document was read with OCR (text recognised from an image). OCR can misread digits.','','','Check every value against the original, then mark it as reviewed.');
 [['invNo','Invoice number','critical'],['invDate','Invoice date','warning'],['vendor','Supplier name','warning'],['cur','Currency','warning'],['total','Grand total','critical']].forEach(([k,n,s])=>{if(f[k].v==null||f[k].v==='')add('R1',s,k,n+' is missing.','','','Enter it from the source document.')});
 const credit=/credit/i.test(f.docType.v||'');
 AMT.forEach(k=>{const v=f[k].v;if(v==null||v==='')return;const x=num(v);if(isNaN(x))add('R2','critical',k,LBL[k]+' is not a valid number.',String(v),'','Correct the value.');else if(x<0&&!credit)add('R3','warning',k,LBL[k]+' is negative, which is unusual for this document type.',String(x),'','Check the source. Negatives are normal for credit notes.');else if(k==='total'&&x===0)add('R3','warning',k,'Grand total is zero.','0','','Check the source.')});
 [['vGst','Supplier'],['bGst','Buyer']].forEach(([k,n])=>{const v=f[k].v;if(v&&!GST.test(String(v).toUpperCase()))add('R4','warning',k,n+' GSTIN does not match the standard 15-character format. (Format check only, not an official verification.)',String(v),'','Check the number on the invoice.')});
 const di=pdte(f.invDate.v),dd=pdte(f.dueDate.v);
 if(f.invDate.v&&(!di||di.bad))add('R5','warning','invDate','Invoice date could not be read as a valid date.',String(f.invDate.v),'','Correct the date.');
 else if(di&&di.amb)add('R5a','info','invDate','Date read as day/month/year. Confirm this is right.',String(f.invDate.v),di.iso,'');
 if(f.dueDate.v&&(!dd||dd.bad))add('R5','warning','dueDate','Due date could not be read as a valid date.',String(f.dueDate.v),'','Correct the date.');
 if(di&&di.iso&&dd&&dd.iso&&dd.iso<di.iso)add('R6','warning','dueDate','Due date is earlier than the invoice date.',dd.iso,di.iso,'Check both dates.');
 if(di&&di.iso&&di.iso>new Date(Date.now()+864e5).toISOString().slice(0,10))add('R6f','info','invDate','Invoice date is in the future.',di.iso,'','Check the date.');
 const g=k=>{const v=num(f[k].v);return v==null||isNaN(v)?0:v},T=num(f.total.v),S=num(f.subtotal.v),items=r.items||[],Sok=S!=null&&!isNaN(S),Tok=T!=null&&!isNaN(T);r.calc=null;r.diff=null;
 /* Subtotal: the value read from the invoice (f.subtotal) is never replaced. The sum of the line items is kept beside it, and any difference is reported. */
 r.subCalc=items.length&&items.every(i=>i.taxable!=null)?rnd(items.reduce((a,i)=>a+i.taxable,0)):null;r.subDiff=null;
 if(Sok&&r.subCalc!=null){r.subDiff=rnd(S-r.subCalc);if(Math.abs(r.subDiff)>CFG.tol)add('R13','critical','subtotal','Reported subtotal does not match the sum of the line items.',fmt(S),fmt(r.subCalc),'Check that every line item was read, or whether the subtotal includes other charges.')}
 else if(!Sok&&r.subCalc!=null)add('R15','info','subtotal','No subtotal was found on the invoice, so the sum of the line items ('+fmt(r.subCalc)+') is used for the total check. The Subtotal field is left empty.');
 const base=Sok?S:r.subCalc;
 if(Tok&&base!=null){const c=base-g('discount')+g('freight')+g('cgst')+g('sgst')+g('igst')+g('roundoff'),d=rnd(T-c);r.calc=rnd(c);r.diff=d;
  if(Math.abs(d)>CFG.tol)add('R7','critical','total','Reported total does not match the calculated total.',fmt(T),fmt(c),'Check subtotal, taxes and charges. Prices may include tax, or a charge may not have been captured.')}
 else if(Tok)add('R7i','info','total','Total could not be cross-checked because no subtotal was found.');
 if(num(f.cgst.v)!=null&&num(f.sgst.v)!=null&&Math.abs(g('cgst')-g('sgst'))>CFG.tol)add('R8','warning','cgst','CGST and SGST amounts differ. They are normally equal.',fmt(g('cgst')),fmt(g('sgst')),'Check the tax lines.');
 if(g('igst')&&(g('cgst')||g('sgst')))add('R8','warning','igst','IGST appears together with CGST/SGST.','','','Check the tax lines.');
 [['vendor','Supplier name'],['buyer','Buyer name']].forEach(([k,n])=>{const v=f[k].v;if(v&&looksContact(v))add('R11','warning',k,n+' looks like a contact detail (phone, email or tax id), not a name.',String(v),'','Enter the correct name from the invoice.')});
 items.forEach(it=>{if(it.diff!=null&&Math.abs(it.diff)>CFG.lineTol)add('R12','warning','document','Line '+it.no+': quantity × unit price does not match the taxable value.',fmt(it.taxable),fmt(it.calc),'Check for a line discount or a misread number.')});
 [['cgst','CGST'],['sgst','SGST'],['igst','IGST']].forEach(([k,n])=>{const rate=(r.rates||{})[k],v=num(f[k].v);if(rate==null||v==null||isNaN(v)||base==null)return;
  const b0=base-g('discount'),opt=[b0,b0+g('freight')].map(b=>rnd(b*rate/100));if(!opt.some(e=>Math.abs(e-v)<=CFG.tol))add('R14','warning',k,n+' amount does not match its stated rate ('+rate+'%) applied to the taxable amount.',fmt(v),fmt(opt[0]),'Check the rate and the taxable amount.')});
 Object.keys(f).forEach(k=>{if(f[k].c==='low'&&f[k].v!=null)add('R9','warning',k,LBL[k]+' was found with low confidence.',String(f[k].v),'','Confirm against the source.')});
 return F}

if(typeof module!=='undefined')module.exports={pa,amt,pdte,isoOf,parseAll,parse,validate,fmt,num,nrm,mkCells,looksContact,CFG};
