#!/usr/bin/env node

/**
 * Test commit message script
 * Usage: node scripts/test-commit-msg.js "your commit message"
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */

const { execSync } = require('child_process');

const message = process.argv[2];

if (!message) {
  console.log('❌ Please provide a commit message to test');
  console.log('Usage: pnpm test:commit-msg "feat(auth): add login functionality"');
  process.exit(1);
}

console.log(`🔍 Testing commit message: "${message}"`);
console.log('');

try {
  // Use echo to pipe the message to commitlint via pnpm dlx
  execSync(`echo "${message}" | pnpm dlx commitlint --verbose`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('');
  console.log('✅ Commit message is valid!');
} catch (error) {
  console.log('');
  console.log('❌ Commit message validation failed!');
  console.log('');
  console.log('📋 Required format: <type>(<scope>): <description>');
  console.log('');
  console.log(
    '✅ Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert, security, deps',
  );
  console.log('');
  console.log('Examples:');
  console.log('  ✅ feat(auth): add JWT authentication');
  console.log('  ✅ fix(api): resolve user validation bug');
  console.log('  ✅ docs: update README installation steps');
  console.log('');
  console.log('❌ Common mistakes:');
  console.log('  - Type should be lowercase: "Feat" → "feat"');
  console.log('  - Subject should be lowercase: "Add Feature" → "add feature"');
  console.log('  - Don\'t end subject with period: "fix bug." → "fix bug"');
  console.log('  - Header too long (max 100 chars)');
  console.log('');

  process.exit(1);
}
