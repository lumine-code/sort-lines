const { Range } = require("atom");

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

    return selectionRanges.map((selectionRange) => this.sortableRangeFrom(selectionRange));
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
