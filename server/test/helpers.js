import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../src/config/index.js';

let mem;
export const TEST_MNEMONIC = 'test test test test test test test test test test test junk'; // public Hardhat test seed

export function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://unused',
    JWT_SECRET: 'test-secret',
    MASTER_MNEMONIC: TEST_MNEMONIC,
    ...overrides,
  });
}

export async function startDb() {
  if (process.env.MONGODB_URI_TEST) {
    await mongoose.connect(process.env.MONGODB_URI_TEST, { dbName: `settled_test_${process.pid}` });
  } else {
    mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri());
  }
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopDb() {
  if (process.env.MONGODB_URI_TEST) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}
