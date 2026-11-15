// Serves ORIGINAL public files with a local-only data-connection policy.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../../public');
const csp="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; frame-src 'none'; worker-src 'none'; report-uri /f2-csp-report";
http.createServer((req,res)=>{
 if(req.url==='/f2-evidence'&&req.method==='GET'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>Guardar evidencia local F2</h1><form method="post"><label>Captura<textarea name="screenshot"></textarea></label><label>Informe<textarea name="report"></textarea></label><button>Guardar evidencia</button></form>');return;
 }
 if(req.url==='/f2-evidence'&&req.method==='POST'){
   let body='';req.on('data',c=>{if(body.length<12000000)body+=c;});req.on('end',()=>{
    const form=new URLSearchParams(body),dir=path.join(__dirname,'evidence');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'f2-browser.jpg'),Buffer.from(form.get('screenshot')||'','base64'));
    fs.writeFileSync(path.join(dir,'f2-browser.json'),form.get('report')||'{}');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<h1>Evidencia F2 guardada</h1><p>f2-browser.jpg y f2-browser.json</p>');
   });return;
 }
 if(req.url==='/f2-browser-proof.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(fs.readFileSync(path.join(__dirname,'browser-proof.js')));return;}
 if(req.url==='/f2-csp-report'){
   let body='';req.on('data',c=>{if(body.length<20000)body+=c;});req.on('end',()=>{try{const r=JSON.parse(body)['csp-report'];console.log('BLOCKED',r['effective-directive'],r['blocked-uri']);}catch{}res.writeHead(204).end();});return;
 }
 const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/app.html':url.pathname));
 if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{
   if(err){res.writeHead(404).end();return;}
   const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
   if(ext==='.html')data=Buffer.from(data.toString('utf8').replace('<head>','<head><script src="/f2-browser-proof.js"></script>'));
   res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':csp});res.end(data);
 });
}).listen(8876,'127.0.0.1',()=>console.log('F2 original app: http://127.0.0.1:8876/auth.html?f2emulator=1 ; connect-src local only'));
