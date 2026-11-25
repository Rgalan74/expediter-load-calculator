// Detección de "guardar nota" en el chat de Lex (español e inglés).
// Uso: node tests/lex-notes.test.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../public/js/lex-ai-engine.js'), 'utf8');
const fnSrc = src.match(/function detectSaveNote\(text\) \{[\s\S]*?\n        return null;\r?\n    \}/)[0];
const detectSaveNote = new Function(fnSrc + '\nreturn detectSaveNote;')();

const casos = [
  ['agrega una nota para Atlanta, GA: el muelle es lento', { lugar: 'Atlanta, GA', nota: 'el muelle es lento' }],
  ['guarda nota sobre Laredo: llegar temprano', { lugar: 'Laredo', nota: 'llegar temprano' }],
  ['anota para Miami, mucho tráfico', { lugar: 'Miami', nota: 'mucho tráfico' }],
  ['add a note for Atlanta, GA: dock is slow', { lugar: 'Atlanta, GA', nota: 'dock is slow' }],
  ['save a note about Laredo TX: arrive early', { lugar: 'Laredo TX', nota: 'arrive early' }],
  ['note for Chicago: tolls on I-90', { lugar: 'Chicago', nota: 'tolls on I-90' }],
  ['Lex, leave a note on Newark: bridge is $20', { lugar: 'Newark', nota: 'bridge is $20' }],
  ['¿cuánto pagan a Atlanta?', null],
  ['I need a notebook for Atlanta', null],
  ['nota para Dallas', null],
];

let fallos = 0;
for (const [texto, esperado] of casos) {
  const r = detectSaveNote(texto);
  const ok = JSON.stringify(r) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${texto} -> ${JSON.stringify(r)}`);
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todos los casos pasan');
process.exit(fallos ? 1 : 0);
