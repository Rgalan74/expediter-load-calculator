/**
 * optimize-images.js
 * Optimiza imágenes PWA y otros assets del proyecto
 * Usa Sharp para compresión inteligente
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuración
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(__dirname, 'public', 'img-backups');

// Crear directorio de backups
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('📁 Directorio de backups creado\n');
}

/**
 * Optimizar un ícono PWA
 */
async function optimizeIcon(inputPath, size, quality = 85) {
    const fileName = path.basename(inputPath);
    const backupPath = path.join(BACKUP_DIR, fileName);
    const outputPath = inputPath; // Sobrescribir original

    try {
        // Backup del original
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(inputPath, backupPath);
            console.log(`💾 Backup: ${fileName}`);
        }

        const originalSize = fs.statSync(inputPath).size;

        // Optimizar
        await sharp(inputPath)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png({
                quality: quality,
                compressionLevel: 9,
                adaptiveFiltering: true,
                palette: true // Reduce colores si es posible
            })
            .toFile(outputPath + '.tmp');

        // Reemplazar original
        fs.renameSync(outputPath + '.tmp', outputPath);

        const newSize = fs.statSync(outputPath).size;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
        const originalMB = (originalSize / 1024 / 1024).toFixed(2);
        const newKB = (newSize / 1024).toFixed(0);

        console.log(`✅ ${fileName}`);
        console.log(`   ${originalMB}MB → ${newKB}KB (ahorro: ${savings}%)`);

        return {
            file: fileName,
            originalSize,
            newSize,
            savings: parseFloat(savings)
        };

    } catch (error) {
        console.error(`❌ Error optimizando ${fileName}:`, error.message);
        return null;
    }
}

/**
 * Optimizar imagen genérica a WebP
 */
async function convertToWebP(inputPath, quality = 85) {
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const dirName = path.dirname(inputPath);
    const webpPath = path.join(dirName, baseName + '.webp');

    // Si ya existe WebP, skip
    if (fs.existsSync(webpPath)) {
        console.log(`⏭️  WebP ya existe: ${baseName}.webp`);
        return null;
    }

    try {
        const originalSize = fs.statSync(inputPath).size;

        await sharp(inputPath)
            .webp({ quality: quality })
            .toFile(webpPath);

        const newSize = fs.statSync(webpPath).size;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

        console.log(`🎨 ${baseName}${ext} → ${baseName}.webp`);
        console.log(`   ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${savings}%)`);

        return {
            file: baseName,
            originalSize,
            newSize,
            savings: parseFloat(savings)
        };

    } catch (error) {
        console.error(`❌ Error convirtiendo ${baseName}:`, error.message);
        return null;
    }
}

/**
 * Principal
 */
async function main() {
    console.log('🚀 Iniciando optimización de imágenes\n');
    console.log('═'.repeat(50) + '\n');

    const results = [];

    // 1. Optimizar PWA Icons
    console.log('📱 OPTIMIZANDO PWA ICONS\n');

    const icons = [
        { path: path.join(PUBLIC_DIR, 'favicon.png'), size: 32 },
        { path: path.join(PUBLIC_DIR, 'icon-192.png'), size: 192 },
        { path: path.join(PUBLIC_DIR, 'icon-512.png'), size: 512 }
    ];

    for (const icon of icons) {
        if (fs.existsSync(icon.path)) {
            const result = await optimizeIcon(icon.path, icon.size);
            if (result) results.push(result);
        } else {
            console.log(`⚠️  No encontrado: ${path.basename(icon.path)}`);
        }
    }

    console.log('\n' + '═'.repeat(50) + '\n');

    // 2. Convertir PNGs a WebP (Lex images)
    console.log('🎨 CONVIRTIENDO A WEBP\n');

    const lexDir = path.join(PUBLIC_DIR, 'img', 'lex');
    if (fs.existsSync(lexDir)) {
        const lexFiles = fs.readdirSync(lexDir)
            .filter(f => f.endsWith('.png'))
            .map(f => path.join(lexDir, f));

        for (const file of lexFiles) {
            const result = await convertToWebP(file, 90);
            if (result) results.push(result);
        }
    }

    console.log('\n' + '═'.repeat(50) + '\n');

    // 3. Resumen
    console.log('📊 RESUMEN DE OPTIMIZACIÓN\n');

    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
    const totalSavings = totalOriginal - totalNew;
    const avgSavings = results.reduce((sum, r) => sum + r.savings, 0) / results.length;

    console.log(`Archivos procesados:  ${results.length}`);
    console.log(`Tamaño original:      ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Tamaño optimizado:    ${(totalNew / 1024).toFixed(0)} KB`);
    console.log(`Ahorro total:         ${(totalSavings / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Promedio ahorro:      ${avgSavings.toFixed(1)}%`);

    console.log('\n✨ Optimización completada!\n');
    console.log(`💾 Backups guardados en: ${BACKUP_DIR}`);
}

// Ejecutar
main().catch(console.error);
