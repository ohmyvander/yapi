import test from 'ava';
import { createModel } from '../../server/utils/pgModel';

function createFakeDb() {
  const rows = [];
  let nextId = 11;

  return {
    rows,
    quoteIdent(name) {
      return `"${name}"`;
    },
    async ensureTable() {},
    async query(sql, params = []) {
      if (/^SELECT/i.test(sql)) {
        return {
          rows: rows.map(row => ({ _id: row._id, data: JSON.parse(JSON.stringify(row.data)) }))
        };
      }

      if (/^INSERT/i.test(sql) && params.length === 1) {
        const row = { _id: nextId++, data: JSON.parse(params[0]) };
        rows.push(row);
        return { rows: [{ _id: row._id, data: JSON.parse(JSON.stringify(row.data)) }] };
      }

      if (/^INSERT/i.test(sql) && params.length === 2) {
        const row = { _id: params[0], data: JSON.parse(params[1]) };
        rows.push(row);
        return { rows: [{ _id: row._id, data: JSON.parse(JSON.stringify(row.data)) }] };
      }

      if (/^UPDATE/i.test(sql)) {
        const row = rows.filter(item => item._id === params[0])[0];
        row.data = JSON.parse(params[1]);
        return { rows: [] };
      }

      if (/^DELETE/i.test(sql)) {
        const index = rows.findIndex(item => item._id === params[0]);
        rows.splice(index, 1);
        return { rows: [] };
      }

      return { rows: [] };
    }
  };
}

test('pg model supports mongoose-style nested query chains', async t => {
  const db = createFakeDb();
  const Project = createModel(
    'project',
    {
      name: String,
      status: String,
      members: [{ uid: Number, role: String }],
      tag: [],
      index: { type: Number, default: 0 }
    },
    db
  );

  await new Project({
    name: 'alpha',
    status: 'open',
    members: [{ uid: 1, role: 'owner' }],
    tag: ['core'],
    index: 2
  }).save();
  await new Project({
    name: 'beta',
    status: 'closed',
    members: [{ uid: 2, role: 'dev' }],
    tag: ['edge'],
    index: 1
  }).save();

  const result = await Project.find({
    $or: [{ 'members.uid': '1' }, { tag: { $in: ['edge'] } }]
  })
    .select('_id name index')
    .sort({ index: 1 })
    .exec();

  t.deepEqual(
    result.map(item => item.toObject()),
    [
      { _id: 12, name: 'beta', index: 1 },
      { _id: 11, name: 'alpha', index: 2 }
    ]
  );
});

test('pg model applies positional member updates and array mutations', async t => {
  const db = createFakeDb();
  const Group = createModel(
    'group',
    {
      group_name: String,
      members: [{ uid: Number, role: String, username: String }]
    },
    db
  );

  const group = await new Group({
    group_name: 'team',
    members: [{ uid: 1, role: 'dev', username: 'Old' }]
  }).save();

  await Group.update(
    { _id: group._id, 'members.uid': 1 },
    { $set: { 'members.$.role': 'owner', 'members.$.username': 'New' } }
  );
  await Group.update({ _id: group._id }, { $push: { members: { $each: [{ uid: 2, role: 'dev' }] } } });
  await Group.update({ _id: group._id }, { $pull: { members: { uid: 1 } } });

  const result = await Group.findOne({ _id: group._id });
  t.deepEqual(result.toObject().members, [{ uid: 2, role: 'dev' }]);
});
