const { compare: naturalCompare } = require("natural-orderby");
const RangeFinder = require("./range-finder");

module.exports = {
  activate() {
    // On the workspace, because Edit > Lines dispatches at whatever holds
    // focus. See `command` below for how the editor is resolved from there.
    this.commandsDisposable = lumine.commands.add("lumine-workspace", {
      "sort-lines:sort": {
        description: "Sort the selected lines, or the whole file, alphabetically.",
        didDispatch: command(sortLines),
      },
      "sort-lines:reverse-sort": {
        description: "Sort alphabetically, from Z to A.",
        didDispatch: command(sortLinesReversed),
      },
      "sort-lines:unique": {
        description: "Drop the duplicate lines, keeping the first of each.",
        didDispatch: command(uniqueLines),
      },
      "sort-lines:case-insensitive-sort": {
        description: "Sort alphabetically without regard to letter case.",
        didDispatch: command(sortLinesInsensitive),
      },
      "sort-lines:natural": {
        description: "Sort so that item2 comes before item10.",
        didDispatch: command(sortLinesNatural),
      },
      "sort-lines:by-length": {
        description: "Sort the lines from shortest to longest.",
        didDispatch: command(sortLinesByLength),
      },
      "sort-lines:shuffle": {
        description: "Put the lines in a random order.",
        didDispatch: command(shuffleLines),
      },
      "sort-lines:reverse": {
        description: "Put the lines in the opposite order, without sorting.",
        didDispatch: command(reverseLines),
      },
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
    const clicked = lumine.textEditors.getTextEditorForElement(event?.target, {
      includeMini: false,
    });
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
