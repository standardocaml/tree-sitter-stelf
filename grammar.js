/**
 * @file The System for Totality in the Edinbrugh Logical Framework
 * @author Asher Frost
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check


import term from "./lang/term.js";
export default grammar({
  name: "stelf",

  extras: $ => [ /[ \t\n\r]+/, $.comment ],

  rules: {
    source_file: $ => repeat(choice($.command, $.outer_text)),

    outer_text: $ => token(/[^%]+/),

    comment: $ => token(choice(
      seq('%{', /[^]*?%}/),
      seq('%%', /[^\n]*/),
      seq('%', /[^\n]/, repeat(/[^\n]/))
    )),

    command: $ => choice(
      $.stop,
      $.sort_cmd,
      $.term_cmd,
      $.mode_cmd,
      $.worlds_cmd,
      $.total_cmd,
      $.terminates_cmd,
      $.reduces_cmd,
      $.query_cmd,
      $.qtab_cmd,
      $.adhoc_query,
      $.define_cmd,
      $.decl_cmd,
      $.inline_cmd,
      $.unique_cmd,
      $.prec_cmd,
      $.block_cmd,
      $.union_cmd,
      $.repl_cmd,
      $.name_cmd,
      $.symbol_cmd,
      $.freeze_cmd,
      $.thaw_cmd,
      $.deterministic_cmd,
      $.use_cmd,
      $.open_cmd,
      $.eval_cmd,
      $.covers_cmd
    ),

    stop: $ => token(seq('%', '.')),

    sort_cmd: $ => seq(token(seq('%', 'sort', /(?=[\s(){}\[\]%]|$)/)), $.id_list, repeat($.bdecl)),
    term_cmd: $ => seq(token(seq('%', 'term', /(?=[\s(){}\[\]%]|$)/)), $._decl),
    mode_cmd: $ => seq(token(seq('%', 'mode', /(?=[\s(){}\[\]%]|$)/)), $.mode_dec),
    worlds_cmd: $ => seq(token(seq('%', 'worlds', /(?=[\s(){}\[\]%]|$)/)), '(', repeat($.ident), ')', $.expr),
    total_cmd: $ => seq(token(seq('%', 'total', /(?=[\s(){}\[\]%]|$)/)), $.order_list, repeat($.expr1)),
    terminates_cmd: $ => seq(token(seq('%', 'terminates', /(?=[\s(){}\[\]%]|$)/)), $.order_list, repeat($.expr1)),
    reduces_cmd: $ => seq(token(seq('%', 'reduces', /(?=[\s(){}\[\]%]|$)/)), choice(seq('<','='), seq('>','='), '<', '>', '='), repeat1($.expr1)),
    query_cmd: $ => seq(token(seq('%', 'query', /(?=[\s(){}\[\]%]|$)/)), choice('_', $.nat), choice('_', $.nat), choice('_', $.nat), $.expr),
    qtab_cmd: $ => seq(token(seq('%', 'querytabled', /(?=[\s(){}\[\]%]|$)/)), choice('_', $.nat), choice('_', $.nat), choice('_', $.nat), $.expr),
    adhoc_query: $ => seq(token('%?'), $.expr),
    define_cmd: $ => seq(token(seq('%', 'define', /(?=[\s(){}\[\]%]|$)/)), choice($.ident, '_'), $.expr1, $.expr),
    decl_cmd: $ => seq(token(seq('%', 'decl', /(?=[\s(){}\[\]%]|$)/)), $.expr),
    inline_cmd: $ => seq(token(seq('%', 'inline', /(?=[\s(){}\[\]%]|$)/)), $.ident, $.expr),
    unique_cmd: $ => seq(token(seq('%', 'unique', /(?=[\s(){}\[\]%]|$)/)), $.expr),
    prec_cmd: $ => seq(token(seq('%', 'prec', /(?=[\s(){}\[\]%]|$)/)), choice(token('%left'), token('%right'), token('%prefix'), token('%postfix'), token('%middle'), token('%none')), $.nat, $.id_list),
    block_cmd: $ => seq(token(seq('%', 'block', /(?=[\s(){}\[\]%]|$)/)), $.ident, repeat(choice($.bdecl, $.sdecl))),
    union_cmd: $ => seq(token(seq('%', 'union', /(?=[\s(){}\[\]%]|$)/)), $.ident, '(', repeat1($.ident), ')'),
    repl_cmd: $ => choice(seq(token(seq('%','quit', /(?=[\s(){}\[\]%]|$)/))), seq(token(seq('%','help', /(?=[\s(){}\[\]%]|$)/)), optional($.ident)), seq(token(seq('%','get', /(?=[\s(){}\[\]%]|$)/)), $.ident), seq(token(seq('%','set', /(?=[\s(){}\[\]%]|$)/)), $.ident, $.ident), seq(token(seq('%','version', /(?=[\s(){}\[\]%]|$)/)))),
    name_cmd: $ => seq(token(seq('%', 'name', /(?=[\s(){}\[\]%]|$)/)), $.ident),
    symbol_cmd: $ => seq(token(seq('%', 'symbol', /(?=[\s(){}\[\]%]|$)/)), $.ident, $.ident),
    freeze_cmd: $ => seq(token(seq('%', 'freeze', /(?=[\s(){}\[\]%]|$)/)), $.id_list),
    thaw_cmd: $ => seq(token(seq('%', 'thaw', /(?=[\s(){}\[\]%]|$)/)), $.id_list),
    deterministic_cmd: $ => seq(token(seq('%', 'deterministic', /(?=[\s(){}\[\]%]|$)/)), $.id_list),
    use_cmd: $ => seq(token(seq('%', 'use', /(?=[\s(){}\[\]%]|$)/)), $.ident, $.ident, '(', repeat($.ident), ')'),
    open_cmd: $ => seq(token(seq('%', 'open', /(?=[\s(){}\[\]%]|$)/)), $.ident, $.id_list),
    eval_cmd: $ => seq(token(seq('%','eval', /(?=[\s(){}\[\]%]|$)/)), '%{', repeat($.command), '%}'),
    covers_cmd: $ => seq(token(seq('%', 'covers', /(?=[\s(){}\[\]%]|$)/)), $.mode_dec),

    id_list: $ => choice($.ident, seq('(', repeat1($.ident), ')')),
    ident: $ => /[^ \t\n(){}\[\]%]+/,
    nat: $ => /[0-9]+/,

    // spread in term rules
    ...term
  }
});
