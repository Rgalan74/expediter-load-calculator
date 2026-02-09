---
description: Systematic debugging following Ricardo's process
---

- name: debug-issue
  description: Systematic debugging following Ricardo's process
  steps:
    - Ask - Describe the bug and where it happens
    - View the suspected files
    - Check browser console for errors first
    - Add temporary debugLog to isolate issue
    - Show diagnostic findings
    - Propose fix with str_replace command
    - Provide console test command
    - After user confirms, remove temporary logs
    - Verify no regressions