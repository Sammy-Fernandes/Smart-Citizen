// Polyfill for Node 18 compatibility with Expo SDK 54 internals
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /backend\/.*/,
  /admin-dashboard\/.*/,
];

module.exports = config;
