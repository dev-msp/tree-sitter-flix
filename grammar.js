/**
 * @file Flix grammar for tree-sitter
 * @author dev-msp
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const parens = (...rules) => surr("(", ")", ...rules);
const parensOptional = (...rules) =>
  choice(surr("(", ")", ...rules), seq(...rules));
const brackets = (...rules) => surr("[", "]", ...rules);
const braces = (...rules) => surr("{", "}", ...rules);

module.exports = grammar({
  name: "flix",

  extras: ($) => [/\s+/, $.comment],

  conflicts: ($) => [
    // [$.primary_expression, $.pattern],
    // [$.type, $.pattern],
    // [$.trait_constraint, $.qualified_name],
    // [$.declaration, $.statement],
    // [$.set, $.dict],
    [$.string, $.interpolated_string],
    [$.type_tuple, $.type_group],
    [$.eff_expr, $.associated_effect_ref],
    [$.trait_associated_effect_decl, $.qualified_name],
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
        $.struct_decl,
        $.trait_decl,
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
        optional(field("params", parens(commaSep1($.qualified_name)))),
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
    trait_decl: ($) =>
      moddedSeq(
        $,
        "trait",
        field("name", $.identifier),
        optional(field("type_params", $.type_params)),
        braces(
          seq(
            optional(
              repeat(
                choice(
                  $.trait_associated_type_decl,
                  $.trait_associated_effect_decl,
                ),
              ),
            ),
            repeat($.def_decl),
          ),
        ),
      ),

    trait_associated_type_decl: ($) =>
      seq(
        "type",
        field("name", $.identifier),
        optional(seq(":", field("bound", $.type))),
        optional(seq("=", field("default", $.type))),
      ),

    associated_effect_ref: ($) =>
      seq(
        field("name", $.qualified_name),
        optional(brackets(field("implementing_type", $.identifier))),
      ),

    trait_associated_effect_decl: ($) =>
      seq(
        "type",
        field("name", $.identifier),
        ":",
        $.identifier,
        optional(
          prec.left(
            seq(
              "=",
              choice(
                $.associated_effect_ref,
                binary($, "+", $.associated_effect_ref),
              ),
            ),
          ),
        ),
      ),

    trait_instance_decl: ($) =>
      moddedSeq(
        $,
        "instance",
        field("trait", $.qualified_name),
        brackets(field("for_type", choice($.qualified_name, $.applied_type))),
        optional(seq("with", $.applied_type)),
        braces(
          seq(
            optional(
              repeat(
                choice(
                  $.trait_associated_type_decl,
                  $.trait_associated_effect_decl,
                ),
              ),
            ),
            repeat($.def_decl),
          ),
        ),
      ),
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
        field("params", $._fn_parameters),
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
            braces(seq(repeat(seq($.expression, $._semi)), $.expression)),
            seq(repeat(seq($.expression, $._semi)), $.expression),
          ),
        ),
      ),
    // Use/Import (simplified)
    use_or_import: ($) =>
      seq(
        choice("use", "import"),
        $.qualified_name,
        optional(seq("as", $.identifier)),
        optional($._semi),
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
    // Expressions (baseline similar to Python precedence/calls/index/attr)
    expression: ($) =>
      choice(
        $.interpolated_string,
        $.literal,
        $.lambda,
        $.identifier,
        $.call_expression,
        $.pipeline_expression,
        $.eff_handle_block,
      ),

    pipeline_expression: ($) => prec.right(binary($, "|>", $.expression)),
    call_expression: ($) =>
      prec(
        1,
        seq(
          field("function", choice($.qualified_name, parens($.expression))),
          field("arguments", $.argument_list),
        ),
      ),
    lambda: ($) =>
      prec.right(
        seq(
          "lambda",
          optional($._fn_parameters),
          "=>",
          field("body", $.expression),
        ),
      ),
    argument_list: ($) =>
      parens(
        optional(
          commaSep1(
            choice(
              seq(optional(choice("*", "**")), $.expression),
              $.keyword_argument,
            ),
            undefined,
          ),
        ),
      ),
    keyword_argument: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),
    // Types (basic surface syntax)
    type: ($) =>
      choice(
        $.type_arrow,
        $.applied_type,
        $.qualified_name,
        $.type_tuple,
        $.type_group,
        $.type_record,
      ),
    // type application with one or more type arguments, e.g., List[Int], Map[String, Int]
    applied_type: ($) =>
      seq($.qualified_name, brackets(commaSep1($.type, undefined))),
    // Simple type name (possibly qualified), e.g., Int, String, MyModule.MyType
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

    _eff_ref: ($) => prec(1, choice($.qualified_name, $.associated_effect_ref)),
    eff_expr: ($) =>
      prec.left(
        choice(
          $._eff_ref,
          braces(commaSep1($._eff_ref, false)),
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
    doc_comment: (_) => token(seq("///", /.*/)),
    // Misc helpers
    _semi: (_) => ";",
    comment: (_) =>
      token(
        choice(seq("//", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
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
