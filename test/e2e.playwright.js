// Real-browser end-to-end test. Run: npm i -D playwright && npx playwright install chromium && node test/e2e.playwright.js
// External CDNs are blocked on purpose (offline-safe): the OCR engine is replaced by a stub that returns known text,
// so this checks OUR wiring (scan -> parser -> review -> Send to Payments -> import), not Tesseract's accuracy.
const {chromium}=require('playwright'),path=require('path'),assert=require('assert');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
let ok=0;const t=(n,f)=>f().then(()=>{ok++;console.log('PASS',n)},e=>{console.log('FAIL',n,'-',e.message);process.exitCode=1});
const W=(x0,y0,s)=>({text:s,bbox:{x0,y0,x1:x0+s.length*14,y1:y0+22}});
const line=(y,txt,x=40)=>{let cx=x;const words=txt.split(' ').map(w=>{const o=W(cx,y,w);cx=o.bbox.x1+10;return o});return{text:txt,bbox:{x0:x,y0:y,x1:cx,y1:y+22},words}};
const LINES=[line(40,'Tax Invoice'),line(90,'Sold By: Acme Traders Pvt Ltd'),line(130,'Invoice No: INV-2026-001'),line(170,'Invoice Date: 05/03/2026'),line(210,'Due Date: 20/03/2026'),
 line(250,'Bill To: Zed Industries'),line(400,'Subtotal 1000.00'),line(440,'CGST 90.00'),line(480,'SGST 90.00'),line(520,'Grand Total 1180.00')];
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({acceptDownloads:true}),pg=await ctx.newPage();
 await pg.route(u=>!u.href.startsWith('file:')&&!u.href.startsWith('data:')&&!u.href.startsWith('about:')&&!u.href.startsWith('blob:'),r=>r.abort());
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+path.resolve('index.html'));
 await t('home shows 3 tools',async()=>{assert.equal(await pg.locator('.card').count(),3)});
 // ---- Invoices: scan -> OCR (stub) -> record
 await pg.click('.tab[data-t=invoice]');const inv=pg.frames().find(f=>f!==pg.mainFrame());await inv.waitForSelector('#fi',{state:'attached'});
 await inv.evaluate(L=>{window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{lines:L}})})}},LINES);
 await inv.setInputFiles('#fi',{name:'scan.png',mimeType:'image/png',buffer:PNG});
 await inv.click('#go');await inv.waitForFunction(()=>!busy,null,{timeout:15000});
 await t('scan is read through OCR path and flagged for review',async()=>{const r=await inv.evaluate(()=>({ocr:recs[0].ocr,noText:recs[0].noText,status:recs[0].status,no:recs[0].f.invNo.v,tot:recs[0].f.total.v,ven:recs[0].f.vendor.v,fd:recs[0].fd.map(x=>x.id)}));
  console.log('   ',JSON.stringify(r));assert(r.ocr&&!r.noText);assert.equal(r.status,'Needs Review');assert.equal(r.no,'INV-2026-001');assert(String(r.tot).includes('1180'));assert(r.fd.includes('R0o'))});
 await t('"Send to Payments" is visible inside BizPilot',async()=>{assert(await inv.locator('#xp').isVisible())});
 // ---- Send to Payments -> business chooser -> import
 await inv.click('#xp');const pay=pg.frames().find(f=>f.url()==='about:srcdoc'&&f!==inv&&f.name()!==undefined&&f!==pg.mainFrame()&&true,{});
 const P=pg.frames().filter(f=>f!==pg.mainFrame()).pop();await P.waitForSelector('#main');
 await t('payments opens with the file staged and asks "which one is your business?"',async()=>{await P.waitForSelector('text=Which one is your business?',{timeout:5000})});
 await t('one click on a name stages the invoice',async()=>{await P.click('button[data-a=setbiz]:has-text("Acme Traders")');await P.waitForSelector('button[data-a=commit]:not([disabled])',{timeout:5000})});
 await t('import puts it in Overview',async()=>{await P.click('button[data-a=commit]');await P.waitForSelector('text=Outstanding');const n=await P.evaluate(()=>M.inv.length);assert.equal(n,1);assert.equal(await P.evaluate(()=>M.S.business),'Acme Traders Pvt Ltd')});
 await t('business name is remembered: next file needs no question',async()=>{await P.evaluate(r=>receiveRows('again.csv',r),[['Invoice number','Supplier','Buyer','Grand total (reported)','Currency','Due date (ISO)'],['INV-2','Acme Traders Pvt Ltd','Q Co','500','INR','2026-09-01']]);
  await P.waitForSelector('button[data-a=commit]:not([disabled])');assert.equal(await P.locator('text=Which one is your business?').count(),0)});
 await t('backup downloads valid JSON',async()=>{await P.evaluate(()=>{T='imp';render()});const [d]=await Promise.all([pg.waitForEvent('download'),P.click('button[data-a=backup]')]);const j=JSON.parse(require('fs').readFileSync(await d.path(),'utf8'));assert.equal(j.v,1);assert.equal(j.inv.length,1)});
 await t('no uncaught page errors',async()=>assert.deepEqual(errs,[]));
 await b.close();console.log(ok+' e2e checks passed');
})();
