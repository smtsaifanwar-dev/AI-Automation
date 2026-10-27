// Smart drop zone detection: node test/detect.test.js   (no dependencies)
const assert=require('assert'),fs=require('fs'),path=require('path'),D=require('../src/detect.js');
let pass=0,fail=0;const t=(n,f)=>{try{f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message)}};
const k=h=>D.detect(h);
t('D1 classic receivables sheet is a sure payment sheet',()=>{const r=k(['Invoice No','Customer','Invoice Date','Due Date','Total','Amount Paid','Status']);assert.equal(r.kind,'payments');assert.equal(r.sure,true)});
t('D2 BizPilot invoice-tool export maps to payments',()=>{const r=k(['Invoice number','Supplier','Customer','Invoice date','Due date','Grand total','Currency']);assert.equal(r.kind,'payments');assert.equal(r.sure,true)});
t('D3 Indian party ledger: Party, Bill No, Balance, Due',()=>{assert.equal(k(['Party Name','Bill No.','Bill Date','Due On','Outstanding']).sure,true)});
t('D4 plain customer list is Clean (sure)',()=>{const r=k(['Name','Email','Phone','City','Joined']);assert.deepEqual([r.kind,r.sure],['clean',true])});
t('D5 sales / order data is Clean even with amount + status',()=>{const r=k(['Order ID','Customer','Product','Qty','Amount','Status','Date']);assert.deepEqual([r.kind,r.sure],['clean',true])});
t('D6 invoice register WITHOUT due/paid/balance is not sure (sales register or receivables?)',()=>{const r=k(['Invoice No','Customer','Date','Amount']);assert.deepEqual([r.kind,r.sure],['payments',false])});
t('D7 only a due date + amount is not sure',()=>{const r=k(['Task','Due Date','Amount']);assert.equal(r.sure,false)});
t('D8 "Amount Paid" alone, "Payment Method", "Unpaid" do not fool it',()=>{assert.equal(k(['Name','Payment Method','City']).kind,'clean');assert.equal(k(['Item','Price','Qty']).kind,'clean')});
t('D9 headers in any case / punctuation',()=>{assert.equal(k(['INVOICE_NO','CLIENT NAME','DUE-DATE','AMOUNT']).sure,true)});
t('D10 empty / junk headers do not crash',()=>{assert.equal(k([]).kind,'clean');assert.equal(k(null).kind,'clean');assert.equal(k(['',null,undefined]).kind,'clean')});
t('D11 header row is found below a title block',()=>{const aoa=[['Sharma Traders – Receivables'],[],['Invoice No','Customer','Due Date','Balance'],['A1','Ravi','2026-10-01',500]];assert.deepEqual(D.headersOf(aoa),['Invoice No','Customer','Due Date','Balance'])});
t('D12 found[] lists what matched, in plain words',()=>{assert.ok(k(['Invoice No','Due Date','Total']).found.includes('due date'))});
t('D13 index.html embeds exactly src/detect.js (run "node build.js" if this fails)',()=>{const h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),m=h.match(/\/\*DETECT-BEGIN\*\/\n([\s\S]*?)\n\/\*DETECT-END\*\//);assert.ok(m,'markers missing');assert.equal(m[1],fs.readFileSync(path.join(__dirname,'..','src/detect.js'),'utf8').trimEnd())});
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
