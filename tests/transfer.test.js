import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openRepository} from '../src/repository.js';
import {parseTransfer,exportDataset,exportBackup} from '../src/transfer.js';
const data={type:'FeatureCollection',custom:{retain:true},features:[{type:'Feature',id:'same',extra:42,geometry:{type:'Point',coordinates:[21,52],custom:'g'},properties:{name:'P',datasetId:'user-value',nested:{a:1}}}]};
async function repo(t){const r=await openRepository(crypto.randomUUID());t.after(()=>r.close());await r.initialize();return r;}
test('fresh database empty; initialization preserves existing imports',async t=>{
 const r=await repo(t);assert.equal((await r.read()).catalog.datasets.length,0);
 await r.importDataset(data,{name:'A',color:'#123456'});await r.initialize();assert.equal((await r.read()).catalog.datasets.length,1);
});
test('single import, atomic replacement, empty and invalid imports',async t=>{
 const r=await repo(t);let s=await r.importDataset(parseTransfer(JSON.stringify(data)).value,{name:'A',color:'#123456'});const id=s.catalog.datasets[0].id;
 assert.deepEqual(JSON.parse(exportDataset(s,id)),data);
 const bad=structuredClone(data);bad.features[0].geometry.coordinates=[181,0];
 assert.throws(()=>parseTransfer(JSON.stringify(bad)),/coordinates/);
 assert.throws(()=>r.importDataset(bad,{},id),/coordinates/);
 assert.deepEqual((await r.read()).collections[id],data);
 const empty={type:'FeatureCollection',features:[]};s=await r.importDataset(empty,{},id);
 assert.equal(s.catalog.datasets[0].name,'A');assert.equal(s.collections[id].features.length,0);
 assert.throws(()=>parseTransfer('{'),/JSON/);
});
test('backup roundtrip preserves membership, IDs, metadata, unknown fields and empty datasets',async t=>{
 const r=await repo(t);await r.importDataset(data,{name:'A',color:'#123456'});await r.importDataset(data,{name:'B',color:'#abcdef'});await r.createDataset({name:'Empty',color:'#112233'});
 const original=await r.read();const parsed=parseTransfer(exportBackup(original));assert.equal(parsed.kind,'backup');
 const other=await repo(t);await other.restore(parsed.value);assert.deepEqual(await other.read(),original);
 await other.initialize();assert.deepEqual(await other.read(),original);
 const bad=structuredClone(original);delete bad.collections[bad.catalog.datasets[0].id];
 assert.throws(()=>other.restore(bad));assert.deepEqual(await other.read(),original);
});
test('failed restore keeps previous database and supports empty backups',async t=>{
 const r=await repo(t);await r.importDataset(data,{name:'A',color:'#123456'});const before=await r.read();
 const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=()=>{throw Error('quota')};
 try{await assert.rejects(r.restore({catalog:{version:1,datasets:[]},collections:{}}),/quota/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await r.read(),before);
 const empty={catalog:{version:1,datasets:[]},collections:{}};await r.restore(parseTransfer(exportBackup(empty)).value);assert.deepEqual(await r.read(),empty);
});
