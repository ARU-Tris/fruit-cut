import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'Fruit Cut.html');
const buffer=await readFile(file),html=buffer.toString('utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'The standalone must contain one inline module.');
assert.match(scripts[0][1],/type="module"/);
assert.doesNotMatch(scripts[0][1],/\bsrc=/);
const head=html.slice(0,html.indexOf('</head>'));
assert.doesNotMatch(head,/<link\b[^>]*href="(?!data:)/i,'No external CSS, icons, or preloads.');
assert.match(html,/Third-party notices/);
assert.match(html,/Apache License/);
assert.match(html,/Permission is hereby granted/);
const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:scripts[0][2],encoding:'utf8',windowsHide:true});
assert.equal(syntax.status,0,syntax.stderr);
// Reference captures are local-only and do not ship in the public repository.
let referenceCheck='reference audit not supplied (local-only captures)';
let expected;
try {
  expected=JSON.parse((await readFile(path.join(root,'evidence','reference-hashes.json'),'utf8')).replace(/^\uFEFF/,''));
} catch(error) {
  if(error.code!=='ENOENT')throw error;
}
if(expected){
  for(const record of expected){
    const name=record.Path.split(/[\\/]/).at(-1);
    const hash=createHash('sha256').update(await readFile(path.join(root,'ref',name))).digest('hex').toUpperCase();
    assert.equal(hash,record.Hash,`Reference image changed: ${name}`);
  }
  referenceCheck=`${expected.length} reference images unchanged`;
}
const manifest={
  artifact:'Fruit Cut.html',bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),
  checks:['one inline JavaScript module','JavaScript syntax valid','no external stylesheet/icon/preload','third-party licenses embedded',referenceCheck],
};
await mkdir(path.join(root,'evidence'),{recursive:true});
await writeFile(path.join(root,'evidence','package-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
