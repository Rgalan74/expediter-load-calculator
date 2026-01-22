/**
 * upgrade-modal.js
 * Lógica para mostrar y manejar el modal de planes de suscripción
 */

// ========================================
// RENDERIZADO DEL MODAL
// ========================================

const PLANS_HTML = `
<div id="plansModal" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    <!-- Background overlay -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closePlansModal()"></div>

    <!-- Modal panel -->
    <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
      
      <!-- Header -->
      <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
          🚀 Mejora tu Plan
        </h3>
        <button type="button" class="text-gray-400 hover:text-gray-500" onclick="closePlansModal()">
          <span class="sr-only">Cerrar</span>
          <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="px-4 py-5 sm:p-6 bg-gray-50">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          
          <!-- FREE PLAN -->
          <div class="relative bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
            <h3 class="text-lg font-semibold text-gray-900">Free</h3>
            <p class="mt-4 text-sm text-gray-500">Para probar la aplicación.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-gray-900">$0</span>
              <span class="text-base font-medium text-gray-500">/mes</span>
            </p>
            <ul class="mt-6 flex-1 space-y-4">
              <li class="flex text-sm text-gray-500">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">5 cálculos/mes</span>
              </li>
              <li class="flex text-sm text-gray-500">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Calculadora básica</span>
              </li>
            </ul>
            <div class="mt-8">
              <button disabled class="w-full bg-gray-100 border border-gray-200 rounded-md py-2 text-sm font-semibold text-gray-400 cursor-not-allowed">Plan Actual</button>
            </div>
          </div>

          <!-- PRO PLAN -->
          <div class="relative bg-white border border-blue-500 ring-2 ring-blue-500 rounded-lg shadow-md p-6 flex flex-col transform scale-105 z-10">
            <div class="absolute top-0 right-0 -mt-2 -mr-2 px-2 py-1 bg-blue-500 text-xs font-semibold text-white uppercase tracking-wide rounded-full shadow-sm">Popular</div>
            <h3 class="text-lg font-semibold text-gray-900">Pro</h3>
            <p class="mt-4 text-sm text-gray-500">Para owner-operators activos.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-gray-900">$9.99</span>
              <span class="text-base font-medium text-gray-500">/mes</span>
            </p>
            <ul class="mt-6 flex-1 space-y-4">
              <li class="flex text-sm text-gray-900 font-medium">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Cálculos ILIMITADOS</span>
              </li>
              <li class="flex text-sm text-gray-700">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Historial 90 días</span>
              </li>
              <li class="flex text-sm text-gray-700">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Análisis de Zonas</span>
              </li>
            </ul>
            <div class="mt-8">
              <button onclick="window.StripeIntegration.createCheckoutSession('pro')" class="w-full bg-blue-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all duration-200">
                Suscribirse a Pro
              </button>
            </div>
          </div>

          <!-- PREMIUM PLAN -->
          <div class="relative bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
            <h3 class="text-lg font-semibold text-gray-900">Premium</h3>
            <p class="mt-4 text-sm text-gray-500">Máximo poder y tecnología AI.</p>
            <p class="mt-8">
              <span class="text-4xl font-extrabold text-gray-900">$19.99</span>
              <span class="text-base font-medium text-gray-500">/mes</span>
            </p>
            <ul class="mt-6 flex-1 space-y-4">
              <li class="flex text-sm text-gray-500">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Todo lo de Pro +</span>
              </li>
              <li class="flex text-sm text-gray-500">
                <svg class="flex-shrink-0 h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Lex AI Assistant</span>
              </li>
              <li class="flex text-sm text-gray-500">
                <svg class="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                <span class="ml-3">Tax Reports & Export</span>
              </li>
            </ul>
            <div class="mt-8">
              <button onclick="window.StripeIntegration.createCheckoutSession('premium')" class="w-full bg-gray-800 border border-transparent rounded-md py-2 text-sm font-semibold text-white hover:bg-gray-900 shadow-sm transition-all duration-200">
                Suscribirse a Premium
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>
`;

// ========================================
// FUNCIONES UI
// ========================================

/**
 * Inyectar el modal en el DOM si no existe
 */
function ensureModalExists() {
    if (!document.getElementById('plansModal')) {
        const div = document.createElement('div');
        div.innerHTML = PLANS_HTML;
        document.body.appendChild(div.firstElementChild);
    }
}

/**
 * Abrir modal de planes
 */
function openPlansModal() {
    ensureModalExists();
    const modal = document.getElementById('plansModal');
    modal.classList.remove('hidden');

    // Animación simple de entrada
    const panel = modal.querySelector('.inline-block');
    panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
    panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
}

/**
 * Cerrar modal de planes
 */
function closePlansModal() {
    const modal = document.getElementById('plansModal');
    if (!modal) return;

    modal.classList.add('hidden');
}

// Exportar globalmente
window.openPlansModal = openPlansModal;
window.closePlansModal = closePlansModal;

console.log('📦 Upgrade Modal module loaded');
