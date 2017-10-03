const divviRules = require('../Utilities/config/rules-divvi.js');
const linterRules = require('../Utilities/config/rules-linter.js');
const examplesRules = require('../Utilities/config/rules-examples.js');

const path = require('path');

module.exports = {
  baseUrl: '/divvi',
  work: './build-tmp',
  config: {
    title: 'Divvi',
    description: '"Analyse your data live in the Web"',
    subtitle: '"Explore relationship between your variables"',
    author: 'Kitware Inc.',
    timezone: 'UTC',
    url: 'https://kitware.github.io/divvi',
    root: '/divvi/',
    github: 'kitware/divvi',
  },
  webpack: {
    module: {
      rules: [].concat(linterRules, divviRules, examplesRules),
    },
    resolve: {
      alias: {
        'pvw-divvi': path.resolve('.'),
      },
    },
  },
  copy: [
    { src: '../Data/*', dest: './build-tmp/public/data' },
  ],
};
