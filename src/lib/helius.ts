// Server-side Helius helpers. Keys stay on the server (never in the browser).
const HELIUS_KEY = process.env.HELIUS_API_KEY ?? "";
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? `RPC ${method} error`);
  return json.result as T;
}

export interface TxInfo {
  status: "success" | "failed";
  feeSol: number;
  blockTime: number | null;
  programIds: string[];
  mainProgram: string;
  logs: string[];
  feePayer: string;
  errorText: string | null;
}

export async function getTxInfo(signature: string): Promise<TxInfo> {
  const tx: any = await rpc("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx) throw new Error("Transaction not found (it may be too old or the signature is wrong)");

  const err = tx.meta?.err ?? null;
  const logs: string[] = tx.meta?.logMessages ?? [];
  const fee = (tx.meta?.fee ?? 0) / 1e9;
  const programIds = [
    ...new Set(
      (tx.transaction?.message?.instructions ?? [])
        .map((ix: any) => ix.programId as string)
        .filter(Boolean)
    ),
  ] as string[];
  const feePayer: string = tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? "";
  const SYSTEM_NOISE = new Set([
    "ComputeBudget111111111111111111111111111111",
    "MemoSq4gqABAXKb96qn9TysNcWxMyWCqXgDLGmfcHr",
  ]);
  const mainProgram: string =
    programIds.find((id) => !SYSTEM_NOISE.has(id)) ?? programIds[0] ?? "unknown";
  return {
    status: err ? "failed" : "success",
    feeSol: fee,
    blockTime: tx.blockTime ?? null,
    programIds,
    mainProgram,
    logs,
    feePayer,
    errorText: err ? JSON.stringify(err).slice(0, 300) : null,
  };
}

export interface WalletOverview {
  address: string;
  firstSeen: string | null; // ISO date or null
  lastActive: string | null;
  txCountEstimate: number | null;
  truncated: boolean;
}

// V1 heuristic: newest signature = last active; walk back with pagination
// (bounded to 2 pages so vibe-coder wallets don't burn credits).
export async function getWalletOverview(address: string): Promise<WalletOverview> {
  const newest: any[] = await rpc("getSignaturesForAddress", [address, { limit: 1 }]);
  const lastActive = newest?.[0]?.blockTime
    ? new Date(newest[0].blockTime * 1000).toISOString()
    : null;

  // Try to find first-seen: page back at most twice (up to ~2000 sigs).
  let oldest: any | null = newest?.[0] ?? null;
  let before: string | undefined = newest?.[0]?.signature;
  let truncated = false;
  for (let i = 0; i < 2 && before; i++) {
    const page: any[] = await rpc("getSignaturesForAddress", [
      address,
      { limit: 1000, before },
    ]);
    if (!page || page.length === 0) break;
    oldest = page[page.length - 1];
    if (page.length === 1000) {
      before = oldest.signature;
      truncated = true;
    } else {
      truncated = false;
      break;
    }
  }
  const firstSeen = oldest?.blockTime
    ? new Date(oldest.blockTime * 1000).toISOString()
    : null;

  return { address, firstSeen, lastActive, txCountEstimate: null, truncated };
}

export function hasAuthorityChange(logs: string[]): boolean {
  const blob = logs.join("\n").toLowerCase();
  return (
    blob.includes("setauthority") ||
    blob.includes("authority") && blob.includes("transfer") ||
    blob.includes("ownership")
  );
}

export function hasTokenApproval(logs: string[], programIds: string[]): boolean {
  const blob = logs.join("\n").toLowerCase();
  return blob.includes("approve") || blob.includes("set authority");
}
