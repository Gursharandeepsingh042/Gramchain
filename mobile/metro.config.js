const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for tflite models
config.resolver.assetExts.push('tflite');

module.exports = config;
