/**
 * Used by `npm run deps:update`: everything goes to the newest published version, except packages whose
 * next major is not a stable target for this project (see README, "Dependencies").
 */
const STAY_ON_MAJOR = new Set(['typescript', '@types/node', 'pino', 'pino-http', 'pino-pretty']);

module.exports = {
  target: (name) => (name === 'prisma' || name.startsWith('@prisma/') || STAY_ON_MAJOR.has(name) ? 'minor' : 'latest'),
};
