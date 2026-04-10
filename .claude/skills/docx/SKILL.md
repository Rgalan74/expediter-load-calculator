---
name: docx
description: Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include any mention of Word doc, .docx, or requests for reports, memos, letters, templates, or professional documents with formatting.
---

# DOCX Skill

## Creating New Documents
Use docx-js: `npm install -g docx`

Always set page size explicitly (docx-js defaults to A4):
- US Letter: width 12240, height 15840 (DXA units, 1440 DXA = 1 inch)
- 1 inch margins: top/right/bottom/left = 1440

## Critical Rules
- Never use unicode bullets, use LevelFormat.BULLET with numbering config
- Never use backslash-n, use separate Paragraph elements
- Tables need dual widths: columnWidths on table AND width on each cell
- Always use WidthType.DXA, never PERCENTAGE (breaks in Google Docs)
- Use ShadingType.CLEAR not SOLID for table shading
- PageBreak must be inside a Paragraph

## Reading Content
`pandoc --track-changes=all document.docx -o output.md`

## Editing Existing Documents
1. Unpack: `python scripts/office/unpack.py document.docx unpacked/`
2. Edit XML in unpacked/word/
3. Pack: `python scripts/office/pack.py unpacked/ output.docx --original document.docx`

## Converting to Images
`python scripts/office/soffice.py --headless --convert-to pdf document.docx`
`pdftoppm -jpeg -r 150 document.pdf page`

## Validation
`python scripts/office/validate.py doc.docx`
