# Migración del blog a Eleventy — scaffold inicial

## 0. Qué es esto
Esqueleto mínimo de Eleventy para generar el blog como HTML estático que sigue
sirviéndose desde Firebase Hosting. **Todavía no toca `public/`.** El build
genera en una carpeta aislada (`_site_blog/`) para revisar antes de copiar nada
a producción.

## 1. Instalación (FUERA de la carpeta de Google Drive)

Node ya confirmado: v24.13.0 — compatible con Eleventy 3.x sin problema.

```powershell
# 1. Copiar esta carpeta fuera de Google Drive, ej:
#    C:\Proyectos\smartload-blog-eleventy\
# (el driver de Drive rompe la extracción de paquetes npm si se instala ahí directo)

cd C:\Proyectos\smartload-blog-eleventy
npm install

# 2. Probar que Eleventy corre
npm run build
```

Si el build corre sin errores, debería aparecer `_site_blog/blog/costos-ocultos-operacion.html`.

## 2. Antes de seguir: completar los TODOs

El archivo `blog-source/_includes/layouts/post.njk` tiene 3 bloques marcados `TODO`
que no pude reconstruir porque el extracto compartido no los incluía completos:

1. Meta tags adicionales de SEO + `<link>` de CSS (en el `<head>`)
2. Bloque de tracking GA4 + Facebook Pixel (justo después de `<body>`)
3. El `<footer>` completo

Son **idénticos en los 10 posts existentes** — cópialos literalmente de cualquiera
de los archivos actuales (ej. `public/blog/costos-ocultos-operacion.html`) y pégalos
en el layout.

El archivo `blog-source/es/posts/costos-ocultos-operacion.md` también tiene 2 TODOs:
- `metaDescription` exacta del `<head>` original
- El cuerpo completo del artículo (convertir de HTML a Markdown — puede ser tan
  simple como quitar las etiquetas `<p>`, `<h2>`, etc. y dejar Markdown puro, ya
  que el layout ya envuelve el contenido en el `<div class="prose...">`)

## 3. Protocolo de prueba (test-one-file-before-all)

**No conviertas los 10 posts todavía.** Primero:

1. Completa los TODOs de este único post (`costos-ocultos-operacion`)
2. Corre `npm run build`
3. Compara `_site_blog/blog/costos-ocultos-operacion.html` contra
   `public/blog/costos-ocultos-operacion.html` real — idealmente con
   `Compare-Object` o un diff visual — para confirmar que el HTML generado
   es funcionalmente idéntico (mismo head, mismo header, mismo footer, mismo
   contenido, mismas URLs de hreflang).
4. Solo después de confirmar esto, se convierten los 9 posts restantes con el
   mismo patrón.

## 4. Pendiente después de validar el post de prueba

- Convertir los 9 posts restantes (4 ES + 1 LLC ES + 4 EN + 1 LLC EN) al mismo
  formato Markdown + front matter.
- Reconstruir `blog.html` (índice) como plantilla Eleventy que liste los posts
  vía `collections`, en vez del HTML hardcodeado actual — manteniendo el diseño
  de tarjetas + emojis + sección "Featured" ya existente.
- Escribir los 2 posts nuevos en español ya redactados ("cuánto pagan por milla"
  y "millas muertas") directamente como Markdown + front matter en este sistema
  — no como HTML suelto.
- Definir script/paso final de copiado de `_site_blog/blog/*` → `public/blog/*`
  y `_site_blog/en/blog/*` → `public/en/blog/*` (manual o vía comando, después
  de que Ricardo verifique con PowerShell).
