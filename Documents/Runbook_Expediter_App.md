
# Runbook – Expediter Load Calculator (Mapa & Debug)

Documento operativo para entender el flujo, ubicar funciones y resolver fallas rápido. Mantenerlo a mano cuando algo no funcione.

---

## 0) Convenciones y dónde mirar
- **Archivos clave:** `app.html`, `main.js`, `tabs.js`, `calculator.js`, `history.js`, `dashboard.js`, `finances.js`, `zones.js`, `settings.js`, `helpers.js`, `config.js`.
- **Colecciones Firebase:** `users` (config), `loads` (cargas), `expenses` (gastos reales).
- **Logs comunes:** todos imprimen prefijos (ej.: `🚀 [MAIN]`, `💰 [FINANCES]`, `📋 [HISTORY]`).

---

## 1) Flujo global de la App
1. **Landing → Auth**  
   - `index.html / resources.html` → navegación.  
   - `auth.html` → login/registro (`onAuthStateChanged`).  
2. **Auth → App**  
   - Carga `app.html`.  
3. **Navegación interna**  
   - `main.js` → `setupNavigation()` y `openTab(tabId)`.  
   - `loadTabData(tabId)` invoca la función del módulo correspondiente.  
4. **Fallback de tabs (si algo falla en main)**  
   - `tabs.js` activa **Calculator** por defecto y cambia pestañas sin romper.  

---

## 2) Calculadora (📊 `calculator.js`)
**Entrada:** usuario llena origen/destino, millas, RPM/rate, tolls/otros.  
**Funciones principales:**
- `calculate()` → calcula costos/ingresos y muestra **Decision Panel**.
- `showDecisionPanel()` → estilos y resumen rápido.
- `saveLoad()` → guarda la carga en **`loads`**.
- `updateMap()` / `openGoogleMapsDirections()` → mapa de ruta.

**Debug rápido:**
- Si no guarda: revisar **auth/userId**.  
- Si panel no aparece: verificar inputs y eventos.  
- Si el mapa no carga: revisar API Keys.  

---

## 3) Historial (📋 `history.js`)
**Funciones principales:**
- `getLoadHistory()` ← lee de **`loads`**.  
- `renderHistoryTable()` → pinta tabla.  
- `editLoad(id)` / `deleteLoad(id)` → actualizan/borran en `loads`.  
- `exportToCSV()` / `exportToExcel()`.  

**Debug rápido:**
- Tabla vacía → revisar `userId` o docs en `loads`.  
- Edición no persiste → revisar `docRef.update(...)`.  

---

## 4) Dashboard (📈 `dashboard.js`)
**Funciones principales:**
- `loadDashboardData()` ← lee de `loads`.  
- `updateDashboard(period)` → KPIs.  
- `renderCharts()` → Chart.js.  

**Debug rápido:**
- Error “`loads is not defined`” → asegurar que `loads` esté definido antes de mapear.  

---

## 5) Finanzas (💰 `finances.js`)
**Funciones principales:**
- `loadFinancialData(period)` ← de `loads` + `expenses`.  
- `updateFinancialCharts()`.  
- `renderExpensesList()`.  
- `saveExpenseToFirebase()` / `deleteExpense()`.  

**Regla:** usa **gastos manuales reales (expenses)**.  

**Debug rápido:**
- Resumen en cero → confirmar docs en `expenses` del período.  
- Gráfica vacía → revisar arrays y sumatorios.  

---

## 6) Zonas / Heatmap (🗺️ `zones.js`)
**Funciones principales:**
- `loadZonesData()`.  
- `calcularEstadisticas()`.  
- `updateMapColors()`.  
- `renderZonesTable()`.  

**Debug rápido:**
- Mapa sin color → revisar IDs del SVG y state codes.  

---

## 7) Configuración (⚙️ `settings.js`)
**Funciones principales:**
- `loadSettings()` ← lee de `users`.  
- `saveUserSettings()` → guarda en `users`.  
- `displayCurrentRealCosts()`.  

**Debug rápido:**
- Valores no cargan → revisar doc en `users`.  

---

## 8) Esquemas de datos
**`loads`:**
```
userId, date, origin, destination, companyName, notes,
loadedMiles, totalMiles, rpm, totalCharge,
fuelCost, operatingCost, tolls, otherCosts, netProfit
```

**`expenses`:**
```
userId, date, type, description, amount
```

**`users`:**
```
realCosts, preferencias UI, etc.
```

---

## 9) Arranque y Navegación
- `setupNavigation()` conecta botones `.tab-link`.  
- `openTab(tabId)` abre tab.  
- `loadTabData(tabId)` llama funciones:  
  - calculator: nada.  
  - history: `getLoadHistory()`.  
  - dashboard: `loadDashboardData()`.  
  - finances: `loadFinancialData()`.  
  - zones: `loadZonesData()`.  
  - settings: `loadSettings()`.  

---

## 10) Checklist por síntoma
**No salen gastos:** revisar `expenses` + `loadFinancialData`.  
**Dashboard rompe:** revisar `loadDashboardData`.  
**Tabs no cambian:** `setupNavigation()` / `openTab()`.  
**Mapa muestra mal:** revisar `getStateCode()`.  
**Cargas no guardan:** revisar `saveLoad()` + auth.  

---

## 11) Snippets útiles (Consola)
**Contar cargas:**
```js
firebase.firestore().collection('loads').where('userId','==', currentUser.uid).get().then(s=>console.log('Loads:', s.docs.length))
```

**Contar gastos mes:**
```js
firebase.firestore().collection('expenses').where('userId','==', currentUser.uid).get()
 .then(s=>s.docs.map(d=>d.data()).filter(e=>e.date?.slice(0,7)==='2025-07'))
 .then(arr=>console.log('Expenses en 2025-07:', arr.length))
```

---

## 12) Mantenimiento del Runbook
- Actualizar cuando se añadan campos o funciones.  
- Agregar fixes recurrentes al checklist.  

---
