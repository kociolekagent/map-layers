import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',route=>route.abort());});
test('examples, duplicate details, independent toggles and safe labels',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await expect(page.locator('.point-label')).toHaveCount(2);
 const box=await page.locator('#map').boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await expect(page.locator('#details article')).toHaveCount(2);
 await expect(page.locator('#details')).toContainText('Stanowisko A');
 await expect(page.locator('#details')).toContainText('Stanowisko B');
 await page.getByLabel('Punkty pomiarowe',{exact:true}).check();
 await expect(page.locator('.point-label')).toHaveCount(4);
 await page.getByLabel('Miejsca obserwacji',{exact:true}).uncheck();
 await expect(page.locator('.point-label')).toHaveCount(2);
 await expect(page.locator('#details article')).toHaveCount(0);
 expect(errors).toEqual([]);
});
test('empty and invalid dataset do not break map; retry succeeds',async({page})=>{
 await page.route('**/datasets/miejsca.geojson',r=>r.fulfill({json:{type:'FeatureCollection',features:[]}}));
 await page.route('**/datasets/pomiary.geojson',r=>r.fulfill({json:{type:'FeatureCollection',features:[{}]}}));
 await page.goto('./');
 await expect(page.locator('#datasets')).toContainText('0 punktów');
 await page.getByLabel('Punkty pomiarowe',{exact:true}).check();
 await expect(page.locator('#datasets')).toContainText('Błąd:');
 await expect(page.locator('.point-label')).toHaveCount(0);
 await page.unroute('**/datasets/pomiary.geojson');
 await page.getByLabel('Punkty pomiarowe',{exact:true}).uncheck();
 await page.getByLabel('Punkty pomiarowe',{exact:true}).check();
 await expect(page.locator('.point-label')).toHaveCount(2);
});
test('names are text, not HTML',async({page})=>{
 await page.route('**/datasets/miejsca.geojson',async r=>{const response=await r.fetch();const data=await response.json();data.features[0].properties.name='<b>Punkt</b>';await r.fulfill({json:data});});
 await page.goto('./');await expect(page.locator('.point-label').first()).toHaveText('<b>Punkt</b>');
 await expect(page.locator('.point-label b')).toHaveCount(0);
});
