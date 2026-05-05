const fs = require('fs-extra');
const yapi = require('./yapi.js');
const commons = require('./utils/commons');
const dbModule = require('./utils/db.js');
const userModel = require('./models/user.js');

yapi.commons = commons;

async function install() {
  const lockPath = yapi.path.join(yapi.WEBROOT_RUNTIME, 'init.lock');
  const exist = yapi.commons.fileExist(lockPath);

  if (exist) {
    throw new Error('init.lock文件已存在，请确认您是否已安装。如果需要重新安装，请删掉init.lock文件');
  }

  yapi.connect = dbModule.connect();
  await yapi.connect;
  await dbModule.initSchema();
  await setupAdmin(lockPath);
}

async function setupAdmin(lockPath) {
  const userInst = yapi.getInst(userModel);
  const passsalt = yapi.commons.randStr();
  const email = yapi.WEBCONFIG.adminAccount;
  const username = email.substr(0, email.indexOf('@'));

  await userInst.save({
    username,
    email,
    password: yapi.commons.generatePassword('ymfe.org', passsalt),
    passsalt,
    role: 'admin',
    add_time: yapi.commons.time(),
    up_time: yapi.commons.time()
  });

  fs.ensureFileSync(lockPath);
  console.log(`初始化管理员账号成功,账号名："${email}"，密码："ymfe.org"`); // eslint-disable-line
}

install()
  .then(function() {
    process.exit(0);
  })
  .catch(function(err) {
    console.error(err.message); // eslint-disable-line
    process.exit(1);
  });
