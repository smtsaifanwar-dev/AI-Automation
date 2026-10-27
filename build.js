// Rebuilds BizPilot: re-embeds the four tools from src/ into index.html (as base64) and writes payments.html. Safe to re-run.
//   src/clean.src.html     Excel cleaner
//   src/invoice.src.html   Invoice processor (text PDFs + OCR for scans)
//   src/payments.src.html  Payment follow-up UI  (+ src/core.js, pure logic)
//   src/audit.src.html     Business Audit UI     (+ src/audit-core.js; live crawling needs server/audit-server.js)
const fs=require('fs'),R=f=>fs.readFileSync(f,'utf8');
const tools={clean:R('src/clean.src.html'),invoice:R('src/invoice.src.html'),payments:R('src/payments.src.html').replace('/*CORE*/',()=>R('src/core.js')),audit:R('src/audit.src.html').replace('/*CORE*/',()=>R('src/audit-core.js'))};
fs.writeFileSync('payments.html',tools.payments);fs.writeFileSync('audit.html',tools.audit);
let h=R('index.html');
for(const t in tools){
  const re=new RegExp('<script type="text/plain" id="src-'+t+'">[^<]*</script>');
  if(!re.test(h))throw Error('index.html has no embedded block for "'+t+'"');
  h=h.replace(re,()=>`<script type="text/plain" id="src-${t}">${Buffer.from(tools[t],'utf8').toString('base64')}</script>`);
}
fs.writeFileSync('index.html',h);console.log('built',(h.length/1024|0)+' KB');
