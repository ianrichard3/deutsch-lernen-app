import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} is missing`);
  assert.notEqual(end, -1, `${endMarker} is missing`);
  return source.slice(start, end);
}

const code = readFileSync('Code.gs', 'utf8');
const historyWindow = Function(
  "const HISTORY_LIMIT = 20;\n" +
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  between(code, 'function historyWindow_(entries, latest) {', '\n\nfunction writeHistory_') +
  '\nreturn historyWindow_;'
)();

const updated = historyWindow([
  {id: 'F0001', correct: true},
  {id: 'F0002', correct: true}
], {id: 'F0001', correct: false});
assert.deepEqual(updated.map(({id, correct}) => [id, correct]), [
  ['F0001', false], ['F0002', true]
]);

const limited = historyWindow(
  Array.from({length: 20}, (_, i) => ({id: `F${i + 1}`})),
  {id: 'F21'}
);
assert.equal(limited.length, 20);
assert.equal(limited[0].id, 'F21');
assert.equal(limited.at(-1).id, 'F19');

const html = readFileSync('App.html', 'utf8');
const randomCandidate = Function(
  between(html, '  function randomCandidate(items, history) {', '\n\n  function dateLabel') +
  '\nreturn randomCandidate;'
)();
const items = [{id: 'F1'}, {id: 'F2'}, {id: 'F3'}];
const originalRandom = Math.random;
Math.random = () => 0.99;
assert.equal(randomCandidate(items, [{id: 'F2'}]).id, 'F3');
Math.random = originalRandom;
assert.equal(randomCandidate(items, items), null);

console.log('Study history and random selection: OK');
