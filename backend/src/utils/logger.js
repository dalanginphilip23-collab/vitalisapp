const isProd = process.env.NODE_ENV === 'production';
const debugOn = Boolean(process.env.DEBUG) && process.env.DEBUG !== '0';

function debug(...args) {
  if (debugOn) console.debug(...args);
}

function info(...args) {
  if (!isProd || debugOn) console.info(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(...args) {
  console.error(...args);
}

module.exports = { debug, info, warn, error };
