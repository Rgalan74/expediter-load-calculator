# Fase 2: Limpieza de Código - Plan

## Archivos HTML Temporales a Eliminar (8 archivos)

### Referencias de Categorías (ya implementadas)
- ❌ `MODAL-CATEGORIAS-COMPLETO.html` - Modal ya en app.html dinámicamente
- ❌ `CODIGO-LIMPIO-botones.html` - Código ya integrado
- ❌ `COPIAR-ESTO-seccion-categorias.html` - Código ya integrado
- ❌ `temp-categories-section.html` - Temporal
- ❌ `temp-category-modal.html` - Temporal

### Backups temporales de app.html
- ❌ `app_temp1.html` - Backup temporal
- ❌ `app_temp2.html` - Backup temporal  
- ❌ `app_temp3.html` - Backup temporal

## Archivos CSS Mobile a Consolidar (5 archivos → 1)

Consolidar estos en un solo `mobile-optimizations.css`:
- `mobile-calculator-fix.css` (1.4 KB)
- `mobile-content-width.css` (2.3 KB)
- `mobile-header-fix.css` (2.3 KB)
- `mobile-header.css` (6.9 KB) 
- `select-options-fix.css` (1.0 KB)

**Total:** 13.9 KB → 1 archivo consolidado

## Archivos CSS a Mantener

- ✅ `app.css` - Principal
- ✅ `design-system.css` - Tokens
- ✅ `calculator-decision.css` - Específico
- ✅ `mobile-styles.css` - Base mobile
- ✅ `mobile-typography.css` - Tipografía
- ✅ `onboarding.css` - Onboarding
- ✅ `print-styles.css` - Impresión
- ✅ `report-modal-styles.css` - Reportes
- ✅ `ui-enhancements.css` - Mejoras UI
- ✅ `zones-print.css` - Zonas impresión

## Archivos JS a Revisar

- ❓ `category-modal-dynamic.js` - Verificar si se está usando
- ❓ `FUNCION-CORREGIDA-renderExpensesList.js` - Eliminar si está integrada

## Orden de Ejecución

1. ✅ **Identificar archivos** (completado)
2. Consolidar CSS mobile
3. Actualizar referencias en app.html
4. Eliminar HTML temporales
5. Eliminar JS no usados
6. Verificar que todo funcione
7. Deploy final

**Tiempo estimado:** 20-30 minutos
**Ahorro de espacio:** ~30-40 archivos menos
