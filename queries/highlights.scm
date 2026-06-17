; ─── Comments ────────────────────────────────────────────────────────────────
(comment) @comment

; ─── Numbers ─────────────────────────────────────────────────────────────────
(nat) @number

; ─── Command keywords ────────────────────────────────────────────────────────
"%sort"          @keyword
"%term"          @keyword
"%define"        @keyword
"%def"           @keyword
"%inline"        @keyword
"%decl"          @keyword
"%query"         @keyword
"%querytabled"   @keyword
"%?"             @keyword
"%unique"        @keyword
"%mode"          @keyword
"%covers"        @keyword
"%total"         @keyword
"%terminates"    @keyword
"%reduces"       @keyword
"%worlds"        @keyword
"%block"         @keyword
"%union"         @keyword
"%eval"          @keyword
"%use"           @keyword.import
"%open"          @keyword.import
"%freeze"        @keyword
"%thaw"          @keyword
"%deterministic" @keyword
"%name"          @keyword
"%symbol"        @keyword
"%prec"          @keyword
"%quit"          @keyword.debug
"%help"          @keyword.debug
"%get"           @keyword.debug
"%set"           @keyword.debug
"%version"       @keyword.debug
(stop)           @keyword.return

; ─── Expression / in-term keywords ───────────────────────────────────────────
"%the" @keyword.operator
"%val" @keyword
"%("   @keyword

; ─── Operators ───────────────────────────────────────────────────────────────
"%if" @operator
"%do" @operator
"%pi" @operator
"%->" @operator
"%<-" @operator
(reduces_cmd rel: _ @operator)

; ─── Mode markers (%in %out %out1 %star) ─────────────────────────────────────
(mode) @keyword.modifier

; ─── Fixity markers inside %prec (%left %right %prefix %postfix %middle %none)
(prec_cmd assoc: _ @keyword.modifier)

; ─── Punctuation ─────────────────────────────────────────────────────────────
"["  @punctuation.bracket
"]"  @punctuation.bracket
"("  @punctuation.bracket
")"  @punctuation.bracket
"{"  @punctuation.bracket
"}"  @punctuation.bracket
"%{" @punctuation.bracket
"%}" @punctuation.bracket
"{{" @punctuation.bracket
"}}" @punctuation.bracket

; ─── Definition sites (field-based; more specific than bare ident) ───────────
(sort_cmd   name:  (ident) @type)
(term_cmd   decl:  (decl args: (arg (ident) @function)))
(define_cmd name:  (ident) @function)
(inline_cmd ident: (ident) @function)
(block_cmd  ident: (ident) @label)
(union_cmd  ident: (ident) @type)
(open_cmd   name:  (ident) @module)
(use_cmd    lhs:   (ident) @module)
(use_cmd    rhs:   (ident) @module)
(name_cmd   name:  (ident) @label)
(symbol_cmd name:  (ident) @function)
(symbol_cmd value: (ident) @operator)

; ─── Metavariables (identifiers starting with _ or A–Z) ─────────────────────
((ident) @variable.parameter
 (#match? @variable.parameter "^[_]")
 (#is-not? local))
 

(ident) @local.reference
; ─── Anonymous wildcard placeholder ──────────────────────────────────────────
"_" @variable.builtin

; ─── Default: all remaining identifiers ──────────────────────────────────────
((ident) @constructor (#is-not? local) (#match? @constructor "\\w+"))
((ident) @operator (#is-not? local) (#not-match? @operator "\\w+"))

; --- Declerations ---

(decl args: (arg (ident)+ @variable.parameter))
(impl ("{{" _ "}}") @variable)
