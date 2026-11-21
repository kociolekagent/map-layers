## Rekomendacja

**Leaflet + zwykły JavaScript + CSS, dane w GeoJSON, bez backendu.** Do pracy lokalnej i budowania wersji produkcyjnej proponuję **Vite**. GitHub Pages będzie udostępniać wyłącznie wynikowe pliki statyczne.

Nie proponuję Reacta, bazy danych, serwera API ani systemu zarządzania treścią — w pierwszej wersji nie przyniosłyby istotnej korzyści.

### 1. Biblioteki i kompromisy

| Element | Propozycja | Uzasadnienie |
|---|---|---|
| Mapa | **Leaflet 1.9.4 — stabilna wersja** | Obsługuje kafelki OSM, znaczniki, etykiety, GeoJSON i warstwy. Dobrze pasuje do prostej mapy punktowej. |
| Pomiar | API Leaflet i niewielki moduł aplikacji | Obliczanie odległości jest dostępne w Leaflet; do prostej łamanej nie potrzeba kolejnej biblioteki. |
| Narzędzia developerskie | **Vite**, npm i plik blokady wersji | Wygodny lokalny serwer, pakowanie zależności i powtarzalny build. Vite nie działa na serwerze produkcyjnym. |
| Testy | Wbudowane testy Node.js; później Playwright | Testy danych i logiki bez dodatkowego frameworka; przeglądarka do sprawdzenia interakcji. |

Sprawdzona dokumentacja wskazuje obecnie Leaflet 2 jako wersję beta. **Nie opierałbym pierwszej wersji na wydaniach beta.**

**Alternatywa: MapLibre GL JS.** Ma przewagę przy bardzo dużych zbiorach renderowanych przez WebGL i zaawansowanym rozmieszczaniu etykiet. Wprowadza jednak bardziej złożony model stylów i warstw. Wybrałbym go zamiast Leaflet, jeśli dane obejmują np. setki tysięcy jednocześnie widocznych punktów albo wymagają gęstych, automatycznie rozmieszczanych nazw.

Można też zrezygnować z Vite i przechowywać biblioteki bezpośrednio w projekcie. Oszczędza to etap budowania, ale utrudnia aktualizacje zależności. **Vite jest tu niewielkim kosztem organizacyjnym.**

## 2. Przepływ działania

1. Przeglądarka pobiera aplikację i katalog zestawów.
2. Panel pokazuje zestawy, ich kolory i niezależne przełączniki **Pokaż/ukryj zestaw danych**.
3. Plik zestawu jest pobierany dopiero przy pierwszym włączeniu.
4. Aplikacja sprawdza dane i tworzy znaczniki.
5. Ukrycie zestawu chowa jego punkty, etykiety i otwarte opisy; dane pozostają w pamięci. Ponowne pokazanie zestawu przywraca punkty i etykiety.

Każdy zestaw ma niezależny stan: **wyłączony, ładowanie, gotowy albo błąd**. Błąd jednego pliku nie powinien blokować pozostałych.

Pomiar będzie osobną warstwą, niezależną od włączania zestawów.

## 3. Struktura projektu

Poniżej propozycja, nie utworzone pliki:

```text
map-layers/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── .gitignore
├── src/
│   ├── main.js             # uruchomienie i połączenie modułów
│   ├── map.js              # podkład i ustawienia mapy
│   ├── datasets.js         # pobieranie danych i widoczność zestawów
│   ├── validation.js       # sprawdzanie danych
│   ├── labels.js           # etykiety i ich widoczność
│   ├── measurement.js      # stan pomiaru i odległości
│   └── styles.css
├── public/
│   └── data/
│       ├── catalog.json
│       └── datasets/
│           ├── miejsca.geojson
│           └── pomiary.geojson
├── tests/
│   ├── data.test.js
│   ├── measurement.test.js
│   └── browser/
└── .github/
    └── workflows/
        └── pages.yml
```

Wynik budowania trafi do `dist/`. Nie będzie zawierać konfiguracji OpenClaw ani innych plików workspace.

## 4. Format danych

### Katalog zestawów: `catalog.json`

Zawiera metadane i odnośniki, nie same punkty:

```json
{
  "version": 1,
  "datasets": [
    {
      "id": "miejsca",
      "name": "Miejsca obserwacji",
      "description": "Punkty terenowe",
      "file": "datasets/miejsca.geojson",
      "color": "#2563eb",
      "visibleByDefault": true
    }
  ]
}
```

Pole `file` będzie interpretowane **względem adresu katalogu danych**.

### Punkty: standard GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "punkt-001",
      "geometry": {
        "type": "Point",
        "coordinates": [21.0122, 52.2297]
      },
      "properties": {
        "name": "Punkt Warszawa",
        "description": "Przykładowy opis"
      }
    }
  ]
}
```

**W GeoJSON kolejność to `[długość, szerokość]`, czyli `[longitude, latitude]`.** To ważne, ponieważ część API Leaflet przyjmuje odwrotną kolejność. Odczyt przez obsługę GeoJSON w Leaflet pozwala uniknąć ręcznego przestawiania współrzędnych.

Reguły:

- Współrzędne geograficzne WGS84, zapisane w stopniach.
- Wymagane: identyfikator punktu, nazwa i poprawne współrzędne.
- Identyfikator punktu unikalny w obrębie zestawu; nazwy mogą się powtarzać.
- Opis opcjonalny.
- Nazwy i opisy wyświetlane jako tekst, nie interpretowane jako HTML.
- Walidacja wszystkich danych przed publikacją; czytelny komunikat o błędach również podczas działania.

**Dodanie zestawu:** nowy plik GeoJSON i jeden wpis w katalogu, bez edycji JavaScriptu.

Kompromis: GeoJSON jest bardziej rozbudowany niż CSV, ale standardowy, jednoznaczny i obsługiwany przez narzędzia GIS. Jeśli źródłem są arkusze, można później dodać konwersję CSV bez zmiany formatu aplikacji.

## 5. Etykiety i widoczność zestawów

- Punkty mają etykiety z nazwami, widoczne razem z danymi zestawu.
- Każdy zestaw można niezależnie pokazać lub ukryć przełącznikiem w panelu.
- Ukrycie zestawu chowa jego znaczniki, etykiety i otwarte opisy. Nie potrzeba osobnego przełącznika etykiet.
- Kliknięcie punktu (również na telefonie) lub obsługa klawiaturą pozwala odczytać nazwę i opis.
- Etykiety mogą się nakładać. Nie wprowadzamy automatycznego rozmieszczania, eliminacji kolizji ani automatycznych trybów widoczności.
- Punkty są wyświetlane bez klastrowania i bez rozsuwania punktów o identycznych współrzędnych.

**Poza zakresem obecnego etapu:** klastrowanie, automatyczne etykiety i testy wydajności. Pozostaje ładowanie zestawów na żądanie i przechowywanie pobranych danych w pamięci.

## 6. Pomiar odległości

Osobny tryb **„Pomiar”**:

1. Włączenie trybu.
2. Klikanie kolejnych miejsc na mapie tworzy łamaną.
3. Kliknięcie istniejącego znacznika dodaje jego dokładne współrzędne.
4. Panel pokazuje długość ostatniego odcinka i sumę.
5. Przyciski: **Cofnij punkt**, **Zakończ**, **Wyczyść**.

Kliknięcie znacznika w tym trybie nie powinno jednocześnie otwierać opisu ani dodawać drugiego punktu przez propagację zdarzenia.

Odległości liczone przez `LatLng.distanceTo()` w Leaflet, w metrach, sumowane przed zaokrągleniem. Prezentacja w metrach lub kilometrach.

To **odległość geograficzna między kolejnymi wskazaniami**, nie trasa po drogach i nie długość uwzględniająca ukształtowanie terenu. Sferyczny model Leaflet wystarczy do orientacyjnych pomiarów mapowych, nie do zastosowań geodezyjnych.

Nie proponuję rozbudowanej wtyczki rysunkowej: dla jednej łamanej jej dodatkowe funkcje i zależności nie są potrzebne.

## 7. OpenStreetMap i ścieżki GitHub Pages

### Podkład

Na początek standardowe kafelki:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

Z widoczną atrybucją **© OpenStreetMap contributors**, zachowaniem zwykłego cache przeglądarki i bez masowego pobierania czy trybu offline. Publiczny serwer OSM nie gwarantuje dostępności; adres podkładu powinien być łatwy do zmiany.

### Ścieżki

Strona może działać pod:

`https://uzytkownik.github.io/nazwa-repozytorium/`

Dlatego:

- Vite: proponowane `base: './'`.
- Katalog danych pobierany adresem względnym wobec strony.
- Pliki zestawów rozwiązywane względem URL `catalog.json`.
- Bez ścieżek zaczynających się od `/data/` czy `/assets/`.
- Bez routingu wymagającego przepisywania adresów przez serwer.

Przykładowo `datasets/miejsca.geojson` ma prowadzić do:

`https://uzytkownik.github.io/nazwa-repozytorium/data/datasets/miejsca.geojson`

Te same pliki wynikowe powinny działać zarówno w katalogu głównym, jak i pod nazwą repozytorium.

**Dane opublikowane razem z aplikacją będą dostępne dla odwiedzających do pobrania.** Wyłączenie zestawu na mapie nie chroni jego zawartości.

## 8. Plan testów i publikacji

### Testy

| Zakres | Sprawdzenie |
|---|---|
| Dane | Poprawny JSON/GeoJSON, unikalne ID, wymagane nazwy, zakresy współrzędnych, istnienie plików |
| Warstwy | Pokazywanie i ukrywanie zestawu razem z etykietami i otwartymi opisami, niezależne przełączanie, brak duplikatów, poprawne zachowanie przy szybkim włączaniu i wyłączaniu podczas pobierania |
| Etykiety | Polskie znaki, długie nazwy, identyczne lokalizacje, obsługa telefonu i klawiatury |
| Pomiar | Zero, powtórzony punkt, znane odległości z tolerancją, suma odcinków, cofanie i czyszczenie |
| Błędy | Brak pliku, błędny zestaw, niedostępny podkład — bez awarii całej aplikacji |
| Ścieżki | Build uruchomiony pod `/` i `/test-repo/`; brak błędów 404 |
| Publikacja | Test rzeczywistego adresu Pages: mapa, dane, znaczniki, przełączniki i pomiar |

Automatyczne testy interfejsu nie powinny zależeć od dostępności zewnętrznych kafelków. Osobny krótki test ręczny sprawdzi rzeczywisty podkład OSM.

### Publikacja

Docelowy workflow GitHub Actions:

**pobranie repozytorium → `npm ci` → walidacja i testy → build → publikacja `dist/` na Pages.**

W obecnym środowisku są Git, Node.js i npm oraz działają testy HTTP. Do pełnych testów interfejsu trzeba przygotować przeglądarkę testową. Do publikacji nadal brakuje dostępu GitHub, tożsamości autora commitów, repozytorium i konfiguracji Pages. Żaden z tych elementów nie jest potrzebny do samego zaprojektowania aplikacji.

## 9. Małe, sprawdzalne etapy

1. **Kontrakt danych i przykłady** — dwa zestawy, w tym powtarzające się współrzędne; walidacja działa.
2. **Szkielet mapy** — podkład, atrybucja, build działający pod podścieżką.
3. **Wiele zestawów** — katalog, ładowanie na żądanie, przełączniki i błędy.
4. **Znaczniki i nazwy** — kolory, opisy, etykiety chowane razem z zestawem, klawiatura i telefon.
5. **Pomiar** — kolejne punkty, suma, cofanie, zakończenie i czyszczenie.
6. **Publikacja** — automatyzacja Pages i sprawdzenie rzeczywistej strony.

## Decyzje potrzebne od Ciebie

1. **Jaka będzie skala danych?** Przybliżona liczba zestawów, punktów w największym zestawie i punktów widocznych jednocześnie.
2. **W jakim formacie masz obecnie dane i jakie mają współrzędne?** To zdecyduje, czy potrzebny będzie konwerter.
3. **Czy wszystkie publikowane punkty i opisy mogą być publiczne?** Jeśli nie, wspólne udostępnienie tych plików przez publiczne Pages wymaga zmiany założenia.

Pozostałe wybory techniczne można przyjąć zgodnie z rekomendacją, bez dodatkowych decyzji z Twojej strony.

Źródła: [Leaflet](https://leafletjs.com/reference-1.9.4.html), [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), [zasady kafelków OSM](https://operations.osmfoundation.org/policies/tiles/), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Nie tworzyłem plików projektu, nie instalowałem pakietów ani nie zmieniałem konfiguracji.
