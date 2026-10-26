const { TextBuffer } = require("lumine");
const { compare: naturalCompare } = require("natural-orderby");
const { transformLines } = require("../lib/source-lines");

describe("source-backed line transforms", () => {
  let buffer;
  afterEach(() => buffer?.destroy());
  it("preserves every existing comparator and stable duplicate order", async () => {
    const lines = ["z", "A", "a", "item10", "item2", "é", "", "z", "😀", "a"];
    buffer = new TextBuffer(lines.join("\r\n"));
    const source = buffer.getTextSnapshot();
    const sensitive = new Intl.Collator("en", { numeric: false, sensitivity: "variant" }).compare;
    const insensitive = new Intl.Collator("en", { numeric: false, sensitivity: "base" }).compare;
    for (const [mode, compare, expected] of [
      ["sort", sensitive, lines.toSorted(sensitive)],
      ["insensitive", insensitive, lines.toSorted(insensitive)],
      [
        "natural",
        naturalCompare({ locale: "en" }),
        lines.toSorted(naturalCompare({ locale: "en" })),
      ],
      ["length", null, lines.toSorted((a, b) => a.length - b.length)],
      ["lexical", null, lines.toSorted()],
      ["reverse", null, lines.toReversed()],
      ["unique", null, [...new Set(lines)]],
    ])
      expect((await transformLines(source, mode, compare)).toString()).toBe(expected.join("\n"));
  });

  it("handles lines beyond the string limit for source-native modes and reports locale limits", async () => {
    buffer = new TextBuffer("x".repeat(32768));
    let giant = buffer.getTextSnapshot();
    while (giant.length <= require("node:buffer").constants.MAX_STRING_LENGTH)
      giant = giant.replace(giant.length, giant.length, giant);
    const source = giant.replace(0, 0, "z\n");
    const sorted = await transformLines(source, "lexical");
    expect(sorted.length).toBe(source.length);
    expect(sorted.slice(-2)).toBe("\nz");
    const reversed = await transformLines(source, "reverse");
    expect(reversed.slice(-2)).toBe("\nz");
    const shortest = await transformLines(source, "length");
    expect(shortest.slice(0, 2)).toBe("z\n");
    await expectAsync(
      transformLines(source, "sort", new Intl.Collator("en").compare),
    ).toBeRejectedWith(jasmine.objectContaining({ code: "ERR_LINE_COLLATION_LIMIT" }));
  });

  it("cancels preparation before any source is published", async () => {
    buffer = new TextBuffer("b\na\n".repeat(50000));
    let checks = 0;
    await expectAsync(
      transformLines(buffer.getTextSnapshot(), "lexical", null, {
        check() {
          if (++checks > 1) throw Object.assign(new Error("cancel"), { name: "AbortError" });
        },
      }),
    ).toBeRejectedWith(jasmine.objectContaining({ name: "AbortError" }));
    expect(buffer.lineForRow(0)).toBe("b");
  });
});
