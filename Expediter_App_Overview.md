# Documentación Descriptiva de "Smart Load Solution" (Expediter App)

Esta guía describe exhaustivamente todas las capacidades, pestañas funcionales (Tabs), módulos integrados, el asistente inteligente (Lex AI), y la "Smart Load Academia". Este documento está optimizado para proveer contexto completo a NotebookLM sobre la estructura y lógica de negocio de la PWA.

---

## 🚀 1. Visión General de la App
**Smart Load Solution** es una Progressive Web App (PWA) de nivel profesional tipo "SaaS B2B" orientada a transportistas ligeros (*Expediters* en Sprinter Vans y Cargo Vans). Su propósito principal es eliminar las decisiones emocionales ("hacer millas baratas por hacer millas") y transformarlas en decisiones financieras calculadas.

**Características Visuales Principales:**
- **Tema:** Dark Mode Forzado inspirado en software de alto rendimiento (Glassmorphism, desenfoque, bordes translúcidos de alto contraste). 
- **Feedback Visual Inmediato:** Uso de semáforos (Verde, Amarillo, Naranja, Rojo) para la rentabilidad y advertencias climáticas/geográficas.
- **Micro-Animaciones:** Pulsaciones para llamadas a la acción, transiciones suaves y estados dinámicos.

---

## 📊 2. Pestañas Principales (Tabs)

La interfaz de usuario principal (`app.html`) se divide en 5 pestañas clave que gestionan el ciclo de vida de un transportista, más un acceso directo a la Academia:

### 2.1 Tab: Calculadora (Calculator)
El corazón de la aplicación. Es una terminal de análisis rápido y complejo antes de "Bookear" una carga en un Load Board (como Sylectus o Dat).
- **Entradas Clave:** Origen, Destino, Millas Llenas (Loaded Miles), Millas Vacías (Deadhead Miles), Tarifa/Pago (RPM o Rate Total).
- **Autocomplete Inteligente:** Utiliza **Google Maps API** para buscar ciudades y calcular instantáneamente la distancia real de conducción entre Origen y Destino.
- **Cálculo de "Costo Real" (Tu Costo):** Combina el gasto fijo mensual y el gasto variable (Diesel, Mantenimiento, DEF) definido por el usuario para calcular el umbral exacto de punto de equilibrio para esa carga específica.
- **Motor de Decisión Inteligente:** En lugar de solo arrojar números, genera un "Veredicto" claro:
  - 🟢 **ACEPTA:** Carga altamente rentable que supera el costo operativo + margen de ganancia.
  - 🟡 **CASI ACEPTA:** Carga ligeramente por debajo del RPM ideal, pero útil si saca al camión de una zona muerta.
  - 🟠 **EVALÚA:** Carga dudosa. Produce alertas si te envía a un estado "Trap" (como Florida o Colorado) sin suficiente colchón financiero para salir.
  - 🔴 **RECHAZA:** Pérdida matemática (Carga de la Muerte).
- **Mapeo de Zonas "Trap":** Analiza si el destino es un estado donde "las cargas entran pero no salen" (ej: NV, AZ, NM, OR, WA, FL). Ofrece recomendaciones e incluso calcula rutas de "Hubs de Escape" hacia regiones como el Medio Oeste (Midwest), sumando el costo de ese escape al costo de la carga evaluada.
- **Integración del Clima en Ruta:** (Exclusivo Premium) Verifica el pronóstico de 3 días del destino usando la API de WeatherAPI con advertencias meteorológicas integradas, incluyendo un modal con mapas interactivos de Google Maps, superposición de capas climáticas (Temperatura, Lluvia, Nubes, Viento) en toda la ruta, y puntos de control a lo largo de las horas manejadas.
- **Guardar Carga:** Una vez evaluada, permite guardar la carga en el "Historial" como 'Completada', 'Pendiente' o 'Perdida'.

### 2.2 Tab: Historial (History)
Bitácora viva de las operaciones del usuario.
- **Listado y Filtros:** Permite ver y editar todas las cargas guardadas históricamente, filtrando por rango de fechas (Semana, Mes, Año, Todo) y por estatus.
- **Tarjetas Dinámicas:** Muestra ingresos diarios, ganancia neta, millas corridas y RPM promedio del periodo seleccionado.
- **Exportación a Excel / CSV:** (Exclusivo Pro/Premium) Descarga automatizada de la data para contabilidad.
- **Conexión con Base de Datos:** Los registros persisten de manera segura en Firestore (Firebase Database) atados al UID de cada usuario.

### 2.3 Tab: Finanzas (Finances)
Centro de control para determinar la viabilidad del negocio del transportista.
- **Dashboard Financiero:** Muestra el Gross Revenue (Ingreso Bruto) total vs Net Profit (Ganancia Neta), calculados sobre todas las métricas en periodo activo.
- **Configuración de "Tu Costo Operativo":**
  - *Gastos Fijos Mensuales:* Pagos del camión (Truck Payment), Seguros (Insurance), Teléfono, Suscripciones a Load Boards, Pagos a Despachadores.
  - *Gastos Variables (por Milla):* Consumo de combustible (MPG), costo estimado del galón de Diesel, Mantenimiento preventivo, y DEF.
- **Impacto Transversal:** El costo por milla resultante ($/mi) de esta pestaña determina los semáforos verdes o rojos en la Calculadora. Si cambian el costo del seguro aquí, la próxima evaluación en la calculadora requerirá tarifas más altas para marcarse como 🟢 ACEPTA.
- **Reporte IRS (Schedule C):** Botón para generar un reporte estimado compatible con declaración de impuestos en EE.UU. en formato PDF/Impreso.

### 2.4 Tab: Zonas (Market Notes / Zones)
Terminal de inteligencia de mercado B2B. Los transportistas dependen de saber qué regiones de EE.UU. pagan mejor en diferentes temporadas del año.
- **Sistema de Notas de Mercado:** Notificaciones breves, actualizadas mediante Firebase Firestore, marcadas por fecha, sobre cómo fluctúa el volumen por región.
- **Píldoras de Filtro (Tags):** Los usuarios pueden filtrar rápidamente "Midwest", "South", "Trap Zones" o "Alertas Rojas".
- **Mapa de Rentabilidad de Estados Unidos:** Utiliza un script de Leaflet o un DataWrapper embebido que colorea los estados de USA en tiempo real (Verde = Hot, Rojo = Trap).

### 2.5 Tab: Configuración (Settings)
Administración de perfil, suscripción y aplicación.
- Detalles del usuario, tipo de plan (Free, Starter, Professional, Premium).
- Opciones de notificaciones y permisos de instalación de PWA.
- Ajustes de comportamiento del Agente de IA "Lex".
- Gestión de sesión y desvinculación de Firebase Auth.

---

## 🤖 3. Lex AI (Smart Expediter Assistant)
Lex es el copiloto cognitivo que reduce la curva de aprendizaje de meses a días.
- **Ubicación:** Un botón flotante con avatar en la esquina inferior derecha en todas partes de la app de escritorio y móvil (`app.html`).
- **Comportamiento Proactivo:** Si el usuario ignora una advertencia roja en la calculadora y da clic a Guardar, Lex salta para advertir sobre los riesgos financieros (Ej: "Estás perdiendo $180 y yendo a Colorado, un Blackhole de cargas. ¿Estás seguro?").
- **Respuestas Basadas en Reglas "Lex Router":** Lex posee un enrutador interno (`lex-router.js`) con entendimiento en lenguaje natural de jerga de camioneros (Deadhead, RPM, Layover, Detention, TONU, Factoring).
  - *Ejemplo:* Si el usuario escribe "No me quieren pagar mi TONU", Lex responde con las tarifas estándar de cobro de "Truck Ordered Not Used", plantillas de correo de negociación, y le sugiere artículos relevantes de la Academia.
- **Comportamiento en la Calculadora:** Escucha los inputs pasivamente; si detecta patrones perjudiciales (Demasiado deadhead vs Loaded Miles), el avatar de Lex pulsa con una animación para llamar la atención del conductor y sugerir una reevaluación.

---

## 🎓 4. Smart Load Academia
Integrado profundamente dentro de la aplicación, este es un Hub educativo gamificado diseñado para enseñar perspicacia comercial (Business Acumen).
- Contiene **más de 260 lecciones** repartidas en **8 Módulos de Maestría** (Ej: "Economía del Expediting", "Estrategias de Load Boards", "Dominio del Panel e Historial", "Tácticas B2B y Brokers").
- Los módulos están bloqueados. El **Módulo 1 al 3** son gratis (Free Tier). Para desbloquear los módulos **4-6** se requiere el plan "Professional" y para los **Módulos 7-8** (Mastery) se requiere el nivel "Premium".
- Utiliza **EventBus UI** e insignias visuales. Al realizar una compra, el DOM actualiza dinámicamente los "Candados" que bloquean el contenido sin requerir refrescar toda la web.

---

## 🛠️ 5. Arquitectura y Pila Tecnológica
- **Front-End:** Vanilla JavaScript puro sin frameworks. Orientado a rendimiento extremadamente veloz en dispositivos móviles débiles y zonas de baja cobertura de carretera (Mobile-first puro). Se utilizan APIs nativas y ES6+.
- **Estilos:** Tailwind CSS con clases de utilidad combinado con archivos `theme-tokens.css` que gestionan colores fijos (`rgba()`, `hex`) garantizando coherencia en todo el sitio y evitando roturas de diseño al desactivar el Toggle del Tema. Usa CSS Grid/Flexbox moderno y un robusto sistema Glassmorphism en modo Dark.
- **Backend (BDs y Autenticación):** Firebase y Google Cloud Platform.
  - **Firestore (NoSQL):** Para Histórico de cargas, Perfil financiero, y Notas del mercado.
  - **Firebase Auth:** Login de usuarios (Email/Google), reseteo de claves y retención de sesiones con Service Workers.
  - **Firebase Hosting:** Distribución CDN global.
- **APIs Externas:**
  - *Google Maps Places & Directions API:* Autocomplete y distancias de enrutamiento exacto comercial.
  - *WeatherAPI:* Telemetría climática con polígonos GFS en ruta.
- **PWA (Progressive Web App):** Tiene un Web App Manifest y un `service-worker.js` capaz de cachear los scripts, fuentes (`Inter` / `Space Grotesk`) e imágenes `.webp` localmente para permitir su uso rápido y crear la sensación de ser una App iOS/Android nativa al usarse como Add to HomeScreen.
- **Pasarela de Pagos:** Integración con Stripe (Products & Payments Links embebidos) y Listeners de Firebase Functions para escalar el rol de usuario automáticamente al efectuar compras de suscripción.

---
*Este documento resume la madurez, seguridad, e intención de negocio de la plataforma Smart Load Solution (Expediter App).*
