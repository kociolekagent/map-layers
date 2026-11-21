import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, validateFeatureCollection, parseJson, DataValidationError } from '../src/validation.js';

const catalog = JSON.parse(await readFile(new URL('../public/data/catalog.json', import.meta.url), 'utf8'));
const collection = JSON.parse(await readFile(new URL('../public/data/datasets/miejsca.geojson', import.meta.url), 'utf8'));
const copy = structuredClone;
function rejected(fn, path) {
  assert.throws(fn, (e) => e instanceof DataValidationError && e.path === path);
}

test('valid examples, duplicate coordinates, no mutation, default visibility', () => {
  const input = copy(catalog);
  delete input.datasets[1].visibleByDefault;
  const before = copy(input);
  assert.equal(validateCatalog(input).datasets[1].visibleByDefault, false);
  assert.deepEqual(input, before);
  assert.deepEqual(validateFeatureCollection(collection), collection);
  assert.equal(collection.features.length, 2);
  assert.deepEqual(collection.features[0].geometry.coordinates, [21.0122, 52.2297]);
});

for (const field of ['version', 'datasets']) test(`missing catalog ${field}`, () => {
  const data = copy(catalog); delete data[field];
  rejected(() => validateCatalog(data), field);
});
for (const field of ['id', 'name', 'file', 'color']) test(`missing dataset ${field}`, () => {
  const data = copy(catalog); delete data.datasets[0][field];
  rejected(() => validateCatalog(data), `datasets[0].${field}`);
});
for (const [parent, field, path] of [
  ['root','type','type'], ['root','features','features'],
  ['feature','type','features[0].type'], ['feature','id','features[0].id'],
  ['feature','geometry','features[0].geometry'], ['feature','properties','features[0].properties'],
  ['geometry','type','features[0].geometry.type'], ['geometry','coordinates','features[0].geometry.coordinates'],
  ['properties','name','features[0].properties.name'],
]) test(`missing ${path}`, () => {
  const data = copy(collection);
  const target = parent === 'root' ? data : parent === 'feature' ? data.features[0] : data.features[0][parent];
  delete target[field];
  rejected(() => validateFeatureCollection(data), path);
});

for (const coords of [[180.001,0], [0,90.001],[-180.001,0],[0,-90.001], ['21',52], [21], [21,52,100], [null,52], [NaN,0], [0,Infinity], null, {}]) {
  test(`reject coordinates ${JSON.stringify(coords)}`, () => {
    const data=copy(collection); data.features[0].geometry.coordinates=coords;
    rejected(() => validateFeatureCollection(data), 'features[0].geometry.coordinates');
  });
}
test('inclusive WGS84 limits', () => {
  const data=copy(collection);
  data.features[0].geometry.coordinates=[-180,-90];
  data.features[1].geometry.coordinates=[180,90];
  assert.doesNotThrow(() => validateFeatureCollection(data));
});
test('duplicate dataset and feature IDs report first occurrence', () => {
  const data=copy(catalog); data.datasets[1].id=data.datasets[0].id;
  assert.throws(() => validateCatalog(data), /datasets\[1\].id.*datasets\[0\].id/);
  const points=copy(collection); points.features[1].id=points.features[0].id;
  assert.throws(() => validateFeatureCollection(points), /features\[1\].id.*features\[0\].id/);
});
test('catalog boundaries and versions', () => {
  for (const version of ['1',0,2,null]) assert.throws(() => validateCatalog({...catalog,version}));
  for (const count of [0,1,5,6]) {
    const datasets=Array.from({length:count},(_,i)=>({...catalog.datasets[0],id:`set-${i}`}));
    if (count===1 || count===5) assert.doesNotThrow(()=>validateCatalog({version:1,datasets}));
    else assert.throws(()=>validateCatalog({version:1,datasets}));
  }
  for (const data of [null, [], {}, {version:1,datasets:{}}]) assert.throws(()=>validateCatalog(data));
});
for (const file of ['../x.json','/x.json','https://example.com/x.json','//host/x.json','a\\x.json','x.json?q=1','x.json#f','x.csv','%2e%2e/x.json','%2Fx.json','x%3F.json','x%5c.json',' x.json','x.json\n',null]) {
  test(`reject file ${JSON.stringify(file)}`,()=>{
    const data=copy(catalog); data.datasets[0].file=file;
    rejected(()=>validateCatalog(data),'datasets[0].file');
  });
}
test('relative JSON and GeoJSON paths allowed',()=>{
  for (const file of ['points.json','datasets/points.geojson']) {
    const data=copy(catalog); data.datasets[0].file=file;
    assert.doesNotThrow(()=>validateCatalog(data));
  }
});
test('IDs, names, descriptions, colors and optional field types',()=>{
  for (const id of ['', 'a\n', 'A', '-a', 'a b', 'a'.repeat(65), 1, null]) {
    const data=copy(catalog); data.datasets[0].id=id; assert.throws(()=>validateCatalog(data));
  }
  for (const name of ['', ' ', ' x', 'x ', 'x\ny', 'x\u2028y', 'x'.repeat(121), null, 1]) {
    const data=copy(collection); data.features[0].properties.name=name; assert.throws(()=>validateFeatureCollection(data));
    const c=copy(catalog); c.datasets[0].name=name; assert.throws(()=>validateCatalog(c));
  }
  const data=copy(collection);
  data.features[0].properties.name='😀'.repeat(120);
  data.features[1].properties.name='<b>Punkt</b>';
  data.features[0].properties.description='😀'.repeat(2000);
  assert.doesNotThrow(()=>validateFeatureCollection(data));
  for (const description of [null, 1, 'x'.repeat(2001)]) {
    data.features[0].properties.description=description; assert.throws(()=>validateFeatureCollection(data));
    const c=copy(catalog); c.datasets[0].description=description; assert.throws(()=>validateCatalog(c));
  }
  for (const color of ['red','#123','#2563EB\n',null,123]) {
    const c=copy(catalog); c.datasets[0].color=color; assert.throws(()=>validateCatalog(c));
  }
  for (const visibleByDefault of ['false',null,0]) {
    const c=copy(catalog); c.datasets[0].visibleByDefault=visibleByDefault; assert.throws(()=>validateCatalog(c));
  }
});
test('empty and >1000 points allowed; unknown fields ignored',()=>{
  assert.doesNotThrow(()=>validateFeatureCollection({type:'FeatureCollection',features:[],extra:true}));
  const features=Array.from({length:1001},(_,i)=>({...copy(collection.features[0]),id:`p-${i}`}));
  assert.equal(validateFeatureCollection({type:'FeatureCollection',features}).features.length,1001);
  assert.doesNotThrow(()=>validateCatalog({...catalog,extra:null}));
});
test('invalid geometry, object types and crs rejected',()=>{
  for (const geometry of [null, [], {type:'LineString',coordinates:[1,2]}]) {
    const data=copy(collection); data.features[0].geometry=geometry; assert.throws(()=>validateFeatureCollection(data));
  }
  for (const level of ['root','feature','geometry']) {
    const data=copy(collection);
    (level==='root'?data:level==='feature'?data.features[0]:data.features[0].geometry).crs=null;
    assert.throws(()=>validateFeatureCollection(data), /crs/);
  }
  for (const data of [null, [], {}, {type:'FeatureCollection',features:[null]}]) assert.throws(()=>validateFeatureCollection(data));
});
test('invalid JSON includes source, no raw HTML interpretation or JSON coercion',()=>{
  for (const text of ['{','{"a":1,}','// comment\n{}']) assert.throws(()=>parseJson(text,'bad.json'), /bad.json.*niepoprawny JSON/);
  assert.deepEqual(parseJson('{"x":"<b>x</b>"}','ok.json'),{x:'<b>x</b>'});
});
