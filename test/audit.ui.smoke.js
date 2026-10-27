// node test/audit.ui.smoke.js  (needs jsdom xlsx jspdf)
const {JSDOM}=require('jsdom'),X=require('xlsx'),{jsPDF}=require('jspdf'),fs=require('fs'),http=require('http'),SV=require('../server/audit-server.js');
const html=fs.readFileSync('audit.html','utf8').replace(/<script src=[^>]*><\/script>/g,'');const errs=[],log=(n,c)=>console.log(c?'PASS':'FAIL',n);
const site=http.createServer((q,r)=>{r.writeHead(q.url==='/'?200:404,{'Content-Type':'text/html'});r.end(q.url==='/'?'<html><head><title>Hi</title></head><body><h1>Shop</h1><a href="/gone">x</a></body></html>':'nf')});
(async()=>{await new Promise(r=>site.listen(0,'127.0.0.1',r));const SP=site.address().port,O={allowHosts:['127.0.0.1'],ports:[SP]};
 const api=SV.server({AUDIT_TOKEN:'tok'},O);await new Promise(r=>api.listen(0,'127.0.0.1',r));const AP=api.address().port;
 const d=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){w.XLSX=X;w.jspdf={jsPDF};w.fetch=fetch;w.AbortController=AbortController;w.confirm=()=>true;w.addEventListener('error',e=>errs.push(e.message));w.URL.createObjectURL=b=>{w.__blob=b;return'blob:x'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){}}});
 const w=d.window,$=s=>w.document.querySelector(s),click=s=>$(s).click(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 log('no server -> setup notice shown',/Live crawling is not set up/.test($('#main').textContent));
 $('#u').value='shop.example';click('#run');log('no source -> refused, nothing fabricated',/Paste the page source/.test($('#toast').textContent)&&!/Business Audit/.test($('#main h2')?.textContent||''));
 $('#src').value='<html><head></head><body><p>hello</p><img src="/a.png"></body></html>';click('#run');await sleep(30);
 log('pasted-source audit renders, labelled single page, score shown with coverage',/Single page only/.test($('#main').textContent)&&/\/100/.test($('#main').textContent)&&/checks completed/.test($('#main').textContent));
 log('findings table has evidence',/No <title>/.test($('#main').textContent));
 const sel=$('[data-fs]');sel.value='resolved';sel.dispatchEvent(new w.Event('change',{bubbles:true}));log('resolve recorded as user action',JSON.parse(w.localStorage.getItem('bpBusinessAudit.v1')).hist[0].findings.some(f=>f.state==='resolved'));
 $('#fsv').value='high';$('#fsv').dispatchEvent(new w.Event('change',{bubbles:true}));log('severity filter works',[...w.document.querySelectorAll('.sv')].every(e=>/high/.test(e.className)));
 click('[data-a=pdf]');log('PDF export is a valid %PDF',(Buffer.from(await w.__blob.arrayBuffer()).slice(0,5).toString()==='%PDF-'));
 click('[data-a=xlsx]');const wb=X.read(Buffer.from(await w.__blob.arrayBuffer()),{type:'buffer'});log('Excel export opens with Summary sheet',wb.SheetNames.includes('Summary'));
 click('[data-a=csvf]');log('CSV export has findings',/Finding/.test(await w.__blob.text()));
 w.document.querySelector('[data-v=prof]').click();log('profile tab states Google integration unavailable',/not available/.test($('#main').textContent)&&/unverified/.test($('#main').textContent));
 w.document.querySelector('[data-v=set]').click();for(const [k,v] of [['server','http://127.0.0.1:'+AP],['token','tok']]){const i=$(`[data-set=${k}]`);i.value=v;i.dispatchEvent(new w.Event('change',{bubbles:true}))}
 w.document.querySelector('[data-v=new]').click();$('#u').value=`http://127.0.0.1:${SP}/`;click('#run');await sleep(1500);
 log('server mode: crawl result, 404 link flagged',/Broken internal link/.test($('#main').textContent)&&/Audit server crawl/.test($('#main').textContent));
 const st=JSON.parse(w.localStorage.getItem('bpBusinessAudit.v1'));log('history saved (2 audits), no page bodies stored',st.hist.length===2&&!JSON.stringify(st).includes('hello'));
 w.document.querySelector('[data-v=set]').click();const t=$('[data-set=token]');t.value='wrong';t.dispatchEvent(new w.Event('change',{bubbles:true}));w.document.querySelector('[data-v=new]').click();click('#run');await sleep(500);
 log('bad token -> clear error',/invalid access token/.test($('#main').textContent));log('no runtime errors',errs.length===0);if(errs.length)console.log(errs);process.exit(0)})();
