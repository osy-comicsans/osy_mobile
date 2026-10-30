const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// OCR models and their dictionaries ship inside the app, so OCR works offline.
config.resolver.assetExts.push('onnx', 'txt');

module.exports = config;
