function clone(value) {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isOperatorObject(value) {
  return (
    isPlainObject(value) &&
    Object.keys(value).some(function(key) {
      return key.charAt(0) === '$';
    })
  );
}

function isNumericLike(value) {
  if (typeof value === 'number') {
    return true;
  }
  return typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value);
}

function comparable(value) {
  if (isNumericLike(value)) {
    return Number(value);
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

function valuesEqual(left, right) {
  const a = comparable(left);
  const b = comparable(right);
  if (a === b) {
    return true;
  }
  if (isPlainObject(a) || Array.isArray(a) || isPlainObject(b) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function flatten(values) {
  return values.reduce(function(result, value) {
    if (Array.isArray(value)) {
      return result.concat(value);
    }
    result.push(value);
    return result;
  }, []);
}

function getPathValues(value, pathParts) {
  if (pathParts.length === 0) {
    return [value];
  }
  if (value === undefined || value === null) {
    return [undefined];
  }
  if (Array.isArray(value)) {
    return value.reduce(function(result, item) {
      return result.concat(getPathValues(item, pathParts));
    }, []);
  }
  const part = pathParts[0];
  return getPathValues(value[part], pathParts.slice(1));
}

function setPathValue(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cursor[parts[i]])) {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function matchesOperator(values, operator, expected) {
  const actualValues = flatten(values);
  if (operator === '$in') {
    const expectedValues = Array.isArray(expected) ? expected : [expected];
    return actualValues.some(function(actual) {
      return expectedValues.some(function(item) {
        return valuesEqual(actual, item);
      });
    });
  }

  if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
    return actualValues.some(function(actual) {
      const left = comparable(actual);
      const right = comparable(expected);
      if (operator === '$gt') return left > right;
      if (operator === '$gte') return left >= right;
      if (operator === '$lt') return left < right;
      return left <= right;
    });
  }

  if (operator === '$ne') {
    return !actualValues.some(function(actual) {
      return valuesEqual(actual, expected);
    });
  }

  return false;
}

function matchesField(doc, field, expected) {
  const values = getPathValues(doc, field.split('.'));

  if (expected instanceof RegExp) {
    return flatten(values).some(function(value) {
      return expected.test(String(value || ''));
    });
  }

  if (isOperatorObject(expected)) {
    return Object.keys(expected).every(function(operator) {
      return matchesOperator(values, operator, expected[operator]);
    });
  }

  return flatten(values).some(function(value) {
    return valuesEqual(value, expected);
  });
}

function matchesQuery(doc, query) {
  query = query || {};
  return Object.keys(query).every(function(field) {
    if (field === '$or') {
      return (query[field] || []).some(function(part) {
        return matchesQuery(doc, part);
      });
    }
    return matchesField(doc, field, query[field]);
  });
}

function getSortValue(doc, field) {
  const values = flatten(getPathValues(doc, field.split('.')));
  return values.length ? comparable(values[0]) : undefined;
}

function sortRows(rows, sortSpec) {
  if (!sortSpec) {
    return rows;
  }
  const fields = Object.keys(sortSpec);
  return rows.sort(function(left, right) {
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const direction = Number(sortSpec[field]) < 0 ? -1 : 1;
      const a = getSortValue(left, field);
      const b = getSortValue(right, field);
      if (a === b) continue;
      if (a === undefined || a === null) return 1;
      if (b === undefined || b === null) return -1;
      return a > b ? direction : -direction;
    }
    return 0;
  });
}

function parseSelect(select) {
  if (!select) {
    return null;
  }

  if (typeof select === 'string') {
    const fields = select
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    return { mode: 'include', fields };
  }

  if (isPlainObject(select)) {
    const keys = Object.keys(select);
    const include = keys.filter(function(key) {
      return select[key];
    });
    if (include.length) {
      return { mode: 'include', fields: include };
    }
    return { mode: 'exclude', fields: keys };
  }

  return null;
}

function applyProjection(doc, select) {
  const projection = parseSelect(select);
  if (!projection) {
    return doc;
  }

  if (projection.mode === 'include') {
    const next = {};
    if (projection.fields.indexOf('_id') === -1 && doc._id !== undefined) {
      next._id = doc._id;
    }
    projection.fields.forEach(function(field) {
      const values = getPathValues(doc, field.split('.'));
      if (values.length && values[0] !== undefined) {
        setPathValue(next, field, clone(values[0]));
      }
    });
    return next;
  }

  const next = clone(doc);
  projection.fields.forEach(function(field) {
    delete next[field];
  });
  return next;
}

function schemaDefaults(schema) {
  const defaults = {};
  Object.keys(schema || {}).forEach(function(field) {
    const value = schema[field];
    if (Array.isArray(value)) {
      defaults[field] = [];
      return;
    }
    if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'default')) {
      defaults[field] = typeof value.default === 'function' ? value.default() : clone(value.default);
      return;
    }
    if (isPlainObject(value) && !value.type) {
      const nested = schemaDefaults(value);
      if (Object.keys(nested).length) {
        defaults[field] = nested;
      }
    }
  });
  return defaults;
}

function applyDefaults(defaults, data) {
  return Object.assign({}, clone(defaults) || {}, clone(data) || {});
}

class Query {
  constructor(modelApi, criteria, projection, single) {
    this.modelApi = modelApi;
    this.criteria = criteria || {};
    this.projection = projection || null;
    this.single = single;
    this.sortSpec = null;
    this.skipCount = 0;
    this.limitCount = 0;
  }

  select(projection) {
    this.projection = projection;
    return this;
  }

  sort(sortSpec) {
    this.sortSpec = sortSpec;
    return this;
  }

  skip(count) {
    this.skipCount = Number(count) || 0;
    return this;
  }

  limit(count) {
    this.limitCount = Number(count) || 0;
    return this;
  }

  async exec() {
    let rows = await this.modelApi.fetchAll();
    rows = rows.filter(row => matchesQuery(row.toObject(), this.criteria));
    rows = sortRows(rows, this.sortSpec);

    if (this.skipCount) {
      rows = rows.slice(this.skipCount);
    }
    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    rows = rows.map(row =>
      this.modelApi.wrap(applyProjection(row.toObject(), this.projection), {
        applyDefaults: false
      })
    );
    return this.single ? rows[0] || null : rows;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

class Aggregate {
  constructor(modelApi, pipeline) {
    this.modelApi = modelApi;
    this.pipeline = pipeline || [];
  }

  async exec() {
    let rows = await this.modelApi.fetchAll();
    let docs = rows.map(row => row.toObject());

    this.pipeline.forEach(stage => {
      if (stage.$match) {
        docs = docs.filter(doc => matchesQuery(doc, stage.$match));
      }
      if (stage.$group && stage.$group._id && stage.$group.count) {
        const field = String(stage.$group._id).replace(/^\$/, '');
        const grouped = {};
        docs.forEach(doc => {
          const key = getPathValues(doc, field.split('.'))[0];
          grouped[key] = (grouped[key] || 0) + 1;
        });
        docs = Object.keys(grouped).map(key => ({ _id: key, count: grouped[key] }));
      }
      if (stage.$sort) {
        docs = sortRows(docs, stage.$sort);
      }
    });

    return docs;
  }

  cursor() {
    const aggregate = this;
    return {
      exec: async function() {
        const docs = await aggregate.exec();
        return {
          eachAsync: async function(iterator) {
            for (let i = 0; i < docs.length; i++) {
              await iterator(docs[i]);
            }
          }
        };
      }
    };
  }
}

function createModel(name, schema, db) {
  const defaults = schemaDefaults(schema);

  class PgDocument {
    constructor(data, options) {
      const shouldApplyDefaults = !options || options.applyDefaults !== false;
      Object.assign(this, shouldApplyDefaults ? applyDefaults(defaults, data) : clone(data) || {});
      Object.defineProperty(this, '__modelApi', {
        value: modelApi,
        enumerable: false
      });
    }

    toObject() {
      const data = {};
      Object.keys(this).forEach(key => {
        data[key] = clone(this[key]);
      });
      return data;
    }

    toJSON() {
      return this.toObject();
    }

    save() {
      return this.__modelApi.insert(this.toObject());
    }
  }

  const modelApi = {
    name,
    schema,

    wrap(data, options) {
      return new PgDocument(data, options);
    },

    async fetchAll() {
      await db.ensureTable(name);
      const result = await db.query(`SELECT _id, data FROM ${db.quoteIdent(name)} ORDER BY _id ASC`);
      return result.rows.map(row => {
        const data = Object.assign({ _id: Number(row._id) }, row.data || {});
        return this.wrap(data, { applyDefaults: false });
      });
    },

    async insert(data) {
      await db.ensureTable(name);
      const doc = applyDefaults(defaults, data);
      const id = doc._id;
      delete doc._id;

      const result =
        id === undefined || id === null
          ? await db.query(
              `INSERT INTO ${db.quoteIdent(name)} (data) VALUES ($1::jsonb) RETURNING _id, data`,
              [JSON.stringify(doc)]
            )
          : await db.query(
              `INSERT INTO ${db.quoteIdent(
                name
              )} (_id, data) VALUES ($1, $2::jsonb) RETURNING _id, data`,
              [Number(id), JSON.stringify(doc)]
            );

      const row = result.rows[0];
      return this.wrap(Object.assign({ _id: Number(row._id) }, row.data || {}), {
        applyDefaults: false
      });
    },

    async update(criteria, updateDoc, options, onlyOne) {
      await db.ensureTable(name);
      const rows = await this.fetchAll();
      const matched = rows.filter(row => matchesQuery(row.toObject(), criteria));
      const targets = onlyOne ? matched.slice(0, 1) : matched;

      if (!targets.length && options && options.upsert) {
        const base = {};
        Object.keys(criteria || {}).forEach(field => {
          if (field.charAt(0) !== '$' && !isOperatorObject(criteria[field])) {
            setPathValue(base, field, criteria[field]);
          }
        });
        const doc = applyUpdate(base, updateDoc, criteria);
        const inserted = await this.insert(doc);
        return { ok: 1, n: 1, nModified: 0, upserted: inserted._id };
      }

      for (let i = 0; i < targets.length; i++) {
        const current = targets[i].toObject();
        const id = current._id;
        delete current._id;
        const next = applyUpdate(current, updateDoc, criteria);
        await db.query(
          `UPDATE ${db.quoteIdent(name)} SET data = $2::jsonb, updated_at = now() WHERE _id = $1`,
          [id, JSON.stringify(next)]
        );
      }

      return { ok: 1, n: matched.length, nModified: targets.length };
    },

    async remove(criteria) {
      await db.ensureTable(name);
      const rows = await this.fetchAll();
      const targets = rows.filter(row => matchesQuery(row.toObject(), criteria));
      for (let i = 0; i < targets.length; i++) {
        await db.query(`DELETE FROM ${db.quoteIdent(name)} WHERE _id = $1`, [targets[i]._id]);
      }
      return { ok: 1, n: targets.length, deletedCount: targets.length };
    },

    async count(criteria) {
      const rows = await this.fetchAll();
      return rows.filter(row => matchesQuery(row.toObject(), criteria)).length;
    }
  };

  PgDocument.find = function(criteria, projection) {
    return new Query(modelApi, criteria, projection, false);
  };
  PgDocument.findOne = function(criteria, projection) {
    return new Query(modelApi, criteria, projection, true);
  };
  PgDocument.countDocuments = function(criteria) {
    return modelApi.count(criteria || {});
  };
  PgDocument.update = function(criteria, updateDoc, options) {
    return modelApi.update(criteria || {}, updateDoc || {}, options || {}, false);
  };
  PgDocument.updateOne = function(criteria, updateDoc, options) {
    return modelApi.update(criteria || {}, updateDoc || {}, options || {}, true);
  };
  PgDocument.remove = function(criteria) {
    return modelApi.remove(criteria || {});
  };
  PgDocument.aggregate = function(pipeline) {
    return new Aggregate(modelApi, pipeline);
  };

  return PgDocument;
}

function applyUpdate(doc, updateDoc, criteria) {
  const next = clone(doc) || {};
  const update = clone(updateDoc) || {};
  const hasOperator = Object.keys(update).some(key => key.charAt(0) === '$');

  if (!hasOperator) {
    Object.assign(next, update);
    return next;
  }

  if (update.$set) {
    Object.keys(update.$set).forEach(path => {
      applySet(next, path, update.$set[path], criteria);
    });
  }

  if (update.$push) {
    Object.keys(update.$push).forEach(path => {
      const value = update.$push[path];
      const items = value && value.$each ? value.$each : [value];
      if (!Array.isArray(next[path])) {
        next[path] = [];
      }
      next[path] = next[path].concat(items);
    });
  }

  if (update.$pull) {
    Object.keys(update.$pull).forEach(path => {
      const condition = update.$pull[path];
      if (!Array.isArray(next[path])) {
        return;
      }
      next[path] = next[path].filter(item => !matchesQuery(item, condition));
    });
  }

  return next;
}

function applySet(doc, path, value, criteria) {
  if (path.indexOf('.$.') === -1) {
    setPathValue(doc, path, value);
    return;
  }

  const parts = path.split('.$.');
  const arrayField = parts[0];
  const childPath = parts[1];
  const array = doc[arrayField];
  if (!Array.isArray(array)) {
    return;
  }

  const criteriaPrefix = arrayField + '.';
  const matchField = Object.keys(criteria || {}).filter(key => key.indexOf(criteriaPrefix) === 0)[0];
  if (!matchField) {
    return;
  }
  const itemField = matchField.slice(criteriaPrefix.length);
  const expected = criteria[matchField];
  const item = array.filter(row => matchesField(row, itemField, expected))[0];
  if (item) {
    setPathValue(item, childPath, value);
  }
}

module.exports = {
  createModel,
  matchesQuery,
  applyUpdate
};
