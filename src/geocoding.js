export function normalizeResults(value) {
  if(!Array.isArray(value))throw new Error('Niepoprawna odpowiedź usługi');
  return value.map(item=>{
    const longitude=Number(item.lon),latitude=Number(item.lat);
    if(typeof item.display_name!=='string'||item.lon==null||item.lat==null||!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)throw new Error('Niepoprawne współrzędne usługi');
    return {label:item.display_name,coordinates:[longitude,latitude]};
  });
}
export function createGeocoder({fetcher=fetch,storage,lock=task=>task(),now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms)),configUrl}={}) {
  const cache=new Map();let last=0;
  return async query=>{
    query=query.trim();if(!query)throw new Error('Wpisz adres lub miejsce');
    return lock(async()=>{
      // Runtime config supports switching off/replacing the endpoint without rebuilding JS.
      const configResponse=await fetcher(configUrl,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!configResponse.ok)throw new Error('Nie można odczytać konfiguracji geokodowania');
      const config=await configResponse.json();if(!config.enabled)throw new Error('Wyszukiwanie adresów jest wyłączone');
      const url=new URL(config.endpoint);if(url.protocol!=='https:')throw new Error('Usługa wymaga HTTPS');
      const key=`${url.href}|${query.toLocaleLowerCase()}`;
      if(cache.has(key))return structuredClone(cache.get(key));
      let saved=[];try{saved=JSON.parse(storage?.getItem('map-layers-geocode-cache')||'[]');}catch{}
      if(!Array.isArray(saved))saved=[];
      const hit=saved.find(e=>e.key===key&&now()-e.time<86400000);
      if(hit)return normalizeResults(hit.results);
      try{last=Math.max(last,Number(storage?.getItem('map-layers-geocode-last'))||0);}catch{}
      await wait(Math.max(0,1100-(now()-last)));last=now();
      try{storage?.setItem('map-layers-geocode-last',String(last));}catch{}
      url.searchParams.set('q',query);url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');url.searchParams.set('addressdetails','1');
      const response=await fetcher(url,{credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(response.status===429?'Limit usługi. Spróbuj później.':`Błąd usługi HTTP ${response.status}`);
      const raw=await response.json(),results=normalizeResults(raw);cache.set(key,results);
      if(cache.size>20)cache.delete(cache.keys().next().value);
      try{storage?.setItem('map-layers-geocode-cache',JSON.stringify([...saved.filter(e=>e.key!==key).slice(-19),{key,time:now(),results:raw}]));}catch{}
      return structuredClone(results);
    });
  };
}
let browserSearch;
export function searchPlaces(query) {
  if(!browserSearch){
    let storage;try{storage=localStorage;}catch{}
    browserSearch=createGeocoder({storage,configUrl:new URL('geocoding.json',document.baseURI),lock:task=>navigator.locks?navigator.locks.request('map-layers-geocoding',task):task()});
  }
  return browserSearch(query);
}
