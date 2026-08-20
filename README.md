# deutsch-lernen-app

## Deploy

Cada push a `main` sincroniza el código y redepliega la web app en la misma
URL: <https://script.google.com/macros/s/AKfycbzev-d6D3ftvGW6afcHONQQgX4vs8h5fiTTejgNBVGjnHU2fKDXgno2uaQdUIb1AfEt/exec>.
El repositorio es la fuente de verdad: no edites el código en el editor de Apps
Script porque el próximo push lo reemplaza.

El workflow usa los secrets `CLASPRC_JSON` y `CLASP_JSON`; no los agregues al
repositorio.

La web app es privada y usa la planilla de frases configurada en `Code.gs`.

## Próxima mejora: audio MP3

La opción prevista es Google Cloud Text-to-Speech con una voz estándar alemana.
Generaría un MP3 temporal para descargar, sólo con las frases visibles y sin
guardar archivos en Drive. Cada exportación se limitaría a 5.000 bytes; para
listas más grandes habría que aplicar filtros. Requiere facturación activa,
aunque las voces estándar incluyen una cuota gratuita mensual.
