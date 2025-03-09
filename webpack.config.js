const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './js_src/index.js',
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dkk'),
        clean: true
    },
    plugins: [
      	new HtmlWebpackPlugin({
    		title: 'DKK Viewer',
    		template: 'page/dkk.html'
    	})
    ],
    module: {
		rules: [
		  {
			test: /\.css$/i,
			use: ['style-loader', 'css-loader'],
		  },
		],
	},
    mode: "development"
};