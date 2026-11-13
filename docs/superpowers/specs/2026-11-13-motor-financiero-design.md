# Motor financiero único — Especificación

**Estado:** BORRADOR — revisión 3. Pendiente de aprobación final de Ricardo. No implementar hasta aprobación.
**Fecha:** 13 de noviembre de 2026
**Autores:** Claude (rama `fix/seguridad-costos-reportes`) y ChatGPT (prototipo `smartload-financial-prototype`), consolidado por Claude.
**Base de código:** rama `fix/seguridad-costos-reportes` (parte de `main` @ `2de295e`). Revisión 1: commit `05c1908`.

---

## Historial de revisiones

| Rev. | Fecha | Cambios |
|---|---|---|
| 1 | 13-11-2026 | Borrador inicial (commit `05c1908`) |
| 2 | 13-11-2026 | Revisión cruzada Claude/ChatGPT: RPM total vs RPM de tarifa (§7.1), Extras confirmados (§2, §3), contraoferta (§7.4), objetivo = máximo entre sueldo y margen (§7.1), sueldo bruto (§7.2), cargas antiguas sin reconstrucción de CPM (§8), criterio de millas pasa a advertencia y control de combustible esperado (§4.2), gastos extraordinarios por materialidad y recurrencia (§6). Separación explícita entre decisiones aprobadas, pendientes y umbrales provisionales (§11) |
| 3 | 13-11-2026 | Evaluación vs liquidación de la carga: Extras cobrados después sin alterar la evaluación original (§3.4). Control de combustible marcado como aproximado y banda justificada (§4.2). Pérdida de confiabilidad de un CPM real ya elegido (§4.5). Validación contable separada de la validación del CPM (§10.3). Nueva decisión pendiente #7 (§11.2) |

---

## 0. Por qué existe este documento

Hoy la ganancia de una carga se calcula en cinco sitios distintos (calcular, guardar, panel de decisión y dos en Historial), el costo por milla (CPM) tiene tres orígenes posibles y Lex AI usa reglas de decisión propias. Cada auditoría encontró casos en que dos pantallas daban números distintos para la misma carga.

Objetivo: **una sola definición de cada número**, usada por todas las pantallas, separando claramente:

- **Rentabilidad estimada**: antes de aceptar una carga (calculadora, panel, Lex, historial de cargas).
- **Rentabilidad contable**: lo que realmente pasó (Finanzas: ingresos de cargas menos gastos registrados).

Nunca se mezclan: Finanzas no descuenta costos estimados, y la calculadora no registra gastos en Finanzas.

## 1. Estado actual (punto de partida)

| Ámbito | Producción | Vista previa (rama) |
|---|---|---|
| Fórmula: cobro = tarifa + extras; gastos = CPM × millas + toll | Sí | Sí |
| Lectura de costos sin el "costo fantasma" de $0.06/mi | Sí | Sí |
| Historial: edición sin CPM duplicado | Sí | Sí |
| CPM real desde Finanzas (meses con actividad, combustible 3 meses) | No | Sí |
| Desglose "Ver cómo se calcula" | No | Sí |
| Sueldo del dueño por día | No | Sí |
| Reportes PDF completos, lista de gastos completa, edición de categoría | No | Sí |

Lo de la vista previa **no se publicará** tal cual: se rehace sobre esta especificación.

**Diferencias conocidas entre la rama y esta especificación** (pendientes de implementar, no son errores de la especificación):

- `cpm-engine.js` todavía **incluye la categoría Peajes** en el CPM real (§5 la excluye).
- El sueldo **sustituye** al margen (§7.1 usa el máximo de ambos).
- No existe el control de combustible esperado (§4.2, criterio 3) ni la detección de gastos extraordinarios (§6).
- El RPM mínimo de Configuración no se aplica en el semáforo (§7.1).
- No existen Extras confirmados / no confirmados (§2).

## 2. Definiciones

| Término | Definición | Tipo |
|---|---|---|
| **Tarifa (Rate)** | Pago base contratado por la carga | Ingreso |
| **Extras confirmados** | Cargos adicionales que el cliente ya aceptó pagar (descarga, espera acordada…). En pantalla: "Cargos Extra al Cliente" | Ingreso |
| **Extras no confirmados** | Cargos posibles pero no garantizados al aceptar la carga (p. ej. detención eventual) | **No** cuentan como ingreso en la decisión; se muestran aparte como "posible adicional" |
| **Toll de la carga** | Estimación opcional de peajes de ese viaje | Gasto estimado. **No** se registra en Finanzas |
| **Millas totales** | Millas cargadas + deadhead. Las paradas del sistema de destinos actual solo suman millas (no tienen ingreso propio) | — |
| **CPM base** | Costo por milla de operar **sin peajes** | Gasto estimado |
| **Sueldo del dueño** | Sueldo **bruto, antes de impuestos**, que el conductor necesita sacar al mes. Opcional | Objetivo, no gasto |

Notas:
- **Todos los RPM de esta especificación se calculan sobre millas totales** (cargadas + deadhead). Decisión aprobada por Ricardo.
- El sistema antiguo de paradas con ingreso propio (`stopsContainer`) ya no existe en la interfaz; si se reintroduce, sus ingresos entran en "Ingresos totales".
- El reposicionamiento entre cargas no se registra. Por diseño, el CPM real reparte su costo entre las millas de las cargas guardadas (ver §4.3).
- UI de Extras (a definir en implementación): el campo actual de "Cargos Extra al Cliente" pasa a representar Extras **confirmados**; los no confirmados requieren un campo o una casilla adicional.

## 3. Función financiera única

### 3.1. Contrato

Una función pura, sin acceso a Firebase ni al DOM:

```text
calcularCarga(entradas, supuestos) -> resultado
```

**Entradas** (de la carga): `tarifa`, `extrasConfirmados`, `extrasNoConfirmados`, `tollCarga` (número, vacío o "0 confirmado"), `millasCargadas`, `millasDeadhead`, `estadoOrigen`, `estadoDestino`, `fecha`.

**Supuestos** (resueltos antes, ver §4): `cpmBase`, `cpmFuente` (`industria` | `configuracion` | `real`), `combustiblePorMilla`, `peajePromedioPorMilla`, `sueldoPorDia`, `diasCarga`, `margenObjetivo`, `rpmMinimo`.

**Resultado:**

```text
millasTotales      = millasCargadas + millasDeadhead
ingresosTotales    = tarifa + extrasConfirmados
rpmTarifa          = tarifa / millasTotales
rpmTotal           = ingresosTotales / millasTotales
posibleAdicional   = extrasNoConfirmados          (solo informativo)
peajeAplicado      = tollCarga, si se indicó (incluido 0 confirmado)
                     si no: peajePromedioPorMilla × millasTotales   (§5)
costoOperativo     = cpmBase × millasTotales
costoEstimado      = costoOperativo + peajeAplicado
ganancia           = ingresosTotales − costoEstimado      (puede ser negativa)
margen             = ganancia / ingresosTotales            (0 si no hay ingresos)
sueldoCarga        = sueldoPorDia × diasCarga
gananciaTrasSueldo = ganancia − sueldoCarga
umbrales           = ver §7.1
contraoferta       = ver §7.4
snapshot           = copia de entradas + supuestos + versión de la fórmula
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

### 3.4. Evaluación y liquidación de una carga

Una carga guardada tiene dos partes que **no se mezclan**:

| Parte | Qué contiene | ¿Cambia después? | Quién la usa |
|---|---|---|---|
| **Evaluación** | `resultado` + `snapshot` del momento de aceptar (§3.1): ingresos esperados, Extras confirmados y no confirmados, costos estimados, umbrales, decisión | **No.** Es el registro de por qué se aceptó | Historial (comparación), auditoría, Lex (aprendizaje) |
| **Liquidación** | Lo realmente cobrado: `tarifaCobrada`, `extrasCobrados` (lista con concepto, importe y fecha), `ingresoCobrado = tarifaCobrada + Σ extrasCobrados` | Sí, cuando el conductor registra el cobro | Finanzas (ingresos contables), estado de pago |

Reglas:

- Al guardar la carga, la liquidación se inicializa con la tarifa y los Extras **confirmados** de la evaluación.
- **Extra no confirmado que termina cobrándose:** el conductor lo marca como cobrado desde Historial/Finanzas → se añade a `extrasCobrados` y sube `ingresoCobrado`. La evaluación no cambia.
- **Extra confirmado que finalmente no se paga:** se marca como no cobrado → baja `ingresoCobrado`. La evaluación no cambia.
- Historial muestra ambas cifras cuando difieren ("Evaluada: $X · Cobrada: $Y").
- Finanzas usa **siempre** `ingresoCobrado`. Para cargas antiguas sin liquidación, `ingresoCobrado = totalCharge` guardado (lectura tolerante, sin reescribir).
- Cada cambio en la liquidación queda registrado (`liquidacionActualizadaEn`).

## 4. Resolución del CPM base

### 4.1. Tres etapas

| Etapa | Condición | CPM base | Mensaje al conductor |
|---|---|---|---|
| **A. Nuevo** | Sin Configuración completa | Promedio de industria (**un único valor**; hoy hay dos: $0.534 y $0.55) | "Estimado de industria — configura tus costos" |
| **B. Configurado** | Configuración completa, sin historial confiable | Desde Configuración | "Según tu Configuración" |
| **C. Con historial** | Historial que pasa §4.2 | **El que el conductor eligió** (§4.4) | Ambos valores visibles |

### 4.2. Criterios de confianza del CPM real

Periodo: los últimos 12 meses **con actividad** (meses con ≥25 % de las millas de un mes típico del conductor, mínimo 300 mi). Se incluyen los gastos de meses de pausa **intermedios** (seguro y pago del vehículo se pagan igual); se excluyen los posteriores al último mes activo.

**Criterios que bloquean** (si falla alguno, el CPM real se considera no confiable, se queda en etapa B y el desglose indica cuál falló):

1. ≥ 3 meses con actividad y ≥ 20 cargas.
2. Gastos registrados en ≥ 3 meses del periodo.
3. **Combustible coherente con la Configuración.** Hay combustible registrado y el combustible real por milla está entre **0.5× y 1.5×** el esperado (`precio por galón / MPG` de Configuración):
   - por encima de 1.5×: "posibles cargas sin registrar" (hay recibos pero faltan millas);
   - por debajo de 0.5×: "posibles recibos de combustible sin registrar".
   - Si la Configuración no tiene MPG o precio, se usa el rango absoluto $0.10–$0.50/mi.
   - **Es una comparación aproximada**, y así se indica en pantalla: el precio de Configuración es el actual y no el de cada mes del periodo, y el MPG configurado puede no ser exacto. La banda es deliberadamente ancha para absorber esas diferencias: detecta errores de registro groseros (faltan la mitad de los recibos o de las cargas), no variaciones de precio. Con una variación de precio de ±30 % el resultado sigue dentro de la banda.
   - Mejora posterior (no incluida): usar como referencia el precio promedio nacional mensual del combustible del periodo (fuente pública, p. ej. EIA) en lugar del precio actual.
4. Cada uno de los meses con actividad tiene **algún** gasto fijo (seguro o pago del vehículo) si la Configuración indica que existen.

**Criterio que solo advierte** (no bloquea):

5. Millas mensuales promedio inferiores al 40 % de la meta de Configuración → aviso: "Rodaste bastante menos de lo previsto en Configuración; revisa si hay cargas sin registrar o actualiza tu meta de millas". Motivo: rodar menos de lo previsto es real y es justamente cuando el CPM real es más útil (los costos fijos pesan más por milla); invalidarlo devolvería al conductor a un CPM de Configuración más bajo de lo real. La detección de cargas faltantes la cubre mejor el criterio 3.

Los porcentajes de esta sección son **provisionales** (§11.3).

### 4.3. Cálculo

```text
cpmBase real = (gastos del periodo sin peajes − combustible) / millas del periodo
             + combustible de los 3 últimos meses activos / millas de esos meses
```

Combustible reciente con dos protecciones (ya implementadas): si esos 3 meses tienen < 1,000 mi, o el resultado es menor que la mitad del promedio largo, se usa el periodo completo.

### 4.4. Elección del conductor

1. Al pasar los criterios por primera vez, la app muestra ambos CPM con su desglose, **recomienda** el más representativo y pide elegir.
2. La elección se guarda (`users/{uid}.cpmPreference = { fuente, fecha, cpmConfig, cpmReal }`).
3. **No cambia sola.** Se vuelve a preguntar solo si:
   - la diferencia entre ambos cambia más de 15 % respecto al momento de la elección, o
   - el CPM real deja de cumplir los criterios que bloquean de §4.2 (ver §4.5), o
   - el conductor lo pide desde Configuración.
4. Mientras no elija, se usa el de Configuración.
5. La pantalla indica **siempre** qué fuente se está usando y desde cuándo.

### 4.5. Pérdida de confiabilidad de un CPM real ya elegido

Si el conductor eligió el CPM real y después su historial deja de cumplir los criterios que bloquean de §4.2 (p. ej. deja de registrar combustible):

1. La app **lo advierte** de forma visible y explica qué criterio falló.
2. Adopta **temporalmente una referencia segura** (definición pendiente, §11.2 #7) y lo indica: "Usando referencia temporal: [fuente y valor]. Tu historial no es confiable por: [motivo]".
3. **No cambia la elección guardada** del conductor: cuando el historial vuelve a ser confiable, se retoma el CPM real y se avisa.
4. Mientras dure, la decisión del semáforo muestra la etiqueta "referencia temporal".

**Punto a decidir — qué es "segura":** volver sin más al CPM de Configuración **no es seguro** en todos los casos. En el de Ricardo, Configuración da ~$0.51/mi y el real ~$0.74/mi: volver a Configuración haría aceptar cargas que pierden dinero. Propuesta (pendiente, #7):

```text
referenciaSegura = máximo(último CPM real confiable, CPM de Configuración)
```

con el "último CPM real confiable" congelado con su fecha y válido durante un máximo de 6 meses (umbral provisional, §11.3); pasado ese plazo, CPM de Configuración con aviso de revisarla.

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

Se **identifican**, no se excluyen. Un gasto es extraordinario si cumple **las dos** condiciones:

1. **Materialidad:** su importe es ≥ 5 % del total de gastos del periodo de §4.2, **o** su impacto es ≥ $0.02 por milla del periodo.
2. **No recurrencia:** no existe otro gasto de la misma categoría, en otro mes del periodo, con importe dentro de ±10 %.

Esto evita marcar categorías con un solo movimiento pequeño (permisos, una llanta) y pagos mensuales repetidos (seguro, pago del vehículo).

- Aparecen marcados en el desglose ("Ver cómo se calcula").
- El conductor puede marcarlo como "no recurrente" desde Finanzas; en ese caso se **reparte en 12 meses** dentro del CPM en lugar de pesar en un solo mes (decisión pendiente, §11.2 #2).
- Los umbrales (5 %, $0.02/mi, ±10 %) son **provisionales** y deben validarse con datos reales (§11.3).

## 7. Decisión: umbrales, sueldo y Lex

### 7.1. Umbrales

Todos los RPM sobre **millas totales**.

```text
umbralCostos    = cpmBase + peajeAplicado / millasTotales

objetivoSueldo  = umbralCostos + sueldoCarga / millasTotales     (solo si hay sueldo)
objetivoMargen  = umbralCostos / (1 − margenObjetivo)
umbralObjetivo  = máximo(objetivoSueldo, objetivoMargen)         (sin sueldo: objetivoMargen)
```

Reglas de decisión:

| Resultado | Condición |
|---|---|
| **Rechazar** | `rpmTotal < umbralCostos` (pierde dinero) |
| **Evaluar / Casi aceptar** | Cubre costos pero no cumple alguna de las dos condiciones de "Aceptar" |
| **Aceptar** | `rpmTotal ≥ umbralObjetivo` **y** `rpmTarifa ≥ rpmMinimo` |

- **Rentabilidad contra RPM total:** los Extras confirmados son dinero real y ya están en la ganancia.
- **RPM mínimo contra RPM de tarifa:** es un piso de negociación sobre lo que paga el broker, y no depende de Extras.
- **Máximo, no suma:** el sueldo y el margen no se acumulan; se aplica el más exigente y la pantalla indica cuál fue ("objetivo por sueldo" u "objetivo por margen").
- `rpmMinimo` es el campo de Configuración hoy etiquetado "RPM Mínimo" (guardado como `targetRPM`); hoy **no** lo usa el semáforo.
- El promedio histórico de RPM del conductor sigue elevando el umbral de aceptar como hoy.
- Las **excepciones estratégicas** (salir de una zona trampa, reposicionarse hacia una zona premium) no rebajan el umbral: se muestran como una recomendación aparte y explícita.

### 7.2. Sueldo por día

- El sueldo configurado es **bruto, antes de impuestos** (decisión aprobada). El formulario debe indicarlo así.
- `sueldoPorDia = sueldo mensual / días de trabajo al mes` (22 por defecto).
- `diasCarga = máximo(1, horas reales / horas de manejo por día)`, horas reales = duración de Google + 30 min por parada de combustible (si la velocidad resultante está entre 35 y 80 mph; si no, la estimación interna).
- La métrica "ganancia por día" usa **el mismo** `diasCarga` (hoy usa otro redondeo).

### 7.3. Lex AI

Recibe el `resultado` y los `umbrales` de §3 y §7.1 y solo los explica. No calcula CPM ni umbrales propios. Hoy `response-builders.js` usa un `minRPM` fijo de $0.85 y `lex-ai-engine.js` reconstruye umbrales: ambos deben pasar a usar estos datos.

### 7.4. Contraoferta

La tarifa a pedir debe cumplir **ambos** requisitos de "Aceptar", descontando solo los Extras **confirmados**:

```text
tarifaPorObjetivo = umbralObjetivo × millasTotales − extrasConfirmados
tarifaPorMinimo   = rpmMinimo × millasTotales
tarifaObjetivo    = máximo(tarifaPorObjetivo, tarifaPorMinimo)
tarifaEquilibrio  = máximo(umbralCostos × millasTotales − extrasConfirmados, 0)
contraoferta      = tarifaObjetivo × 1.08       (margen de negociación, como hoy)
```

- Los Extras no confirmados **no** reducen la tarifa a pedir.
- Todos los importes del bloque "Acción sugerida" son **tarifa** (lo que se negocia con el broker), y así se rotulan.

## 8. Cargas antiguas

- Una carga guardada **conserva su ganancia y supuestos originales**. Cambiar el CPM o la Configuración no la modifica.
- Al **editar**:
  - si solo cambian texto, compañía, notas o fecha: no se recalcula nada;
  - si cambian tarifa, extras, toll o millas **y la carga tiene snapshot**: se recalcula con los **supuestos guardados en la carga**;
  - si cambian tarifa, extras, toll o millas **y la carga no tiene snapshot**: **no se reconstruye ni se infiere el CPM original** (las fórmulas anteriores mezclaban tolls, "otros" y el costo fantasma, así que cualquier CPM deducido arrastraría esos errores). La app avisa: "Esta carga no guarda los costos con que se calculó. Se recalculará con tus costos actuales ($X/mi)". Requiere confirmación y se registra (`recalculatedAt`, `cpmFuente`, `formulaVersion`, y se crea el snapshot a partir de ese momento).
- Recalcular una carga **con** snapshot usando supuestos actuales solo con una acción explícita ("Recalcular con mis costos de hoy"), también registrada.
- Lectura tolerante de campos antiguos (`miles`, `loaded`, `deadhead`, `rate`, `totalCost`), sin reescribirlos.
- **Ninguna migración masiva** que reescriba cargas.

## 9. Configuración y unidades

- Mantenimiento, llantas y reparaciones: el formulario dice "Mensual ($)" y así se calculan.
- Configuraciones antiguas con valores < $1 en esos campos (probablemente por milla, de una versión anterior): **no convertir en silencio**. Mostrar un aviso en Configuración y en la calculadora: "¿Estos valores son por milla o por mes?" y guardar según la respuesta.
- Un único valor de promedio de industria para usuario nuevo (§4.1).
- El formulario no viene relleno con costos de ejemplo para usuarios nuevos (ya hecho en la vista previa).
- El campo de sueldo indica "bruto, antes de impuestos" (§7.2).
- `isEstablishedUser()` debe considerar "Configuración completa", no solo antigüedad de la cuenta.

## 10. Plan de pruebas

### 10.1. Unitarias (función pura, Node)

Reutilizar y ampliar el prototipo de ChatGPT (`financial-engine.test.mjs`, 11 pruebas) y las simulaciones de Claude (10 casos de CPM):

- Extras confirmados y no confirmados, toll escrito, toll vacío con promedio, ruta sin peajes, pérdidas negativas.
- RPM total vs RPM de tarifa: carga que cumple el objetivo solo gracias a Extras confirmados pero no el RPM mínimo de tarifa → no "Aceptar".
- Objetivo por sueldo vs por margen: cada uno ganando por separado; sin sueldo.
- Contraoferta: con y sin Extras confirmados; cuando manda el RPM mínimo; Extras no confirmados no la reducen.
- Valores 0 en Configuración respetados.
- Etapas A, B, C; cada criterio que bloquea de §4.2 fallando por separado; el criterio 5 solo produce aviso.
- Combustible por encima de 1.5× y por debajo de 0.5× del esperado.
- Pausa larga, carga suelta tras pausa, mes de pausa intermedio.
- Gasto extraordinario: material y no recurrente (marcado); material pero recurrente (no marcado); no material (no marcado).
- Edición de carga sin snapshot: no infiere CPM, pide confirmación.

### 10.2. Integración en navegador (Chrome sin ventana, como la prueba del PDF)

Con datos de prueba en un proyecto/emulador, **nunca** con datos reales:

1. Calcular → el panel muestra X.
2. Guardar → la carga guardada tiene exactamente X y su snapshot.
3. Editar solo notas → X no cambia.
4. Editar millas → recalcula con los supuestos guardados.
5. Editar millas de una carga sin snapshot → aviso y confirmación.
6. Historial, Zonas y reportes muestran X.
7. Cambiar el CPM en Configuración → las cargas anteriores siguen en X.
8. **Sin conexión**: guardar, recuperar conexión, sincronizar → la carga sincronizada tiene X.
9. Lex recibe X y los mismos umbrales.

### 10.3. Datos reales (solo lectura)

Con las 112 cargas de Ricardo, **dos validaciones distintas** que no deben confundirse:

**A. Validación contable** (¿el motor lee los mismos datos que Finanzas?)
- Para el mismo rango de fechas, el total de gastos y el total por categoría del periodo de §4.2 coinciden con el reporte de Finanzas.
- Número de cargas y millas totales coinciden.
- Referencia actual: $50,671.32 / 112 cargas / 68,736 mi.

**B. Validación del CPM** (¿el número de decisión sale bien de esos datos?)
- El CPM base **no** tiene por qué reproducir `gastos totales ÷ millas`, porque excluye peajes y usa combustible reciente. Lo que se comprueba es que sea **reproducible desde el desglose**:
  `(gastos del periodo − peajes − combustible) / millas del periodo + combustible reciente / millas recientes`.
- Identidad de control: con combustible del periodo completo y peajes incluidos, el resultado sí debe igualar `gastos totales ÷ millas` (~$0.737 en los datos de Ricardo).
- Contar cuántos gastos marca §6 con los umbrales provisionales y revisarlos uno a uno para validar esos umbrales.

## 11. Decisiones

### 11.1. Aprobadas por Ricardo

| Decisión | Contenido |
|---|---|
| A | CPM real como referencia principal cuando es confiable, mostrando también el de Configuración, con elección del conductor recordada (§4.4) |
| B | Exigir el RPM mínimo además del objetivo (§7.1) |
| C | Confirmar unidades de mantenimiento sin conversión silenciosa (§9) |
| D | Peajes separados del CPM base (§5) |
| E | Conservar el resultado original de las cargas antiguas (§8) |
| F | **RPM mínimo sobre millas totales** (cargadas + deadhead) |
| G | **Sueldo bruto, antes de impuestos** |

Ajustes de diseño acordados en la revisión cruzada (rev. 2): RPM total para rentabilidad y RPM de tarifa para el mínimo (§7.1); contraoferta con ambos requisitos y solo Extras confirmados (§7.4); objetivo = máximo entre sueldo y margen (§7.1); sin reconstrucción de CPM en cargas sin snapshot (§8); criterio de millas como advertencia y control de combustible esperado (§4.2); gastos extraordinarios por materialidad y recurrencia (§6).

### 11.2. Pendientes de Ricardo (sin aprobar)

| # | Decisión | Propuesta |
|---|---|---|
| 1 | ¿Aprobar los criterios de confianza de §4.2? | Sí |
| 2 | Gastos "no recurrentes": ¿repartirlos en 12 meses? | Sí, solo si el conductor los marca |
| 3 | ¿Casilla "Ruta sin peajes"? | Sí |
| 4 | ¿Botón "Recalcular con mis costos de hoy" en Historial? | Sí, con confirmación |
| 5 | Promedio de industria único: ¿$0.55? | $0.55 hasta revisar con datos de mercado |
| 6 | Tus valores de mantenimiento (0.014 / 0.012 / 0.025): ¿por milla o por mes? | — |

Nueva en la revisión 3 (también sin aprobar):

| # | Decisión | Propuesta |
|---|---|---|
| 7 | "Referencia segura" cuando un CPM real elegido deja de ser confiable (§4.5) | Máximo entre el último CPM real confiable (válido 6 meses) y el de Configuración |

### 11.3. Umbrales provisionales (a validar con datos)

| Umbral | Valor provisional | Dónde |
|---|---|---|
| Mes con actividad | ≥ 25 % de un mes típico, mínimo 300 mi | §4.2 |
| Combustible esperado | entre 0.5× y 1.5× de precio/MPG | §4.2 criterio 3 |
| Advertencia de millas | < 40 % de la meta | §4.2 criterio 5 |
| Re-preguntar elección de CPM | cambio > 15 % | §4.4 |
| Vigencia del último CPM real confiable | 6 meses | §4.5 |
| Gasto extraordinario | ≥ 5 % del total o ≥ $0.02/mi, sin otro ±10 % en la categoría | §6 |
| Margen de contraoferta | +8 % sobre la tarifa objetivo | §7.4 |

## 12. Problemas conocidos fuera del motor (registrados)

1. **3 pruebas fallando en `functions/test-admin.js`** ("3 pagos en Firestore", "totalPaid…", "failedPaymentsCount…"). Causa: desde el commit `f86d2cf` `adminGetUserDetail` lee los pagos de la API de Stripe (`stripe.charges.list`), pero la prueba sigue simulando pagos en Firestore. El código es correcto; la prueba está desactualizada. Relacionado: `adminGetBillingOverview` sigue leyendo `collectionGroup('payments')`, que no se llena, así que sus totales pueden salir en $0.
2. Dos cargas con RPM exportado distinto de tarifa/millas (Freight Alliance #24035, Empire #531198). Hipótesis: la versión anterior de `saveLoad()` guardaba `totalCharge = tarifa + tolls + otros`. No verificado.
3. Agrupación de nombres de compañías en reportes.
4. `evaluateLoad` (Cloud Function) no tiene llamadas: código muerto.
5. Clave de OpenRouter pendiente de rotar (estuvo expuesta antes del 12-11-2026).

## 13. Fases de implementación (tras aprobación)

1. Función pura + pruebas unitarias (sin tocar pantallas).
2. Calculadora, panel y guardado (online y sin conexión) usando la función.
3. Historial (§8), evaluación y liquidación (§3.4) y reportes estimados.
4. Resolución del CPM (§4) con la elección del conductor y la referencia temporal (§4.5).
5. Peajes (§5), Extras confirmados (§2) y gastos extraordinarios (§6).
6. Lex (§7.3).
7. Pruebas de integración (§10.2) y verificación con datos reales (§10.3).
8. Vista previa → revisión de Ricardo → producción.

Cada fase: un commit, pruebas en verde, sin desplegar a producción hasta la fase 8.
