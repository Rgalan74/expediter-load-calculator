# Motor financiero único — Especificación

**Estado:** BORRADOR para revisión y aprobación de Ricardo. No implementar hasta aprobación.
**Fecha:** 13 de noviembre de 2026
**Autores:** Claude (rama `fix/seguridad-costos-reportes`) y ChatGPT (prototipo `smartload-financial-prototype`), consolidado por Claude.
**Base de código:** rama `fix/seguridad-costos-reportes`, commit `135ed82` (parte de `main` @ `2de295e`).

---

## 0. Por qué existe este documento

Hoy la ganancia de una carga se calcula en cinco sitios distintos (calcular, guardar, panel de decisión y dos en Historial), el costo por milla (CPM) tiene tres orígenes posibles y Lex AI usa reglas de decisión propias. Cada auditoría encontró casos en que dos pantallas daban números distintos para la misma carga.

Objetivo: **una sola definición de cada número**, usada por todas las pantallas, separando claramente:

- **Rentabilidad estimada**: antes de aceptar una carga (calculadora, panel, Lex, historial de cargas).
- **Rentabilidad contable**: lo que realmente pasó (Finanzas: ingresos de cargas menos gastos registrados).

Nunca se mezclan: Finanzas no descuenta costos estimados, y la calculadora no registra gastos en Finanzas.

## 1. Estado actual (punto de partida)

| Ámbito | Producción | Vista previa (`135ed82`) |
|---|---|---|
| Fórmula: cobro = tarifa + extras; gastos = CPM × millas + toll | Sí | Sí |
| Lectura de costos sin el "costo fantasma" de $0.06/mi | Sí | Sí |
| Historial: edición sin CPM duplicado | Sí | Sí |
| CPM real desde Finanzas (meses con actividad, combustible 3 meses) | No | Sí |
| Desglose "Ver cómo se calcula" | No | Sí |
| Sueldo del dueño por día | No | Sí |
| Reportes PDF completos, lista de gastos completa, edición de categoría | No | Sí |

Lo de la vista previa **no se publicará** tal cual: se rehace sobre esta especificación.

## 2. Definiciones

| Término | Definición | Tipo |
|---|---|---|
| **Tarifa (Rate)** | Pago base contratado por la carga | Ingreso |
| **Extras** | Cargos adicionales que paga el cliente (descarga, espera…). En pantalla: "Cargos Extra al Cliente" | Ingreso |
| **Toll de la carga** | Estimación opcional de peajes de ese viaje | Gasto estimado. **No** se registra en Finanzas |
| **Millas totales** | Millas cargadas + deadhead. Las paradas del sistema de destinos actual solo suman millas (no tienen ingreso propio) | — |
| **CPM base** | Costo por milla de operar **sin peajes** | Gasto estimado |
| **Sueldo del dueño** | Lo que el conductor necesita sacar al mes. Opcional | Objetivo, no gasto |

Notas:
- El sistema antiguo de paradas con ingreso propio (`stopsContainer`) ya no existe en la interfaz; si se reintroduce, sus ingresos entran en "Ingresos totales".
- El reposicionamiento entre cargas no se registra. Por diseño, el CPM real reparte su costo entre las millas de las cargas guardadas (ver §4.3).

## 3. Función financiera única

### 3.1. Contrato

Una función pura, sin acceso a Firebase ni al DOM:

```text
calcularCarga(entradas, supuestos) -> resultado
```

**Entradas** (de la carga): `tarifa`, `extras`, `tollCarga` (número, vacío o "0 confirmado"), `millasCargadas`, `millasDeadhead`, `estadoOrigen`, `estadoDestino`, `fecha`.

**Supuestos** (resueltos antes, ver §4): `cpmBase`, `cpmFuente` (`industria` | `configuracion` | `real`), `combustiblePorMilla`, `peajePromedioPorMilla`, `sueldoPorDia`, `diasCarga`, `margenObjetivo`, `rpmMinimo`.

**Resultado:**

```text
ingresosTotales   = tarifa + extras
millasTotales     = millasCargadas + millasDeadhead
rpmTarifa         = tarifa / millasTotales
rpmTotal          = ingresosTotales / millasTotales
peajeAplicado     = tollCarga, si se indicó (incluido 0 confirmado)
                    si no: peajePromedioPorMilla × millasTotales   (§5)
costoOperativo    = cpmBase × millasTotales
costoEstimado     = costoOperativo + peajeAplicado
ganancia          = ingresosTotales − costoEstimado      (puede ser negativa)
margen            = ganancia / ingresosTotales            (0 si no hay ingresos)
sueldoCarga       = sueldoPorDia × diasCarga
gananciaTrasSueldo= ganancia − sueldoCarga
umbrales          = ver §7
snapshot          = copia de entradas + supuestos + versión de la fórmula
```

### 3.2. Quién la usa

| Pantalla / flujo | Uso |
|---|---|
| Calculadora y panel de decisión | Muestra `resultado` |
| Guardar carga (online y **sin conexión**, vía `sync-manager` → `createLoad`) | Guarda `resultado` + `snapshot`; **no recalcula** |
| Historial: ver | Muestra lo guardado |
| Historial: editar | Ver §8 |
| Reportes estimados / Zonas | Leen lo guardado |
| Lex AI | Recibe `resultado` y `umbrales`; **no recalcula** (§7.3) |
| Finanzas | **No la usa**: trabaja con ingresos y gastos reales |

### 3.3. Reglas

- Sin `||` para valores numéricos: un `0` es un valor válido. Solo `null`/vacío usa valores por defecto.
- Redondeo solo al mostrar, nunca al guardar.
- Versión de fórmula (`formulaVersion`) en cada carga guardada.

## 4. Resolución del CPM base

### 4.1. Tres etapas

| Etapa | Condición | CPM base | Mensaje al conductor |
|---|---|---|---|
| **A. Nuevo** | Sin Configuración completa | Promedio de industria (**un único valor**; hoy hay dos: $0.534 y $0.55) | "Estimado de industria — configura tus costos" |
| **B. Configurado** | Configuración completa, sin historial confiable | Desde Configuración | "Según tu Configuración" |
| **C. Con historial** | Historial que pasa §4.2 | **El que el conductor eligió** (§4.4) | Ambos valores visibles |

### 4.2. Criterios de confianza del CPM real

Periodo: los últimos 12 meses **con actividad** (meses con ≥25 % de las millas de un mes típico del conductor, mínimo 300 mi). Se incluyen los gastos de meses de pausa **intermedios** (seguro y pago del vehículo se pagan igual); se excluyen los posteriores al último mes activo.

El CPM real es **confiable** solo si se cumplen todos:

1. ≥ 3 meses con actividad y ≥ 20 cargas.
2. Gastos registrados en ≥ 3 meses del periodo.
3. Hay combustible registrado, y combustible ÷ millas está entre $0.10 y $0.50/mi (fuera de ese rango indica recibos faltantes o duplicados).
4. Cada uno de los meses con actividad tiene **algún** gasto fijo (seguro o pago del vehículo) si la Configuración indica que existen.
5. Las millas mensuales promedio no son inferiores al 40 % de la meta de Configuración (si lo son, aviso de "posibles cargas sin registrar").

Si falla alguno: se queda en etapa B y el desglose indica qué criterio falló.

### 4.3. Cálculo

```text
cpmBase real = (gastos del periodo sin peajes − combustible) / millas del periodo
             + combustible de los 3 últimos meses activos / millas de esos meses
```

Combustible reciente con dos protecciones (ya implementadas): si esos 3 meses tienen < 1,000 mi, o el resultado es menor que la mitad del promedio largo, se usa el periodo completo.

### 4.4. Elección del conductor (decisión aprobada)

1. Al pasar los criterios por primera vez, la app muestra ambos CPM con su desglose, **recomienda** el más representativo y pide elegir.
2. La elección se guarda (`users/{uid}.cpmPreference = { fuente, fecha, cpmConfig, cpmReal }`).
3. **No cambia sola.** Se vuelve a preguntar solo si:
   - la diferencia entre ambos cambia más de 15 % respecto al momento de la elección, o
   - el CPM real deja de cumplir §4.2, o
   - el conductor lo pide desde Configuración.
4. Mientras no elija, se usa el de Configuración.

## 5. Peajes

| Situación | Peaje aplicado |
|---|---|
| El conductor escribe un toll | Ese valor |
| Marca "Ruta sin peajes" | 0 |
| Campo vacío | `peajePromedioPorMilla × millas` (promedio de la categoría Peajes en el periodo de §4.2) |
| Campo vacío y sin historial de peajes | 0, indicado como "sin estimación de peajes" |

El CPM base **excluye siempre la categoría Peajes**, para que no se cuenten dos veces.

UI: añadir junto al campo de toll una casilla "Ruta sin peajes" (para distinguir 0 confirmado de vacío).

## 6. Gastos extraordinarios

- Se **identifican**, no se excluyen: un gasto es extraordinario si supera el 20 % del total de su categoría en el periodo, o 3 veces la mediana mensual de esa categoría.
- Aparecen marcados en el desglose ("Ver cómo se calcula").
- El conductor puede marcarlo como "no recurrente" desde Finanzas; en ese caso se **reparte en 12 meses** dentro del CPM en lugar de pesar en un solo mes (decisión pendiente, ver §11).

## 7. Decisión: umbrales, sueldo y Lex

### 7.1. Umbral de aceptación

```text
umbralCostos   = cpmBase + peajeAplicado / millas
umbralObjetivo = si hay sueldo:  umbralCostos + sueldoCarga / millas
                 si no:          umbralCostos / (1 − margenObjetivo)
umbralAceptar  = máximo(umbralObjetivo, rpmMinimo)
```

- `rpmMinimo` es el campo de Configuración hoy etiquetado "RPM Mínimo" (guardado como `targetRPM`); hoy **no** lo usa el semáforo.
- El promedio histórico de RPM del conductor sigue elevando el umbral de aceptar como hoy.
- Las **excepciones estratégicas** (salir de una zona trampa, reposicionarse hacia una zona premium) no rebajan el umbral: se muestran como una recomendación aparte y explícita.

### 7.2. Sueldo por día

`sueldoPorDia = sueldo mensual / días de trabajo al mes` (22 por defecto).
`diasCarga = máximo(1, horas reales / horas de manejo por día)`, horas reales = duración de Google + 30 min por parada de combustible (si la velocidad resultante está entre 35 y 80 mph; si no, la estimación interna). La métrica "ganancia por día" usa **el mismo** `diasCarga` (hoy usa otro redondeo).

### 7.3. Lex AI

Recibe el `resultado` y los `umbrales` de §3 y §7.1 y solo los explica. No calcula CPM ni umbrales propios. Hoy `response-builders.js` usa un `minRPM` fijo de $0.85 y `lex-ai-engine.js` reconstruye umbrales: ambos deben pasar a usar estos datos.

## 8. Cargas antiguas

- Una carga guardada **conserva su ganancia y supuestos originales**. Cambiar el CPM o la Configuración no la modifica.
- Al **editar**:
  - si solo cambian texto, compañía, notas o fecha: no se recalcula nada;
  - si cambian tarifa, extras, toll o millas: se recalcula con los **supuestos guardados en la carga** (`snapshot`); si la carga no tiene snapshot, con el CPM implícito `(costo guardado − toll) / millas`;
  - recalcular con supuestos actuales solo con una acción explícita ("Recalcular con mis costos de hoy"), y queda registrado (`recalculatedAt`, `formulaVersion`).
- Lectura tolerante de campos antiguos (`miles`, `loaded`, `deadhead`, `rate`, `totalCost`), sin reescribirlos.
- **Ninguna migración masiva** que reescriba cargas.

## 9. Configuración y unidades

- Mantenimiento, llantas y reparaciones: el formulario dice "Mensual ($)" y así se calculan.
- Configuraciones antiguas con valores < $1 en esos campos (probablemente por milla, de una versión anterior): **no convertir en silencio**. Mostrar un aviso en Configuración y en la calculadora: "¿Estos valores son por milla o por mes?" y guardar según la respuesta.
- Un único valor de promedio de industria para usuario nuevo (§4.1).
- El formulario no viene relleno con costos de ejemplo para usuarios nuevos (ya hecho en la vista previa).
- `isEstablishedUser()` debe considerar "Configuración completa", no solo antigüedad de la cuenta.

## 10. Plan de pruebas

### 10.1. Unitarias (función pura, Node)

Reutilizar y ampliar el prototipo de ChatGPT (`financial-engine.test.mjs`, 11 pruebas) y las simulaciones de Claude (10 casos de CPM):

- Extras, toll escrito, toll vacío con promedio, ruta sin peajes, pérdidas negativas.
- Valores 0 en Configuración respetados.
- Etapas A, B, C y cada criterio de §4.2 fallando por separado.
- Pausa larga, carga suelta tras pausa, mes de pausa intermedio.
- Gasto extraordinario identificado.

### 10.2. Integración en navegador (Chrome sin ventana, como la prueba del PDF)

Con datos de prueba en un proyecto/emulador, **nunca** con datos reales:

1. Calcular → el panel muestra X.
2. Guardar → la carga guardada tiene exactamente X y su snapshot.
3. Editar solo notas → X no cambia.
4. Editar millas → recalcula con los supuestos guardados.
5. Historial, Zonas y reportes muestran X.
6. Cambiar el CPM en Configuración → las cargas anteriores siguen en X.
7. **Sin conexión**: guardar, recuperar conexión, sincronizar → la carga sincronizada tiene X.
8. Lex recibe X y los mismos umbrales.

### 10.3. Datos reales (solo lectura)

Las 112 cargas de Ricardo: el CPM real y los totales del periodo deben cuadrar con el reporte de Finanzas ($50,671.32 / 112 cargas / 68,736 mi).

## 11. Decisiones pendientes de Ricardo

| # | Decisión | Propuesta |
|---|---|---|
| 1 | ¿Aprobar §4.2 (criterios de confianza) con esos umbrales? | Sí |
| 2 | Gastos "no recurrentes": ¿repartirlos en 12 meses? | Sí, solo si el conductor los marca |
| 3 | ¿Casilla "Ruta sin peajes"? | Sí |
| 4 | ¿Botón "Recalcular con mis costos de hoy" en Historial? | Sí, con confirmación |
| 5 | Promedio de industria único: ¿$0.55? | $0.55 hasta revisar con datos de mercado |
| 6 | Tus valores de mantenimiento (0.014 / 0.012 / 0.025): ¿por milla o por mes? | — |

Decisiones ya aprobadas: A (CPM real cuando es confiable, con elección del conductor), B (máximo entre RPM mínimo y umbral), C (confirmar unidades sin conversión silenciosa), D (peajes separados), E (conservar cargas antiguas).

## 12. Problemas conocidos fuera del motor (registrados)

1. **3 pruebas fallando en `functions/test-admin.js`** ("3 pagos en Firestore", "totalPaid…", "failedPaymentsCount…"). Causa: desde el commit `f86d2cf` `adminGetUserDetail` lee los pagos de la API de Stripe (`stripe.charges.list`), pero la prueba sigue simulando pagos en Firestore. El código es correcto; la prueba está desactualizada. Relacionado: `adminGetBillingOverview` sigue leyendo `collectionGroup('payments')`, que no se llena, así que sus totales pueden salir en $0.
2. Dos cargas con RPM exportado distinto de tarifa/millas (Freight Alliance #24035, Empire #531198). Hipótesis: la versión anterior de `saveLoad()` guardaba `totalCharge = tarifa + tolls + otros`. No verificado.
3. Agrupación de nombres de compañías en reportes.
4. `evaluateLoad` (Cloud Function) no tiene llamadas: código muerto.
5. Clave de OpenRouter pendiente de rotar (estuvo expuesta antes del 12-11-2026).

## 13. Fases de implementación (tras aprobación)

1. Función pura + pruebas unitarias (sin tocar pantallas).
2. Calculadora, panel y guardado (online y sin conexión) usando la función.
3. Historial (§8) y reportes estimados.
4. Resolución del CPM (§4) con la elección del conductor.
5. Peajes (§5) y gastos extraordinarios (§6).
6. Lex (§7.3).
7. Pruebas de integración (§10.2) y verificación con datos reales (§10.3).
8. Vista previa → revisión de Ricardo → producción.

Cada fase: un commit, pruebas en verde, sin desplegar a producción hasta la fase 8.
