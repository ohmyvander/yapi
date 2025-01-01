const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const AssetsWebpackPlugin = require('assets-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');
const commonLib = require('./common/plugin.js');
const packageJson = require('./package.json');
const yapi = require('./server/yapi');

const assetsPluginInstance = new AssetsWebpackPlugin({
  filename: 'static/prd/assets.json',
  processOutput: function(assets) {
    return 'window.WEBPACK_ASSETS = ' + JSON.stringify(assets);
  }
});
var compressPlugin = new CompressionWebpackPlugin({
  asset: '[path].gz[query]',
  algorithm: 'gzip',
  test: /\.(js|css)$/,
  threshold: 10240,
  minRatio: 0.8
});

function createScript(plugin, pathAlias) {
  let options = plugin.options ? JSON.stringify(plugin.options) : null;
  if (pathAlias === 'node_modules') {
    return `"${plugin.name}" : {module: require('yapi-plugin-${
      plugin.name
    }/client.js'),options: ${options}}`;
  }
  return `"${plugin.name}" : {module: require('${pathAlias}/yapi-plugin-${
    plugin.name
  }/client.js'),options: ${options}}`;
}

function initPlugins(configPlugin) {
  configPlugin = require('./config.json').plugins;
  var systemConfigPlugin = require('./common/config.js').exts;

  var scripts = [];
  if (configPlugin && Array.isArray(configPlugin) && configPlugin.length) {
    configPlugin = commonLib.initPlugins(configPlugin, 'plugin');
    configPlugin.forEach(plugin => {
      if (plugin.client && plugin.enable) {
        scripts.push(createScript(plugin, 'node_modules'));
      }
    });
  }

  systemConfigPlugin = commonLib.initPlugins(systemConfigPlugin, 'ext');
  systemConfigPlugin.forEach(plugin => {
    if (plugin.client && plugin.enable) {
      scripts.push(createScript(plugin, 'exts'));
    }
  });

  scripts = 'module.exports = {' + scripts.join(',') + '}';
  fs.writeFileSync('client/plugin-module.js', scripts);
}

initPlugins();

const webpackConfig = {
  mode: process.env.NODE_ENV,
  entry: path.resolve(__dirname, './client/index.js'),
  output: {
    path: path.resolve(__dirname, './static/prd'),
    publicPath: '',
    filename: 'app.js',
    // filename: '[name]@[chunkhash].js',
    clean: true
  },
  context: path.resolve(__dirname, './client'),
  devtool: 'cheap-module-source-map',
  resolve: {
    alias: {
      client: path.resolve(__dirname, './client'),
      common: path.resolve(__dirname, './common'),
      exts: path.resolve(__dirname, './exts')
    },
    // client 要用到的才加 require.resolve
    fallback: {
      child_process: false,
      constants: false,
      crypto: false,
      dns: false,
      fs: false,
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      net: false,
      path: false,
      stream: false,
      tls: false,
      vm: require.resolve('vm-browserify'),
      zlib: false
    }
  },
  module: {
    noParse: /node_modules\/jsondiffpatch\/public\/build\/.*js/,
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(tui-editor|node_modules\\(?!_?(yapi-plugin|json-schema-editor-visual)))/,
        use: [{
          loader: 'babel-loader',
          options: {
            sourceType: 'unambiguous',
            presets: ['@babel/preset-env', '@babel/preset-react'],
            plugins: [
              ["@babel/plugin-proposal-decorators", { legacy: true }],
              // 因为工程用了很多 commonjs 写法的库，所以要加这个插件，打包时把 es6 语法转为 commonjs
              // 上面 sourceType 加了感觉没什么用
              ['@babel/plugin-transform-modules-commonjs']
            ]
          }
        }]
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test: /\.less$/,
        use: ['style-loader', 'css-loader', 'less-loader']
      },
      {
        test: /\.(sass|scss)$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /.(gif|jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset',
        generator: {
          filename: '[path][name].[ext]?[sha256#base64:8]'
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.version': JSON.stringify(packageJson.version),
      'process.env.versionNotify': yapi.WEBCONFIG.versionNotify
    }),
    assetsPluginInstance,
    compressPlugin,
    new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(zh-cn|en-gb)$/)
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserWebpackPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false
          }
        }
      })
    ]
  }
};

if (process.env.NODE_ENV === 'development') {
  Object.assign(webpackConfig, {
    devtool: 'inline-source-map',
    devServer: {
      static: path.join(__dirname, './static'),
      hot: true,
      historyApiFallback: true,
      compress: true
    }
  })
}

module.exports = webpackConfig;
