const path = require('path');

const entry = path.join(__dirname, './Sources/index.js');
const outputPath = path.join(__dirname, './dist');

const divvyRules = require('./Utilities/config/rules-divvy.js');
const linterRules = require('./Utilities/config/rules-linter.js');

const pvwRules = require('./node_modules/paraviewweb/config/webpack.loaders.js');

const plugins = [];

module.exports = {
  plugins,
  entry,
  output: {
    path: outputPath,
    filename: 'divvy.js',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      { test: entry, loader: 'expose-loader?divvy' },
    ].concat(linterRules, divvyRules, pvwRules),
  },
  resolve: {
    alias: {
      divvy: __dirname,
      PVWStyle: path.resolve('./node_modules/paraviewweb/style'),
    },
  },
  devServer: {
    contentBase: outputPath,
    compress: true,
    port: 9000,
  },
};
