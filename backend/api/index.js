// Point d'entrée Vercel serverless
// Charge le NestJS compilé depuis dist/serverless.js
const serverless = require('../dist/serverless');
module.exports = serverless.default || serverless;
