const yapi = require('../yapi.js');

/**
 * All models inherit this base class and expose getSchema/getName for the
 * PostgreSQL JSONB model adapter.
 */
class baseModel {
  constructor() {
    this.schema = this.getSchema();
    this.name = this.getName();
    this.model = yapi.db(this.name, this.schema);
  }

  isNeedAutoIncrement() {
    return true;
  }

  getPrimaryKey() {
    return '_id';
  }

  getSchema() {
    yapi.commons.log('Model Class need getSchema function', 'error');
  }

  getName() {
    yapi.commons.log('Model Class need name', 'error');
  }
}

module.exports = baseModel;
