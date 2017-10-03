module.exports = {
  webpack: {
    v1: {
      loaders: [
        {
          test: /\.js$/,
          include: /node_modules(\/|\\)divvi(\/|\\)/,
          loader: 'babel-loader?presets[]=es2015',
        },
      ],
    },
    v2: {
      rules: [
        {
          test: /\.js$/,
          include: /node_modules(\/|\\)divvi(\/|\\)/,
          loader: 'babel-loader?presets[]=es2015',
        },
      ],
    },
  },
};
