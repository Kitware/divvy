const webpack = require('webpack');
const path = require('path');

const entry = path.join(__dirname, './Sources/index.js');
const sourcePath = path.join(__dirname, './Sources');
const outputPath = path.join(__dirname, './dist');

const divviRules = require('./Utilities/config/rules-divvi.js');
const linterRules = require('./Utilities/config/rules-linter.js');

module.exports = {
  entry,
  output: {
    path: outputPath,
    filename: 'divvi.js',
  },
  module: {
    rules: [
      { test: entry, loader: 'expose-loader?divvi' },
    ].concat(linterRules, divviRules),
  },
  resolve: {
    extensions: ['.webpack-loader.js', '.web-loader.js', '.loader.js', '.js', '.jsx'],
    modules: [
      path.resolve(__dirname, 'node_modules'),
      sourcePath,
    ],
    alias: {
      'vtk.js': __dirname,
    },
  },
};
