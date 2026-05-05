import fs from 'fs';
import path from 'path';
import test from 'ava';

test('Notify component and application references are removed', t => {
  const notifyPath = path.join(__dirname, '../../client/components/Notify/Notify.js');
  const applicationSource = fs.readFileSync(
    path.join(__dirname, '../../client/Application.js'),
    'utf8'
  );

  t.false(fs.existsSync(notifyPath));
  t.false(applicationSource.includes('components/Notify'));
  t.false(applicationSource.includes('<Notify'));
});
