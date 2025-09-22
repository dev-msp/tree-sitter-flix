/**
 * @file Flix grammar for tree-sitter
 * @author dev-msp
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const makeWrapperOptional =
  (fn) =>
  (...rules) =>
    choice(fn(...rules), seq(...rules));

const parens = (...rules) => surr("(", ")", ...rules);
const brackets = (...rules) => surr("[", "]", ...rules);
const braces = (...rules) => surr("{", "}", ...rules);

const parensOptional = makeWrapperOptional(parens);
const bracesOptional = makeWrapperOptional(braces);

module.exports = grammar({
  name: "flix",

  extras: ($) => [/\s+/, $.comment],

  inline: ($) => [$.ref, $.type_ref, $.semi],

  conflicts: ($) => [
    [$.string, $.interpolated_string],
    [$.expression, $.call_expression],
    [$.binary_expression],
  ],

  precedences: ($) => [
    [
      "composition",
      "application",
      "unary_void",
      "binary_exp",
      "binary_times",
      "binary_plus",
      "binary_shift",
      "binary_compare",
      "binary_relation",
      "binary_equality",
      "bitwise_and",
      "bitwise_xor",
      "bitwise_or",
      "logical_and",
      "logical_or",
    ],
    [$.body, $.expression, $.pipeline_expression, $.keyword_argument],
  ],

  word: ($) => $.identifier,

  supertypes: ($) => [$.declaration, $.expression, $.type],

  rules: {
    // Top
    source_file: ($) => repeat($._unit),
    _unit: ($) => choice($.use_or_import, $.declaration),
    // Declarations (rough surface-syntax sketch)
    declaration: ($) =>
      choice(
        $.mod_decl,
        $.function_declaration,
        $.enum_definition,
        $.struct_decl,
        $.trait_definition,
        $.trait_instance,
        $.effect_decl,
        $.type_alias_decl,
      ),
    mod_decl: ($) =>
      moddedSeq($, "mod", field("name", $.identifier), braces(repeat($._unit))),
    enum_definition: ($) =>
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
        optional(field("params", parens(commaSep1($.path)))),
        optional(seq(":", field("result_type", $.type))),
      ),
    struct_decl: ($) =>
      moddedSeq(
        $,
        "struct",
        field("name", $.identifier),
        optional(field("type_params", $.type_params)),
        braces(commaSep1($.struct_field, false)),
      ),
    struct_field: ($) =>
      seq(
        optional($.modifier),
        field("name", $.identifier),
        ":",
        field("type", $.type),
      ),

    trait_definition: ($) =>
      moddedSeq(
        $,
        "trait",
        field("name", $.identifier),
        optional(field("type_params", $.type_params)),
        optional(seq("with", $.applied_type)),
        braces(
          seq(
            optional(repeat($.trait_associated_item)),
            repeat(
              choice($.trait_law, seq($.signature, optional(seq("=", $.body)))),
            ),
          ),
        ),
      ),
    trait_associated_item: ($) =>
      seq(
        "type",
        field("name", $.identifier),
        optional(seq(":", field("bound", $.type_ref))),
        optional(
          seq(
            "=",
            field("default", choice($.type, binary($, "+", $.type_ref))),
          ),
        ),
      ),

    trait_law: ($) =>
      moddedSeq(
        $,
        "law",
        field("name", $.identifier),
        ":",
        "forall",
        parens(commaSep1($.type_param, undefined)),
        optional(seq("with", $.applied_type)),
        $.expression,
      ),

    trait_instance: ($) =>
      moddedSeq(
        $,
        "instance",
        field("trait", $.path),
        brackets(field("for_type", $.type_ref)),
        optional(seq("with", $.applied_type)),
        optional($.trait_constraint),
        braces(
          seq(repeat($.trait_associated_item), repeat($.function_declaration)),
        ),
      ),
    trait_constraint: ($) =>
      seq("where", field("left", $.applied_type), "~", field("right", $.type)),

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
        surr("{", "}", repeat($.signature)),
      ),

    signature: ($) =>
      moddedSeq(
        $,
        "def",
        field("name", $.identifier),
        field("params", $._fn_parameters),
        optional(seq(":", field("result_type", $.type))),
        optional(seq("\\", field("effect", $.eff_expr))),
      ),
    function_declaration: ($) =>
      seq(
        $.signature,
        "=",
        field(
          "body",
          choice(
            braces(seq(repeat(seq($.expression, $.semi)), $.expression)),
            seq(repeat(seq($.expression, $.semi)), $.expression),
          ),
        ),
      ),
    // Use/Import (simplified)
    use_or_import: ($) =>
      seq(
        choice("use", "import"),
        $.path,
        optional(seq("as", $.identifier)),
        optional($.semi),
      ),
    // Function parameters
    _fn_parameters: ($) => parens(optional(commaSep1($.fn_parameter))),
    fn_parameter: ($) =>
      prec.right(
        seq(
          field("name", $.identifier),
          optional(seq(":", field("type", $.type))),
        ),
      ),
    type_params: ($) => brackets(commaSep1($.type_param, undefined)),
    type_param: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("bound", $.type))),
        optional(seq("=", field("default", $.type))),
      ),

    // Expressions
    expression: ($) =>
      prec.left(
        choice(
          $.interpolated_string,
          $.literal,

          $.identifier,
          $.path,
          $.call_expression,
          $.tuple,
          $.pipeline_expression,
          $.binary_expression,
          $.eff_handle_block,
        ),
      ),

    binary_expression: ($) =>
      choice(
        ...[
          ["->", "application"],
          [">>", "composition"],
          ["&&", "logical_and"],
          ["||", "logical_or"],
          ["&", "bitwise_and"],
          ["^", "bitwise_xor"],
          ["|", "bitwise_or"],
          ["+", "binary_plus"],
          ["-", "binary_plus"],
          ["*", "binary_times"],
          ["/", "binary_times"],
          ["%", "binary_times"],
          ["**", "binary_exp", "right"],
          ["<", "binary_relation"],
          ["<=", "binary_relation"],
          ["==", "binary_equality"],
          ["!=", "binary_equality"],
          [">=", "binary_relation"],
          [">", "binary_relation"],
        ].map(([operator, precedence, associativity]) =>
          (associativity === "right" ? prec.right : prec.left)(
            precedence,
            seq(
              field("left", $.expression),
              field("operator", operator),
              field("right", $.expression),
            ),
          ),
        ),
      ),
    tuple: ($) => parens(sep2($.ref, ",", undefined)),
    pipeline_expression: ($) => prec.right(binary($, "|>", $.expression)),
    call_expression: ($) =>
      prec(
        1,
        seq(
          field("function", choice($.identifier, $.path, parens($.expression))),
          field("arguments", $.argument_list),
        ),
      ),
    argument_list: ($) =>
      parens(
        optional(
          commaSep1(choice($.expression, $.keyword_argument), undefined),
        ),
      ),
    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),

    // Types (basic surface syntax)
    ref: ($) => choice($.identifier, $.path),
    type_ref: ($) => choice($.ref, $.applied_type),

    type: ($) => choice($.type_ref, $.arrow, $.type_record),
    // Type application with one or more type arguments, e.g., List[Int], Map[String, Int]
    applied_type: ($) =>
      seq(
        field("type", $.ref),
        field("parameters", brackets(commaSep1($.type, undefined))),
      ),
    arrow: ($) =>
      prec.right(
        "application",
        seq(
          field("left", $.type),
          "->",
          field("right", $.type),
          optional(seq("\\", field("effect", $.eff_expr))),
        ),
      ),
    type_record: ($) =>
      braces(optional(commaSep1($.type_record_field, undefined))),
    type_record_field: ($) =>
      seq(field("name", $.identifier), "=", field("type", $.type)),

    eff_expr: ($) =>
      prec.left(
        choice(
          $.type_ref,
          braces(commaSep1($.type_ref, false)),
          parensOptional(binary($, "+", $.eff_expr)),
          parensOptional(binary($, "-", $.eff_expr)),
        ),
      ),
    eff_handle_block: ($) =>
      seq(
        "run",
        braces($.body),
        "with",
        choice(
          $.ref,
          seq("handler", $.path, braces(repeat1($.function_declaration))),
        ),
      ),
    body: ($) => seq(repeat(seq($.expression, ";")), $.expression),

    // Names
    path: ($) => sep2($.identifier, "."),
    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,
    // Modifiers, annotations, docs
    modifier: (_) =>
      choice(
        "mut",
        "pub",
        "final",
        "inline",
        "opaque",
        "override",
        "lawful",
        "sealed",
      ),
    annotation: ($) => seq("@", $.identifier, optional($.argument_list)),
    doc_comment: (_) => token(repeat1(seq("///", /.*/, /\s*/))),
    // Misc helpers
    semi: (_) => ";",
    comment: (_) =>
      token(
        choice(seq("//", /[^/].*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),

    literal: ($) => choice($.number, $.string, $.char, $.boolean),

    interpolated_string: ($) => {
      const esc = /\\./;
      const interp = surr("${", "}", $.expression);
      const content = repeat1(choice(interp, esc, /[^"\\$]+/, /\\\{/, /\\\}/));
      return surr('"', '"', content);
    },

    // Literals (basic)
    number: (_) => /\d+(_\d+)*(\.\d*)?/,
    string: (_) => surr('"', '"', repeat(choice(/[^"\\]/, /\\./))),
    char: (_) => surr("'", "'", choice(/[^'\\]/, /\\./)),
    boolean: (_) => choice("true", "false"),
  },
});

// Helpers

function moddedSeq($, ...rules) {
  return seq(
    repeat($.doc_comment),
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
