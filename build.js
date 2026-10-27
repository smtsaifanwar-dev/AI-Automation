// Rebuilds BizPilot: re-embeds the three tools from src/ into index.html (as base64) and writes payments.html. Safe to re-run.
//   src/clean.src.html     Excel cleaner
//   src/invoice.src.html   Invoice processor (text PDFs + OCR for scans)
//   src/payments.src.html  Payment follow-up UI  (+ src/core.js, pure logic)
const fs=require('fs'),R=f=>fs.readFileSync(f,'utf8');
const tools={clean:R('src/clean.src.html'),invoice:R('src/invoice.src.html'),payments:R('src/payments.src.html').replace('/*CORE*/',()=>R('src/core.js'))};
fs.writeFileSync('payments.html',tools.payments);
let h=R('index.html');
for(const t in tools){
  const re=new RegExp('<script type="text/plain" id="src-'+t+'">[^<]*</script>');
  if(!re.test(h))throw Error('index.html has no embedded block for "'+t+'"');
  h=h.replace(re,()=>`<script type="text/plain" id="src-${t}">${Buffer.from(tools[t],'utf8').toString('base64')}</script>`);
}
fs.writeFileSync('index.html',h);console.log('built',(h.length/1024|0)+' KB');
