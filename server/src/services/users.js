import { User } from '../models/index.js';

export async function createUser(config, fields = {}) {
  return User.create({
    caps: {
      decisionCapUusdc: config.defaultDecisionCapUusdc,
      monthlyCapUusdc: config.defaultMonthlyCapUusdc,
    },
    ...fields,
  });
}
