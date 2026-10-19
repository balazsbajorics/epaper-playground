// Zero-dependency static server for the playground: `node serve.js` then open
// http://localhost:4175/. Any static server works; this one just sets ES module MIME types.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const root = new URL('.', import.meta.url).pathname,
  types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.d.ts': 'text/plain',
    '.md': 'text/markdown',
  };
createServer(async (request, response) => {
  let path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    response.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(4175, () => console.log('http://localhost:4175/'));
