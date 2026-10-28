// Cleaning engine (dates, phones, text case, ...) without a browser: node test/clean.engine.test.js   (no dependencies)
// It cuts the pure run() engine out of src/clean.src.html, so it always tests the real code.
const assert=require('assert'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','clean.src.html'),'utf8');
const a=src.indexOf('const O=[[1,'),b=src.indexOf('function cu(');assert.ok(a>0&&b>a,'engine markers not found in src/clean.src.html');
const E=new Function(src.slice(a,b)+';return{run,pd,tcase,pn,blank}')();
let pass=0,fail=0;const t=(n,f)=>{try{f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message)}};
const on=k=>Object.fromEntries(k.map(x=>[x,1]));
const R=(heads,rows,keys,cfg)=>E.run(rows.map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]]))),heads,on(keys),cfg||{});
const col=(o,h)=>o.R.map(r=>r.d[h]);
const issues=o=>o.flags.map(f=>f.Issue);

t('E1 mixed date formats become yyyy-mm-dd; impossible dates are flagged, not guessed',()=>{
 const o=R(['Invoice Date'],['05/03/2026','5-3-26','2026-03-05','5 Mar 2026','March 5, 2026','05.03.2026','13/03/2026','2026/3/5','5/3/2026 10:30 PM','12/12/2025','31/02/2026','Mar-26'].map(x=>[x]),[6]);
 assert.deepEqual(col(o,'Invoice Date').slice(0,10),['2026-03-05','2026-03-05','2026-03-05','2026-03-05','2026-03-05','2026-03-05','2026-03-13','2026-03-05','2026-03-05 22:30','2025-12-12']);
 assert.equal(col(o,'Invoice Date')[10],'31/02/2026');assert.ok(issues(o).some(x=>/Invalid, impossible/.test(x)))});
t('E2 a column NAMED like a date is recognised even when up to half the cells are junk, and the junk is flagged',()=>{
 const o=R(['Due Date'],['05/03/2026','06/03/2026','07/03/2026','not paid','10/03/2026','11/03/2026','pending','12/03/2026'].map(x=>[x]),[6]);
 assert.equal(col(o,'Due Date')[0],'2026-03-05');assert.equal(col(o,'Due Date')[3],'not paid');assert.ok(o.flags.filter(f=>/Invalid, impossible/.test(f.Issue)).length===2);
 const p=R(['Remarks'],['05/03/2026','06/03/2026','07/03/2026','not paid','10/03/2026','11/03/2026','pending','12/03/2026'].map(x=>[x]),[6]);assert.equal(p.changes.length,0)});
t('E3 when every date can be read either way the person is told it is a guess (one note per column)',()=>{
 const o=R(['Date'],[['03/04/2026'],['05/06/2026'],['01/02/2026'],['07/08/2026']],[6]);
 assert.deepEqual(col(o,'Date'),['2026-04-03','2026-06-05','2026-02-01','2026-08-07']);
 const g=o.flags.filter(f=>/Day\/month order is a guess/.test(f.Issue));assert.equal(g.length,1);assert.equal(g[0].Row,2);assert.ok(/4 dates/.test(g[0].Issue))});
t('E4 clear day/month evidence (a 25/03 in the column) means no warning',()=>{
 const o=R(['Date'],[['25/03/2026'],['04/05/2026'],['26/03/2026']],[6]);assert.equal(o.flags.length,0);assert.equal(col(o,'Date')[1],'2026-05-04')});
t('E5 a column that mixes day/month and month/day is flagged for a check',()=>{
 const o=R(['Date'],[['03/25/2026'],['04/05/2026'],['26/03/2026'],['06/07/2026']],[6]);
 assert.deepEqual(col(o,'Date').slice(0,3),['2026-03-25','2026-05-04','2026-03-26']);assert.ok(issues(o).some(x=>/Mixed date styles/.test(x)))});
t('E6 column type "Date (month/day/year)" reads 03/04/2026 as 4 March and gives no warning',()=>{
 const o=R(['Date'],[['03/04/2026'],['05/06/2026'],['01/02/2026']],[6],{roles:{Date:'dateus'}});
 assert.deepEqual(col(o,'Date'),['2026-03-04','2026-05-06','2026-01-02']);assert.equal(o.flags.length,0)});
t('E7 real Excel date cells never raise a day/month warning',()=>{const o=R(['Date'],[[new Date(2026,2,5,12)],[new Date(2026,3,6,12)]],[6]);assert.equal(o.flags.length,0)});
t('E8 text case: company, party, address and code columns are left alone; person names are cleaned',()=>{
 const o=R(['Party Name','Address','Customer Name','Item Code'],[['ABC TRADERS','MG ROAD','RAMESH KUMAR','abc-1'],['sharma stores','jaipur','suresh sharma','xyz-2']],[3]);
 assert.deepEqual(o.R.map(r=>r.d['Party Name']),['ABC TRADERS','sharma stores']);assert.deepEqual(o.R.map(r=>r.d.Address),['MG ROAD','jaipur']);assert.deepEqual(col(o,'Customer Name'),['Ramesh Kumar','Suresh Sharma']);assert.deepEqual(col(o,'Item Code'),['abc-1','xyz-2'])});
t('E9 text case details: u.p. -> U.P., RAM is a name, HDFC stays upper, D\'Souza',()=>{
 assert.equal(E.tcase('u.p.'),'U.P.');assert.equal(E.tcase('shree ram mfg co.'),'Shree Ram Mfg Co.');assert.equal(E.tcase('hdfc bank'),'HDFC Bank');assert.equal(E.tcase("d'souza"),"D'Souza");assert.equal(E.tcase('dr. anil gupta'),'Dr. Anil Gupta')});
t('E10 phones exported as 9876543210.0 are fixed, and flagged with a clear reason when only validating',()=>{
 const ph=['9876543210.0','98765 43210','+91 98765 43210','0141-2345678'].map(x=>[x]);
 const o=R(['Mobile'],ph,[8,16]);assert.deepEqual(col(o,'Mobile'),['9876543210','9876543210','9876543210','0141-2345678']);assert.equal(o.flags.length,1);
 const v=R(['Mobile'],ph,[8]);assert.ok(v.flags.some(f=>/trailing “\.0”/.test(f.Issue)&&f['Suggested correction']==='9876543210'))});
t('E11 amounts: Indian, European, rupee text, negatives in brackets',()=>{
 const o=R(['Amount'],['1500','1,50,000','Rs. 5,000/-','₹ 2,500','(500)','1.234,50'].concat(Array.from({length:10},(_,i)=>String(100+i))).map(x=>[x]),[5]);
 assert.deepEqual(col(o,'Amount').slice(0,6),[1500,150000,5000,2500,-500,1234.5])});
t('E12 outliers are flagged after text numbers are converted',()=>{
 const amt=Array.from({length:30},(_,i)=>[String(1000+i*10)]).concat([['100000'],['5']]);
 const o=R(['Amount'],amt,[5,13]);assert.deepEqual(issues(o).sort(),['Unusually high value','Unusually low value'])});
t('E13 duplicate rows are only removed when step 17 is chosen, and are kept in the Removed list',()=>{
 const rows=[['Ravi','9876543210'],['Ravi','9876543210'],['Sita','9111111111']];
 const f=R(['Name','Mobile'],rows,[1]);assert.equal(f.R.length,3);assert.equal(f.flags.length,1);
 const r=R(['Name','Mobile'],rows,[17]);assert.equal(r.R.length,2);assert.equal(r.removed.length,1)});
t('E14 50,000 rows with many steps finish in a few seconds',()=>{
 const heads=['Name','Mobile','Email','Date','Amount'],big=Array.from({length:50000},(_,i)=>({Name:'Cust '+(i%900),Mobile:'98765'+String(10000+i%90000),Email:'c'+(i%900)+'@x.com',Date:'0'+(i%28+1)+'/03/2026',Amount:String(500+i%300)}));
 const t0=Date.now();E.run(big,heads,on([1,2,3,4,5,6,7,8,12,13,16]),{});assert.ok(Date.now()-t0<8000,'took '+(Date.now()-t0)+' ms')});
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
