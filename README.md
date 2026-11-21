# Map Layers — etap 3

Interaktywna mapa Leaflet 1.9.4 z podkładem OpenStreetMap, warstwami GeoJSON,
etykietami i szczegółami wszystkich punktów we wspólnej lokalizacji.

Strona: https://kociolekagent.github.io/map-layers/

## Wymagania i uruchomienie

Node.js 22.12+ (zalecany Node.js 24 LTS) i npm.

```bash
cd /home/node/.openclaw/workspace/projects/map-layers
npm ci --include=dev --cache .npm-cache --no-audit --no-fund
npm run dev
```

Otwórz adres podany przez Vite, domyślnie http://127.0.0.1:5173.
Serwer jest dostępny lokalnie na komputerze, na którym uruchomiono polecenie.

```bash
npm run validate
npm test
npm run build
npm run preview
```

Podgląd buildu: domyślnie http://127.0.0.1:4173. Zatrzymanie serwera: Ctrl+C.
Build najpierw waliduje wszystkie dane, następnie tworzy `dist/`.
Błąd walidacji przerywa build z niezerowym kodem wyjścia.

## Struktura

- `index.html`, `src/main.js`, `src/styles.css` — mapa, panel warstw i bezpiecznie renderowane szczegóły.
- `src/validation.js` — czysty walidator katalogu i GeoJSON, parser JSON oraz błędy z lokalizacją; bez zależności i bez operacji I/O.
- `scripts/data-files.js` — odczyt plików względem katalogu danych, kontrola dostępności i zbiorcze zgłaszanie błędów zestawów.
- `scripts/validate-data.js` — CLI walidujące wszystkie pliki, także ukrytych zestawów.
- `public/data/catalog.json` — dwa zestawy, ich nazwy, kolory i początkowa widoczność.
- `public/data/datasets/miejsca.geojson` — dwa punkty o identycznych współrzędnych.
- `public/data/datasets/pomiary.geojson` — dwa kolejne punkty; ID mogą powtarzać się między zestawami.
- `tests/validation.test.js` — reguły struktury, typów, tekstu, ID, ścieżek i współrzędnych.
- `tests/files.test.js` — integracja plikowa i CLI, brak pliku, błędny JSON, błędny katalog i ukryte zestawy.
- `docs/data-contract-v1.md` — reguły zaakceptowanego kontraktu i granica obecnego etapu.
- `vite.config.js` — względne adresy zasobów (`base: './'`).
- `package.json`, `package-lock.json` — polecenia, lokalna zależność Vite i przypięte wersje.
- `.gitignore` — wykluczenia plików generowanych i lokalnych.
- `plan.md` — zachowana bez zmian wcześniejsza notatka; zaakceptowany później kontrakt v1 ma pierwszeństwo.
- `dist/`, `node_modules/`, `.npm-cache/` — wynik buildu, zależności i lokalny cache; nie są plikami źródłowymi.

## Używanie walidatora

```js
import { validateCatalog, validateFeatureCollection, parseJson } from './src/validation.js';
const catalog = validateCatalog(parseJson(text, 'catalog.json'));
```

`validateCatalog` zwraca katalog z domyślnym `visibleByDefault: false`, nie modyfikując wejścia.
`validateFeatureCollection` zwraca cały wejściowy zestaw dopiero po poprawnej walidacji.
Błędy mają klasę `DataValidationError`, pola `source`, `path` i czytelny `message`.
Walidator kończy na pierwszym błędzie danego dokumentu; walidacja plikowa zbiera błędy
ze wszystkich zestawów w `AggregateError`. Błąd katalogu zatrzymuje odczyt zestawów.
Nieznane pola są zachowywane, ale nie wpływają na walidację.

Inny katalog danych wewnątrz projektu można sprawdzić poleceniem:

```bash
node scripts/validate-data.js public/data/catalog.json
```

## Warstwy i testy przeglądarkowe

`src/datasets.js` obsługuje pobieranie, walidację, cache, stany widoczności
oraz indeks dokładnych współrzędnych. `tests/datasets.test.js` sprawdza również
wyścigi pobierania, ponawianie, izolację błędów i puste zestawy.
`browser-tests/map.spec.js` sprawdza przykłady, szczegóły wspólnej lokalizacji,
przełączniki, błędny/pusty zestaw oraz renderowanie nazw jako tekstu.

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run build
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npm run test:browser
```

Testy przeglądarkowe blokują kafelki OSM, aby nie zależeć od zewnętrznej usługi.
Workflow zachowuje istniejący sposób publikacji i dodatkowo uruchamia te testy.

## Zachowanie i ograniczenia

- Dane ładowane na żądanie; poprawne zestawy pozostają w pamięci.
- Błąd odrzuca cały zestaw. Wyłączenie i włączenie ponawia próbę.
- Ukrycie podczas pobierania pozostaje skuteczne po zakończeniu pobierania.
- Znaczniki Canvas ograniczają liczbę elementów DOM; etykiety są stałymi tooltipami.
  Warstwy są tworzone raz i ponownie wykorzystywane. Brak klastrowania i rozsuwania.
- Etykiety mogą się nakładać; kliknięcie wspólnej lokalizacji pokazuje każdy
  widoczny rekord w kolejności katalogu i pliku, bez zmieniania współrzędnych.
- 1000 punktów nie jest twardym limitem. Wiele tysięcy etykiet może obciążać
  słabsze urządzenia; nie przeprowadzono benchmarku urządzeń mobilnych.
- Podkład OSM wymaga sieci, bez gwarancji dostępności. Poprawne dane biegunowe
  pozostają niezmienione, choć wykraczają poza Web Mercator.
- Znaczniki Canvas obsługują kliknięcia/dotyk, nie indywidualny fokus klawiatury.
- Brak pomiaru wielopunktowego, importu, backendu i kont użytkowników.
- Dane w `public/` są publiczne. Kontrakt v1 pozostał niezmieniony.

Zależności: Leaflet; developerskie: Vite i Playwright. Testy jednostkowe: node:test.

## GitHub Pages

Workflow `.github/workflows/pages.yml` dla gałęzi `main` uruchamia testy,
waliduje dane, buduje projekt i publikuje wyłącznie `dist/`.
W Settings → Pages należy wybrać źródło GitHub Actions.
Vite `base: './'` zachowuje względne zasoby również pod `/map-layers/`.
Katalog jest kopiowany do `dist/data/catalog.json`, a pliki GeoJSON do
`dist/data/datasets/`; ścieżki zestawów należy rozwiązywać względem URL katalogu.
Strona oraz wszystkie dane w `public/` po wdrożeniu są publiczne.
Na planie GitHub Free również repozytorium źródłowe musi być publiczne.

## Pomiar wielopunktowy

„Mierz odległość” rozpoczyna dodawanie kolejnych punktów jednej łamanej.
Panel pokazuje liczbę punktów, sumę niezaokrąglonych odcinków i ostatni odcinek.
Dwa punkty nadal dają zwykły pojedynczy pomiar. Przy 0–1 punktach brak długości.
„Cofnij punkt” usuwa ostatni punkt również po zakończeniu; „Zakończ” wymaga
co najmniej dwóch punktów i zachowuje wynik. „Wznów” jawnie włącza dalsze
klikanie. „Wstrzymaj” lub Esc zachowuje nawet jeden punkt. „Wyczyść” usuwa
geometrię; w aktywnym trybie można od razu klikać od nowa, poza nim należy
wybrać „Mierz odległość”. Warstwy danych nie wpływają na pomiar.

`src/measurement.js` zachowuje obliczenia haversine (promień 6371000 m, jak
Leaflet). Wyniki poniżej 1000 m są zaokrąglane do metra, pozostałe do 0,01 km.
To model sferyczny bez wysokości i dróg, nie pomiar geodezyjny na elipsoidzie.
Linia w projekcji mapy nie odwzorowuje łuku wielkiego koła na dużych dystansach.
Brak twardego limitu punktów; bardzo długie pomiary mogą obciążać przeglądarkę.
