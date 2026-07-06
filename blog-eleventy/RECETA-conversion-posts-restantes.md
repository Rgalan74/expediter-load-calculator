# RECETA: Convertir los 8 posts de blog restantes a Eleventy

## Contexto
El blog de Smart Load Solution se está migrando de HTML estático suelto a Eleventy
(11ty), manteniendo el mismo output final (HTML estático servido por Firebase Hosting
en las mismas URLs de siempre). Ya se validó la plantilla y el proceso completo con
2 posts de prueba. Esta receta es para que conviertas los 8 restantes sin necesitar
supervisión manual en cada paso.

**Ubicación del proyecto Eleventy:** `blog-eleventy/` — vive DENTRO del repo principal
`expediter-app/`, como carpeta hermana de `public/`. Es decir, la estructura es:

```
expediter-app/
  public/
    blog/*.html          ← posts originales en español (fuente de la verdad)
    en/blog/*.html       ← posts originales en inglés
    img/blog/            ← imágenes ya procesadas (headshot, hero, etc.)
  blog-eleventy/         ← el proyecto Eleventy (donde tú trabajas)
    .eleventy.js
    blog-source/
    _site_blog/          ← output de prueba, aislado, no toca public/ todavía
```

Como todo vive en el mismo repo, las rutas relativas desde `blog-eleventy/` hacia
los originales son simplemente `../public/blog/<archivo>.html` y
`../public/en/blog/<archivo>.html` — no hace falta copiar nada a ningún lado ni
salir del workspace.

---

## Regla crítica ya corregida — NO reintroducir este bug

En `blog-source/_includes/layouts/post.njk`, las rutas de **imágenes** (`/img/...`)
son siempre absolutas desde la raíz del dominio, SIN el prefijo `{{ rootPrefix }}`.
`rootPrefix` solo se usa para los links de navegación (`index.html`, `about.html`,
`blog.html`, etc.), porque esos SÍ cambian según el idioma (`/` para español,
`/en/` para inglés), pero las imágenes viven en `/img/` sin importar el idioma del
post. Si ves `{{ rootPrefix }}img/` en algún lado del layout, es un bug — corrígelo
a `/img/` directo.

---

## Los 8 posts pendientes (con su par de idioma)

Rutas relativas desde `blog-eleventy/`: español en `../public/blog/`, inglés en
`../public/en/blog/`.

| # | Español (`../public/blog/`) | Inglés (`../public/en/blog/`) |
|---|---|---|
| 1 | `decidir-carga-en-30-segundos.html` | `decide-load-30-seconds.html` |
| 2 | `llc-vs-propietario-unico.html` | `llc-vs-sole-proprietor.html` |
| 3 | `zonas-rentables-expediters.html` | `profitable-zones.html` |
| 4 | *(ya convertido)* `como-calcular-rpm-real.html` | `calculate-real-rpm.html` ⬅️ **este SÍ falta, es la versión EN del que ya se hizo en ES** |
| 5 | *(ya convertido)* `costos-ocultos-operacion.html` | `hidden-operating-costs.html` ⬅️ **este SÍ falta también** |

Es decir: **3 posts en español nuevos** + **5 posts en inglés** (los 3 nuevos en su
versión EN, más las versiones EN de los 2 que ya están hechos en ES) = 8 total.

---

## Paso a paso por cada post

### 1. Leer el HTML original
Extraer de `../public/blog/<archivo>.html` (o `../public/en/blog/` para inglés):
- `<title>` exacto (tag de pestaña del navegador)
- Meta description, og:title, og:description, twitter:title, twitter:description
- Badge de categoría (ej. "Finanzas", "Estrategia", "Legal") — visible en el HTML
  como el `<span>` con clase `bg-cyan-900/40` (o similar) justo antes del `<h1>`
- Tiempo de lectura (texto "Lectura: X min")
- El cuerpo completo dentro de `<div class="prose prose-invert max-w-none...">`
  hasta el comentario `<!-- Lead Magnet CTA -->`

### 2. NO convertir el cuerpo a Markdown puro
El sitio usa Tailwind CDN base (sin el plugin de Typography), así que las clases
inline (`text-xl font-bold text-white mt-8 mb-4`, etc.) son las que controlan el
diseño real — un `##` de Markdown genérico no tiene esas clases y se vería roto.
**Pega el HTML del cuerpo tal cual, sin modificar las clases**, directamente
como contenido del archivo `.md` (después del front matter). Eleventy/markdown-it
deja pasar HTML crudo sin tocarlo.

### 3. Front matter — plantilla exacta a usar

```yaml
---
layout: layouts/post.njk
lang: es                                    # o "en" para posts en inglés
title: "[H1 exacto del post]"
metaTitle: "[<title> exacto de la pestaña]"
metaDescription: "[meta description exacta]"
ogTitle: "[og:title exacto]"
ogDescription: "[og:description exacto]"
ogImage: "https://smartloadsolution.com/img/og-image-es.png"   # o og-image-en.png si existe
twitterTitle: "[twitter:title exacto]"
twitterDescription: "[twitter:description exacto]"
category: "[categoría exacta del badge]"
author: "Ricardo Galán"                     # SIEMPRE, nunca "Equipo SmartLoad"
authorPhoto: "ricardo-headshot.webp"        # SIEMPRE el mismo, es la foto de perfil fija
heroImage: "[ver sección de imágenes abajo]"
heroImageAlt: "[descripción corta y real de la foto]"
readTime: [número]
date: [fecha real de publicación si se conoce, si no usar la fecha de hoy]
esPath: "blog/[archivo].html"
enPath: "en/blog/[archivo].html"
canonicalPath: "[esPath o enPath, el que corresponda a ESTE post]"
rootPrefix: "/"                             # "/" si lang=es, "/en/" si lang=en
navHome: "..."                              # ver tabla de traducciones EN abajo
navAbout: "..."
navBlog: "..."
navResources: "..."
navPlans: "..."
navLogin: "..."
byLabel: "..."
readTimeLabel: "..."
ctaTitle: "..."
ctaBody: "..."
ctaButton: "..."
footerTagline: "..."
footerColCompany: "..."
footerAbout: "..."
footerPlans: "..."
footerContact: "..."
footerColResources: "..."
footerResources: "..."
footerFaq: "..."
footerSupport: "..."
footerColLegal: "..."
footerPrivacy: "..."
footerTerms: "..."
footerRefund: "..."
footerCopyright: "..."
faqSectionTitle: "..."                      # "Preguntas Frecuentes" o "Frequently Asked Questions"
faqs:
  - question: "..."
    answer: "..."
  # 4-6 pares de pregunta/respuesta, ver sección FAQ abajo
permalink: "[esPath o enPath, el mismo valor que canonicalPath]"
---
[cuerpo HTML del artículo aquí]
```

### 4. Valores en español — reutilizar tal cual (ya usados en los 2 posts existentes)

```yaml
navHome: "Inicio"
navAbout: "Acerca"
navBlog: "Blog"
navResources: "Recursos"
navPlans: "Planes"
navLogin: "Iniciar Sesión →"
byLabel: "Por"
readTimeLabel: "Lectura"
ctaTitle: "Deja de Calcular tus Finanzas a Ciegas"
ctaBody: "Registra tus costos fijos y variables en Smart Load Solution para ver tu ganancia neta real antes de aceptar cualquier carga."
ctaButton: "Calcular Mis Costos Reales Gratis →"
footerTagline: "Inteligencia de carga para el transportista moderno."
footerColCompany: "Empresa"
footerAbout: "Acerca de Nosotros"
footerPlans: "Planes y Precios"
footerContact: "Contacto"
footerColResources: "Recursos"
footerResources: "Centro de Recursos"
footerFaq: "FAQ"
footerSupport: "Soporte"
footerColLegal: "Legal"
footerPrivacy: "Privacidad"
footerTerms: "Términos de Uso"
footerRefund: "Reembolsos"
footerCopyright: "© 2026 Smart Load Solution. Todos los derechos reservados."
faqSectionTitle: "Preguntas Frecuentes"
```

### 5. Valores en inglés — ⚠️ VERIFICAR, no inventar

Antes de traducir estos strings de cero, **abre una página real ya existente en
`public/en/` (ej. `public/en/about.html`, `public/en/plans.html`, o cualquier página
del nav en inglés)** y copia el texto EXACTO que ya usa el sitio para "Home", "About",
"Blog", "Resources", "Plans", "Sign In", el tagline del footer, los links legales,
etc. El sitio en inglés ya existe y ya tiene su propia terminología fijada — no crear
una traducción nueva que pueda no coincidir con el resto del sitio en inglés.

Como referencia de partida (a confirmar contra el sitio real):
```yaml
navHome: "Home"
navAbout: "About"
navBlog: "Blog"
navResources: "Resources"
navPlans: "Plans"
navLogin: "Sign In →"
byLabel: "By"
readTimeLabel: "Read time"
footerColCompany: "Company"
footerColResources: "Resources"
footerColLegal: "Legal"
faqSectionTitle: "Frequently Asked Questions"
```

El `ctaTitle`/`ctaBody`/`ctaButton` y el resto del footer deben traducirse de forma
natural y consistente con el tono de marca (directo, driver-to-driver, no
corporativo) — ver skill `smartload-industry-expert` y `smartload-seo-expert` para
tono de voz si hace falta referencia.

---

## Imágenes — reglas y assets disponibles

**Ya existen 3 fotos reales procesadas y subidas a `public/img/blog/`** (ruta
relativa desde `blog-eleventy/`: `../public/img/blog/`):
- `ricardo-headshot.webp` (500×500, cuadrado) — **SIEMPRE el authorPhoto, en todos los posts, todos los idiomas, sin excepción.**
- `ricardo-van-hero.webp` (1600×840) — foto de perfil de la van, tono neutro/financiero
- `ricardo-cab-hero.webp` (1600×840) — selfie con headset en la cabina, tono "trabajando/calculando en ruta"

**No hay más fotos disponibles todavía** para los temas de "zonas rentables" (viaje/mapa)
o "LLC vs propietario único" (legal/negocio). Para estos 2 casos:
- Asigna la foto que mejor encaje de las 3 existentes (`ricardo-van-hero.webp` es la
  opción neutra más segura para ambos)
- Dilo explícitamente en tu resumen final: "post X usa foto genérica por falta de
  foto específica del tema — pendiente sesión de fotos futura"
- Los 2 posts que SÍ tienen contraparte ya convertida (RPM real, costos ocultos)
  deben usar la MISMA foto que su versión ya publicada, para consistencia entre
  idiomas del mismo artículo.

**Si en algún momento hay que recortar una foto nueva** (Ricardo puede subir más),
usa este patrón Python (ya usado y probado en este proyecto):

```python
from PIL import Image, ImageOps

img = Image.open('ruta/a/foto.jpg')
img = ImageOps.exif_transpose(img)  # corrige rotación EXIF de fotos de celular
w, h = img.size

# Para HERO (banner ancho, 1600x840, ratio 1.904):
target_ratio = 1600 / 840
new_h = int(w / target_ratio)
top = int(h * 0.30)  # ajustar este % según dónde esté la cara/sujeto en la foto
box = (0, top, w, top + new_h)
hero = img.crop(box).resize((1600, 840), Image.LANCZOS)
hero.save('ricardo-XXX-hero.jpg', quality=82)
hero.save('ricardo-XXX-hero.webp', quality=82)

# Para HEADSHOT (cuadrado, 500x500) — no debería hacer falta, ya existe uno fijo
```

Todas las imágenes finales van a `public/img/blog/` (minúscula — **cuidado con
mayúsculas**, Firebase Hosting corre en Linux y es sensible a esto, a diferencia de
Windows).

---

## FAQ — 4 a 6 preguntas por post, siguiendo el schema ya implementado

El layout ya tiene soporte completo para FAQ (sección visible + schema `FAQPage`
en JSON-LD) — solo hay que llenar el array `faqs` en el front matter con preguntas
reales relevantes al tema del post, en el mismo idioma del post. Estilo: preguntas
que un driver realmente buscaría en Google relacionadas al tema (ver
`smartload-seo-expert/references/content-strategy.md` para ejemplos de "FAQ targets
for featured snippets" si hace falta inspiración). Respuestas de 2-4 oraciones,
concretas, con números reales del artículo cuando aplique.

También agrega el schema `Article` (ya está en el layout, se llena solo con
`title`, `metaDescription`, `ogImage`, `author`, `date` — no requiere front matter
adicional más allá de lo que ya se pide arriba).

---

## Verificación antes de dar por terminado cada post

1. `npm run build` — debe compilar sin errores, y debe escribir el archivo en la
   ruta exacta que dice `esPath`/`enPath` (ej. `_site_blog/blog/nombre.html` o
   `_site_blog/en/blog/nombre.html`)
2. Buscar restos de placeholder: `grep -ri "TODO" _site_blog/blog/nombre.html` no
   debe devolver nada
3. Confirmar que no quedó texto en el idioma equivocado (ej. un post en inglés con
   "Por:" en vez de "By:")
4. Servir localmente (`npx serve _site_blog`) y revisar visualmente que el hero,
   la foto de autor, el contenido y la FAQ se vean bien — comparando contra el
   HTML original si hay duda
5. **No copiar nada a `../public/blog/` ni `../public/en/blog/` reales sin que
   Ricardo lo revise primero** — el output de Eleventy se queda en `_site_blog/`
   hasta aprobación explícita.

---

## Al terminar los 8

Da un resumen con: qué posts quedaron con foto "genérica" (pendiente sesión de
fotos), cualquier valor que no se pudo verificar 100% contra el original (ej. si
faltó algún meta tag), y confirma que los 10 posts en total (2 ya hechos + 8 nuevos)
compilan juntos sin error con un solo `npm run build`.
