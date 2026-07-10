/**
 * @file Salesforce Visualforce grammar for Tree-sitter
 * @author Adam Stepanek <Damecek@users.noreply.github.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const HTML = require('tree-sitter-html/grammar');

const PREC = {
  OR: 1,
  AND: 2,
  EQUALITY: 3,
  COMPARISON: 4,
  CONCATENATION: 5,
  ADDITIVE: 6,
  MULTIPLICATIVE: 7,
  UNARY: 8,
  CALL: 9,
  MEMBER: 10,
  SUBSCRIPT: 10,
};

const binary = (precedence, operator) => ($) =>
  prec.left(
    precedence,
    seq(
      field('left', $._expression),
      field('operator', alias(operator, $.operator)),
      field('right', $._expression),
    ),
  );

module.exports = grammar(HTML, {
  name: 'visualforce',

  externals: ($, original) =>
    original.concat([
      $._expression_end,
      $._missing_expression_end,
      $._missing_subscript_end,
      $._missing_start_tag_end,
    ]),

  rules: {
    document: ($) => repeat(choice($.xml_declaration, $._node)),

    xml_declaration: ($) => seq('<?xml', repeat($.attribute), '?>'),

    _node: ($, original) => choice(prec(1, $.visualforce_expression), original),

    start_tag: ($) =>
      seq(
        '<',
        alias($._start_tag_name, $.tag_name),
        repeat($.attribute),
        choice('>', $._missing_start_tag_end),
      ),

    script_element: ($) =>
      seq(
        alias($.script_start_tag, $.start_tag),
        repeat(choice($.raw_text, $.visualforce_expression)),
        $.end_tag,
      ),

    style_element: ($) =>
      seq(
        alias($.style_start_tag, $.start_tag),
        repeat(choice($.raw_text, $.visualforce_expression)),
        $.end_tag,
      ),

    text: (_) => /[^<&{\s]([^<&{]*[^<&{\s])?/,

    attribute_value: ($) =>
      repeat1(
        choice(
          $.visualforce_expression,
          $.entity,
          alias(/[^<>"'={}&\/\s]+/, $.attribute_text),
          alias('/', $.attribute_text),
        ),
      ),

    quoted_attribute_value: ($) =>
      choice(
        seq(
          '\u0027',
          repeat(
            choice(
              $.visualforce_expression,
              $.entity,
              alias(token.immediate('{'), $.attribute_text),
              alias(token.immediate(/[^'{&]+/), $.attribute_text),
            ),
          ),
          '\u0027',
        ),
        seq(
          '"',
          repeat(
            choice(
              $.visualforce_expression,
              $.entity,
              alias(token.immediate('{'), $.attribute_text),
              alias(token.immediate(/[^"{&]+/), $.attribute_text),
            ),
          ),
          '"',
        ),
      ),

    // Visualforce expression language. This is intentionally independent of
    // Apex: it models useful syntax without asserting runtime semantics.
    visualforce_expression: ($) =>
      seq(
        alias('{!', $.expression_start),
        $._expression,
        choice(
          alias($._expression_end, $.expression_end),
          $._missing_expression_end,
        ),
      ),

    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.member_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        $.global_identifier,
        $.identifier,
        $.string_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_literal,
      ),

    binary_expression: ($) =>
      choice(
        binary(PREC.OR, choice('||', token(prec(1, /[Oo][Rr]/))))($),
        binary(PREC.AND, choice('&&', token(prec(1, /[Aa][Nn][Dd]/))))($),
        binary(PREC.EQUALITY, choice('=', '==', '!=', '<>'))($),
        binary(PREC.COMPARISON, choice('<', '<=', '>', '>='))($),
        binary(PREC.CONCATENATION, '&')($),
        binary(PREC.ADDITIVE, choice('+', '-'))($),
        binary(PREC.MULTIPLICATIVE, choice('*', '/'))($),
      ),

    unary_expression: ($) =>
      prec.right(
        PREC.UNARY,
        seq(
          field(
            'operator',
            alias(
              choice('!', '+', '-', token(prec(1, /[Nn][Oo][Tt]/))),
              $.operator,
            ),
          ),
          field('argument', $._expression),
        ),
      ),

    call_expression: ($) =>
      prec.left(
        PREC.CALL,
        seq(
          field(
            'function',
            choice($.identifier, $.member_expression, $.subscript_expression),
          ),
          field('arguments', $.argument_list),
        ),
      ),

    argument_list: ($) =>
      seq(
        '(',
        optional(seq($._expression, repeat(seq(',', $._expression)))),
        ')',
      ),

    member_expression: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field(
            'object',
            choice(
              $.global_identifier,
              $.identifier,
              $.call_expression,
              $.member_expression,
              $.subscript_expression,
              $.parenthesized_expression,
            ),
          ),
          '.',
          field('property', $.identifier),
        ),
      ),

    subscript_expression: ($) =>
      prec.left(
        PREC.SUBSCRIPT,
        seq(
          field(
            'object',
            choice(
              $.global_identifier,
              $.identifier,
              $.call_expression,
              $.member_expression,
              $.subscript_expression,
              $.parenthesized_expression,
            ),
          ),
          '[',
          optional(field('index', $._expression)),
          choice(']', $._missing_subscript_end),
        ),
      ),

    parenthesized_expression: ($) => seq('(', $._expression, ')'),

    global_identifier: (_) => /\$[A-Za-z_][A-Za-z0-9_]*/,

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    string_literal: (_) => token(choice(/'([^'\\]|\\.)*'/, /"([^"\\]|\\.)*"/)),

    number_literal: (_) => /[0-9]+(\.[0-9]+)?/,

    boolean_literal: (_) =>
      token(prec(2, choice(/[Tt][Rr][Uu][Ee]/, /[Ff][Aa][Ll][Ss][Ee]/))),

    null_literal: (_) => token(prec(2, /[Nn][Uu][Ll][Ll]/)),
  },
});
