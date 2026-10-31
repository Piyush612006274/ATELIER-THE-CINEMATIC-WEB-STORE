const fs = require('node:fs');
const [file, start = '1', end = '200'] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split('\n');
console.log(lines.slice(Number(start)-1, Number(end)).map((line, i)=>`${Number(start)+i}: ${line}`).join('\n'));
