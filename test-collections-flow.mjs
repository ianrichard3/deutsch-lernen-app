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
const collectionNameKey = Function(
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  between(code, 'function collectionNameKey_(value) {', '\n\nfunction isUnassignedCollection_') +
  '\nreturn collectionNameKey_;'
)();
assert.equal(collectionNameKey('  Mi   trabajo  '), 'mi trabajo');

const orderedMemberPhraseIds = Function(
  "const COLLECTION_MEMBER_COL = { COLLECTION_ID: 1, PHRASE_ID: 2, POSITION: 3 };\n" +
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  "function collectionIdKey_(value) { return normalize_(value).toUpperCase(); }\n" +
  between(code, 'function orderedMemberPhraseIds_(rows, collectionId) {', '\n\nfunction collectionIdNumber_') +
  '\nreturn orderedMemberPhraseIds_;'
)();
assert.deepEqual(orderedMemberPhraseIds([
  ['C1', 'F2', 2], ['C1', 'F1', 1], ['C1', 'F1', 3], ['C2', 'F9', 1], ['C1', 'F3', '']
], 'c1'), ['F1', 'F2', 'F3']);

const membershipRows = Function(
  "const COLLECTION_MEMBER_COL = { COLLECTION_ID: 1, PHRASE_ID: 2, POSITION: 3 };\n" +
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  "function collectionIdKey_(value) { return normalize_(value).toUpperCase(); }\n" +
  between(code, 'function membershipRows_(collections, members, phrases) {', '\n\nfunction orderedMemberPhraseIds_') +
  '\nreturn membershipRows_;'
)();
const memberships = membershipRows(
  {byId: {C1: {name: 'Trabajo'}}},
  {values: [['C1', 'F1', 2], ['C1', 'F1', 1], ['C2', 'F1', 1], ['C1', 'F2', 1]]},
  {byId: {F1: {de: 'Ich arbeite'}}}
);
assert.deepEqual(memberships.rows.map(({collectionKey, phraseKey, position}) => [collectionKey, phraseKey, position]), [['C1', 'F1', 2]]);
assert.deepEqual(memberships.byPhrase, {F1: ['C1']});

const html = readFileSync('App.html', 'utf8');
const nextPlaybackPosition = Function(
  between(html, '  function nextPlaybackPosition(length, index, repetition, repetitions) {', '\n\n  function playerVoiceReady_') +
  '\nreturn nextPlaybackPosition;'
)();
assert.deepEqual(nextPlaybackPosition(3, 1, 0, 2), {index: 1, repetition: 1});
assert.deepEqual(nextPlaybackPosition(3, 1, 1, 2), {index: 2, repetition: 0});
assert.deepEqual(nextPlaybackPosition(3, 2, 0, 1), {index: 0, repetition: 0});

console.log('Collections ordering and player loop: OK');
