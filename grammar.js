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
};

const binary = (precedence, operator) => $ =>
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

  rules: {
    document: $ => repeat(choice($.xml_declaration, $._node)),

    xml_declaration: $ => seq('<?xml', repeat($.attribute), '?>'),

    _node: ($, original) => choice(prec(1, $.visualforce_expression), original),

    text: _ => /[^<>&{\s]([^<>&{]*[^<>&{\s])?/,

    attribute_value: $ =>
      repeat1(
        choice(
          $.visualforce_expression,
          $.entity,
          alias(/[^<>"'={}&\/\s]+/, $.attribute_text),
          alias('/', $.attribute_text),
        ),
      ),

    quoted_attribute_value: $ =>
      choice(
        seq(
          "'",
          repeat(
            choice(
              $.visualforce_expression,
              $.entity,
              alias(token.immediate(/[^'{&]+/), $.attribute_text),
            ),
          ),
          "'",
        ),
        seq(
          '"',
          repeat(
            choice(
              $.visualforce_expression,
              $.entity,
              alias(token.immediate(/[^"{&]+/), $.attribute_text),
            ),
          ),
          '"',
        ),
      ),

    // Visualforce expression language. This is intentionally independent of
    // Apex: it models useful syntax without asserting runtime semantics.
    visualforce_expression: $ =>
      seq(
        alias('{!', $.expression_start),
        $._expression,
        alias('}', $.expression_end),
      ),

    _expression: $ =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.member_expression,
        $.parenthesized_expression,
        $.global_identifier,
        $.identifier,
        $.string_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_literal,
      ),

    binary_expression: $ =>
      choice(
        binary(PREC.OR, choice('||', token(prec(1, /[Oo][Rr]/))))($),
        binary(PREC.AND, choice('&&', token(prec(1, /[Aa][Nn][Dd]/))))($),
        binary(PREC.EQUALITY, choice('=', '==', '!=', '<>'))($),
        binary(PREC.COMPARISON, choice('<', '<=', '>', '>='))($),
        binary(PREC.CONCATENATION, '&')($),
        binary(PREC.ADDITIVE, choice('+', '-'))($),
        binary(PREC.MULTIPLICATIVE, choice('*', '/'))($),
      ),

    unary_expression: $ =>
      prec.right(
        PREC.UNARY,
        seq(
          field(
            'operator',
            alias(choice('!', '+', '-', token(prec(1, /[Nn][Oo][Tt]/))), $.operator),
          ),
          field('argument', $._expression),
        ),
      ),

    call_expression: $ =>
      prec.left(
        PREC.CALL,
        seq(
          field('function', choice($.identifier, $.member_expression)),
          field('arguments', $.argument_list),
        ),
      ),

    argument_list: $ =>
      seq(
        '(',
        optional(seq($._expression, repeat(seq(',', $._expression)))),
        ')',
      ),

    member_expression: $ =>
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
              $.parenthesized_expression,
            ),
          ),
          '.',
          field('property', $.identifier),
        ),
      ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    global_identifier: _ => /\$[A-Za-z_][A-Za-z0-9_]*/,

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    string_literal: _ =>
      token(choice(/'([^'\\]|\\.)*'/, /"([^"\\]|\\.)*"/)),

    number_literal: _ => /[0-9]+(\.[0-9]+)?/,

    boolean_literal: _ =>
      token(prec(2, choice(/[Tt][Rr][Uu][Ee]/, /[Ff][Aa][Ll][Ss][Ee]/))),

    null_literal: _ => token(prec(2, /[Nn][Uu][Ll][Ll]/)),
  },
});
