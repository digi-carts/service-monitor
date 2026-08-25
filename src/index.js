const express = require('express');
const { getStatus } = require('./cloudRun');

const app = express();
const PORT = process.env.PORT || 3010;
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'digi-carts';
const REGION = process.env.GCP_REGION || 'us-east1';

app.get('/api/platform/services/status', async (req, res) => {
  try {
    const data = await getStatus(PROJECT_ID, REGION);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`service-monitor listening on port ${PORT}`);
  console.log(`GCP_PROJECT_ID=${PROJECT_ID}  GCP_REGION=${REGION}`);
});
