const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\expre\\OneDrive\\Desktop\\project\\fieldlot\\server\\listing-sources';
const files = fs.readdirSync(dir).filter(f => f.endsWith('-fetcher.ts'));

files.forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  
  // Fix TS property 'type' -> 'role'
  c = c.replace(/type: 'buy' \| 'sell'/g, "role: 'buy' | 'sell'");
  c = c.replace(/type,/g, "role: type,");
  
  // Fix TS property 'currency' -> 'priceUnit'
  c = c.replace(/currency: 'EUR'/g, "priceUnit: 'EUR'");
  c = c.replace(/currency: 'RON'/g, "priceUnit: 'RON'");
  c = c.replace(/currency: 'PLN'/g, "priceUnit: 'PLN'");
  c = c.replace(/currency: 'BGN'/g, "priceUnit: 'BGN'");
  
  // Fix ultra_premium -> premium=true&render=true
  c = c.replace(/ultra_premium=true/g, "premium=true&render=true");
  
  fs.writeFileSync(p, c);
  console.log('Fixed', f);
});
