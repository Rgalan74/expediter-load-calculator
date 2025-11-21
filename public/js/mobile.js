// MOBILE.JS - FUNCIONALIDADES ESPECÃFICAS PARA MÃ“VILES
// Optimizaciones y características específicas para dispositivos móviles

// DETECCIÃ“N DE DISPOSITIVO MÃ“VIL
function isMobile() {
 return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isTablet() {
 return window.innerWidth > 768 && window.innerWidth <= 1024;
}

function isLandscape() {
 return window.innerWidth > window.innerHeight;
}

// GESTIÃ“N DE VIEWPORT PARA EVITAR ZOOM EN INPUTS
class MobileViewportManager {
 constructor() {
 this.originalViewport = document.querySelector('meta[name="viewport"]').getAttribute('content');
 this.preventZoomViewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
 this.setupInputHandlers();
 }

 setupInputHandlers() {
 const inputs = document.querySelectorAll('input[type="number"], input[type="text"], input[type="email"], textarea, select');
 
 inputs.forEach(input => {
 input.addEventListener('focus', () => this.preventZoom());
 input.addEventListener('blur', () => this.restoreZoom());
 });
 }

 preventZoom() {
 if (isMobile()) {
 document.querySelector('meta[name="viewport"]').setAttribute('content', this.preventZoomViewport);
 }
 }

 restoreZoom() {
 if (isMobile()) {
 setTimeout(() => {
 document.querySelector('meta[name="viewport"]').setAttribute('content', this.originalViewport);
 }, 300);
 }
 }
}

// NAVEGACIÃ“N TABS MÃ“VIL OPTIMIZADA
class MobileTabNavigation {
 constructor() {
 this.tabContainer = document.querySelector('nav .max-w-7xl');
 this.tabLinks = document.querySelectorAll('.tab-link');
 this.setupMobileNavigation();
 }

 setupMobileNavigation() {
 if (!isMobile()) return;

 // Smooth scroll para navegación horizontal
 if (this.tabContainer) {
 this.tabContainer.style.scrollBehavior = 'smooth';
 }

 // Centrar tab activo en vista móvil
 this.tabLinks.forEach(link => {
 link.addEventListener('click', () => {
 setTimeout(() => this.centerActiveTab(link), 100);
 });
 });

 // Touch improvements para tabs
 this.tabLinks.forEach(link => {
 link.style.webkitTapHighlightColor = 'rgba(59, 130, 246, 0.1)';
 link.style.touchAction = 'manipulation';
 });
 }

 centerActiveTab(activeLink) {
 if (!isMobile() || !this.tabContainer) return;

 const containerRect = this.tabContainer.getBoundingClientRect();
 const linkRect = activeLink.getBoundingClientRect();
 
 const scrollLeft = this.tabContainer.scrollLeft;
 const targetScrollLeft = scrollLeft + linkRect.left - containerRect.left - (containerRect.width / 2) + (linkRect.width / 2);
 
 this.tabContainer.scrollTo({
 left: targetScrollLeft,
 behavior: 'smooth'
 });
 }
}

// GESTOR DE FORMULARIOS MÃ“VIL
class MobileFormManager {
 constructor() {
 this.setupFormOptimizations();
 this.setupButtonGroups();
 }

 setupFormOptimizations() {
 if (!isMobile()) return;

 // Mejorar inputs numéricos para móvil
 const numberInputs = document.querySelectorAll('input[type="number"]');
 numberInputs.forEach(input => {
 input.setAttribute('inputmode', 'decimal');
 input.style.fontSize = '16px'; // Previene zoom en iOS
 });

 // Mejorar inputs de texto para móvil
 const textInputs = document.querySelectorAll('input[type="text"]');
 textInputs.forEach(input => {
 input.style.fontSize = '16px'; // Previene zoom en iOS
 });

 // Auto-scroll a input cuando recibe focus en móvil
 const allInputs = document.querySelectorAll('input, textarea, select');
 allInputs.forEach(input => {
 input.addEventListener('focus', () => {
 setTimeout(() => {
 if (isMobile()) {
 input.scrollIntoView({ 
 behavior: 'smooth', 
 block: 'center',
 inline: 'nearest'
 });
 }
 }, 300);
 });
 });
 }

 setupButtonGroups() {
 // Optimizar grupos de botones para móvil
 const buttonGroups = document.querySelectorAll('.button-group');
 buttonGroups.forEach(group => {
 if (isMobile()) {
 group.style.display = 'grid';
 group.style.gridTemplateColumns = '1fr';
 group.style.gap = '0.5rem';
 }
 });
 }
}

// OPTIMIZADOR DE PANEL DE DECISIÃ“N MÃ“VIL
class MobileDecisionPanel {
 constructor() {
 this.panel = document.getElementById('decisionPanel');
 this.setupMobileOptimizations();
 }

 setupMobileOptimizations() {
 if (!this.panel || !isMobile()) return;

 // Hacer el panel más compacto en móvil
 this.panel.style.position = 'sticky';
 this.panel.style.top = '10px';
 this.panel.style.zIndex = '40';

 // Optimizar animaciones para móvil
 this.panel.style.transition = 'all 0.3s ease';

 // Mejorar botón de cierre para móvil
 const closeButton = this.panel.querySelector('[onclick="hideDecisionPanel()"]');
 if (closeButton) {
 closeButton.style.minWidth = '44px';
 closeButton.style.minHeight = '44px';
 closeButton.style.touchAction = 'manipulation';
 }

 // Mejorar botones de acción para móvil
 const actionButtons = this.panel.querySelectorAll('button');
 actionButtons.forEach(button => {
 button.style.minHeight = '44px';
 button.style.touchAction = 'manipulation';
 });
 }

 show(data) {
 if (!this.panel) return;

 // Mostrar panel con animación optimizada para móvil
 this.panel.classList.remove('hidden');
 
 if (isMobile()) {
 setTimeout(() => {
 this.panel.scrollIntoView({ 
 behavior: 'smooth', 
 block: 'nearest' 
 });
 }, 100);
 }
 }
}

// OPTIMIZADOR DE TABLAS MÃ“VIL
class MobileTableManager {
 constructor() {
 this.setupTableOptimizations();
 }

 setupTableOptimizations() {
 const tables = document.querySelectorAll('table');
 
 tables.forEach(table => {
 if (isMobile()) {
 // Envolver tabla en contenedor con scroll horizontal
 if (!table.parentElement.classList.contains('table-container')) {
 const wrapper = document.createElement('div');
 wrapper.className = 'table-container';
 table.parentNode.insertBefore(wrapper, table);
 wrapper.appendChild(table);
 }

 // Optimizar filas para móvil
 this.optimizeTableRows(table);
 }
 });
 }

 optimizeTableRows(table) {
 const rows = table.querySelectorAll('tbody tr');
 
 rows.forEach(row => {
 // Hacer filas más táctiles
 row.style.minHeight = '44px';
 row.style.cursor = 'pointer';
 
 // Mejorar tap target
 row.addEventListener('touchstart', () => {
 row.style.backgroundColor = '#f3f4f6';
 });
 
 row.addEventListener('touchend', () => {
 setTimeout(() => {
 row.style.backgroundColor = '';
 }, 150);
 });
 });
 }

 // Convertir tabla a cards en móvil muy pequeño
 convertToCards(tableId) {
 if (!isMobile() || window.innerWidth > 480) return;

 const table = document.getElementById(tableId);
 if (!table) return;

 const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
 const rows = table.querySelectorAll('tbody tr');

 const cardsContainer = document.createElement('div');
 cardsContainer.className = 'mobile-cards-container space-y-3';

 rows.forEach(row => {
 const cells = row.querySelectorAll('td');
 const card = document.createElement('div');
 card.className = 'bg-white p-3 rounded-lg border shadow-sm';

 cells.forEach((cell, index) => {
 if (headers[index] && cell.textContent.trim() !== '--') {
 const item = document.createElement('div');
 item.className = 'flex justify-between py-1 border-b border-gray-100 last:border-b-0';
 item.innerHTML = `
 <span class="font-medium text-gray-600 text-sm">${headers[index]}:</span>
 <span class="text-gray-900 text-sm">${cell.textContent}</span>
 `;
 card.appendChild(item);
 }
 });

 cardsContainer.appendChild(card);
 });

 table.parentElement.innerHTML = '';
 table.parentElement.appendChild(cardsContainer);
 }
}

// GESTOR DE ORIENTACIÃ“N Y RESIZE
class MobileOrientationManager {
 constructor() {
 this.setupOrientationHandlers();
 }

 setupOrientationHandlers() {
 window.addEventListener('orientationchange', () => {
 setTimeout(() => {
 this.handleOrientationChange();
 }, 500);
 });

 window.addEventListener('resize', () => {
 this.handleResize();
 });
 }

 handleOrientationChange() {
 // Reajustar elementos después del cambio de orientación
 
 // Reajustar mapa
 const map = document.getElementById('map');
 if (map && isMobile()) {
 if (isLandscape()) {
 map.style.height = '250px';
 } else {
 map.style.height = '200px';
 }
 }

 // Reajustar gráficos
 if (typeof window.resizeCharts === 'function') {
 window.resizeCharts();
 }

 // Recentrar tab activo
 const activeTab = document.querySelector('.tab-link.text-blue-600');
 if (activeTab && this.mobileTabNav) {
 this.mobileTabNav.centerActiveTab(activeTab);
 }
 }

 handleResize() {
 // Reconfigurar elementos según el nuevo tamaño
 if (window.innerWidth > 768 && this.wasMobile) {
 // Cambió de móvil a desktop
 this.switchToDesktop();
 } else if (window.innerWidth <= 768 && !this.wasMobile) {
 // Cambió de desktop a móvil
 this.switchToMobile();
 }

 this.wasMobile = isMobile();
 }

 switchToMobile() {
 console.log(' Cambiando a vista móvil');
 // Reinicializar componentes móviles
 this.initMobileComponents();
 }

 switchToDesktop() {
 console.log(' Cambiando a vista desktop');
 // Limpiar optimizaciones móviles
 this.cleanupMobileOptimizations();
 }

 initMobileComponents() {
 // Reinicializar todos los gestores móviles
 new MobileTabNavigation();
 new MobileFormManager();
 new MobileDecisionPanel();
 new MobileTableManager();
 }

 cleanupMobileOptimizations() {
 // Remover estilos específicos de móvil
 const elements = document.querySelectorAll('[style]');
 elements.forEach(el => {
 // Remover solo estilos que agregamos para móvil
 el.style.removeProperty('webkit-tap-highlight-color');
 el.style.removeProperty('touch-action');
 });
 }
}

// FUNCIONES UTILITARIAS MÃ“VIL - VERSIÃ“N CORREGIDA
const MobileUtils = {
 // Vibración háptica (si está disponible)
 vibrate(pattern = [100]) {
 if ('vibrate' in navigator && isMobile()) {
 navigator.vibrate(pattern);
 }
 },

 // Toast notifications optimizadas para móvil
 showMobileToast(message, type = 'info', duration = 3000) {
 const toast = document.createElement('div');
 toast.className = `fixed bottom-4 left-4 right-4 z-50 p-3 rounded-lg shadow-lg ${this.getToastClass(type)}`;
 toast.textContent = message;
 toast.style.transform = 'translateY(100%)';
 toast.style.transition = 'transform 0.3s ease';

 document.body.appendChild(toast);

 // Animar entrada
 setTimeout(() => {
 toast.style.transform = 'translateY(0)';
 }, 100);

 // Auto-remover
 setTimeout(() => {
 toast.style.transform = 'translateY(100%)';
 setTimeout(() => {
 if (document.body.contains(toast)) {
 document.body.removeChild(toast);
 }
 }, 300);
 }, duration);
 },

 getToastClass(type) {
 const classes = {
 success: 'bg-green-500 text-white',
 error: 'bg-red-500 text-white',
 warning: 'bg-yellow-500 text-white',
 info: 'bg-blue-500 text-white'
 };
 return classes[type] || classes.info;
 },

 // Prevenir scroll del body cuando modal está abierto
 preventBodyScroll() {
 document.body.style.overflow = 'hidden';
 document.body.style.position = 'fixed';
 document.body.style.width = '100%';
 },

 restoreBodyScroll() {
 document.body.style.overflow = '';
 document.body.style.position = '';
 document.body.style.width = '';
 },

 // Optimizar performance en móvil
 debounce(func, wait) {
 let timeout;
 return function executedFunction(...args) {
 const later = () => {
 clearTimeout(timeout);
 func(...args);
 };
 clearTimeout(timeout);
 timeout = setTimeout(later, wait);
 };
 },

 throttle(func, limit) {
 let inThrottle;
 return function() {
 const args = arguments;
 const context = this;
 if (!inThrottle) {
 func.apply(context, args);
 inThrottle = true;
 setTimeout(() => inThrottle = false, limit);
 }
 }
 }
};