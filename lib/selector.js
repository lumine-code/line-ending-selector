const { TextEditor } = require("lumine");

// What a file whose lines do not agree is. It is a state, not a setting: there
// is no line ending to convert to called "Mixed", so the row is shown only
// when it is the answer, carries the tick, and refuses to be picked.
const MIXED_ITEM = Object.freeze({ name: "Mixed", value: null });

class Selector {
  lineEndingListView;

  // Make a selector object (should be called once)
  constructor(selectorItems) {
    this.baseItems = selectorItems;
    this.currentName = null;

    this.lineEndingListView = lumine.workspace.buildSelectList({
      className: "line-ending-selector",
      crumb: "Line Endings",
      itemsClassList: ["mark-active"],
      items: selectorItems,
      getItemId: (lineEnding) => lineEnding.name,
      search: { getFilterText: (lineEnding) => lineEnding.name },
      renderItem: (lineEnding, { highlight }) => {
        return {
          className: [
            lineEnding.name === this.currentName && "active",
            isReadOnly(lineEnding) && "text-subtle",
          ].filter(Boolean),
          primary: highlight(lineEnding.name),
          didRender: (element) => {
            element.dataset.lineEnding = lineEnding.name;
          },
        };
      },
      commands: {
        "line-ending-selector:use-selected-line-ending": {
          description: "Convert the current file to the selected line ending.",
          didDispatch: (event) => this.useLineEnding(event.detail.item),
        },
        "line-ending-selector:explain-mixed-line-endings": {
          description: "Explain why mixed line endings cannot be selected.",
          didDispatch: () =>
            this.lineEndingListView.setStatus({
              type: "info",
              message: "Mixed is what the file is. Pick LF or CRLF to convert it.",
              duration: 4000,
            }),
        },
      },
      actions: [
        {
          command: "line-ending-selector:use-selected-line-ending",
          context: "item",
          when: ({ item }) => !isReadOnly(item),
          primary: true,
          disposition: "close",
        },
        {
          command: "line-ending-selector:explain-mixed-line-endings",
          context: "item",
          when: ({ item }) => isReadOnly(item),
          primary: true,
          disposition: "stay",
        },
      ],
    });
  }

  useLineEnding(lineEnding) {
    // The file editor: for a notebook this is the backing .ipynb editor.
    const editor = lumine.workspace.getActiveFileTextEditor();
    if (editor instanceof TextEditor) {
      // Required here rather than at the top: main.js requires this module,
      // so a load-time require would see a half-built exports object.
      require("./main").setLineEnding(editor, lineEnding.value);
    }
  }

  // Show a selector object. `lineEndings` is the set the file actually uses,
  // which decides the tick and whether the "Mixed" row exists at all.
  async show(lineEndings = new Set()) {
    this.currentName = currentName(lineEndings);
    await this.lineEndingListView.update({
      // Last: LF and CRLF are what Enter should land on, and "Mixed" is a
      // footnote about the file rather than a third choice.
      items:
        this.currentName === MIXED_ITEM.name ? [...this.baseItems, MIXED_ITEM] : this.baseItems,
      status: null,
    });
    this.lineEndingListView.show();
  }

  // Dispose selector
  dispose() {
    this.lineEndingListView.destroy();
  }
}

// A row with no line ending to apply cannot be chosen.
function isReadOnly(lineEnding) {
  return lineEnding.value == null;
}

// The same three answers the status bar tile gives, from the same input.
function currentName(lineEndings) {
  if (lineEndings.size > 1) return MIXED_ITEM.name;
  if (lineEndings.has("\n")) return "LF";
  if (lineEndings.has("\r\n")) return "CRLF";
  return null;
}

module.exports = { Selector };
