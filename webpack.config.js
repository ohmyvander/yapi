const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const packageInfo = require('./package.json');
const yapi = require('./server/yapi');

const rootDir = __dirname;
const isWin = require('os').platform() === 'win32';

class WebpackAssetsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('WebpackAssetsPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'WebpackAssetsPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
        },
        () => {
          const stats = compilation.getStats().toJson({ assetsByChunkName: true });
          const assets = {};

          Object.keys(stats.assetsByChunkName || {}).forEach(chunkName => {
            const key = chunkName === 'index' ? 'index.js' : chunkName;
            const chunkAssets = [].concat(stats.assetsByChunkName[chunkName] || []);
            assets[key] = {};
            chunkAssets.forEach(assetName => {
              if (/\.js$/.test(assetName)) {
                assets[key].js = assetName;
              }
              if (/\.css$/.test(assetName)) {
                assets[key].css = assetName;
              }
            });
          });

          compilation.emitAsset(
            'assets.js',
            new webpack.sources.RawSource(
              'window.WEBPACK_ASSETS = ' + JSON.stringify(assets) + ';'
            )
          );
        }
      );
    });
  }
}

const vendorGroups = {
  lib: [
    'react',
    'react-dom',
    'redux',
    'redux-promise',
    'react-router',
    'react-router-dom',
    'prop-types',
    'react-dnd-html5-backend',
    'react-dnd',
    'reactabular-table',
    'reactabular-dnd',
    'table-resolver'
  ],
  lib2: ['brace', 'json5', 'url', 'axios'],
  lib3: ['mockjs', 'moment', 'recharts']
};

function moduleMatchesPackages(module, packages) {
  const resource = module.nameForCondition && module.nameForCondition();
  if (!resource || resource.indexOf('node_modules') === -1) {
    return false;
  }
  return packages.some(pkg => {
    const normalized = pkg.replace('/', '[\\\\/]');
    return new RegExp('[\\\\/]node_modules[\\\\/]_?' + normalized + '[\\\\/]').test(resource);
  });
}

function createStyleLoaders(extraLoader, sourceMap) {
  const loaders = [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { sourceMap } }];
  if (extraLoader) {
    loaders.push(extraLoader);
  }
  return loaders;
}

const babelOptions = {
  babelrc: false,
  configFile: false,
  presets: [
    [
      '@babel/preset-env',
      {
        loose: true,
        modules: false,
        targets: {
          node: '12.22'
        }
      }
    ],
    '@babel/preset-react'
  ],
  plugins: [
    [
      '@babel/plugin-proposal-decorators',
      {
        legacy: true
      }
    ],
    [
      '@babel/plugin-proposal-class-properties',
      {
        loose: true
      }
    ],
    '@babel/plugin-proposal-object-rest-spread',
    [
      '@babel/plugin-transform-runtime',
      {
        regenerator: true
      }
    ],
    ['babel-plugin-import', { libraryName: 'antd' }]
  ]
};

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  const filename = isProd ? '[name]@[contenthash:12].js' : '[name]@dev.js';
  const cssFilename = isProd ? '[name]@[contenthash:12].css' : '[name]@dev.css';

  return {
    context: path.resolve(rootDir, 'client'),
    entry: {
      index: './index.js'
    },
    output: {
      path: path.resolve(rootDir, 'static', 'prd'),
      publicPath: '/prd/',
      filename,
      chunkFilename: filename,
      clean: isProd
    },
    devtool: isProd ? false : 'cheap-module-source-map',
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        client: path.resolve(rootDir, 'client'),
        common: path.resolve(rootDir, 'common'),
        exts: path.resolve(rootDir, 'exts')
      },
      modules: [path.resolve(rootDir, 'client'), path.resolve(rootDir), 'node_modules'],
      fallback: {
        assert: false,
        child_process: false,
        crypto: false,
        fs: false,
        https: false,
        net: false,
        path: false,
        stream: false,
        tls: false,
        util: false,
        vm: false
      }
    },
    module: {
      noParse: /node_modules[\\/]jsondiffpatch[\\/]public[\\/]build[\\/].*js/,
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: modulePath => {
            const pluginAllowList = isWin
              ? /node_modules\\(?!_?(yapi-plugin|json-schema-editor-visual))/
              : /node_modules\/(?!_?(yapi-plugin|json-schema-editor-visual))/;
            return /tui-editor|google-diff\.js/.test(modulePath) || pluginAllowList.test(modulePath);
          },
          use: {
            loader: 'babel-loader',
            options: babelOptions
          }
        },
        {
          test: /\.css$/,
          use: createStyleLoaders(null, !isProd)
        },
        {
          test: /\.less$/,
          use: createStyleLoaders({
            loader: 'less-loader',
            options: { sourceMap: !isProd, lessOptions: { javascriptEnabled: true } }
          }, !isProd)
        },
        {
          test: /\.(sass|scss)$/,
          use: createStyleLoaders({ loader: 'sass-loader', options: { sourceMap: !isProd } }, !isProd)
        },
        {
          test: /\.(gif|jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 32768
            }
          },
          generator: {
            filename: 'assets/[name]@[hash:8][ext]'
          }
        }
      ]
    },
    optimization: {
      runtimeChunk: {
        name: 'manifest'
      },
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          lib: {
            name: 'lib',
            test: module => moduleMatchesPackages(module, vendorGroups.lib),
            priority: 30,
            enforce: true
          },
          lib2: {
            name: 'lib2',
            test: module => moduleMatchesPackages(module, vendorGroups.lib2),
            priority: 20,
            enforce: true
          },
          lib3: {
            name: 'lib3',
            test: module => moduleMatchesPackages(module, vendorGroups.lib3),
            priority: 10,
            enforce: true
          },
          default: false,
          defaultVendors: false
        }
      }
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'dev'),
        'process.env.version': JSON.stringify(packageInfo.version),
        'process.env.versionNotify': JSON.stringify(yapi.WEBCONFIG.versionNotify)
      }),
      new MiniCssExtractPlugin({
        filename: cssFilename,
        chunkFilename: cssFilename
      }),
      new webpack.ContextReplacementPlugin(/moment[\\/]locale$/, /^\.\/(zh-cn|en-gb)$/),
      new WebpackAssetsPlugin()
    ].concat(
      isProd
        ? [
            new CompressionPlugin({
              algorithm: 'gzip',
              test: /\.(js|css)$/,
              threshold: 10240,
              minRatio: 0.8
            })
          ]
        : []
    ),
    devServer: {
      host: '127.0.0.1',
      port: 4000,
      hot: true,
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      static: {
        directory: path.resolve(rootDir, 'static'),
        publicPath: '/'
      },
      devMiddleware: {
        publicPath: '/prd/'
      }
    },
    performance: false
  };
};
