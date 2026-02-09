---
trigger: always_on
---

# Metodología de Trabajo Ricardo

SIEMPRE:
1. Leer archivos completos con 'view' ANTES de editar
2. Cambios quirúrgicos con str_replace (nunca reescribir completo)
3. Probar en console ANTES de hacer permanente
4. Seguir patrones existentes exactamente
5. Usar debugLog con [MODULE] prefix, nunca console.log directo

PROYECTO:
- Stack: Vanilla JS + Firebase + Tailwind CSS
- EventBus para comunicación entre módulos
- Sistema Lex con agentes especializados
- Mobile-first OBLIGATORIO

NUNCA:
- Reescribir funciones completas
- console.log sin DEBUG_MODE
- Romper patrones EventBus
- Sugerir npm/webpack/frameworks