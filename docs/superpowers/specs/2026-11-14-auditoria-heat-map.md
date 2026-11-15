# Auditoría del Heat Map (Zonas) — situación actual y posibilidades

**Estado:** auditoría histórica del 14/11/2026, con revisión documental del 15/11/2026. H1 corregido y probado localmente; H2–H10 pendientes. Esta revisión no modifica código.
**Autor:** Claude
**Archivos revisados:** `public/js/zones.js` (1,867 líneas), `public/js/zones-print.js`, `public/js/agents/zones-agent.js`, `public/app.html` (sección `#zones`), `public/usa_states_ids_fixed_by_title.svg`, `public/js/calculator.js` (guardado de cargas), `public/js/history.js` (edición de cargas), `public/js/helpers.js` (`getStateCode`).
**Documento relacionado:** `2026-11-14-razonamiento-cargas-design.md` (v3), §6.1, §7.3 y §7.4.1.

## Revisión documental — 15/11/2026

**Revisión:** Codex, autorizada por Ricardo. Se conserva la autoría y la investigación del 14/11/2026; esta revisión registra implementación local posterior y no aprueba automáticamente decisiones futuras.
**Referencia local:** rama `feat/motor-financiero`, HEAD `4b9402f8e5008d69edcf5b3530a62e9cd8c46615`. Sin verificación de GitHub remoto ni de producción; no hay publicación ni despliegue autorizado por este documento.

| Trabajo | Commit local | Implementación | Pruebas revisadas y límites |
|---|---|---|---|
| Costos de Configuración / CPMEngine | `8c2d0a1b6bf900728cadd82d3fcc2f66b1c9e4dc` | Costos variables en USD/milla; preservación de ceros | Incluido en el conjunto aislado validado; no implica cobertura autónoma de todos los campos de Configuración |
| F1: D5 y función pura D14 | `feb95f996070f469da6d54782739c3be627a8e9a` | Fórmula 2; RPM histórico fuera del umbral; precios de referencia; clasificador D14 sin cambiar CPM | 125/125 pruebas sintéticas del conjunto motor + guardas F2. No se localizaron pruebas dedicadas a `clasificarGastosD14`; no se declaran implementadas simulaciones ni clasificación editable |
| F2: modo sombra local | `573ce472367c21224dda33487886200847193fd8` | Lector, adaptador, CPM histórico y persistencia transaccional de `ultimoCpmRealConfiable`; preferencia preservada; panel legacy conservado | SDK/Emulator 6/6 + 2/2 adicionales de idempotencia y peajes; navegador real con datos ficticios. Las pruebas SDK usan DOM simulado; el navegador usó servidor local con CSP. Sin validación de producción ni repetición del ensayo con CSV privado |
| F0(a): Zonas H1 | `467460e50ad5e11016f5097cd270025d471ae1b3` | Prioridad de `netProfit` válido, respaldo `profit`; cero y negativos conservados; totales y detalle coherentes | 13/13 pruebas sintéticas de lógica y HTML imprimible. DOM simulado; no verifica Google Maps, apariencia en navegador ni impresora física |
| Finanzas: clasificación y vencimientos | `4b9402f8e5008d69edcf5b3530a62e9cd8c46615` | Estados unificados, fecha local e ISO extendido válido sin desplazar su día de vencimiento | 29/29 pruebas específicas (17 originales + 12 ISO), calendario local y DST. DOM y escrituras simulados, sin Firebase real. Pagos parciales no implementados en este módulo |

**Límites de cierre:** F0(a), F1 y F2 están implementados y registrados localmente en el alcance anterior. F0(b), F3–F10 y las correcciones H2–H10 son **propuestas no iniciadas**. No inferir una nueva interfaz, instantáneas persistidas por carga, integración de cobros F1 en Finanzas, simulaciones, fuentes externas o Heat Map por capas a partir de estos commits.

**Activación F2 vigente:** solo `localhost` / `127.0.0.1`, proyecto `demo-smartload-f2`; `?f2shadow=1` activa sombra y `?f2emulator=1` mantiene Emulator con F2 OFF. La selección persiste en sessionStorage de la pestaña. No equivale al futuro interruptor `flags.razonamientoV3`. OFF no elimina la referencia ya persistida; impide la actividad nueva de F2. La CSP pertenece al servidor de laboratorio y no configura producción.

**Trazabilidad de pruebas:** se revisaron resultados existentes, sin reejecutarlos en esta revisión documental. La evidencia de navegador está en `scripts/f2-emulator/evidence/f2-browser.json` y su captura. Los informes 125/125, 2/2, 13/13 y 29/29 se conservan en artefactos externos de validación; no afirmar que sus pruebas temporales estén todas versionadas. SDK de integración: Firebase 12.19.0 externo; la app de navegador usa compat 9.22.0. Restricciones de red y datos ficticios limitan las conclusiones al laboratorio.

**Referencia histórica fuera del alcance:** la especificación del motor del 13/11 aún contiene la frase “el promedio histórico de RPM sigue elevando el umbral”. Esa frase quedó superada por D5 (`feb95f9`); el código y esta revisión reflejan el umbral actual. Ese cuarto documento no se modifica aquí.

**Privacidad y vigencia:** los originales íntegros se conservan en respaldo privado fuera del repositorio. Las cifras de los ejemplos públicos son sintéticas, no datos de Ricardo ni resultados de producción. Las fuentes y decisiones del 14/11 conservan su fecha; no se revalidaron licencias, disponibilidad ni condiciones externas el 15/11.

## 1. Qué contiene hoy la pestaña Zonas

| Bloque | Qué muestra | Dónde se calcula |
|---|---|---|
| **Mapa de estados** (SVG, 51 elementos con id = código de estado) | Cada estado pintado verde / amarillo / rojo | `calcularEstadisticas` → `calcularScoreCompuesto` → `pintarEstados` |
| **Panel de información** | Al pasar o hacer clic: RPM promedio, cargas, ganancia, zona y "con más cargas sería…" | `showStateInfo` |
| **Tabla de estados** | Estado, zona, cargas, RPM, ganancia, score /100 y barra | `renderZonesTable` |
| **Mapa de ciudades** (Google Maps) | Un marcador por ciudad de destino, coloreado por RPM | `loadCitiesData` → `processCitiesData` → `showCitiesOnMap` |
| **Tabla de ciudades** | Ciudad, cargas, RPM, ganancia | `renderCitiesTable` |
| **Análisis de Lex** | Resumen de zonas verdes/amarillas/rojas, mejores y peores estados, consejo | `analyzeLexZones` → `prepararAnalisisZonas` |
| **Notas de mercado** | Notas del conductor por destino/origen | `loadMarketNotes`, colección `notes` |
| **Informe imprimible** | Top 5 y peores 5 estados por RPM | `zones-print.js` |

## 2. Qué datos alimentan el mapa

- **Solo las cargas del propio conductor** (`loads` donde `userId == uid`), **todas**, sin ventana de tiempo, sin filtrar por fórmula antigua o nueva.
- **No hay datos externos** ni de otros conductores.
- **Estado:** se obtiene de nuevo del texto `origin` / `destination` con `getStateCode()`; no usa los campos `originState` / `destinationState` que la calculadora ya guarda.
- **Ciudad:** el texto completo del destino (sin ", USA"), geocodificado con Google en el navegador **cada vez** que se abre la pestaña (un geocode por ciudad).
- **ZIP / ZIP3:** **no existe**. Las cargas no guardan código postal ni coordenadas.

## 3. Cómo se calculan los colores y los indicadores

### 3.1. Mapa y tabla de estados (por **origen**)

```text
rpm de cada carga  = load.rpm                       (calculadora: tarifa ÷ millas totales, sin extras)
                     si falta: totalCharge ÷ totalMiles   (con extras: otra base, §5)
rpmPorEstado[orig] = media simple de los rpm de las cargas que SALEN del estado (no ponderada por millas)

zona base:  rpm ≥ 0.90 → verde (75) · rpm ≥ 0.75 → amarillo (37) · resto → rojo (10)
si cargas < 3: baja un nivel (verde → amarillo, amarillo → rojo)
color = verde si score ≥ 50 · amarillo si ≥ 25 · rojo
```

- **Reglas fijas**: $0.75 y $0.90, iguales para todos los conductores, sin relación con su CPM. El comentario del código dice "usa los mismos umbrales del usuario", pero están escritos a mano.
- El comentario "Score compuesto: RPM 65 % + Frecuencia 35 %" **no corresponde** al código: es una regla de escalones.
- **Solo origen:** un estado al que el conductor entrega pero del que nunca sale no aparece en el mapa.

### 3.2. Mapa y tabla de ciudades (por **destino**)

- Media simple de `load.rpm` por ciudad de destino.
- Umbrales **distintos**: verde ≥ $1.05, amarillo ≥ $0.75, rojo < $0.75.

### 3.3. Análisis de Lex sobre zonas

- Umbrales $1.05 / $0.75 (como ciudades, no como estados).
- Mensajes imperativos: "Evita [estado] — solo genera $X/mi" si el peor estado está por debajo de $0.70.

### 3.4. `zones-agent.js` (agente de Lex)

- Clasificación propia con categorías **TRAP** y mensajes "zona TRAP, difícil de salir"; una de las cinco listas de zonas trampa señaladas en la auditoría del razonamiento (13-11-2026).

## 4. ¿Estadísticas personales, reglas fijas o ambas?

**Ambas, mezcladas:** los **datos** son personales (sus cargas), pero la **clasificación** es una regla fija igual para todos, y hay **tres juegos de umbrales distintos** (estados $0.75/$0.90; ciudades y Lex $0.75/$1.05; agente con TRAP y $0.85). Ninguno usa el CPM ni el objetivo del conductor.

## 5. Hallazgos históricos y estado al 15/11/2026

El diagnóstico y sus efectos corresponden al 14/11. La última columna indica el estado posterior: H1 ya está corregido; las demás correcciones son propuestas no iniciadas.

| # | Problema observado el 14/11 | Efecto observado el 14/11 | Gravedad | Estado al 15/11 |
|---|---|---|---|---|
| H1 | **La ganancia lee `load.profit`**, pero la calculadora guarda `netProfit`; `profit` solo existe en cargas **editadas** desde el Historial (`history.js` escribe ambos) | La columna Ganancia, el panel de estado, el mapa de ciudades y el informe imprimible muestran **$0** para las cargas guardadas desde la calculadora y no editadas después | Alta (dato visible incorrecto) | Corregido en `467460e`: `netProfit` válido primero, `profit` como respaldo; 13/13 pruebas |
| H2 | La ganancia guardada (`netProfit`) se calculó con el modelo de costos de cada momento (`TU_COSTO_REAL`), distinto según la fecha | Sumar ganancias de cargas de épocas distintas mezcla fórmulas; tampoco es "ganancia estimada" del motor nuevo | Media | Corrección propuesta no iniciada |
| H3 | **Bases de RPM mezcladas:** `load.rpm` es tarifa ÷ millas totales (sin extras), pero el respaldo usa `totalCharge` (con extras) | En cargas antiguas sin `rpm`, el estado sube artificialmente | Media | Corrección propuesta no iniciada |
| H4 | **Media simple** de RPM por carga, no ingreso total ÷ millas totales | Una carga corta de RPM alto pesa igual que una de 1,500 mi | Media | Corrección propuesta no iniciada |
| H5 | **Muestra pequeña pintada como peor rendimiento**: con < 3 cargas un estado bueno pasa a amarillo o rojo | Confunde "pocos datos" con "mala zona"; contradice la confianza separada de la v3 (§8.1) | Media | Corrección propuesta no iniciada |
| H6 | **Tres juegos de umbrales fijos** y no relacionados con el costo del conductor | Un estado "verde" puede no cubrir el costo de un conductor con CPM alto, y uno "rojo" ser rentable para otro | Media | Corrección propuesta no iniciada |
| H7 | **Sin ventana de tiempo** ni exclusión de cargas de fórmula antigua | Datos de hace años pesan igual que los recientes | Baja–media | Corrección propuesta no iniciada |
| H8 | **Geocodificación en cada visita** (una llamada por ciudad, en serie) | Costo de la API de Google y lentitud con muchas ciudades | Baja | Corrección propuesta no iniciada |
| H9 | Mensajes "Evita…" y "zona TRAP" | Contradicen la v3 (§2.4: un estado difícil no garantiza una salida difícil; sin calificar "trampa") | Media | Corrección propuesta no iniciada |
| H10 | Estados solo por origen | No hay vista de entregas ni de entradas/salidas | Baja (limitación) | Corrección propuesta no iniciada |

H1 fue un error independiente del diseño nuevo y queda cerrado técnicamente como F0(a), con el alcance de pruebas indicado arriba. No incluye F0(b) ni las mejoras H2–H10.

## 6. Cómo añadir capas sin reconstruir el mapa

El mapa SVG ya tiene un elemento por estado con su código como id, y la pintura es una función (`pintarEstados`) que recibe un color por estado. Basta con **separar el cálculo del color de la pintura**:

```text
capa = { id, titulo, nivelGeografico, valores: { clave → { valor, muestra, confianza, etiqueta } },
         escala: (valor, conductor) → color, leyenda, notaDeBase }

pintarEstados(svgDoc, capa)   (misma función, recibe la capa en lugar de calcular el color dentro)
showStateInfo(estado, capa)   (muestra valor, muestra, confianza y la base del dato)
```

- **Selector de capa** encima del mapa; la capa actual se conserva como "Vista clásica" hasta validar las nuevas.
- **Confianza como estilo aparte** (opacidad o trama), **nunca como cambio de color** (corrige H5).
- La **tabla** y el **informe imprimible** leen la misma capa.
- **Propuesta F8 no iniciada:** el cálculo de cada capa viviría en `market-context.js` (capa 2 de la v3), con pruebas por desarrollar; Zonas, Panel y Lex leerían los mismos perfiles. Ese módulo no está implementado.

### 6.1. Capas propuestas

| Capa | Valor | Base y etiqueta (v3 §7.4.1) | Escala de color | Datos |
|---|---|---|---|---|
| **Rentabilidad personal** | Ganancia estimada por milla, recalculada con el CPM **actual** del conductor (no la `netProfit` guardada) | "Ganancia estimada/mi con tu CPM de $X" | Relativa a **su** umbral de costos y objetivo (rojo < costos, amarillo entre costos y objetivo, verde ≥ objetivo) | Propios |
| **Tarifas comparables** | RPM de tarifa ponderado (Σ tarifa ÷ Σ millas totales) | "$/mi tarifa sin extras · millas totales" | Relativa a su umbral y objetivo; sin mezclar bases (corrige H3, H4) | Propios (tipo C) |
| **Actividad de cargas** | Número de cargas por estado, por origen y por destino | "Cargas tuyas (12 meses)" | Intensidad de un solo color; no es "bueno/malo" | Propios |
| **Entradas / salidas** | Entregas en el estado frente a salidas desde él, en sus datos | "En tus datos: N entregas, M salidas" | Divergente; con la coletilla "no garantiza lo que pase esta vez" (v3 §7.3) | Propios; más adelante, Freight Analysis Framework (D13) como capa **objetiva** rotulada aparte |

Todas las capas propuestas requerirían ventana de 12 meses con actividad, exclusión o ponderación de cargas de fórmula antigua, confianza multifactorial (v3 §8.1) y "Sin datos tuyos" en gris cuando no hay muestra. No describe la vista clásica vigente.

### 6.2. Niveles geográficos

| Nivel | Qué hace falta | Viabilidad hoy |
|---|---|---|
| **Nacional** (vista por estado) | Lo actual | Sí |
| **Regional** (agrupación de estados) | Tabla fija de regiones (p. ej. las del censo) agregando estados | Sí, sin datos nuevos |
| **Metropolitana** | Asignar cada ciudad a un área metropolitana (p. ej. CBSA); el mapa de ciudades de Google ya existe | Parcial: requiere una tabla ciudad → área y **guardar coordenadas** al guardar la carga (evita H8) |
| **ZIP3** | Código postal de origen y destino en cada carga | **No**: no se guarda hoy. Habría que guardarlo al crear la carga (dato de Google Places, si el autocompletado lo devuelve [NO VERIFICADO]) y no se puede reconstruir para cargas antiguas sin geocodificar de nuevo |

Una capa ZIP3 solo debe mostrarse con muestra suficiente; para un conductor individual será casi siempre "sin datos", así que es más útil cuando existan datos agregados (D9) o externos verificados (trabajo de Claude Chat, pendiente).

## 7. Relación con el trabajo de fuentes externas

- Las capas externas (tarifas de mercado, actividad general, entradas/salidas objetivas) se añadirían como **capas separadas y rotuladas por fuente y tipo de dato** (v3 §3.1: A, B o C), nunca mezcladas con las capas personales.
- Solo el tipo C podría compararse con las tarifas del conductor; los tipos A y B, como tendencia.
- Ninguna capa cambia la rentabilidad ni el indicador del Panel (v3 §7.6.3).

## 8. Resumen

- Hoy: datos personales, clasificación fija, tres juegos de umbrales, solo por origen en estados y por destino en ciudades, sin ventana, sin ZIP.
- H1 (ganancia $0) corregido y probado localmente; H2–H10 permanecen como hallazgos con correcciones propuestas no iniciadas.
- El mapa admite capas nuevas **sin reconstruirse**: separar el cálculo de la pintura, añadir un selector y reutilizar `market-context.js`.
- Metropolitano y ZIP3 necesitan guardar datos nuevos en cada carga; no son recuperables por completo para el historial.
