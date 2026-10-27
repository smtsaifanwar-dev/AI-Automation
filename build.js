// Rebuilds BizPilot: re-embeds the four tools from src/ into index.html (as base64) and writes payments.html. Safe to re-run.
//   src/clean.src.html     Excel cleaner (+ src/clean-values.js, pure column-value analysis, unit-tested)
//   src/invoice.src.html   Invoice processor UI (+ src/invoice-core.js, pure parsing/validation, unit-tested)
//   src/payments.src.html  Payment follow-up UI  (+ src/core.js, pure logic)
//   src/detect.js          Smart drop-zone detection (embedded in index.html between DETECT markers)
//   src/audit.src.html     Business Audit UI     (+ src/audit-core.js; live crawling needs server/audit-server.js)
const fs=require('fs'),R=f=>fs.readFileSync(f,'utf8');
const tools={clean:R('src/clean.src.html').replace('/*CLEANVAL*/',()=>R('src/clean-values.js')),invoice:R('src/invoice.src.html').replace('/*INVCORE*/',()=>R('src/invoice-core.js')),payments:R('src/payments.src.html').replace('/*CORE*/',()=>R('src/core.js')),audit:R('src/audit.src.html').replace('/*CORE*/',()=>R('src/audit-core.js'))};
fs.writeFileSync('payments.html',tools.payments);fs.writeFileSync('audit.html',tools.audit);
let h=R('index.html');
for(const t in tools){
  const re=new RegExp('<script type="text/plain" id="src-'+t+'">[^<]*</script>');
  if(!re.test(h))throw Error('index.html has no embedded block for "'+t+'"');
  h=h.replace(re,()=>`<script type="text/plain" id="src-${t}">${Buffer.from(tools[t],'utf8').toString('base64')}</script>`);
}
{const D=R('src/detect.js').trimEnd(),re=/\/\*DETECT-BEGIN\*\/[\s\S]*?\/\*DETECT-END\*\//;if(!re.test(h))throw Error('index.html has no DETECT markers');h=h.replace(re,()=>'/*DETECT-BEGIN*/\n'+D+'\n/*DETECT-END*/')}
fs.writeFileSync('index.html',h);console.log('built',(h.length/1024|0)+' KB');
