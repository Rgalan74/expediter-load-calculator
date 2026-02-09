# Configurar Google Analytics 4 - SmartLoad

## 📊 Setup de Google Analytics 4

### Paso 1: Crear Propiedad GA4

1. **Ir a Google Analytics**
   - Ve a [analytics.google.com](https://analytics.google.com)
   - Inicia sesión con tu cuenta de Google

2. **Crear Cuenta** (si no tienes)
   - Click en "Empezar a medir"
   - Nombre de cuenta: "SmartLoad"
   - Click "Siguiente"

3. **Crear Propiedad**
   - Nombre de propiedad: "SmartLoad Production"
   - Zona horaria: Tu zona (ej: PST)
   - Moneda: USD
   - Click "Siguiente"

4. **Detalles del Negocio**
   - Categoría: Tecnología / Software
   - Tamaño: Pequeña empresa
   - Objetivos: Analizar comportamiento de usuarios
   - Click "Crear"

5. **Aceptar Términos**
   - Lee y acepta
   - Click "Acepto"

### Paso 2: Obtener ID de Medición

1. **Ir a Configuración**
   - En la propiedad → "Flujos de datos"
   - Click "Agregar flu jo" → "Web"

2. **Configurar Flujo Web**
   - URL: `https://smartloadsolution.com`
   - Nombre: "SmartLoad Web App"
   - Click "Crear flujo"

3. **Copiar ID de Medición**
   - Verás algo como: `G-XXXXXXXXXX`
   - Copia este ID (lo necesitarás)

### Paso 3: Integrar en SmartLoad

1. **Abrir archivo de analytics**
   - Abre `public/js/analytics-manager.js`
   - Busca línea: `this.GA4_ID = 'G-XXXXXXXXXX';`
   - Reemplaza con tu ID real
   - Guarda el archivo

2. **Deploy cambios**
   ```powershell
   cd "g:\My Drive\MisProyectos\expediter-app"
   firebase deploy --only hosting
   ```

3. **Verificar instalación**
   - Ve a tu app: smartloadsolution.com
   - Abre DevTools (F12)
   - En Console, busca: "✅ Google Analytics 4 loaded"
   - Si lo ves, ¡funciona!

### Paso 4: Configurar Eventos Personalizados

Los siguientes eventos ya están configurados en el código:

#### Eventos Automáticos
- `page_view` - Cuando se visita una página
- `user_engagement` - Interacciones del usuario
- `pwa_install` - Cuando se instala la PWA

#### Eventos de Negocio
- `calculate_load` - Cuando se calcula una carga
- `add_expense` - Cuando se añade un gasto
- `feature_use` - Cuando se usa una característica
- `share_load` - Cuando se comparte un cálculo
- `feedback_submitted` - Cuando se envía feedback

#### Eventos de Conversión (Futuro)
- `purchase` - Cuando se suscribe a plan Pro

### Paso 5: Configurar Firebase Analytics

Firebase Analytics ya está integrado si usas Firebase. Para verificar:

1. **Firebase Console**
   - Ve a [console.firebase.google.com](https://console.firebase.google.com)
   - Selecciona tu proyecto
   - Ve a "Analytics" en el menú

2. **Vincular con GA4**
   - Firebase→ Configuración del proyecto
   - Integraciones → Google Analytics
   - Selecciona la propiedad GA4 que creaste
   - Click "Vincular"

3. **Verificar**
   - Ve a Analytics → Eventos
   - Deberías ver eventos en tiempo real

---

## 📈 Usar Google Analytics

### Dashboard Principal

1. **Ir a Informes**
   - GA4 → Informes → Instantánea
   - Verás usuarios en tiempo real
   - Eventos recientes
   - Páginas populares

2. **Explorar Eventos**
   - Informes → Engagement → Eventos
   - Verás todos los eventos personalizados
   - Filtra por nombre de evento

### Crear Informes Personalizados

1. **Explorar**
   - GA4 → Explorar → Crear nuevo
   - Plantilla: "Exploración libre"

2. **Configurar Variables**
   - Dimensiones: `event_name`, `page_path`, `user_id`
   - Métricas: `event_count`, `total_users`
   - Arrastrar a tabla

3. **Guardar**
   - Click "Guardar"
   - Nombrar: "Uso de Características SmartLoad"

### Métricas Importantes a Monitorear

#### Engagement
- **Usuarios activos** - Cuántos usan la app
- **Duración sesión** - Tiempo promedio de uso
- **Páginas por sesión** - Cuántas vistas

#### Funcionalidades
- **calculate_load count** - Cuántos cálculos se hacen
- **feature_use** - Qué características se usan más
- **add_expense count** - Cuántos gastos se añaden

#### PWA
- **pwa_install count** - Cuántos instalan
- **online/offline events** - Uso offline

#### Conversiones (Futuro)
- **purchase count** - Suscripciones Pro
- **Revenue** - Ingresos totales

---

## 🎯 Eventos Personalizados - Referencia

### Tracking desde Código

```javascript
// Track page view
window.trackPageView('/dashboard');

// Track feature use
window.trackFeature('lex_ai');

// Track custom event
window.trackEvent('custom_event', {
  param1: 'value1',
  param2: 123
});

// Track conversion
window.analyticsManager.trackConversion(29.99, 'USD');
```

### Eventos ya Implementados

| Evento | Cuando | Parámetros |
|--------|--------|------------|
| `page_view` | Cambio de página | page_path, page_title |
| `calculate_load` | Cálculo completado | total_miles, rpm, net_profit, is_profitable |
| `add_expense` | Gasto añadido | expense_type, expense_amount, expense_category |
| `feature_use` | Uso de característica | feature_name |
| `share_load` | Compartir cálculo | share_method |
| `feedback_submitted` | Feedback enviado | feedback_type |
| `pwa_install` | App instalada | - |
| `exception` | Error ocurrió | description, error_type, fatal |

---

## 🔍 Debugging Analytics

### En Chrome DevTools

1. **Verificar carga de GA4**
   ```javascript
   // En console
   typeof gtag !== 'undefined' // Debería ser true
   dataLayer // Debería existir
   ```

2. **Ver eventos en tiempo real**
   - Network tab → Filtrar "google-analytics"
   - Deberías ver requests a `collect?v=2`

3. **Verificar parámetros**
   - En cada request, click → Payload
   - Verás los parámetros del evento

### Google Analytics DebugView

1. **Habilitar modo debug**
   ```javascript
   // En console de Chrome (una vez)
   gtag('set', 'debug_mode', true);
   ```

2. **Ver en GA4**
   - GA4 → Configurar → DebugView
   - Usa la app
   - Verás eventos en tiempo real con detalles

### Errores Comunes

❌ **"GA4 no carga"**
- Verifica que el ID sea correcto (`G-XXXXXXXXXX`)
- Revisa ad-blockers (deshabilita para testing)
- Verifica que el script esté antes del </head>

❌ **"Eventos no aparecen"**
- Espera 24-48 horas (puede haber delay)
- Usa DebugView para ver en tiempo real
- Verifica que el código llame correctamente a trackEvent

❌ **"Firebase Analytics no sincroniza con GA4"**
- Verifica vinculación en Firebase Console
- Puede tomar 24 horas en sincronizar
- Revisa permisos de la cuenta

---

## 📊 Reportes Recomendados

### 1. Dashboard Ejecutivo
**Métricas:**
- Usuarios activos mensualmente (MAU)
- Cálculos totales por mes
- Tasa de instalación PWA
- Engagement promedio

### 2. Reporte de Características
**Objetivo:** Ver qué se usa más

**Configuración:**
- Dimensión: `event_name`
- Métrica: `event_count`
- Filtro: events que empiezan con `feature_`

### 3. Funnel de Conversión (Futuro)
**Pasos:**
1. Visita → page_view
2. Cálculo → calculate_load
3. Install prompt → pwa_install_prompt
4. Instalación → pwa_install
5. Purchase → purchase

---

## 🚀 Próximos Pasos

1. **Setup GA4** ✅
2. **Configurar eventos personalizados** ✅
3. **Crear dashboards**
4. **Configurar alertas** (ej: caída de usuarios)
5. **Integrar con Google Data Studio** (visualizaciones)
6. **Setup de Conversiones** (cuando implementes pagos)

---

**¿Problemas?** Contacta support@smartloadsolution.com
