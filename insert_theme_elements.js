const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public/app.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1. Insert Script Tag
if (!htmlContent.includes('js/theme-manager.js')) {
    // Try to insert before onboarding-manager
    const scriptTag = '<script src="js/theme-manager.js"></script>';
    const target = '<script src="js/onboarding-manager.js"></script>';

    if (htmlContent.includes(target)) {
        htmlContent = htmlContent.replace(target, scriptTag + '\\n  ' + target);
        console.log("Inserted theme-manager.js script tag.");
    } else {
        // Fallback: insert before </body>
        const bodyEnd = '</body>';
        htmlContent = htmlContent.replace(bodyEnd, scriptTag + '\\n' + bodyEnd);
        console.log("Inserted theme-manager.js script tag (fallback).");
    }
} else {
    console.log("theme-manager.js script already present.");
}

// 2. Insert Mobile Toggle
if (!htmlContent.includes('id="mobileThemeDisplay"')) {
    // Insert into mobile menu, before logout
    const mobileLogoutTarget = '<button id="mobileLogoutBtn"';

    const mobileThemeBtn = `
        <!-- Tema Toggle Mobile -->
        <button class="theme-toggle-btn w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-between group">
            <span class="font-medium">🌓 Cambiar Tema</span>
            <span class="theme-toggle-icon text-xl bg-gray-100 group-hover:bg-white rounded-full w-8 h-8 flex items-center justify-center">☀️</span>
        </button>
        <div class="border-t border-gray-200 my-2"></div>
    `;

    if (htmlContent.includes(mobileLogoutTarget)) {
        htmlContent = htmlContent.replace(mobileLogoutTarget, mobileThemeBtn + '\\n        ' + mobileLogoutTarget);
        console.log("Inserted mobile theme toggle.");
    } else {
        console.log("Could not find mobileLogoutBtn to insert toggle before.");
    }
}

// 3. Bump CSS version
htmlContent = htmlContent.replace(/href="css\/app\.css\?v=[0-9.]+"/g, 'href="css/app.css?v=4.3.0"');

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log("Updated app.html");
