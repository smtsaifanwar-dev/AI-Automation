// Embeds src/payments.src.html (+src/core.js) into index.html as a third tool. Safe to re-run.
const fs=require('fs'),core=fs.readFileSync('src/core.js','utf8'),src=fs.readFileSync('src/payments.src.html','utf8').replace('/*CORE*/',()=>core);
fs.writeFileSync('payments.html',src);
let h=fs.readFileSync('index.html','utf8');
const b64=Buffer.from(src,'utf8').toString('base64'),tag=`<script type="text/plain" id="src-payments">${b64}</script>\n`;
const rep=(a,b)=>{if(!h.includes(a))throw Error('anchor missing: '+a.slice(0,50));h=h.replace(a,()=>b)};
if(h.includes('id="src-payments"'))h=h.replace(/<script type="text\/plain" id="src-payments">[^<]*<\/script>\n/,()=>tag);
else{
 rep('</nav>',''); // sanity
 rep('data-t="invoice" aria-selected="false">Invoices</button>','data-t="invoice" aria-selected="false">Invoices</button><button class="tab" role="tab" data-t="payments" aria-selected="false">Payments</button>');
 rep('</div>\n<p class="foot">',`<section class="card">
<div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div>
<h2>Payment Follow-up</h2><p class="sub">Find unpaid and overdue invoices and prepare polite reminders.</p>
<ul class="f"><li>Outstanding balances, overdue days, priorities</li><li>Record payments and follow-ups</li><li>Reminder drafts to copy. Nothing is sent</li></ul>
<div class="drop" id="d-payments" tabindex="0" role="button" aria-label="Upload payment sheet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><b>Drop payment sheet here</b><small>or click to browse · .xlsx · .xls · .csv</small></div>
<input type="file" id="i-payments" accept=".xlsx,.xls,.csv" hidden><p class="err" id="e-payments" role="alert"></p>
<button class="go" data-t="payments">Open payment follow-up →</button></section>
</div>
<p class="foot">`);
 rep("OK={clean:/\\.(xlsx|xls|csv)$/i,invoice:/\\.(pdf|jpe?g|png)$/i}","OK={clean:/\\.(xlsx|xls|csv)$/i,invoice:/\\.(pdf|jpe?g|png)$/i,payments:/\\.(xlsx|xls|csv)$/i}");
 rep("f.title=t==='clean'?'Excel cleaner':'Invoice processor'","f.title={clean:'Excel cleaner',invoice:'Invoice processor',payments:'Payment follow-up'}[t]");
 rep("e.textContent=t==='clean'?'Please choose an .xlsx, .xls or .csv file.':'Please choose PDF, JPG or PNG invoices.'","e.textContent=t==='invoice'?'Please choose PDF, JPG or PNG invoices.':'Please choose an .xlsx, .xls or .csv file.'");
 rep("open(t,t==='clean'?[ok[0]]:ok)","open(t,t==='invoice'?ok:[ok[0]])");
 rep("['clean','invoice'].forEach(t=>{","['clean','invoice','payments'].forEach(t=>{");
 rep('<script>\nconst $=s=>',tag+'<script>\nconst $=s=>');
}
fs.writeFileSync('index.html',h);console.log('built',(h.length/1024|0)+' KB');
