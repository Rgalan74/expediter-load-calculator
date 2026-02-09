---
description: Make precise, targeted code changes following Ricardo's methodology
---

name: surgical-change
description: Make precise, targeted code changes following Ricardo's methodology
steps:
  - Ask user: What file and what specific change?
  - Use 'view' command to read ENTIRE file first
  - Identify the EXACT string to replace (must be unique in file)
  - Confirm with user: 'I will replace [exact string] with [new code]'
  - Use str_replace with old_str and new_str
  - Explain what changed and why
  - Provide console test command: 'Test in console: [command]'
  - Wait for user to test before next change
  - Ask: 'Did it work? Should I proceed?'