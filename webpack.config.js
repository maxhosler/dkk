const path = require('path');

module.exports = {
    entry: './js_src/index.js',
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dkk'),
        clean: true
    },
    mode: "development"
};