import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openRepository,seedFromFiles,SCHEMA_VERSION} from '../src/repository.js';
const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));
const points=JSON.parse(await readFile(new URL('../public/data/datasets/miejsca.geojson',import.meta.url)));
const seed=()=>structuredClone({catalog,collections:{miejsca:points,pomiary:points}});
async function fixture(t){const name=crypto.randomUUID();const repo=await openRepository(name);t.after(()=>repo.close());return {repo,name};}
test('atomic seed, repeated startup and app updates never overwrite user changes',async t=>{
 const {repo,name}=await fixture(t);await repo.initialize(seed);
 await repo.renameDataset('miejsca','Moje miejsca');repo.close();
 const reopened=await openRepository(name);t.after(()=>reopened.close());
 const result=await reopened.initialize(()=>{throw Error('must not fetch')});
 assert.equal(result.catalog.datasets[0].name,'Moje miejsca');assert.equal(SCHEMA_VERSION,1);
});
test('failed seed and validation leave no partial initialization; retry works',async t=>{
 const {repo}=await fixture(t);
 await assert.rejects(repo.initialize(()=>{throw Error('offline')}),/offline/);assert.equal(await repo.read(),undefined);
 const bad=seed();bad.collections.pomiary.features[1].geometry.coordinates=[181,0];
 await assert.rejects(repo.initialize(()=>bad),/coordinates/);assert.equal(await repo.read(),undefined);
 await repo.initialize(seed);assert.equal((await repo.read()).catalog.datasets.length,2);
});
test('concurrent initialization rechecks seed and concurrent mutations preserve each other',async t=>{
 const {repo,name}=await fixture(t);const other=await openRepository(name);t.after(()=>other.close());
 let release;const waiting=repo.initialize(()=>new Promise(r=>release=r));
 // Let the initial readonly request complete before starting the second initializer.
 while(!release)await new Promise(r=>setTimeout(r,1));
 await other.initialize(seed);await other.renameDataset('miejsca','Nie nadpisuj');release(seed());await waiting;
 await Promise.all([repo.renameDataset('miejsca','A'),other.renameDataset('pomiary','B')]);
 assert.deepEqual((await repo.read()).catalog.datasets.map(d=>d.name),['A','B']);
});
test('dataset CRUD, stable IDs, cascade and contract bounds',async t=>{
 const {repo}=await fixture(t);await repo.initialize(seed);
 let result=await repo.createDataset({name:'Nowy',color:'#123456'});const id=result.catalog.datasets.at(-1).id;
 assert.equal(result.collections[id].features.length,0);await repo.renameDataset(id,'Zmiana');
 await repo.savePoint(id,null,{name:'P',longitude:21,latitude:52,description:''});
 result=await repo.deleteDataset(id);assert.equal(Object.hasOwn(result.collections,id),false);
 await repo.deleteDataset('pomiary');await assert.rejects(repo.deleteDataset('miejsca'),/datasets/);
 for(let i=0;i<4;i++)await repo.createDataset({name:`Z${i}`,color:'#112233'});
 await assert.rejects(repo.createDataset({name:'Szósty',color:'#112233'}),/datasets/);
 assert.equal((await repo.read()).catalog.datasets.length,5);
});
test('point CRUD preserves unknown properties, geometry and feature fields; invalid write rolls back',async t=>{
 const {repo}=await fixture(t);const initial=seed();const p=initial.collections.miejsca.features[0];
 p.properties.extra={nested:42};p.geometry.custom='keep';p.custom=['keep'];await repo.initialize(()=>initial);
 const fields={name:'Nowa nazwa',longitude:-180,latitude:90,description:'Opis'};
 let result=await repo.savePoint('miejsca',p.id,fields);let actual=result.collections.miejsca.features[0];
 assert.equal(actual.id,p.id);assert.deepEqual(actual.properties.extra,{nested:42});assert.equal(actual.geometry.custom,'keep');assert.deepEqual(actual.custom,['keep']);
 await assert.rejects(repo.savePoint('miejsca',p.id,{...fields,latitude:91}),/coordinates/);
 await assert.rejects(repo.savePoint('miejsca',p.id,{...fields,name:' '}),/name/);
 assert.equal((await repo.read()).collections.miejsca.features[0].properties.name,'Nowa nazwa');
 result=await repo.savePoint('miejsca',null,fields);assert.equal(result.collections.miejsca.features.length,3);
 await repo.deletePoint('miejsca',p.id);assert.equal((await repo.read()).collections.miejsca.features.length,2);
 await assert.rejects(repo.savePoint('miejsca',p.id,fields),/nie istnieje/);
});
test('write failure is rejected, never acknowledged as success',async t=>{
 const {repo}=await fixture(t);await repo.initialize(seed);
 const original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(){throw new DOMException('Disk full','QuotaExceededError')};
 try {await assert.rejects(repo.renameDataset('miejsca','Lost'),/Disk full/);}finally{IDBObjectStore.prototype.put=original;}
 assert.equal((await repo.read()).catalog.datasets[0].name,catalog.datasets[0].name);
 repo.close();await assert.rejects(repo.renameDataset('miejsca','Closed'));
});
test('source loader checks hidden files, relative paths and HTTP failures',async()=>{
 const urls=[];const fetcher=async url=>{urls.push(String(url));return {ok:true,text:async()=>JSON.stringify(String(url).endsWith('catalog.json')?catalog:points)}};
 const result=await seedFromFiles(new URL('https://test/map-layers/data/catalog.json'),fetcher);
 assert.equal(result.collections.pomiary.features.length,2);assert.equal(urls.length,3);
 assert.equal(urls[1],'https://test/map-layers/data/datasets/miejsca.geojson');
 await assert.rejects(seedFromFiles(new URL('https://test/catalog.json'),async()=>({ok:false,status:404})),/404/);
});
