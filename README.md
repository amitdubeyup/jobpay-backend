# jobpay-backend

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

JobPay Backend Application

## 🚀 Tech Stack

- TypeScript

## ✨ Features

- Modern and scalable architecture
- Type-safe development with TypeScript

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/amitdubeyup/jobpay-backend.git
cd jobpay-backend

# Install dependencies
npm install
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration values.

## 🚀 Usage

```bash
# Production mode
npm start

# Build for production
npm run build

# Run tests
npm test
```

## 📜 Available Scripts

- `npm run preinstall` - node scripts/enforce-pnpm.js
- `npm run build` - nest build
- `npm run format` - prettier --write "src/**/*.ts"
- `npm run format:check` - prettier --check "src/**/*.ts"
- `npm run start` - node dist/src/main
- `npm run start:dev` - nest start --watch
- `npm run start:debug` - nest start --debug --watch
- `npm run start:prod` - node dist/src/main
- `npm run start:monitoring` - NODE_ENV=production NEW_RELIC_ENABLED=true node dist/src/main
- `npm run lint` - eslint "{src,apps,libs,test}/**/*.ts" --fix
- `npm run lint:check` - eslint "{src,apps,libs,test}/**/*.ts"
- `npm run test` - jest
- `npm run test:verbose` - VERBOSE_TESTS=true jest --verbose
- `npm run test:watch` - jest --watch
- `npm run test:cov` - jest --coverage
- `npm run test:unit` - jest --coverage --watchAll=false --passWithNoTests --testPathIgnorePatterns='test/integration' --forceExit --detectOpenHandles
- `npm run test:ci` - jest --coverage --watchAll=false --passWithNoTests --testPathIgnorePatterns='test/integration' --forceExit --detectOpenHandles
- `npm run test:e2e` - jest --config ./test/jest-e2e.json
- `npm run test:integration` - jest --config ./test/jest-integration.json
- `npm run test:integration:watch` - jest --config ./test/jest-integration.json --watch
- `npm run prisma:generate` - prisma generate
- `npm run prisma:migrate` - prisma migrate deploy
- `npm run prisma:studio` - prisma studio
- `npm run prisma:reset` - prisma migrate reset
- `npm run audit:security` - pnpm audit --audit-level moderate || true
- `npm run audit:licenses` - pnpm dlx license-checker --summary
- `npm run check:outdated` - pnpm outdated
- `npm run test:commit-msg` - node scripts/test-commit-msg.js
- `npm run pre-commit` - pnpm run lint:check && pnpm run format:check && pnpm run test:ci
- `npm run ci:full` - pnpm run pre-commit && pnpm run build && pnpm run audit:security
- `npm run docker:build` - docker build -t jobpay-backend .
- `npm run docker:run` - docker-compose up -d
- `npm run docker:stop` - docker-compose down
- `npm run prepare` - husky
- `npm run security:full` - pnpm run lint:security && pnpm run audit:deps && pnpm run test:security && pnpm run scan:secrets
- `npm run lint:security` - eslint '{src,test}/**/*.ts' --config .eslintrc.security.js
- `npm run audit:deps` - pnpm audit --audit-level moderate && pnpm dlx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'
- `npm run test:security` - jest --testPathPattern=security --coverage
- `npm run scan:secrets` - pnpm dlx secretlint '**/*' --ignore-path .gitignore
- `npm run security:local` - pnpm run lint:security && pnpm run audit:deps

## 📁 Project Structure

```
jobpay-backend/
├── src/
├── package.json
├── tsconfig.json
├── .env.example
├── docker-compose.yml
├── README.md
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Amit Dubey**

- GitHub: [@amitdubeyup](https://github.com/amitdubeyup)
