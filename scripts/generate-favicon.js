const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../public/logo.png');
const outputDir = path.join(__dirname, '../public');
const outputFile = path.join(outputDir, 'favicon.ico');

async function generateFavicon() {
  try {
    await sharp(inputFile)
      .resize(256, 256)
      .toFile(outputFile);
    console.log('Favicon generated successfully!');
  } catch (error) {
    console.error('Error generating favicon:', error);
    process.exit(1);
  }
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

generateFavicon(); 