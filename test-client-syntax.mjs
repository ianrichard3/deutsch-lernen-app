import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('App.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);

assert.ok(match, 'App.html must contain its client script');
assert.doesNotThrow(() => new Function(match[1]));

console.log('Client syntax: OK');
