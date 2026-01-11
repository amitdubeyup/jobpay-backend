#!/usr/bin/env node

/**
 * New Relic Configuration Validator
 *
 * This script validates your New Relic setup and provides diagnostic information.
 * Run with: node scripts/validate-newrelic.js
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

console.log('🔍 New Relic Configuration Validator\n');

// 1. Check Environment Variables
console.log('📋 Environment Variables:');
console.log(
  '├── NEW_RELIC_LICENSE_KEY:',
  process.env.NEW_RELIC_LICENSE_KEY
    ? `✅ Set (${process.env.NEW_RELIC_LICENSE_KEY.substring(0, 8)}...)`
    : '❌ Not set',
);
console.log('├── NEW_RELIC_APP_NAME:', process.env.NEW_RELIC_APP_NAME || '❌ Not set');
console.log('├── NEW_RELIC_ENABLED:', process.env.NEW_RELIC_ENABLED || 'Not explicitly set');
console.log('└── NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log();

// 2. Validate License Key Format
if (process.env.NEW_RELIC_LICENSE_KEY) {
  const key = process.env.NEW_RELIC_LICENSE_KEY;
  console.log('🔑 License Key Validation:');
  console.log('├── Length:', key.length);

  // Check for different license key formats
  const isUSFormat = key.startsWith('NRAK-') && key.length === 32;
  const isEUFormat = key.startsWith('eu01') && key.length === 40;
  const isLegacyFormat = key.length === 40 && !key.startsWith('eu01') && !key.startsWith('NRAK-');

  if (isUSFormat) {
    console.log('├── Format: ✅ US Region (NRAK-*)');
    console.log(
      '└── Pattern:',
      /^NRAK-[A-Z0-9]{27}$/.test(key) ? '✅ Valid US pattern' : '❌ Invalid US pattern',
    );
  } else if (isEUFormat) {
    console.log('├── Format: ✅ EU Region (eu01*)');
    console.log(
      '└── Pattern:',
      /^eu01[a-f0-9]{36}$/.test(key) ? '✅ Valid EU pattern' : '⚠️  Possible EU format',
    );
  } else if (isLegacyFormat) {
    console.log('├── Format: ✅ Legacy Format (40 chars)');
    console.log('└── Pattern: ⚠️  Legacy license key format');
  } else {
    console.log('├── Format: ❌ Unknown format');
    console.log('└── Pattern: ❌ Does not match known patterns');
  }
  console.log();
}

// 3. Check Configuration File
console.log('📄 Configuration File:');
const configPath = path.join(__dirname, '..', 'newrelic.js');
if (fs.existsSync(configPath)) {
  console.log('├── newrelic.js: ✅ Exists');

  try {
    const config = require(configPath);
    console.log('├── Configuration load: ✅ Success');
    console.log('├── App name:', config.config?.app_name || '❌ Not configured');
    console.log('├── License key configured:', config.config?.license_key ? '✅ Yes' : '❌ No');
    console.log('└── Agent enabled:', config.config?.agent_enabled !== false ? '✅ Yes' : '❌ No');
  } catch (error) {
    console.log('├── Configuration load: ❌ Error loading configuration');
    console.log('└── Error:', error.message);
  }
} else {
  console.log('└── newrelic.js: ❌ File not found');
}
console.log();

// 4. Check Log File
console.log('📝 New Relic Logs:');
const logPath = path.join(__dirname, '..', 'logs', 'newrelic_agent.log');
if (fs.existsSync(logPath)) {
  console.log('├── Log file: ✅ Exists');

  try {
    const stats = fs.statSync(logPath);
    console.log('├── Size:', Math.round(stats.size / 1024), 'KB');
    console.log('└── Last modified:', stats.mtime.toISOString());

    // Check for common errors in recent logs
    const logContent = fs.readFileSync(logPath, 'utf8');
    const recentLogs = logContent.split('\n').slice(-50).join('\n');

    console.log('\n🔍 Recent Log Analysis:');
    if (recentLogs.includes('license key appears to be invalid')) {
      console.log('├── Status: ❌ Invalid license key (401 error)');
      console.log('├── Issue: License key is rejected by New Relic');
      console.log('└── Solution: Verify license key in New Relic account');
    } else if (recentLogs.includes('connected')) {
      console.log('├── Status: ✅ Connected successfully');
    } else if (recentLogs.includes('Failed to connect')) {
      console.log('├── Status: ❌ Connection failed');
      console.log('└── Check network connectivity and firewall settings');
    } else {
      console.log('├── Status: ⚠️  No clear connection status in recent logs');
    }
  } catch (error) {
    console.log('├── Error reading log file:', error.message);
  }
} else {
  console.log('└── Log file: ❌ Not found (agent may not have started)');
}
console.log();

// 5. Test New Relic Module Loading
console.log('🔧 Module Loading Test:');
try {
  // Temporarily disable the agent to avoid affecting this test
  process.env.NEW_RELIC_ENABLED = 'false';
  const newrelic = require('newrelic');
  console.log('├── New Relic module: ✅ Loaded successfully');
  console.log('├── Agent version:', newrelic.version || 'Unknown');
  console.log('└── Module type:', typeof newrelic);
} catch (error) {
  console.log('├── New Relic module: ❌ Failed to load');
  console.log('└── Error:', error.message);
}
console.log();

// 6. Recommendations
console.log('💡 Recommendations:');
if (!process.env.NEW_RELIC_LICENSE_KEY) {
  console.log('├── Get a valid license key from your New Relic account');
}
if (
  process.env.NEW_RELIC_LICENSE_KEY &&
  process.env.NEW_RELIC_LICENSE_KEY.includes('YOUR_OLD_KEY_HERE')
) {
  console.log('├── ⚠️  The current license key appears to be invalid or expired');
  console.log(
    '├── 🔑 Generate a new license key from: https://one.newrelic.com/admin-portal/api-keys-ui/api-keys',
  );
  console.log('├── 📝 Update the NEW_RELIC_LICENSE_KEY in your .env file');
}
console.log('├── Ensure your New Relic account is active and in good standing');
console.log('├── Test with NODE_ENV=development first');
console.log('└── Check New Relic account for any billing or access issues');
console.log();

console.log('🏁 Validation Complete!');
console.log();
console.log('📚 Useful Links:');
console.log('├── New Relic Dashboard: https://one.newrelic.com/');
console.log('├── API Keys Management: https://one.newrelic.com/admin-portal/api-keys-ui/api-keys');
console.log('├── Node.js Agent Docs: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/');
console.log(
  '└── Troubleshooting Guide: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/troubleshooting/',
);
