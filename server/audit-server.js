/* BizPilot audit server. Zero dependencies. Run: AUDIT_TOKEN=secret node server/audit-server.js
   Fetches public websites safely (SSRF-protected) and returns page FACTS (no page bodies are stored). */
const http=require('http'),https=require('https'),dns=require('dns'),net=require('net'),zlib=require('zlib'),{URL}=require('url');
const AU=require('../src/audit-core.js');
const LIM={maxPages:8,maxPagesCap:15,maxLinks:30,maxImages:15,maxBytes:1.5e6,timeout:8000,maxRedirects:5,ports:[80,443],concurrency:3,competitors:3};
/* ---- IP / URL safety ---- */
const v4i=a=>a.split('.').reduce((n,x)=>n*256+ +x,0);
const V4=[['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]];
function blockedV4(ip){const n=v4i(ip);return V4.some(([b,bits])=>Math.floor(n/2**(32-bits))===Math.floor(v4i(b)/2**(32-bits)))}
function groups6(ip){ip=ip.split('%')[0];let tail=[];if(ip.includes('.')){const i=ip.lastIndexOf(':'),v=ip.slice(i+1).split('.').map(Number);tail=[v[0]*256+v[1],v[2]*256+v[3]];ip=ip.slice(0,i+1)+'0:0'}
 const[a,b]=ip.split('::'),A=a?a.split(':'):[],B=b===undefined?[]:b?b.split(':'):[],g=[...A,...Array(b===undefined?0:8-A.length-B.length).fill('0'),...B].map(x=>parseInt(x||'0',16));if(tail.length){g[6]=tail[0];g[7]=tail[1]}return g}
function blockedIP(ip){if(net.isIPv4(ip))return blockedV4(ip);if(!net.isIPv6(ip))return true;const g=groups6(ip);if(g.length!==8||g.some(isNaN))return true;
 if(g.slice(0,5).every(x=>x===0)&&(g[5]===0xffff||g[5]===0))return g[5]===0&&g[6]===0&&g[7]<2?true:blockedV4(`${g[6]>>8}.${g[6]&255}.${g[7]>>8}.${g[7]&255}`);
 if(g[0]===0x64&&g[1]===0xff9b)return true;if(g[0]===0x2002)return true;if((g[0]&0xfe00)===0xfc00||(g[0]&0xffc0)===0xfe80||(g[0]&0xffc0)===0xfec0||(g[0]&0xff00)===0xff00)return true;if(g[0]===0x2001&&g[1]===0x0db8)return true;if(g[0]===0x100&&!g[1]&&!g[2]&&!g[3])return true;return false}
class Unsafe extends Error{}
function checkUrl(s,o={}){let u;try{u=new URL(s)}catch(e){throw new Unsafe('Not a valid URL')}
 if(!/^https?:$/.test(u.protocol))throw new Unsafe('Only http and https URLs are allowed');if(u.username||u.password)throw new Unsafe('URLs with embedded credentials are not allowed');
 const port=u.port?+u.port:u.protocol==='https:'?443:80;if(!(o.ports||LIM.ports).includes(port))throw new Unsafe('Port '+port+' is not allowed');
 const h=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();if(!(o.allowHosts||[]).includes(h)){if(h==='localhost'||/\.(localhost|local|internal|lan|home|corp)$/.test(h)||h==='metadata.google.internal'||!h.includes('.')&&!net.isIP(h)&&!h.includes(':'))throw new Unsafe('Internal host names are not allowed');if(net.isIP(h)&&blockedIP(h))throw new Unsafe('Private, loopback, link-local or reserved addresses are not allowed')}return u}
const safeLookup=allow=>(host,opts,cb)=>{if(typeof opts==='function'){cb=opts;opts={}}dns.lookup(host,{all:true,verbatim:true},(err,list)=>{if(err)return cb(err);
 if(!list.length)return cb(new Unsafe('No address'));if(!allow.includes(host)&&list.some(x=>blockedIP(x.address)))return cb(new Unsafe('Host resolves to a private or reserved address'));
 opts&&opts.all?cb(null,list):cb(null,list[0].address,list[0].family)})};
const TEXT=/^(text\/|application\/(xhtml\+xml|xml|json)|application\/.*\+xml)/i;
/* one validated request; connection IP is validated at connect time (defeats DNS rebinding) */
function once(u,o){return new Promise((res,rej)=>{const t0=Date.now(),mod=u.protocol==='https:'?https:http;let done=false;const fin=(f,v)=>{if(!done){done=true;clearTimeout(tm);f(v)}};
 const req=mod.request(u,{method:'GET',agent:false,lookup:safeLookup(o.allowHosts||[]),headers:{'User-Agent':'BizPilotAuditBot/1.0 (bounded SEO audit)','Accept':o.accept||'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5','Accept-Encoding':'gzip'}},r=>{
  const ttfb=Date.now()-t0,H=r.headers,loc=H.location,ct=H['content-type']||'';r.on('error',e=>fin(rej,e));
  const base={status:r.statusCode,ttfb,ct,len:+H['content-length']||null,enc:H['content-encoding']||'',cache:H['cache-control']||H.expires||'',etag:H.etag||'',location:loc,url:u.href};
  if(o.headersOnly||(r.statusCode>=300&&r.statusCode<400&&loc)||!TEXT.test(ct)){r.destroy();return fin(res,{...base,body:null,ms:Date.now()-t0})}
  const ch=[];let n=0,trunc=false;r.on('data',d=>{n+=d.length;if(n>(o.maxBytes||LIM.maxBytes)){trunc=true;r.destroy();return}ch.push(d)});
  const end=()=>{let b=Buffer.concat(ch);try{if(/gzip/.test(base.enc))b=zlib.gunzipSync(b,{maxOutputLength:(o.maxBytes||LIM.maxBytes)*3})}catch(e){trunc=true}fin(res,{...base,body:b.toString('utf8'),bytes:n,trunc,ms:Date.now()-t0})};r.on('end',end).on('close',()=>{if(!done)end()})});
 const tm=setTimeout(()=>{req.destroy();fin(rej,Object.assign(new Error('Timed out after '+LIM.timeout+' ms'),{code:'ETIMEDOUT'}))},o.timeout||LIM.timeout);req.on('error',e=>fin(rej,e));req.end()})}
async function get(s,o={}){let u=checkUrl(s,o),chain=[];for(let i=0;i<=LIM.maxRedirects;i++){const r=await once(u,o);if(r.status>=300&&r.status<400&&r.location&&!o.noFollow){let nx;try{nx=new URL(r.location,u)}catch(e){throw new Unsafe('Bad redirect target')}chain.push(nx.href);u=checkUrl(nx.href,o);continue}return{...r,finalUrl:u.href,redirects:chain}}throw new Error('Too many redirects (>'+LIM.maxRedirects+')')}
/* ---- robots / sitemap ---- */
function parseRobots(t){const groups=[];let cur=null,sm=[];t.split(/\r?\n/).forEach(l=>{l=l.replace(/#.*/,'').trim();const m=l.match(/^([a-z-]+)\s*:\s*(.*)$/i);if(!m)return;const k=m[1].toLowerCase();if(k==='user-agent'){if(!cur||cur.rules.length)groups.push(cur={ua:[],rules:[]});cur.ua.push(m[2].toLowerCase())}else if(k==='sitemap')sm.push(m[2]);else if((k==='disallow'||k==='allow')&&cur)cur.rules.push([k,m[2]])});
 const star=groups.filter(g=>g.ua.includes('*')).flatMap(g=>g.rules);return{rules:star,disallowAll:star.some(([k,v])=>k==='disallow'&&v==='/'),sitemaps:sm}}
const allowed=(rules,path)=>{let best=null;rules.forEach(([k,v])=>{if(v&&path.startsWith(v)&&(!best||v.length>=best[1].length))best=[k,v]});return!best||best[0]==='allow'};
const SKIP=/\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|rar|mp[34]|avi|mov|docx?|xlsx?|pptx?|css|js|xml|json|woff2?)(\?|$)/i,PRI=/about|service|contact|location|area|visit|team|pricing|price|book/i;
const norm=(s,base)=>{try{const u=new URL(s,base);if(!/^https?:$/.test(u.protocol))return null;u.hash='';[...u.searchParams.keys()].filter(k=>/^(utm_|fbclid|gclid)/i.test(k)).forEach(k=>u.searchParams.delete(k));u.searchParams.sort();let p=u.pathname.replace(/\/{2,}/g,'/');if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);u.pathname=p;return u.href}catch(e){return null}};
const same=(a,b)=>{try{return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'')}catch(e){return false}};
async function pool(items,n,fn){const out=[];let i=0;await Promise.all(Array(Math.min(n,items.length)).fill(0).map(async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k])}}));return out}
async function crawl(startUrl,o={}){o={...o};const max=Math.min(o.maxPages||LIM.maxPages,LIM.maxPagesCap),site={startUrl,pages:[],failed:[],skipped:0,discovered:0,scope:'crawl',limits:[],linkChecks:[],imageChecks:[],untestedLinks:0};
 let h;try{h=await get(startUrl,o)}catch(e){site.error=e instanceof Unsafe?e.message:e.code==='CERT_HAS_EXPIRED'||/CERT|SELF_SIGNED|certificate|UNABLE_TO_VERIFY/i.test(e.code+e.message)?'TLS certificate could not be validated ('+(e.code||e.message)+')':e.message||String(e.code);
  if(/^https:/i.test(startUrl)&&/CERT|SELF_SIGNED|certificate|UNABLE_TO_VERIFY/i.test((e.code||'')+e.message))site.tls={ok:false,err:site.error};return site}
 site.finalUrl=h.finalUrl;if(/^https:/i.test(startUrl))site.tls={ok:true};const mk=(r,u)=>{const p={url:u,status:r.status,ttfb:r.ttfb,ms:r.ms,bytes:r.bytes||0,enc:r.enc,cache:r.cache,etag:r.etag,redirects:r.redirects||[]};if(r.body&&r.status>=200&&r.status<300&&/html|xml/i.test(r.ct))p.facts=AU.extract(r.body,r.finalUrl||u);return p};
 site.pages.push(mk(h,h.finalUrl));const origin=new URL(h.finalUrl).origin;
 if(/^https:/i.test(startUrl)){try{const hu=new URL(startUrl);hu.protocol='http:';hu.port='';const r=await get(hu.href,{...o,noFollow:true,headersOnly:true});site.httpRedirect={tested:true,status:r.status,location:r.location||'',toHttps:r.status>=300&&r.status<400&&/^https:/i.test(r.location||'')}}catch(e){}}
 let rules=[];try{const r=await get(origin+'/robots.txt',{...o,accept:'text/plain'});site.robots={url:origin+'/robots.txt',status:r.status};if(r.status===200&&r.body!=null){const p=parseRobots(r.body);rules=p.rules;Object.assign(site.robots,{disallowAll:p.disallowAll,sitemaps:p.sitemaps})}}catch(e){site.robots={url:origin+'/robots.txt',status:null,err:e.message}}
 let smUrls=[];const smu=(site.robots.sitemaps&&site.robots.sitemaps[0])||origin+'/sitemap.xml';try{checkUrl(smu,o);const r=await get(smu,{...o,accept:'application/xml,text/xml'});site.sitemap={url:smu,status:r.status};if(r.status===200){const locs=[...(r.body||'').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m=>m[1]);if(!/<(urlset|sitemapindex)/i.test(r.body||'')||!locs.length)site.sitemap.parseErr='No <urlset>/<sitemapindex> with <loc> entries found';else{site.sitemap.urls=locs.length;site.sitemap.urlList=locs.slice(0,200);if(/<sitemapindex/i.test(r.body))site.limits.push('Sitemap index found; child sitemaps were not followed.');else smUrls=locs}}}catch(e){site.sitemap={url:smu,status:null,err:e.message}}
 const hf=site.pages[0].facts,seen=new Set([norm(h.finalUrl,h.finalUrl)]),cand=[];
 const push=(s,b)=>{const n=norm(s,b);if(n&&!seen.has(n)&&same(n,h.finalUrl)&&!SKIP.test(n)){seen.add(n);cand.push(n)}};
 (hf?hf.links.map(l=>l.href):[]).filter(Boolean).forEach(x=>push(x,h.finalUrl));smUrls.forEach(x=>push(x,h.finalUrl));
 site.discovered=cand.length+1;const pick=[...cand.filter(u=>PRI.test(u)),...cand.filter(u=>!PRI.test(u))].filter(u=>{const ok=allowed(rules,new URL(u).pathname);if(!ok)site.skipped++;return ok}),todo=pick.slice(0,max-1);site.skipped+=Math.max(0,pick.length-todo.length);
 if(pick.length>todo.length)site.limits.push(`Page limit reached: ${todo.length+1} of ${site.discovered} discovered pages analysed.`);
 await pool(todo,LIM.concurrency,async u=>{try{const r=await get(u,o);site.pages.push(mk(r,r.finalUrl))}catch(e){site.failed.push({url:u,err:e instanceof Unsafe?e.message:e.message||e.code})}});
 const fetched=new Set(site.pages.map(p=>norm(p.url,p.url)));const L=new Map();site.pages.forEach(p=>p.facts&&p.facts.links.forEach(l=>{const n=l.href&&norm(l.href,p.url);if(n&&!fetched.has(n)&&!L.has(n))L.set(n,{from:p.url,internal:same(n,h.finalUrl)})}));
 const lk=[...L].sort((a,b)=>b[1].internal-a[1].internal),test=lk.slice(0,o.maxLinks??LIM.maxLinks);site.untestedLinks=Math.max(0,lk.length-test.length);
 await pool(test,4,async([u,m])=>{try{const r=await get(u,{...o,headersOnly:true});site.linkChecks.push({url:u,from:m.from,internal:m.internal,status:r.status,redirects:r.redirects.length})}catch(e){site.linkChecks.push({url:u,from:m.from,internal:m.internal,status:null,err:e.message,redirects:0})}});
 site.linkChecks=site.linkChecks.filter(x=>x.status!=null);
 const im=new Map();site.pages.forEach(p=>p.facts&&p.facts.imgs.forEach(i=>{if(i.src&&/^https?:/.test(i.src)&&!im.has(i.src))im.set(i.src,p.url)}));
 await pool([...im].slice(0,LIM.maxImages),4,async([u,from])=>{try{const r=await get(u,{...o,headersOnly:true});site.imageChecks.push({url:u,from,status:r.status,bytes:r.len||0})}catch(e){}});
 site.pages.forEach(p=>{if(p.facts)p.facts.textNorm=p.facts.textNorm.slice(0,30000)});return site}
/* ---- HTTP API ---- */
const hits=new Map();function limited(ip){const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<6e5);if(a.length>=(+process.env.AUDIT_RATE||6))return true;a.push(now);hits.set(ip,a);return false}
let active=0;
function server(env=process.env,o={}){return http.createServer(async(req,res)=>{const cors={'Access-Control-Allow-Origin':env.AUDIT_ALLOW_ORIGIN||'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'},J=(c,b)=>{res.writeHead(c,{'Content-Type':'application/json',...cors});res.end(JSON.stringify(b))};
 if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}if(req.url==='/health')return J(200,{ok:true});
 if(req.method!=='POST'||req.url!=='/audit')return J(404,{error:'Not found'});
 if(!env.AUDIT_TOKEN||req.headers.authorization!=='Bearer '+env.AUDIT_TOKEN)return J(401,{error:'Missing or invalid access token'});
 if(limited(req.socket.remoteAddress))return J(429,{error:'Rate limit reached. Try again in a few minutes.'});if(active>=2)return J(429,{error:'Server busy. Try again shortly.'});
 let b='';for await(const c of req){b+=c;if(b.length>10000)return J(413,{error:'Request too large'})}let q;try{q=JSON.parse(b)}catch(e){return J(400,{error:'Invalid JSON'})}
 try{checkUrl(q.url,o)}catch(e){return J(400,{error:e.message})}
 active++;try{const opt={...o,maxPages:+q.maxPages||LIM.maxPages},site=await crawl(q.url,opt),comps=[];
  for(const c of(Array.isArray(q.competitors)?q.competitors:[]).slice(0,LIM.competitors)){try{checkUrl(c,o);comps.push(await crawl(c,{...o,maxPages:3,maxLinks:0}))}catch(e){comps.push({startUrl:c,pages:[],error:e.message})}}
  J(200,{site,competitors:comps})}catch(e){J(500,{error:'Audit failed: '+e.message})}finally{active--}})}
if(require.main===module){const port=+process.env.PORT||8787;if(!process.env.AUDIT_TOKEN){console.error('Set AUDIT_TOKEN');process.exit(1)}server().listen(port,()=>console.log('Audit server on :'+port))}
module.exports={blockedIP,checkUrl,get,crawl,parseRobots,allowed,server,LIM,Unsafe,norm};
