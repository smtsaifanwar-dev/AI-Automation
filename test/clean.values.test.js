// Column value explorer logic: node test/clean.values.test.js   (no dependencies)
const assert=require('assert'),V=require('../src/clean-values.js');
let pass=0,fail=0;const t=(n,f)=>{try{f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'\n  ',e.message)}};
const PH=/^(n\/?a|nan|nil|null|none|missing|not available|tbd|#n\/a|-+|\?+|\.+)$/i;
const blank=v=>v===''||v==null||(typeof v==='string'&&(!v.trim()||PH.test(v.trim())));
const col=(vals)=>vals.map((v,i)=>({r:i+2,d:{C:v}}));
const rep=(v,n)=>Array(n).fill(v);
const an=vals=>V.analyze(col(vals),'C',blank);
const F=(a,v)=>a.flags.get(v);

t('C1 case / spacing variants point at the most common spelling',()=>{
 const a=an([...rep('Delhi',40),...rep('delhi',2),'DELHI','Delhi ',...rep('Jaipur',20)]);
 assert.equal(F(a,'delhi').to,'Delhi');assert.equal(F(a,'DELHI').to,'Delhi');assert.equal(F(a,'Delhi ').kind,'space');assert.equal(F(a,'Delhi ').to,'Delhi');
 assert.ok(!F(a,'Delhi')&&!F(a,'Jaipur'));assert.equal(a.strong,3);assert.equal(a.strongCells,4)});
t('C2 a trailing-space spelling that is the MAJORITY is still cleaned',()=>{
 const a=an([...rep('Pune ',30),...rep('Pune',2),...rep('Surat',10)]);assert.equal(F(a,'Pune ').to,'Pune');assert.equal(F(a,'Pune ').kind,'space')});
t('C3 typos of a frequent value, including swapped letters',()=>{
 const a=an([...rep('Mumbai',30),'Mumbay','Dehli',...rep('Delhi',25),...rep('Pune',10)]);
 assert.equal(F(a,'Mumbay').to,'Mumbai');assert.equal(F(a,'Mumbay').kind,'typo');assert.equal(F(a,'Dehli').to,'Delhi')});
t('C4 no false alarms: Male/Female, UP/MP, Zone 1/Zone 2, two common near names',()=>{
 const a=an([...rep('Male',50),...rep('Female',50)]);assert.equal(a.strong,0);
 const b=an([...rep('UP',20),...rep('MP',20),...rep('HP',4)]);assert.equal(b.strong,0);
 const c=an([...rep('Zone 1',20),...rep('Zone 2',20)]);assert.equal(c.strong,0);
 const d=an([...rep('Rajkot',20),...rep('Rajput',15)]);assert.equal(d.strong,0)});
t('C5 a column of mostly different names is not a category: no typo guesses',()=>{
 const names=['Rahul Sharma','Rahul Sharna','Amit Jain','Amit Jaim','Priya Singh','Sunita Rao','Vikram Das','Neha Gupta','Karan Mehta','Pooja Nair','Arjun Reddy','Kiran Patel'];
 const a=an(names);assert.equal(a.category,false);assert.equal(a.strong,0)});
t('C6 number in a text column / text in a number column',()=>{
 const a=an([...rep('Paid',15),...rep('Pending',10),'123']);assert.equal(F(a,'123').kind,'type');
 const b=an([...rep(100,12),...rep(250,5),'abc']);assert.equal(F(b,'abc').kind,'type');assert.equal(b.numeric,true)});
t('C7 blanks and placeholders are one group, not a "mistake"',()=>{
 const a=an([...rep('Paid',10),'',null,'N/A','-']);const e=a.unique.find(x=>x.v==='(blank)');assert.equal(e.n,4);assert.equal(a.blank,4);assert.equal(F(a,'(blank)').strong,false);assert.equal(a.strong,0)});
t('C8 rare value is only a soft hint',()=>{
 const a=an([...rep('Paid',20),...rep('Pending',15),'Pndng2']);assert.equal(F(a,'Pndng2').kind,'rare');assert.equal(F(a,'Pndng2').strong,false);assert.equal(a.strong,0)});
t('C9 fixPlan lists what to change, with row numbers',()=>{
 const a=an([...rep('Delhi',10),'delhi','DELHI']);const p=V.fixPlan(a);assert.equal(p.length,2);assert.ok(p.every(x=>x.to==='Delhi'&&x.rows.length===1));assert.equal(p[0].rows[0]>=2,true)});
t('C10 dates show as yyyy-mm-dd; Hindi text works',()=>{
 assert.equal(V.show(new Date(Date.UTC(2026,9,27))),'2026-10-27');
 const a=an([...rep('दिल्ली',12),'दिल्ली ',...rep('जयपुर',6)]);assert.equal(F(a,'दिल्ली ').to,'दिल्ली')});
t('C11 distance helper: swap counts as one edit',()=>{assert.equal(V.osa('dehli','delhi'),1);assert.equal(V.osa('abc','abc'),0);assert.equal(V.osa('kitten','sitting'),3)});
t('C12 empty / tiny columns do not crash',()=>{assert.equal(an([]).unique.length,0);assert.equal(an(['x']).strong,0);assert.equal(an([null,null]).blank,2)});

// ---- values that belong to another column, rare values, remembered fixes
const exp=spec=>spec.flatMap(([v,n])=>rep(v,n));
const tbl=cols=>{const n=Math.max(...Object.values(cols).map(c=>c.length)),rows=[];for(let i=0;i<n;i++){const d={};for(const k in cols)d[k]=cols[k][i]??'x';rows.push({r:i+2,d})}return rows};
t('C13 a value from ANOTHER column (State written in City) is a sure mistake, with the column named',()=>{
 const city=exp([['Delhi',300],['Mumbai',250],['Jaipur',200],['Pune',100],['Rajasthan',3],['Maharashtra',2]]),state=exp([['Rajasthan',300],['Maharashtra',250],['Delhi',200],['Gujarat',100]]);
 const rows=tbl({City:city,State:state}),ctx=V.context(rows,['City','State'],blank),a=V.analyze(rows,'City',blank,ctx);
 assert.equal(F(a,'Rajasthan').kind,'wrongcol');assert.equal(F(a,'Rajasthan').strong,true);assert.ok(/State/.test(F(a,'Rajasthan').msg));assert.equal(F(a,'Maharashtra').kind,'wrongcol');
 assert.equal(F(a,'Delhi'),undefined);assert.equal(F(a,'Mumbai'),undefined)});
t('C14 no false alarm when two columns share the same list (Billing city / Shipping city)',()=>{
 const b=exp([['Delhi',200],['Mumbai',150],['Pune',100],['Jaipur',3]]),s2=exp([['Delhi',180],['Mumbai',120],['Pune',90],['Jaipur',60]]);
 const rows=tbl({Billing:b,Shipping:s2}),a=V.analyze(rows,'Billing',blank,V.context(rows,['Billing','Shipping'],blank));
 assert.notEqual(F(a,'Jaipur')&&F(a,'Jaipur').kind,'wrongcol');assert.equal(a.strong,0)});
t('C15 rarely used values are counted as soft hints (weak), never as sure mistakes',()=>{
 const a=an(exp([['Sales',200],['HR',100],['Finance',120],['IT',90],['Admin',2],['H R',2],['Accounts',1],['Mktg',1]]));
 assert.equal(a.strong,0);assert.equal(a.weak,4);assert.equal(a.weakCells,6);assert.equal(F(a,'Admin').kind,'rare');assert.equal(F(a,'Admin').strong,false)});
t('C16 a legitimate long tail is not flooded with hints (more than 25 rare values: none)',()=>{
 const tail=Array.from({length:30},(_,i)=>['Misc'+i,1]);const a=an(exp([['A',400],['B',300],...tail]));assert.equal(a.weak,0)});
t('C17 fixes remembered from an earlier file come back as sure suggestions and are in the fix plan',()=>{
 const vals=exp([['Mumbai',50],['Delhi',40],['Bombay',3]]);
 const a=V.analyze(col(vals),'C',blank,{saved:{Bombay:'Mumbai','__proto__':'x'}});
 assert.equal(F(a,'Bombay').kind,'saved');assert.equal(F(a,'Bombay').to,'Mumbai');assert.equal(a.strong,1);
 assert.ok(V.fixPlan(a).some(x=>x.from==='Bombay'&&x.to==='Mumbai'&&x.n===3));
 const b=an(vals);assert.equal(F(b,'Bombay')&&F(b,'Bombay').kind,'rare')});
t('C18 context skips columns with many different values (names, ids) and numeric columns',()=>{
 const rows=tbl({Name:Array.from({length:400},(_,i)=>'Person '+i),Amt:Array.from({length:400},(_,i)=>i*5),City:exp([['Delhi',200],['Pune',200]])});
 assert.deepEqual(V.context(rows,['Name','Amt','City'],blank).others.map(o=>o.name),['City'])});

console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
