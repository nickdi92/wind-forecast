// Renders the iOS app icon from public/favicon.svg: full-bleed square (iOS rounds the corners itself), no alpha.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = (await readFile('public/favicon.svg', 'utf8')).replace('rx="112"', 'rx="0"');
await sharp(Buffer.from(svg), { density: 1024 })
  .resize(1024, 1024)
  .flatten({ background: '#0f3440' })
  .removeAlpha()
  .png()
  .toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
console.log('ios icon written');
