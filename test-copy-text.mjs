import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('App.html', 'utf8');
const start = html.indexOf('  function phrasesToText(items) {');
const end = html.indexOf('\n\n  function fallbackCopyText', start);

assert.notEqual(start, -1, 'phrasesToText is missing');
assert.notEqual(end, -1, 'phrasesToText boundary is missing');

const phrasesToText = Function(html.slice(start, end) + '\nreturn phrasesToText;')();
const sessionStart = html.indexOf('  function sessionToSsmlText_(items, reps, pause) {');

assert.notEqual(sessionStart, -1, 'sessionToSsmlText_ is missing');

const sessionToSsmlText = Function(html.slice(sessionStart, end) + '\nreturn sessionToSsmlText_;')();

const originalRandom = Math.random;
Math.random = () => 0.99;
assert.equal(
  phrasesToText([{ de: 'Guten Morgen' }, { de: 'Wie geht es?' }]),
  'Guten Morgen.\n\nWie geht es?'
);
assert.equal(phrasesToText([{ de: ' Hör\nbitte zu! ' }, { de: '   ' }]), 'Hör bitte zu!');

Math.random = () => 0;
const phrases = [{ de: 'Uno' }, { de: 'Dos' }, { de: 'Tres' }];
assert.equal(phrasesToText(phrases), 'Dos.\n\nTres.\n\nUno.');
assert.deepEqual(phrases, [{ de: 'Uno' }, { de: 'Dos' }, { de: 'Tres' }]);
Math.random = originalRandom;

assert.equal(
  sessionToSsmlText([{ de: 'Ich bin Ian' }], 3, 3000),
  'Ich bin Ian\n\n<break time="3s" />\n\nIch bin Ian\n\n<break time="3s" />\n\nIch bin Ian\n\n<break time="3s" />'
);
assert.equal(
  sessionToSsmlText([{ de: 'Erste' }, { de: 'Zweite' }], 1, 5000),
  'Erste\n\n<break time="5s" />\n\nZweite\n\n<break time="5s" />'
);
assert.match(html, /playerOptionsHtml\(\[1000, 2000, 3000, 5000\], state\.playerSettings\.pause, ' s'\)/);
assert.match(html, /data-act="copy-session-ssml">Copiar SSML/);

console.log('Copied phrase formatting: OK');
