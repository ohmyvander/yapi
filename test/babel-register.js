require('@babel/register')({
  extensions: ['.js', '.jsx'],
  presets: [
    [
      '@babel/preset-env',
      {
        loose: true,
        modules: 'commonjs',
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
    [
      'module-resolver',
      {
        alias: {
          client: './client',
          common: './common',
          exts: './exts',
          models: './server/models',
          utils: './server/utils',
          'yapi.js': './server/yapi.js'
        }
      }
    ]
  ]
});
