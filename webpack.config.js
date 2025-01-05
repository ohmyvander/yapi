const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');
// const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const commonLib = require('./common/plugin.js');
const packageJson = require('./package.json');
const yapi = require('./server/yapi');

function createScript(plugin, pathAlias) {
  let options = plugin.options ? JSON.stringify(plugin.options) : null;
  if (pathAlias === 'node_modules') {
    return `"${plugin.name}" : {module: require('yapi-plugin-${plugin.name}/client.js'),options: ${options}}`;
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
    configPlugin.forEach((plugin) => {
      if (plugin.client && plugin.enable) {
        scripts.push(createScript(plugin, 'node_modules'));
      }
    });
  }

  systemConfigPlugin = commonLib.initPlugins(systemConfigPlugin, 'ext');
  systemConfigPlugin.forEach((plugin) => {
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
    path: path.resolve(__dirname, './dist'),
    publicPath: '/',
    // filename: 'app.js',
    filename: '[name].[contenthash:8].js',
    clean: true,
  },
  // context: path.resolve(__dirname, './client'),
  resolve: {
    alias: {
      client: path.resolve(__dirname, './client'),
      common: path.resolve(__dirname, './common'),
      exts: path.resolve(__dirname, './exts'),
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
      zlib: false,
    },
  },
  module: {
    noParse: /node_modules\/jsondiffpatch\/public\/build\/.*js/,
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(tui-editor|node_modules\\(?!_?(yapi-plugin|json-schema-editor-visual)))/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              sourceType: 'unambiguous',
              presets: ['@babel/preset-env', '@babel/preset-react'],
              plugins: [
                ['@babel/plugin-proposal-decorators', { legacy: true }],
                // 因为工程用了很多 commonjs 写法的库，所以要加这个插件，打包时把 es6 语法转为 commonjs
                // 上面 sourceType 加了感觉没什么用
                ['@babel/plugin-transform-modules-commonjs'],
              ],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.less$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'less-loader'],
      },
      {
        test: /\.(sass|scss)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /.(gif|jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset',
        generator: {
          filename: '[path][name].[ext]?[sha256#base64:8]',
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.version': JSON.stringify(packageJson.version),
      'process.env.versionNotify': yapi.WEBCONFIG.versionNotify,
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash:8].css',
    }),
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: /\.(js|css)$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
    new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(zh-cn|en-gb)$/),
    new CopyWebpackPlugin({
      patterns: [{ context: 'static/', from: '**/*' }],
    }),
    new HtmlWebpackPlugin({
      template: './client/index.html',
      filename: 'index.html',
    }),
    // 查看打包各个模块大小
    // new BundleAnalyzerPlugin(),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserWebpackPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
      new CssMinimizerWebpackPlugin(),
    ],
    splitChunks: {
      // chunks、minSize、minChunks 将对所有缓存组生效
      chunks: 'all', // 对所有的chunk进行拆分
      minSize: 20000, // 拆分 chunk 的最小体积 20000 bytes
      minChunks: 2, // 需在两个模块中共享才进行拆分
      cacheGroups: {
        vendor: {
          name: 'vendor', // chunk 的名称 vendor
          test: /[\\/]node_modules[\\/]/i, // 匹配node_modules下所有的chunk
          priority: 10, // 优先级10 优先将node_modules下的chunk拆分到vendor组
          reuseExistingChunk: true, // 重用模块，而不是重新生成
          enforce: true, // 强制拆分
        },
        default: {
          // 默认组 非node_modules下的文件块 将执行default缓存组规则
          reuseExistingChunk: true,
          priority: -10, // 优先级 -10
          enforce: true, // 强制拆分
        },
        react: {
          // react组
          name: 'react',
          test: /[\\/]node_modules[\\/]react[\\/]/, // 匹配node_modules下的react库
          priority: 20, // 优先级20 优先将node_modules下的react拆分出去
          minChunks: 2,
          reuseExistingChunk: true,
        },
        antd: {
          // antd组
          name: 'antd',
          test: /[\\/]node_modules[\\/]antd[\\/]/, // 匹配node_modules下的antd库
          priority: 20, // 优先级20 优先将node_modules下的antd拆分出去
          minChunks: 2,
          reuseExistingChunk: true, // 重用模块，而不是重新生成
        },
      },
    },
  },
};

if (process.env.NODE_ENV === 'development') {
  Object.assign(webpackConfig, {
    devtool: 'inline-source-map',
    devServer: {
      static: [path.join(__dirname, './dist')],
      hot: true,
      historyApiFallback: true,
      compress: true,
      proxy: [
        {
          context: ['/api'],
          target: 'http://127.0.0.1:3000',
        },
      ],
    },
  });
}

// module.exports = webpackConfig;

// 打包耗时分析，与 MiniCssExtractPlugin 冲突，必须使用如下写法才能解决
// 参考 https://github.com/stephencookdev/speed-measure-webpack-plugin/issues/167#issuecomment-1318684127
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const speedMeasurePlugin = new SpeedMeasurePlugin();
const cssPluginIndex = webpackConfig.plugins.findIndex((e) => e.constructor.name === 'MiniCssExtractPlugin');
const cssPlugin = webpackConfig.plugins[cssPluginIndex];
const configToExport = speedMeasurePlugin.wrap(webpackConfig);
configToExport.plugins[cssPluginIndex] = cssPlugin;
module.exports = configToExport;
