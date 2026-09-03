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
const phaseDefaults = Function(
  between(html, '  function phaseDefaults_(phase) {', '\n\n  function shuffledItems_') +
  '\nreturn phaseDefaults_;'
)();
assert.deepEqual(phaseDefaults('understand'), {german: true, spanish: true});
assert.deepEqual(phaseDefaults('listen'), {german: false, spanish: false});
assert.deepEqual(phaseDefaults('shadow'), {german: true, spanish: false});
assert.deepEqual(phaseDefaults('recall'), {german: false, spanish: true});

const shuffledItems = Function(
  between(html, '  function shuffledItems_(items) {', '\n\n  function sessionItems_') +
  '\nreturn shuffledItems_;'
)();
const originalRandom = Math.random;
Math.random = () => 0;
const originalItems = [{id: 'F1'}, {id: 'F2'}, {id: 'F3'}];
assert.deepEqual(shuffledItems(originalItems).map(({id}) => id), ['F2', 'F3', 'F1']);
assert.deepEqual(originalItems.map(({id}) => id), ['F1', 'F2', 'F3']);
Math.random = originalRandom;

const nextPlaybackPosition = Function(
  between(html, '  function nextPlaybackPosition(length, index, repetition, repetitions) {', '\n\n  function playerVoiceReady_') +
  '\nreturn nextPlaybackPosition;'
)();
assert.deepEqual(nextPlaybackPosition(3, 1, 0, 2), {index: 1, repetition: 1});
assert.deepEqual(nextPlaybackPosition(3, 1, 1, 2), {index: 2, repetition: 0});
assert.deepEqual(nextPlaybackPosition(3, 2, 0, 1), {index: 0, repetition: 0});

const movePlayer = Function(
  "var state = { session:{items:[{}, {}, {}], phase:'free', supports:{}} };\n" +
  "var player = {index:0, repetition:0, playing:false};\n" +
  "function sessionItems_() { return state.session.items; }\n" +
  "function stopPlayer_() {} function resetPhraseSupports_() {} function updatePlayerUi_() {}\n" +
  "function recallPhase_() { return false; } function startPlayer_() {}\n" +
  between(html, '  function movePlayer_(direction) {', '\n\n  function restartPlayer_') +
  '\nreturn {state:state, player:player, movePlayer_:movePlayer_};'
)();
movePlayer.movePlayer_(-1);
assert.equal(movePlayer.player.index, 2);
movePlayer.movePlayer_(1);
assert.equal(movePlayer.player.index, 0);

const toggleSupport = Function(
  "var state = {session:{phase:'recall', supports:{german:true, spanish:true}}};\n" +
  "var stopped = 0, rendered = 0, updated = 0;\n" +
  "function recallPhase_() { return state.session.phase === 'recall'; }\n" +
  "function stopPlayer_() { stopped++; } function renderCollections() { rendered++; } function updatePlayerUi_() { updated++; }\n" +
  between(html, '  function toggleSupport_(support) {', '\n\n  function byId') +
  '\nreturn {state:state, toggleSupport_:toggleSupport_, counts:function () { return [stopped, rendered, updated]; }};'
)();
toggleSupport.toggleSupport_('german');
assert.deepEqual(toggleSupport.counts(), [1, 1, 0]);
assert.equal(toggleSupport.state.session.supports.german, false);

console.log('Collections ordering and player loop: OK');
