const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'tmp', 'historical_fantasy_points.csv');
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');

const positions = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const cols = line.split(',');
  const pos = cols[2]?.replace(/"/g, '');
  positions[pos] = (positions[pos] || 0) + 1;
}

console.log('Position distribution in historical stats:');
console.log(positions);
