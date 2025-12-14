const fs = require('fs');

try {
    const content = fs.readFileSync('g:\\My Drive\\MisProyectos\\expediter-app\\public\\app.html', 'utf8');

    // Check for duplicate IDs
    const idRegex = /id=["']([^"']+)["']/g;
    let match;
    const idCounts = {};

    while ((match = idRegex.exec(content)) !== null) {
        const id = match[1];
        idCounts[id] = (idCounts[id] || 0) + 1;
    }

    const duplicates = Object.keys(idCounts).filter(id => idCounts[id] > 1);

    if (duplicates.length > 0) {
        console.log("Duplicate IDs found:");
        duplicates.forEach(d => console.log(`  - ${d}`));
    } else {
        console.log("No duplicate IDs found.");
    }

    // Check for suspicious encoding
    const suspicious = ["Ã“", "Ã", "Â", "â ³"];
    const lines = content.split('\n');
    console.log("\nSuspicious encoding artifacts:");
    lines.forEach((line, index) => {
        suspicious.forEach(s => {
            if (line.includes(s)) {
                console.log(`  Line ${index + 1}: ${line.trim().substring(0, 50)}...`);
            }
        });
    });

} catch (err) {
    console.error("Error reading file:", err);
}
