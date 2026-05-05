const fs = require('fs-extra');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'static', 'iconfont');
const target = path.join(rootDir, 'iconfont');

fs.copySync(source, target);
