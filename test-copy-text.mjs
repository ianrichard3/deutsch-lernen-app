import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('App.html', 'utf8');
const start = html.indexOf('  function phrasesToText(items) {');
const end = html.indexOf('\n\n  function fallbackCopyText', start);

assert.notEqual(start, -1, 'phrasesToText is missing');
assert.notEqual(end, -1, 'phrasesToText boundary is missing');

const phrasesToText = Function(html.slice(start, end) + '\nreturn phrasesToText;')();

assert.equal(
  phrasesToText([{ de: 'Guten Morgen' }, { de: 'Wie geht es?' }]),
  'Guten Morgen.\n\nWie geht es?'
);
assert.equal(phrasesToText([{ de: ' Hör\nbitte zu! ' }, { de: '   ' }]), 'Hör bitte zu!');

console.log('Copied phrase formatting: OK');
