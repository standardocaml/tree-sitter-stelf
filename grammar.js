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

  extras: $ => [/[ \t\n\r]+/, $.comment],

  rules: {
    source_file: $ => repeat(choice($.command, $.outer_text)),

    outer_text: $ => token(/([^%]|\%\%\%)+/),

    comment: $ => token(choice(
      seq('%', /[ \t]/, /[^\n]*/)
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



    sort_cmd: $ => seq(token('%sort'), choice($.ident, seq('(', repeat1($.ident), ')')), repeat($.bdecl)),
    term_cmd: $ => seq(token('%term'), $._decl),
    mode_cmd: $ => seq(token('%mode'), $.mode_dec),
    worlds_cmd: $ => seq(token('%worlds'), '(', repeat($.ident), ')', $.expr),
    total_cmd: $ => seq(token('%total'), $.order_list, repeat($.expr1)),
    terminates_cmd: $ => seq(token('%terminates'), $.order_list, repeat($.expr1)),
    reduces_cmd: $ => seq(token('%reduces'), choice(seq('<', '='), seq('>', '='), '<', '>', '='), repeat1($.expr1)),
    query_cmd: $ => seq(token('%query'), choice('_', $.nat), choice('_', $.nat), choice('_', $.nat), $.expr),
    qtab_cmd: $ => seq(token('%querytabled'), choice('_', $.nat), choice('_', $.nat), choice('_', $.nat), $.expr),
    adhoc_query: $ => seq(token('%?'), $.expr),
    define_cmd: $ => seq(token('%define'), choice($.ident, '_'), $.expr1, $.expr),
    decl_cmd: $ => seq(token('%decl'), $.expr),
    inline_cmd: $ => seq(token('%inline'), $.ident, $.expr),
    unique_cmd: $ => seq(token('%unique'), $.expr),
    prec_cmd: $ => seq(token('%prec'), choice(token('%left'), token('%right'), token('%prefix'), token('%postfix'), token('%middle'), token('%none')), $.nat, $.id_list),
    block_cmd: $ => seq(token('%block'), $.ident, repeat(choice($.bdecl, $.sdecl))),
    union_cmd: $ => seq(token('%union'), $.ident, '(', repeat1($.ident), ')'),
    repl_cmd: $ => choice(seq(token('%quit')), seq(token('%help'), optional($.ident)), seq(token('%get'), $.ident), seq(token('%set'), $.ident, $.ident), seq(token('%version'))),
    name_cmd: $ => seq(token('%name'), $.ident),
    symbol_cmd: $ => seq(token('%symbol'), $.ident, $.ident),
    freeze_cmd: $ => seq(token('%freeze'), $.id_list),
    thaw_cmd: $ => seq(token('%thaw'), $.id_list),
    deterministic_cmd: $ => seq(token('%deterministic'), $.id_list),
    use_cmd: $ => seq(token('%use'), $.ident, $.ident, '(', repeat($.ident), ')'),
    open_cmd: $ => seq(token('%open'), $.ident, $.id_list),
    eval_cmd: $ => seq(token('%eval'), '%{', repeat($.command), '%}'),
    covers_cmd: $ => seq(token('%covers'), $.mode_dec),
    // spread in term rules
    ...term
  },
  conflicts: $ => [[$.id_list]]
});
