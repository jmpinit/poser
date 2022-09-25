const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/opencv-test.js',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'js/bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.frag/,
        type: 'asset/source',
      },
      {
        test: /\.vert/,
        type: 'asset/source',
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "static", to: "" },
        { from: "third-party", to: "js" },
      ],
    }),
  ],
};

