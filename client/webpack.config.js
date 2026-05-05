const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

const clientDir = __dirname;
const rootDir = path.resolve(clientDir, '..');
const packageInfo = require(path.join(rootDir, 'package.json'));
const configPath = path.resolve(rootDir, '..', 'config.json');
const fallbackConfigPath = path.resolve(rootDir, 'config_example.json');
const webConfig = fs.existsSync(configPath) ? require(configPath) : require(fallbackConfigPath);
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

const clientPackageAliasNames = [
  '@babel/runtime',
  'ajv',
  'ajv-i18n',
  'antd',
  'axios',
  'brace',
  'buffer',
  'compare-versions',
  'copy-to-clipboard',
  'core-decorators',
  'crypto-js',
  'generate-schema',
  'immer',
  'js-base64',
  'json5',
  'jsondiffpatch',
  'jsrsasign',
  'md5',
  'mockjs',
  'moment',
  'prop-types',
  'qs',
  'react',
  'react-dnd',
  'react-dnd-html5-backend',
  'react-dom',
  'react-redux',
  'react-router',
  'react-router-dom',
  'reactabular-dnd',
  'reactabular-table',
  'recharts',
  'redux',
  'redux-devtools',
  'redux-devtools-dock-monitor',
  'redux-devtools-log-monitor',
  'redux-promise',
  'sha.js',
  'swagger-client',
  'table-resolver',
  'underscore',
  'yapi-plugin-qsso'
];

function createClientPackageAliases() {
  return clientPackageAliasNames.reduce((aliases, packageName) => {
    aliases[packageName] = path.resolve(clientDir, 'node_modules', ...packageName.split('/'));
    return aliases;
  }, {});
}

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
    context: clientDir,
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
      alias: Object.assign(createClientPackageAliases(), {
        client: clientDir,
        common: path.resolve(rootDir, 'common'),
        exts: path.resolve(rootDir, 'exts'),
        'json-schema-editor-visual$': path.resolve(
          clientDir,
          'node_modules',
          'json-schema-editor-visual',
          'dist',
          'main.js'
        )
      }),
      modules: ['node_modules', clientDir, path.resolve(rootDir), path.resolve(clientDir, 'node_modules')],
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
              ? /node_modules\\(?!_?yapi-plugin)/
              : /node_modules\/(?!_?yapi-plugin)/;
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
        'process.env.versionNotify': JSON.stringify(webConfig.versionNotify)
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
