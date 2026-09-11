import type { PolicyConfig } from './types.js';

export const DEFAULT_POLICY: PolicyConfig = {
  refundWindowDays: 30,
  autoRefundThreshold: 500,
  confidenceThreshold: 0.85,
};

export function getPolicyFromEnv(): PolicyConfig {
  return {
    refundWindowDays: Number(process.env.REFUND_WINDOW_DAYS ?? 30),
    autoRefundThreshold: Number(process.env.AUTO_REFUND_THRESHOLD ?? 500),
    confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD ?? 0.85),
  };
}
