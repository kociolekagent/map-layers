# Zaakceptowany kontrakt danych v1

Kontrakt zaakceptowany przez użytkownika w rozmowie projektowej. Nie zmieniać bez jego akceptacji.
Poniższy zapis utrwala reguły do implementacji; wcześniejszy `plan.md` nie nadpisuje kontraktu.

## Format

UTF-8, poprawny JSON bez komentarzy i końcowych przecinków. Plik zestawu `.json`
lub `.geojson` zawsze zawiera GeoJSON FeatureCollection, nie dowolny format JSON.
Wymagane pola nie mogą być null; opcjonalne należy pominąć zamiast podawać null.
Nieznane pola są ignorowane, nie zastępują wymaganych. Teksty nie są HTML.

## Katalog

- `version`: wymagana liczba całkowita, dokładnie 1.
- `datasets`: wymagana tablica od 1 do 5 obiektów.
- Zestaw: wymagane `id`, `name`, `file`, `color`; opcjonalne `description`, `visibleByDefault`.
- `id`: string 1–64 znaków, `^[a-z0-9][a-z0-9_-]{0,63}$`, unikalny w katalogu.
- `name`: string 1–120 punktów kodowych Unicode, jednowierszowy, bez skrajnych białych znaków.
- `file`: względna ścieżka `.geojson` lub `.json`, rozwiązywana względem URL katalogu;
  plik w katalogu danych lub podkatalogu. Bez `..`, odwrotnych ukośników, parametrów,
  fragmentów URL, adresów absolutnych i początkowego `/`.
- `color`: string w formacie `#RRGGBB`, wielkość liter dowolna.
- `description`: string do 2000 punktów kodowych Unicode; opcjonalny, może być pusty i wielowierszowy.
- `visibleByDefault`: boolean, domyślnie false, określa wyłącznie stan początkowy.
- Nazwy i kolory zestawów mogą się powtarzać.

## Punkty

Korzeń: wymagane `type: "FeatureCollection"` i tablica `features`, także pusta.
Każdy punkt wymaga `type: "Feature"`, `id`, obiektu `geometry` i obiektu `properties`.
ID punktu ma ten sam wzorzec co ID zestawu, jest unikalne w obrębie zestawu i pozostaje
stabilne przy zmianie nazwy, opisu lub lokalizacji. ID znajduje się w Feature.id.
Tożsamość w aplikacji: para (ID zestawu, ID punktu); ID mogą powtarzać się między zestawami.

`geometry.type` to wyłącznie `Point`; `coordinates` to dokładnie dwie skończone liczby:
`[longitude, latitude]`, WGS84 w stopniach, długość [-180,180], szerokość [-90,90].
Bez wysokości, konwersji stringów, zaokrąglania, zamiany kolejności i korekt zakresu.
`crs` nie jest obsługiwane i jest niedozwolone w obiektach GeoJSON.
Poprawne punkty blisko biegunów mogą leżeć poza zasięgiem podkładu Web Mercator;
nie przesuwamy ich ani nie odrzucamy z tego powodu.

`properties.name` jest wymagane i podlega tym samym regułom co nazwa zestawu.
`properties.description` jest opcjonalne i podlega tym samym regułom co opis zestawu.
Nazwy mogą się powtarzać. Brak automatycznego przycinania lub poprawiania tekstów.
Około 1000 punktów w największym zestawie jest założeniem skali, nie twardym limitem.

## Identyczne współrzędne i przyszły interfejs

- Rekordy pozostają oddzielne, bez scalania, klastrowania, rozsuwania i przesuwania.
- Dokładna równość obu liczb określa wspólną lokalizację, bez tolerancji; 21 i 21.0 są równe.
- Kliknięcie wspólnej lokalizacji pokazuje wszystkie rekordy widocznych zestawów:
  nazwę zestawu, nazwę punktu i opcjonalny opis, w kolejności katalogu i tablic features.
- Etykiety mogą się nakładać, bez automatycznego rozmieszczania.
- W trybie pomiaru takie kliknięcie dodaje jeden wierzchołek, nie otwiera szczegółów.
- Ukrycie zestawu chowa jego punkty i etykiety oraz zamyka jego szczegóły, nie narusza
  innych zestawów ani pomiaru. Ponowne pokazanie korzysta z pamięci bez duplikatów.
- Ukrycie podczas pobierania pozostaje skuteczne po jego zakończeniu.
- Wszystkie publikowane dane są publiczne; ukrycie ich nie zabezpiecza.

## Błędy

Przed publikacją walidujemy katalog i wszystkie pliki, także domyślnie ukryte.
Dowolny błąd kończy walidację niepowodzeniem. Diagnostyka wskazuje plik, pole/indeks
oraz przyczynę. Duplikat ID wskazuje również pierwsze wystąpienie.
Niepoprawny katalog (w tym wersja i duplikaty ID) jest odrzucany w całości.
Niepoprawny punkt, duplikat ID, współrzędne lub JSON odrzuca cały zestaw, nie jego część.

W przyszłym interfejsie niedostępny katalog blokuje zestawy, ale nie mapę i pomiar.
Niedostępny plik, błąd sieci lub HTTP inny niż sukces dotyczy tylko danego zestawu.
Wyłączenie i ponowne włączenie po błędzie ponawia pobranie; poprawnie pobrane dane
pozostają w pamięci. Nie ma częściowego wyświetlania błędnego zestawu.

Przykłady stanowią `public/data/catalog.json` oraz dwa odpowiadające mu pliki GeoJSON.
Testy bieżącego etapu pokrywają reguły danych i odczytu plików; wymagania interfejsu,
HTTP i pomiaru pozostają obowiązujące, lecz poza zakresem etapu 1.
