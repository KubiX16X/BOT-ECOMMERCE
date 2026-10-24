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
        room:
          "A cozy modern living room in the evening: warm white walls, light oak floor, a grey fabric sofa with a mustard throw, a round light oak coffee table in front of it, a low white sideboard with books and a plant along the opposite wall, a floor lamp with warm light, large window with sheer curtains and city lights outside.",
        shots: [
          { kind: "hero", scene: "the projector on the round coffee table, three-quarter front view of the lens, sofa softly blurred behind, eye-level camera, nothing projected" },
          { kind: "in_use", scene: "camera behind and to the side of the projector on the coffee table: the lens points away from the camera at the empty wall, which shows a large bright mountain landscape; a hand holding the remote in the foreground" },
          { kind: "spot", scene: "the projector standing on the white sideboard next to books and the plant, side view, medium distance, nothing projected" },
          { kind: "detail", scene: "macro close-up of the lens and the top buttons, the product fills most of the frame, the room softly blurred behind" },
          { kind: "wide", scene: "wide shot of the whole living room taken from behind the sofa: the projector on the coffee table is seen from behind, its lens pointing at the wall that shows a large bright landscape image" },
          { kind: "angle", scene: "top-down view from above at about 60 degrees onto the coffee table with the projector tilted upwards on its stand" },
        ],
      },
      {
        theme: "Sypialnia rano",
        room:
          "A calm Scandinavian bedroom in the morning: light beige walls, pale wooden floor, a bed with white linen and a knitted grey blanket, a round wooden bedside table with a small ceramic lamp, a big window with linen curtains letting in soft morning sunlight, a plant in the corner.",
        shots: [
          { kind: "hero", scene: "the projector on the bedside table, three-quarter view, bed softly blurred behind, eye-level camera" },
          { kind: "in_use", scene: "the projector on the bedside table tilted upwards on its stand, projecting a starry night sky onto the ceiling, seen from the side" },
          { kind: "spot", scene: "the projector standing at the foot of the bed on the blanket, seen from the side, projecting onto the wall" },
          { kind: "detail", scene: "close-up of the top buttons and the stand hinge, soft morning light" },
          { kind: "wide", scene: "wide shot of the whole bedroom from the doorway with the projector on the bedside table" },
          { kind: "angle", scene: "the projector held in one hand above the bed to show its compact size, bedroom in the background" },
        ],
      },
    ],
  },
  warnings: [],
};
