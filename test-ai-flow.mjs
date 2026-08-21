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
const extractGeminiText = Function(
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  between(code, 'function extractGeminiText_(data) {', '\n\nfunction geminiText_') +
  '\nreturn extractGeminiText_;'
)();

assert.equal(extractGeminiText({
  steps: [{type: 'model_output', content: [{type: 'text', text: ' Guten Morgen '}]}]
}), 'Guten Morgen');
assert.equal(extractGeminiText({steps: [{type: 'model_output', content: []}]}), '');
assert.equal(extractGeminiText({}), '');

console.log('Gemini response parsing: OK');
