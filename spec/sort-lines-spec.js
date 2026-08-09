describe("sort-lines", () => {
  let editor;

  beforeEach(async () => {
    // The commands are registered on lumine-workspace, so an editor a dispatch is
    // aimed at has to be inside the workspace rather than an orphan element.
    jasmine.attachToDOM(lumine.workspace.getElement());
    editor = await lumine.workspace.open();
    const activation = lumine.packages.activatePackage("sort-lines");
    lumine.commands.dispatch(lumine.views.getView(editor), "sort-lines:sort");
    await activation;
  });

  function dispatch(commandName, targetEditor = editor) {
    lumine.commands.dispatch(lumine.views.getView(targetEditor), `sort-lines:${commandName}`);
  }

  function transform(commandName, text) {
    editor.setText(text);
    editor.setCursorBufferPosition([0, 0]);
    dispatch(commandName);
    return editor.getText();
  }

  describe("target ranges", () => {
    it("processes the entire buffer when no text is selected", () => {
      expect(transform("sort", "Hydrogen \nHelium   \nLithium    ")).toBe(
        "Helium   \nHydrogen \nLithium    ",
      );
    });

    it("preserves a trailing newline", () => {
      expect(transform("sort", "Hydrogen \nHelium   \nLithium  \n")).toBe(
        "Helium   \nHydrogen \nLithium  \n",
      );
    });

    it("leaves an empty buffer unchanged", () => {
      expect(transform("sort", "")).toBe("");
    });

    it("expands a whole-line selection without including the next line", () => {
      editor.setText("Hydrogen\nHelium\nLithium\nBeryllium\nBoron\n");
      editor.setSelectedBufferRange([
        [1, 0],
        [4, 0],
      ]);

      dispatch("sort");

      expect(editor.getText()).toBe("Hydrogen\nBeryllium\nHelium\nLithium\nBoron\n");
    });

    it("expands a partial selection to complete lines", () => {
      editor.setText("Hydrogen\nHelium\nLithium\nBeryllium\nBoron\n");
      editor.setSelectedBufferRange([
        [1, 3],
        [3, 2],
      ]);

      dispatch("sort");

      expect(editor.getText()).toBe("Hydrogen\nBeryllium\nHelium\nLithium\nBoron\n");
    });

    it("processes multiple selections independently", () => {
      editor.setText("Hydrogen\nHelium\nBeryllium\nCarbon\nFluorine\nAluminum\nGallium\n");
      editor.setSelectedBufferRange([
        [1, 0],
        [3, 0],
      ]);
      editor.addSelectionForBufferRange([
        [4, 0],
        [6, 0],
      ]);

      dispatch("sort");

      expect(editor.getText()).toBe(
        "Hydrogen\nBeryllium\nHelium\nCarbon\nAluminum\nFluorine\nGallium\n",
      );
    });

    it("processes shrinking selections from bottom to top", () => {
      editor.setText("a\na\nmiddle\nb\nb\nend");
      editor.setSelectedBufferRange([
        [0, 0],
        [2, 0],
      ]);
      editor.addSelectionForBufferRange([
        [3, 0],
        [5, 0],
      ]);

      dispatch("unique");

      expect(editor.getText()).toBe("a\nmiddle\nb\nend");
    });

    it("groups changes to multiple selections into one undo step", () => {
      const originalText = "a\na\nmiddle\nb\nb\nend";
      editor.setText(originalText);
      editor.setSelectedBufferRange([
        [0, 0],
        [2, 0],
      ]);
      editor.addSelectionForBufferRange([
        [3, 0],
        [5, 0],
      ]);

      dispatch("unique");
      editor.undo();

      expect(editor.getText()).toBe(originalText);
    });

    it("uses the editor receiving the command instead of the active editor", async () => {
      const otherEditor = await lumine.workspace.open();
      editor.setText("c\na\nb");
      otherEditor.setText("z\ny\nx");

      dispatch("sort", editor);

      expect(editor.getText()).toBe("a\nb\nc");
      expect(otherEditor.getText()).toBe("z\ny\nx");
    });
  });

  describe("alphabetic ordering", () => {
    it("sorts case-sensitively", () => {
      expect(transform("sort", "helium\nHelium\nhelium")).toBe("helium\nhelium\nHelium");
    });

    it("sorts case-insensitively while retaining the order of equal values", () => {
      expect(transform("case-insensitive-sort", "B\na\nA\nb")).toBe("a\nA\nB\nb");
    });

    it("sorts in descending order", () => {
      expect(transform("reverse-sort", "Hydrogen\nHelium\nLithium")).toBe(
        "Lithium\nHydrogen\nHelium",
      );
    });

    it("uses a deterministic locale", () => {
      expect(transform("sort", "uber\nvice_gr\nvice_serbia\nvice_spain\nvice\nvicechina")).toBe(
        "uber\nvice\nvice_gr\nvice_serbia\nvice_spain\nvicechina",
      );
    });
  });

  describe("natural ordering", () => {
    const examples = [
      {
        name: "leading numbers",
        input: ["4a", "1a", "2a", "12a", "3a", "0a"],
        expected: ["0a", "1a", "2a", "3a", "4a", "12a"],
      },
      {
        name: "trailing numbers",
        input: ["a4", "a0", "a12", "a1", "a2", "a3"],
        expected: ["a0", "a1", "a2", "a3", "a4", "a12"],
      },
      {
        name: "leading zeroes",
        input: ["a01", "a001", "a003", "a002", "a02"],
        expected: ["a001", "a01", "a002", "a02", "a003"],
      },
      {
        name: "floating-point numbers",
        input: ["10.0401", "10.022", "10.042", "10.021999"],
        expected: ["10.021999", "10.022", "10.0401", "10.042"],
      },
      {
        name: "scientific notation",
        input: ["1.528535048e5", "1.528535047e7", "1.528535049e3"],
        expected: ["1.528535049e3", "1.528535048e5", "1.528535047e7"],
      },
      {
        name: "IP addresses",
        input: ["192.168.0.100", "192.168.0.1", "192.168.1.1"],
        expected: ["192.168.0.1", "192.168.0.100", "192.168.1.1"],
      },
      {
        name: "filenames",
        input: ["car.mov", "01alpha.sgi", "001alpha.sgi", "my.string_41299.tif"],
        expected: ["001alpha.sgi", "01alpha.sgi", "car.mov", "my.string_41299.tif"],
      },
      {
        name: "dates",
        input: ["10/12/2008", "10/11/2008", "10/11/2007", "10/12/2007"],
        expected: ["10/11/2007", "10/12/2007", "10/11/2008", "10/12/2008"],
      },
      {
        name: "money",
        input: ["$10002.00", "$10001.02", "$10001.01"],
        expected: ["$10001.01", "$10001.02", "$10002.00"],
      },
    ];

    for (const { name, input, expected } of examples) {
      it(`sorts ${name}`, () => {
        expect(transform("natural", input.join("\n"))).toBe(expected.join("\n"));
      });
    }
  });

  describe("other transformations", () => {
    it("sorts by length", () => {
      expect(transform("by-length", "Hydrogen\nHelium\nLithium\nBeryllium\nBoron")).toBe(
        "Boron\nHelium\nLithium\nHydrogen\nBeryllium",
      );
    });

    it("shuffles with Fisher-Yates", () => {
      spyOn(Math, "random").and.returnValue(0);

      expect(transform("shuffle", "a\nb\nc\nd")).toBe("b\nc\nd\na");
    });

    it("reverses the current order", () => {
      expect(transform("reverse", "Hydrogen\nHelium\nLithium")).toBe("Lithium\nHelium\nHydrogen");
    });

    it("removes duplicates while retaining their first occurrence", () => {
      expect(transform("unique", "Hydrogen\nHydrogen\nHelium\nLithium\nHelium")).toBe(
        "Hydrogen\nHelium\nLithium",
      );
    });

    it("preserves CRLF line endings while removing duplicates", () => {
      expect(transform("unique", "Hydrogen\r\nHydrogen\r\nHelium\r\nLithium\r\n")).toBe(
        "Hydrogen\r\nHelium\r\nLithium\r\n",
      );
    });
  });

  it("removes its commands when deactivated", async () => {
    editor.setText("c\na\nb");
    await lumine.packages.deactivatePackage("sort-lines");

    dispatch("sort");

    expect(editor.getText()).toBe("c\na\nb");
  });
});
