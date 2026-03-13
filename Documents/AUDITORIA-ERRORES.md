# AUDITORÍA DE ERRORES — SmartLoad / Expediter App
**Fecha**: 2026-03-13

---

## CRÍTICOS (Acción inmediata)

### 1. Credenciales expuestas en el repo
- **Archivo**: `functions/.env`
- **Problema**: `META_ACCESS_TOKEN` y `STRIPE_WEBHOOK_SECRET` están commiteados
- **Riesgo**: Acceso no autorizado, pérdidas financieras
- **Acción**: Rotar todos los tokens YA + sacar del historial git (BFG Repo Cleaner)

### 2. Google Maps API Key expuesta en HTML público
- **Archivos**: `public/app.html:2562`, `public/auth.html:279`, `public/plans.html:419`
- **Key**: `AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY`
- **Riesgo**: Ataques de agotamiento de cuota
- **Acción**: Restringir la key en Google Cloud Console (solo dominios autorizados)

### 3. Firebase config con API key idéntica expuesta en JS cliente
- **Archivo**: `public/js/config.js:8-15`
- **Problema**: Misma API key de Maps usada en firebaseConfig
- **Acción**: Restringir la key + separar keys por servicio

---

## ALTOS

### 4. Páginas faltantes referenciadas en el footer
- **Archivo**: `public/index.html:1734-1736`
- **Páginas que no existen**: `blog.html`, `faq.html`, `support.html`
- **Impacto**: Links rotos, SEO dañado
- **Acción**: Crear las páginas o quitar los links del footer

### 5. Manifest.json — nombres de íconos incorrectos
- **Archivo**: `public/manifest.json:20,26,32,46,58`
- **Referencia incorrecta**: `/icon192.png`, `/icon512.png`
- **Archivos reales**: `icon-192.png`, `icon-512.png`
- **Impacto**: PWA no instala íconos correctamente
- **Acción**: Corregir nombres en manifest.json

### 6. OG image URL inconsistente en landing page
- **Archivo**: `public/landing/index.html:17`
- **URL landing**: `/assets/images/og-image.jpg` ❌
- **URL correcta**: `/img/og-image.jpg` ✓
- **Impacto**: Preview roto en redes sociales desde landing
- **Acción**: Unificar URL

---

## MEDIOS

### 7. 430+ console.log en producción
- **Archivos**: `public/js/main.js` y múltiples archivos JS
- **Impacto**: Información expuesta, degradación de performance
- **Nota**: Existe `debugLog()` con `DEBUG_MODE`, pero debe desactivarse en prod

### 8. Alt text faltante en imágenes
- **Archivo**: `public/app.html:830` (lex-thinking.png sin alt)
- **Impacto**: WCAG 2.1 Nivel A — accesibilidad

### 9. Firebase inicializado dos veces
- **Archivos**: `public/js/config.js` + `public/academy/js/academy.js:335`
- **Riesgo**: Race conditions, listeners duplicados

### 10. Favicon WebP en landing (sin fallback PNG)
- **Archivo**: `public/landing/index.html:56`
- **Problema**: WebP no soportado en todos los browsers
- **Acción**: Usar PNG como favicon

### 11. Inline event handlers (onclick="...")
- **Archivo**: `public/app.html:445`
- **Recomendación**: Migrar a addEventListener

### 12. TODO sin implementar
- **Archivo**: `public/js/core/lex-modals.js:52`
- **Código**: `stateAvgRPM: 'N/A', // TODO: agregar desde perfil`
- **Impacto**: Feature incompleto, muestra N/A al usuario

---

## BAJOS

### 13. innerHTML con datos dinámicos (mitigado)
- **Archivos**: `zones.js`, `ui-feedback.js`, `mobile.js`, `userPlans.js`, `lex-modals.js`
- **Nota**: Existen `sanitizeHTML()` y `sanitizeText()` en `security.js` — riesgo bajo

### 14. Variables globales en window
- **Archivo**: `public/js/main.js:468-506`
- **Globals**: `window.appState`, `window.logout`, `window.debugApp`, etc.
- **Recomendación**: Usar namespace o módulos

### 15. Sin Content-Security-Policy (CSP)
- **Archivo**: `firebase.json` — no tiene headers CSP
- **Recomendación**: Agregar CSP headers

### 16. OAuth domain inconsistente
- **Problema**: Algunas páginas usan `smartloadsolution.com`, otras `app.smartloadsolution.com`
- **Riesgo**: CORS issues potenciales

### 17. Código comentado
- **Archivos**: `app.html:66,2658`, `landing/index.html:24-44`
- **Acción**: Limpiar

---

## LO QUE ESTÁ BIEN ✓

- Firestore Security Rules: bien estructuradas con validación y roles
- robots.txt + sitemap.xml: correctos
- Meta tags OG + Twitter Cards: bien configurados (excepto landing)
- Service Worker + PWA: implementado correctamente
- HTTPS: enforced por Firebase Hosting
- sanitizeHTML/sanitizeText: implementado para XSS protection
- Todos los ~70 archivos JS referenciados en app.html existen

---

## PLAN DE ACCIÓN

| Prioridad | Tarea |
|-----------|-------|
| 🔴 HOY | Rotar Meta token + Stripe secret + restringir API key Google |
| 🔴 ANTES DE DEPLOY | Corregir manifest.json, crear/quitar páginas faltantes, fix OG landing |
| 🟡 SPRINT ACTUAL | Alt text, deshabilitar debug en prod, consolidar Firebase init |
| 🟢 SIGUIENTE SPRINT | CSP headers, refactor globals, completar stateAvgRPM |
