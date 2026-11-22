import { searchPlaces } from './geocoding.js';
import { parseTransfer, exportDataset, exportBackup, download } from './transfer.js';
const el = (tag,text) => { const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n; };
const button = (text,click) => { const b=el('button',text);b.type='button';b.onclick=click;return b; };
function field(form,name,value='',type='text') {
  const label=el('label',name), input=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea') input.type=type;
  input.setAttribute('aria-label',name);input.value=value;label.append(input);form.append(label);return input;
}
export function mountEditor(root, repository, initial, onChange, onLocate, locationPicker) {
  let snapshot=initial, chosen=initial.catalog.datasets[0]?.id, query='', busy=false;
  const message=el('p');message.setAttribute('role','status');
  const controls=el('fieldset');root.replaceChildren(el('h2','Dane lokalne'),el('p','Zmiany zapisują się tylko w tej przeglądarce. Nie zmieniają plików na GitHubie.'),message,controls);
  async function run(action) {
    if(busy)return;busy=true;controls.disabled=true;message.textContent='Zapisywanie…';
    try {
      snapshot=await action();onChange(snapshot);draw();message.textContent='Zapisano lokalnie.';
    } catch(error) {message.textContent=`Nie zapisano: ${error.message}`;}
    finally {busy=false;controls.disabled=false;}
  }
  function pointForm(point=null) {
    locationPicker.clear();
    const host=controls.querySelector('.point-form');host.replaceChildren();
    const form=el('form');host.append(form);
    form.append(el('h3',point?'Edytuj punkt':'Nowy punkt'));
    const name=field(form,'Nazwa punktu',point?.properties.name??'');name.required=true;
    const lng=field(form,'Długość geograficzna',point?.geometry.coordinates[0]??'','number');lng.required=true;lng.min=-180;lng.max=180;lng.step='any';
    const lat=field(form,'Szerokość geograficzna',point?.geometry.coordinates[1]??'','number');lat.required=true;lat.min=-90;lat.max=90;lat.step='any';
    const description=field(form,'Opis punktu',point?.properties.description??'','textarea');
    const pickingStatus=el('p');pickingStatus.setAttribute('role','status');
    const cancelPick=button('Anuluj wskazywanie',()=>locationPicker.stop());cancelPick.disabled=true;
    const choose=button('Wskaż na mapie',()=>locationPicker.start(([longitude,latitude])=>{
      lng.value=longitude;lat.value=latitude;
    },active=>{cancelPick.disabled=!active;choose.setAttribute('aria-pressed',String(active));pickingStatus.textContent=active?'Wskazywanie aktywne: kliknij mapę. Kolejne kliknięcie zmienia lokalizację. Esc anuluje.':'Wskazywanie wyłączone. Punkt zostanie zapisany dopiero po zatwierdzeniu formularza.';}));
    choose.setAttribute('aria-pressed','false');form.append(choose,cancelPick,pickingStatus);
    const updatePreview=()=>{if(lng.value!==''&&lat.value!==''&&lng.checkValidity()&&lat.checkValidity())locationPicker.show([lng.valueAsNumber,lat.valueAsNumber]);};
    lng.addEventListener('input',updatePreview);lat.addEventListener('input',updatePreview);
    const address=field(form,'Adres lub miejsce','','search');
    const searchStatus=el('p');searchStatus.setAttribute('role','status');
    const results=el('div');results.className='address-results';
    const search=button('Szukaj adresu',async()=>{
      search.disabled=true;results.replaceChildren();searchStatus.textContent='Wyszukiwanie…';
      try {
        const found=await searchPlaces(address.value);if(!form.isConnected)return;
        searchStatus.textContent=found.length?`Wyniki: ${found.length}. Wybierz lokalizację.`:'Brak wyników. Zmień zapytanie.';
        for(const result of found)results.append(button(result.label,()=>{
          locationPicker.stop();lng.value=result.coordinates[0];lat.value=result.coordinates[1];locationPicker.show(result.coordinates,true);
          searchStatus.textContent='Lokalizacja wybrana. Uzupełnij dane i zatwierdź zapis punktu.';
        }));
      } catch(error) {if(form.isConnected)searchStatus.textContent=`Błąd wyszukiwania: ${error.message}`;}
      finally {search.disabled=false;}
    });
    address.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(!search.disabled)search.click();}});
    const credit=el('a','Wyszukiwanie: Nominatim / © OpenStreetMap contributors');credit.href='https://www.openstreetmap.org/copyright';credit.target='_blank';credit.rel='noopener';
    form.append(address.parentElement,search,searchStatus,results,credit,el('small','Zapytanie zostanie wysłane do OSMF po zatwierdzeniu. Nie wpisuj danych poufnych.'));
    const submit=el('button','Zapisz punkt');submit.type='submit';form.append(submit,button('Anuluj',()=>{locationPicker.clear();host.replaceChildren();}));
    const id=chosen;
    form.onsubmit=event=>{event.preventDefault();run(()=>repository.savePoint(id,point?.id,{name:name.value,longitude:lng.valueAsNumber,latitude:lat.valueAsNumber,description:description.value}));};
  }
  function transferControls() {
    const area=el('div');controls.append(area);
    area.append(button('Eksportuj wszystkie (kopia JSON)',async()=>{
      try {download(exportBackup(await repository.read()),'map-layers-backup.json');message.textContent='Przygotowano kopię do pobrania.';}catch(e){message.textContent=`Błąd eksportu: ${e.message}`;}
    }));
    if(chosen)area.append(button('Eksportuj wybrany GeoJSON',async()=>{
      try {download(exportDataset(await repository.read(),chosen),`${chosen}.geojson`);}catch(e){message.textContent=`Błąd eksportu: ${e.message}`;}
    }));
    const file=field(area,'Plik do importu','','file');file.accept='.geojson,.json';
    const preview=el('div');area.append(preview);
    file.onchange=async()=>{
      preview.replaceChildren();const selected=file.files[0];if(!selected)return;
      try {
        const parsed=parseTransfer(await selected.text());
        if(parsed.kind==='backup') {
          const count=Object.values(parsed.value.collections).reduce((n,c)=>n+c.features.length,0);
          preview.append(el('p',`Kopia: ${parsed.value.catalog.datasets.length} zestawów, ${count} punktów.`));
          for(const d of parsed.value.catalog.datasets)preview.append(el('small',`${d.name}: ${parsed.value.collections[d.id].features.length} punktów`));
          preview.append(button('Odtwórz kopię',()=>{if(confirm('Zastąpić CAŁĄ lokalną bazę zawartością kopii?'))run(()=>repository.restore(parsed.value));}));
        } else {
          const name=field(preview,'Nazwa importowanego zestawu',selected.name.replace(/\.(geojson|json)$/i,''));
          const color=field(preview,'Kolor importowanego zestawu','#28735c','color');
          preview.append(el('p',`Poprawny GeoJSON: ${parsed.value.features.length} punktów.`));
          const target=el('select');target.setAttribute('aria-label','Cel importu');
          const fresh=el('option','Nowy zestaw');fresh.value='';target.append(fresh);
          for(const d of snapshot.catalog.datasets){const option=el('option',`Zastąp: ${d.name}`);option.value=d.id;target.append(option);}
          preview.append(target,button('Importuj zestaw',()=>{
            const id=target.value||null;
            if(id&&!confirm('Zastąpić wszystkie punkty wybranego zestawu? Nazwa i kolor zestawu pozostaną bez zmian.'))return;
            run(()=>repository.importDataset(parsed.value,{name:name.value,color:color.value},id));
          }));
        }
      } catch(e) {preview.append(el('p',`Błąd importu: ${e.message}`));}
    };
  }
  function draw() {
    locationPicker.clear();
    if(!snapshot.catalog.datasets.some(d=>d.id===chosen))chosen=snapshot.catalog.datasets[0]?.id;
    controls.replaceChildren();
    const create=el('form');const name=field(create,'Nazwa nowego zestawu');name.required=true;
    const color=field(create,'Kolor nowego zestawu','#28735c','color');
    const add=el('button','Utwórz zestaw');add.type='submit';add.disabled=snapshot.catalog.datasets.length>=5;create.append(add);controls.append(create);
    create.onsubmit=e=>{e.preventDefault();run(()=>repository.createDataset({name:name.value,color:color.value}));};
    transferControls();
    if(!chosen) {controls.append(el('p','Baza jest pusta. Utwórz zestaw lub zaimportuj plik.'));return;}
    const selectLabel=el('label','Zestaw do edycji'),select=el('select');
    for(const d of snapshot.catalog.datasets) {const option=el('option',`${d.name} (${snapshot.collections[d.id].features.length})`);option.value=d.id;select.append(option);}
    select.setAttribute('aria-label','Zestaw do edycji');select.value=chosen;selectLabel.append(select);controls.append(selectLabel);
    select.onchange=()=>{chosen=select.value;draw();};
    const d=snapshot.catalog.datasets.find(d=>d.id===chosen);
    const rename=el('form'),newName=field(rename,'Nazwa zestawu',d.name);newName.required=true;
    const save=el('button','Zmień nazwę zestawu');save.type='submit';rename.append(save);controls.append(rename);
    rename.onsubmit=e=>{e.preventDefault();run(()=>repository.renameDataset(chosen,newName.value));};
    const remove=button('Usuń zestaw',()=>{if(confirm(`Usunąć zestaw „${d.name}” i wszystkie jego punkty?`))run(()=>repository.deleteDataset(chosen));});
    controls.append(remove,button('Dodaj punkt',()=>pointForm()));
    const host=el('div');host.className='point-form';controls.append(host);
    const search=field(controls,'Szukaj punktów',query,'search');
    const list=el('div');list.className='editor-results';controls.append(list);
    const results=()=>{
      list.replaceChildren();const points=snapshot.collections[chosen].features.filter(p=>`${p.properties.name} ${p.properties.description??''} ${p.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      list.append(el('small',`Wyniki: ${points.length}`));
      for(const point of points) {
        const row=el('article');row.append(el('strong',point.properties.name),el('small',`ID: ${point.id}`),button('Pokaż',()=>onLocate(chosen,point)),button('Edytuj',()=>pointForm(point)),button('Usuń punkt',()=>{if(confirm(`Usunąć punkt „${point.properties.name}”?`))run(()=>repository.deletePoint(chosen,point.id));}));list.append(row);
      }
    };
    search.oninput=()=>{query=search.value;results();};results();
  }
  draw();
}
