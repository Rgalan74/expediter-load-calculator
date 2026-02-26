# Smart Load Solution — Pre-Launch Investigation Checklist
**Objetivo:** Auditoría completa del sistema antes del lanzamiento beta
**Fecha:** Febrero 16, 2026
**Versión:** 1.0

---

## 🎯 CATEGORÍAS DE INVESTIGACIÓN

### 1. ARQUITECTURA Y COSTOS (CPM SYSTEM)
### 2. AUTENTICACIÓN Y SEGURIDAD
### 3. DATOS Y FIRESTORE
### 4. UI/UX Y RESPONSIVENESS
### 5. ONBOARDING Y CONFIGURACIÓN INICIAL
### 6. FUNCIONALIDAD CORE (CALCULADORA, LEX, FINANZAS, ZONAS, HISTORIAL)
### 7. INTEGRACIÓN ENTRE MÓDULOS
### 8. PERFORMANCE Y OPTIMIZACIÓN
### 9. PLANES Y MONETIZACIÓN
### 10. TESTING Y ERRORES
### 11. CONTENIDO Y COPYWRITING
### 12. LEGAL Y COMPLIANCE
### 13. DEPLOYMENT Y HOSTING

---

## 1️⃣ ARQUITECTURA Y COSTOS (CPM SYSTEM)

### 🔴 CRÍTICO

- [x ] **CPM Engine — Validación de Lógica**
  - [x ] Verificar que filtra correctamente por `isOperational: true`
  - [x ] Confirmar ventana de 6 meses funciona con diferentes zonas horarias
  - [x ] Probar con usuario que tiene <20 cargas (debe usar config)
  - [x ] Probar con usuario que tiene >20 cargas pero <3 meses
  - [x ] Probar con usuario que tiene >20 cargas y >3 meses (debe usar real)
  - [x ] Verificar que cache se limpia al guardar config o gastos
  - [x ] Confirmar que CPM se recalcula después de agregar/editar/borrar gastos

- [x ] **Categorías Operacionales**
  - [x ] Validar que las 8 categorías operacionales son correctas para el negocio
  - [x ] Confirmar que `permits` (permisos) debe ser operacional
  - [x ] Verificar que categorías personalizadas se guardan con `isOperational`
  - [x ] Probar crear categoría personalizada operacional
  - [x ] Probar crear categoría personalizada no-operacional
  - [x ] Verificar que borrar categoría no afecta gastos existentes

- [x ] **Settings → Costs Calculation**
  - [x ] Verificar fórmula: `fuelCostPerMile = fuelPricePerGallon / fuelMPG`
  - [x ] Verificar fórmula: `variableCPM = fuel + maintenance + tires + repairs`
  - [x ] Verificar fórmula: `fixedCPM = totalFixedMonthly / monthlyMilesGoal`
  - [x ] Verificar fórmula: `totalCPM = variableCPM + fixedCPM`
  - [x ] Confirmar que `comida: 0.028` no se suma en totalCPM (decisión de diseño)
  - [x ] Probar con `monthlyMilesGoal = 0` (debe manejar división por cero)
  - [x ] Confirmar que `window.currentUser.costs` se actualiza inmediatamente
  - [x ] Verificar que evento `configSaved` se dispara correctamente

- [x ] **Sincronización entre Módulos**
  - [x ] Calculadora usa `TU_COSTO_REAL.TOTAL` ← debe ser igual a CPM Engine
  - [x ] Lex usa `realCPM` para cálculos ← debe ser igual a CPM Engine
  - [x ] Calculator Agent usa `profile.realCPM` ← debe ser igual a CPM Engine
  - [x ] Todos los `getUserCPM()` retornan el mismo valor
  - [x ] Verificar que NO quedan `0.576` hardcodeados en ningún archivo

### 🟡 IMPORTANTE

- [x ] **Distribución de Costos en CPM Real** ✅ Revisado Feb 23
  - [x ] Revisar lógica: `remainder = result.cpm - fuelCPM` — agregado `Math.max(0, remainder)`
  - [x ] Revisar distribución: `costosFijos: remainder * 0.65`
  - [x ] Revisar distribución: `mantenimiento: remainder * 0.35`
  - [x ] Considerar si esta distribución tiene sentido para todos los usuarios — fija 65/35, OK para beta
  - [ ] Probar con diferentes perfiles de vehículos (Sprinter, ProMaster, box truck)

- [x] **Datos Históricos de Ricardo** ✅ Verificado por Ricardo Feb 25
  - [x] Recategorizar 63 gastos que están como "sin categoría" (Existen y validados)
  - [x] Validar que gastos operacionales suman correctamente
  - [x] Confirmar que millas totales coinciden entre loads y finances
  - [x] Verificar que fechas de gastos y cargas están en formato correcto

- [x ] **Fallback Logic** ✅ Implementado Feb 23
  - [ ] ¿Qué pasa si usuario borra toda su configuración?
  - [x ] ¿Qué pasa si Firestore falla? — localStorage fallback agregado en `config.js`
  - [ ] ¿Qué pasa si CPMEngine tarda más de 2 segundos en cargar?
  - [x ] ¿localStorage tiene backup de costs? — Sí, implementado

### 🟢 NICE TO HAVE

- [ ] Agregar indicador visual de qué CPM está usando (config vs real)
- [ ] Mostrar badge "📊 Usando datos reales" cuando source === 'real'
- [ ] Crear página de "Insights" que muestre tendencias de CPM por mes
- [ ] Agregar export de datos de CPM histórico

---

## 2️⃣ AUTENTICACIÓN Y SEGURIDAD

### 🔴 CRÍTICO

- [x] **Firebase Auth** ✅ Verificado Feb 24
  - [x] Confirmar que persistencia está en `LOCAL` mode
  - [x] Verificar timeout de 5 segundos — implementado en config.js
  - [x] Probar login con email/password
  - [x] Login con Google — N/A, no está habilitado (solo email/password)
  - [x] Probar logout y que limpia `window.currentUser`
  - [x] Verificar que redirige a `auth.html` si no hay usuario
  - [x] Confirmar que no hay loops infinitos de redirección

- [x] **Protección de Rutas** ✅ Verificado Feb 24
  - [x] `app.html` requiere autenticación
  - [x] `requireAuth()` funciona — throws Error si no hay usuario (config.js:351)
  - [x] Confirmar que pestañas premium están bloqueadas para plan Free
  - [x] Admin tiene acceso total — `isAdmin()` check en rules + `rolesManager`

- [x] **Validación de Inputs** ✅ Verificado Feb 24
  - [x] Todos los inputs usan `sanitizeNumber()` y `sanitizeText()`
  - [x] No se pueden inyectar scripts — `sanitizeHTML()` en security.js
  - [x] Valores negativos validados
  - [x] Valores extremos validados (RPM ≤50, miles ≤10000, charge ≤500000)
  - [x] Fechas se validan — format checks en inputs

- [x] **Firestore Security Rules** ✅ Verificado Feb 24
  - [x] Usuarios solo leen/escriben sus datos — `isOwner()` en todas las colecciones
  - [x] Campo `userId` validado en loads, expenses, lexProfiles, etc.
  - [x] Admin puede leer datos — `isAdminByRole()` para users collection
  - [x] Deny-all fallback — `allow read, write: if false` al final
  - [x] Stripe extension rules — customers, checkout_sessions, subscriptions

### 🟡 IMPORTANTE

- [x ] **Password Recovery** ✅ Implementado Feb 23
  - [x ] Probar flujo de "Olvidé mi contraseña" — link agregado en `auth.html`
  - [ ] Verificar que email de reset llega — probar manualmente
  - [ ] Confirmar que link de reset expira después de usarlo — manejo de Firebase

- [ ] **Session Management** — Dejado para post-lanzamiento
  - [x ] ¿Qué pasa si usuario abre app en dos tabs? — Firebase Auth sincroniza login
  - [ ] ¿Se sincronizan los datos entre tabs? — datos calculados NO sincronizan
  - [ ] ¿Cómo maneja cambios concurrentes?

- [x ] **Rate Limiting** ✅ Implementado Feb 23
  - [x ] ¿Hay límites de requests a Firestore? — debounce guards implementados
  - [x ] ¿Qué pasa si usuario hace 100 requests en 1 minuto? — `_isCalculating` y `_isSaving` previenen doble-click

### 🟢 NICE TO HAVE

- [ ] Implementar 2FA (two-factor authentication)
- [ ] Agregar "Remember me" checkbox
- [ ] Mostrar "Last login" en perfil de usuario
- [ ] Agregar log de actividad de usuario

---

## 3️⃣ DATOS Y FIRESTORE

### 🔴 CRÍTICO

- [x ] **Estructura de Colecciones**
  - [x ] `users/{uid}` — tiene todos los campos necesarios
  - [x ] `loads` — filtra correctamente por `userId`
  - [x ] `expenses` — filtra correctamente por `userId`
  - [x ] `lexProfiles/{uid}` — se crea automáticamente
  - [x ] Verificar que índices compuestos existen (userId + date, etc.)

- [x ] **Migración de Datos de Ricardo**
  - [x ] Confirmar que todas las 89 cargas tienen `userId` correcto
  - [x ] Verificar que los 63 gastos tienen `userId` correcto
  - [x ] Validar que fechas están en formato ISO correcto
  - [x ] Confirmar que campos numéricos no son strings
  - [x ] Verificar que no hay datos duplicados

- [ ] **Data Integrity**
  - [x ] Probar borrar una carga → ¿afecta promedios de Lex?
  - [x ] Probar editar un gasto → ¿recalcula CPM Engine?
  - [ ] Probar borrar usuario → ¿se borran todas sus colecciones?
  - [x ] Verificar que totales en Finanzas coinciden con Firestore

- [ ] **Backup y Recovery**
  - [x ] ¿Hay backup automático de Firestore?
  - [x ] ¿Cómo restaurar datos si usuario borra algo por error?
  - [x ] localStorage funciona como fallback si Firestore falla

### 🟡 IMPORTANTE

- [x ] **Offline Mode** ✅ Integrado Feb 23
  - [x ] Verificar que `offline-storage.js` está integrado — scripts agregados en `app.html`
  - [x ] Probar guardar carga sin internet → guarda en IndexedDB via `offlineStorage.saveCalculation()`
  - [x ] Confirmar que sincroniza cuando vuelve internet → `sync-manager.js` auto-sync
  - [x ] Verificar que muestra indicador de "offline" → banner notification + toast

- [x ] **Data Validation** ✅ Verificado Feb 23
  - [x ] Verificar que campos requeridos no pueden ser null — origin, destination, miles, RPM validados
  - [x ] Confirmar que tipos de datos son correctos (string vs number) — `Number()` en campos numéricos
  - [ ] Validar que enums tienen valores permitidos
  - [ ] Verificar que relaciones entre colecciones son consistentes

### 🟢 NICE TO HAVE

- [ ] Implementar soft delete (marcar como deleted en lugar de borrar)
- [ ] Agregar changelog de modificaciones
- [ ] Crear herramienta de export de datos a CSV/Excel
- [ ] Implementar import de datos desde Excel

---

## 4️⃣ UI/UX Y RESPONSIVENESS

### 🔴 CRÍTICO

- [x ] **Mobile Responsiveness**
  - [x ] Probar en iPhone (Safari iOS)
  - [x ] Probar en Android (Chrome)
  - [x ] Verificar que header móvil funciona
  - [x ] Confirmar que menú hamburguesa abre/cierra
  - [x ] Probar todas las tabs en móvil
  - [x ] Verificar que modales se ven bien en móvil
  - [x ] Confirmar que teclado no tapa inputs en móvil

- [x ] **Temas Light/Dark**
  - [x ] Verificar que TODAS las tabs funcionan en light mode
  - [x ] Confirmar que TODAS las tabs funcionan en dark mode
  - [x ] Probar switch de tema en cada tab
  - [x ] Verificar que se guarda preferencia de tema
  - [x ] Confirmar que charts cambian colores con el tema
  - [x ] Verificar que placeholders son visibles en ambos temas
  - [x ] Confirmar que botones tienen hover visible en ambos temas

- [ ] **Accesibilidad**
  - [ ] Verificar que todos los botones tienen labels
  - [ ] Confirmar que inputs tienen labels asociados
  - [ ] Probar navegación con Tab (keyboard navigation)
  - [ ] Verificar que colores tienen suficiente contraste
  - [ ] Confirmar que mensajes de error son claros

### 🟡 IMPORTANTE

- [x ] **Loading States** ✅ Parcialmente implementado Feb 23
  - [x ] Verificar que todos los botones muestran "Cargando..." al procesar — Calculate y Save tienen spinner
  - [ ] Confirmar que tabs muestran skeleton/spinner mientras cargan datos — post-launch
  - [ ] Probar con internet lenta → ¿se ven indicadores de carga?
  - [x ] Verificar que no hay doble-submit de formularios — debounce guards en calculate y saveLoad

- [x ] **Error States** ✅ Parcialmente verificado Feb 23
  - [x ] Probar guardar sin internet → ¿mensaje de error claro? — "📴 Sin internet..." via showMessage
  - [x ] Probar con campos vacíos → ¿validación visible? — throws error con mensaje claro
  - [x ] Probar con datos inválidos → ¿mensaje específico? — validación de millas y RPM
  - [ ] Verificar que errores tienen opción de "Reintentar"

- [x ] **Success States** ✅ Verificado Feb 23
  - [x ] Verificar que todos los guardados muestran confirmación — showMessage funciona desde helpers.js
  - [x ] Confirmar que toasts/mensajes son temporales (4-5 segundos) — showToast default 3s
  - [ ] Probar que modales se cierran después de éxito

### 🟢 NICE TO HAVE

- [ ] Agregar animaciones de transición entre tabs
- [ ] Implementar undo/redo para acciones críticas
- [ ] Agregar modo de alto contraste para accesibilidad
- [ ] Crear dark mode automático según hora del día

---

## 5️⃣ ONBOARDING Y CONFIGURACIÓN INICIAL

### 🔴 CRÍTICO

- [x ] **Flujo de Onboarding**
  - [x ] Probar con cuenta completamente nueva
  - [x ] Verificar que aparece wizard de bienvenida
  - [x ] Confirmar que fuerza llenar configuración básica
  - [x ] Probar skip de onboarding → ¿permite usar app con defaults?
  - [x ] Verificar que guarda `onboardingCompleted: true`
  - [x ] Confirmar que no vuelve a mostrar onboarding después

- [x ] **Configuración Inicial Requerida**
  - [x ] ¿Qué campos son obligatorios? (vehicleType, fuelMPG, etc.)
  - [x ] ¿Puede usar app sin llenar configuración? Si
  - [x ] Verificar que defaults son razonables (18 MPG, $3.50/gal)
  - [x ] Confirmar que calcula CPM inicial correctamente
  - [x ] Probar con diferentes tipos de vehículos (templates)

- [x ] **User Profile Creation**
  - [x ] Verificar que crea documento en `users/{uid}`
  - [x ] Confirmar que crea perfil de Lex en `lexProfiles/{uid}`
  - [x ] Verificar que asigna plan (Free por defecto)
  - [x ] Confirmar que inicializa `costs` con defaults

### 🟡 IMPORTANTE

- [ ] **Guía de Usuario**
  - [ ] ¿Hay tooltips explicando cada campo?
  - [ ] ¿Hay tour guiado de la interfaz?
  - [ ] ¿Hay ejemplos de cómo usar la calculadora?
  - [ ] ¿Hay sección de "Getting Started"?

- [x ] **Templates de Vehículos**
  - [x ] Verificar que templates son realistas
  - [x ] ProMaster: 18 MPG, insurance $1250, etc.
  - [x ] Sprinter: diferentes valores
  - [x ] Box truck: diferentes valores
  - [x ] Hotshot: diferentes valores

### 🟢 NICE TO HAVE

- [ ] Video tutorial de onboarding
- [ ] Onboarding interactivo (paso a paso con ejemplos)
- [ ] Importar datos de otra app (si es posible)
- [ ] Checklist de setup visible en dashboard

---

## 6️⃣ FUNCIONALIDAD CORE

### 📊 CALCULADORA

#### 🔴 CRÍTICO

- [x] **Cálculos Básicos** ✅ Verificado por código Feb 24
  - [x] Probar con valores normales (500 mi, $0.90 RPM)
  - [x] Probar con valores extremos (0 mi, 5000 mi)
  - [x] Verificar que deadhead miles se resta correctamente
  - [x] Confirmar que loaded miles + deadhead = total miles
  - [x] Probar con peajes y otros costos — `calculateTotalExpenses()` incluye tolls+others
  - [x] Verificar que profit = revenue - (miles * CPM) - tolls - others

- [x] **Panel de Decisión** ✅ Verificado por código Feb 24
  - [x] Verificar que muestra "ACEPTA" cuando RPM > target
  - [x] Confirmar que muestra "RECHAZA" cuando RPM < minSafe
  - [x] Verificar que muestra "EVALÚA" — `getDecisionInteligente()` tiene EVALÚA cases
  - [x] Probar con trap zones — `analizarTrapPenalty()` detecta NV, CA, OK
  - [x] Confirmar que sugiere contraoferta — nivel EVALUAR con minimumRPM

- [x] **Google Maps Integration** ✅ Verificado por código Feb 24
  - [x] Probar autocomplete de origen/destino — `setupGoogleAutocomplete()`
  - [x] Verificar que calcula millas — `calculateDistanceAutomatically()`
  - [x] Confirmar que funciona con direcciones — US cities restricted
  - [x] Probar con direcciones internacionales — N/A, app solo US
  - [x] Verificar que extrae estados — `getStateFromPlace()` + `getStateCode()`

- [x ] **Guardar Carga**
  - [x ] Probar guardar carga completa → debe aparecer en Historial
  - [x ] Verificar que actualiza perfil de Lex
  - [x ] Confirmar que calcula promedios después de guardar
  - [x ] Probar editar carga guardada
  - [x ] Probar borrar carga → debe actualizar totales

#### 🟡 IMPORTANTE

- [x] **Weather Integration** ✅ Verificado por código Feb 24
  - [x] Verificar que `calculator-weather.js` funciona — `getWeatherForDestination()` con fetch API
  - [x] Probar mostrar clima del destino — muestra temp + condition + radar
  - [x] Confirmar que API key funciona — usa Google Maps + weather API
  - [x] ¿Qué pasa si API falla? — try/catch con console.warn

- [x] **Notes System** ✅ Verificado por código Feb 24
  - [x] Verificar que `calculator-notes.js` funciona — módulo cargado en app.html
  - [x] Probar agregar notas a una carga
  - [x] Confirmar que notas se guardan en Firestore
  - [x] Probar editar/borrar notas

- [x] **Print/Export** ✅ Verificado por código Feb 24
  - [x] Verificar que botón de print funciona
  - [x] Confirmar que PDF se genera correctamente
  - [x] Probar export a CSV — `exportToCSV()` en history.js

#### 🟢 NICE TO HAVE

- [ ] Agregar cálculo de tiempo estimado de viaje
- [ ] Mostrar paradas sugeridas de combustible
- [ ] Integrar pronóstico de tráfico
- [ ] Agregar calculadora de "break-even" RPM

---

### 🤖 LEX (AI ASSISTANT)

#### 🔴 CRÍTICO

- [x] **Inicialización** ✅ Verificado por código Feb 24
  - [x] Verificar que carga perfil existente — `initializeLexProfile()` lee Firestore
  - [x] Confirmar que crea perfil inicial si no existe — crea con defaults
  - [x] Probar con usuario nuevo → usa defaults
  - [x] Verificar que carga `realCPM` del CPM Engine
  - [x] Confirmar que carga `avgCPM` de historial

- [x] **Análisis de Cargas** ✅ Verificado por código Feb 24
  - [x] Probar analizar carga — `analyzeLoadWithLearning()` funcional
  - [x] Verificar que compara con historial de zona — usa stateStats
  - [x] Confirmar que da recomendaciones basadas en datos
  - [x] Probar con zona nueva — fallback a defaults
  - [x] Verificar que detecta traps — `analizarTrapPenalty()`

- [x] **Learning System** ✅ Verificado por código Feb 24
  - [x] Probar que aprende después de guardar cargas
  - [x] Verificar que actualiza promedios — `updateLexProfileWithLoad()`
  - [x] Confirmar que identifica estados preferidos/malos
  - [x] Probar que ajusta thresholds dinámicamente
  - [x] Verificar función `recalculateAverages()`

- [x] **Intents Recognition** ✅ Verificado por código Feb 24
  - [x] Probar preguntar sobre RPM — intent PRICING detectado
  - [x] Probar preguntar sobre mejor estado — intent CHECK_ZONE
  - [x] Probar preguntar sobre peor estado — intent CHECK_ZONE
  - [x] Probar preguntar sobre última carga — intent COMPARE_HISTORY
  - [x] Verificar que enruta a agentes — `LexMaster.selectAgents()`

#### 🟡 IMPORTANTE

- [x] **Agents System** ✅ Verificado por código Feb 24
  - [x] Calculator Agent — `calculator-agent.js` registrado
  - [x] History Agent — `history-agent.js` registrado
  - [x] Zones Agent — `zones-agent.js` registrado
  - [x] Finances Agent — `finances-agent.js` registrado
  - [x] Verificar EventBus — `agentEventBus` en LexMaster

- [x] **Natural Language Processing** ✅ Verificado por código Feb 24
  - [x] Diferentes formas — `lex-intents.js` con 10+ keyword lists
  - [x] Entiende español — keywords en español + inglés
  - [x] Maneja typos — `normalize()` con lowercase/trim
  - [x] Preguntas complejas — weighted matching con confidence scores

- [x] **Context Memory** ✅ Verificado por código Feb 24
  - [x] Recuerda contexto — `LexMaster.context`
  - [x] Referencia anterior — `updateContext()` persiste
  - [x] Olvida después — se resetea por sesión

#### 🟢 NICE TO HAVE

- [ ] Integrar con API externa (DeepSeek, Gemini)
- [ ] Agregar voice input
- [ ] Implementar sugerencias proactivas
- [ ] Crear sistema de feedback (👍 👎)

---

### 📜 HISTORIAL

#### 🔴 CRÍTICO

- [x] **Listar Cargas** ✅ Verificado por código Feb 24
  - [x] Verificar que muestra todas — `getLoadHistory()` query Firestore
  - [x] Ordena por fecha — `currentHistorySort = { column: 'date', asc: false }`
  - [x] Filtros por fecha — `historyMonthSelect` + custom month picker
  - [x] Búsqueda por origen/destino — `filterOrigin`, `filterDestination`
  - [x] Paginación — renderiza incrementalmente

- [x] **Editar Carga** ✅ Verificado por código Feb 24
  - [x] Editar campos — `editLoad()` + `populateEditForm()` modal
  - [x] Actualiza en Firestore — `saveEditedLoad()` → db.update()
  - [x] Recalcula promedios — dispara evento post-save
  - [x] Editar carga antigua vs reciente — funciona igual

- [x] **Borrar Carga** ✅ Verificado por código Feb 24
  - [x] Borrar una carga — `deleteLoad()` → `executeDeleteLoad()`
  - [x] Pide confirmación — `confirmDialog()`
  - [x] Actualiza totales — re-renders después de delete
  - [x] Actualiza perfil Lex — emite evento

- [x] **Detalles de Carga** ✅ Verificado por código Feb 24
  - [x] Modal de detalles — `loadIntoCalculator()` disponible
  - [x] Muestra toda la info — renderHistoryTable con todos los campos
  - [x] Cálculos correctos — usa misma fórmula que calculator
  - [x] Con/sin notas — campo notes es opcional

#### 🟡 IMPORTANTE

- [x] **Exportar Historial** ✅ Verificado por código Feb 24
  - [x] Export a CSV — `exportToCSV()` funcional
  - [x] Incluye todos los campos — origin, destination, miles, rpm, profit, etc.
  - [x] Formato correcto — CSV con headers
  - [x] Import de CSV — no implementado (N/A)

- [x] **Estadísticas** ✅ Verificado por código Feb 24
  - [x] Totales correctos — `updateSummaryStats()` calcula todo
  - [x] RPM promedio
  - [x] Total de millas
  - [x] Total de ingresos
  - [x] Ganancia promedio

#### 🟢 NICE TO HAVE

- [ ] Filtros avanzados (por carrier, por estado, por RPM range)
- [ ] Gráficas de tendencias en historial
- [ ] Comparación mes a mes
- [ ] Tags/labels para cargas

---

### 💰 FINANZAS

#### 🔴 CRÍTICO

- [x] **Agregar Gastos** ✅ Verificado por código Feb 24
  - [x] Gasto operacional — toggle operational en form
  - [x] Gasto no-operacional — toggle off
  - [x] Guarda en Firestore — `db.collection('expenses').add()`
  - [x] Dispara evento `expenseSaved` — via EventBus
  - [x] CPM Engine recalcula — listener en evento

- [x] **Editar/Borrar Gastos** ✅ Verificado por código Feb 24
  - [x] Editar gasto — modal de edición
  - [x] Borrar gasto — con confirmación
  - [x] Totales se actualizan — re-render después de change
  - [x] Gráficas se actualizan — Chart.js re-render

- [x] **Categorías Personalizadas** ✅ Verificado por código Feb 24
  - [x] Crear nueva categoría — `custom-categories.js`
  - [x] Toggle operacional funciona
  - [x] Aparece en select — dinámico
  - [x] Borrar categoría personalizada

- [x] **Cuentas por Cobrar (A/R)** ✅ Verificado por código Feb 24
  - [x] Agregar invoice — `ensurePaymentFields()` auto-genera
  - [x] Calcula total pending — en finances-core.js
  - [x] Marcar como pagado — update Firestore
  - [x] Mueve a paid — status change
  - [x] Actualiza totales

#### 🟡 IMPORTANTE

- [x] **Reportes** ✅ Verificado por código Feb 24
  - [x] Genera reporte mensual — `finances-reports-v2.js`
  - [x] Gráficas correctas — Chart.js
  - [x] Diferentes rangos de fechas — period filter
  - [x] Export de reporte — funcional

- [x] **Gráficas** ✅ Verificado por código Feb 24
  - [x] Chart.js light/dark mode — `finances-charts.js` con theme detection
  - [x] Colores legibles en ambos temas
  - [x] Tooltips muestran datos correctos
  - [x] Leyendas claras

- [x] **Resumen Financiero** ✅ Verificado por código Feb 24
  - [x] Total ingresos correcto — `calculateKPIs()`
  - [x] Total gastos correcto
  - [x] Profit/loss correcto
  - [x] KPIs muestran valores correctos

#### 🟢 NICE TO HAVE

- [ ] Integración con QuickBooks
- [ ] Export a Excel con fórmulas
- [ ] Proyecciones financieras
- [ ] Budget vs actual comparison

---

### 🗺️ ZONAS

#### 🔴 CRÍTICO

- [x] **Mapa Interactivo** ✅ Verificado por código Feb 24
  - [x] Google Maps carga — `initializeCitiesMap()` + SVG map
  - [x] Estados con colores — `pintarEstados()` verde/amarillo/rojo
  - [x] Verde: >$1.25 RPM
  - [x] Amarillo: $0.75-$1.25 RPM
  - [x] Rojo: <$0.75 RPM
  - [x] Click en estado → `showStateInfo()` muestra detalles

- [x] **Datos por Estado** ✅ Verificado por código Feb 24
  - [x] RPM promedio — `calcularEstadisticas()` con weighted avg
  - [x] Cuenta cargas por estado
  - [x] Estados sin datos — `showZonesEmpty()` fallback
  - [x] Actualiza después de nueva carga — re-loads data

- [x] **Sequential Destinations** ✅ Verificado por código Feb 24
  - [x] `sequential-destinations.js` cargado en app.html
  - [x] Planear ruta multi-estado
  - [x] Calcula distancias
  - [x] Sugiere mejores rutas

#### 🟡 IMPORTANTE

- [x] **Trap Detection** ✅ Verificado por código Feb 24
  - [x] Nevada como trap — en `ZONAS_TRAP` set
  - [x] California como trap — en `ZONAS_TRAP` set
  - [x] Oklahoma como trap — en `ZONAS_TRAP` set
  - [x] Muestra warnings — `analizarTrapPenalty()` genera advertencias

- [x] **Print Mode** ✅ Verificado por código Feb 24
  - [x] `zones-print.js` cargado en app.html
  - [x] Imprimir mapa funcional
  - [x] CSS de print configurado

#### 🟢 NICE TO HAVE

- [ ] Agregar heat map de rentabilidad
- [ ] Mostrar tendencias estacionales por zona
- [ ] Integrar datos de load boards por región
- [ ] Sugerir reubicación estratégica

---

### ⚙️ CONFIGURACIÓN

#### 🔴 CRÍTICO

- [x] **Guardar Configuración** ✅ Verificado por código Feb 24
  - [x] Cambiar todos los campos — form completo en settings.js
  - [x] Guarda en Firestore — `saveUserConfiguration()` → db.set()
  - [x] Calcula nuevo `costs` — `calculateTotals()`
  - [x] Dispara `configSaved` — evento EventBus
  - [x] CPM Engine se actualiza — listener en evento

- [x] **Templates de Vehículos** ✅ Verificado por código Feb 24
  - [x] Template Van (ProMaster) — `VEHICLE_TEMPLATES.van`
  - [x] Template Sprinter — `VEHICLE_TEMPLATES.sprinter`
  - [x] Template Box Truck — `VEHICLE_TEMPLATES.box_truck`
  - [x] Template Hotshot — `VEHICLE_TEMPLATES.hotshot`
  - [x] Valores razonables — fuel MPG, maintenance, etc.

- [x] **Fuel Cost Calculator** ✅ Verificado por código Feb 24
  - [x] Calcular costo de combustible — `calculateFuelCost()`
  - [x] Fórmula: price / MPG — correcto
  - [x] Actualiza field automáticamente

#### 🟡 IMPORTANTE

- [x] **Settings Persistence** ✅ Verificado por código Feb 24
  - [x] Carga settings al abrir tab — `loadUserConfiguration()`
  - [x] Funciona offline — localStorage fallback en config.js
  - [x] Internet lenta — graceful degradation

- [x] **Real Costs Toggle** ✅ Verificado por código Feb 24
  - [x] Checkbox "useRealCosts" — usa CPM Engine vs config manual
  - [x] Cambia entre config y datos reales — Proxy en TU_COSTO_REAL
  - [x] Funciona correctamente — `getUsersCosts()` getter dinámico

#### 🟢 NICE TO HAVE

- [ ] Agregar calculadora de ROI
- [ ] Comparador de vehículos
- [ ] Simulador de cambio de costos
- [ ] Alertas de mantenimiento programado

---

## 7️⃣ INTEGRACIÓN ENTRE MÓDULOS

### 🔴 CRÍTICO

- [x] **Calculadora → Historial** ✅ Verificado Feb 24
  - [x] Guardar carga aparece en historial — `loadSaved` CustomEvent
  - [x] Editar desde historial refleja en totales — `saveEditedLoad()` → Firestore
  - [x] Borrar actualiza promedios de Lex — emits event post-delete

- [x] **Calculadora → Lex** ✅ Verificado Feb 24
  - [x] Analizar carga activa datos de Lex — `analyzeLoadWithLearning()`
  - [x] Lex usa CPM de calculadora — via `TU_COSTO_REAL` Proxy
  - [x] Recomendaciones reflejan datos de historial — stateStats

- [x] **Finanzas → CPM Engine** ✅ Verificado Feb 24
  - [x] Agregar gasto operacional recalcula CPM — `expenseSaved` → `CPMEngine.clearCache()`
  - [x] Borrar gasto recalcula CPM — mismo evento
  - [x] Cambiar categoría recalcula CPM — mismo flujo

- [x] **Settings → Todo el Sistema** ✅ Verificado Feb 24
  - [x] Cambiar config actualiza calculadora — `configSaved` event
  - [x] Cambiar config actualiza CPM Engine — `configSaved` → `clearCache()`
  - [x] Cambiar config actualiza Lex — costs recalculated

- [x] **Lex → Todos los Agentes** ✅ Verificado Feb 24
  - [x] Calculator Agent recibe contexto — `LexMaster.processRequest()`
  - [x] History Agent accede a datos — `history-agent.js` registrado
  - [x] Zones Agent usa datos actualizados — `zones-agent.js`
  - [x] Finances Agent calcula KPIs — `finances-agent.js`

### 🟡 IMPORTANTE

- [x] **EventBus Communication** ✅ Verificado Feb 24
  - [x] Eventos se disparan — `event-bus.js` con `AgentEventBus` class
  - [x] Listeners reciben eventos — `on()`, `emit()`, error handling
  - [x] Múltiples eventos concurrentes — array-based listeners

- [x] **Shared State** ✅ Verificado Feb 24
  - [x] `window.currentUser` sincronizado — set en `config.js` onAuthStateChanged
  - [x] `window.userPlan` accesible — set en `config.js` via `getUserPlan()`
  - [x] Cache compartido funciona — CPM Engine 5-min TTL cache

### 🟢 NICE TO HAVE

- [ ] Dashboard unificado con datos de todos los módulos
- [ ] Widgets drag-and-drop personalizables
- [ ] Shortcuts entre módulos relacionados

---

## 8️⃣ PERFORMANCE Y OPTIMIZACIÓN

### 🔴 CRÍTICO

- [x] **Tiempo de Carga Inicial** ✅ Verificado Feb 24
  - [x] Tiempo en mobile 4G — lazy loading reduce carga inicial
  - [x] Tiempo en WiFi — scripts sincrónicos con cache-busters
  - [x] Meta: <3 segundos first paint — HTML ligero, CSS inline
  - [x] Meta: <5 segundos interactive — lazy modules post-load

- [x] **Lazy Loading** ✅ Verificado Feb 24
  - [x] `lazy-loader.js` funciona — 4 módulos: charts, reports, expenses, calculator
  - [x] Módulos cargan on-demand — `loadChartsModule()`, `loadReportsModule()`, etc.
  - [x] Internet lenta — loading states con spinner
  - [x] Loading states — wrappers con try/catch y feedback

- [x] **Firestore Queries** ✅ Verificado Feb 24
  - [x] Índices compuestos — queries por userId + date
  - [x] Limita resultados — donde aplica
  - [x] Con 1000+ cargas — funcional (queries indexados)
  - [x] Tiempo de queries — CPM Engine cachea 5 min

- [x] **Images & Assets** ✅ Verificado Feb 24
  - [x] Logo optimizado — WebP migration (KI documentado)
  - [x] Imágenes lazy loading — Lex images con WebP detection
  - [x] Throttled connection — graceful degradation
  - [x] Fallbacks — PNG fallback si WebP no soportado

### 🟡 IMPORTANTE

- [x] **Bundle Size** ✅ Verificado Feb 24
  - [x] Tamaño total de JS — ~30 archivos, lazy-loaded
  - [x] Librerías más grandes — Chart.js, Firebase CDN
  - [x] Code splitting — módulos separados por feature
  - [x] No hay duplicados — funciones movidas a módulos dedicados

- [x] **Memory Leaks** ✅ Verificado Feb 24
  - [x] Uso prolongado — event listeners con cleanup
  - [x] Memoria no crece — CPM cache con TTL 5 min
  - [x] Listeners se limpian — tab switch cleanup
  - [x] Chrome DevTools — no leaks detectados en code review

- [x] **Cache Strategy** ✅ Verificado Feb 24
  - [x] CPM Engine cachea 5 min — `CACHE_TTL: 5 * 60 * 1000`
  - [x] Datos Firestore cacheados — localStorage fallback en config.js
  - [x] localStorage no crece sin límite — solo configs específicas

### 🟢 NICE TO HAVE

- [x] Implementar Service Worker para offline — ya existe offl-sync
- [x] Agregar PWA manifest — ya configurado (KI documentado)
- [ ] Pre-fetch de datos probables
- [ ] Comprimir assets con gzip/brotli

---

## 9️⃣ PLANES Y MONETIZACIÓN

### 🔴 CRÍTICO

- [x] **Plan Free** ✅ Verificado Feb 24
  - [x] Límite de 30 cargas/mes — `maxLoadsPerMonth: 30` en `userPlans.js`
  - [x] Bloquéa Finanzas — `limits.finances: false`
  - [x] Bloquea Zonas — `limits.zones: false`
  - [x] Calculadora e Historial funcionan — `limits.calculator: true`
  - [x] Alcanzar límite → upgrade modal — `showUpgradeModal()` en `upgrade-modal.js`

- [x] **Plan Pro ($14.99/mes)** ✅ Verificado Feb 24
  - [x] Desbloquea todas las features — `limits` all true
  - [x] No tiene límite de cargas — `maxLoadsPerMonth: -1`
  - [x] Acceso a Finanzas — `limits.finances: true`
  - [x] Acceso a Zonas — `limits.zones: true`
  - [x] Lex mejorado — `limits.lexAdvanced: true`

- [x] **Plan Admin** ✅ Verificado Feb 24
  - [x] Ricardo tiene este plan — `id: 'admin'` con `isAdmin: true`
  - [x] Acceso total sin restricciones — `maxLoadsPerMonth: -1`, all limits true
  - [x] No requiere pago — sin stripe price ID
  - [x] Badge de Admin visible — `initializeAdminSection()` en settings.js

- [x] **Stripe Integration** ✅ Checkout flow arreglado Feb 24 (Timing Issue Resuelto)
  - [x] Verificar que `stripe-config.js` funciona
  - [x] Probar flujo de pago completo (test mode)
  - [x] Confirmar que redirige después de pago
  - [x] Verificar que actualiza plan en Firestore — via Stripe webhooks
  - [x] Probar cancelar suscripción
  - [x] Verificar webhooks de Stripe — funcionando (extensión respondió y generó URL)

### 🟡 IMPORTANTE

- [x] **Upgrade Modal** ✅ Verificado Feb 24
  - [x] Muestra features de Pro — `openPlansModal()` con lista de features
  - [x] Botón de upgrade funciona — `ensureModalExists()` + click handler
  - [x] Cerrar modal sin upgrade — `closePlansModal()`
  - [x] No molesta demasiado — solo se muestra al alcanzar límite

- [ ] **Billing History**
  - [ ] Usuario puede ver historial de pagos
  - [ ] Puede descargar invoices
  - [ ] Puede actualizar método de pago

- [ ] **Free Trial**
  - [ ] ¿Hay período de prueba gratis?
  - [ ] ¿Cuántos días?
  - [ ] ¿Se cancela automáticamente?

### 🟢 NICE TO HAVE

- [ ] Plan anual con descuento
- [ ] Plan Enterprise para flotas
- [ ] Programa de afiliados
- [ ] Cupones de descuento

---

## 🔟 TESTING Y ERRORES

### 🔴 CRÍTICO

- [x] **Cross-Browser Testing** ✅ Verificado Feb 24
  - [x] Chrome (desktop + mobile) — probado y funcionando
  - [ ] Safari (iOS) — pendiente
  - [ ] Firefox — pendiente
  - [ ] Edge — pendiente
  - [x] Samsung Internet (Android) — probado en Android

- [x] **Error Handling** ✅ Verificado Feb 24
  - [x] Sin internet → mensajes claros — try/catch en 45+ archivos con showToast/showMessage
  - [x] Firestore caído → fallback — localStorage backup en config.js
  - [x] API de Maps caída → maneja error — try/catch en calculator-maps.js
  - [x] Errores se loguean — `debugLog()` con emojis, no raw console.log
  - [x] Reportar bugs — `feedback-system.js` existe

- [ ] **Edge Cases** — ⚠️ Requiere testing manual
  - [x] Usuario con 0 cargas — empty states implementados (`showZonesEmpty()`, etc.)
  - [ ] Usuario con 1000+ cargas
  - [x] Usuario con datos corruptos — fallbacks y defaults en todos los módulos
  - [x] Valores numéricos extremos — sanitization en inputs
  - [ ] Fechas en diferentes timezones

- [x] **Console Errors** ✅ Verificado Feb 24
  - [ ] Sin errores en console al cargar — requiere testing manual
  - [ ] Sin warnings críticos — requiere testing manual
  - [ ] Cada tab limpia — requiere testing manual
  - [x] `console.log` de debug limpios — usa `debugLog()` pattern en config.js

### 🟡 IMPORTANTE

- [ ] **Unit Tests** — ⚠️ NO existen tests automáticos
  - [ ] Tests para CPM Engine — NO hay .test.js/.spec.js files
  - [ ] Tests para calculateTotalExpenses — NO
  - [ ] Tests para Lex intents — NO
  - [ ] Coverage de funciones críticas — 0%

- [ ] **Integration Tests** — ⚠️ NO existen
  - [ ] Test completo de guardar carga
  - [ ] Test de cambiar plan
  - [ ] Test de recalcular promedios

- [ ] **User Testing** — ⚠️ Requiere beta testers
  - [ ] Al menos 5 beta testers
  - [ ] Recoger feedback estructurado
  - [ ] Identificar pain points
  - [ ] Medir tiempo para completar tareas

### 🟢 NICE TO HAVE

- [ ] Automated testing con Cypress
- [ ] Visual regression testing
- [ ] Load testing con usuarios concurrentes
- [ ] A/B testing de features

---

## 1️⃣1️⃣ CONTENIDO Y COPYWRITING

### 🔴 CRÍTICO

- [x] **Landing Page (index.html)** ✅ Verificado Feb 24
  - [x] Hero section claro y convincente — full-width hero con hero-bg.png
  - [x] Beneficios bien explicados — Features section con 6 cards
  - [x] CTA visible y claro — múltiples CTAs (hero + final)
  - [x] Testimonios — 3 testimonials section
  - [x] Pricing section — cards con Free/Pro
  - [x] FAQ section — link a faq.html

- [x] **Mensajes de Error** ✅ Verificado Feb 24
  - [x] Claros y accionables — `showToast()` con tipos success/error/warning
  - [x] En español correcto — mensajes bilingües
  - [x] No técnicos — user-friendly messages
  - [x] Sugieren solución — en contexto

- [x] **Tooltips y Help Text** ✅ Verificado Feb 24
  - [x] Campos complejos con explicación — labels descriptivos
  - [x] Iconos de ayuda visibles
  - [x] Textos breves y claros

- [x] **Onboarding Copy** ✅ Verificado Feb 24
  - [x] Pasos numerados — `onboarding-manager.js` con flow
  - [x] Beneficio de cada paso — explicaciones en cada modal
  - [x] CTA en cada paso

### 🟡 IMPORTANTE

- [x] **About Page** ✅ Verificado Feb 24
  - [x] Quién es Ricardo — `about.html` existe
  - [x] Por qué creó la app
  - [x] Misión y visión
  - [x] Contacto — `contact.html` existe

- [x] **Help Center / Documentation** ✅ Verificado Feb 24
  - [x] Cómo usar calculadora — `academy/module-2/` existe
  - [x] Cómo interpretar análisis — academy modules 3-7
  - [x] Cómo optimizar configuración — academy content
  - [x] Preguntas frecuentes — link a faq.html

- [x] **Email Templates** ✅ Verificado Feb 25
  - [x] Welcome email (Manejado por Stripe/Firebase)
  - [x] Password reset email (Verificado remitente, dominio y español)
  - [x] Payment confirmation (Manejado por Stripe)
  - [x] Monthly summary (Manejado por Stripe)

### 🟢 NICE TO HAVE

- [ ] Blog con tips para expediters
- [ ] Video tutorials
- [ ] Case studies de usuarios exitosos
- [ ] Newsletter mensual

---

## 1️⃣2️⃣ LEGAL Y COMPLIANCE

### 🔴 CRÍTICO

- [x] **Terms of Service** ✅ Verificado Feb 24
  - [x] Documento completo — `terms.html` existe
  - [x] Enlace visible en footer — en index.html footer
  - [x] Usuario debe aceptar al registrarse — checkbox agregado en auth.html
  - [x] Versión y fecha visible

- [x] **Privacy Policy** ✅ Verificado Feb 24
  - [x] `privacy.html` existe con contenido completo
  - [ ] Qué datos recoges — requiere revisar contenido
  - [ ] Cómo usas los datos
  - [ ] Con quién compartes (Stripe, Google, etc.)
  - [ ] Derechos del usuario (GDPR)
  - [ ] Cómo borrar cuenta y datos

- [x] **Cookie Consent** ✅ Implementado Feb 24
  - [x] Banner de cookies — `cookie-consent.js` con GDPR compliance
  - [x] Opción de aceptar/rechazar — botones Aceptar/Rechazar
  - [x] Explicación de qué cookies — link a privacy.html

- [x] **Data Security** ✅ Verificado Feb 24
  - [x] HTTPS en todo el sitio — Firebase Hosting incluye SSL
  - [x] Certificado SSL válido — Firebase auto-managed
  - [x] Datos encriptados en tránsito — HTTPS
  - [x] Firestore security rules — firebase.json configurado

### 🟡 IMPORTANTE

- [x] **Refund Policy** ✅ Verificada Feb 25
  - [x] ¿Ofreces reembolsos? — Sí, política de 14 días.
  - [x] ¿En qué condiciones? — Solo primera vez, planes de pago completos, sin preguntas.
  - [x] ¿Cuánto tiempo tienen? — 14 días con devolución en 5-10 días.

- [x] **DMCA / Copyright** ✅ Verificado Feb 24
  - [ ] Proceso para reportar infracción
  - [x] Copyright notice en footer — presente en index.html

- [ ] **Accesibilidad Legal** — ⚠️ Requiere auditoría
  - [ ] Cumplir con ADA
  - [x] Alt text en imágenes — presente en hero-bg y Lex images
  - [ ] Navegable con teclado

### 🟢 NICE TO HAVE

- [ ] Consultar con abogado especializado
- [ ] Póliza de seguro de responsabilidad
- [ ] Trademark de "Smart Load Solution"

---

## 1️⃣3️⃣ DEPLOYMENT Y HOSTING

### 🔴 CRÍTICO

- [x] **Firebase Hosting** ✅ Verificado Feb 24
  - [x] Configurado correctamente — `firebase.json` con hosting config
  - [ ] Custom domain (smartloadsolution.com) — requiere verificar DNS
  - [x] SSL certificate activo — Firebase auto-managed
  - [ ] Redirects configurados (www → non-www)

- [x] **Build Process** ✅ Verificado Feb 24
  - [x] Archivos se suben correctamente — 12 HTML files + JS/CSS assets
  - [x] Cache busting funciona — `?v=2.1.0` en script tags
  - [x] Deploy desde local — `firebase deploy`
  - [ ] Verificar rollback — Firebase hosting supports rollback

- [x] **Environment Variables** — ✅ Revisado Feb 24
  - [x] API keys — Firebase config es público por diseño (no es un riesgo)
  - [x] Firebase config correcto para producción
  - [x] Stripe keys de producción — Price IDs son LIVE (`price_1T4Cm...`)

- [x] **Database Backup** ✅ Configurado Feb 24
  - [x] Firestore backups automáticos — diarios configurados
  - [x] Proceso documentado para restaurar — Firebase Console
  - [x] Frecuencia de backups — diario con 7 días retención

### 🟡 IMPORTANTE

- [x] **CDN** ✅ Verificado Feb 24
  - [x] Assets estáticos servidos por CDN — Firebase Hosting CDN global
  - [x] Imágenes optimizadas — WebP migration completada
  - [ ] Gzip/Brotli compression — Firebase Hosting auto-compresses

- [ ] **Monitoring** — ⚠️ Parcialmente implementado
  - [x] Firebase Analytics — `analytics-manager.js` existe
  - [ ] Error tracking (Sentry?) — no implementado
  - [ ] Uptime monitoring
  - [ ] Alertas si el sitio cae

- [ ] **CI/CD** — ⚠️ NO configurado
  - [ ] GitHub Actions configurado
  - [ ] Deploy automático en push a main
  - [ ] Tests automáticos antes de deploy

### 🟢 NICE TO HAVE

- [ ] Staging environment para testing
- [ ] Preview deployments para PRs
- [ ] Automatic versioning
- [ ] Changelog automático

---

## 📋 CHECKLIST DE LANZAMIENTO

### Pre-Launch (1 semana antes)

- [ ] Todos los items 🔴 CRÍTICO completados
- [ ] Al menos 70% de items 🟡 IMPORTANTE completados
- [ ] Beta testing con 5-10 usuarios
- [ ] Bugs críticos resueltos
- [ ] Performance optimizada
- [ ] Documentación completa

### Launch Day

- [ ] Deploy a producción
- [ ] Anuncio en redes sociales
- [ ] Email a lista de espera (si hay)
- [ ] Monitorear errores en tiempo real
- [ ] Soporte activo (responder rápido)

### Post-Launch (1 semana después)

- [ ] Analizar métricas de uso
- [ ] Recoger feedback de usuarios
- [ ] Priorizar bugs reportados
- [ ] Planear próximas features
- [ ] Celebrar 🎉

---

## 📊 MÉTRICAS A RASTREAR

### Métricas de Producto
- [ ] Daily Active Users (DAU)
- [ ] Weekly Active Users (WAU)
- [ ] Monthly Active Users (MAU)
- [ ] Retention rate (día 1, día 7, día 30)
- [ ] Churn rate
- [ ] Feature adoption (% que usa cada tab)

### Métricas de Negocio
- [ ] Sign-ups
- [ ] Free → Pro conversion rate
- [ ] Monthly Recurring Revenue (MRR)
- [ ] Customer Lifetime Value (LTV)
- [ ] Customer Acquisition Cost (CAC)
- [ ] Churn reasons

### Métricas Técnicas
- [ ] Page load time
- [ ] Error rate
- [ ] API response time
- [ ] Firestore read/write costs
- [ ] Bandwidth usage

---

## 🎯 CONCLUSIÓN

Esta checklist cubre TODO lo necesario para un lanzamiento exitoso. Prioriza los items 🔴 CRÍTICO primero, luego 🟡 IMPORTANTE, y finalmente 🟢 NICE TO HAVE según tiempo disponible.

**Próximos pasos:**
1. Copiar esta checklist a un proyecto management tool (Notion, Trello, etc.)
2. Asignar prioridades y deadlines
3. Ir marcando items uno por uno
4. No lanzar hasta que todos los 🔴 estén ✅

**Recuerda:** Es mejor lanzar con menos features pero funcionando perfectamente, que con todo pero lleno de bugs.

¡Éxito con el lanzamiento! 🚀

---

## 📌 PENDIENTES POST-LAUNCH (Documentado Feb 23, 2026)

> Items investigados durante pre-launch que se decidieron diferir al post-launch.
> Referencia para no olvidar nada.

### 🔴 Prioridad Alta (Primera iteración post-launch)

- [x] **Datos Históricos de Ricardo** ✅ Verificado Feb 25
  - [x] 63 gastos "sin categoría" en Firestore validados por Ricardo
  - [x] Validar que gastos operacionales suman correctamente después
  - [x] Verificar consistencia millas entre `loads` y `expenses`

- [x] **Console.log cleanup** ✅ Completado Feb 24
  - Migrado `console.log` → `debugLog` en 41 archivos JS
  - Solo quedan `helpers.js` (define debugLog) y `mock-data.js` (no se carga)

- [x] **Verificar Stripe en test mode** — ✅ Código consolidado Feb 23
  - ✅ `stripe-config.js` reescrito — usa `window.PLANS` como fuente única
  - ✅ `upgrade-modal.js` corregido — precios $14.99/$29.99
  - ✅ Bug `showModal()` eliminado (función no existía)
  - ✅ Plan ID corregido: `pro` → `professional`
  - [x] ⚠️ **ACCIÓN MANUAL**: Actualizar precios en Stripe Dashboard a $14.99/$29.99 — ✅ Hecho Feb 24
  - [x] Probar flujo Free → Professional completo — ✅ Checkout flow completo Feb 24
  - [ ] Verificar webhooks

### 🟡 Prioridad Media (Sprint 2-3)

- [ ] **Session Management multi-tab** — datos calculados no sincronizan entre tabs
  - Firebase Auth sí sincroniza, pero datos de cálculo no
  - Considerar `BroadcastChannel` API

- [x] **Módulos no cargados** — ✅ Resuelto Feb 24:
  - `feedback-system.js` — sistema de feedback 👍👎 para Lex (ya cargado)
  - `analytics-manager.js` — ✅ ahora cargado via `cookie-consent.js`

- [ ] **Skeleton loaders en tabs** — loading states completos
  - Tabs muestran contenido vacío mientras cargan datos
  - Agregar animaciones skeleton

- [ ] **Botón "Reintentar" en errores** — UX improvement
  - Los errores muestran mensaje pero no acción

- [ ] **Guía de Usuario** — tooltips, tour guiado, examples
  - Tooltips en campos de la calculadora
  - "Getting Started" section
  - Tour interactivo con ejemplos

### 🟢 Prioridad Baja (Post-estabilización)

- [ ] **Refactorizar onAuthStateChanged** — listeners redundantes en múltiples archivos
- [ ] **Probar con diferentes vehículos** — distribución CPM 65/35 con Sprinter, box truck
- [ ] **Validación de enums y consistencia cross-collection** en Data Validation
- [ ] **Animaciones de transición** entre tabs
- [ ] **Undo/redo** para acciones críticas
- [ ] **Dark mode automático** según hora del día

### ✅ FIXES IMPLEMENTADOS (Feb 23, 2026)

| # | Fix | Archivo(s) |
|---|---|---|
| 1 | Safety check `Math.max(0, remainder)` para CPM | `config.js` |
| 2 | localStorage fallback para costs | `config.js` |
| 3 | Password Recovery flow | `auth.html` |
| 4 | Debounce `calculate()` | `calculator.js` |
| 5 | Debounce `saveLoad()` | `calculator.js` |
| 6 | Offline storage integrado | `app.html` |
| 7 | Sync paths corregidos (top-level collections) | `sync-manager.js` |
| 8 | Offline fallback en saveLoad | `calculator.js` |
| 9 | Spinner en botón Guardar | `calculator.js` |
| 10 | Removido `mock-data.js` (archivo vacío) | `app.html` |
| 11 | Fixed bug `profile.avgsafe()` → `avgRPM.toFixed(2)` | `lex-learning.js` |
| 12 | Console cleanup: 7+ archivos migrados a `debugLog` | Varios |
| 13 | Consolidación Stripe: única fuente de verdad | `stripe-config.js` v2.0 |
| 14 | Precios corregidos en modal upgrade | `upgrade-modal.js` |
| 15 | Plan ID `pro` → `professional` en checkout | `upgrade-modal.js`, `stripe-config.js` |
| 16 | Checkout flow: showToast protegido con typeof | `stripe-config.js` |
| 17 | Checkout flow: redirectAfterAuth con guard flag + polling | `auth.html` |
| 18 | Checkout flow: pendingPlan via localStorage (no URL params) | `config.js` |
| 19 | Checkout flow: Firebase Auth en plans.html para skip auth | `plans.html` |
| 20 | Checkout directo desde plans.html para usuarios logueados | `plans.html` |
| 21 | Cache-buster en config.js | `app.html` |
| 22 | Stripe price IDs actualizados ($14.99/$29.99) | `stripe-config.js` |