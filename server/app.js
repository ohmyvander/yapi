process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const yapi = require('./yapi.js');
const commons = require('./utils/commons');
const dbModule = require('./utils/db.js');
const websockify = require('koa-websocket');
const Koa = require('koa');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) {
    return;
  }

  yapi.commons = commons;
  yapi.connect = dbModule.connect();
  global.storageCreator = require('./utils/storage');
  require('./plugin.js');
  require('./utils/notice');
  bootstrapped = true;
}

function createApp(options) {
  options = options || {};
  bootstrap();

  const mockServer = require('./middleware/mockServer.js');
  const router = require('./router.js');
  const websocket = require('./websocket.js');
  const indexFile = options.mode === 'dev' ? 'dev.html' : 'index.html';
  const app = websockify(new Koa());

  app.proxy = true;
  yapi.app = app;

  app.use(
    koaBody({
      strict: false,
      multipart: true,
      jsonLimit: '2mb',
      formLimit: '1mb',
      textLimit: '1mb'
    })
  );
  app.use(mockServer);
  app.use(router.routes());
  app.use(router.allowedMethods());

  websocket(app);

  app.use(async (ctx, next) => {
    if (/^\/(?!api)[a-zA-Z0-9\/\-_]*$/.test(ctx.path)) {
      ctx.path = '/';
    }
    await next();
  });

  app.use(async (ctx, next) => {
    if (ctx.path.indexOf('/prd') === 0) {
      ctx.set('Cache-Control', 'max-age=8640000000');
      if (yapi.commons.fileExist(yapi.path.join(yapi.WEBROOT, 'static', ctx.path + '.gz'))) {
        ctx.set('Content-Encoding', 'gzip');
        ctx.path = ctx.path + '.gz';
      }
    }
    await next();
  });

  app.use(koaStatic(yapi.path.join(yapi.WEBROOT, 'static'), { index: indexFile, gzip: true }));
  return app;
}

function start() {
  const app = createApp({ mode: process.argv[2] });
  const server = app.listen(yapi.WEBCONFIG.port);

  server.setTimeout(yapi.WEBCONFIG.timeout);

  commons.log(
    `服务已启动，请打开下面链接访问: \nhttp://127.0.0.1${
      yapi.WEBCONFIG.port == '80' ? '' : ':' + yapi.WEBCONFIG.port
    }/`
  );

  return server;
}

if (require.main === module) {
  start();
}

module.exports = {
  createApp,
  start
};
