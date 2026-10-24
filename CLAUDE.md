# Revion – ustalenia dla Claude

Użytkownik pisze po polsku i woli krótkie, konkretne odpowiedzi. Nie zna się na programowaniu – instrukcje krok po kroku, bez żargonu.

## Jak pracujemy (bez płatnego API Claude)

Użytkownik NIE doładowuje API Claude. Teksty ofert piszesz Ty w rozmowie, zdjęcia robi Gemini (klucz użytkownika):

1. Użytkownik wysyła link do oferty Allegro (+ czasem cenę i „kupiło X osób”). Jeśli `allegro.pl` / `allegroimg.com` są dostępne, czytasz ofertę i pobierasz 1–3 zdjęcia produktu; jeśli nie – prosisz o wklejenie opisu i zdjęć.
2. Piszesz plik JSON zgodny z `ProductCopySchema` (`packages/core/src/copy/schema.ts`) według zasad z `SYSTEM_PROMPT` w `packages/core/src/copy/copywriter.ts` (tylko fakty ze źródła, tytuły ≤70/75 znaków, F-pattern, 1 pomieszczenie na serię, 6 ujęć po angielsku). Zapisujesz w `data/teksty/`.
3. `npm run generuj -- --teksty data/teksty/<plik>.json --zdjecie <foto> --kategoria "<kategoria OLX>" --serie <N> --dostawa <min-max>`
4. Wysyłasz użytkownikowi ZIP i podgląd zdjęć (SendUserFile).

Klucze są w `.env` (poza repo). W nowej sesji poproś o `GEMINI_API_KEY` i numer telefonu do `SELLER_PHONE`, skopiuj `.env.example` do `.env`. `ANTHROPIC_API_KEY` i Telegram nie są używane.

## Allegro API

Strona allegro.pl blokuje automaty (403) – nie obchodzić. Oficjalne API: aplikacja „Revion” zarejestrowana w apps.developer.allegro.pl jako **device_code**, cel „na swoje potrzeby”, uprawnienia: `sale:offers:read/write`, `sale:settings:read`, `orders:read/write`, `billing:read`, `profile:read`. Dane w `.env`: `ALLEGRO_CLIENT_ID`, `ALLEGRO_CLIENT_SECRET`, `ALLEGRO_USER_AGENT` (nagłówek User-Agent jest obowiązkowy w każdym zapytaniu – zły blokuje klucz). Autoryzacja: device flow – użytkownik dostaje link z kodem i klika „Zezwól”. Wyszukiwanie cudzych ofert (`GET /offers/listing`) wymaga osobnej weryfikacji przez Allegro.

## Zasady biznesowe

- **Działalność nierejestrowana**: limit 10 813,50 zł przychodu na kwartał (2026).
- **Bez prądu**: przy sprzedaży na odległość zwolnienie z VAT nie obejmuje m.in. urządzeń elektrycznych i elektroniki (art. 113 ust. 13 ustawy o VAT) → żadnych produktów z wtyczką, baterią lub ładowarką. Też bez: kosmetyków/perfum, części samochodowych, biżuterii z metali szlachetnych, alkoholu/e-papierosów.
- **Dropshipping**: użytkownik kupuje u najtańszego sprzedawcy dopiero po wpłacie klienta, paczkę nadaje dostawca → na OLX tylko BLIK na telefon/przelew (bez Przesyłki OLX i pobrania), w opisie przewidywana dostawa zamiast „wysyłki 24h”.
- **Zdjęcia**: jedno ogłoszenie OLX = jedno pomieszczenie, 6 zdjęć z różnych miejsc/kątów, bez białego tła. Białe tło tylko na Allegro (jako 1. zdjęcie). Liczba serii = liczba darmowych ogłoszeń w kategorii OLX.
- **Perełki** (na razie ręcznie): cena zakupu 60–300 zł, różnica do bestsellerów ≥ 40–50 zł, zysk po prowizji i wysyłce ≥ 30 zł i ≥ 20%. Sezonowość kwartałów (IV kw.: święta, Black Friday).

## Repozytorium

Repo jest **publiczne** – nie commituj list produktów, źródeł ani tekstów ofert (trzymaj je w `data/`, które jest w `.gitignore`). Commituj tylko kod i dokumentację; push na `main`.

Testy: `npm test`, typy: `npm run typecheck`.
