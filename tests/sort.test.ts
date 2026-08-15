import { describe, it, expect } from "vitest";
import { naturalSort } from "../src/sort";

describe("naturalSort", () => {
  it("sorts numeric filenames correctly", () => {
    const items = [
      { originalFileName: "IMG0010.jpg" },
      { originalFileName: "IMG0001.jpg" },
      { originalFileName: "IMG0002.jpg" },
    ];
    const sorted = [...items].sort((a, b) => naturalSort(a.originalFileName, b.originalFileName));
    expect(sorted.map((i) => i.originalFileName)).toEqual(["IMG0001.jpg", "IMG0002.jpg", "IMG0010.jpg"]);
  });

  it("sorts mixed numeric filenames", () => {
    const items = [
      { originalFileName: "photo_2.jpg" },
      { originalFileName: "photo_10.jpg" },
      { originalFileName: "photo_1.jpg" },
    ];
    const sorted = [...items].sort((a, b) => naturalSort(a.originalFileName, b.originalFileName));
    expect(sorted.map((i) => i.originalFileName)).toEqual(["photo_1.jpg", "photo_2.jpg", "photo_10.jpg"]);
  });

  it("sorts filenames without numbers", () => {
    const items = [
      { originalFileName: "cat.jpg" },
      { originalFileName: "apple.jpg" },
      { originalFileName: "banana.jpg" },
    ];
    const sorted = [...items].sort((a, b) => naturalSort(a.originalFileName, b.originalFileName));
    expect(sorted.map((i) => i.originalFileName)).toEqual(["apple.jpg", "banana.jpg", "cat.jpg"]);
  });

  it("returns 0 for identical strings", () => {
    expect(naturalSort("IMG0001.jpg", "IMG0001.jpg")).toBe(0);
  });

  it("returns negative when first is lexicographically less", () => {
    expect(naturalSort("apple.jpg", "banana.jpg")).toBeLessThan(0);
  });

  it("handles multiple number sequences", () => {
    const items = [
      { originalFileName: "DSC_2_10.jpg" },
      { originalFileName: "DSC_2_2.jpg" },
      { originalFileName: "DSC_1_10.jpg" },
    ];
    const sorted = [...items].sort((a, b) => naturalSort(a.originalFileName, b.originalFileName));
    expect(sorted.map((i) => i.originalFileName)).toEqual(["DSC_1_10.jpg", "DSC_2_2.jpg", "DSC_2_10.jpg"]);
  });
});
