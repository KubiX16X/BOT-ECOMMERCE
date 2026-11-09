# Revion – ustalenia dla Claude

Użytkownik pisze po polsku i woli krótkie, konkretne odpowiedzi. Nie zna się na programowaniu – instrukcje krok po kroku, bez żargonu.

## Jak pracujemy (bez płatnego API Claude)

Użytkownik NIE doładowuje API Claude. Teksty ofert piszesz Ty w rozmowie, zdjęcia robi Gemini (klucz użytkownika):

1. Użytkownik wysyła link do oferty Allegro (+ czasem cenę i „kupiło X osób”). Jeśli `allegro.pl` / `allegroimg.com` są dostępne, czytasz ofertę i pobierasz 1–3 zdjęcia produktu; jeśli nie – prosisz o wklejenie opisu i zdjęć.
2. Piszesz plik JSON zgodny z `ProductCopySchema` (`packages/core/src/copy/schema.ts`) według zasad z `SYSTEM_PROMPT` w `packages/core/src/copy/copywriter.ts` (tylko fakty ze źródła, tytuły ≤70/75 znaków, F-pattern, 1 pomieszczenie na serię, 6 ujęć po angielsku). Zapisujesz w `data/teksty/`.
3. `npm run generuj -- --teksty data/teksty/<plik>.json --zdjecie <foto> --kategoria "<kategoria OLX>" --serie <N> --dostawa <min-max>`
4. Wysyłasz użytkownikowi ZIP i podgląd zdjęć (SendUserFile).

Klucze są w `.env` (poza repo). W nowej sesji poproś o `GEMINI_API_KEY` i numer telefonu do `SELLER_PHONE`, skopiuj `.env.example` do `.env`. `ANTHROPIC_API_KEY` i Telegram nie są używane.

## Butik „Prawie Nowe by Kuba” (Vinted, Szafa.pl)

Ubrania i buty z hurtowni outletowych. Użytkownik zaczyna sesję własnym promptem startowym (kopia: `data/vinted/prompt-start.md`) – to on ustala zasady opisów.

**Vinted (stan 11.2026):** zwykłe konto zabrania odsprzedaży z zyskiem (od I–II 2026 masowe blokady w PL), Vinted Pro w Polsce niedostępne, a zdjęcia mają być własne i nieobrobione. Towar z hurtowni → Szafa.pl (konto dla działalności nierejestrowanej), strona prawienowe.pages.dev, Facebook; na Vinted tylko prywatne rzeczy i bez wizualizacji AI. Książka wiedzy dla użytkownika: Claude Docs „Prawie Nowe by Kuba – książka sprzedawcy” (PDF w `data/ksiazka/`).

Zdjęcia AI robi Gemini: ubranie – manekin, model (cała sylwetka), model bliżej (ta sama osoba); buty – para, na nogach, stopy. Format 3:4, na tle użytkownika:
`NODE_USE_ENV_PROXY=1 npm run vinted -- --zdjecie <przód> [--tlo <tło>] --typ ubranie|buty --nazwa "<nazwa>" --opis "<opis po angielsku>" --model "<kto nosi, po angielsku>"`.
Poprawka jednego ujęcia: `--tylko 2` (nowa wersja zapisuje się obok jako `-v2`). Tło zapamiętuje się w `data/vinted/tlo.jpg`, wyniki są w `data/vinted/<data>-<nazwa>/`. Zdjęcia wysłane przez użytkownika w czacie są plikami (ścieżka „source:” przy obrazku). Przed wysłaniem porównaj każde zdjęcie AI z prawdziwym (logo, kolor, krój, detale). Pierwsze zdjęcie ogłoszenia zawsze prawdziwe, a w opisie dopisek o wizualizacji AI.

## Posty na Instagram i TikTok (@prawienowebykuba)

Karuzele robisz Ty: piszesz plan JSON zgodny z `SocialPostSchema` (`packages/core/src/social/schema.ts`), zapisujesz w `data/posty/` (ścieżki zdjęć względem pliku planu) i uruchamiasz `npm run posty -- --plan data/posty/<plik>.json`. Program rysuje w Chromium slajdy Instagram 4:5 i TikTok 3:4 (posty ze zdjęciami na TikToku muszą być 3:4; układ liczony w 1080 px, margines na przyciski TikToka – zawsze symetryczny, treść ma być na środku) – **zawsze w 4K**: IG 3072×3840, TikTok 2880×3840 (`LONG_EDGE` w `render.ts`, JPG q92); nie zmniejszaj jakości, zapisuje opisy z hasztagami, tytuł TikToka (`tiktok.title`, do 90 znaków → `tytul-tiktok.txt`) i ZIP w `data/posty/<data>-<nazwa>/`; użytkownikowi wysyłasz ZIP i `podglad.jpg`. Czcionki i logo są w `config/fonts` i `config/marka`.

- Slajdy: `cover` (prawdziwe zdjęcie z hakiem i znacznikami rozmiar/stan/cena albo okładka marki bez zdjęcia), `photo` (z etykietą: Tył, Metka, Wada, Wizualizacja AI), `info` (rozmiar, stan, wymiary, cena), `text` (porady, max 6 punktów), `cta`.
- Oferta: okładka z prawdziwym zdjęciem → zdjęcia → info → cta. Poza ofertami: poradniki, kulisy, przedstawienie butiku (rozdział 16 książki).
- Maks. 5 hasztagów na platformę (limit IG i TikTok), pod duże zasięgi w Polsce (później świat): IG `#moda #modadamska #secondhand #stylizacja #ootd`, TikTok `#dlaciebie #moda #lumpeks #outfit #secondhand`; pierwsze miejsce może zająć 1 tag rzeczy, której szukają kupujący (#sweter, #kurtka, #jeansy, #buty, #blackfriday…; w ofercie marka). Bez lokalnych (#jeleniagora), ogólnych spoza mody (#polska) i niszowych (#porady, #pielegnacja – to kosmetyki). Popularności nie mierzymy – nie obiecuj zasięgów.
- Zakupy zawsze na 3 sposoby (slajd CTA i opis): wiadomość na IG/WhatsAppie, prawienowe.pages.dev, Szafa.pl – linki w bio.
- TikTok: zawsze tytuł (chwytliwy hak, do 90 znaków) i dłuższy opis (lead, punkty, 3 sposoby zakupu, pytanie). W panelu przycisk „Kopiuj tytuł TikTok”, pole `ttTitle` w bazie.
- Pierwsza linia opisu to hak, słowa kluczowe w opisie, na końcu pytanie lub wezwanie. Wizualizacje AI zawsze z etykietą i dopiskiem w opisie.

## Panel Prawie Nowe (artefakt)

https://claude.ai/artifact/2hGU1nJzVP4DMYS5Mosvwj – prywatny panel użytkownika: kalendarz 2 postów dziennie (od 9.11.2026: rano poradnik, wieczorem krótka karuzela albo oferta – użytkownik NIE nagrywa filmów, tylko posty), licznik limitu kwartalnego, agenci AI uruchamiani w panelu (capability `sample` z obrazami; przycisk „Otwórz w nowym czacie Claude” = `claude.ai/new?q=`), instrukcja „nowy towar”.
- Publikacja panelu: `data/posty/miesiac/panel/panel.html` z `capabilities` {db, user, downloads, sample: {images: true}}.
- Baza artefaktu: `posty/<data>-rano|<data>-wieczor` (date, slot, time, kind `karuzela|film|oferta`, title, igCaption, ttCaption, ttTitle, slides `p/<folder>/NN.jpg`, ttSlides `tt/<folder>/NN.jpg`, hook, shots), `status/<id>` (ig, tt – odhacza użytkownik), `sprzedaz` (date, item, amount, channel – wpisuje użytkownik).
- Grafiki 4K to pliki artefaktu w `p/` (IG) i `tt/` (TikTok), miniatury do paska slajdów w `miniatury.json` (`node data/posty/miesiac/miniatury-i-zip.mjs`, z `--zip` też jeden ZIP całego miesiąca). Paczki ZIP składa strona (artefakt nie serwuje .zip): przy poście jedna paczka, w podsumowaniu „Pobierz cały kalendarz – 1 plik ZIP” z folderami po kolei `NN RRRR-MM-DD dzień rano|wieczor - Tytuł`. Publikacja plików partiami: ≤64 MB i ≤255 plików na raz, ≤511 plików w wersji.
- Nowy towar → oferta: plan JSON i `npm run posty`, skopiuj slajdy do `p/<data>-oferta/` i `tt/<data>-oferta/`, opublikuj je do artefaktu (z innej rozmowy: `Artifact` read, potem publish z `url`, w `files` tylko nowe pliki), potem `ArtifactData` set `posty/<najbliższy wolny wieczór>` z kind `oferta`. Treść miesiąca i skrypt: `data/posty/miesiac/` (lokalnie).
- Opis oferty na IG w formacie użytkownika: `[Marka] [Nazwa] – [Stan], [Rozmiar]` / `CENA: [..] zł` / `► kolor, krój, detal` / punkty `• STAN • ROZMIAR • WYMIARY (pod pachami — długość — rękaw) • DETALE • MATERIAŁ` / `ZAMÓWIENIA: napisz wiadomość na Instagramie lub WhatsAppie.` / `MOŻESZ TEŻ KUPIĆ: przez moją stronę prawienowe.pages.dev (link w bio) po wcześniejszej przedpłacie, a także na Szafa.pl lub Vinted.` / `Przedmiot posiadam fizycznie na stanie. Zakupy opłacone do godziny 18:00 nadaję do paczkomatu jeszcze tego samego dnia.` / 5 hasztagów. Opisy TikTok/IG i Vinted/Szafa/OLX robią w panelu agenci „Opisy TikTok + IG” i „Opis Vinted / Szafa / OLX” na prompcie użytkownika (kopia: `data/vinted/prompt-opisy.md`; w panelu bez internetu i plików, teksty oddzielone liniami `=== NAZWA ===`; zdjęć bez limitu – ponad limit jednego zapytania panel czyta je partiami jako notatki).

## Allegro API

Strona allegro.pl blokuje automaty (403) – nie obchodzić. Oficjalne API: aplikacja „Revion” zarejestrowana w apps.developer.allegro.pl jako **device_code**, cel „na swoje potrzeby”, uprawnienia: `sale:offers:read/write`, `sale:settings:read`, `orders:read/write`, `billing:read`, `profile:read`, `messaging`, `payments:read`, `disputes`, `ratings`. Dane w `.env`: `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`, `ALLEGRO_USER_AGENT` (nagłówek User-Agent jest obowiązkowy w każdym zapytaniu – zły blokuje klucz). Autoryzacja: device flow – użytkownik dostaje link z kodem i klika „Zezwól”. Działa (sprawdzone 24.10.2026, konto Xkubix2115): `GET /me`, katalog produktów `GET /sale/products?phrase=...` (nazwy, parametry, zdjęcia). Nie działa bez weryfikacji Allegro: `GET /offers/listing` (cudze oferty i ceny) i cudze oferty po ID – 403.

Połączenie konta: `npm run allegro -- polacz` (link dla użytkownika), potem w tle `npm run allegro -- czekaj`; test: `npm run allegro -- test`. Tokeny w `data/allegro-token.json`. Środowisko musi mieć w Allowed domains: `allegro.pl`, `api.allegro.pl`, `*.allegroimg.com` (zdjęcia są na a.allegroimg.com). W chmurowym środowisku Claude komendy sieciowe w Node uruchamiaj z `NODE_USE_ENV_PROXY=1` (inaczej `fetch` omija proxy i nie widzi allegro.pl).

## Zasady biznesowe

- **Działalność nierejestrowana**: limit 10 813,50 zł przychodu na kwartał (2026).
- **Bez prądu**: przy sprzedaży na odległość zwolnienie z VAT nie obejmuje m.in. urządzeń elektrycznych i elektroniki (art. 113 ust. 13 ustawy o VAT) → żadnych produktów z wtyczką, baterią lub ładowarką. Też bez: kosmetyków/perfum, części samochodowych, biżuterii z metali szlachetnych, alkoholu/e-papierosów.
- **Dropshipping**: użytkownik kupuje u najtańszego sprzedawcy dopiero po wpłacie klienta, paczkę nadaje dostawca → na OLX tylko BLIK na telefon/przelew (bez Przesyłki OLX i pobrania), w opisie przewidywana dostawa zamiast „wysyłki 24h”.
- **Limity OLX** (konto prywatne): pełna tabela w `config/olx-limity.json`; `--kategoria` przyjmuje pełną ścieżkę albo końcówkę („Koce”). Kategoria bez limitu → domyślnie 3 serie (koszt zdjęć). Wybieraj kategorię zgodną z produktem, nie „pod limit”.
- **Zdjęcia**: jedno ogłoszenie OLX = jedno pomieszczenie, 6 zdjęć z różnych miejsc/kątów, bez białego tła. Białe tło tylko na Allegro (jako 1. zdjęcie). Liczba serii = liczba darmowych ogłoszeń w kategorii OLX.
- **Perełki** (na razie ręcznie): cena zakupu 60–300 zł, różnica do bestsellerów ≥ 40–50 zł, zysk po prowizji i wysyłce ≥ 30 zł i ≥ 20%. Sezonowość kwartałów (IV kw.: święta, Black Friday).

## Repozytorium

Repo jest **publiczne** – nie commituj list produktów, źródeł ani tekstów ofert (trzymaj je w `data/`, które jest w `.gitignore`). Commituj tylko kod i dokumentację; push na `main`.

Testy: `npm test`, typy: `npm run typecheck`.
