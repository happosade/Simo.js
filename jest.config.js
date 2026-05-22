'use strict';

module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.js'],
    clearMocks: true,
    resetModules: false, // Individual tests handle their own module resets where needed
    // Force exit after tests complete to clean up timers/open handles
    // from database polling intervals and other async resources.
    forceExit: true,
};
