---
name: pptx
description: Use this skill any time a .pptx file is involved in any way — creating slide decks, pitch decks, presentations, reading/parsing .pptx files, editing or updating presentations, combining or splitting slide files, working with templates, layouts, speaker notes, or comments.
---

# PPTX Skill

## Creating from Scratch
Use pptxgenjs: `npm install -g pptxgenjs`

## Design Guidelines
- Pick a bold content-informed color palette. One color dominates 60-70%, with 1-2 supporting tones and one sharp accent.
- Dark backgrounds for title and conclusion slides, light for content. Or commit to dark throughout for premium feel.
- Every slide needs a visual element: image, chart, icon, or shape. Text-only slides are forgettable.
- Choose interesting font pairings. Avoid defaulting to Arial.
- Titles: 36-44pt bold. Body: 14-16pt. Minimum 0.5 inch margins.

## Layout Options
- Two-column (text left, visual right)
- Icon + text rows
- 2x2 or 2x3 grid
- Half-bleed image with content overlay
- Large stat callouts (60-72pt numbers)

## Avoid
- Repeating same layout across slides
- Centering body text
- Text-only slides
- Accent lines under titles (AI-generated look)
- Low-contrast elements

## QA
Convert to images and inspect visually. Check for overlapping elements, text overflow, uneven spacing, leftover placeholders.

## Reading Content
`python -m markitdown presentation.pptx`

## Converting to Images
`python scripts/office/soffice.py --headless --convert-to pdf output.pptx`
`pdftoppm -jpeg -r 150 output.pdf slide`
