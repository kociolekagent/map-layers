import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {appearance,DEFAULT_APPEARANCE} from '../src/appearance.js';
import {openRepository} from '../src/repository.js';
import {exportBackup,parseTransfer,exportDataset} from '../src/transfer.js';
test('old datasets default to points; appearance validates radius opacity and weight',()=>{
 assert.deepEqual(appearance(),DEFAULT_APPEARANCE);
 for(const radius of [0,-1,Infinity,'100'])assert.throws(()=>appearance({radius}));
 for(const fillOpacity of [-0.1,1,NaN,'0.2'])assert.throws(()=>appearance({fillOpacity}));
 assert.throws(()=>appearance({weight:-1}));assert.equal(appearance({mode:'circles',radius:0.1,fillOpacity:0}).radius,0.1);
});
test('style persistence and backup roundtrip without changes to GeoJSON',async t=>{
 const name=crypto.randomUUID();let repo=await openRepository(name);t.after(()=>repo.close());await repo.initialize();
 let s=await repo.createDataset({name:'A',color:'#123456'});const id=s.catalog.datasets[0].id;
 const old=exportBackup(s);const geo=exportDataset(s,id);
 const style={mode:'circles',radius:500,fillOpacity:0.3,weight:4};
 await repo.saveAppearance(id,'#abcdef',style);repo.close();repo=await openRepository(name);
 s=await repo.initialize();assert.deepEqual(s.appearance[id],style);assert.equal(exportDataset(s,id),geo);
 await repo.restore(parseTransfer(exportBackup(s)).value);assert.deepEqual((await repo.read()).appearance[id],style);
 await assert.rejects(repo.saveAppearance(id,'#ffffff',{...style,radius:0}));assert.equal((await repo.read()).catalog.datasets[0].color,'#abcdef');
 await repo.restore(parseTransfer(old).value);assert.deepEqual(appearance((await repo.read()).appearance?.[id]),DEFAULT_APPEARANCE);
 await repo.saveAppearance(id,'#123456',style);await repo.deleteDataset(id);assert.deepEqual((await repo.read()).appearance,{});
});
