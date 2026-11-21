import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatasetStore, loadCatalog, visibleLocations} from '../src/datasets.js';
const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));
const data=JSON.parse(await readFile(new URL('../public/data/datasets/miejsca.geojson',import.meta.url)));
const url='https://example.org/map-layers/data/catalog.json';
const response=value=>({ok:true,text:async()=>JSON.stringify(value)});
test('relative paths, cached reload and duplicate ordering across datasets',async()=>{
 const calls=[]; const store=createDatasetStore(catalog,url,()=>{},async u=>{calls.push(String(u));return response(data)});
 await store.setVisible('miejsca',true); await store.setVisible('pomiary',true);
 assert.equal(calls[0],'https://example.org/map-layers/data/datasets/miejsca.geojson');
 assert.deepEqual([...visibleLocations(store.states).values()][0].map(r=>r.dataset.id),['miejsca','miejsca','pomiary','pomiary']);
 await store.setVisible('miejsca',false);
 assert.equal([...visibleLocations(store.states).values()][0].length,2);
 await store.setVisible('miejsca',true); assert.equal(calls.length,2);
});
test('hide during fetch stays hidden; concurrent toggles share request',async()=>{
 let resolve; let calls=0;
 const store=createDatasetStore(catalog,url,()=>{},()=>{calls++;return new Promise(r=>resolve=r)});
 const pending=store.setVisible('miejsca',true);
 await store.setVisible('miejsca',false);
 const again=store.setVisible('miejsca',true);
 await store.setVisible('miejsca',false);
 resolve(response(data)); await Promise.all([pending,again]);
 assert.equal(calls,1); assert.equal(visibleLocations(store.states).size,0); assert.equal(store.states[0].status,'ready');
});
test('HTTP failure isolated, toggle retries; empty dataset valid',async()=>{
 let fail=true;
 const store=createDatasetStore(catalog,url,()=>{},async u=>String(u).includes('miejsca')&&fail?{ok:false,status:404}:response({type:'FeatureCollection',features:[]}));
 await store.setVisible('miejsca',true); await store.setVisible('pomiary',true);
 assert.equal(store.states[0].status,'error'); assert.equal(store.states[1].status,'ready');
 fail=false; await store.setVisible('miejsca',false);await store.setVisible('miejsca',true);
 assert.equal(store.states[0].status,'ready'); assert.equal(visibleLocations(store.states).size,0);
});
test('invalid file is rejected atomically; malformed JSON and invalid catalog fail',async()=>{
 const bad=structuredClone(data);bad.features[1].geometry.coordinates=[0,100];
 const store=createDatasetStore(catalog,url,()=>{},async()=>response(bad));
 await store.setVisible('miejsca',true);
 assert.equal(store.states[0].data,null); assert.match(store.states[0].error,/features\[1\]/);
 await assert.rejects(loadCatalog(url,async()=>response({version:2})),/version/);
 await assert.rejects(loadCatalog(url,async()=>({ok:true,text:async()=>'{'})),/JSON/);
});
