// Deterministic risk engine — code decides the number, AI only explains it.
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface RiskInput {
  isKnownProgram: boolean;
  hasInteractedBefore: boolean;
  hasAuthorityChange: boolean;
  hasTokenApproval: boolean;
  walletTxCount: number | null; // null = unknown
}

export interface RiskResult {
  score: number; // 1-10
  level: RiskLevel;
  reasons: { label: string; good: boolean }[];
}

// Known, reputable Solana programs (short allowlist for V1)
export const KNOWN_PROGRAMS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLU7X5QKFoBiExEa6U": "Jupiter Aggregator",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB": "Jupiter",
  "11111111111111111111111111111111": "System Program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Program",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token",
  MemoSq4gqABAXKb96qn9TysNcWxMyWCqXgDLGmfcHr: "Memo",
  ComputeBudget111111111111111111111111111111: "Compute Budget",
};

export function programName(id: string): string {
  return KNOWN_PROGRAMS[id] ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function scoreRisk(input: RiskInput): RiskResult {
  let score = 1;
  const reasons: RiskResult["reasons"] = [];

  if (input.isKnownProgram) {
    reasons.push({ label: "Known program", good: true });
  } else {
    score += 3;
    reasons.push({ label: "Unknown / new program", good: false });
  }

  if (input.hasInteractedBefore) {
    reasons.push({ label: "Wallet used this program before", good: true });
  } else {
    score += 2;
    reasons.push({ label: "First interaction with this program", good: false });
  }

  if (input.hasAuthorityChange) {
    score += 3;
    reasons.push({ label: "Authority / ownership change detected", good: false });
  } else {
    reasons.push({ label: "No authority change", good: true });
  }

  if (input.hasTokenApproval) {
    score += 2;
    reasons.push({ label: "Token approval / unexpected transfer", good: false });
  }

  if (input.walletTxCount !== null && input.walletTxCount < 10) {
    score += 1;
    reasons.push({ label: "Fresh wallet (< 10 txs)", good: false });
  }

  score = Math.max(1, Math.min(10, score));
  const level: RiskLevel =
    score <= 3 ? "Low" : score <= 6 ? "Medium" : score <= 8 ? "High" : "Critical";

  return { score, level, reasons };
}
