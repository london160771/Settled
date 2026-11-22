// Env loading + validation. Fails clearly on missing required vars.
// Never log values: only variable names appear in errors.

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const DEFAULTS = {
  NODE_ENV: 'development',
  PORT: '4000',
  APP_URL: 'http://localhost:4000',
  WEB_URL: 'http://localhost:5173',
  TELEGRAPH_BASE_URL: 'https://devnode.telegraphprotocol.com',
  TEST_USDC_ADDRESS: '0xcc194e1a843B658526D0D5C431f670028582Ae17',
  CHAIN_ID: '11155111',
  SEPOLIA_RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  DEFAULT_DECISION_CAP_UUSDC: '200000',
  DEFAULT_MONTHLY_CAP_UUSDC: '1000000',
  JUDGE_DAILY_RUN_LIMIT: '20',
  LIVE_TELEGRAPH: '0',
};

export class ConfigError extends Error {}

function int(name, raw) {
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new ConfigError(`Env var ${name} must be an integer`);
  return n;
}

export function loadConfig(env = process.env) {
  const e = { ...DEFAULTS, ...Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')) };
  const missing = REQUIRED.filter((k) => !e[k]);
  if (missing.length) {
    throw new ConfigError(
      `Missing required env vars: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
    );
  }
  const chainId = int('CHAIN_ID', e.CHAIN_ID);
  if (chainId !== 11155111) {
    throw new ConfigError(
      'CHAIN_ID must be 11155111 (Ethereum Sepolia). Base Sepolia is not used.',
    );
  }
  return {
    nodeEnv: e.NODE_ENV,
    isTest: e.NODE_ENV === 'test',
    isProd: e.NODE_ENV === 'production',
    port: int('PORT', e.PORT),
    appUrl: e.APP_URL,
    webUrl: e.WEB_URL,
    mongoUri: e.MONGODB_URI,
    mongoUriTest: e.MONGODB_URI_TEST || null,
    jwtSecret: e.JWT_SECRET,
    masterMnemonic: e.MASTER_MNEMONIC || null,
    sepoliaRpcUrl: e.SEPOLIA_RPC_URL,
    telegraphBaseUrl: e.TELEGRAPH_BASE_URL.replace(/\/$/, ''),
    testUsdcAddress: e.TEST_USDC_ADDRESS,
    chainId,
    defaultDecisionCapUusdc: int('DEFAULT_DECISION_CAP_UUSDC', e.DEFAULT_DECISION_CAP_UUSDC),
    defaultMonthlyCapUusdc: int('DEFAULT_MONTHLY_CAP_UUSDC', e.DEFAULT_MONTHLY_CAP_UUSDC),
    telegramBotToken: e.TELEGRAM_BOT_TOKEN || null,
    telegramWebhookSecret: e.TELEGRAM_WEBHOOK_SECRET || null,
    smtp: e.SMTP_HOST
      ? {
          host: e.SMTP_HOST,
          port: int('SMTP_PORT', e.SMTP_PORT || '587'),
          user: e.SMTP_USER || '',
          pass: e.SMTP_PASS || '',
          from: e.SMTP_FROM || e.SMTP_USER || '',
        }
      : null,
    demoInboxEmail: e.DEMO_INBOX_EMAIL || null,
    judgeDailyRunLimit: int('JUDGE_DAILY_RUN_LIMIT', e.JUDGE_DAILY_RUN_LIMIT),
    liveTelegraph: e.LIVE_TELEGRAPH === '1',
  };
}

// Throws a clear error when a feature needs a var that is not set.
export function requireVar(config, key, envName) {
  if (!config[key]) throw new ConfigError(`${envName} is not set. See docs/manual/ for setup.`);
  return config[key];
}
