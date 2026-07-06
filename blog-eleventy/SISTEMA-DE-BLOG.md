# SISTEMA DE BLOG — Smart Load Solution (Eleventy)

> **Este documento se sube a los archivos del Proyecto de Claude.** Cualquier
> chat nuevo dentro de este Proyecto puede leerlo para saber exactamente cómo
> funciona el blog, sin que Ricardo tenga que re-explicarlo cada vez.

---

## Qué es esto

El blog de smartloadsolution.com corre sobre **Eleventy** (generador de sitios
estáticos), viviendo en `expediter-app/blog-eleventy/` — carpeta hermana de
`public/`. Genera HTML estático que se copia a `public/blog/` y
`public/en/blog/`, servido igual que siempre por Firebase Hosting.

**Regla de oro:** Ricardo nunca escribe código ni YAML. Su trabajo es dar el
contenido (título, texto, foto). Claude (o Claude Code) arma el archivo,
prueba, y muestra el resultado.

---

## Estructura del proyecto

```
expediter-app/
  public/
    blog/*.html            ← output final ES (no editar a mano)
    en/blog/*.html         ← output final EN (no editar a mano)
    img/blog/*.webp/.jpg   ← banco de fotos
    blog.html, en/blog.html ← índices del blog
  blog-eleventy/
    .eleventy.js
    blog-source/
      _data/i18n.json      ← TODOS los textos compartidos (nav, footer, CTA), por idioma — NO se repiten en cada post
      _includes/layouts/
        post.njk           ← plantilla de artículo individual
        blog-index.njk      ← plantilla del índice (destacado + filtro + grid)
      es/posts/*.md         ← posts en español (contenido real)
      en/posts/*.md         ← posts en inglés
      es/blog.njk, en/blog.njk  ← páginas de índice (casi vacías, heredan de i18n.json)
    _site_blog/             ← output de prueba aislado (no tocar public/ directo)
```

---

## Banco de fotos disponible (`public/img/blog/`)

| Archivo | Tono / uso |
|---|---|
| `ricardo-headshot.webp` | **Fija siempre** — foto de perfil del autor, nunca cambia |
| `ricardo-van-hero.webp` | Neutro / financiero |
| `ricardo-cab-hero.webp` | Cálculo o decisión en cabina |
| `ricardo-gasolinera-hero.webp` | Combustible / costos |
| `ricardo-carga-interior-hero.webp` | Carga real asegurada |
| `ricardo-carretera-hero.webp` | En ruta, vista desde el volante |
| `ricardo-canon-hero.webp` | Rutas largas / desierto / "millas vacías" |
| `ricardo-westvirginia-hero.webp` | Cruce de estados / viaje largo |

Si hace falta una foto nueva: Ricardo sube fotos reales (celular en horizontal,
espacio alrededor del sujeto), Claude las recorta a 1600×840 con Python/PIL
(`ImageOps.exif_transpose` + crop + resize) y guarda `.jpg` + `.webp`.

---

## Cómo crear un post nuevo (proceso completo)

### Paso 1 — Contenido
Ricardo da: título, texto del artículo (con sus H2), categoría, y de qué trata
(para elegir foto). Si el contenido ya se escribió en un chat anterior, Claude
lo busca con `conversation_search` en vez de pedir que se reescriba.

### Paso 2 — Claude arma el archivo `.md`
Ubicación: `blog-source/es/posts/slug-del-post.md` (o `en/posts/`).

Front matter mínimo (ya NO hace falta repetir nav/footer/CTA — vienen de
`_data/i18n.json` automáticamente):

```yaml
---
layout: layouts/post.njk
lang: es
slug: "slug-del-post"
translationSlug: "equivalente-en-el-otro-idioma"
title: "Título H1"
metaTitle: "Título de pestaña"
metaDescription: "Meta description"
ogDescription: "(opcional, si difiere de metaDescription)"
category: "Finanzas | Estrategia | Legal | Guía B2B | Productividad"
heroImage: "archivo-del-banco.webp"
heroImageAlt: "descripción real de la foto"
readTime: 7
date: 2026-07-05
featured: true   # opcional — solo UNO por idioma a la vez
faqs:
  - question: "..."
    answer: "..."
  # 4-6 pares
permalink: "{% if lang == 'es' %}blog/{{ slug }}.html{% else %}en/blog/{{ slug }}.html{% endif %}"
---
[cuerpo del artículo en HTML crudo, no Markdown — el sitio no usa el plugin
Tailwind Typography, así que los H2/p/ul necesitan las clases explícitas.
Copiar el patrón de cualquier post existente.]
```

**Autor:** siempre "Ricardo Galán" con `ricardo-headshot.webp" — viene por
defecto de `i18n.json`, no hace falta declararlo salvo excepción real.

**Inglés:** antes de traducir nav/footer/CTA, ya están en `i18n.json` bajo la
clave `en` — pero si se crea contenido nuevo en inglés, revisar que el tono
sea consistente con el resto del sitio en inglés.

### Paso 3 — Probar en local
```powershell
cd blog-eleventy
npm run build
firebase serve
```
Abrir `http://localhost:5000/blog/slug-del-post.html` — revisar hero, foto de
autor, contenido, FAQ. Usar siempre `firebase serve` (no `npx serve`) para que
las imágenes reales carguen.

### Paso 4 — Producción
```powershell
copy _site_blog\blog\slug-del-post.html ..\public\blog\
# chequeo:
cd ..\public
Select-String -Path "blog\slug-del-post.html" -Pattern "TODO"
Select-String -Path "blog\slug-del-post.html" -Pattern "Equipo SmartLoad"
# (ninguno debe devolver nada)

git add public/blog/slug-del-post.html
git status   # confirmar que es exactamente lo esperado
git commit -m "Nuevo post: [título corto]"
git push
firebase deploy --only hosting
```
Verificar en `smartloadsolution.com` (con `?nocache=1` si hace falta).

### Paso 5 — No olvidar
Agregar la entrada al `public/sitemap.xml` con su bloque de hreflang.

---

## Decisiones de diseño ya tomadas (no reabrir)

- **Autor real, no "Equipo SmartLoad"** — por E-E-A-T, según el propio skill de SEO.
- **Foto de hero distinta por tema**, foto de autor fija — nunca repetir la
  misma foto de hero en 2 posts consecutivos si hay alternativa disponible.
- **HTML crudo en el cuerpo**, no Markdown — el sitio no tiene el plugin de
  Tailwind Typography.
- **FAQ + schema `FAQPage` + `Article`** en todos los posts — ya integrado en
  el layout, no hace falta tocarlo.
- **`img/` siempre con ruta absoluta `/img/...`**, nunca con `rootPrefix` —
  bug ya corregido, no reintroducirlo.
- **Nunca copiar a `public/` sin que Ricardo revise en el navegador primero.**

## Pendientes conocidos (no urgentes)
- 2 posts nuevos (cuánto pagan por milla / millas muertas) sin versión en
  inglés todavía — el hreflang apunta a una URL que aún no existe.
- `blog-eleventy/` vive dentro de Google Drive (`expediter-app`) — riesgo de
  fricción con `npm install`/`node_modules` ya conocido y documentado; la
  solución de fondo (sacar todo el repo de Drive) sigue pendiente como tarea
  aparte.
- Considerar un editor visual (Decap CMS o Sveltia CMS) para que Ricardo pueda
  crear posts sin depender de un chat de Claude — evaluado, no implementado
  todavía.
