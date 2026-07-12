#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"
#include <string.h>

enum TokenType {
  BEGIN_STRING,
  END_STRING,
  PROSE_ID,
  MARKDOWN0,
  LATEX0,
  TYPST0,
  HTML0,
  RST0,
  RTF0,
  JAVADOC0,
  JSDOC0,
  DOXYGEN0,
  ORG0,
  ASCIIDOC0,
 };

struct state {
  int len;
  int currentProse;
};

const static bool consume_whitespace(struct state* st, TSLexer *lexer) {
  bool found_whitespace = false;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
    found_whitespace = true;
  }
  return found_whitespace;
}
void *tree_sitter_stelf_external_scanner_create() {

  struct state *st = ts_malloc(sizeof(struct state));
  st->len = -1;
  st->currentProse = MARKDOWN0;
  return st;
}

void tree_sitter_stelf_external_scanner_destroy(void *payload) {
  struct state *st = payload;

  ts_free(st);
}

unsigned tree_sitter_stelf_external_scanner_serialize(void *payload,
                                                      char *buffer) {
  struct state *st = payload;
  memcpy(&buffer[0], &st->len, sizeof(int));
  memcpy(&buffer[sizeof(int)], &st->currentProse, sizeof(int));
  return 2 * sizeof(int);
}

void tree_sitter_stelf_external_scanner_deserialize(void *payload,
                                                    const char *buffer,
                                                    unsigned length) {
  struct state *st = payload;
  st->len = -1;
  st->currentProse = MARKDOWN0;
  if (length >= 2 * sizeof(int)) {
    memcpy(&st->len, &buffer[0], sizeof(int));
    memcpy(&st->currentProse, &buffer[sizeof(int)], sizeof(int));
  }
}
#define MAX_PROSE_NAME 255
const static bool str_equal(char* s0, const char* s1) {
  for (int i = 0; i < MAX_PROSE_NAME; i++) {
    if (s0[i] != s1[i]) {
      return false;
    } else if (s0[i] == '\0' && s1[i] == '\0') {
      return true;
    } else if (s0[i] == '\0' && s1[i] != '\0') {
      return false;
    } else if (s0[i] != '\0' && s1[i] == '\0') {
      return false;
    }
  }
  return true;
}
const static bool parse_prose_name(void* payload, TSLexer *lexer, const bool *valid_symbols) {
  char name[MAX_PROSE_NAME] = {0};
  struct state *st = payload;
  // The space between `%prose` and the language name is not skipped for us
  // before this scanner runs, so skip it ourselves before reading the name.
  consume_whitespace(st, lexer);
  int i = 0;
  while (i < MAX_PROSE_NAME - 1 && lexer->lookahead != ' ' && lexer->lookahead != '\n' && lexer->lookahead != '\r' && lexer->lookahead != '\t' && lexer->lookahead != '\0' && lexer->lookahead != '%') {
    name[i++] = lexer->lookahead;
    lexer->advance(lexer, false);
  }
  if (i == 0) {
    return false;
  }
  if (str_equal(name, "markdown")) {
    st->currentProse = MARKDOWN0;
  } else if (str_equal(name, "latex")) {
    st->currentProse = LATEX0;
  } else if (str_equal(name, "typst")) {
    st->currentProse = TYPST0;
  } else if (str_equal(name, "html")) {
    st->currentProse = HTML0;
  } else if (str_equal(name, "rst")) {
    st->currentProse = RST0;
  } else if (str_equal(name, "rtf")) {
    st->currentProse = RTF0;
  } else if (str_equal(name, "javadoc")) {
    st->currentProse = JAVADOC0;
  } else if (str_equal(name, "jsdoc")) {
    st->currentProse = JSDOC0;
  } else if (str_equal(name, "doxygen")) {
    st->currentProse = DOXYGEN0;
  } else if (str_equal(name, "org")) {
    st->currentProse = ORG0;
  } else if (str_equal(name, "asciidoc")) {
    st->currentProse = ASCIIDOC0;
  } else {
    return false;
  }
  lexer->result_symbol = PROSE_ID;
  return true;
}

bool tree_sitter_stelf_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  struct state *st = payload;

  // Zero-width prose-language marker at the end of an `outer_text` run —
  // must run *before* the BEGIN_STRING peek, otherwise a `%`-word that is a
  // command boundary (not `%[`) would be advanced past and re-emitted as a
  // stale token from a later branch. The marker only makes sense right at a
  // `%` boundary or EOF; anywhere else it would close outer_text early.
  if (valid_symbols[st->currentProse] &&
      (lexer->lookahead == '%' || lexer->eof(lexer))) {
    lexer->mark_end(lexer);
    lexer->result_symbol = st->currentProse;
    return true;
  }

  if (valid_symbols[BEGIN_STRING] && lexer->lookahead == '%') {
    // Freeze the token end at the pre-`%` position before peeking ahead. If
    // this turns out not to be a real `%[…]` string start we return false so
    // tree-sitter rolls back to this frozen position and the built-in lexer
    // gets to see the `%` at position 0 (as a command keyword etc.).
    lexer->mark_end(lexer);
    int string_size = 0;           // Number of `[` in string
    lexer->advance(lexer, false);
    if (lexer->lookahead == '[') { // Where second char must be `[`
      while (lexer->lookahead == '[') { // If the next char is `[`
        lexer->advance(lexer, false);   // Consume and lengthen string size
        string_size++;
      }
      lexer->mark_end(lexer);
      st->len = string_size;

      lexer->result_symbol = BEGIN_STRING;
      return true;
    }
    // Not a real string start — must return false explicitly so no later
    // branch (with a fresh mark_end) accidentally consumes the peeked `%`.
    return false;
  }

  if (valid_symbols[END_STRING] && st->len >= 0) {
    int string_size = st->len;
    bool done = false;
    while (!done) {
      if (lexer->lookahead == '%') { // If possible command in string

        int current_right = 0;        // How many `]` have we seen in a row?
        lexer->advance(lexer, false); // Consume the '%'
        while (lexer->lookahead == ']' &&
               current_right <
                   string_size) { // While we see `]`, and we haven't seen
                                  // enoguh `]`, then continue
          lexer->advance(lexer, false);
          lexer->mark_end(lexer);
          ++current_right;
        }
        if (current_right >=
            string_size) { // If we have seen enough, then we are done
          done = true;
        } else {
          current_right = 0; // Strictly not neccasarry
        }
      } else if (lexer->eof(lexer)) {
        return false;
      } else {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
      }
    }
    lexer->result_symbol = END_STRING;
    st->len = -1;
    return true;
  }

  if (valid_symbols[PROSE_ID]) {
    return parse_prose_name(payload, lexer, valid_symbols);
  }

  // NOTE: the zero-width `currentProse` marker is handled at the *top* of
  // this function, before the BEGIN_STRING peek. See that block for the
  // guard conditions and rationale.
  return false;
}
