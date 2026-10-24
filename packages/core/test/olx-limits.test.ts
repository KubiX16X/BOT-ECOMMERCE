import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  describeOlxLimit,
  findOlxCategory,
  findOlxLimit,
  getOlxLimitTable,
  getUserOlxLimits,
  searchOlxCategories,
  setOlxLimit,
  UNLIMITED_SERIES,
} from "../src/olx/limits";

beforeEach(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "revion-olx-"));
});

describe("limity OLX", () => {
  it("ma tabelę OLX dla kont prywatnych", () => {
    const table = getOlxLimitTable();
    expect(Object.keys(table).length).toBeGreaterThan(300);
    expect(table["Dom i Ogród > Ogród > Grill"]).toEqual({ limit: 2, dni: 60 });
    expect(table["Dla Dzieci > Zabawki"]).toEqual({ limit: null, dni: 30 });
    expect(table["Sport i Hobby > Rowery > Części rowerowe"]?.limit).toBe(4);
  });

  it("znajduje kategorię po pełnej ścieżce i po jednoznacznej końcówce", () => {
    expect(findOlxCategory("dom i ogród / wyposażenie wnętrz / koce")?.category).toBe("Dom i Ogród > Wyposażenie wnętrz > Koce");
    expect(findOlxCategory("Koce")?.limit.limit).toBe(2);
    expect(findOlxCategory("Akcesoria")).toBeUndefined();
    expect(searchOlxCategories("akcesoria").length).toBeGreaterThan(3);
  });

  it("zamienia limit na liczbę serii", () => {
    expect(findOlxLimit("Zabawki")).toBe(UNLIMITED_SERIES);
    expect(findOlxLimit("Akcesoria dla zwierząt")).toBe(10);
    expect(findOlxLimit("Psy rasowe")).toBe(0);
    expect(describeOlxLimit({ limit: 2, dni: 60 })).toBe("2 darmowe / 60 dni");
  });

  it("własny limit nadpisuje tabelę i trafia na krótką listę", () => {
    setOlxLimit("Dom i Ogród / Wyposażenie wnętrz / Koce", 3);
    expect(findOlxLimit("Koce")).toBe(3);
    expect(getUserOlxLimits()).toEqual({ "Dom i Ogród / Wyposażenie wnętrz / Koce": 3 });
  });
});
