import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeocoder,normalizeResults} from '../src/geocoding.js';
const raw=[{lon:'21.0122',lat:'52.2297',display_name:'Warszawa, Polska'}];
test('geocoding coordinates, explicit query, cache and rate interval',async()=>{
 let calls=0,time=5000;const waits=[];
 const search=createGeocoder({configUrl:'config',now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},fetcher:async u=>u==='config'?{ok:true,json:async()=>({enabled:true,endpoint:'https://example.test/search'})}:{ok:true,json:async()=>{calls++;assert.equal(new URL(u).searchParams.get('format'),'jsonv2');return raw;}}});
 assert.deepEqual((await search('Warszawa'))[0].coordinates,[21.0122,52.2297]);
 await search('Warszawa');assert.equal(calls,1);await search('Kraków');assert.equal(calls,2);assert.ok(waits.includes(1100));
});
test('no results, service failure and invalid response',async()=>{
 const search=createGeocoder({configUrl:'config',fetcher:async u=>u==='config'?{ok:true,json:async()=>({enabled:true,endpoint:'https://example.test'})}:{ok:true,json:async()=>[]}});
 assert.deepEqual(await search('Nothing'),[]);await assert.rejects(search(' '),/Wpisz/);
 assert.throws(()=>normalizeResults([{lon:181,lat:0,display_name:'bad'}]),/współrzędne/);
 const failed=createGeocoder({configUrl:'config',fetcher:async u=>u==='config'?{ok:true,json:async()=>({enabled:true,endpoint:'https://example.test'})}:{ok:false,status:429}});
 await assert.rejects(failed('x'),/Limit/);
});
