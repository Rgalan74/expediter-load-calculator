# Expediter Load Calculator - Project Context

## 🎯 High-Level Architecture
This is a modular, vanilla JS web app for cargo van drivers to calculate load profitability.

## 📁 File Organization Priority

### ALWAYS READ FIRST (Core Architecture):
- `main.js` - App initialization, navigation, auth flow
- `event-bus.js` - Central communication system
- `lazy-loader.js` - Dynamic module loading
- `config.js` - App configuration

### Feature Modules (Read on-demand):
- `calculator.js` + `calculator-*.js` - Load calculation system
- `finances.js` + `finances-*.js` - Expense tracking
- `zones.js` + `zones-*.js` - Geographic analysis
- `history.js` - Past loads tracking

### AI System (Read together):
- `lex-master.js` - Agent coordinator
- `*-agent.js` - Specialized agents
- `conversation-memory.js` - Context persistence
- `pattern-learner.js` - Learning system

### Support Files (Read last):
- `helpers.js` - Utility functions
- `*-ui.js` - UI components
- `*-charts.js` - Visualization

## 🔥 Critical Patterns

### Pattern 1: Modular Loading
Files are lazy-loaded via `lazy-loader.js`. Never inline large features in main.js.

### Pattern 2: EventBus Communication
```javascript
// ✅ Correct
EventBus.emit('calculator:updated', data);
EventBus.on('calculator:updated', handler);

// ❌ Wrong
directFunctionCall(); // Breaks modularity
```

### Pattern 3: Surgical Changes
```javascript
// ✅ Correct - find exact string, replace once
str_replace in specific file

// ❌ Wrong - rewriting entire function
"Let me rewrite this function completely..."
```

### Pattern 4: DEBUG_MODE System
```javascript
// ✅ Always use
debugLog('📊 [MODULE] Message', data);

// ❌ Never use
console.log('something'); // Will stay in production
```

## 🚫 NEVER DO:
1. Rewrite working functions completely
2. Add console.log without DEBUG_MODE
3. Modify main.js without checking lazy-loader.js
4. Change EventBus patterns
5. Break Firebase fallback to localStorage
6. Ignore mobile responsiveness

## ✅ ALWAYS DO:
1. Read related files first with view command
2. Test changes in browser console
3. Make surgical, specific edits
4. Preserve existing patterns
5. Check mobile UI after changes
6. Use str_replace for precision edits
```

**👉 Guarda esto en tu proyecto como `.antigravity/project-context.md`**

---

### 2. **Custom Instructions para Claude en Antigravity**

Si estás usando Claude Sonnet 4.5 como modelo, puedes agregar instrucciones personalizadas:

En Antigravity Settings → Model Settings → Custom Instructions:
```
You are working on the Expediter Load Calculator, a production web app for cargo van drivers.

CRITICAL METHODOLOGY:
1. ALWAYS use 'view' command to read files BEFORE editing
2. Make SURGICAL changes - never rewrite working code
3. Use str_replace for precise edits (find exact string, replace once)
4. Test in browser console BEFORE permanent changes
5. Follow existing patterns exactly

CODE STYLE:
- camelCase variables/functions
- DEBUG_MODE for all console.log: debugLog('📊 [MODULE] msg', data)
- Comment with emojis: ✅❌🔍⚠️
- Mobile-first responsive

ARCHITECTURE:
- Modular JS via lazy-loader.js
- EventBus for inter-module communication
- Firebase + localStorage fallback
- No frameworks, no npm, vanilla JS only

WHEN MAKING CHANGES:
1. Identify exact file(s) to modify
2. View entire file first
3. Locate exact string to replace
4. Provide precise str_replace command
5. Explain what changed and why
6. Suggest console test command

NEVER:
- Rewrite entire functions
- Add console.log without DEBUG_MODE
- Suggest npm/webpack/frameworks
- Break EventBus patterns
- Skip mobile testing reminder