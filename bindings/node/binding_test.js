const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => {
    try {
      return parser.setLanguage(require("."));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
