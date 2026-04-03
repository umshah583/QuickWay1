const sharp = require('sharp');
const path = require('path');

async function generateIcons() {
  const inputPath = path.join(__dirname, '../public/logo.png');
  const outputDir = path.join(__dirname, '../public/icons');

  // Create icons directory if it doesn't exist
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

  for (const size of sizes) {
    await sharp(inputPath)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    
    console.log(`Generated icon-${size}x${size}.png`);
  }
}

generateIcons().catch(console.error);
