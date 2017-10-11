module.exports = [
  { test: /\.js$/,
    use: [
      { loader: 'babel-loader', options: {
        presets: ['es2015'],
        // allows d3.js to set a global 'd3' variable.
        plugins: 'babel-plugin-transform-remove-strict-mode',
      } },
    ],
  },
];
