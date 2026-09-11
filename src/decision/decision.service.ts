import { Injectable } from '@nestjs/common';
import { evaluateDecision } from './decision.engine.js';
import type { Decision, DecisionInput } from './types.js';
import { getPolicyFromEnv } from './policy.js';

@Injectable()
export class DecisionService {
  evaluate(
    input: Omit<DecisionInput, 'policy'> & {
      policy?: DecisionInput['policy'];
    },
  ): Decision {
    const policy = input.policy ?? getPolicyFromEnv();
    return evaluateDecision({ ...input, policy });
  }
}
