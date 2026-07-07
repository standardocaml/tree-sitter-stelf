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
 };

struct state {
  int len;
  int currentProse;
};

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
#define MAX_PROSE_NAME 128
bool str_equal(char* s0, const char* s1) {
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
bool parse_prose_name(void* payload, TSLexer *lexer, const bool *valid_symbols) {
  char name[MAX_PROSE_NAME] = {0};
  struct state *st = payload;
  // The space between `%prose` and the language name is not skipped for us
  // before this scanner runs, so skip it ourselves before reading the name.
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }
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
  } else {
    return false;
  }
  lexer->result_symbol = PROSE_ID;
  return true;
}
bool tree_sitter_stelf_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  struct state *st = payload;
  if (valid_symbols[BEGIN_STRING] && lexer->lookahead == '%') {
    // Fix the token boundary at the current (pre-`%`) position before
    // peeking ahead, so that if this doesn't turn out to be a real string
    // (`%[`), the peeked `%` is NOT consumed as part of whatever token we
    // return instead (e.g. the zero-width prose marker below) — it needs to
    // stay available for the next real token (a command, `%prose`, etc.).
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

    // Not a real string start. Fall through to see if the (still
    // zero-width, per mark_end above) prose marker applies here instead.
    if (valid_symbols[st->currentProse]) {
      lexer->result_symbol = st->currentProse;
      return true;
    }
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

  // The prose-language marker is zero-width and only makes sense right at the
  // end of an outer_text run: either we've hit the next `%` (a command,
  // string, or another %prose header) or the end of the file. Without this
  // guard the marker can be accepted mid-content, closing outer_text early.
  //
  // Two commands are commonly separated by nothing but plain whitespace
  // (e.g. `%sort t %.`), so peek past any run of it - without permanently
  // consuming it, via mark_end - to see whether a real boundary (`%`/EOF)
  // follows right after.
  if (valid_symbols[st->currentProse]) {
    lexer->mark_end(lexer);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      lexer->advance(lexer, true);
    }
    if (lexer->lookahead == '%' || lexer->eof(lexer)) {
      lexer->result_symbol = st->currentProse;
      return true;
    }
  }

  return false;
}
