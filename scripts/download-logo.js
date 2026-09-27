import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const imageUrl = 'https://i.ibb.co/QFp0NRy0/LOGO-Powerful-Reach-removebg-preview.png';
const publicDir = path.resolve('public');
const downloadedPath = path.join(publicDir, 'logo-powerful-reach.png');

async function downloadAndProcessLogo() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const fileStream = fs.createWriteStream(downloadedPath);

  await new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image, status code: ${response.statusCode}`));
        return;
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(downloadedPath, () => {});
      reject(err);
    });
  });

  console.log('✅ Downloaded POWERFUL REACH logo successfully!');

  // Generate PWA icons from the downloaded logo
  const logoBuffer = fs.readFileSync(downloadedPath);

  await sharp(logoBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  await sharp(logoBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  await sharp(logoBuffer)
    .resize(410, 410, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  await sharp(logoBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  await sharp(logoBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('✅ All PWA icons and favicon updated from official POWERFUL REACH logo!');
}

downloadAndProcessLogo().catch(console.error);
