const webpack = require('webpack');
const path = require('path');

const entry = path.join(__dirname, './Sources/index.js');
const sourcePath = path.join(__dirname, './Sources');
const outputPath = path.join(__dirname, './dist');

const divvyRules = require('./Utilities/config/rules-divvy.js');
const linterRules = require('./Utilities/config/rules-linter.js');

module.exports = {
  entry,
  output: {
    path: outputPath,
    filename: 'divvy.js',
  },
  module: {
    rules: [
      { test: entry, loader: 'expose-loader?divvy' },
    ].concat(linterRules, divvyRules),
  },
  resolve: {
    extensions: ['.webpack-loader.js', '.web-loader.js', '.loader.js', '.js', '.jsx'],
    modules: [
      path.resolve(__dirname, 'node_modules'),
      sourcePath,
    ],
    alias: {
      'divvy': __dirname,
    },
  },
};
