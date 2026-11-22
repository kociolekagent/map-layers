import { openDB } from 'idb';
import { loadCatalog, readJson } from './datasets.js';
import { validateCatalog, validateFeatureCollection } from './validation.js';

export const SCHEMA_VERSION = 1;
export function validateSnapshot(snapshot) {
  if (snapshot.catalog?.version === 1 && Array.isArray(snapshot.catalog.datasets) && snapshot.catalog.datasets.length === 0) {
    if (!snapshot.collections || typeof snapshot.collections !== 'object' || Array.isArray(snapshot.collections) || Object.keys(snapshot.collections).length) throw new Error('Niepoprawna pusta baza');
  } else validateCatalog(snapshot.catalog);
  if (!snapshot.collections || typeof snapshot.collections !== 'object' || Array.isArray(snapshot.collections)) throw new Error('Brak kolekcji');
  const ids=snapshot.catalog.datasets.map(d=>d.id);
  if(Object.keys(snapshot.collections).length!==ids.length || ids.some(id=>!Object.hasOwn(snapshot.collections,id)))throw new Error('Niespójne kolekcje zestawów');
  for (const d of snapshot.catalog.datasets) validateFeatureCollection(snapshot.collections[d.id], d.file);
  return snapshot;
}
export async function seedFromFiles(url, fetcher = fetch) {
  const catalog = await loadCatalog(url, fetcher);
  const collections = {};
  for (const dataset of catalog.datasets) collections[dataset.id] = validateFeatureCollection(await readJson(new URL(dataset.file,url),fetcher),dataset.file);
  return validateSnapshot({catalog,collections});
}
export async function openRepository(name = 'map-layers-local-v1', onUnavailable = () => {}) {
  let blocked = false;
  const db = await new Promise((resolve,reject) => {
    openDB(name, SCHEMA_VERSION, {
      upgrade(db, oldVersion) {
        // Future migrations belong here, gated by oldVersion; never clear user data.
        if (oldVersion < 1) db.createObjectStore('state');
      },
      blocked() { blocked = true; reject(new Error('Baza zablokowana. Zamknij inne karty aplikacji i odśwież.')); },
      blocking() { db.close(); onUnavailable('Baza została otwarta przez nowszą wersję. Odśwież stronę.'); },
      terminated() { onUnavailable('Połączenie z bazą zostało przerwane. Odśwież stronę.'); }
    }).then(value => { if (blocked) value.close(); else resolve(value); },reject);
  });
  async function transaction(change) {
    const tx = db.transaction('state','readwrite');
    try {
      const current = await tx.store.get('workspace');
      const next = change(current);
      validateSnapshot(next);
      await tx.store.put(next,'workspace');
      await tx.done; // Success is reported only after the durable transaction completes.
      return next;
    } catch (error) {
      try { tx.abort(); } catch { /* already finished */ }
      await tx.done.catch(()=>{});
      throw error;
    }
  }
  const dataset = (snapshot,id) => {
    const found = snapshot.catalog.datasets.find(d=>d.id===id);
    if (!found) throw new Error('Zestaw już nie istnieje. Odśwież listę.');
    return found;
  };
  return {
    close: () => db.close(),
    async read() { const value=await db.get('state','workspace'); return value && validateSnapshot(value); },
    async initialize(loadSeed = () => ({catalog:{version:1,datasets:[]},collections:{}})) {
      const existing = await db.get('state','workspace');
      if (existing) return validateSnapshot(existing);
      const seed = validateSnapshot(await loadSeed());
      // Recheck under an exclusive transaction: another tab may have initialized meanwhile.
      return transaction(current => current ?? seed);
    },
    importDataset(collection, fields, replaceId = null) {
      validateFeatureCollection(collection);
      return transaction(s=>{
        let id=replaceId;
        if(id) dataset(s,id);
        else {
          id=`d-${crypto.randomUUID()}`;
          s.catalog.datasets.push({id,name:fields.name,color:fields.color,file:`datasets/${id}.geojson`,visibleByDefault:true});
        }
        s.collections[id]=structuredClone(collection);return s;
      });
    },
    restore(snapshot) { validateSnapshot(snapshot);return transaction(()=>structuredClone(snapshot)); },
    createDataset(fields) {
      return transaction(s => {
        const id = `d-${crypto.randomUUID()}`;
        s.catalog.datasets.push({id,name:fields.name,color:fields.color,file:`datasets/${id}.geojson`,visibleByDefault:true});
        s.collections[id]={type:'FeatureCollection',features:[]};return s;
      });
    },
    renameDataset(id,name) { return transaction(s=>{dataset(s,id).name=name;return s;}); },
    deleteDataset(id) { return transaction(s=>{dataset(s,id);s.catalog.datasets=s.catalog.datasets.filter(d=>d.id!==id);delete s.collections[id];return s;}); },
    savePoint(datasetId, pointId, fields) {
      return transaction(s=>{
        dataset(s,datasetId);
        const features=s.collections[datasetId].features;
        let point=pointId ? features.find(f=>f.id===pointId) : null;
        if (pointId && !point) throw new Error('Punkt już nie istnieje. Odśwież listę.');
        if (!point) { point={type:'Feature',id:`p-${crypto.randomUUID()}`,geometry:{type:'Point',coordinates:[]},properties:{}};features.push(point); }
        // Only form-owned fields change. Preserve foreign fields on all GeoJSON levels.
        point.properties.name=fields.name;
        point.properties.description=fields.description;
        point.geometry.coordinates=[fields.longitude,fields.latitude];
        return s;
      });
    },
    deletePoint(datasetId,pointId) {
      return transaction(s=>{
        dataset(s,datasetId);const collection=s.collections[datasetId];
        if (!collection.features.some(f=>f.id===pointId)) throw new Error('Punkt już nie istnieje.');
        collection.features=collection.features.filter(f=>f.id!==pointId);return s;
      });
    }
  };
}
