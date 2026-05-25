/**
 * @file The System for Totality in the Edinbrugh Logical Framework
 * @author Asher Frost
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "stelf",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
