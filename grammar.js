/**
 * @file The System for Totality in the Edinbrugh Logical Framework
 * @author Asher Frost
 * @license MIT
 *
 * Tree-sitter grammar for **modern STELF** surface syntax, tracking the shapes
 * exercised by `test/corpus/full_test.txt` (generated from the STELF parser's
 * own `Cases.ml`). Section references (§N.M) below point at
 * `stelf/docs/grammar.md`.
 *
 * Two invariants worth keeping in mind while editing:
 *   1. Only `%`-prefixed words are keywords; everything else — `nat`, `+`, `<=`,
 *      `add/zero`, `_X` — is a single `ident` token (§2, §16.2). Do not split
 *      identifiers into alphanumeric/symbolic classes at the lexer.
 *   2. Commands are delimited by the *start* of the next `%`-word, not by any
 *      terminator (§3, §16.7). Everything non-`%` between commands is
 *      `outer_text` and is silently skipped, with optional prose injection.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// @ts-ignore
const parens = (/** @type {any[]} */ ...rule) => seq("(", ...rule, ")");

export default grammar({
  name: "stelf",

  // External tokens produced by `src/scanner.c`:
  //   begin_string / end_string    — `%[...%]` / `%[[...%]]` string literals
  //                                  with balanced n-bracket nesting (§16.9).
  //   prose_id                     — the language tag after `%prose`.
  //   prose_<lang> (11 variants)   — zero-width markers that close an
  //                                  `outer_text` region and hand its body to
  //                                  the named prose language for injection.
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

  // Whitespace and line comments are absorbed wherever whitespace is legal
  // (§16.9). Block-comment forms are retired in favour of `%[...%]` strings,
  // which live in the grammar proper (not as extras).
  extras: ($) => [/[ \t\n\r]+/, $.comment],

  // NOTE (§16.1): the spec calls for a zero-width lookahead
  // `(?=[\s(){}\[\]%]|$)` after each keyword body to prevent `%term` from
  // matching the prefix of `%terminates`. tree-sitter's longest-match already
  // disambiguates the fixed keyword set, so the lookahead is deliberately not
  // wired here; add it if a new keyword ever prefixes another.

  // @ts-ignore
  rules: {
    // ─── Top level (§3) ────────────────────────────────────────────────────
    source_file: ($) =>
      seq(
        optional($.outer_text),
        repeat(seq($.command, optional($.outer_text))),
      ),

    // `%[...%]` / `%[[...%]]` strings (§16.9). The scanner emits the balanced
    // open/close tokens; the raw body between them is any text.
    string_lit: ($) => seq($.begin_string, /.*?/, $.end_string),

    // Anything between commands that is not itself a `%`-word. Optionally
    // terminated by a prose marker so the trailing text can be injected as
    // that prose language.
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

    // ─── Lexical (§2) ──────────────────────────────────────────────────────

    // Line comment. Three opener flavours coexist in real STELF:
    //   * `% ` / `%\t`  — the spec's canonical line comment (§16.9).
    //   * `%;`          — Zed's configured `line_comments` opener (see
    //                     `languages/stelf/config.toml`).
    //   * `%%%`         — de-facto commentary marker in the wiki .lf corpus
    //                     (8000+ hits vs a handful of `%%X` escapes). Modelled
    //                     as a comment here since the `%%X` identifier-escape
    //                     mechanism is not otherwise wired up.
    // @ts-ignore
    comment: ($) =>
      token(seq(choice(seq("%", /[ \t]/), "%;", "%%%"), /[^\n]*/)),

    // A non-empty run of non-delimiter characters (§2). `prec(4)` biases the
    // lexer to prefer `ident` over any narrower token that could also match.
    // @ts-ignore
    ident: ($) => token(prec(4, /[^ \t\n(){}\[\]%]+/)),

    // Natural-number literal for `%query` bounds and `%prec` levels (§2).
    // @ts-ignore
    nat: ($) => token(/[0-9]+/),

    // Uppercase/lowercase distinction is enforced downstream on the first
    // character (§16.3), not by the lexer, so a single `ident` token suffices.

    // ─── Terms (§4) ────────────────────────────────────────────────────────

    // Atom: bare identifier or `%val`-qualified name.
    atom: ($) => choice($.ident, $.qualified),
    qualified: ($) =>
      choice(
        seq(token("%val"), choice($.ident, seq("(", repeat1($.ident), ")"))),
        seq(token("%("), repeat1($.ident), token(")")),
      ),

    // "Small" expression, legal as an argument or inside parens (§4).
    _expr1: ($) => choice($.atom, parens($.expr)),

    // Binders (§4). `impl` uses `{{...}}` and only lists names; type
    // annotations live elsewhere.
    lam: ($) => seq("[", field("decl", $.decl), "]", field("expr", $.expr)),
    pi: ($) => seq("{", field("decl", $.decl), "}", field("expr", $.expr)),
    impl: ($) => seq("{{", repeat1($.ident), "}}", field("expr", $.expr)),
    // Trailing binder in application position (§16.6): `f x y [w] w`.
    _expr_trail: ($) => choice($.lam, $.impl, $.pi),

    // Application is juxtaposition, with an optional trailing binder (§4).
    app: ($) =>
      seq(
        field("head", $._expr1),
        repeat(field("args", $._expr1)),
        optional(field("trail", $._expr_trail)),
      ),

    // Ascription: `%the T e` (§4).
    ascription: ($) =>
      seq(token("%the"), field("type", $._expr1), field("expr", $.expr)),

    // Arrow chains (§16.5). The leading `%if/%do/%fn/%pi` keyword tags the
    // chain's mode; the arrows themselves separate domain/codomain hops.
    arrow_chain: ($) =>
      seq(
        choice(token("%if"), token("%do"), token("%fn"), token("%pi")),
        field("domain", $._expr1),
        repeat1(seq(token("%->"), field("codomain", $._expr1))),
      ),
    backarrow_chain: ($) =>
      seq(
        choice(token("%if"), token("%do"), token("%pi"), token("%fn")),
        field("codomain", $._expr1),
        repeat1(seq(token("%<-"), field("domain", $._expr1))),
      ),

    // Full expression at the top of `expr` (§4).
    expr: ($) => choice($.ascription, $.arrow_chain, $.backarrow_chain, $.app),

    // ─── Declarations / binders (§5) ───────────────────────────────────────
    decl: ($) =>
      seq(
        field("args", choice($.arg, seq("(", $.arg, ")"))),
        optional(field("expr", $.expr)),
      ),
    arg: ($) => choice("_", $.ident),
    // Same `decl`, wrapped in each of the bracket flavours used by commands.
    pdecl: ($) => seq("(", $.decl, ")"),
    sdecl: ($) => seq("[", $.decl, "]"),
    bdecl: ($) => seq("{", $.decl, "}"),

    // ─── Modes (§6) ────────────────────────────────────────────────────────
    // @ts-ignore
    mode: ($) =>
      choice(
        token("%in"),
        token("%plus"),
        token("%minus"),
        token("%out"),
        token("%out1"),
        token("%star"),
      ),
    // Braced-full form up front, then the head expression, then trailing
    // spine-form modes (§6).
    mode_dec: ($) =>
      seq(
        repeat(seq("{", field("mode", $.mode), field("decl", $.decl), "}")),
        field("expr", $.expr),
        repeat(field("mode", $.mode)),
      ),

    // ─── Orders for %total / %terminates (§8) ──────────────────────────────
    id_list: ($) => prec(1, choice($.ident, seq("(", repeat1($.ident), ")"))),
    order: ($) =>
      choice(
        $.id_list,
        seq("[", repeat1($.order), "]"),
        seq("{", repeat1($.order), "}"),
      ),
    order_list: ($) => choice($.order, seq("(", repeat1($.order), ")")),

    // ─── Commands (§3, §13) ────────────────────────────────────────────────
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

    // End-of-input marker `%.`.
    stop: ($) => token("%."),

    // ─── Signatures ────────────────────────────────────────────────────────
    sort_cmd: ($) =>
      seq(
        token("%sort"),
        field("name", choice($.ident, seq("(", repeat1($.ident), ")"))),
        field("arguements", repeat($.bdecl)),
      ),
    term_cmd: ($) => seq(token("%term"), field("decl", $.decl)),

    // ─── Mode / termination / coverage ─────────────────────────────────────
    mode_cmd: ($) => seq(token("%mode"), field("mode_dec", $.mode_dec)),
    worlds_cmd: ($) =>
      seq(token("%worlds"), "(", repeat($.ident), ")", field("expr", $.expr)),
    total_cmd: ($) =>
      seq(
        token("%total"),
        field("order_list", $.order_list),
        field("exprs", parens(repeat($._expr1))),
      ),
    terminates_cmd: ($) =>
      seq(
        token("%terminates"),
        field("order_list", $.order_list),
        field("exprs", repeat($._expr1)),
      ),
    reduces_cmd: ($) =>
      seq(
        token("%reduces"),
        // The relation is lexically an identifier (§16.11); named as its own
        // token here so highlighting can capture the operator via a field.
        // Two-char forms come first so `<=` is not lexed as `<` then `=`.
        field(
          "rel",
          choice(token("<="), token(">="), token("<"), token(">"), token("=")),
        ),
        field("exprs", repeat1($._expr1)),
      ),

    // ─── Queries and defines (§11) ─────────────────────────────────────────
    // `%query` bounds are `_` (unbounded) or a `nat`.
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
    inline_cmd: ($) =>
      seq(token("%inline"), field("ident", $.ident), field("expr", $.expr)),
    unique_cmd: ($) => seq(token("%unique"), field("expr", $.expr)),

    // ─── Precedence, blocks, unions ────────────────────────────────────────
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
    union_cmd: ($) =>
      seq(token("%union"), field("ident", $.ident), "(", repeat1($.ident), ")"),

    // ─── REPL (§13) ────────────────────────────────────────────────────────
    // Grouped so the parser handles them as a single command alternative.
    repl_cmd: ($) =>
      choice(
        token("%quit"),
        seq(token("%help"), optional(field("about", $.ident))),
        seq(token("%get"), field("flag", $.ident)),
        seq(token("%set"), field("flag", $.ident), field("value", $.ident)),
        token("%version"),
      ),

    // ─── Names, symbols, freeze/thaw/deterministic ─────────────────────────
    name_cmd: ($) => seq(token("%name"), field("name", $.ident)),
    symbol_cmd: ($) =>
      seq(token("%symbol"), field("name", $.ident), field("value", $.ident)),
    freeze_cmd: ($) => seq(token("%freeze"), field("id_list", $.id_list)),
    thaw_cmd: ($) => seq(token("%thaw"), field("id_list", $.id_list)),
    deterministic_cmd: ($) =>
      seq(token("%deterministic"), field("id_list", $.id_list)),

    // ─── Module surface (%use / %open / %scope / %{...%} blocks) ───────────
    use_cmd: ($) =>
      seq(
        token("%use"),
        field("lhs", $.ident),
        field("rhs", $.ident),
        "(",
        repeat(field("ident", $.ident)),
        ")",
      ),
    seq_cmd: ($) => seq(token("%{"), repeat($.command), token("%}")),
    scope_cmd: ($) => seq(token("%scope"), field("name", $.ident), $.command),
    open_cmd: ($) =>
      seq(token("%open"), field("name", $.ident), field("id_list", $.id_list)),
    eval_cmd: ($) =>
      seq(token("%eval"), "%{", repeat(field("command", $.command)), "%}"),
    covers_cmd: ($) => seq(token("%covers"), $.mode_dec),

    // `%prose <lang>` opens a prose region; the language tag is emitted by
    // the scanner as `prose_id` (see externals block above).
    prose_header: ($) => seq("%prose", $.prose_id),
  },
});
