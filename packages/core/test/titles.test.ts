import { describe, expect, it } from "vitest";
import { cleanTitle, formatSeriesTitles, formatTitle, titleCaseWord } from "../src/text/titles";
import { dashedPhone, deliveryText, parseDelivery, slugify } from "../src/text/format";

describe("titleCaseWord", () => {
  it("zaczyna każde słowo wielką literą, także polskie znaki", () => {
    expect(titleCaseWord("projektor")).toBe("Projektor");
    expect(titleCaseWord("łóżko")).toBe("Łóżko");
    expect(titleCaseWord("żelazko")).toBe("Żelazko");
  });

  it("zostawia skróty i znane marki", () => {
    expect(titleCaseWord("tv")).toBe("TV");
    expect(titleCaseWord("wifi")).toBe("WiFi");
    expect(titleCaseWord("hdmi")).toBe("HDMI");
    expect(titleCaseWord("iphone")).toBe("iPhone");
    expect(titleCaseWord("HP")).toBe("HP");
  });

  it("poprawia jednostki po liczbie", () => {
    expect(titleCaseWord("4k")).toBe("4K");
    expect(titleCaseWord("5000mah")).toBe("5000mAh");
    expect(titleCaseWord("2.4ghz")).toBe("2.4GHz");
    expect(titleCaseWord('130"')).toBe('130"');
  });

  it("zamienia CAPS na Title Case, ale nie skróty", () => {
    expect(titleCaseWord("PROJEKTOR")).toBe("Projektor");
    expect(titleCaseWord("DO")).toBe("Do");
    expect(titleCaseWord("JBL")).toBe("JBL");
  });

  it("obsługuje słowa z myślnikiem", () => {
    expect(titleCaseWord("biało-czarny")).toBe("Biało-Czarny");
    expect(titleCaseWord("usb-c")).toBe("USB-C");
  });
});

describe("formatTitle", () => {
  it("przerabia tytuł CAPSEM ze starego szablonu", () => {
    const t = formatTitle('MINI PROJEKTOR RZUTNIK ANDROID 11 SMART TV 4K WIFI KINO DOMOWE 130"', "olx");
    expect(t.title).toBe('Mini Projektor Rzutnik Android 11 Smart TV 4K WiFi Kino Domowe 130"');
    expect(t.length).toBe(67);
  });

  it("nigdy nie przekracza limitu i nie tnie słów", () => {
    const raw = "projektor rzutnik przenośny android smart tv wifi bluetooth kino domowe obrotowy led heelly";
    const olx = formatTitle(raw, "olx");
    expect(olx.length).toBeLessThanOrEqual(70);
    expect(raw.toLowerCase().startsWith(olx.title.toLowerCase())).toBe(true);
    expect(formatTitle(raw, "allegro").length).toBeLessThanOrEqual(75);
  });

  it("nie kończy tytułu wiszącym spójnikiem", () => {
    const t = formatTitle("Grill Gazowy Ogrodowy Trzy Palniki Pokrywa Termometr Stalowy Duży Do Ogrodu", "olx");
    expect(t.title.endsWith(" Do")).toBe(false);
  });

  it("usuwa emoji, wykrzykniki i powtórzenia", () => {
    expect(cleanTitle("HIT!!! Projektor 🔥 4K")).toBe("HIT Projektor 4K");
    expect(formatTitle("projektor mini projektor rzutnik", "olx").title).toBe("Projektor Mini Rzutnik");
  });
});

describe("formatSeriesTitles", () => {
  it("daje różne tytuły dla każdej serii", () => {
    const titles = formatSeriesTitles(["grill gazowy", "GRILL GAZOWY", "grill ogrodowy węglowy"], 2);
    expect(titles.map((t) => t.title)).toEqual(["Grill Gazowy", "Grill Ogrodowy Węglowy"]);
  });
});

describe("format helpers", () => {
  it("zapisuje telefon z myślnikami", () => {
    expect(dashedPhone("666079181")).toBe("6-6-6-0-7-9-1-8-1");
    expect(dashedPhone("+48 666 079 181")).toBe("6-6-6-0-7-9-1-8-1");
  });

  it("odmienia dni dostawy", () => {
    expect(deliveryText(1, 1)).toBe("1 dzień roboczy");
    expect(deliveryText(2, 4)).toBe("2–4 dni robocze");
    expect(deliveryText(3, 5)).toBe("3–5 dni roboczych");
  });

  it("parsuje zakres dostawy", () => {
    expect(parseDelivery("2-4")).toEqual({ min: 2, max: 4 });
    expect(parseDelivery(" 3 ")).toEqual({ min: 3, max: 3 });
    expect(parseDelivery("5-2")).toBeNull();
    expect(parseDelivery("abc")).toBeNull();
  });

  it("robi bezpieczne nazwy plików", () => {
    expect(slugify("Mini Projektor Łóżkowy 4K!")).toBe("mini-projektor-lozkowy-4k");
  });
});
