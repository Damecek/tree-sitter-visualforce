import treesitter from 'eslint-config-treesitter';

export default [
  ...treesitter,
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
];
