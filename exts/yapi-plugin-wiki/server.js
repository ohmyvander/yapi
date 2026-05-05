const yapi = require('yapi.js');
const controller = require('./controller');

module.exports = function() {
  this.bindHook('add_router', function(addRouter) {
    addRouter({
      // 获取wiki信息
      controller: controller,
      method: 'get',
      path: 'wiki_desc/get',
      action: 'getWikiDesc'
    });

    addRouter({
      // 更新wiki信息
      controller: controller,
      method: 'post',
      path: 'wiki_desc/up',
      action: 'uplodaWikiDesc'
    });
  });

  this.bindHook('add_ws_router', function(wsRouter) {
    wsRouter({
      controller: controller,
      method: 'get',
      path: 'wiki_desc/solve_conflict',
      action: 'wikiConflict'
    });
  });
};
