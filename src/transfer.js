import { parseJson, validateFeatureCollection } from './validation.js';
import { validateSnapshot } from './repository.js';
export function parseTransfer(text) {
  const value=parseJson(text,'Import');
  if(value?.format==='map-layers-backup') {
    if(value.version!==1)throw new Error('Nieobsługiwana wersja kopii');
    return {kind:'backup',value:validateSnapshot(value.snapshot)};
  }
  return {kind:'geojson',value:validateFeatureCollection(value,'Import')};
}
export function exportDataset(snapshot,id) {
  if(!snapshot.catalog.datasets.some(d=>d.id===id))throw new Error('Zestaw nie istnieje');
  return JSON.stringify(snapshot.collections[id],null,2);
}
export function exportBackup(snapshot) {
  validateSnapshot(snapshot);
  return JSON.stringify({format:'map-layers-backup',version:1,snapshot},null,2);
}
export function download(text,filename) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
