const fs = require('fs');
const path = require('path');
const commonLib = require('../common/plugin.js');

const rootDir = path.resolve(__dirname, '..');
const clientModulePath = path.join(rootDir, 'client', 'plugin-module.js');
const configPath = path.resolve(rootDir, '..', 'config.json');
const systemConfigPlugin = require('../common/config.js').exts;

function readProjectConfig() {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  delete require.cache[require.resolve(configPath)];
  return require(configPath);
}

function createScript(plugin, pathAlias) {
  const options = plugin.options ? JSON.stringify(plugin.options) : null;
  if (pathAlias === 'node_modules') {
    return `"${plugin.name}" : {module: require('yapi-plugin-${plugin.name}/client.js'),options: ${options}}`;
  }
  return `"${plugin.name}" : {module: require('${pathAlias}/yapi-plugin-${plugin.name}/client.js'),options: ${options}}`;
}

function collectPlugins(configPlugin) {
  const scripts = [];

  if (configPlugin && Array.isArray(configPlugin) && configPlugin.length) {
    commonLib.initPlugins(configPlugin, 'plugin').forEach(plugin => {
      if (plugin.client && plugin.enable) {
        scripts.push(createScript(plugin, 'node_modules'));
      }
    });
  }

  commonLib.initPlugins(systemConfigPlugin, 'ext').forEach(plugin => {
    if (plugin.client && plugin.enable) {
      scripts.push(createScript(plugin, 'exts'));
    }
  });

  return scripts;
}

function main() {
  const config = readProjectConfig();
  const scripts = collectPlugins(config.plugins);
  const content = 'module.exports = {' + scripts.join(',') + '};\n';
  fs.writeFileSync(clientModulePath, content);
}

main();
