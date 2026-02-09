# Script de Optimización de Imágenes - Expediter App

## 📊 Análisis Actual

**Total:** 157 archivos = 33.95 MB
**Target:** <5 MB (85% reducción)

### Archivos Grandes (>500KB):
Ver lista arriba del comando PowerShell

---

## 🎯 Plan de Optimización

### Prioridad ALTA (>1MB)
1. **Gemini_Generated_Image_logo.png** (5.2MB)
   - Usar solo para showcase/docs
   - NO incluir en build de producción
   - O reducir a 512x512 max

2. **Gemini_Generated_Image_logo.webp** (3.8MB)
   - Similar al anterior
   - Ya tienes logo-app.png (300KB) que es suficiente

3. **header-background.PNG** (1.8MB)
   - Exportar a WebP
   - Reducción esperada: 70% → ~540KB

4. **hero-bg.png.png** (1.4MB)
   - Exportar a WebP
   - Reducción esperada: 75% → ~350KB

### Prioridad MEDIA (500KB-1MB)
- van-background.jpeg → WebP
- og-image.jpg → WebP (o eliminar, usar más pequeño)
- twitter-card.jpg → WebP

---

## 🚀 Quick Win: Eliminar Duplicados

```powershell
# Eliminar archivos grandes generados que ya no se usan
cd "g:\\My Drive\\MisProyectos\\expediter-app\\public\\img"

# BACKUP PRIMERO
Copy-Item . ..\\img.backup -Recurse

# Eliminar duplicados grandes
Remove-Item "Gemini_Generated_Image_logo.png" -WhatIf
Remove-Item "Gemini_Generated_Image_logo.webp" -WhatIf

# Eliminar dobles extensiones
Remove-Item "app-mockup.png.png" -WhatIf
Remove-Item "hero-bg.png.png" -WhatIf

# Si todo se ve bien, quitar -WhatIf y ejecutar de nuevo
```

**Ahorro inmediato:** ~10MB sin romper nada

---

## 🔧 Optimización con TinyPNG (Más Fácil)

### Paso 1: Identificar archivos
```powershell
Get-ChildItem "public\\img" -File | Where-Object {$_.Length -gt 500KB -and $_.Extension -match '\\.(png|jpg|jpeg)$'} | Select-Object FullName
```

### Paso 2: Ir a TinyPNG
1. Abre https://tinypng.com/
2. Arrastra los archivos grandes
3. Descarga optimizados (automáticamente ~70% reducción)
4. Reemplaza originales

**Tiempo:** ~10 minutos
**Ahorro:** ~15-20MB

---

## 🎨 Conversión a WebP (Más Impacto)

### Con Herramienta Online (Squoosh):

1. Abre https://squoosh.app/
2. Arrastra imagen
3. Lado derecho: selecciona **WebP**
4. Ajusta quality a **80**
5. Compara: debe verse casi idéntico
6. Descarga

### Con ImageMagick (Batch):

```powershell
# Instalar
winget install ImageMagick.ImageMagick

# Ir a carpeta
cd "g:\\My Drive\\MisProyectos\\expediter-app\\public\\img"

# Convertir archivos grandes a WebP
magick "header-background.PNG" -quality 80 "header-background.webp"
magick "hero-bg.png.png" -quality 80 "hero-bg.webp"
magick "van-background.jpeg" -quality 80 "van-background.webp"

# Verificar tamaño
Get-ChildItem *.webp | Select-Object Name, @{Name="SizeKB";Expression={[math]::Round($_.Length / 1KB, 2)}}
```

**Ahorro:** 60-80% en cada archivo

---

## 📝 Actualizar Referencias en HTML

### Antes:
```html
<div style="background-image: url('img/header-background.PNG')">
```

### Después (con fallback):
```html
<div style="background-image: url('img/header-background.webp'), url('img/header-background.PNG')">
```

O con `<picture>`:
```html
<picture>
  <source srcset="img/van-background.webp" type="image/webp">
  <img src="img/van-background.jpeg" alt="Van">
</picture>
```

---

## ✅ Checklist de Optimización

### Rápido (15 min):
- [ ] Backup de /img
- [ ] Eliminar Gemini_Generated_Image_logo.* (~9MB)
- [ ] Subir 5 archivos grandes a TinyPNG
- [ ] Reemplazar originales
- [ ] Deploy y verificar que todo funciona

**Ahorro:** ~20MB (60% reducción)

### Completo (1 hora):
- [ ] Todo lo anterior
- [ ] Convertir top 20 archivos a WebP
- [ ] Actualizar referencias en HTML/CSS
- [ ] Implementar `loading="lazy"` en imágenes
- [ ] Deploy

**Ahorro:** ~25MB (75% reducción)
**Target final:** ~8-10MB total

---

## 🎯 Resultados Esperados

### Antes:
- Imágenes: 33.95MB
- Lighthouse Performance: ~75
- LCP: ~4.2s

### Después (quick):
- Imágenes: ~14MB
- Lighthouse Performance: ~82
- LCP: ~2.8s

### Después (completo):
- Imágenes: ~8MB
- Lighthouse Performance: ~90+
- LCP: ~1.8s

---

## 💡 Pro Tips

1. **Iconos PWA:**
   - Ya están en /img/icons (optimizados por PWABuilder)
   - No tocar estos

2. **Lex emojis:**
   - Son WebP y pequeños (<100KB cada uno)
   - Perfectos, dejar como están

3. **Screenshots futuros:**
   - Siempre exportar a WebP primero
   - Comprimir antes de subir
   - Target: <200KB por screenshot

4. **Logo:**
   - `logo-app.png` (307KB) es suficiente
   - No necesitas versiones de 5MB

---

## 🚀 Deploy Después de Optimizar

```powershell
cd "g:\\My Drive\\MisProyectos\\expediter-app"
firebase deploy --only hosting
```

Luego hacer Lighthouse audit para ver mejora.
