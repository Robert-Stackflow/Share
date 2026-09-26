const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");
const imageDir = path.join(publicDir, "img");
const iconDir = path.join(imageDir, "icons");
const mark = fs.readFileSync(path.join(publicDir, "brand", "share-mark.svg"));
const darkMark = fs.readFileSync(
  path.join(publicDir, "brand", "share-mark-dark.svg"),
);
const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];

const png = (source, size, whiteBackground = false) => {
  const image = sharp(source, {
    density: Math.max(72, Math.ceil((size * 72) / 64)),
  }).resize(size, size);
  if (whiteBackground) image.flatten({ background: "#ffffff" });
  return image.png({ compressionLevel: 9 }).toBuffer();
};

const makeIco = (entries) => {
  const directory = Buffer.alloc(6 + entries.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(entries.length, 4);
  let offset = directory.length;
  entries.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(size === 256 ? 0 : size, entry);
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...entries.map(({ data }) => data)]);
};

async function main() {
  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(path.join(imageDir, "logo.png"), await png(mark, 512));
  fs.writeFileSync(
    path.join(imageDir, "logo-dark.png"),
    await png(darkMark, 512),
  );
  for (const size of sizes) {
    fs.writeFileSync(
      path.join(iconDir, `icon-${size}x${size}.png`),
      await png(mark, size, true),
    );
  }
  fs.writeFileSync(
    path.join(imageDir, "favicon.ico"),
    makeIco(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({
          size,
          data: await png(mark, size, true),
        })),
      ),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
