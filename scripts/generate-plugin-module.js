const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const clientModulePath = path.join(rootDir, 'client', 'plugin-module.js');
const clientNodeModulesPath = path.join(rootDir, 'client', 'node_modules');
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

function getPluginConfig(name, type) {
  const pluginPath =
    type === 'ext'
      ? path.join(rootDir, 'exts', 'yapi-plugin-' + name)
      : path.join(clientNodeModulesPath, 'yapi-plugin-' + name);
  const pluginConfig = require(pluginPath);

  if (!pluginConfig || typeof pluginConfig !== 'object') {
    throw new Error(`Plugin ${name} Config 配置错误，请检查 yapi-plugin-${name}/index.js`);
  }

  return {
    server: pluginConfig.server,
    client: pluginConfig.client
  };
}

function initPlugins(plugins, type) {
  if (!plugins) {
    return [];
  }
  if (typeof plugins !== 'object' || !Array.isArray(plugins)) {
    throw new Error('插件配置有误，请检查', plugins);
  }

  const names = {};
  return plugins
    .map(item => {
      if (item && typeof item === 'string') {
        return Object.assign({}, getPluginConfig(item, type), { name: item, enable: true });
      }
      if (item && typeof item === 'object') {
        return Object.assign({}, getPluginConfig(item.name, type), {
          name: item.name,
          options: item.options,
          enable: item.enable === false ? false : true
        });
      }
      return null;
    })
    .filter(item => item && item.enable === true && (item.server || item.client))
    .filter(item => {
      if (names[item.name]) {
        return false;
      }
      names[item.name] = true;
      return true;
    });
}

function collectPlugins(configPlugin) {
  const scripts = [];

  if (configPlugin && Array.isArray(configPlugin) && configPlugin.length) {
    initPlugins(configPlugin, 'plugin').forEach(plugin => {
      if (plugin.client && plugin.enable) {
        scripts.push(createScript(plugin, 'node_modules'));
      }
    });
  }

  initPlugins(systemConfigPlugin, 'ext').forEach(plugin => {
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
