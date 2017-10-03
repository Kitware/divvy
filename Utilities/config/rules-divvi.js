module.exports = [
  { test: /\.js$/,
    use: [
      { loader: 'babel-loader', options: { presets: ['es2015'] } },
    ],
  },
];
