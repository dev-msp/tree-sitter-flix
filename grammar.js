// I can generate a first-cut Tree‑sitter grammar.js for Flix that follows the structure and operator/precedence style used by tree-sitter-python. However, a full, correct grammar requires decisions that aren’t fully determined by the AST-notation you provided (e.g., concrete tokenization of identifiers, keywords, literals, string rules, comments, newlines/indentation strategy, etc.). Below is a practical starting point you can drop into a Tree‑sitter package and iterate on.
//
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
    [$.parameter, $.type_arrow],
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
        // $.namespace_decl,
        // $.trait_decl,
        // $.instance_decl,
        // $.sig_decl,
        $.def_decl,
        // $.enum_decl,
        // $.struct_decl,
        $.effect_decl,
        // $.type_alias_decl,
      ),

    effect_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "eff",
        field("name", $.identifier),
        "{",
        repeat($.def_decl),
        "}",
      ),

    def_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "def",
        field("name", $.identifier),
        field("params", $.parameters),
        optional(seq(":", field("result_type", $.type))),
        // optional(seq("with", field("effect_type", $.type))),
        // repeat($.trait_constraint),
        // repeat($.equality_constraint),
        // "=",
        // field("body", $.expression),
      ),

    // Use/Import (simplified)
    use_or_import: ($) =>
      seq(
        choice("use", "import"),
        $.qualified_name,
        optional(seq("as", $.identifier)),
        optional($.semi),
      ),

    // Parameters
    parameters: ($) => seq("(", optional(commaSep1($.parameter)), ")"),

    parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $.type))),
      ),

    type_params: ($) => seq("[", commaSep1($.type_param), optional(","), "]"),

    type_param: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("bound", $.type))),
        optional(seq("=", field("default", $.type))),
      ),

    // Expressions (baseline similar to Python precedence/calls/index/attr)
    expression: ($) =>
      choice($.lambda, $.conditional_expression, $.disjunction),

    lambda: ($) =>
      prec.right(
        seq(
          "lambda",
          optional($.parameters),
          "=>",
          field("body", $.expression),
        ),
      ),

    conditional_expression: ($) =>
      prec.right(seq($.disjunction, "if", $.disjunction, "else", $.expression)),

    disjunction: ($) => leftBinary($, "or", $.conjunction),
    conjunction: ($) => leftBinary($, "and", $.inversion),

    inversion: ($) => seq("not", $.inversion),

    argument_list: ($) =>
      seq(
        "(",
        optional(
          commaSep1(
            choice(
              $.expression,
              $.star_argument,
              $.double_star_argument,
              $.keyword_argument,
            ),
          ),
        ),
        optional(","),
        ")",
      ),

    star_argument: ($) => seq("*", $.expression),
    double_star_argument: ($) => seq("**", $.expression),
    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),

    // Types (basic surface syntax)
    type: ($) =>
      choice(
        $.applied_type,
        $.type_atom,
        // $.type_tuple,
        $.type_arrow,
        // $.type_group,
        // $.type_record,
      ),

    // type application with one or more type arguments, e.g., List[Int], Map[String, Int]
    applied_type: ($) =>
      seq($.type_name, seq("[", commaSep1($.type_param), optional(","), "]")),

    type_name: ($) => prec(2, $.qualified_name),

    type_atom: ($) =>
      choice($.type_name, $.type_group, $.type_tuple, $.type_record),

    type_tuple: ($) => seq("(", commaSep1($.type), optional(","), ")"),

    type_arrow: ($) => sep2($.type, "->", prec.right),

    type_record: ($) =>
      seq("{", optional(commaSep1($.type_record_field)), optional(","), "}"),
    type_record_field: ($) => seq($.identifier, ":", $.type),

    type_group: ($) => seq("(", $.type, ")"),

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
    //
    // Misc helpers
    semi: (_) => ";",

    comment: (_) => token(choice(seq("//", /.*/), seq("/*", /.*/, "*/"))),
  },
});

// Helpers

function sep1(rule, separator, precedence = (x) => x) {
  return precedence(seq(rule, repeat(precedence(seq(separator, rule)))));
}

function sep2(rule, separator, precedence = (x) => x) {
  return precedence(
    seq(rule, separator, rule, repeat1(precedence(seq(separator, rule)))),
  );
}

function commaSep1(rule, precedence = (x) => x) {
  return sep1(rule, ",");
}

// Left-assoc binary with keyword operator
function leftBinary($, op, next) {
  return prec.left(seq(next, repeat(seq(op, next))));
}

// Left-assoc binary with symbolic operator(s)
function leftBinarySym($, opToken, next) {
  return prec.left(seq(next, repeat(seq(opToken, next))));
}

// What next
// - Replace the placeholder keyword/modifier/effect/trait names with the exact Flix keywords and rules.
// - Flesh out expression forms specific to Flix (e.g., let/let*; match/case syntax; record ops; array/struct ops) using concrete syntax (the AST list you provided enumerates IR ops; choose the surface equivalents).
// - Tighten identifier and literal tokenization to match Flix (runes/char, big-int/dec, regex literals, etc.).
// - Add tests in corpus/ to drive incremental fixes.
// - If Flix uses layout/indentation rules, add an external scanner (like Python’s) to manage newlines/blocks.
//
// If you share the exact concrete syntax reference (lexical spec and BNF/PEG), I can refine this to a much closer, working grammar and add missing constructs (match patterns, choose, effects handling, etc.).
