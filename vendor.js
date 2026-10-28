// One-time setup (needs internet): node vendor.js
// Downloads the browser libraries into ./vendor so the app no longer depends on a CDN being up.
// Deploy the vendor/ folder next to index.html. Without it the app still works, using the CDNs as before.
// Also writes vendor/MANIFEST.json with SHA-384 (SRI) hashes so you can see if a file ever changes.
const fs=require('fs'),crypto=require('crypto');
const FILES=[
 ['xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
 ['pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
 ['pdf.worker.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'],
 ['jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js']
];
(async()=>{
 fs.mkdirSync('vendor',{recursive:true});const man={};let bad=0;
 for(const [name,url] of FILES){
  try{
   const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);
   const b=Buffer.from(await r.arrayBuffer());
   if(b.length<20000||b.slice(0,1).toString()==='<')throw Error('does not look like a JavaScript library ('+b.length+' bytes)');
   fs.writeFileSync('vendor/'+name,b);
   man[name]={url,bytes:b.length,integrity:'sha384-'+crypto.createHash('sha384').update(b).digest('base64')};
   console.log('ok  ',name,(b.length/1024|0)+' KB');
  }catch(e){bad++;console.log('FAIL',name,e.message)}
 }
 fs.writeFileSync('vendor/MANIFEST.json',JSON.stringify(man,null,2));
 console.log(bad?'\n'+bad+' file(s) failed. Re-run when online.':'\nDone. Upload the vendor/ folder together with index.html.');
 console.log('Note: the OCR engine (Tesseract + English data) still loads from a CDN on the first scan of an image/scanned PDF.');
 process.exit(bad?1:0);
})();
