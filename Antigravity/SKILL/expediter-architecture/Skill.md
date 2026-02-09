# Expediter App Architecture Expert

## Description
Deep knowledge of Expediter Load Calculator architecture, patterns, and best practices.

## Trigger Words
expediter, calculator, finances, zones, lex, eventbus, lazy loader, agent system

## Project Structure

### Core Initialization Flow
```
index.html → auth.html → app.html
                ↓
              main.js (entry point)
                ↓
        ┌───────┴────────┐
   event-bus.js    lazy-loader.js
        ↓               ↓
   [All modules register] [Modules load on-demand]
```

### Module Communication Pattern
```
User Action → Module A → EventBus.emit('event:name', data)
                              ↓
                         EventBus routes
                              ↓
              Module B ← EventBus.on('event:name', handler)
```

### Lex AI System Architecture
```
User asks question → lex-master.js
                          ↓
                    Intent Router
                          ↓
        ┌─────────────┬─────────────┬─────────────┐
calculator-agent  finances-agent  zones-agent  history-agent
        ↓                 ↓              ↓            ↓
    Analysis         Insights       Warnings     Patterns
        └─────────────┴─────────────┴─────────────┘
                          ↓
                  conversation-memory.js
                          ↓
                    Response Builder
```

## Key Files Relationships

### When modifying Calculator:
- Read: `calculator.js` (main logic)
- Check: `calculator-decision.js` (decision framework)
- Verify: `main.js` (calculator tab setup)
- Test: Mobile responsiveness in `mobile-calculator-fix.css`

### When modifying Finances:
- Read: `finances-core.js` (data management)
- Check: `finances-ui.js` (interface)
- Check: `finances-charts.js` (visualizations)
- Verify: `finances-data.js` (sample data)

### When modifying Lex:
- Read: `lex-master.js` (coordinator)
- Check: ALL `*-agent.js` files (specialized agents)
- Verify: `event-bus.js` (communication)
- Check: `conversation-memory.js` (context)

### When modifying Navigation:
- Read: `main.js` (tab system)
- Check: `lazy-loader.js` (module loading)
- Verify: `app.html` (tab buttons)

## Common Modification Patterns

### Add New Calculator Feature
1. View `calculator.js` to understand structure
2. Add function in logical section
3. Wire to UI in existing event handlers
4. Update any dependent calculations
5. Test with console.log + DEBUG_MODE
6. Test mobile layout

### Add New Lex Agent Capability
1. View specific `*-agent.js` file
2. Check `lex-intents.js` for intent routing
3. Add intent pattern if new type
4. Implement logic in agent
5. Test via EventBus in console
6. Verify conversation flow

### Fix UI Issue
1. Identify if desktop/mobile/both
2. Check `app.css` (general) or `mobile-*.css` (mobile)
3. Test changes in DevTools
4. Verify across screen sizes
5. Check iOS Safari specifically

### Optimize Performance
1. Check for non-DEBUG_MODE console.logs
2. Review event listener cleanup
3. Verify lazy loading is working
4. Check for repeated DOM queries
5. Profile in DevTools Performance tab

## Code Quality Checklist
- [ ] Used view command to read files first
- [ ] Made surgical str_replace edits
- [ ] Followed camelCase convention
- [ ] Used debugLog() not console.log()
- [ ] Preserved EventBus patterns
- [ ] Maintained Firebase + localStorage fallback
- [ ] Added emoji comments (✅❌🔍⚠️)
- [ ] Tested in browser console first
- [ ] Verified mobile responsiveness
- [ ] No console errors