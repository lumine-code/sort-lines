const { compare: naturalCompare } = require("natural-orderby");
const RangeFinder = require("./range-finder");

module.exports = {
  activate() {
    // On the workspace, because Edit > Lines dispatches at whatever holds
    // focus. See `command` below for how the editor is resolved from there.
    this.commandsDisposable = lumine.commands.add("lumine-workspace", {
      "sort-lines:sort": command(sortLines),
      "sort-lines:reverse-sort": command(sortLinesReversed),
      "sort-lines:unique": command(uniqueLines),
      "sort-lines:case-insensitive-sort": command(sortLinesInsensitive),
      "sort-lines:natural": command(sortLinesNatural),
      "sort-lines:by-length": command(sortLinesByLength),
      "sort-lines:shuffle": command(shuffleLines),
      "sort-lines:reverse": command(reverseLines),
    });
  },

  deactivate() {
    this.commandsDisposable?.dispose();
    this.commandsDisposable = null;
  },
};

const caseSensitiveCollator = new Intl.Collator("en", {
  numeric: false,
  sensitivity: "variant",
});
const caseInsensitiveCollator = new Intl.Collator("en", {
  numeric: false,
  sensitivity: "base",
});
const compareNaturally = naturalCompare({ locale: "en" });

// currentTarget is the workspace element for a workspace registration, so the
// editor comes from the dispatch target — the editor a keystroke or a
// right-click came from — falling back to the active one for the application
// menu and the command palette, which dispatch at whatever holds focus.
function command(operation) {
  return (event) => {
    const clicked = event?.target?.closest?.("lumine-text-editor:not([mini])")?.getModel?.();
    const editor = clicked ?? lumine.workspace.getActiveTextEditor();
    if (editor) operation(editor);
  };
}

function transformTextLines(editor, transform) {
  const sortableRanges = RangeFinder.rangesFor(editor).sort(compareRangesBottomToTop);

  editor.transact(() => {
    for (const range of sortableRanges) {
      const textLines = editor.getTextInBufferRange(range).split(/\r?\n/);
      editor.setTextInBufferRange(range, transform(textLines).join("\n"));
    }
  });
}

function compareRangesBottomToTop(rangeA, rangeB) {
  return (
    rangeB.start.row - rangeA.start.row ||
    rangeB.start.column - rangeA.start.column ||
    rangeB.end.row - rangeA.end.row ||
    rangeB.end.column - rangeA.end.column
  );
}

function sortLines(editor) {
  transformTextLines(editor, (textLines) => textLines.sort(caseSensitiveCollator.compare));
}

function sortLinesReversed(editor) {
  transformTextLines(editor, (textLines) =>
    textLines.sort((lineA, lineB) => caseSensitiveCollator.compare(lineB, lineA)),
  );
}

function uniqueLines(editor) {
  transformTextLines(editor, (textLines) => [...new Set(textLines)]);
}

function sortLinesInsensitive(editor) {
  transformTextLines(editor, (textLines) => textLines.sort(caseInsensitiveCollator.compare));
}

function sortLinesNatural(editor) {
  transformTextLines(editor, (textLines) => textLines.sort(compareNaturally));
}

function sortLinesByLength(editor) {
  transformTextLines(editor, (textLines) =>
    textLines.sort((lineA, lineB) => lineA.length - lineB.length),
  );
}

function shuffleLines(editor) {
  transformTextLines(editor, shuffle);
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function reverseLines(editor) {
  transformTextLines(editor, (textLines) => textLines.reverse());
}
