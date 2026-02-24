const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable development navigation features
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config; 