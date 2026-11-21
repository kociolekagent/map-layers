const el = (tag,text) => { const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n; };
const button = (text,click) => { const b=el('button',text);b.type='button';b.onclick=click;return b; };
function field(form,name,value='',type='text') {
  const label=el('label',name), input=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea') input.type=type;
  input.setAttribute('aria-label',name);input.value=value;label.append(input);form.append(label);return input;
}
export function mountEditor(root, repository, initial, onChange, onLocate) {
  let snapshot=initial, chosen=initial.catalog.datasets[0].id, query='', busy=false;
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
    const host=controls.querySelector('.point-form');host.replaceChildren();
    const form=el('form');host.append(form);
    form.append(el('h3',point?'Edytuj punkt':'Nowy punkt'));
    const name=field(form,'Nazwa punktu',point?.properties.name??'');name.required=true;
    const lng=field(form,'Długość geograficzna',point?.geometry.coordinates[0]??'','number');lng.required=true;lng.min=-180;lng.max=180;lng.step='any';
    const lat=field(form,'Szerokość geograficzna',point?.geometry.coordinates[1]??'','number');lat.required=true;lat.min=-90;lat.max=90;lat.step='any';
    const description=field(form,'Opis punktu',point?.properties.description??'','textarea');
    const submit=el('button','Zapisz punkt');submit.type='submit';form.append(submit,button('Anuluj',()=>host.replaceChildren()));
    const id=chosen;
    form.onsubmit=event=>{event.preventDefault();run(()=>repository.savePoint(id,point?.id,{name:name.value,longitude:lng.valueAsNumber,latitude:lat.valueAsNumber,description:description.value}));};
  }
  function draw() {
    if(!snapshot.catalog.datasets.some(d=>d.id===chosen))chosen=snapshot.catalog.datasets[0].id;
    controls.replaceChildren();
    const create=el('form');const name=field(create,'Nazwa nowego zestawu');name.required=true;
    const color=field(create,'Kolor nowego zestawu','#28735c','color');
    const add=el('button','Utwórz zestaw');add.type='submit';add.disabled=snapshot.catalog.datasets.length>=5;create.append(add);controls.append(create);
    create.onsubmit=e=>{e.preventDefault();run(()=>repository.createDataset({name:name.value,color:color.value}));};
    const selectLabel=el('label','Zestaw do edycji'),select=el('select');
    for(const d of snapshot.catalog.datasets) {const option=el('option',`${d.name} (${snapshot.collections[d.id].features.length})`);option.value=d.id;select.append(option);}
    select.setAttribute('aria-label','Zestaw do edycji');select.value=chosen;selectLabel.append(select);controls.append(selectLabel);
    select.onchange=()=>{chosen=select.value;draw();};
    const d=snapshot.catalog.datasets.find(d=>d.id===chosen);
    const rename=el('form'),newName=field(rename,'Nazwa zestawu',d.name);newName.required=true;
    const save=el('button','Zmień nazwę zestawu');save.type='submit';rename.append(save);controls.append(rename);
    rename.onsubmit=e=>{e.preventDefault();run(()=>repository.renameDataset(chosen,newName.value));};
    const remove=button('Usuń zestaw',()=>{if(confirm(`Usunąć zestaw „${d.name}” i wszystkie jego punkty?`))run(()=>repository.deleteDataset(chosen));});
    remove.disabled=snapshot.catalog.datasets.length===1;controls.append(remove,button('Dodaj punkt',()=>pointForm()));
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
