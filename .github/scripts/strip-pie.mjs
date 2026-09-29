// Removes the language pie chart from the 3D contribution SVG,
// since the same data is already shown by the summary cards.
import fs from 'node:fs';

const file = process.argv[2] ?? 'profile-3d-contrib/profile-purple.svg';
const svg = fs.readFileSync(file, 'utf8');

const start = svg.search(/<g transform="translate\(40, ?\d+(\.\d+)?\)">/);
if (start === -1) {
  console.log('pie chart group not found, nothing to strip');
  process.exit(0);
}

const tag = /<(\/?)g\b[^>]*?(\/?)>/g;
tag.lastIndex = start;
let depth = 0;
let end = -1;
for (let m; (m = tag.exec(svg)); ) {
  if (m[1]) depth--;
  else if (!m[2]) depth++;
  if (depth === 0) {
    end = tag.lastIndex;
    break;
  }
}
if (end === -1) throw new Error('unbalanced <g> tags in ' + file);

fs.writeFileSync(file, svg.slice(0, start) + svg.slice(end));
console.log(`stripped pie chart (${end - start} bytes) from ${file}`);
