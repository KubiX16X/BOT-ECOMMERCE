import type { ProductCopy } from "./copy/schema";

/** Przykładowa odpowiedź copywritera (projektor z szablonu sprzedawcy) – do trybu --demo i testów. */
export const DEMO_COPY: ProductCopy = {
  productName: "Mini projektor Heelly Android 11 Smart TV",
  brand: "Heelly",
  olxCategorySuggestion: "Elektronika > TV i Video > Projektory",
  olxTitles: [
    'Mini Projektor Rzutnik Android 11 Smart TV 4K WiFi Kino Domowe 130"',
    "Projektor Przenośny LED Heelly Obrotowy Bluetooth Miracast Do Bajek",
    "Rzutnik Multimedialny Smart TV Netflix YouTube WiFi 5GHz Auto Keystone",
    "Projektor Android Heelly 1280x720 4K 250 ANSI Lumenów Kino Domowe",
  ],
  allegroTitle: 'Mini Projektor Rzutnik Android 11 Smart TV 4K WiFi Bluetooth Heelly 130"',
  storeTitle: "Mini Projektor Heelly Android 11 Smart TV 4K WiFi Bluetooth",
  intro:
    "Telewizory to już przeszłość. Zamień każdy pokój w salę kinową dzięki nowoczesnemu projektorowi polskiej marki Heelly. Wbudowany system Android TV, obrotowa konstrukcja i łączność bezprzewodowa sprawiają, że to kompletne centrum rozrywki, które zabierzesz ze sobą wszędzie.",
  benefits: [
    { feature: "System SMART TV Android 11", benefit: "dostęp do Netflix, YouTube, Disney+, HBO Max, Prime Video i innych aplikacji bezpośrednio z projektora" },
    { feature: "Obrotowa konstrukcja 180°", benefit: "wyświetlaj obraz na ścianie, suficie lub pod dowolnym kątem" },
    { feature: "Łączność WiFi 5GHz i Bluetooth 5.0", benefit: "błyskawiczne przesyłanie obrazu z telefonu (Android/iOS) bez kabli (Miracast/Airplay)" },
    { feature: "Wsparcie dla 4K", benefit: "wysoka jakość obrazu i obsługa plików w wysokiej rozdzielczości" },
    { feature: "Automatyczna korekcja obrazu", benefit: "funkcja Auto Keystone sama wyrównuje obraz, aby był idealnie prostokątny" },
    { feature: "Mobilne Kino", benefit: "ekran od 40 do aż 130 cali (np. 100 cali z odległości 2,9 m)" },
    { feature: "Żywotność na lata", benefit: "lampa wytrzymuje aż 50 000 godzin pracy (ponad 5 lat ciągłego oglądania)" },
  ],
  specs: [
    { name: "Marka", value: "Heelly" },
    { name: "System operacyjny", value: "Android 11.0" },
    { name: "Rozdzielczość natywna", value: "1280x720p (wsparcie dekodowania 4K)" },
    { name: "Jasność", value: "250 ANSI lumenów" },
    { name: "Kontrast", value: "1500:1" },
    { name: "Łączność", value: "WiFi 2.4/5 GHz, Bluetooth 5.0" },
    { name: "Złącza", value: "HDMI, USB, mini Jack (audio), AV" },
    { name: "Głośnik", value: "Wbudowany 3W" },
    { name: "Wielkość projekcji", value: "40-130 cali" },
  ],
  closing: "Zestaw przeznaczony do użytku domowego, na wyjazdy i spotkania biznesowe.",
  setContents: ["Projektor Heelly", "Pilot sterujący", "Kabel zasilający", "Kabel HDMI", "2x Baterie AAA", "Polska instrukcja obsługi"],
  keywords: [
    "mini projektor",
    "rzutnik android",
    "smart tv",
    "kino domowe",
    "rzutnik 4k",
    "projektor wifi",
    "projektor bluetooth",
    "projektor heelly",
    "miracast airplay",
    "projektor android 11",
    "rzutnik multimedialny",
    "projektor przenośny",
    "projektor led",
    "rzutnik do bajek",
    "projektor obrotowy",
  ],
  competitorKeywords: ["samsung freestyle zamiennik"],
  imagePlan: {
    productDescription:
      "A compact white cylindrical mini projector on a rotating U-shaped stand, round black lens on the front, small control buttons on top.",
    series: [
      {
        theme: "Salon wieczorem",
        shots: [
          { kind: "hero", scene: "on a light oak coffee table in a cozy modern living room at dusk, warm lamp light, sofa softly blurred behind" },
          { kind: "in_use", scene: "projecting a large bright mountain landscape onto a white living room wall, a person's hand holding the remote in the foreground" },
          { kind: "context", scene: "on a sideboard next to plants and books, projecting abstract colorful shapes on the wall" },
          { kind: "detail", scene: "close-up of the lens and rotating stand on a wooden surface, shallow depth of field, soft bokeh lights" },
          { kind: "scale", scene: "wide shot of the living room with the projector on the table and a 100-inch image on the wall" },
        ],
      },
      {
        theme: "Sypialnia i ogród",
        shots: [
          { kind: "hero", scene: "on a bedside table in a calm Scandinavian bedroom, soft morning light" },
          { kind: "in_use", scene: "tilted upwards on the bedside table, projecting a starry night sky onto the bedroom ceiling" },
          { kind: "context", scene: "on a garden table on a terrace in the evening, projecting onto a white outdoor screen, string lights" },
          { kind: "detail", scene: "close-up of the top buttons and the 180-degree stand hinge, neutral background" },
          { kind: "scale", scene: "the projector held in one hand to show its compact size, bright neutral room background" },
        ],
      },
    ],
  },
  warnings: [],
};
