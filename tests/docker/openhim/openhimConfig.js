'use strict';

const fs = require('fs');
const https = require('https');
const fetch = require('node-fetch');
const path = require('path');

(async function () {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  const authHeader = new Buffer.from('root@openhim.org:openhim-password').toString('base64');

  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

  try {
    const jsonData = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, 'openhim-import.json'))
    );

    const data = JSON.stringify(jsonData);
    const res = await fetch(`https://localhost:8080/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        Authorization: `Basic ${authHeader}`,
      },
      agent: httpsAgent,
      body: data,
    });

    if (res.status == 401) {
      throw new Error(`Incorrect OpenHIM API credentials`);
    }

    if (res.status != 201) {
      throw new Error(`Failed to import OpenHIM config: ${res.statusText}`);
    }
  } catch (error) {
    console.error(`Failed to import OpenHIM config: ${error}`);
  }
})();
