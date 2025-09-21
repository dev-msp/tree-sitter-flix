// I can generate a first-cut Tree‑sitter grammar.js for Flix that follows the structure and operator/precedence style used by tree-sitter-python. However, a full, correct grammar requires decisions that aren’t fully determined by the AST-notation you provided (e.g., concrete tokenization of identifiers, keywords, literals, string rules, comments, newlines/indentation strategy, etc.). Below is a practical starting point you can drop into a Tree‑sitter package and iterate on.

// Notes and assumptions:
// - Flix syntax assumed is closer to ML/Scala-style rather than Python (no offside/indent-sensitive layout). We therefore do not use external indent/dedent/newline tokens like Python’s grammar.
// - Identifiers, keywords, and literals are sketched; you will likely refine them to match Flix’s actual lexer rules.
// - The AST sections you gave (Kinded/Lifted/Reduced/etc.) look like IR nodes, not surface syntax. The grammar below targets a plausible surface language (defs, enums, traits, effects, instances, expressions, types, patterns). You may need to adjust to actual Flix concrete syntax.
// - Precedences mirror Python’s table to give you a working baseline for binary/unary ops and calls/member access.
// - Comments: // line and /* ... */ block.
// - Strings: basic double-quoted strings; extend as needed.
// - This is intentionally modular and incomplete in some constructs; fill in missing pieces and adjust keyword lists to the real Flix language.

/**
 * @file Flix grammar for tree-sitter
 * @author msp
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const parens = (...rules) => surr("(", ")", ...rules);
const brackets = (...rules) => surr("[", "]", ...rules);
const braces = (...rules) => surr("{", "}", ...rules);

module.exports = grammar({
  name: "flix",

  extras: ($) => [/\s+/, $.comment],

  conflicts: ($) => [
    // [$.primary_expression, $.pattern],
    // [$.type, $.pattern],
    // [$.trait_constraint, $.type_name],
    // [$.declaration, $.statement],
    // [$.set, $.dict],
    [$.type_tuple, $.type_group],
    [$.type_param, $.type_arrow],
    [$.type_record_field, $.type_arrow],
    [$.eff_expr, $.def_decl],
  ],

  word: ($) => $.identifier,

  supertypes: ($) => [
    $.declaration,
    // $.statement,
    $.expression,
    // $.primary_expression,
    $.type,
    // $.pattern,
  ],

  rules: {
    // Top
    source_file: ($) => repeat($._unit),
    _unit: ($) => choice($.use_or_import, $.declaration),
    // Declarations (rough surface-syntax sketch)
    declaration: ($) =>
      choice(
        $.mod_decl,
        $.def_decl_with_body,
        $.enum_decl,
        // $.struct_decl,
        $.effect_decl,
        $.type_alias_decl,
      ),
    mod_decl: ($) =>
      moddedSeq($, "mod", field("name", $.identifier), braces(repeat($._unit))),
    enum_decl: ($) =>
      moddedSeq(
        $,
        "enum",
        field("name", $.identifier),
        optional(field("type_params", $.type_params)),
        choice(parens($.type), braces(repeat1($.enum_case))),
      ),

    enum_case: ($) =>
      seq(
        "case",
        field("name", $.identifier),
        optional(field("params", parens(commaSep1($.type_name)))),
        optional(seq(":", field("result_type", $.type))),
      ),
    // struct_decl: ($) =>
    type_alias_decl: ($) =>
      moddedSeq(
        $,
        "type",
        "alias",
        field("name", $.identifier),
        optional(field("type_params", $.type_params)),
        "=",
        field("aliased_type", $.type),
      ),
    effect_decl: ($) =>
      moddedSeq(
        $,
        "eff",
        field("name", $.identifier),
        "{",
        repeat($.pure_def_decl),
        "}",
      ),
    pure_def_decl: ($) =>
      moddedSeq(
        $,
        "def",
        field("name", $.identifier),
        field("params", $.fnParameters),
        optional(seq(":", field("result_type", $.type))),
      ),
    def_decl: ($) =>
      seq($.pure_def_decl, optional(seq("\\", field("effect", $.eff_expr)))),
    def_decl_with_body: ($) =>
      seq(
        $.def_decl,
        "=",
        field(
          "body",
          choice(
            braces(repeat1(seq($.expression, ";"))),
            repeat1($.expression),
          ),
        ),
      ),
    // Use/Import (simplified)
    use_or_import: ($) =>
      seq(
        choice("use", "import"),
        $.qualified_name,
        optional(seq("as", $.identifier)),
        optional($.semi),
      ),
    // Function parameters
    fnParameters: ($) => parens(optional(commaSep1($.fnParameter))),
    fnParameter: ($) =>
      prec.right(
        seq(
          field("name", $.identifier),
          optional(seq(":", field("type", $.type))),
        ),
      ),
    type_params: ($) => brackets(commaSep1($.type_param), optional(",")),
    type_param: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("bound", $.type))),
        optional(seq("=", field("default", $.type))),
      ),
    // Expressions (baseline similar to Python precedence/calls/index/attr)
    expression: ($) =>
      choice(
        $.literal,
        $.lambda,
        $.conditional_expression,
        $.disjunction,
        $.identifier,
        $.call_expression,
        $.pipeline_expression,
        $.eff_handle_block,
      ),

    pipeline_expression: ($) =>
      prec.right(
        seq(
          field("left", $.expression),
          "|>",
          field("right", choice($.qualified_name, $.call_expression)),
        ),
      ),
    call_expression: ($) =>
      prec(
        1,
        seq(
          field("function", choice($.identifier, parens($.expression))),
          parens(optional(field("arguments", $.argument_list))),
        ),
      ),
    lambda: ($) =>
      prec.right(
        seq(
          "lambda",
          optional($.fnParameters),
          "=>",
          field("body", $.expression),
        ),
      ),
    conditional_expression: ($) =>
      prec.right(seq($.disjunction, "if", $.disjunction, "else", $.expression)),
    disjunction: ($) => prec.left(binary($, "or", $.conjunction)),
    conjunction: ($) => prec.left(binary($, "and", $.inversion)),
    inversion: ($) => seq("not", $.inversion),
    argument_list: ($) =>
      parens(
        optional(
          commaSep1(
            choice(
              $.expression,
              $.star_argument,
              $.double_star_argument,
              $.keyword_argument,
            ),
            undefined,
          ),
        ),
      ),
    star_argument: ($) => seq("*", $.expression),
    double_star_argument: ($) => seq("**", $.expression),
    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),
    // Types (basic surface syntax)
    type: ($) =>
      choice(
        $.type_arrow,
        $.applied_type,
        $.type_name,
        $.type_tuple,
        $.type_group,
        $.type_record,
      ),
    // type application with one or more type arguments, e.g., List[Int], Map[String, Int]
    applied_type: ($) =>
      seq($.type_name, brackets(commaSep1($.type_param), optional(","))),
    // Simple type name (possibly qualified), e.g., Int, String, MyModule.MyType
    type_name: ($) => prec(2, $.qualified_name),
    type_tuple: ($) => parens(commaSep1($.type, undefined)),
    type_arrow: ($) =>
      prec.right(
        seq(
          sep2($.type, "->", false, prec.right),
          optional(seq("\\", field("effect", $.eff_expr))),
        ),
      ),
    type_record: ($) =>
      braces(optional(commaSep1($.type_record_field, undefined))),
    type_record_field: ($) =>
      seq(field("name", $.identifier), "=", field("type", $.type)),
    type_group: ($) => parens($.type),

    eff_expr: ($) =>
      prec.left(
        choice(
          $.qualified_name,
          braces(commaSep1($.qualified_name, false)),
          binary($, "+", $.eff_expr),
          parens(binary($, "-", $.eff_expr)),
        ),
      ),
    eff_handle_block: ($) =>
      seq(
        "run",
        braces($.body),
        "with",
        choice(
          $.qualified_name,
          seq(
            "handler",
            $.qualified_name,
            braces(repeat1($.def_decl_with_body)),
          ),
        ),
      ),
    body: ($) => seq(repeat(seq($.expression, ";")), $.expression),
    // Names
    qualified_name: ($) => sep1($.identifier, "."),
    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,
    // Modifiers, annotations, docs
    modifier: (_) =>
      choice(
        "pub",
        "final",
        "inline",
        "opaque",
        "override",
        "lawful",
        "sealed",
      ),
    annotation: ($) => seq("@", $.identifier, optional($.argument_list)),
    doc_comment: (_) => token(seq("///", /.*/)),
    // Misc helpers
    semi: (_) => ";",
    comment: (_) => token(choice(seq("//", /.*/), seq("/*", /.*/, "*/"))),

    literal: ($) => choice($.number, $.string, $.char, $.boolean),

    // Literals (basic)
    number: (_) => /\d+(_\d+)*/,
    string: ($) => surr('"', '"', repeat(choice(/[^"\\]/, /\\./))),
    char: ($) => surr("'", "'", choice(/[^'\\]/, /\\./)),
    boolean: (_) => choice("true", "false"),
  },
});

// Helpers

function moddedSeq($, ...rules) {
  return seq(
    optional($.doc_comment),
    repeat($.annotation),
    repeat($.modifier),
    ...rules,
  );
}

function surr(open, close, ...outerRules) {
  return seq(open, ...outerRules, close);
}

function sep1(rule, separator, trailing = false, precedence = (x) => x) {
  const rules = [rule, repeat(precedence(seq(separator, rule)))];
  switch (trailing) {
    case true: {
      rules.push(separator);
      break;
    }
    case false:
      break;
    default: {
      rules.push(optional(separator));
    }
  }
  return precedence(seq(...rules));
}

function sep2(rule, separator, trailing = false, precedence = (x) => x) {
  const rules = [rule, repeat1(precedence(seq(separator, rule)))];
  switch (trailing) {
    case true: {
      rules.push(separator);
      break;
    }
    case false:
      break;
    default: {
      rules.push(optional(separator));
    }
  }
  return precedence(seq(...rules));
}

function commaSep1(rule, trailing = false, precedence = (x) => x) {
  return sep1(rule, ",", trailing, precedence);
}

// binary operation
function binary($, op, next) {
  return seq(field("left", next), field("operator", op), field("right", next));
}
