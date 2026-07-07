/**
 * @file The System for Totality in the Edinbrugh Logical Framework
 * @author Asher Frost
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// @ts-ignore
const keyword = (/** @type {string} */ kw) => token(seq("%", token.immediate(kw)));
const parens = (/** @type {any[]} */ ...rule) => seq("(", ...rule, ")");
// @ts-ignore
const braces = (/** @type {any[]} */ ...rule) => seq("{", ...rule, "}");
// @ts-ignore
const bracks = (/** @type {any[]} */ ...rule) => seq("[", ...rule, "]");

export default grammar({
  name: "stelf",

  // @ts-ignore
  externals: ($) => [
    $.begin_string,
    $.end_string,
    $.prose_id,
    $.prose_markdown,
    $.prose_latex,
    $.prose_typst,
    $.prose_html,
    $.prose_rst,
    $.prose_rtf,
    $.prose_javadoc,
    $.prose_jsdoc,
    $.prose_doxygen,
    $.prose_org,
    $.prose_asciidoc,
  ],
  extras: ($) => [/[ \t\n\r]+/, $.comment],
  // @ts-ignore
  rules: {
    source_file: ($) => seq($.outer_text, repeat(seq($.command, $.outer_text))),
    string_lit: ($) => seq($.begin_string, /.*?/, $.end_string),

    outer_text: ($) =>
      seq(
        prec(0, repeat(choice(token(/([^%]|(%%.))+/), $.string_lit))),
        choice(
          $.prose_markdown,
          $.prose_latex,
          $.prose_typst,
          $.prose_html,
          $.prose_rst,
          $.prose_rtf,
          $.prose_javadoc,
          $.prose_jsdoc,
          $.prose_doxygen,
          $.prose_org,
          $.prose_asciidoc,
        ),
      ),

    // @ts-ignore
    comment: ($) => token(choice(seq("%", /[ \t]/, /[^\n]*/))),
    // Tokens
    // @ts-ignore
    ident: ($) => token(prec(1, /[^ \t\n(){}\[\]%]+/)),
    // @ts-ignore
    nat: ($) => token(prec(1, /[0-9]+/)),

    // Ident categories are handled downstream; keep a single identifier token

    // Atoms and qualified forms

    atom: ($) => choice($.ident, $.qualified),
    qualified: ($) =>
      choice(
        seq(token("%val"), choice($.ident, seq("(", repeat1($.ident), ")"))),
        seq(token("%("), repeat1($.ident), token(")")),
      ),

    // Inner syntax

    // Small expression (no top-level binders)
    _expr1: ($) => choice($.atom, parens($.expr)),

    lam: ($) => seq("[", field("decl", $.decl), "]", field("expr", $.expr)),
    pi: ($) => seq("{", field("decl", $.decl), "}", field("expr", $.expr)),
    impl: ($) => seq("{{", repeat1($.ident), "}}", field("expr", $.expr)),
    // Trailing binders used in application position
    _expr_trail: ($) => choice($.lam, $.impl, $.pi),

    // Application: one or more _expr1, optionally followed by a trailing binder
    app: ($) =>
      seq(
        field("head", $._expr1),
        repeat(field("args", $._expr1)),
        optional(field("trail", $._expr_trail)),
      ),

    // Arrow / backarrow chains and ascription
    ascription: ($) => seq(token("%the"), field("type", $._expr1), field("expr", $.expr)),
    arrow_chain: ($) =>
      seq(
        choice(token("%if"), token("%do"), token("%pi")),
        field("domain", $._expr1),
        repeat1(seq(token("%->"), field("codomain", $._expr1))),
      ),
    backarrow_chain: ($) =>
      seq(
        choice(token("%if"), token("%do"), token("%pi")),
        field("codomain", $._expr1),
        repeat1(seq(token("%<-"), field("domain", $._expr1))),
      ),

    // Top-level expression
    expr: ($) => choice($.ascription, $.arrow_chain, $.backarrow_chain, $.app),

    // Declaration (binder)
    decl: ($) =>
      seq(field("args", choice($.arg, seq("(", $.arg, ")"))), optional(field("expr", $.expr))),

    arg: ($) => choice("_", $.ident),
    // Binders for other positions
    pdecl: ($) => seq("(", $.decl, ")"),
    sdecl: ($) => seq("[", $.decl, "]"),
    bdecl: ($) => seq("{", $.decl, "}"),

    // Modes
    // @ts-ignore
    mode: ($) => choice(token("%in"), token("%plus"), token("%minus"), token("%out"), token("%out1"), token("%star")),
    mode_dec: ($) =>
      seq(
        repeat(seq("{", field("mode", $.mode), field("decl", $.decl), "}")),
        field("expr", $.expr),
        repeat(field("mode", $.mode)),
      ),

    // Orders
    id_list: ($) => choice($.ident, seq("(", repeat1($.ident), ")")),
    order: ($) =>
      choice($.id_list, seq("[", repeat1($.order), "]"), seq("{", repeat1($.order), "}")),
    order_list: ($) => choice($.order, seq("(", repeat1($.order), ")")),

    // Top-level helpers
    _expr1_list: ($) => repeat1($._expr1),

    // expose decl needed by top-level grammar
    _decl: ($) => $.decl,
    _term_trailing: ($) => $._expr_trail,
    _term_small: ($) => $._expr1,

    // convenience re-exports
    _expr_trailing: ($) => $._expr_trail,
    // @ts-ignore
    _any: ($) => /.+?/,
    _value: ($) => choice($._expr1, $.string_lit),
    command: ($) =>
      choice(
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
        $.covers_cmd,
        $.seq_cmd,
        $.scope_cmd,
        $.prose_header,
      ),

    stop: ($) => token("%."),

    sort_cmd: ($) =>
      seq(
        token("%sort"),
        field("name", choice($.ident, seq("(", repeat1($.ident), ")"))),
        field("arguements", repeat($.bdecl)),
      ),
    term_cmd: ($) => seq(token("%term"), field("decl", $._decl)),
    mode_cmd: ($) => seq(token("%mode"), field("mode_dec", $.mode_dec)),
    worlds_cmd: ($) => seq(token("%worlds"), "(", repeat($.ident), ")", field("expr", $.expr)),
    total_cmd: ($) =>
      seq(token("%total"), field("order_list", $.order_list), field("exprs", repeat($._expr1))),
    terminates_cmd: ($) =>
      seq(
        token("%terminates"),
        field("order_list", $.order_list),
        field("exprs", repeat($._expr1)),
      ),
    reduces_cmd: ($) =>
      seq(
        token("%reduces"),
        field("rel", choice(token("<="), token(">="), token("<"), token(">"), token("="))),
        field("exprs", repeat1($._expr1)),
      ),
    query_cmd: ($) =>
      seq(
        token("%query"),
        field("min", choice("_", $.nat)),
        field("max", choice("_", $.nat)),
        field("show", choice("_", $.nat)),
        field("expr", $.expr),
      ),
    qtab_cmd: ($) =>
      seq(
        token("%querytabled"),
        field("min", choice("_", $.nat)),
        field("max", choice("_", $.nat)),
        field("show", choice("_", $.nat)),
        field("expr", $.expr),
      ),
    adhoc_query: ($) => seq(token("%?"), field("expr", $.expr)),
    define_cmd: ($) =>
      seq(
        choice(token("%define"), token("%def")),
        field("name", choice($.ident, "_")),
        field("sort", $._expr1),
        field("expr", $.expr),
      ),
    decl_cmd: ($) => seq(token("%decl"), field("expr", $.expr)),
    inline_cmd: ($) => seq(token("%inline"), field("ident", $.ident), field("expr", $.expr)),
    unique_cmd: ($) => seq(token("%unique"), field("expr", $.expr)),
    prec_cmd: ($) =>
      seq(
        token("%prec"),
        field(
          "assoc",
          choice(
            token("%left"),
            token("%right"),
            token("%prefix"),
            token("%postfix"),
            token("%middle"),
            token("%none"),
          ),
        ),
        field("prec", $.nat),
        field("id_list", $.id_list),
      ),
    block_cmd: ($) =>
      seq(
        token("%block"),
        field("ident", $.ident),
        field("items", repeat(choice($.bdecl, $.sdecl))),
      ),
    union_cmd: ($) => seq(token("%union"), field("ident", $.ident), "(", repeat1($.ident), ")"),
    repl_cmd: ($) =>
      choice(
        token("%quit"),
        seq(token("%help"), optional(field("about", $.ident))),
        seq(token("%get"), field("flag", $.ident)),
        seq(token("%set"), field("flag", $.ident), field("value", $.ident)),
        token("%version"),
      ),
    name_cmd: ($) => seq(token("%name"), field("name", $.ident)),
    symbol_cmd: ($) => seq(token("%symbol"), field("name", $.ident), field("value", $.ident)),
    freeze_cmd: ($) => seq(token("%freeze"), field("id_list", $.id_list)),
    thaw_cmd: ($) => seq(token("%thaw"), field("id_list", $.id_list)),
    deterministic_cmd: ($) => seq(token("%deterministic"), field("id_list", $.id_list)),
    use_cmd: ($) =>
      seq(
        token("%use"),
        field("lhs", $.ident),
        field("rhs", $.ident),
        "(",
        repeat(field("ident", $.ident)),
        ")",
      ),
    seq_cmd: ($) =>
      seq(
        token("%{"),
        optional($.outer_text),
        repeat(seq($.command, optional($.outer_text))),
        token("%}"),
      ),
    scope_cmd: ($) => seq(token("%scope"), field("name", $.ident), $.command),
    open_cmd: ($) => seq(token("%open"), field("name", $.ident), field("id_list", $.id_list)),
    eval_cmd: ($) => seq(token("%eval"), "%{", repeat(field("command", $.command)), "%}"),
    covers_cmd: ($) => seq(token("%covers"), $.mode_dec),
    // spread in term rules
    literal: $ => choice(
      $.ident,
    ),
    prose_header: $ => seq("%prose", $.prose_id)
  },
  conflicts: ($) => [[$.id_list]],
});
