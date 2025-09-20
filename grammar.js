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
    [$.primary_expression, $.pattern],
    [$.type, $.primary_expression],
    [$.type, $.pattern],
    [$.trait_constraint, $.type_name],
    [$.declaration, $.statement],
    [$.set, $.dict],
    [$.type_tuple, $.type_group],
    [$.type_param, $.type_arrow],
    [$.type_record_field, $.type_arrow],
    [$.parameter, $.type_arrow],
  ],

  word: ($) => $.identifier,

  supertypes: ($) => [
    $.declaration,
    $.statement,
    $.expression,
    $.primary_expression,
    $.type,
    $.pattern,
  ],

  rules: {
    // Top
    source_file: ($) => repeat($._unit),

    _unit: ($) => choice($.use_or_import, $.declaration),

    // Declarations (rough surface-syntax sketch)
    declaration: ($) =>
      choice(
        $.namespace_decl,
        $.trait_decl,
        $.instance_decl,
        $.sig_decl,
        $.def_decl,
        $.enum_decl,
        $.struct_decl,
        $.effect_decl,
        $.type_alias_decl,
      ),

    namespace_decl: ($) =>
      seq("namespace", field("name", $.qualified_name), field("body", $.block)),

    trait_decl: ($) =>
      prec.right(
        seq(
          optional($.doc_comment),
          repeat($.annotation),
          repeat($.modifier),
          "trait",
          field("name", $.identifier),
          field("type_params", optional($.type_params)),
          field("super", repeat($.trait_constraint)),
          field("assoc_types", repeat($.assoc_type_sig)),
          field("sigs", repeat($.sig_decl)),
          field("defs", repeat($.def_decl)),
        ),
      ),

    instance_decl: ($) =>
      prec.right(
        seq(
          optional($.doc_comment),
          repeat($.annotation),
          repeat($.modifier),
          "instance",
          field("trait", $.qualified_name),
          field("type_params", repeat($.type_param)),
          field("inst_type", $.type),
          field("where", repeat($.trait_constraint)),
          field("eq_constraints", repeat($.equality_constraint)),
          field("assoc_defs", repeat($.assoc_type_def)),
          field("defs", repeat($.def_decl)),
          field("redefs", repeat($.redef_decl)),
        ),
      ),

    sig_decl: ($) =>
      prec.right(
        seq(
          optional($.doc_comment),
          repeat($.annotation),
          repeat($.modifier),
          "sig",
          field("name", $.identifier),
          field("type_params", optional($.type_params)),
          field("params", optional($.parameters)),
          optional(seq(":", field("result_type", $.type))),
          optional(seq("with", field("effect_type", $.type))),
          repeat($.trait_constraint),
          repeat($.equality_constraint),
          optional(seq("=", field("default", $.expression))),
        ),
      ),

    def_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "def",
        field("name", $.identifier),
        field("type_params", optional($.type_params)),
        field("params", optional($.parameters)),
        optional(seq(":", field("result_type", $.type))),
        optional(seq("with", field("effect_type", $.type))),
        repeat($.trait_constraint),
        repeat($.equality_constraint),
        "=",
        field("body", $.expression),
      ),

    enum_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "enum",
        field("name", $.identifier),
        field("type_params", optional($.type_params)),
        field("derivations", optional($.derivations)),
        "{",
        repeat($.case_decl),
        "}",
      ),

    case_decl: ($) =>
      seq(
        "case",
        field("name", $.identifier),
        optional(field("payload", $.type_tuple)),
        optional(seq(":", field("scheme", $.scheme))),
      ),

    struct_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "struct",
        field("name", $.identifier),
        field("type_params", optional($.type_params)),
        optional(seq(":", field("scheme", $.scheme))),
        "{",
        repeat($.struct_field),
        "}",
      ),

    struct_field: ($) =>
      seq(
        repeat($.modifier),
        field("name", $.identifier),
        ":",
        field("type", $.type),
        optional($.semi),
      ),

    effect_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "eff",
        field("name", $.identifier),
        "{",
        repeat($.op_decl),
        "}",
      ),

    op_decl: ($) =>
      seq(
        "op",
        field("name", $.identifier),
        field("params", optional($.parameters)),
        optional(seq(":", field("result_type", $.type))),
        optional(seq("with", field("effect_type", $.type))),
        optional($.semi),
      ),

    type_alias_decl: ($) =>
      seq(
        optional($.doc_comment),
        repeat($.annotation),
        repeat($.modifier),
        "type",
        field("name", $.identifier),
        field("type_params", optional($.type_params)),
        "=",
        field("aliased", $.type),
      ),

    redef_decl: ($) =>
      seq(
        "redef",
        field("name", $.identifier),
        "=",
        field("expr", $.expression),
      ),

    // Constraints (simplified)
    trait_constraint: ($) => prec.right(seq($.qualified_name, repeat($.type))),
    equality_constraint: ($) => seq($.type, "=", $.type),

    assoc_type_sig: ($) =>
      prec.left(
        seq(
          "assoc",
          field("name", $.identifier),
          field("params", optional($.type_params)),
          optional(seq(":", field("kind", $.kind))),
          optional(seq("=", field("default", $.type))),
        ),
      ),

    assoc_type_def: ($) =>
      seq(
        "assoc",
        field("name", $.qualified_name),
        field("lhs", $.type),
        "=",
        field("rhs", $.type),
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
    parameters: ($) =>
      seq("(", optional(commaSep1($.parameter)), optional(","), ")"),

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

    // Statements (placeholder – Flix may be expression-oriented)
    statement: ($) => choice($.expression, $.def_decl),

    block: ($) =>
      seq(
        "{",
        repeat(choice($.declaration, $.statement, $.use_or_import)),
        "}",
      ),

    // Expressions (baseline similar to Python precedence/calls/index/attr)
    expression: ($) =>
      choice($.lambda, $.conditional_expression, $.disjunction),

    lambda: ($) =>
      prec.right(
        seq(
          "lambda",
          optional($.lambda_params),
          "=>",
          field("body", $.expression),
        ),
      ),

    lambda_params: ($) => $.parameters,

    conditional_expression: ($) =>
      prec.right(seq($.disjunction, "if", $.disjunction, "else", $.expression)),

    disjunction: ($) => leftBinary($, "or", $.conjunction),
    conjunction: ($) => leftBinary($, "and", $.inversion),

    inversion: ($) => choice(seq("not", $.inversion), $.comparison),

    comparison: ($) =>
      prec.left(
        seq(
          $.bitwise_or,
          repeat(
            seq(
              field(
                "operator",
                choice(
                  "==",
                  "!=",
                  "<=",
                  "<",
                  ">=",
                  ">",
                  "in",
                  seq("not", "in"),
                  "is",
                  seq("is", "not"),
                ),
              ),
              $.bitwise_or,
            ),
          ),
        ),
      ),

    bitwise_or: ($) => leftBinarySym($, "|", $.bitwise_xor),
    bitwise_xor: ($) => leftBinarySym($, "^", $.bitwise_and),
    bitwise_and: ($) => leftBinarySym($, "&", $.shift_expr),

    shift_expr: ($) => leftBinarySym($, choice("<<", ">>"), $.sum),
    sum: ($) => leftBinarySym($, choice("+", "-"), $.term),
    term: ($) => leftBinarySym($, choice("*", "/", "//", "%", "@"), $.factor),

    factor: ($) => choice(seq(choice("+", "-", "~"), $.factor), $.power),

    power: ($) =>
      prec.right(seq($.await_primary, optional(seq("**", $.factor)))),

    await_primary: ($) =>
      choice(seq("await", $.primary_expression), $.primary_expression),

    primary_expression: ($) =>
      choice($.call, $.subscription, $.attribute, $.atom),

    call: ($) =>
      prec(
        9,
        seq(
          field("function", $.primary_expression),
          field("arguments", $.argument_list),
        ),
      ),

    subscription: ($) =>
      prec(
        9,
        seq(
          field("value", $.primary_expression),
          "[",
          field("subscript", $.slices),
          optional(","),
          "]",
        ),
      ),

    attribute: ($) =>
      prec(
        9,
        seq(
          field("object", $.primary_expression),
          ".",
          field("attribute", $.identifier),
        ),
      ),

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

    slices: ($) => commaSep1(choice($.slice, $.expression)),
    slice: ($) =>
      seq(
        optional($.expression),
        ":",
        optional($.expression),
        optional(seq(":", optional($.expression))),
      ),

    atom: ($) =>
      choice($.identifier, $.literal, $.tuple, $.list, $.dict, $.set, $.group),

    group: ($) => seq("(", choice($.expression), ")"),
    tuple: ($) =>
      seq(
        "(",
        optional(seq($.expression, ",", optional(commaSep1($.expression)))),
        ")",
      ),
    list: ($) =>
      seq("[", optional(commaSep1($.expression)), optional(","), "]"),
    set: ($) => seq("{", optional(commaSep1($.expression)), optional(","), "}"),
    dict: ($) =>
      seq(
        "{",
        optional(commaSep1(choice($.pair, $.double_star_argument))),
        optional(","),
        "}",
      ),
    pair: ($) => seq($.expression, ":", $.expression),

    // Patterns (basic)
    pattern: ($) =>
      choice(
        $.wildcard_pattern,
        $.capture_pattern,
        $.literal_pattern,
        $.tuple_pattern,
        $.constructor_pattern,
        $.record_pattern,
      ),

    wildcard_pattern: ($) => prec(1, "_"),
    capture_pattern: ($) => prec(1, $.identifier),
    literal_pattern: ($) => $.literal,
    tuple_pattern: ($) => seq("(", commaSep1($.pattern), optional(","), ")"),
    constructor_pattern: ($) =>
      seq($.qualified_name, optional(commaSep1($.pattern))),
    record_pattern: ($) =>
      seq("{", commaSep1($.record_label_pattern), optional(","), "}"),
    record_label_pattern: ($) => seq($.identifier, ":", $.pattern),

    // Types (basic surface syntax)
    type: ($) =>
      choice(
        $.type_var,
        $.type_name,
        $.type_apply,
        $.type_tuple,
        $.type_arrow,
        $.type_group,
        $.type_record,
      ),

    type_var: ($) => prec(1, $.identifier),
    type_name: ($) => $.qualified_name,

    type_apply: ($) =>
      prec(1, prec.left(seq($.type_name, repeat1($.type_atom)))),

    type_atom: ($) =>
      choice(
        $.type_var,
        $.type_name,
        $.type_group,
        $.type_tuple,
        $.type_record,
      ),

    type_tuple: ($) => seq("(", commaSep1($.type), optional(","), ")"),

    type_arrow: ($) =>
      prec.right(
        seq(
          // Arrow T1 -> T2  (optionally multiple args)
          commaSep1($.type),
          "->",
          $.type,
        ),
      ),

    type_record: ($) =>
      seq("{", optional(commaSep1($.type_record_field)), optional(","), "}"),
    type_record_field: ($) => seq($.identifier, ":", $.type),

    type_group: ($) => seq("(", $.type, ")"),

    scheme: ($) =>
      seq(
        // Simple: forall [type-params]. type  (optional effects after with)
        optional(seq("forall", $.type_params)),
        $.type,
        optional(seq("with", $.type)),
      ),

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

    // Literals (adjust to Flix specifics)
    literal: ($) =>
      choice($.integer, $.float, $.string, "true", "false", "null", "()"),

    integer: (_) => token(/0|[1-9][0-9_]*/),

    float: (_) =>
      token(
        choice(
          /[0-9][0-9_]*\.[0-9_]+([eE][+-]?[0-9_]+)?/,
          /\.[0-9_]+([eE][+-]?[0-9_]+)?/,
          /[0-9][0-9_]*[eE][+-]?[0-9_]+/,
        ),
      ),

    string: (_) => token(seq('"', repeat(choice(/[^"\\\n]/, /\\./)), '"')),

    // Kinds (placeholder)
    kind: ($) =>
      prec.right(
        choice(
          "*",
          seq("(", commaSep1($.kind), ")"),
          seq($.kind, "->", $.kind),
          $.identifier,
        ),
      ),

    // Derivations (placeholder)
    derivations: ($) => seq("deriving", commaSep1($.qualified_name)),

    // Misc helpers
    semi: (_) => ";",

    comment: (_) => token(choice(seq("//", /.*/), seq("/*", /.*/, "*/"))),
  },
});

// Helpers

function sep1(rule, separator) {
  return prec.left(seq(rule, repeat(prec.left(seq(separator, rule)))));
}

function commaSep1(rule) {
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
