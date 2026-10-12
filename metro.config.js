const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prevent Metro from watching transient native build folders in android & ios
config.resolver.blockList = [
  /.*\/android\/.*/,
  /.*\/ios\/.*/,
];

module.exports = config;
