/* Spreadsheet type detection for the home-page smart drop zone. Pure, no DOM.
   Embedded into index.html between the DETECT-BEGIN / DETECT-END markers by build.js; tested in test/detect.test.js.
   detect(headers) -> {kind:'payments'|'clean', sure:bool, found:[labels]}
   Rule of thumb: a sheet is a payment sheet only if it tracks money owed (due date / paid / balance) AND identifies the invoice or customer.
   Anything in between is "not sure": the home page then asks, with this guess highlighted. */
const BPDetect=(function(){
 const nk=s=>String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]/g,'');
 const T={
  invNo:{l:'invoice number',t:h=>/^(invoice|bill|inv)(no|num|number|id)?$/.test(h)||/invoice(no|num|number)|billno|billnumber|invno/.test(h)},
  party:{l:'customer',t:h=>/customer|client|party|buyer|debtor/.test(h)},
  due:{l:'due date',t:h=>/^due$|duedate|paymentdue|dueon|datedue|duedt/.test(h)},
  paid:{l:'amount paid',t:h=>/paid|received|receipt/.test(h)&&!/unpaid/.test(h)},
  outstanding:{l:'balance',t:h=>/outstanding|balance|pending|unpaid|amountdue|balancedue|receivable/.test(h)},
  amount:{l:'amount',t:h=>/total|amount|billvalue|invoicevalue/.test(h)}
 };
 function detect(headers){
  const h=(headers||[]).map(nk).filter(Boolean),hit={};
  for(const k in T)hit[k]=h.some(T[k].t);
  const found=Object.keys(T).filter(k=>hit[k]).map(k=>T[k].l);
  const track=hit.due||hit.paid||hit.outstanding,idish=hit.invNo||hit.party,money=hit.amount||hit.paid||hit.outstanding;
  if(track&&idish&&money)return{kind:'payments',sure:true,found};
  if((hit.due&&(idish||money))||(hit.invNo&&hit.party&&hit.amount))return{kind:'payments',sure:false,found};
  return{kind:'clean',sure:true,found};
 }
 // the header row is the first row (of the top 12) that has several text cells
 function headersOf(aoa){
  const rows=(aoa||[]).slice(0,12),cnt=r=>r.filter(v=>String(v==null?'':v).trim()!=='').length,mx=Math.max(0,...rows.map(cnt));
  const isText=r=>r.filter(v=>typeof v==='string'&&v.trim()!=='').length;
  const r=rows.find(r=>mx>1&&cnt(r)>=Math.ceil(mx*.6)&&isText(r)>=Math.ceil(mx*.6));
  return r?r.map(v=>String(v==null?'':v).trim()):[];
 }
 return{detect,headersOf,nk};
})();
if(typeof module!=='undefined')module.exports=BPDetect;
