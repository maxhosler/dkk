const path = require('path');

module.exports = {
  entry: './js_src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dkk'),
  },
  mode: "development"
};