const divvyRules = require('../Utilities/config/rules-divvy.js');
const linterRules = require('../Utilities/config/rules-linter.js');
const examplesRules = require('../Utilities/config/rules-examples.js');

const path = require('path');

module.exports = {
  baseUrl: '/divvy',
  work: './build-tmp',
  config: {
    title: 'Divvy',
    description: '"Analyse your data live in the Web"',
    subtitle: '"Explore relationship between your variables"',
    author: 'Kitware Inc.',
    timezone: 'UTC',
    url: 'https://kitware.github.io/divvy',
    root: '/divvy/',
    github: 'kitware/divvy',
  },
  webpack: {
    module: {
      rules: [].concat(linterRules, divvyRules, examplesRules),
    },
    resolve: {
      alias: {
        'pvw-divvy': path.resolve('.'),
      },
    },
  },
  copy: [
    { src: '../Data/*', dest: './build-tmp/public/data' },
  ],
};
