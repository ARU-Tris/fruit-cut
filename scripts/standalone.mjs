import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
let html=await readFile(path.join(dist,'index.html'),'utf8');
const script=html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
if(!script)throw new Error('Built JavaScript entry was not found.');
let js=await readFile(path.join(dist,script[1]),'utf8');
if(/^\s*import\s.+from\s/m.test(js))throw new Error('Standalone entry must not have external module imports.');
// Vite's preload polyfill only handles external links; the final file has none.
js=js.replace(/<\/script/gi,'<\\/script');
html=html.replace(script[0],()=>`<script type="module">${js}</script>`);
for(const css of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]){
  const contents=await readFile(path.join(dist,css[1]),'utf8');
  html=html.replace(css[0],()=>`<style>${contents.replace(/<\/style/gi,'<\\/style')}</style>`);
}
const icon=await readFile(path.join(root,'public','favicon.svg'));
html=html.replace('./favicon.svg',`data:image/svg+xml;base64,${icon.toString('base64')}`);
const notices=await readFile(path.join(root,'THIRD_PARTY_NOTICES.txt'),'utf8');
html=html.replace('</body>',()=>`<!--\n${notices.replace(/-->/g,'-- >')}\n-->\n</body>`);
const target=path.join(root,'Fruit Cut.html');
await writeFile(target,html);
const size=(await stat(target)).size;
console.log(`Standalone: Fruit Cut.html (${(size/1024/1024).toFixed(2)} MB) — no server, install, or network required`);
