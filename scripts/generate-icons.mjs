#!/usr/bin/env node
/**
 * Generate extension icons using sharp.
 * Creates 16x16, 32x32, 48x48, and 128x128 PNG icons.
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionDir = join(__dirname, '..', 'extension');

const sizes = [16, 32, 48, 128];

// SVG icon: white G on black background (Grok themed)
const createSvg = (size) => {
  const corner = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.7);
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.35;

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${corner}" fill="#000000"/>
  <text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle">G</text>
</svg>`;
};

async function generateIcons() {
  console.log('Generating extension icons...\n');

  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = join(extensionDir, `icon${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`Created: icon${size}.png`);
  }

  console.log('\nIcons generated successfully!');
}

generateIcons().catch(console.error);
