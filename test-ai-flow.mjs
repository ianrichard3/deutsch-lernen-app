import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} is missing`);
  assert.notEqual(end, -1, `${endMarker} is missing`);
  return source.slice(start, end);
}

const code = readFileSync('Ai.gs', 'utf8');
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

const suggestSpanishTranslation = Function(
  "const SPANISH_TRANSLATION_INSTRUCTION = 'Traducí del alemán al español.';\n" +
  "function normalize_(value) { return String(value == null ? '' : value).trim(); }\n" +
  "function geminiText_(instruction, input) { return instruction + '\\n' + input; }\n" +
  between(code, 'function suggestSpanishTranslation(text) {', '\n\nfunction analyzeEtymology') +
  '\nreturn suggestSpanishTranslation;'
)();
assert.equal(
  suggestSpanishTranslation(' Guten Morgen '),
  'Traducí del alemán al español.\nTexto en alemán:\nGuten Morgen'
);
assert.throws(() => suggestSpanishTranslation('  '), /frase en alemán/);

console.log('Gemini response parsing: OK');
