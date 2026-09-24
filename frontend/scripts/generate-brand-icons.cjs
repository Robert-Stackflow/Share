const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");
const svg = fs.readFileSync(path.join(publicDir, "brand", "share-mark.svg"));
const imageDir = path.join(publicDir, "img");
const iconDir = path.join(imageDir, "icons");
const iconSizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

async function render(size) {
  return sharp(svg).resize(size, size).png().toBuffer();
}

async function main() {
  const logo = await render(512);
  fs.writeFileSync(path.join(imageDir, "logo.png"), logo);
  fs.writeFileSync(path.join(imageDir, "logo-dark.png"), logo);

  for (const size of iconSizes) {
    fs.writeFileSync(path.join(iconDir, `icon-${size}x${size}.png`), await render(size));
  }

  const faviconSizes = [16, 32, 48];
  const images = await Promise.all(faviconSizes.map(render));
  const directory = Buffer.alloc(6 + faviconSizes.length * 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(faviconSizes.length, 4);
  let offset = directory.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(faviconSizes[index], entry);
    directory.writeUInt8(faviconSizes[index], entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  fs.writeFileSync(path.join(imageDir, "favicon.ico"), Buffer.concat([directory, ...images]));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
