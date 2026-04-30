const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const runtimeApiBase = window.__API_BASE_URL__;
const envApiBase = runtimeApiBase && typeof runtimeApiBase === 'string'
  ? runtimeApiBase
  : null;

const productionApiBase = 'https://linguistfeed-api.onrender.com/api';

export const API_BASE_URL = envApiBase || (isLocalhost
  ? 'http://localhost:3001/api'
  : productionApiBase);
