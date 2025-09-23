/**
 * @file Flix grammar for tree-sitter
 * @author dev-msp
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const parensOptional = makeWrapperOptional(parens);
const bracketsOptional = makeWrapperOptional(brackets);
const bracesOptional = makeWrapperOptional(braces);

module.exports = grammar({
  name: "flix",

  extras: ($) => [/\s+/, $.comment],

  inline: ($) => [$.ref, $.type_ref, $.semi],

  conflicts: ($) => [
    [$.expression, $.call_expression],
    [$.binary_expression, $.body],
    [$.body],
    [$.path],
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
        braces(commaSep1($.struct_field)),
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

    _def_fn: ($) =>
      seq(
        "def",
        field("name", $.identifier),
        field("params", $._fn_parameters),
        optional(seq(":", field("result_type", $.type))),
        optional(seq("\\", field("effect", $.eff_expr))),
      ),

    signature: ($) => moddedSeq($, $._def_fn),
    function_declaration: ($) =>
      moddedSeq(
        $,
        field("signature", $._def_fn),
        "=",
        field("body", bracesOptional($.body)),
      ),
    _qualified_java_reference: ($) =>
      seq($.identifier, optional(seq(token.immediate("$"), $.identifier))),

    _import_alias: ($) =>
      braces(seq($._qualified_java_reference, "=>", $.identifier)),
    use_or_import: ($) =>
      seq(
        choice("use", "import"),
        $.path,
        optional(seq(".", choice($.identifier, $._import_alias))),
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

    parenthetical_expression: ($) => parens($.expression),

    // Expressions
    expression: ($) =>
      prec.left(
        choice(
          $.parenthetical_expression,
          $.literal,
          $.interpolated_string,
          $.identifier,
          $.path,
          $.call_expression,
          $.tuple,
          $.pipeline_expression,
          $.binary_expression,
          $.if_expression,
          $.foreach_expression,
          $.datalog_expression,
          $.inject_expression,
          $.query_expression,
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
    tuple: ($) => parens(sep2($.expression, ",", undefined)),
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

    // if/else
    if_expression: ($) =>
      seq(
        "if",
        field("condition", parens($.expression)),
        bracesOptional(field("left", $.body)),
        "else",
        bracesOptional(field("right", $.body)),
      ),

    // foreach
    foreach_expression: ($) =>
      seq(
        "foreach",
        parens(
          seq(parens(commaSep1($.identifier)), "<-", field("iterable", $.ref)),
        ),
        bracesOptional(field("body", $.body)),
      ),

    // Datalog
    inject_expression: ($) =>
      seq("inject", field("facts", $.ref), "into", field("relation", $.ref)),

    query_expression: ($) =>
      seq(
        "query",
        field("sources", $.query_source),
        "select",
        field("selection", $.query_selection),
        "from",
        $.relation_expression,
      ),

    datalog_expression: ($) =>
      surr("#{", "}", repeat(choice($.datalog_fact, $.datalog_rule))),
    datalog_fact: ($) => seq($.relation_expression, token.immediate(".")),

    query_source: ($) => commaSep1($.identifier),
    query_selection: ($) => parens(commaSep1($.identifier)),

    // TODO - make parens "immediate"
    relation_expression: ($) =>
      seq(field("name", $.identifier), parens(commaSep1($.expression))),
    datalog_rule: ($) =>
      seq(
        field("head", $.relation_expression),
        ":-",
        field("body", commaSep1($.relation_expression)),
        optional(seq(",", "if", parens(field("condition", $.expression)))),
        ".",
      ),
    datalog_type: ($) =>
      surr(
        "#{",
        "}",
        seq(commaSep1($.relation_expression), optional(seq("|", $.identifier))),
      ),

    assignment: ($) =>
      seq(
        choice(seq("let", field("left", $.pattern)), $._def_fn),
        "=",
        field("right", $.expression),
        $.semi,
      ),

    pattern: ($) =>
      choice(
        $.literal,
        $.identifier,
        $.path,
        $.tuple_pattern,
        $.enum_pattern,
        $.record_pattern,
      ),

    tuple_pattern: ($) => parens(sep2($.pattern, ",", undefined)),
    enum_pattern: ($) =>
      seq(field("enum", $.ref), field("case", parens($.pattern))),
    record_pattern: ($) =>
      braces(commaSep1($.identifier), optional(seq("|", $.identifier))),

    // Types (basic surface syntax)
    ref: ($) => choice($.identifier, $.path),
    type_ref: ($) => choice($.ref, $.applied_type),

    type: ($) =>
      choice($.type_ref, $.arrow, $.type_record, $.tuple_type, $.datalog_type),
    tuple_type: ($) => parens(sep2($.type, ",", undefined)),
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
          braces(commaSep1($.type_ref)),
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
    body: ($) =>
      seq(repeat(choice($.assignment, seq($.expression, ";"))), $.expression),

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

    string_fragment: (_) => token.immediate(choice(/\\./, /[^"\\$]+/)),

    interpolated_string: ($) => {
      const expr = surr("${", "}", $.expression);
      const fragment = $.string_fragment;
      return surr(
        '"',
        '"',
        choice(
          expr,
          seq(repeat1(seq(fragment, expr)), optional(fragment)),
          seq(repeat1(seq(expr, fragment)), optional(expr)),
        ),
      );
    },

    // Literals (basic)
    number: (_) => /\d+(_\d+)*(\.\d*)?/,
    string: ($) => surr('"', '"', repeat($.string_fragment)),
    char: (_) => surr("'", "'", choice(/[^'\\]/, /\\./)),
    boolean: (_) => choice("true", "false"),
  },
});

// Helpers

/** Modifiers, annotations, and doc comments
 *
 * @param {GrammarSymbols<string>} $ - The grammar symbols
 * @param {...RuleOrLiteral} rules - The rules or literals to include after modifiers, annotations, and doc comments
 * @returns {SeqRule} - The resulting rule with the modifiers, annotations, and doc comments
 */
function moddedSeq($, ...rules) {
  return seq(
    repeat($.doc_comment),
    repeat($.annotation),
    repeat($.modifier),
    ...rules,
  );
}

/** Surround with open and close
 *
 * @param {RuleOrLiteral} open - The opening rule or literal
 * @param {RuleOrLiteral} close - The closing rule or literal
 * @param {...RuleOrLiteral} outerRules - The rules or literals to surround
 * @returns {SeqRule} - The resulting rule for the surrounded content
 */
function surr(open, close, ...outerRules) {
  return seq(open, ...outerRules, close);
}

/** Separator with at least one element
 *
 * @param {RuleOrLiteral} rule - The rule for the elements in the list
 * @param {RuleOrLiteral} separator - The rule for the separator
 * @param {{ trailing?: boolean | 'any', precedence?: (x: any) => any }} options - Options for the list
 * @returns {any} - The resulting rule for the separated list
 */
function sep1(
  rule,
  separator,
  { trailing = false, precedence = (x) => x } = {},
) {
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

/** Separator with at least two elements
 *
 * @param {RuleOrLiteral} rule - The rule for the elements in the list
 * @param {RuleOrLiteral} separator - The rule for the separator
 * @param {{ trailing?: boolean | 'any', precedence?: (x: any) => any }} options - Options for the list
 * @returns {any} - The resulting rule for the separated list
 */
function sep2(
  rule,
  separator,
  { trailing = false, precedence = (x) => x } = {},
) {
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

/** Comma-separated list with at least one element
 *
 * @param {RuleOrLiteral} rule - The rule for the elements in the list
 * @param {{ trailing?: boolean | 'any', precedence?: (x: any) => any }} options - Options for the list
 * @returns {any} - The resulting rule for the comma-separated list
 */
function commaSep1(rule, { trailing = false, precedence = (x) => x } = {}) {
  return sep1(rule, ",", { trailing, precedence });
}

/** Binary expression helper
 *
 * @param {GrammarSymbols<string>} $ - The grammar symbols
 * @param {RuleOrLiteral} op - The operator literal
 * @param {RuleOrLiteral} next - The next expression rule
 * @returns {SeqRule} - The resulting rule for the binary expression
 */
function binary($, op, next) {
  return seq(field("left", next), field("operator", op), field("right", next));
}

/** Helpers for tree-sitter grammar rules
 * @param {(...rules: RuleOrLiteral[]) => Rule} fn - The rule function
 * @returns {(...rules: RuleOrLiteral[]) => Rule} - The resulting rule function
 */
function makeWrapperOptional(fn) {
  return (...rules) => choice(fn(...rules), seq(...rules));
}

/** Parens helper
 * @param {...RuleOrLiteral} rules - The rules or literals to include inside the wrapper
 * @returns {SeqRule} - The resulting rule for the wrapped content
 */
function parens(...rules) {
  return surr("(", ")", ...rules);
}

/** Brackets helper
 * @param {...RuleOrLiteral} rules - The rules or literals to include inside the wrapper
 * @returns {SeqRule} - The resulting rule for the wrapped content
 */
function brackets(...rules) {
  return surr("[", "]", ...rules);
}

/** Braces helper
 * @param {...RuleOrLiteral} rules - The rules or literals to include inside the wrapper
 * @returns {SeqRule} - The resulting rule for the wrapped content
 */
function braces(...rules) {
  return surr("{", "}", ...rules);
}
