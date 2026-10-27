// Run: node test/invoice.test.js   (no dependencies)
// Covers the invoice reader's pure logic (src/invoice-core.js): amount/date parsing, field extraction, total/tax validation.
// Each invoice below is a layout-shaped fixture: rows of [x-position, text] cells, the same shape pdf.js / OCR produce.
const C=require('../src/invoice-core.js'),assert=require('assert'),fs=require('fs'),path=require('path');let ok=0,bad=0;
const t=(n,f)=>{try{f();ok++;console.log('PASS',n)}catch(e){bad++;console.log('FAIL',n,'-',e.message)}};

/* ---------- fixture builder ---------- */
function read(rows){let Y=800;const L=rows.map(cells=>{Y-=14;const cs=cells.map(([x,s])=>({x,x2:x+s.length*5.2,s}));return{p:1,y:Y,t:cs.map(c=>c.s).join('  '),cells:cs}});
 const z=C.parseAll(L),rec={f:z.f,items:z.items,rates:z.rates,fd:[],edits:[],ocr:false};rec.fd=C.validate(rec);return{z,f:z.f,ids:rec.fd.map(x=>x.id),sev:rec.fd.map(x=>x.sev+':'+x.id)}}
const v=(r,k)=>r.f[k].v;
const TABLE=[[[20,'S.No'],[60,'Description'],[240,'HSN'],[300,'Qty'],[350,'Rate'],[420,'Amount']],
 [[20,'1'],[60,'Cotton Fabric'],[240,'5208'],[300,'10'],[350,'1,000.00'],[420,'10,000.00']],
 [[20,'2'],[60,'Stitching Service'],[240,'9988'],[300,'5'],[350,'400.00'],[420,'2,000.00']]];

/* ---------- pa(): money in every format we meet ---------- */
const PA=[['1,18,000.00',118000],['1,234.50',1234.5],['1.234,50',1234.5],['12.500,00',12500],['1 234,50',1234.5],['5000/-',5000],['Rs 5,000.50',5000.5],['Rs. 5,000',5000],
 ['₹1,23,456.78',123456.78],['(1,000.00)',-1000],['-500',-500],['1,234',1234],['1234,5',1234.5],['1.234.567',1234567],['0.50',0.5],['EUR 1.234,50',1234.5],['$ -20.00',-20]];
t('P1 pa() reads Indian, European, spaced, suffixed and negative amounts',()=>PA.forEach(([s,e])=>assert.equal(C.pa(s),e,JSON.stringify(s)+' => '+C.pa(s)+', expected '+e)));
t('P2 pa() empty is null, junk is NaN (never a wrong number)',()=>{assert.equal(C.pa(''),null);assert.equal(C.pa(null),null);['abc','12 34 5'].forEach(x=>assert.ok(Number.isNaN(C.pa(x)),x))});
t('P3 the 100x bug: "1 234,50" is no longer 123450',()=>assert.notEqual(C.pa('1 234,50'),123450));
t('P4 amt() takes the last amount on a line and ignores tax rates',()=>{assert.equal(C.amt('CGST @ 9%   1,080.00'),1080);assert.equal(C.amt('Grand Total  EUR 1.234,63'),1234.63);assert.equal(C.amt('Total: 5,000.'),5000);assert.equal(C.amt('Sub Total  ₹ 12,000.00'),12000);assert.equal(C.amt('no numbers here'),null)});

/* ---------- dates ---------- */
t('D1 dates: numeric, month-name and month-first',()=>{const iso=s=>C.pdte(s).iso;assert.equal(iso('15-Oct-2026'),'2026-10-15');assert.equal(iso('15/10/2026'),'2026-10-15');assert.equal(iso('2026-10-15'),'2026-10-15');
 assert.equal(iso('October 27, 2026'),'2026-10-27');assert.equal(iso('Oct 27th 2026'),'2026-10-27');assert.equal(iso('27 October 2026'),'2026-10-27');assert.equal(C.pdte('31/02/2026').bad,true);assert.ok(!C.pdte('Foo 27, 2026').iso,'an unknown month name must never produce a date')});
t('D2 ambiguous day/month is reported as such',()=>assert.equal(C.pdte('05/06/2026').amb,true));

/* ---------- full invoices ---------- */
const A=()=>read([[[20,'TAX INVOICE']],[[20,'Invoice No: INV-2026-041'],[300,'Date: 15-Oct-2026']],[[20,'Supplier'],[300,'Bill To']],[[20,'Shree Textiles Pvt Ltd'],[300,'Raj Garments']],[[20,'GSTIN: 08ABCDE1234F1Z5'],[300,'GSTIN: 08PQRST5678G1Z2']],...TABLE,
 [[300,'Sub Total'],[420,'12,000.00']],[[300,'CGST @ 9%'],[420,'1,080.00']],[[300,'SGST @ 9%'],[420,'1,080.00']],[[300,'Grand Total'],[420,'₹ 14,160.00']]]);
t('A1 standard GST invoice: every field read, no findings',()=>{const r=A();assert.equal(v(r,'invNo'),'INV-2026-041');assert.equal(v(r,'vendor'),'Shree Textiles Pvt Ltd');assert.equal(v(r,'buyer'),'Raj Garments');assert.equal(v(r,'vGst'),'08ABCDE1234F1Z5');
 assert.equal(v(r,'subtotal'),12000);assert.equal(v(r,'total'),14160);assert.equal(v(r,'cur'),'INR');assert.equal(r.z.items.length,2);assert.deepEqual(r.ids,[])});
t('A2 wrong grand total is a CRITICAL finding',()=>{const r=read([[[20,'TAX INVOICE']],[[20,'Invoice No: Z-1'],[300,'Date: 15-Oct-2026']],[[20,'Supplier'],[300,'Bill To']],[[20,'Alpha Traders'],[300,'Beta Stores']],
 [[300,'Sub Total'],[420,'10,000.00']],[[300,'CGST @ 9%'],[420,'900.00']],[[300,'SGST @ 9%'],[420,'900.00']],[[300,'Grand Total'],[420,'12,500.00']]]);assert.ok(r.sev.includes('critical:R7'),r.sev.join())});
t('A3 GST invoice without a currency symbol is read as INR',()=>{const r=read([[[20,'TAX INVOICE']],[[20,'Invoice No: Z-2'],[300,'Date: 15-Oct-2026']],[[20,'Supplier'],[300,'Bill To']],[[20,'Alpha Traders'],[300,'Beta Stores']],[[300,'CGST @ 9%'],[420,'900.00']],[[300,'Grand Total'],[420,'12,500.00']]]);assert.equal(v(r,'cur'),'INR')});

t('B1 "Net Total" is the grand total, "To:" is the buyer, and the total row is not a line item',()=>{
 const r=read([[[20,'INVOICE']],[[20,'Bill No. 778'],[300,'Dated 15/10/2026']],[[20,'From'],[300,'To']],[[20,'Mehta & Sons'],[300,'Jaipur Retail LLP']],[[20,'Particulars'],[200,'Qty'],[260,'Rate'],[340,'Amount']],[[20,'Widgets'],[200,'4'],[260,'250.00'],[340,'1,000.00']],[[250,'Net Total'],[340,'1,180.00']]]);
 assert.equal(v(r,'total'),1180);assert.equal(v(r,'buyer'),'Jaipur Retail LLP');assert.equal(v(r,'vendor'),'Mehta & Sons');assert.equal(r.z.items.length,1)});
t('B2 other total labels: Invoice Value, Amount Due, Balance Due',()=>['Invoice Value','Amount Due','Balance Due','Total Payable'].forEach(l=>{
 const r=read([[[20,'TAX INVOICE']],[[20,'Invoice No: Q-1'],[300,'Date: 15-Oct-2026']],[[250,l],[340,'2,500.00']]]);assert.equal(v(r,'total'),2500,l)}));

t('C1 logo-only letterhead: a date or a label is NEVER guessed as the supplier',()=>{
 const r=read([[[20,'Invoice']],[[20,'Invoice number'],[200,'AB-10234']],[[20,'Date of issue'],[200,'October 27, 2026']],[[20,'Bill to']],[[20,'Acme Corp']],[[300,'Subtotal'],[420,'$1,000.00']],[[300,'Total'],[420,'$1,000.00']]]);
 assert.equal(v(r,'vendor'),null);assert.equal(v(r,'invDate'),'October 27, 2026');assert.equal(v(r,'cur'),'USD');assert.ok(r.ids.includes('R1'),'missing supplier must be reported')});
t('C2 "Subtotal" / "Qty" / "Rate" are never a supplier name',()=>{
 const r=read([[[20,'Rechnung / Invoice']],[[20,'Invoice No: 55']],[[20,'Subtotal'],[200,'Quantity'],[300,'Rate']],[[300,'Grand Total'],[420,'900.00']]]);assert.equal(v(r,'vendor'),null)});
t('C3 a supplier guessed from far down the page is only LOW confidence',()=>{
 const rows=[];for(let i=0;i<6;i++)rows.push([[20,'Page '+(i+1)+' of 9']]);rows.push([[20,'Kumar Brothers Hardware']],[[300,'Grand Total'],[420,'900.00']]);
 const r=read(rows);if(v(r,'vendor'))assert.equal(r.f.vendor.c,'low')});

t('D1 European amounts: total 1.234,63 is read as 1234.63 (was 463)',()=>{
 const r=read([[[20,'Rechnung / Invoice']],[[20,'Invoice No: 55']],[[20,'Date: 15.10.2026']],[[300,'Subtotal'],[420,'1.037,50']],[[300,'VAT 19%'],[420,'197,13']],[[300,'Grand Total'],[420,'€ 1.234,63']]]);
 assert.equal(v(r,'subtotal'),1037.5);assert.equal(v(r,'total'),1234.63);assert.equal(v(r,'cur'),'EUR');assert.ok(r.sev.includes('critical:R7'),'VAT is not a supported tax field, so the mismatch must be flagged, not hidden')});
t('D2 retail invoice: supplier, total and line item read',()=>{
 const r=read([[[20,'TAX INVOICE']],[[20,'Invoice No: R-9001'],[300,'Date: 15-10-2026']],[[20,'Seller'],[300,'Customer']],[[20,'City Mart'],[300,'Walk-in']],[[20,'Item'],[200,'Qty'],[260,'MRP'],[340,'Amount']],[[20,'Rice 5kg'],[200,'2'],[260,'450.00'],[340,'900.00']],[[250,'Total'],[340,'900.00']]]);
 assert.equal(v(r,'vendor'),'City Mart');assert.equal(v(r,'total'),900);assert.equal(r.z.items.length,1)});

/* ---------- build integrity ---------- */
t('Z1 index.html embeds exactly the current src/ (run "node build.js" if this fails)',()=>{
 const root=path.join(__dirname,'..'),R=f=>fs.readFileSync(path.join(root,f),'utf8'),h=R('index.html');
 const want={clean:R('src/clean.src.html').replace('/*CLEANVAL*/',()=>R('src/clean-values.js')),invoice:R('src/invoice.src.html').replace('/*INVCORE*/',()=>R('src/invoice-core.js')),payments:R('src/payments.src.html').replace('/*CORE*/',()=>R('src/core.js')),audit:R('src/audit.src.html').replace('/*CORE*/',()=>R('src/audit-core.js'))};
 for(const k in want){const m=h.match(new RegExp('<script type="text/plain" id="src-'+k+'">([^<]*)</script>'));assert.ok(m,'no block for '+k);assert.equal(Buffer.from(m[1],'base64').toString('utf8'),want[k],k+' is out of date')}});

/* ---------- payments: unreadable saved data must never be overwritten ---------- */
t('S1 payments load(): damaged or newer-version data is protected, valid data loads, empty starts fresh',()=>{
 const vm=require('vm'),src=fs.readFileSync(path.join(__dirname,'..','src/payments.src.html'),'utf8'),a=src.indexOf('const KEY='),b=src.indexOf('const today=');assert.ok(a>0&&b>a);
 const run=raw=>{const store=raw===undefined?{}:{'bpPaymentFollowUp.v1':raw},ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,x)=>{store[k]=x}},JSON,Object,Array};vm.createContext(ctx);
  vm.runInContext(src.slice(a,b)+';this.api={M:()=>M,R:()=>RESCUE,save,edit:()=>{M.inv.push({id:"x"})}}',ctx);return{api:ctx.api,store}};
 let r=run('{"v":1,"S":{"business":"Acme"},"inv":[{"id":"a"}],"pay":[],"con":[],"tsk":[],"bat":[]}');assert.equal(r.api.R(),null);assert.equal(r.api.M().inv.length,1);assert.equal(r.api.M().S.business,'Acme');
 r=run(undefined);assert.equal(r.api.R(),null);assert.equal(r.api.M().inv.length,0);
 const bad='{"v":1,"inv":[{"id":"a"},{"id":"b"}] TRUNCATED';r=run(bad);assert.equal(r.api.R(),bad);r.api.edit();r.api.save();assert.equal(r.store['bpPaymentFollowUp.v1'],bad,'damaged data was overwritten');
 const newer='{"v":2,"inv":[{"id":"a"}]}';r=run(newer);assert.equal(r.api.R(),newer);r.api.save();assert.equal(r.store['bpPaymentFollowUp.v1'],newer,'newer-version data was overwritten')});

console.log(`\n${ok} passed, ${bad} failed`);process.exit(bad?1:0);
