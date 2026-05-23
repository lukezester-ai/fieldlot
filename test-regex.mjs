import fs from 'fs';
const html = fs.readFileSync('borsa_test.html', 'utf8');
const re = /href="https:\/\/borsaagro\.com\/potrebitelski-obqvi\/(\d+)"[^>]*>\s*([^<]+)\s*<\/a>[\s\S]*?fa-clock[\s\S]*?>\s*([^<]+)\s*<[\s\S]*?fw-semibold fs-5">\s*([\d.,]+)/gi;
let m;
while (m = re.exec(html)) console.log(m[1], m[2].trim(), m[3].trim(), m[4].trim());
