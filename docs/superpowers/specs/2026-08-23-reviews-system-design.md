# Sistema de captura y muestra de reviews

**Date:** 2026-08-23
**Status:** Approved, pending implementation plan

## Problem

SmartLoad Solution no tiene reviews reales en ningún lado. La sección
"testimonials" del homepage (`public/index.html#testimonials`) tenía
testimonios inventados hasta que se reemplazaron por afirmaciones de
beneficio honestas pero genéricas (commit `deaf5f5`, previo a esta
sesión) — una decisión correcta, pero dejó un vacío real: no hay
ninguna prueba social externa en ningún lugar del sitio ni del negocio.

Confirmado por búsqueda web (2026-08-23): no existe ningún perfil de
Google Business para "Smart Load Solution" ni para
`smartloadsolution.com`. Los resultados que mencionan nombres
parecidos ("Smart Load USA Inc.", un retailer en Covina CA; "Smartload"
de Sudáfrica en Google Play) son empresas completamente distintas, sin
relación con este producto.

El negocio ya tiene usuarios reales (plan gratis y pagos, confirmado
por Ricardo) que podrían dejar reviews genuinas si se les pide en el
momento correcto — hoy no existe ningún mecanismo para pedirlo.

## Goals

- Crear un perfil de Google Business Profile real para SmartLoad
  Solution, para que aparezca con estrellas/reviews cuando alguien
  busque el nombre de la marca en Google.
- Pedir reviews automáticamente a usuarios reales, en el momento en
  que ya vieron valor concreto en la app (no antes, no a ciegas) —
  usando la misma infraestructura de email que ya se construyó esta
  sesión (`mail` collection vía Firestore, extensión ya activa).
- Cuando existan reviews reales, mostrarlas en el homepage — nunca
  antes, nunca inventadas.

## Non-goals (out of scope for this pass)

- Trustpilot, G2, Capterra u otras plataformas de reviews. Dado el
  perfil real de usuario (transportistas independientes, no
  compradores de software B2B enterprise), Google Business Profile es
  el lugar donde efectivamente los van a buscar y donde aparece
  directo en resultados de búsqueda de la marca. Si más adelante el
  negocio pivota a ventas a flotas/empresas, reconsiderar G2/Capterra
  como una iniciativa aparte.
- Rediseñar la sección de testimonios del homepage con contenido real
  ahora mismo — no hay reviews todavía. Se deja la estructura lista
  (Task de la fase 2) pero poblada solo cuando haya contenido real que
  mostrar.
- Incentivar reviews con descuentos/beneficios a cambio — Google
  Business Profile prohíbe explícitamente pagar o incentivar reviews;
  pedirlo así arriesgaría la cuenta completa.
- Reviews dentro de la app misma (in-app rating prompt) — la app es
  PWA sin distribución en tiendas de apps, así que no aplica el patrón
  típico de "rate this app" de iOS/Android. Si en el futuro se agrega
  a Play Store/App Store, reconsiderar.

## Architecture

### Fase 1 (manual, Ricardo) — Crear el Google Business Profile

No es código, es un paso que Ricardo tiene que completar directamente
en su cuenta de Google:

1. Ir a [business.google.com](https://business.google.com/create) y
   crear el perfil.
2. Tipo de negocio: **"Service area business"** (sin dirección
   pública) — correcto para un SaaS usado por transportistas en
   cualquier parte de EE.UU., no un local físico.
3. Categoría: "Software company" o la más cercana disponible.
4. Verificación: Google generalmente pide verificación por video o
   postal para negocios de área de servicio — puede tomar unos días.
5. Una vez verificado, obtener el **link corto para pedir reviews**
   (en el dashboard de Google Business Profile: Home → "Get more
   reviews" → copiar el link, formato `https://g.page/r/.../review`).

Este link es el input que el resto del sistema (Fase 3) necesita —
todo lo demás puede construirse en paralelo sin bloquear en este paso,
pero no puede *activarse* hasta tenerlo.

### Fase 2 (código, ahora) — Sección de testimonios lista para contenido real

`public/index.html`/`public/en/index.html`, la sección `#testimonials`
actual se deja intacta (los beneficios genéricos siguen siendo
honestos y correctos) — se agrega una nueva subsección debajo,
inicialmente oculta (`style="display:none"` con un comentario
explicando que se activa manualmente cuando hay reviews reales que
pegar), con el markup listo para 3 tarjetas de review + un link "Ver
más reviews en Google". Nada de contenido inventado — placeholders de
texto explícitos como `[PEGAR REVIEW REAL AQUI]`, imposibles de
confundir con contenido real si alguien los ve accidentalmente.

### Fase 3 (código, ahora — activación pendiente del link de Fase 1)

Nueva Cloud Function programada `requestReviews` (patrón `onSchedule`,
corre 1x/día), que:

- Busca usuarios (`users` collection) que cumplan **todas** estas
  condiciones:
  - **Confirmado por código** (`public/js/userPlans.js`,
    `functions/index.js`): el único contador que existe es
    `loadsThisMonth`, y se resetea cada mes (`monthStartDate`) — no
    sirve como señal de "cuánto uso real acumuló este usuario en su
    vida". En vez de usarlo como proxy, la función cuenta directo
    sobre la colección `loads` con una query de agregación
    (`db.collection('loads').where('userId','==',uid).count().get()`)
    — barato, corre 1x/día en background, da el número real de cargas
    calculadas históricamente por ese usuario, sin depender de un
    campo que se resetea.
  - `totalLoads >= 10` (resultado de la query de arriba).
  - Cuenta creada hace **7 días o más** (`createdAt`), para dar
    tiempo real de uso antes de pedir opinión.
  - `reviewRequestSent` no es `true` (campo nuevo, evita pedir dos
    veces a la misma persona).
- Por cada usuario que califica: escribe un doc a Firestore `mail`
  (mismo patrón que el resto del sistema) con un email pidiendo la
  review, incluyendo el link de Google Business Profile de la Fase 1
  (guardado como constante/config, no hardcodeado dos veces).
- Marca `reviewRequestSent: true` en el doc del usuario para no
  repetir.

**Bloqueo real:** el link de Google Business Profile (Fase 1) es un
placeholder hasta que Ricardo lo tenga. El código de la Fase 3 se
puede escribir y testear con un placeholder, pero **no se despliega
activo** (la función programada no se crea/habilita) hasta tener el
link real — desplegar con un placeholder mandaría emails con un link
roto a usuarios reales.

## Decisiones a confirmar con Ricardo antes de ejecutar

- **Umbral de "usuario calificado"** (10 cargas / 7 días) — es una
  propuesta razonable pero ajustable; Ricardo conoce mejor el patrón
  de uso real de sus usuarios.
- **Tono del email** — pedir reviews sin sonar desesperado ni spammy
  es un balance de copywriting que vale la pena revisar antes de
  mandarlo a clientes reales.
