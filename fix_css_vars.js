const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'public/css/app.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const correctBlock = `:root {
  /* --- DARK THEME (DEFAULT) --- */
  --bg-body: #0a0a0f;
  --bg-secondary: #1a1a2e;
  --bg-card: #1e293b;
  --bg-card-hover: #334155;
  --bg-header: url('../img/header-background.PNG'); /* Dark header img */
  
  --text-main: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  
  --border-color: #334155;
  --input-bg: #0f172a;
  
  --primary-color: #3b82f6;
  --shadow-color: rgba(0, 0, 0, 0.5);
  
  --gradient-mid: #1a1a2e;
}

[data-theme="light"] {
  /* --- LIGHT THEME OVERRIDES --- */
  --bg-body: #f8fafc;
  --bg-secondary: #e2e8f0;
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --bg-header: #ffffff; /* Light header (maybe solid white or different img) */
  
  --text-main: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  
  --border-color: #e2e8f0;
  --input-bg: #ffffff;
  
  --shadow-color: rgba(0, 0, 0, 0.1);
  
  --gradient-mid: #e2e8f0;
}
`;

// Find where the broken block starts and ends.
// It likely starts at :root { and ends at the closing brace of [data-theme="light"] block.
// But easier: find the first occurrence of "/* ============================" which marks the start of original CSS
// and replace everything before it.

const splitMarker = "/* ============================";
const parts = cssContent.split(splitMarker);

if (parts.length > 1) {
    // Keep the "original" CSS parts (1 to end)
    // Replace part 0 with correctBlock
    // Note: The split marker was removed, need to add it back.

    // Check if parts[0] is indeed the messed up variables block
    console.log("Replacing header block of CSS...");
    const newContent = correctBlock + "\\n" + splitMarker + parts.slice(1).join(splitMarker);
    fs.writeFileSync(cssPath, newContent, 'utf8');
    console.log("Fixed app.css variables.");
} else {
    console.log("Could not find split marker in app.css, appending block to top.");
    fs.writeFileSync(cssPath, correctBlock + "\\n" + cssContent, 'utf8');
}
