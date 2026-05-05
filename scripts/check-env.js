const childProcess = require('child_process');
const fs = require('fs');

const PSQL_FALLBACK = 'E:\\db\\postgresql\\postgresql-16.8-1\\bin\\psql.exe';

function run(command, args) {
  try {
    return childProcess.execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
}

function resolvePsql() {
  const fromPath = run('psql', ['--version']);
  if (fromPath) {
    return fromPath;
  }
  if (fs.existsSync(PSQL_FALLBACK)) {
    const fallbackVersion = run(PSQL_FALLBACK, ['--version']);
    if (fallbackVersion) {
      return fallbackVersion;
    }
    const version = PSQL_FALLBACK.match(/postgresql-([0-9.]+)/);
    if (version) {
      return 'psql (PostgreSQL) ' + version[1] + ' (fallback path)';
    }
  }
  return null;
}

function resolveNpm() {
  const userAgent = process.env.npm_config_user_agent || '';
  const match = userAgent.match(/npm\/([^\s]+)/);
  if (match) {
    return match[1];
  }
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v']);
}

const nodeVersion = process.version;
const npmVersion = resolveNpm();
const psqlVersion = resolvePsql();

console.log('node:', nodeVersion);
console.log('npm:', npmVersion || 'not found');
console.log('psql:', psqlVersion || 'not found');

if (!/^v12\.22\./.test(nodeVersion)) {
  console.error('Expected Node v12.22.x');
  process.exitCode = 1;
}

if (!npmVersion || !/^6\./.test(npmVersion)) {
  console.error('Expected npm 6.x');
  process.exitCode = 1;
}

if (!psqlVersion || psqlVersion.indexOf('16.8') === -1) {
  console.error('Expected PostgreSQL psql 16.8');
  process.exitCode = 1;
}
