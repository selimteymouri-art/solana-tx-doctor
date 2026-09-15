// Meme-token scanner engine — deterministic data fetching + scoring.
// All numbers come from code (Helius RPC/DAS + DexScreener). No AI in this file.

const HELIUS_KEY = process.env.HELIUS_API_KEY ?? "";
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";

async function rpc<T>(method: string, params: unknown): Promise<T> {
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

async function das<T>(method: string, params: unknown): Promise<T> {
  // DAS methods ride on the same RPC endpoint
  return rpc<T>(method, params);
}

// ---------- types ----------

export interface CreatorInfo {
  address: string;
  source: "mintAuthority" | "metaplexCreator" | "firstFunder" | "unknown";
  solBalance: number | null;
  tokenBalance: number | null; // creator's balance of THIS token (in units)
}

export interface CreatorBuy {
  signature: string;
  time: string | null;
  side: "buy" | "other";
  solAmount: number | null;
}

export interface EarlyBuyer {
  address: string;
  time: string | null;
  linkedToCreator: boolean;
  linkReason: string | null;
  solAmount: number | null;
}

export interface MarketInfo {
  priceUsd: number | null;
  liquidityUsd: number | null;
  volumeH1: number | null;
  volumeH24: number | null;
  priceChangeH1: number | null;
  priceChangeH24: number | null;
  dex: string | null;
  pairUrl: string | null;
}

export interface SanityScore {
  score: number; // 1-10 (10 = most sensible)
  reasons: { label: string; good: boolean }[];
  verdict: string;
}

export interface TokenScan {
  mint: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  supply: number | null;
  creator: CreatorInfo;
  creatorBuys: CreatorBuy[];
  earlyBuyers: EarlyBuyer[];
  poolCreatedAt: string | null;
  market: MarketInfo;
  sanity: SanityScore;
  warnings: string[];
}

// ---------- helpers ----------

const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78TyFST7nbrrZUaFrrCWAJ";
const PUMPSWAP_PROGRAM = "pAMMBay6oceH9fJKBRHGP5d4bD4sWpmnGjkX45zoG73d6";

async function getSolBalance(address: string): Promise<number | null> {
  try {
    const r = await rpc<{ value: number }>("getBalance", [address]);
    return r.value / 1e9;
  } catch {
    return null;
  }
}

async function getTokenBalance(owner: string, mint: string): Promise<number | null> {
  try {
    const r = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] }>(
      "getTokenAccountsByOwner",
      [owner, { mint }, { encoding: "jsonParsed" }]
    );
    let total = 0;
    let found = false;
    for (const acc of r.value ?? []) {
      const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amt === "number") {
        total += amt;
        found = true;
      }
    }
    return found ? total : 0;
  } catch {
    return null;
  }
}

/** Oldest signature for an address (bounded walk), newest too. */
async function addressBounds(address: string): Promise<{ oldest: any | null; newest: any | null }> {
  const newest: any[] = await rpc("getSignaturesForAddress", [address, { limit: 1 }]);
  let oldest: any | null = newest?.[0] ?? null;
  let before: string | undefined = newest?.[0]?.signature;
  for (let i = 0; i < 3 && before; i++) {
    const page: any[] = await rpc("getSignaturesForAddress", [address, { limit: 1000, before }]);
    if (!page?.length) break;
    oldest = page[page.length - 1];
    if (page.length < 1000) break;
    before = oldest.signature;
  }
  return { oldest, newest: newest?.[0] ?? null };
}

// ---------- step 1: creator ----------

async function findCreator(mint: string): Promise<{ address: string; source: CreatorInfo["source"]; name: string | null; symbol: string | null; decimals: number | null; supply: number | null }> {
  let name: string | null = null;
  let symbol: string | null = null;
  let decimals: number | null = null;
  let supply: number | null = null;

  // 1) mint account: mintAuthority is usually the deployer; decimals/supply too
  try {
    const info = await rpc<any>("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const parsed = info?.value?.data?.parsed?.info;
    if (parsed) {
      decimals = typeof parsed.decimals === "number" ? parsed.decimals : null;
      const rawSupply = typeof parsed.supply === "string" ? Number(parsed.supply) : typeof parsed.supply === "number" ? parsed.supply : NaN;
      supply = Number.isFinite(rawSupply) ? rawSupply / 10 ** (decimals ?? 0) : null;
      const mintAuth: string | null = parsed.mintAuthority ?? null;
      if (mintAuth) return { address: mintAuth, source: "mintAuthority", name, symbol, decimals, supply };
    }
  } catch { /* fall through */ }

  // 2) DAS getAsset: metaplex creators + token_info
  try {
    const asset: any = await das("getAsset", { id: mint });
    name = asset?.content?.metadata?.name ?? asset?.content?.name ?? null;
    symbol = asset?.content?.metadata?.symbol ?? null;
    const creators: any[] = asset?.creators ?? [];
    const verified = creators.find((c) => c.verified) ?? creators[0];
    if (verified?.address) {
      return { address: verified.address, source: "metaplexCreator", name, symbol, decimals, supply };
    }
  } catch { /* fall through — pump.fun tokens have no metaplex creator */ }

  // 3) fallback: oldest signer on the mint = first funder / deployer
  const { oldest } = await addressBounds(mint);
  // fetch the tx to find fee payer (the deployer)
  if (oldest?.signature) {
    try {
      const tx: any = await rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
      const payer: string | undefined = tx?.transaction?.message?.accountKeys?.[0]?.pubkey;
      if (payer) return { address: payer, source: "firstFunder", name, symbol, decimals, supply };
    } catch { /* ignore */ }
  }
  throw new Error("Could not determine the token creator (mint authority revoked and no history).");
}

// ---------- step 2: creator buys (their own buys of this token) ----------

async function getCreatorBuys(creator: string, mint: string, limit = 20): Promise<CreatorBuy[]> {
  const out: CreatorBuy[] = [];
  let before: string | undefined;
  for (let page = 0; page < 3 && out.length < limit; page++) {
    const sigs: any[] = await rpc("getSignaturesForAddress", [
      creator,
      { limit: 100, ...(before ? { before } : {}) },
    ]);
    if (!sigs?.length) break;
    before = sigs[sigs.length - 1].signature;
    for (const s of sigs) {
      if (out.length >= limit) break;
      try {
        const tx: any = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const keys: string[] = (tx?.transaction?.message?.accountKeys ?? []).map((k: any) => k.pubkey ?? k);
        if (!keys.includes(mint)) continue;
        const logs: string[] = tx?.meta?.logMessages ?? [];
        const blob = logs.join(" ").toLowerCase();
        const looksBuy = /buy|swap.*sol.*token|pump/i.test(blob);
        // SOL delta of creator: negative = spent SOL (likely buy)
        const pre = tx?.meta?.preBalances?.[0];
        const post = tx?.meta?.postBalances?.[0];
        const solSpent = typeof pre === "number" && typeof post === "number" ? (pre - post) / 1e9 : null;
        out.push({
          signature: s.signature,
          time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
          side: looksBuy || (solSpent !== null && solSpent > 0.001) ? "buy" : "other",
          solAmount: solSpent && solSpent > 0 ? solSpent : null,
        });
      } catch { /* skip unreadable tx */ }
    }
    if (sigs.length < 100) break;
  }
  return out;
}

// ---------- step 3: early buyers (first hour after pool creation) ----------

async function getEarlyBuyers(mint: string, poolCreatedAtMs: number | null, limit = 30): Promise<EarlyBuyer[]> {
  const cutoff = (poolCreatedAtMs ?? Date.now()) + 60 * 60 * 1000;
  const buyers: EarlyBuyer[] = [];
  const seen = new Set<string>();
  let before: string | undefined;
  // walk mint signatures oldest-first-ish: page back then reverse
  const pages: any[][] = [];
  for (let i = 0; i < 5 && buyers.length < limit * 2; i++) {
    const sigs: any[] = await rpc("getSignaturesForAddress", [mint, { limit: 1000, ...(before ? { before } : {}) }]);
    if (!sigs?.length) break;
    pages.push(sigs);
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < 1000) break;
  }
  const chronological = pages.reverse().flatMap((p) => [...p].reverse()); // oldest first
  for (const s of chronological) {
    if (buyers.length >= limit) break;
    const t = (s.blockTime ?? 0) * 1000;
    if (poolCreatedAtMs && t > cutoff) break; // past first hour
    if (seen.has(s.signature)) continue;
    seen.add(s.signature);
    try {
      const tx: any = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
      const payer: string | undefined = tx?.transaction?.message?.accountKeys?.[0]?.pubkey;
      if (!payer || payer === mint) continue;
      const pre = tx?.meta?.preBalances?.[0];
      const post = tx?.meta?.postBalances?.[0];
      const solSpent = typeof pre === "number" && typeof post === "number" ? (pre - post) / 1e9 : null;
      if (solSpent === null || solSpent < 0.001) continue; // not a buy
      buyers.push({
        address: payer,
        time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        linkedToCreator: false,
        linkReason: null,
        solAmount: solSpent,
      });
    } catch { /* skip */ }
  }
  return buyers;
}

// ---------- step 4: link check (does early buyer connect to creator?) ----------
// Cheap V1 heuristic: shared counterparty — did buyer and creator both interact
// with the same address in recent history? Plus direct transfer check.

async function recentCounterparties(address: string, maxTx = 25): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const sigs: any[] = await rpc("getSignaturesForAddress", [address, { limit: maxTx }]);
    for (const s of sigs.slice(0, maxTx)) {
      try {
        const tx: any = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const keys: string[] = (tx?.transaction?.message?.accountKeys ?? []).map((k: any) => k.pubkey ?? k);
        for (const k of keys.slice(0, 12)) if (k !== address) set.add(k);
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return set;
}

export async function linkEarlyBuyers(buyers: EarlyBuyer[], creator: string): Promise<EarlyBuyer[]> {
  if (!buyers.length) return buyers;
  const creatorParties = await recentCounterparties(creator);
  creatorParties.add(creator);
  const checked = buyers.slice(0, 12); // bound RPC cost
  for (const b of checked) {
    if (b.address === creator) {
      b.linkedToCreator = true;
      b.linkReason = "Same wallet as creator";
      continue;
    }
    const mine = await recentCounterparties(b.address, 10);
    if (mine.has(creator)) {
      b.linkedToCreator = true;
      b.linkReason = "Direct on-chain interaction with creator";
      continue;
    }
    const shared = [...mine].filter((x) => creatorParties.has(x));
    if (shared.length > 0) {
      b.linkedToCreator = true;
      b.linkReason = `Shares ${shared.length} counterpar${shared.length > 1 ? "ties" : "ty"} with creator`;
    }
  }
  return buyers;
}

// ---------- step 5: market (DexScreener, no key needed) ----------

export async function getMarket(mint: string): Promise<{ market: MarketInfo; poolCreatedAtMs: number | null }> {
  const fallback: MarketInfo = { priceUsd: null, liquidityUsd: null, volumeH1: null, volumeH24: null, priceChangeH1: null, priceChangeH24: null, dex: null, pairUrl: null };
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: "no-store" });
    if (!res.ok) return { market: fallback, poolCreatedAtMs: null };
    const json = await res.json();
    const pairs: any[] = (json?.pairs ?? []).filter((p: any) => p?.chainId === "solana");
    if (!pairs.length) return { market: fallback, poolCreatedAtMs: null };
    pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    const best = pairs[0];
    return {
      market: {
        priceUsd: best?.priceUsd ? Number(best.priceUsd) : null,
        liquidityUsd: best?.liquidity?.usd ?? null,
        volumeH1: best?.volume?.h1 ?? null,
        volumeH24: best?.volume?.h24 ?? null,
        priceChangeH1: best?.priceChange?.h1 ?? null,
        priceChangeH24: best?.priceChange?.h24 ?? null,
        dex: best?.dexId ?? null,
        pairUrl: best?.url ?? null,
      },
      poolCreatedAtMs: typeof best?.pairCreatedAt === "number" ? best.pairCreatedAt : null,
    };
  } catch {
    return { market: fallback, poolCreatedAtMs: null };
  }
}

// ---------- step 6: sanity score — is a $5 buy out of $100 sensible? ----------
// Deterministic rules. Higher = more sensible. Meme-trader mindset baked in:
// position sizing (5% of life savings), liquidity exit, creator concentration,
// early-insider overlap, age of pool.

export function scoreSanity(opts: {
  liquidityUsd: number | null;
  creatorSharePct: number | null; // creator token balance / supply * 100
  linkedEarlyCount: number;
  earlyCount: number;
  poolAgeHours: number | null;
  priceChangeH1: number | null;
  creatorBuys: number;
}): SanityScore {
  let score = 5;
  const reasons: SanityScore["reasons"] = [];
  const { liquidityUsd, creatorSharePct, linkedEarlyCount, earlyCount, poolAgeHours, priceChangeH1, creatorBuys } = opts;

  // position sizing: $5 of $100 = 5% — acceptable for a lotto ticket, never for rent money
  reasons.push({ label: "$5 is 5% of $100 — lotto-ticket sizing, survivable if it goes to zero", good: true });

  if (liquidityUsd === null) {
    score -= 2;
    reasons.push({ label: "No liquidity data — you may not be able to sell", good: false });
  } else if (liquidityUsd < 10_000) {
    score -= 3;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()} — too thin, exit may fail`, good: false });
  } else if (liquidityUsd < 50_000) {
    score -= 1;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()} — thin, expect slippage`, good: false });
  } else {
    score += 1;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()} — enough to exit $5`, good: true });
  }

  if (creatorSharePct !== null) {
    if (creatorSharePct > 20) {
      score -= 2;
      reasons.push({ label: `Creator still holds ~${creatorSharePct.toFixed(1)}% — dump risk`, good: false });
    } else if (creatorSharePct > 5) {
      score -= 1;
      reasons.push({ label: `Creator holds ~${creatorSharePct.toFixed(1)}% — watch their sells`, good: false });
    } else {
      score += 1;
      reasons.push({ label: `Creator holds ~${creatorSharePct.toFixed(1)}% — low dump leverage`, good: true });
    }
  }

  if (earlyCount > 0) {
    const ratio = linkedEarlyCount / earlyCount;
    if (ratio >= 0.3) {
      score -= 2;
      reasons.push({ label: `${linkedEarlyCount}/${earlyCount} early buyers link to creator — insider-heavy launch`, good: false });
    } else if (linkedEarlyCount > 0) {
      score -= 1;
      reasons.push({ label: `${linkedEarlyCount}/${earlyCount} early buyers link to creator`, good: false });
    } else {
      score += 1;
      reasons.push({ label: "No early buyer links to creator found — cleaner launch", good: true });
    }
  }

  if (poolAgeHours !== null) {
    if (poolAgeHours < 1) {
      score -= 1;
      reasons.push({ label: "Pool is minutes old — maximum chaos phase", good: false });
    } else if (poolAgeHours > 24 * 7) {
      score += 1;
      reasons.push({ label: "Survived over a week — passed the first rug window", good: true });
    }
  }

  if (priceChangeH1 !== null && priceChangeH1 > 200) {
    score -= 1;
    reasons.push({ label: `+${priceChangeH1.toFixed(0)}% in the last hour — you may be the exit liquidity`, good: false });
  }

  if (creatorBuys > 3) {
    score += 1;
    reasons.push({ label: `Creator bought their own token ${creatorBuys}× — skin in the game (or wash)`, good: true });
  }

  score = Math.max(1, Math.min(10, score));
  const verdict =
    score <= 3 ? "Degenerate gamble — only money you can burn." :
    score <= 5 ? "Lotto ticket — $5 won't ruin you, but expect zero." :
    score <= 7 ? "Reasonable degen play — sized right, eyes open." :
    "Unusually clean for a meme — still not financial advice.";
  return { score, reasons, verdict };
}

// ---------- orchestrator ----------

export async function scanToken(mint: string): Promise<TokenScan> {
  const warnings: string[] = [];
  const found = await findCreator(mint);
  const [solBalance, tokenBalance] = await Promise.all([
    getSolBalance(found.address),
    getTokenBalance(found.address, mint),
  ]);
  const creator: CreatorInfo = { address: found.address, source: found.source, solBalance, tokenBalance };

  let creatorBuys: CreatorBuy[] = [];
  try {
    creatorBuys = await getCreatorBuys(found.address, mint);
  } catch { warnings.push("Could not load creator buys."); }

  const { market, poolCreatedAtMs } = await getMarket(mint);
  const poolCreatedAt = poolCreatedAtMs ? new Date(poolCreatedAtMs).toISOString() : null;

  let earlyBuyers: EarlyBuyer[] = [];
  try {
    earlyBuyers = await getEarlyBuyers(mint, poolCreatedAtMs);
    earlyBuyers = await linkEarlyBuyers(earlyBuyers, found.address);
    if (!earlyBuyers.length && poolCreatedAtMs && Date.now() - poolCreatedAtMs > 2 * 24 * 3_600_000) {
      warnings.push("Pool is older than 2 days — first-hour wallets are no longer in RPC paging range.");
    }
  } catch { warnings.push("Could not load first-hour buyers."); }

  const creatorSharePct =
    tokenBalance !== null && found.supply ? (tokenBalance / found.supply) * 100 : null;
  const poolAgeHours = poolCreatedAtMs ? (Date.now() - poolCreatedAtMs) / 3_600_000 : null;
  const sanity = scoreSanity({
    liquidityUsd: market.liquidityUsd,
    creatorSharePct,
    linkedEarlyCount: earlyBuyers.filter((b) => b.linkedToCreator).length,
    earlyCount: earlyBuyers.length,
    poolAgeHours,
    priceChangeH1: market.priceChangeH1,
    creatorBuys: creatorBuys.filter((b) => b.side === "buy").length,
  });

  return {
    mint,
    name: found.name,
    symbol: found.symbol,
    decimals: found.decimals,
    supply: found.supply,
    creator,
    creatorBuys,
    earlyBuyers,
    poolCreatedAt,
    market,
    sanity,
    warnings,
  };
}

export { PUMP_PROGRAM, PUMPSWAP_PROGRAM };
