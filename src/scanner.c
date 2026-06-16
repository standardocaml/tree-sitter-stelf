#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"
#include <string.h>

enum TokenType {
  GIVEN,
  LEFT_ARROW,
  RIGHT_ARROW,
  SOME_BLOCK,
  BEGIN_GROUP,
  END_GROUP,
  BEGIN_STRING,
  END_STRING,
};

struct state {
  bool left_arrow_aliased;
  bool right_arrow_aliased;
  bool some_block_aliased;
  char group_stack_size;
  char string_stack_size;
  char *group_stack;
  char *string_stack;
};

#define MAX_STACK_SIZE 255

void *tree_sitter_stelf_external_scanner_create() {
  struct state *st = ts_malloc(sizeof(struct state));
  st->left_arrow_aliased = false;
  st->right_arrow_aliased = false;
  st->some_block_aliased = false;
  st->group_stack_size = 0;
  st->string_stack_size = 0;
  st->group_stack = ts_malloc(MAX_STACK_SIZE);
  st->string_stack = ts_malloc(MAX_STACK_SIZE);
  return st;
}

void tree_sitter_stelf_external_scanner_destroy(void *payload) {
  struct state *st = payload;
  ts_free(st->group_stack);
  ts_free(st->string_stack);
  ts_free(st);
}

unsigned tree_sitter_stelf_external_scanner_serialize(void *payload, char *buffer) {
  struct state *st = payload;
  buffer[0] = st->left_arrow_aliased;
  buffer[1] = st->right_arrow_aliased;
  buffer[2] = st->some_block_aliased;
  buffer[3] = st->group_stack_size;
  buffer[4] = st->string_stack_size;
  memcpy(&buffer[5], st->group_stack, st->group_stack_size);
  size_t string_starting = 5 + st->group_stack_size;
  memcpy(&buffer[string_starting], st->string_stack, st->string_stack_size);
  return 5 + st->group_stack_size + st->string_stack_size;
}

void tree_sitter_stelf_external_scanner_deserialize(void *payload, const char *buffer,
                                                    unsigned length) {
  struct state *st = payload;
  if (length == 0) return;
  st->left_arrow_aliased = buffer[0];
  st->right_arrow_aliased = buffer[1];
  st->some_block_aliased = buffer[2];
  st->group_stack_size = buffer[3];
  st->string_stack_size = buffer[4];
  memcpy(st->group_stack, &buffer[5], st->group_stack_size);
  size_t string_starting = 5 + st->group_stack_size;
  memcpy(st->string_stack, &buffer[string_starting], st->string_stack_size);
}

static bool is_ident_char(int32_t c) {
  return c != 0 && c != ' ' && c != '\t' && c != '\n' && c != '\r' &&
         c != '(' && c != ')' && c != '{' && c != '}' &&
         c != '[' && c != ']' && c != '%';
}

bool tree_sitter_stelf_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  struct state *st = payload;

  if (valid_symbols[GIVEN]) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      lexer->advance(lexer, true);
    }
    char buf[256];
    int len = 0;
    while (is_ident_char(lexer->lookahead) && len < 255) {
      buf[len++] = (char)lexer->lookahead;
      lexer->advance(lexer, false);
    }
    if (len == 0) return false;
    buf[len] = '\0';
    if (strcmp(buf, "->") == 0) st->left_arrow_aliased = true;
    else if (strcmp(buf, "<-") == 0) st->right_arrow_aliased = true;
    else if (strcmp(buf, "some") == 0) st->some_block_aliased = true;
    lexer->result_symbol = GIVEN;
    return true;
  }

  if (valid_symbols[LEFT_ARROW]) {
    if (st->left_arrow_aliased && lexer->lookahead == '-') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '>') {
        lexer->advance(lexer, false);
        lexer->result_symbol = LEFT_ARROW;
        return true;
      }
      return false;
    }
    if (lexer->lookahead == '%') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '-') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '>') {
          lexer->advance(lexer, false);
          lexer->result_symbol = LEFT_ARROW;
          return true;
        }
      }
      return false;
    }
  }

  if (valid_symbols[RIGHT_ARROW]) {
    if (st->right_arrow_aliased && lexer->lookahead == '<') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '-') {
        lexer->advance(lexer, false);
        lexer->result_symbol = RIGHT_ARROW;
        return true;
      }
      return false;
    }
    if (lexer->lookahead == '%') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '<') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '-') {
          lexer->advance(lexer, false);
          lexer->result_symbol = RIGHT_ARROW;
          return true;
        }
      }
      return false;
    }
  }

  if (valid_symbols[SOME_BLOCK]) {
    if (st->some_block_aliased && lexer->lookahead == 's') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == 'o') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == 'm') {
          lexer->advance(lexer, false);
          if (lexer->lookahead == 'e') {
            lexer->advance(lexer, false);
            lexer->result_symbol = SOME_BLOCK;
            return true;
          }
        }
      }
      return false;
    }
    if (lexer->lookahead == '%') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == 's') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == 'o') {
          lexer->advance(lexer, false);
          if (lexer->lookahead == 'm') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == 'e') {
              lexer->advance(lexer, false);
              lexer->result_symbol = SOME_BLOCK;
              return true;
            }
          }
        }
      }
      return false;
    }
  }

  return false;
}
