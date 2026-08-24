/**
 * test-purchase-tracking.js — Test unitario de buildPurchaseParams (funcion pura).
 * No requiere navegador ni mocks de Firebase -- la funcion no toca DOM/window.
 * Ejecutar: node public/.test/test-purchase-tracking.js
 */

const { buildPurchaseParams } = require('../js/purchase-tracking.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const PLANS = {
    professional: { id: 'professional', name: 'Professional', price: 14.99 },
    premium: { id: 'premium', name: 'Premium + AI', price: 29.99 },
};

section('buildPurchaseParams — plan encontrado');
const r1 = buildPurchaseParams('cs_test_123', 'professional', PLANS);
assert(r1.transaction_id === 'cs_test_123', 'transaction_id es siempre el sessionId (' + r1.transaction_id + ')');
assert(r1.currency === 'USD', 'currency es USD');
assert(r1.value === 14.99, 'value toma el precio real del plan (' + r1.value + ')');
assert(r1._planFound === true, '_planFound es true cuando el plan existe en plansMap');
assert(Array.isArray(r1.items) && r1.items.length === 1, 'items tiene exactamente 1 entrada');
assert(r1.items[0].item_id === 'professional', 'items[0].item_id es el plan id');
assert(r1.items[0].item_name === 'Professional', 'items[0].item_name es el nombre legible');
assert(r1.items[0].price === 14.99, 'items[0].price coincide con value');
assert(r1.items[0].quantity === 1, 'items[0].quantity es 1');

section('buildPurchaseParams — plan NO encontrado (sessionStorage perdido)');
const r2 = buildPurchaseParams('cs_test_456', null, PLANS);
assert(r2.transaction_id === 'cs_test_456', 'transaction_id se preserva aunque no haya plan');
assert(r2.value === 0, 'value es 0 cuando no hay plan (caso a evitar via fallback en el caller)');
assert(r2._planFound === false, '_planFound es false -- señal para que el caller intente el fallback');
assert(Array.isArray(r2.items) && r2.items.length === 0, 'items es un array vacio, no undefined');

section('buildPurchaseParams — planId no existe en plansMap');
const r3 = buildPurchaseParams('cs_test_789', 'plan_que_no_existe', PLANS);
assert(r3._planFound === false, 'plan id invalido tambien marca _planFound false');
assert(r3.value === 0, 'value es 0 para un plan id invalido');

section('buildPurchaseParams — plan premium');
const r4 = buildPurchaseParams('cs_test_999', 'premium', PLANS);
assert(r4.value === 29.99, 'funciona igual para el plan premium (' + r4.value + ')');
assert(r4._planFound === true, '_planFound true para premium');

console.log(`\n────────────────────────────\n RESULTADO: ${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
