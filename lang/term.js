/**
 * @file The System for Totality in the Edinbrugh Logical Framework
 * @author Asher Frost
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default {
  // Tokens
  ident: $ => /[^ \t\n(){}\[\]%]+/,
  nat: $ => /[0-9]+/,

  // Ident categories are handled downstream; keep a single identifier token

  // Atoms and qualified forms
  atom: $ => choice($.ident, $.qualified),
  qualified: $ => seq(token(seq('%', 'val', /(?=[\s(){}\[\]%]|$)/)), choice($.ident, seq('(', repeat1($.ident), ')'))),

  // Small expression (no top-level binders)
  expr1: $ => choice($.atom, seq('(', $.expr, ')')),

  // Trailing binders used in application position
  expr_trail: $ => choice(
    seq('[', $.decl, ']', $.expr),
    seq('{', $.decl, '}', $.expr),
    seq('{{', repeat1($.ident), '}}', $.expr)
  ),

  // Application: one or more expr1, optionally followed by a trailing binder
  expr_app: $ => seq($.expr1, repeat($.expr1), optional($.expr_trail)),

  // Arrow / backarrow chains and ascription
  ascription: $ => seq(token(seq('%', 'the', /(?=[\s(){}\[\]%]|$)/)), $.expr1, $.expr),
  arrow_chain: $ => seq(token(seq('%', '->', /(?=[\s(){}\[\]%]|$)/)), $.expr1, repeat(seq(optional(token(seq('%', '->', /(?=[\s(){}\[\]%]|$)/)), $.expr1)))),
  backarrow_chain: $ => seq(token(seq('%', '<-', /(?=[\s(){}\[\]%]|$)/)), $.expr1, repeat(seq(optional(token(seq('%', '<-', /(?=[\s(){}\[\]%]|$)/)), $.expr1)))),

  // Top-level expression
  expr: $ => choice($.ascription, $.arrow_chain, $.backarrow_chain, $.expr_app),

  // Declaration (binder)
  decl: $ => choice(seq('(', repeat1($.arg), ')', optional($.expr)), seq($.arg, optional($.expr))),
  arg: $ => choice('_', $.ident),

  // Binders for other positions
  pdecl: $ => seq('(', $.decl, ')'),
  sdecl: $ => seq('[', $.decl, ']'),
  bdecl: $ => seq('{', $.decl, '}'),

  // Modes
  mode: $ => choice(token(seq('%','in', /(?=[\s(){}\[\]%]|$)/)), token(seq('%','out', /(?=[\s(){}\[\]%]|$)/)), token(seq('%','out1', /(?=[\s(){}\[\]%]|$)/)), token(seq('%','star', /(?=[\s(){}\[\]%]|$)/))),
  mode_dec: $ => seq(repeat(seq('{', $.mode, $.decl, '}')), $.expr, repeat($.mode)),

  // Orders
  id_list: $ => choice($.ident, seq('(', repeat1($.ident), ')')),
  order: $ => choice($.id_list, seq('[', repeat1($.order), ']'), seq('{', repeat1($.order), '}')),
  order_list: $ => choice($.order, seq('(', repeat1($.order), ')')),

  // Top-level helpers
  expr1_list: $ => repeat1($.expr1),

  // expose decl needed by top-level grammar
  _decl: $ => $.decl,
  _term_trailing: $ => $.expr_trail,
  _term_small: $ => $.expr1,

  // convenience re-exports
  expr_trailing: $ => $.expr_trail
};
