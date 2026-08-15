const helpers = require("../lib/helpers");
const { TextEditor } = require("lumine");
const path = require("path");

describe("line ending selector", () => {
  let lineEndingTile;

  beforeEach(async () => {
    jasmine.useRealClock();

    await lumine.packages.activatePackage("status-bar");

    await lumine.packages.activatePackage("line-ending-selector");

    await timeoutPromise(1);

    const statusBar = lumine.workspace.getFooterPanels()[0].getItem();
    lineEndingTile = statusBar.getRightTiles()[0].getItem();
    expect(lineEndingTile.element.className).toMatch(/line-ending-tile/);
    expect(lineEndingTile.element.textContent).toBe("");
  });

  describe("Commands", () => {
    let editor, editorElement;

    beforeEach(async () => {
      const e = await lumine.workspace.open(path.join(__dirname, "fixtures", "mixed-endings.md"));
      editor = e;
      editorElement = lumine.views.getView(editor);
      jasmine.attachToDOM(editorElement);
    });

    describe('When "line-ending-selector:convert-to-LF" is run', () => {
      it("converts the file to LF line endings", () => {
        editorElement.focus();
        lumine.commands.dispatch(document.activeElement, "line-ending-selector:convert-to-LF");
        expect(editor.getText()).toBe("Hello\nGoodbye\nMixed\n");
      });
    });

    describe('When "line-ending-selector:convert-to-LF" is run', () => {
      it("converts the file to CRLF line endings", () => {
        editorElement.focus();
        lumine.commands.dispatch(document.activeElement, "line-ending-selector:convert-to-CRLF");
        expect(editor.getText()).toBe("Hello\r\nGoodbye\r\nMixed\r\n");
      });
    });

    describe('When "line-ending-selector:show" is run', () => {
      async function showSelector() {
        lumine.commands.dispatch(
          lumine.views.getView(lumine.workspace),
          "line-ending-selector:show",
        );
        await conditionPromise(() => lumine.workspace.getModalPanels().length > 0);
        const view = lumine.workspace.getModalPanels()[0].getItem();
        await conditionPromise(() => view.element.querySelector("li"));
        return view;
      }

      function rowNames(view) {
        return Array.from(view.element.querySelectorAll("li"), (li) => li.dataset.lineEnding);
      }

      it("offers Mixed, ticked and last, when the file uses both", async () => {
        const view = await showSelector();

        expect(rowNames(view)).toEqual(["LF", "CRLF", "Mixed"]);
        expect(view.element.querySelector("li.active").dataset.lineEnding).toBe("Mixed");
      });

      it("refuses to apply Mixed and says why, without closing", async () => {
        const view = await showSelector();
        const before = editor.getText();

        view.selectIndex(rowNames(view).indexOf("Mixed"));
        view.confirmSelection();

        expect(editor.getText()).toBe(before);
        expect(view.isVisible()).toBe(true);
        expect(view.props.status.message).toContain("Pick LF or CRLF");
      });

      it("offers only the two real endings when the file agrees with itself, ticking the one it uses", async () => {
        await lumine.workspace.open(path.join(__dirname, "fixtures", "unix-endings.md"));
        const view = await showSelector();

        expect(rowNames(view)).toEqual(["LF", "CRLF"]);
        expect(view.element.querySelector("li.active").dataset.lineEnding).toBe("LF");
      });

      it("applies a real ending and closes", async () => {
        const view = await showSelector();

        view.selectIndex(rowNames(view).indexOf("CRLF"));
        view.confirmSelection();

        expect(editor.getText()).toBe("Hello\r\nGoodbye\r\nMixed\r\n");
        expect(view.isVisible()).toBe(false);
      });
    });
  });

  describe("Status bar tile", () => {
    describe("when an empty file is opened", () => {
      it("uses the default line endings for the platform", async () => {
        await new Promise((done) => {
          spyOn(helpers, "getProcessPlatform").and.returnValue("win32");

          lumine.workspace.open("").then((editor) => {
            const subscription = lineEndingTile.onDidChange(() => {
              subscription.dispose();
              expect(lineEndingTile.element.textContent).toBe("CRLF");
              expect(editor.getBuffer().getPreferredLineEnding()).toBe("\r\n");
              expect(getTooltipText(lineEndingTile.element)).toBe(
                "File uses CRLF (Windows) line endings",
              );

              done();
            });
          });
        });

        await new Promise((done) => {
          helpers.getProcessPlatform.and.returnValue("darwin");

          lumine.workspace.open("").then((editor) => {
            const subscription = lineEndingTile.onDidChange(() => {
              subscription.dispose();
              expect(lineEndingTile.element.textContent).toBe("LF");
              expect(editor.getBuffer().getPreferredLineEnding()).toBe("\n");
              expect(getTooltipText(lineEndingTile.element)).toBe(
                "File uses LF (Unix) line endings",
              );

              done();
            });
          });
        });
      });

      describe('when the "defaultLineEnding" setting is set to "LF"', () => {
        beforeEach(() => {
          lumine.config.set("line-ending-selector.defaultLineEnding", "LF");
        });

        it("uses LF line endings, regardless of the platform", async () => {
          await new Promise((done) => {
            spyOn(helpers, "getProcessPlatform").and.returnValue("win32");

            lumine.workspace.open("").then((editor) => {
              lineEndingTile.onDidChange(() => {
                expect(lineEndingTile.element.textContent).toBe("LF");
                expect(editor.getBuffer().getPreferredLineEnding()).toBe("\n");
                done();
              });
            });
          });
        });
      });

      describe('when the "defaultLineEnding" setting is set to "CRLF"', () => {
        beforeEach(() => {
          lumine.config.set("line-ending-selector.defaultLineEnding", "CRLF");
        });

        it("uses CRLF line endings, regardless of the platform", async () => {
          await new Promise((done) => {
            lumine.workspace.open("").then((editor) => {
              lineEndingTile.onDidChange(() => {
                expect(lineEndingTile.element.textContent).toBe("CRLF");
                expect(editor.getBuffer().getPreferredLineEnding()).toBe("\r\n");
                done();
              });
            });
          });
        });
      });
    });

    describe("when a file is opened that contains only CRLF line endings", () => {
      it('displays "CRLF" as the line ending', async () => {
        await new Promise((done) => {
          lumine.workspace.open(path.join(__dirname, "fixtures", "windows-endings.md")).then(() => {
            lineEndingTile.onDidChange(() => {
              expect(lineEndingTile.element.textContent).toBe("CRLF");
              done();
            });
          });
        });
      });
    });

    describe("when a file is opened that contains only LF line endings", () => {
      it('displays "LF" as the line ending', async () => {
        await new Promise((done) => {
          lumine.workspace
            .open(path.join(__dirname, "fixtures", "unix-endings.md"))
            .then((editor) => {
              lineEndingTile.onDidChange(() => {
                expect(lineEndingTile.element.textContent).toBe("LF");
                expect(editor.getBuffer().getPreferredLineEnding()).toBe(null);
                done();
              });
            });
        });
      });
    });

    describe("when a file is opened that contains mixed line endings", () => {
      it('displays "Mixed" as the line ending', async () => {
        await new Promise((done) => {
          lumine.workspace.open(path.join(__dirname, "fixtures", "mixed-endings.md")).then(() => {
            lineEndingTile.onDidChange(() => {
              expect(lineEndingTile.element.textContent).toBe("Mixed");
              done();
            });
          });
        });
      });
    });

    describe("clicking the tile", () => {
      let lineEndingModal, lineEndingSelector;

      // The picker reads the buffer's line endings before it opens — that is
      // what decides the tick and whether there is a "Mixed" row — so the
      // panel arrives a turn after the click rather than during it.
      async function clickTile() {
        lineEndingTile.element.dispatchEvent(new MouseEvent("click", {}));
        await conditionPromise(() => lumine.workspace.getModalPanels().length > 0);
        lineEndingModal = lumine.workspace.getModalPanels()[0];
        lineEndingSelector = lineEndingModal.getItem();
        await conditionPromise(() => lineEndingSelector.element.querySelector("li"));
      }

      beforeEach(async () => {
        jasmine.attachToDOM(lumine.views.getView(lumine.workspace));

        await new Promise((done) =>
          lumine.workspace
            .open(path.join(__dirname, "fixtures", "unix-endings.md"))
            .then(() => lineEndingTile.onDidChange(done)),
        );
      });

      describe("when the text editor has focus", () => {
        it("opens the line ending selector modal for the text editor", async () => {
          lumine.workspace.getCenter().activate();
          const item = lumine.workspace.getActivePaneItem();
          expect(item.getFileName && item.getFileName()).toBe("unix-endings.md");

          await clickTile();

          expect(lineEndingModal.isVisible()).toBe(true);
          expect(lineEndingSelector.element.contains(document.activeElement)).toBe(true);
          let listItems = lineEndingSelector.element.querySelectorAll("li");
          expect(listItems[0].textContent).toBe("LF");
          expect(listItems[1].textContent).toBe("CRLF");
        });
      });

      describe("when the text editor does not have focus", () => {
        it("opens the line ending selector modal for the active text editor", async () => {
          lumine.workspace.getLeftDock().activate();
          const item = lumine.workspace.getActivePaneItem();
          expect(item instanceof TextEditor).toBe(false);

          await clickTile();

          expect(lineEndingModal.isVisible()).toBe(true);
          expect(lineEndingSelector.element.contains(document.activeElement)).toBe(true);
          let listItems = lineEndingSelector.element.querySelectorAll("li");
          expect(listItems[0].textContent).toBe("LF");
          expect(listItems[1].textContent).toBe("CRLF");
        });
      });

      describe("when selecting a different line ending for the file", () => {
        it("changes the line endings in the buffer", async () => {
          await clickTile();

          const lineEndingChangedPromise = new Promise((resolve) => {
            lineEndingTile.onDidChange(() => {
              expect(lineEndingTile.element.textContent).toBe("CRLF");
              const editor = lumine.workspace.getActiveTextEditor();
              expect(editor.getText()).toBe("Hello\r\nGoodbye\r\nUnix\r\n");
              expect(editor.getBuffer().getPreferredLineEnding()).toBe("\r\n");
              resolve();
            });
          });

          lineEndingSelector.refs.queryEditor.setText("CR");
          lineEndingSelector.confirmSelection();
          expect(lineEndingModal.isVisible()).toBe(false);

          await lineEndingChangedPromise;
        });
      });

      describe("when modal is exited", () => {
        it("leaves the tile selection as-is", async () => {
          await clickTile();

          lineEndingSelector.cancelSelection();
          expect(lineEndingTile.element.textContent).toBe("LF");
        });
      });
    });

    describe("closing the last text editor", () => {
      it("displays no line ending in the status bar", async () => {
        await lumine.workspace.open(path.join(__dirname, "fixtures", "unix-endings.md"));
        lumine.workspace.getActivePane().destroy();
        expect(lineEndingTile.element.textContent).toBe("");
      });
    });

    describe("when the buffer's line endings change", () => {
      let editor;

      beforeEach(async () => {
        await new Promise((done) => {
          lumine.workspace.open(path.join(__dirname, "fixtures", "unix-endings.md")).then((e) => {
            editor = e;
            lineEndingTile.onDidChange(done);
          });
        });
      });

      it("updates the line ending text in the tile", async () => {
        let tileText = lineEndingTile.element.textContent;
        let tileUpdateCount = 0;
        Object.defineProperty(lineEndingTile.element, "textContent", {
          get() {
            return tileText;
          },

          set(text) {
            tileUpdateCount++;
            tileText = text;
          },
        });

        expect(lineEndingTile.element.textContent).toBe("LF");
        expect(getTooltipText(lineEndingTile.element)).toBe("File uses LF (Unix) line endings");

        await new Promise((done) => {
          editor.setTextInBufferRange(
            [
              [0, 0],
              [0, 0],
            ],
            "... ",
          );
          editor.setTextInBufferRange(
            [
              [0, Infinity],
              [1, 0],
            ],
            "\r\n",
            {
              normalizeLineEndings: false,
            },
          );
          lineEndingTile.onDidChange(done);
        });

        expect(tileUpdateCount).toBe(1);
        expect(lineEndingTile.element.textContent).toBe("Mixed");
        expect(getTooltipText(lineEndingTile.element)).toBe("File uses mixed line endings");

        await new Promise((done) => {
          lumine.commands.dispatch(editor.getElement(), "line-ending-selector:convert-to-CRLF");
          lineEndingTile.onDidChange(done);
        });

        expect(tileUpdateCount).toBe(2);
        expect(lineEndingTile.element.textContent).toBe("CRLF");
        expect(getTooltipText(lineEndingTile.element)).toBe(
          "File uses CRLF (Windows) line endings",
        );

        await new Promise((done) => {
          lumine.commands.dispatch(editor.getElement(), "line-ending-selector:convert-to-LF");
          lineEndingTile.onDidChange(done);
        });

        expect(tileUpdateCount).toBe(3);
        expect(lineEndingTile.element.textContent).toBe("LF");

        editor.setTextInBufferRange(
          [
            [0, 0],
            [0, 0],
          ],
          "\n",
        );

        await timeoutPromise(100);

        expect(tileUpdateCount).toBe(3);
      });
    });
  });
});

function getTooltipText(element) {
  const [tooltip] = lumine.tooltips.findTooltips(element);
  return tooltip.getTitle();
}
