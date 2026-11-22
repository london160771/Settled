import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { loadConfig, ConfigError } from '../src/config/index.js';
import { createApp } from '../src/app.js';

const dummy = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://dummy', JWT_SECRET: 'dummy' };

describe('config', () => {
  it('fails clearly on missing required vars', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/MONGODB_URI, JWT_SECRET/);
  });
  it('refuses any chain other than Ethereum Sepolia', () => {
    expect(() => loadConfig({ ...dummy, CHAIN_ID: '84532' })).toThrow(/11155111/);
  });
  it('loads defaults with dummies', () => {
    const c = loadConfig(dummy);
    expect(c.chainId).toBe(11155111);
    expect(c.testUsdcAddress).toBe('0xcc194e1a843B658526D0D5C431f670028582Ae17');
    expect(c.defaultDecisionCapUusdc).toBe(200000);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp(loadConfig(dummy))).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
