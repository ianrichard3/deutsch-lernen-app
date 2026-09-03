/* IA: llamadas externas y validación de sus respuestas. */

function extractGeminiText_(data) {
  const steps = data && data.steps;
  if (!Array.isArray(steps)) return '';

  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step || step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const text = step.content.map(function (part) {
      return part && part.type === 'text' ? part.text : '';
    }).join('');
    if (normalize_(text)) return normalize_(text);
  }
  return '';
}

function geminiText_(instruction, input) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Falta configurar GEMINI_API_KEY en las propiedades del script.');

  const response = UrlFetchApp.fetch(GEMINI_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: instruction,
      input: input,
      store: false,
      generation_config: { temperature: 0.2 }
    }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Gemini no pudo responder. Intentá de nuevo.');

  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (err) {
    throw new Error('Gemini devolvió una respuesta inválida.');
  }

  const text = extractGeminiText_(data);
  if (!text) throw new Error('Gemini no devolvió texto. Intentá de nuevo.');
  return text;
}

function suggestGermanTranslation(text) {
  const spanish = normalize_(text);
  if (!spanish) throw new Error('Escribí la frase en español antes de traducir.');
  return geminiText_(TRANSLATION_INSTRUCTION, 'Texto en español:\n' + spanish);
}

function suggestSpanishTranslation(text) {
  const german = normalize_(text);
  if (!german) throw new Error('Escribí la frase en alemán antes de traducir.');
  return geminiText_(SPANISH_TRANSLATION_INSTRUCTION, 'Texto en alemán:\n' + german);
}

function analyzeEtymology(text) {
  const phrase = normalize_(text);
  if (!phrase) throw new Error('Escribí la palabra o frase en alemán antes de analizarla.');
  return geminiText_(ETYMOLOGY_INSTRUCTION, 'Palabra o frase a analizar:\n' + phrase);
}
