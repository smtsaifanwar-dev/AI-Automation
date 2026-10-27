/* Column value explorer: pure logic, no DOM. Embedded into clean.src.html by build.js, unit-tested in test/clean.values.test.js.
   CleanVal.analyze(rows, col, isBlank) -> {
     nonBlank, blank, category,            // counts + "does this column look like a list of categories?"
     unique:[{v,n,rows,flag}],             // every distinct value, most frequent first
     flags:Map(value -> flag),             // only flagged values
     strong, strongCells                   // how many values / cells look like mistakes
   }
   flag = {kind:'case'|'space'|'typo'|'type'|'rare'|'blank', strong:bool, msg, to?}
   Nothing is ever changed here; the UI decides what to apply. */
const CleanVal=(function(){
 const BL='(blank)';
 const isNum=v=>typeof v==='number'?!isNaN(v):/^[-+(]?\s*(?:rs\.?|inr)?\s*[₹$€£]?\s*\d[\d,]*(\.\d+)?\s*\)?\s*(\/-)?$/i.test(String(v).trim());
 const show=v=>v instanceof Date?(isNaN(v)?'':v.toISOString().slice(0,10)):String(v);
 const key=(v,isBlank)=>isBlank(v)?BL:show(v);
 const clean=s=>s.trim().replace(/\s+/g,' ');
 const norm=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim();
 // optimal string alignment distance (counts a swap of two neighbours as ONE edit: "Dehli" vs "Delhi")
 function osa(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const d=[];for(let i=0;i<=m;i++){d[i]=[i];}for(let j=1;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}return d[m][n]}
 const quality=s=>(s===s.trim()?4:0)+(/[a-z]/.test(s)&&/[A-Z]/.test(s)?2:0)+(/^\p{Lu}/u.test(s)?1:0);
 function analyze(rows,col,isBlank){
  const m=new Map();let nb=0,bl=0;
  for(const r of rows){const v=r.d[col];if(isBlank(v)){bl++;let e=m.get(BL);if(!e){e={v:BL,n:0,rows:[],blank:true};m.set(BL,e)}e.n++;e.rows.push(r.r);continue}
   nb++;const k=show(v);let e=m.get(k);if(!e){e={v:k,n:0,rows:[],raw:v};m.set(k,e)}e.n++;e.rows.push(r.r)}
  const all=[...m.values()].sort((a,b)=>b.n-a.n||String(a.v).localeCompare(String(b.v))),U=all.filter(e=>!e.blank);
  const numN=U.reduce((s,e)=>s+(isNum(e.raw)?e.n:0),0),numeric=nb>=10&&numN/nb>=.9,textual=nb>0&&numN/nb<=.1;
  // group spellings that are the same word written differently (Delhi / delhi / DELHI / "Delhi ")
  const G=new Map();U.forEach(e=>{const k=norm(e.v);if(!G.has(k))G.set(k,[]);G.get(k).push(e)});
  const keys=G.size,avgLen=nb?U.reduce((s,e)=>s+e.v.length*e.n,0)/nb:0;
  const category=nb>=4&&textual&&keys<=80&&keys<=Math.max(10,nb*.5)&&avgLen<=40;
  const flags=new Map(),setF=(e,f)=>{e.flag=f;flags.set(e.v,f)};
  const grp=[];
  G.forEach((es,k)=>{const top=es.slice().sort((a,b)=>(b.n*1000+quality(b.v))-(a.n*1000+quality(a.v)))[0],to=clean(top.v),total=es.reduce((s,e)=>s+e.n,0);grp.push({k,es,to,total});
   if(numeric)return;
   es.forEach(e=>{if(e.v===to)return;
    const sp=clean(e.v)===to;
    setF(e,sp?{kind:'space',strong:true,to,msg:'Extra spaces – should be “'+to+'”'}:{kind:'case',strong:true,to,msg:'Same as “'+to+'” ('+top.n+' rows) but written differently'})})});
  // typos: a rare spelling that is 1-2 edits away from a clearly more common one
  if(category)grp.forEach(a=>{const la=a.k.length;let best=null;
   grp.forEach(b=>{if(a===b||b.total<Math.max(3,a.total*3))return;const lb=b.k.length,mn=Math.min(la,lb);if(mn<4)return;
    if(a.k.replace(/\D/g,'')!==b.k.replace(/\D/g,''))return;           // "Zone 1" vs "Zone 2" are different things
    const thr=mn>=9?2:1,d=osa(a.k,b.k);if(d<1||d>thr)return;
    if(!best||d<best.d||(d===best.d&&b.total>best.b.total))best={d,b}});
   if(best){const to=best.b.to;a.es.forEach(e=>setF(e,{kind:'typo',strong:true,to,msg:'Looks like a typo of “'+to+'” ('+best.b.total+' rows)'}))}});
  // wrong kind of value
  if(category&&nb>=10)U.forEach(e=>{if(isNum(e.raw)&&!e.flag)setF(e,{kind:'type',strong:true,msg:'A number in a column of text'})});
  if(numeric)U.forEach(e=>{if(!isNum(e.raw))setF(e,{kind:'type',strong:true,msg:'Text in a column of numbers'})});
  // soft hint (not highlighted in the table): appears once while almost everything else is repeated
  if(category&&keys<=30&&nb>=20){const common=U.filter(e=>e.n>=3).reduce((s,e)=>s+e.n,0);
   if(common>=nb*.9)U.forEach(e=>{if(e.n===1&&!e.flag)setF(e,{kind:'rare',strong:false,msg:'Appears only once – check the spelling'})})}
  const be=m.get(BL);if(be)setF(be,{kind:'blank',strong:false,msg:'Empty cells (includes placeholders like N/A, -, none)'});
  let strong=0,strongCells=0;flags.forEach((f,v)=>{if(f.strong){strong++;strongCells+=m.get(v).n}});
  return{nonBlank:nb,blank:bl,category,numeric,unique:all,flags,strong,strongCells}}
 // [{from,to,rows,n}] for every flagged value that has a suggested spelling (typo targets are resolved one step)
 function fixPlan(an){const out=[];an.unique.forEach(e=>{const f=e.flag;if(!f||!f.strong||f.to===undefined)return;
  let to=f.to;const t=an.unique.find(x=>x.v===to&&x.flag&&x.flag.strong&&x.flag.to!==undefined&&x.flag.to!==to);if(t)to=t.flag.to;
  if(to!==e.v)out.push({from:e.v,to,rows:e.rows,n:e.n})});return out}
 return{analyze,fixPlan,show,key,osa,norm,isNum,BL};
})();
if(typeof module!=='undefined')module.exports=CleanVal;
