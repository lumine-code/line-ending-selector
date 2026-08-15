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

      // Ticks whichever row the file already is, the way the grammar and
      // encoding pickers mark theirs.
      itemsClassList: ["mark-active"],

      // an array containing the objects you want to show in the select list
      items: selectorItems,

      // called whenever an item needs to be displayed.
      elementForItem: (lineEnding, { highlight }) => {
        const element = document.createElement("li");
        if (lineEnding.name === this.currentName) {
          element.classList.add("active");
        }
        if (isReadOnly(lineEnding)) {
          element.classList.add("text-subtle");
        }
        element.appendChild(highlight(lineEnding.name));
        element.dataset.lineEnding = lineEnding.name;
        return element;
      },

      // called to retrieve a string property on each item and that will be used to filter them.
      filterKeyForItem: (lineEnding) => {
        return lineEnding.name;
      },

      // called when the user clicks or presses Enter on an item. // use `=>` for `this`
      didConfirmSelection: (lineEnding) => {
        if (isReadOnly(lineEnding)) {
          // The press did nothing, and a row that silently ignores Enter reads
          // as a broken one. Say why, and stay open on the two rows that work.
          this.lineEndingListView.update({
            status: {
              type: "info",
              message: "Mixed is what the file is. Pick LF or CRLF to convert it.",
              duration: 4000,
            },
          });
          return;
        }
        // The file editor: for a notebook this is the backing .ipynb editor.
        const editor = lumine.workspace.getActiveFileTextEditor();
        if (editor instanceof TextEditor) {
          // Required here rather than at the top: main.js requires this module,
          // so a load-time require would see a half-built exports object.
          require("./main").setLineEnding(editor, lineEnding.value);
        }
        this.hide();
      },

      // called when the user presses Esc or the list loses focus. // use `=>` for `this`
      didCancelSelection: () => {
        this.hide();
      },
    });
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

  // Hide a selector
  hide() {
    this.lineEndingListView.hide();
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
