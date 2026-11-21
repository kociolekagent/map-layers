import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateDataFiles } from '../scripts/data-files.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const original=JSON.parse(await readFile(join(root,'public/data/catalog.json'),'utf8'));
const points=await readFile(join(root,'public/data/datasets/miejsca.geojson'),'utf8');
async function fixture(t) {
  // Temporary test files stay inside this project, never in the system temp directory.
  const dir=await mkdtemp(join(root,'tests/.fixture-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await mkdir(join(dir,'datasets'));
  const catalog=structuredClone(original);
  await writeFile(join(dir,'catalog.json'),JSON.stringify(catalog));
  await writeFile(join(dir,'datasets/miejsca.geojson'),points);
  await writeFile(join(dir,'datasets/pomiary.geojson'),points);
  return {dir,catalog,path:join(dir,'catalog.json')};
}
test('all real files pass including hidden dataset and cross-dataset IDs',async()=>{
  assert.deepEqual(await validateDataFiles(join(root,'public/data/catalog.json')),{datasets:2,points:4});
});
test('missing hidden dataset fails and names file',async(t)=>{
  const f=await fixture(t);
  f.catalog.datasets[1].file='datasets/missing.json';
  await writeFile(f.path,JSON.stringify(f.catalog));
  await assert.rejects(validateDataFiles(f.path),e=>e instanceof AggregateError && /missing.json.*ENOENT/.test(e.errors[0].message));
});
test('all dataset failures collected; invalid JSON and invalid coordinates',async(t)=>{
  const f=await fixture(t);
  await writeFile(join(f.dir,'datasets/miejsca.geojson'),'{');
  const invalid=JSON.parse(points); invalid.features[1].geometry.coordinates=[0,100];
  await writeFile(join(f.dir,'datasets/pomiary.geojson'),JSON.stringify(invalid));
  await assert.rejects(validateDataFiles(f.path),e=>e.errors.length===2 && /niepoprawny JSON/.test(e.errors[0].message) && /features\[1\].geometry.coordinates/.test(e.errors[1].message));
});
test('missing, malformed and invalid catalog fail',async(t)=>{
  const f=await fixture(t);
  await assert.rejects(validateDataFiles(join(f.dir,'missing.json')),/ENOENT/);
  await writeFile(f.path,'{'); await assert.rejects(validateDataFiles(f.path),/niepoprawny JSON/);
  await writeFile(f.path,'{"version":2,"datasets":[]}'); await assert.rejects(validateDataFiles(f.path),/version/);
});
test('CLI resolves relative to catalog and exits nonzero on error',async(t)=>{
  const f=await fixture(t);
  const script=join(root,'scripts/validate-data.js');
  let result=spawnSync(process.execPath,[script,f.path],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/2 zestawy, 4 punkty/);
  await writeFile(join(f.dir,'datasets/pomiary.geojson'),'{}');
  result=spawnSync(process.execPath,[script,f.path],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,1); assert.match(result.stderr,/pomiary.geojson.*type/);
});
