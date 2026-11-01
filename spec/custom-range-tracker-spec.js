describe("Sort Lines custom range tracking", () => {
  let editor;
  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("sort-lines");
    editor = await lumine.workspace.open();
  });
  afterEach(() => editor.destroy());

  it("publishes separate large selections through intermediate text with one undo", async () => {
    const original = "b\na\n".repeat(2050) + "middle\n" + "d\nc\n".repeat(2050);
    const expected = "a\nb\n".repeat(2050) + "middle\n" + "c\nd\n".repeat(2050);
    editor.setText(original);
    editor.setSelectedBufferRanges([
      [
        [0, 0],
        [4100, 0],
      ],
      [
        [4101, 0],
        [8201, 0],
      ],
    ]);
    const buffer = editor.getBuffer();
    const seen = [];
    const layer = buffer.addMarkerLayer({
      trackRanges(entries) {
        seen.push([buffer.lineForRow(0), buffer.lineForRow(4101)]);
        return entries.map(({ id }) => ({ id, range: buffer.getRange() }));
      },
    });
    const marker = layer.markRange(buffer.getRange(), { invalidate: "never" });
    const errors = spyOn(lumine.notifications, "addError");
    buffer.clearUndoStack();
    await lumine.commands.dispatch(editor.getElement(), "sort-lines:reverse");
    expect(editor.getText()).toBe(expected);
    expect(seen).toEqual([
      ["a", "d"],
      ["a", "c"],
    ]);
    expect(marker.getRange()).toEqual(buffer.getRange());
    expect(errors).not.toHaveBeenCalled();
    editor.undo();
    expect(editor.getText()).toBe(original);
    expect(buffer.undo()).toBe(false);
    editor.redo();
    expect(editor.getText()).toBe(expected);
  });
});
