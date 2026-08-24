/**
 * purchase-tracking.js
 * Construccion pura de los parametros del evento GA4 "purchase".
 * Sin DOM, sin sessionStorage, sin firebase -- solo datos in, datos out.
 * Se puede requerir desde Node (test) o cargar como <script> normal (browser).
 */

function buildPurchaseParams(sessionId, purchasedPlanId, plansMap) {
    const purchasedPlan = (plansMap && purchasedPlanId) ? plansMap[purchasedPlanId] : null;
    const purchaseValue = Number(purchasedPlan?.price || 0);

    return {
        transaction_id: sessionId,
        currency: 'USD',
        value: purchaseValue,
        items: purchasedPlan
            ? [{ item_id: purchasedPlanId, item_name: purchasedPlan.name, price: purchaseValue, quantity: 1 }]
            : [],
        _planFound: !!purchasedPlan,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPurchaseParams };
} else {
    window.buildPurchaseParams = buildPurchaseParams;
}
