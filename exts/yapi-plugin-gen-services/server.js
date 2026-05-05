const controller = require('./controller');

// const _ = require('underscore');

module.exports = function(){
  this.bindHook('add_router', function(addRouter){
    // @feat: serives 
    addRouter({
      controller: controller,
      method: 'get',
      prefix: '/open',
      path: 'export-full',
      action: 'exportFullData'
    });
  })

}
