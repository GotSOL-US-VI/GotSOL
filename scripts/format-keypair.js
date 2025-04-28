const fs = require('fs');
const path = require('path');

// Read the keypair file
const keypairPath = path.join(__dirname, '..', 'fee-payer-keypair.json');
const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));

// Format the keypair data for .env.local
console.log(`FEE_PAYER_PRIVATE_KEY='${JSON.stringify(keypairData)}'`); 