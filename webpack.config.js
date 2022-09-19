const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'js/bundle.js',
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

