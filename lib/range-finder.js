const { Range } = require("lumine");

module.exports = class RangeFinder {
  static rangesFor(editor) {
    return new RangeFinder(editor).ranges();
  }

  constructor(editor) {
    this.editor = editor;
  }

  ranges() {
    const selectionRanges = this.selectionRanges();
    if (selectionRanges.length === 0) {
      return [this.sortableRangeFrom(this.sortableRangeForEntireBuffer())];
    }

    const ranges = selectionRanges
      .map((selectionRange) => this.sortableRangeFrom(selectionRange))
      .sort((a, b) => a.start.row - b.start.row || a.end.row - b.end.row);
    const merged = [];
    for (const range of ranges) {
      const previous = merged.at(-1);
      // Disjoint partial selections can expand onto the same buffer row.
      // Processing it twice can reuse an end column that the first edit moved.
      if (previous && range.start.row <= previous.end.row) {
        merged[merged.length - 1] = previous.union(range);
      } else {
        merged.push(range);
      }
    }
    return merged;
  }

  selectionRanges() {
    return this.editor.getSelectedBufferRanges().filter((range) => !range.isEmpty());
  }

  sortableRangeForEntireBuffer() {
    return this.editor.getBuffer().getRange();
  }

  sortableRangeFrom(selectionRange) {
    const startRow = selectionRange.start.row;
    const endRow = endRowForSelectionRange(selectionRange);
    const endColumn = this.editor.lineTextForBufferRow(endRow).length;

    return new Range([startRow, 0], [endRow, endColumn]);
  }
};

function endRowForSelectionRange(selectionRange) {
  const { row, column } = selectionRange.end;

  return column === 0 ? Math.max(0, row - 1) : row;
}
