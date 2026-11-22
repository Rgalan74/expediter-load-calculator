// Regresión: Lex lee el texto pegado de una oferta (origen, destino, millas, tarifa, deadhead).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lex-ai-engine.js'), 'utf8');
const parseLoadBoardText = new Function(src.slice(src.indexOf('function parseLoadBoardText'), src.indexOf('function fillCalculatorFromLoad')) + '\nreturn parseLoadBoardText;')();

const casos = [
  ['Nashville, TN to Atlanta, GA - $650 - 248 miles', 'Nashville, TN', 'Atlanta, GA', 248, 650, 0],
  ['Nashville TN - Atlanta GA | $650 | 248 miles | DH 20mi', 'Nashville TN', 'Atlanta GA', 248, 650, 20],
  ['Pickup Nashville, TN -> Atlanta, GA. Rate $650, 248 miles, DH: 20 miles', 'Nashville, TN', 'Atlanta, GA', 248, 650, 20],
  ['NASHVILLE, TN - ATLANTA, GA $650 248 miles', 'NASHVILLE, TN', 'ATLANTA, GA', 248, 650, 0],
  ['St. Louis, MO → Grand Rapids, MI $900 520 miles', 'St. Louis, MO', 'Grand Rapids, MI', 520, 900, 0],
  ['Load to Atlanta: $1,350 for 722 miles, DH 30mi', '', '', 722, 1350, 30]
];

for (const [texto, o, d, mi, rate, dh] of casos) {
  test(`Lex lee: ${texto}`, () => {
    const r = parseLoadBoardText(texto);
    assert.ok(r);
    assert.equal(r.origin, o);
    assert.equal(r.destination, d);
    assert.equal(r.miles, mi);
    assert.equal(r.rate, rate);
    assert.equal(r.deadhead, dh);
  });
}

test('Lex ignora mensajes que no son ofertas', () => {
  assert.equal(parseLoadBoardText('¿cómo voy este mes?'), null);
  assert.equal(parseLoadBoardText('guarda una nota para Laredo: poca carga de salida'), null);
});
