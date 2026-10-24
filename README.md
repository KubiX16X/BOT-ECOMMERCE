# Revion – generator ofert, bot i sklep

System do sprzedaży w modelu „kup taniej, sprzedaj drożej” na **OLX**, **Allegro** i we własnym sklepie **Revion**.

| Etap | Co robi | Stan |
|---|---|---|
| 1. Generator ofert | Zdjęcie produktu → serie zdjęć AI, tytuły i opisy F-pattern na OLX / Allegro / Revion | ✅ gotowe |
| 2. Sklep Revion | Kategorie, koszyk, Stripe (karta, BLIK, Przelewy24), opcja „BLIK na telefon” z formułką zaufania | ⏳ następny |
| 3. Allegro | Wystawianie ofert i aktualizacja cen przez API | ⏳ |
| 4. Łowca perełek | Najniższa cena vs. cena najlepiej sprzedających się ofert, sezonowość kwartałów | ⏳ (czeka na weryfikację API Allegro) |
| 5. OLX | Półautomat teraz, API po założeniu działalności | ⏳ |

## Generator ofert – jak działa

Wrzucasz 1–3 zdjęcia produktu i wklejasz nazwę + opis/parametry z oferty, z której kupujesz (może być z linkiem). Dostajesz:

- **Serie zdjęć** – liczba serii = liczba darmowych ogłoszeń w kategorii OLX (np. grill = 2 → 2 ogłoszenia).
  Każde ogłoszenie OLX to **6 zdjęć z jednego pomieszczenia** z różnych miejsc i kątów (okładka, w użyciu, inne miejsce, detal, całe pomieszczenie, inny kąt), bez białego tła.
  Kolejne ogłoszenia dzieją się w innych pomieszczeniach. Najpierw Gemini tworzy zdjęcie pustego pomieszczenia (nie trafia do paczki), a potem wszystkie ujęcia robi w tym samym wnętrzu, żeby ściany, meble i światło się zgadzały.
  Dodatkowo 1 zdjęcie na białym tle – tylko do Allegro. Produkt jest brany 1:1 ze zdjęcia referencyjnego – AI zmienia tylko otoczenie.
- **Tytuły** – każde słowo od wielkiej litery, ciąg fraz wyszukiwania, limit OLX 70 / Allegro 75 znaków (przycinane tylko na granicy słów).
  Każda seria OLX ma **inny tytuł** z innym zestawem fraz, żeby łapać więcej wyszukiwań.
- **Opisy F-pattern** w Twoim układzie: kontakt → atuty ◼ → TYTUŁ → wstęp → DLACZEGO WARTO → SPECYFIKACJA → zdanie domykające → ZAWARTOŚĆ ZESTAWU → kontakt → WYSYŁKA I PŁATNOŚĆ → wezwanie → słowa kluczowe.
- **Wersje per platforma**
  - OLX: telefon w formacie `6-6-6-0-7-9-1-8-1`, płatność BLIK na telefon / przelew, przewidywana dostawa, blok słów kluczowych.
  - Allegro: bez telefonu, bez płatności poza Allegro i bez bloku słów kluczowych (regulamin Allegro); zdjęcie na białym tle jako 1., potem zdjęcia z serii 1; dodatkowo wersja HTML pod API.
  - Revion: nazwa i opis HTML na stronę produktu.
- **ZIP** z folderami `olx/seria-N`, `allegro`, `revion`, plikiem `CZYTAJ.txt` (uwagi do sprawdzenia) i `oferta.json`.

> Model „kupuję u dostawcy dopiero po wpłacie klienta” oznacza, że paczkę nadaje dostawca. Dlatego w opisach OLX nie ma „Przesyłki OLX” ani „płatności u kuriera” (pieniądze z pobrania trafiłyby do dostawcy), a zamiast „wysyłki w 24h” jest przewidywana dostawa z oferty źródłowej.

Teksty pisze **Claude** (wyłącznie na podstawie zdjęć i tekstu źródłowego – brakujące dane trafiają do uwag zamiast być zmyślane), zdjęcia generuje **Google Gemini**.

### Bot na Telegramie

`/nowa` → zdjęcia → opis źródłowy → kategoria OLX (bot pamięta limity; dla nowej kategorii zapyta o liczbę darmowych ogłoszeń) → dostawa → **Generuj** albo **Tylko teksty**.
Bot odsyła album zdjęć dla każdej serii (zapiszesz je w galerii i wgrasz w aplikacji OLX), tytuły i opisy jako osobne wiadomości do skopiowania oraz ZIP.

Inne komendy: `/limity`, `/limit 3 Elektronika > Drukarki`, `/anuluj`. Z bota korzystają tylko ID z `TELEGRAM_ALLOWED_USER_IDS`.

### Panel www

`/admin/generator` – to samo w przeglądarce, z podglądem zdjęć, licznikami znaków, przyciskami „Kopiuj” i pobieraniem ZIP-a. Przycisk „Zobacz przykład wyniku” pokazuje wynik dla projektora bez kluczy API.

## Uruchomienie

Wymagany Node.js 22+.

```bash
npm install
cp .env.example .env      # uzupełnij klucze (opis niżej)

npm run generuj -- --demo # test bez kluczy: przykładowa paczka w data/paczki/
npm run bot               # bot Telegram
npm run web               # panel w trybie deweloperskim: http://localhost:3000/admin
```

Generator z linii poleceń:

```bash
npm run generuj -- --zdjecie foto.jpg --opis opis.txt --kategoria "Dom i Ogród > Ogród > Grille" --dostawa 2-4
#   --serie N       nadpisuje limit kategorii
#   --bez-zdjec     tylko teksty
```

### Klucze w `.env`

| Zmienna | Skąd |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (wymaga włączonych płatności dla modeli obrazkowych) |
| `TELEGRAM_BOT_TOKEN` | napisz do [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_ALLOWED_USER_IDS` | uruchom bota i napisz do niego – odpowie Twoim ID |
| `SELLER_PHONE` | Twój numer (w opisie OLX pojawi się z myślnikami) |
| `ADMIN_PASSWORD` | hasło do panelu `/admin` |

Opcjonalnie: `GEMINI_IMAGE_MODEL` (domyślnie `gemini-3.1-flash-image`; `gemini-3-pro-image` jeszcze wierniej oddaje detale, ale jest droższy; `gemini-2.5-flash-image` – starszy i tańszy), `CLAUDE_MODEL`, `OLX_COMPETITOR_KEYWORDS=false` (wyłącza frazy typu „samsung freestyle zamiennik”).

### Koszt jednej oferty (orientacyjnie)

Przy 2 seriach: 13 zdjęć + 2 zdjęcia pustych pomieszczeń z Gemini 3.1 Flash Image (ok. 0,07 USD/szt.) + teksty Claude ≈ **4–5 zł**. Tryb „Tylko teksty” – kilkadziesiąt groszy.

Uwaga: API Claude ma osobne rozliczenie od subskrypcji Claude – środki doładowujesz w console.anthropic.com → Plans & Billing. Zdjęcia z API Gemini nie mają widocznego znaku wodnego.

## Wdrożenie

Bot i panel muszą działać jako stałe procesy (generowanie trwa 1–2 minuty), więc najprościej na małym serwerze VPS z Node.js 22:

```bash
git clone <repo> && cd BOT-ECOMMERCE
npm ci && cp .env.example .env   # uzupełnij
npm run build -w @revion/web
npx pm2 start "npm run bot" --name revion-bot
npx pm2 start "npm run start -w @revion/web" --name revion-web
```

Panel nie nadaje się na serverless (np. darmowy Vercel) – zadania generowania działają w tle w pamięci serwera.

## Dostosowanie

- **Szablony opisów**: `config/szablony/*.mustache` – zmieniasz stałe teksty bez dotykania kodu (`{{intro}}`, `{{#benefits}}…{{/benefits}}`, `{{delivery}}`, `{{phoneDashed}}`, `{{keywordsLine}}` itd.).
- **Limity OLX**: domyślne w `config/olx-limity.json`, Twoje zapisują się w `data/olx-limity.json` (bot i panel aktualizują je same).
- **Pisownia w tytułach**: skróty i marki z nietypową wielkością liter (TV, HDMI, WiFi, iPhone, mAh…) są w `packages/core/src/text/titles.ts`.

## Struktura

```
packages/core   logika: tytuły, szablony, Claude, Gemini, ZIP, limity OLX, CLI
apps/bot        bot Telegram (grammY)
apps/web        Next.js: panel /admin (później sklep Revion)
config/         szablony opisów i domyślne limity OLX
data/           paczki ofert i Twoje ustawienia (poza repozytorium)
```

Testy: `npm test` · typy: `npm run typecheck`.

## Ważne zasady (skrót)

- **Działalność nierejestrowana 2026**: limit **10 813,50 zł przychodu na kwartał** (liczy się cała sprzedaż, nie zysk). Po przekroczeniu masz 7 dni na wpis do CEIDG. Prawa konsumenta (14 dni na zwrot, reklamacje) obowiązują normalnie.
- **Allegro**: zakaz kierowania do kontaktu i płatności poza Allegro, zakaz spamu słów kluczowych i cudzych marek – generator stosuje to automatycznie.
- **OLX**: kilka ogłoszeń tego samego produktu to według regulaminu dublowanie. Różne zdjęcia i tytuły zmniejszają szansę wykrycia, ale ryzyko usunięcia ogłoszeń zostaje.
- **Zdjęcia AI** muszą wiernie pokazywać produkt – zawsze przejrzyj paczkę przed wystawieniem.
