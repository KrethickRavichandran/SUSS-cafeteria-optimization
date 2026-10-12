// Optional zero-dependency static server; binds only to your own computer.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = existsSync(path.join(here, 'public', 'index.html')) ? path.join(here, 'public') : here;
const port = Number(process.env.FOODLOOP_PORT || 8080);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8' };

const server = http.createServer(async (request, response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow:'GET, HEAD' }); response.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch (_) { response.writeHead(400); response.end('Bad request'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(segment=>segment.startsWith('.'))) { response.writeHead(403); response.end('Forbidden'); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (_) { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error('Could not start FoodLoop:',error.message);process.exitCode=1; });
server.listen(port,'127.0.0.1',()=>console.log(`FoodLoop is ready at http://localhost:${port}\nPress Ctrl+C to stop.`));
