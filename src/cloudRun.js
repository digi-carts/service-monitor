const https = require('node:https');
const http = require('node:http');

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const CLOUD_RUN_API =
  'https://run.googleapis.com/v2/projects/%s/locations/%s/services';

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAccessToken() {
  const res = await fetch(METADATA_TOKEN_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (res.status !== 200) {
    throw new Error(`Failed to fetch GCP access token: HTTP ${res.status}`);
  }
  return JSON.parse(res.body).access_token;
}

async function fetchServices(token, projectId, region) {
  const url = CLOUD_RUN_API.replace('%s', projectId).replace('%s', region);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    throw new Error(`Cloud Run API returned HTTP ${res.status}: ${res.body}`);
  }
  const data = JSON.parse(res.body);
  return (data.services || []).map(toServiceStatus);
}

function resolveStatus(conditions = []) {
  if (!conditions.length) return 'unknown';
  const failed = conditions.some((c) => c.state === 'CONDITION_FAILED');
  if (failed) return 'inactive';
  const allOk = conditions.every((c) => c.state === 'CONDITION_SUCCEEDED');
  return allOk ? 'running' : 'unknown';
}

function toServiceStatus(svc) {
  const fullName = svc.name || '';
  const name = fullName.includes('/') ? fullName.split('/').pop() : fullName;
  const status = resolveStatus(svc.conditions);
  const scaling = svc.scaling || {};
  const latestFull = svc.latestReadyRevision || null;
  let lastRevision = null;
  if (latestFull) {
    lastRevision = latestFull.includes('/') ? latestFull.split('/').pop() : latestFull;
  }

  return {
    name,
    status,
    instances: status === 'running' ? 1 : 0,
    minInstances: scaling.minInstanceCount || 0,
    maxInstances: scaling.maxInstanceCount || 0,
    url: svc.uri || null,
    lastRevision,
  };
}

async function getStatus(projectId, region) {
  const token = await fetchAccessToken();
  const services = await fetchServices(token, projectId, region);
  return { services, fetchedAt: new Date().toISOString() };
}

module.exports = { getStatus };
