const { compare: naturalCompare } = require("natural-orderby");
const RangeFinder = require("./range-finder");

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "sort-lines",
      tips: [
        "{% if keys['sort-lines:sort'] %}You can alphabetize selected text lines with {{ 'sort-lines:sort' | keystroke }}{% else %}You can alphabetize selected lines or the whole file with Sort Lines.{% endif %}",
      ],
    };
  },

  activate() {
    this.pending = new Map();
    this.commandsDisposable = lumine.commands.add(
      "lumine-text-editor:not([mini]):not([readonly])",
      {
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
        "sort-lines:lexical": {
          description: "Sort by exact Unicode code-unit order, including arbitrarily long lines.",
          didDispatch: command(sortLinesLexically),
        },
        "sort-lines:reverse": {
          description: "Put the lines in the opposite order, without sorting.",
          didDispatch: command(reverseLines),
        },
      },
    );
  },

  deactivate() {
    for (const controller of this.pending?.values() ?? []) controller.abort();
    this.pending?.clear();
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

function command(operation) {
  return (event) => {
    const editor = lumine.workspace.getTextEditorForElement(event?.target, {
      includeMini: false,
    });
    if (!editor) return;
    const report = (error) => {
      if (error.name === "AbortError" || error.code === "ERR_STALE_EDIT") return;
      lumine.notifications.addError("Unable to transform lines.", {
        detail: error.message,
        dismissable: true,
      });
    };
    try {
      const result = operation(editor);
      return typeof result?.then === "function" ? result.catch(report) : result;
    } catch (error) {
      report(error);
    }
  };
}

function transformTextLines(editor, transform, mode, compare) {
  const sortableRanges = RangeFinder.rangesFor(editor).sort(compareRangesBottomToTop);

  const buffer = editor.getBuffer();
  if (
    sortableRanges.some(
      (range) =>
        buffer.characterIndexForPosition(range.end) -
          buffer.characterIndexForPosition(range.start) >
          1024 * 1024 || range.end.row - range.start.row > 4096,
    )
  ) {
    return transformSources(editor, sortableRanges.toReversed(), mode, compare);
  }
  return editor.transact(() => {
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
  return transformTextLines(
    editor,
    (textLines) => textLines.sort(caseSensitiveCollator.compare),
    "sort",
    caseSensitiveCollator.compare,
  );
}

function sortLinesReversed(editor) {
  return transformTextLines(
    editor,
    (textLines) => textLines.sort((a, b) => caseSensitiveCollator.compare(b, a)),
    "reverse-sort",
    (a, b) => caseSensitiveCollator.compare(b, a),
  );
}

function uniqueLines(editor) {
  return transformTextLines(editor, (textLines) => [...new Set(textLines)], "unique");
}

function sortLinesInsensitive(editor) {
  return transformTextLines(
    editor,
    (textLines) => textLines.sort(caseInsensitiveCollator.compare),
    "insensitive",
    caseInsensitiveCollator.compare,
  );
}

function sortLinesNatural(editor) {
  return transformTextLines(
    editor,
    (textLines) => textLines.sort(compareNaturally),
    "natural",
    compareNaturally,
  );
}

function sortLinesByLength(editor) {
  return transformTextLines(
    editor,
    (textLines) => textLines.sort((a, b) => a.length - b.length),
    "length",
  );
}

function shuffleLines(editor) {
  return transformTextLines(editor, shuffle, "shuffle");
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function reverseLines(editor) {
  return transformTextLines(editor, (textLines) => textLines.reverse(), "reverse");
}

function sortLinesLexically(editor) {
  return transformTextLines(editor, (lines) => lines.sort(), "lexical");
}

async function transformSources(editor, ranges, mode, compare) {
  const owner = module.exports;
  owner.pending.get(editor)?.abort();
  const controller = new AbortController();
  owner.pending.set(editor, controller);
  const buffer = editor.getBuffer(),
    revision = buffer.getTextRevision();
  const selections = editor.getSelectedBufferRanges();
  const isCurrent = () =>
    !controller.signal.aborted &&
    owner.pending.get(editor) === controller &&
    !editor.isDestroyed() &&
    !editor.isReadOnly() &&
    buffer.getTextRevision() === revision &&
    editor.getSelectedBufferRanges().length === selections.length &&
    editor.getSelectedBufferRanges().every((range, index) => range.isEqual(selections[index]));
  const check = () => {
    if (!isCurrent())
      throw Object.assign(
        new Error("Line transformation cancelled because its document or selection changed"),
        { name: "AbortError" },
      );
  };
  try {
    const edits = [];
    for (const range of ranges) {
      const ending =
        buffer.getPreferredLineEnding() ||
        buffer.lineEndingForRow(range.start.row) ||
        buffer.lineEndingForRow(range.start.row - 1) ||
        "\n";
      const text = await require("./source-lines").transformLines(
        buffer.getTextSnapshotInRange(range),
        mode,
        compare,
        { check, ending },
      );
      edits.push({ range, text });
    }
    return await buffer.applyTextEdits(edits, {
      expectedRevision: revision,
      signal: controller.signal,
      isCurrent,
    });
  } finally {
    if (owner.pending.get(editor) === controller) owner.pending.delete(editor);
  }
}
