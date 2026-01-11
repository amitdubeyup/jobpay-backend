#!/usr/bin/env node

/**
 * This script enforces the use of pnpm as the package manager for this project.
 * It prevents developers from accidentally using npm or yarn, which could cause
 * dependency lock file conflicts and inconsistent environments.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */

const { execSync } = require('child_process');

/**
 * Check if the current package manager is pnpm
 */
function checkPackageManager() {
  const userAgent = process.env.npm_config_user_agent;

  if (!userAgent) {
    console.log('⚠️  Could not detect package manager. Please use pnpm.');
    return false;
  }

  if (!userAgent.startsWith('pnpm')) {
    return false;
  }

  return true;
}

/**
 * Display error message and exit if not using pnpm
 */
function enforcePackageManager() {
  if (!checkPackageManager()) {
    console.log('');
    console.log('🚫 ERROR: This project requires pnpm as the package manager');
    console.log('');
    console.log('❌ You are not using pnpm. This project enforces pnpm usage to:');
    console.log('   • Ensure consistent dependency resolution');
    console.log('   • Maintain workspace compatibility');
    console.log('   • Prevent lock file conflicts');
    console.log('   • Optimize disk space usage');
    console.log('');
    console.log('✅ Please install pnpm and use it instead:');
    console.log('');
    console.log('   # Install pnpm globally');
    console.log('   npm install -g pnpm');
    console.log('');
    console.log('   # Or use corepack (recommended)');
    console.log('   corepack enable');
    console.log('   corepack prepare pnpm@latest --activate');
    console.log('');
    console.log('   # Then install dependencies with:');
    console.log('   pnpm install');
    console.log('');
    console.log('📖 Learn more: https://pnpm.io/installation');
    console.log('');
    process.exit(1);
  }
}

/**
 * Check pnpm version compatibility
 */
function checkPnpmVersion() {
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(pnpmVersion.split('.')[0], 10);

    if (majorVersion < 8) {
      console.log('');
      console.log('⚠️  WARNING: You are using pnpm v' + pnpmVersion);
      console.log('   This project requires pnpm v8.0.0 or higher');
      console.log('');
      console.log('   Please update pnpm:');
      console.log('   npm install -g pnpm@latest');
      console.log('');
      process.exit(1);
    }

    console.log('✅ Using pnpm v' + pnpmVersion + ' (compatible)');
  } catch (error) {
    console.log('⚠️  Could not detect pnpm version');
  }
}

// Only run enforcement if we're in an install context
if (process.env.npm_execpath || process.env.npm_command) {
  enforcePackageManager();
  checkPnpmVersion();
}
