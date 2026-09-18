// Run via Electron: node scripts/desktop_dev.js scripts/install_brand_asset.js <generated.png>
// Converts the approved generated image into application PNG/ICO assets; no drawing.
const { app, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const source = process.argv[2];
const root = path.resolve(__dirname, "..");
const original = nativeImage.createFromPath(source);
if (original.isEmpty()) throw Error("Logo source unreadable");
for (const target of ["frontend/public/logo.png", "desktop/assets/icon.png", "desktop/assets/icon-taskbar.png", "docs/logo.png", "assets/branding/logo-approved.png"]) {
  fs.writeFileSync(path.join(root, target), original.resize({ width: 512, height: 512, quality: "best" }).toPNG());
}
const sizes = [16, 24, 32, 48, 64, 128, 256];
const entries = sizes.map(size => original.resize({ width: size, height: size, quality: "best" }).toPNG());
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const index = 6 + i * 16;
  header[index] = size === 256 ? 0 : size; header[index + 1] = header[index];
  header.writeUInt16LE(1, index + 4); header.writeUInt16LE(32, index + 6);
  header.writeUInt32LE(entries[i].length, index + 8); header.writeUInt32LE(offset, index + 12);
  offset += entries[i].length;
});
for (const name of ["icon.ico", "icon-taskbar.ico"]) fs.writeFileSync(path.join(root, "desktop/assets", name), Buffer.concat([header, ...entries]));
app.quit();
