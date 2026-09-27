import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// SVG Vector of the POWERFUL REACH / THE FLY / CARTO-PR Emblem
const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <style>
      .bg { fill: #f8fafc; }
      .brand-blue { fill: #001f9c; }
      .brand-stroke { stroke: #001f9c; stroke-width: 28; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .text-sub { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-weight: 300; font-size: 42px; fill: #001f9c; letter-spacing: 12px; }
    </style>
  </defs>
  
  <!-- Background with subtle soft border -->
  <rect width="512" height="512" rx="100" fill="#f8fafc"/>
  
  <!-- "THE" text on top left -->
  <text x="96" y="235" class="text-sub">THE</text>
  
  <!-- "FLY" text on bottom right -->
  <text x="305" y="340" class="text-sub">FLY</text>
  
  <!-- Stylized geometric continuous blue emblem -->
  <!-- Bottom loop & upper wing path -->
  <path d="M 215 190 
           L 295 190 
           A 18 18 0 0 1 313 208 
           L 313 252 
           L 415 210 
           M 215 190 
           L 215 340 
           L 105 340 
           A 18 18 0 0 1 87 322 
           L 87 268 
           A 18 18 0 0 1 105 250 
           L 415 250" 
        class="brand-stroke"/>
</svg>`;

// Standalone transparent SVG for icons & header
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <style>
      .brand-stroke { stroke: #001f9c; stroke-width: 32; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .text-sub { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-weight: 400; font-size: 44px; fill: #001f9c; letter-spacing: 12px; }
    </style>
  </defs>
  <rect width="512" height="512" rx="90" fill="#ffffff"/>
  <text x="96" y="235" class="text-sub">THE</text>
  <text x="305" y="340" class="text-sub">FLY</text>
  <path d="M 215 190 L 295 190 A 18 18 0 0 1 313 208 L 313 252 L 415 210 M 215 190 L 215 340 L 105 340 A 18 18 0 0 1 87 322 L 87 268 A 18 18 0 0 1 105 250 L 415 250" class="brand-stroke"/>
</svg>`;

async function generateAssets() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
  fs.writeFileSync(path.join(publicDir, 'carto-pr-logo.svg'), svgLogo);

  const svgBuffer = Buffer.from(svgIcon);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // Maskable 512x512 with safe padding
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#ffffff'
    })
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // Apple Touch Icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Favicon 48x48
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('✅ Generated all PWA icons & branding assets!');
}

generateAssets().catch(console.error);
