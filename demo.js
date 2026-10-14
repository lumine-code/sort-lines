// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: [],
  viewport: { width: 960, height: 400 },
  async before() {},
  async prepare(context) {
    const { state, open } = context;
    state.editor = await open("chapters.txt");
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Naturally sort numbered chapter names, then remove duplicate lines.",
      timeout: 60000,
      async run() {},
      ready() {
        return Boolean(
          document.querySelector("lumine-workspace")?.getBoundingClientRect().height > 0 &&
          document.body.innerText.trim().length > 0,
        );
      },
    },
    {
      id: "scene-2",
      file: "demo-2.png",
      caption: "Naturally sort numbered chapter names, then remove duplicate lines.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          state.editor.selectAll();
        }
        {
          lumine.commands.dispatch(lumine.views.getView(state.editor), "sort-lines:natural");
          if (!state.editor.getText().startsWith("chapter1.md\nchapter2.md"))
            throw new Error("Natural sort failed");
        }
        {
          lumine.commands.dispatch(lumine.views.getView(state.editor), "sort-lines:unique");
          if (state.editor.getText().split("chapter2.md").length !== 2)
            throw new Error("Deduplication failed");
        }
      },
      ready() {
        return Boolean(
          document.querySelector("lumine-workspace")?.getBoundingClientRect().height > 0 &&
          document.body.innerText.trim().length > 0,
        );
      },
    },
  ],
  async cleanup() {},
};
