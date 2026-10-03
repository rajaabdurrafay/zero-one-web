// Original, unbranded SVG slot illustrations rendered to lightweight WebP.
// These are deliberately labelled placeholders, not photos of the venue.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const target = path.resolve(__dirname, '../website/public/images/redesign');
const slots = [
  ['hero-venue', 'VENUE INTERIOR', 1920, 1080, 'venue'],
  ['current-deal', 'CURRENT DEAL', 1200, 1200, 'controller'],
  ['snooker', 'SNOOKER', 900, 1125, 'table'],
  ['ps5-gaming', 'PS5 GAMING', 900, 1125, 'controller'],
  ['private-cinema', 'PRIVATE CINEMA', 900, 1125, 'cinema'],
  ['private-ps5-room', 'PRIVATE PS5 ROOM', 900, 1125, 'room'],
  ['table-tennis', 'TABLE TENNIS', 900, 1125, 'tennis'],
  ['car-simulator', 'CAR SIMULATOR', 900, 1125, 'wheel'],
];
function drawing(type) {
  const screen = '<rect x="235" y="170" width="530" height="300" rx="12" fill="url(#screen)" stroke="#adb8c0" stroke-width="2"/><path d="M270 430 400 300 510 370 660 240 730 300" stroke="#d1d7dc" stroke-width="3" fill="none" opacity=".4"/>';
  const table = '<path d="M250 420 750 420 860 720 140 720Z" fill="#566466" stroke="#bbc6c7" stroke-width="12"/><path d="M260 443 741 443 827 695 171 695Z" fill="#263c3f"/><path d="M200 720v90m600-90v90" stroke="#75858a" stroke-width="24"/>';
  if (type === 'table') return table + '<g fill="#d1d4d0"><circle cx="540" cy="545" r="13"/><circle cx="564" cy="553" r="13"/><circle cx="550" cy="576" r="13"/></g><circle cx="370" cy="600" r="13" fill="white"/><path d="m220 740 420-370" stroke="#bfae92" stroke-width="8"/>';
  if (type === 'tennis') return table + '<path d="M215 565h570" stroke="#e8eeee" stroke-width="7"/><path d="M220 533h560v45H220Z" fill="#aeb9bd" opacity=".5"/><path d="M500 443v252" stroke="white" stroke-width="4"/>';
  if (type === 'wheel') return screen + '<path d="M330 660h340l45 150H285Z" fill="#303940" stroke="#8f9ea9" stroke-width="4"/><circle cx="500" cy="590" r="100" stroke="#aebcc5" stroke-width="24" fill="#172027"/><circle cx="500" cy="590" r="28" fill="#aebcc5"/><path d="m500 590-70-60m70 60 70-60m-70 60v90" stroke="#8f9ea9" stroke-width="13"/>';
  if (type === 'cinema') return screen + '<g fill="#313d47" stroke="#7d8d99" stroke-width="3"><rect x="160" y="620" width="190" height="200" rx="50"/><rect x="405" y="620" width="190" height="200" rx="50"/><rect x="650" y="620" width="190" height="200" rx="50"/></g>';
  if (type === 'controller') return screen + '<path d="M340 590Q310 500 385 500h230q75 0 45 90l-25 95q-12 50-62-4l-35-32h-76l-35 32q-50 54-62 4Z" fill="#d5dadd" stroke="#687b88" stroke-width="5"/><path d="M395 540v60m-30-30h60" stroke="#344651" stroke-width="13" stroke-linecap="round"/><g fill="#344651"><circle cx="588" cy="548" r="9"/><circle cx="614" cy="573" r="9"/><circle cx="564" cy="573" r="9"/><circle cx="588" cy="598" r="9"/></g>';
  if (type === 'room') return screen + '<path d="M270 610q0-40 40-40h380q40 0 40 40v150H270Z" fill="#37444d" stroke="#8999a4" stroke-width="4"/><path d="M250 670h500v100H250Z" fill="#53616a" stroke="#8999a4" stroke-width="4"/>';
  return '<rect x="200" y="180" width="220" height="250" rx="8" fill="url(#screen)"/><rect x="580" y="180" width="220" height="250" rx="8" fill="url(#screen)"/>' + table;
}
async function main() {
  fs.mkdirSync(target, { recursive: true });
  for (const [name, label, width, height, type] of slots) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#455462"/><stop offset=".6" stop-color="#18232d"/><stop offset="1" stop-color="#10171e"/></linearGradient><linearGradient id="screen" x2="1" y2="1"><stop stop-color="#718994"/><stop offset="1" stop-color="#263644"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#bg)"/><path d="M0 200 180 120h640l182 80M180 120v620L0 920m820-800v620l180 180M180 740h640" stroke="#90a5b0" stroke-width="2" fill="none" opacity=".25"/><path d="M250 135h180m140 0h180" stroke="#d6dde0" stroke-width="8" opacity=".7"/>${drawing(type)}<text x="50" y="925" fill="#eff3f5" font-family="Arial,sans-serif" font-size="22" letter-spacing="4">${label}</text><text x="50" y="962" fill="#b3c1cb" font-family="Arial,sans-serif" font-size="14" letter-spacing="3">IMAGE PLACEHOLDER · REPLACE WITH VENUE PHOTO</text></svg>`;
    await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(path.join(target, name + '.webp'));
  }
  console.log('Created eight labelled original image placeholders.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
