// Servidor mínimo para testar o site em subcaminho, como no GitHub Pages: /cinelumen/
const http = require('http'); const fs = require('fs'); const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function iniciar(porta = 0) {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith('/cinelumen/')) { res.writeHead(404); res.end(); return; }
    let arq = path.join(RAIZ, url.slice('/cinelumen/'.length));
    if (!arq.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
    if (url.endsWith('/')) arq = path.join(arq, 'index.html');
    fs.readFile(arq, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
      res.end(d);
    });
  });
  return new Promise((ok) => srv.listen(porta, '127.0.0.1', () => ok({ srv, base: `http://127.0.0.1:${srv.address().port}/cinelumen/` })));
}
module.exports = { iniciar };
if (require.main === module) iniciar(8080).then(({ base }) => console.log(`Abra ${base}`));
