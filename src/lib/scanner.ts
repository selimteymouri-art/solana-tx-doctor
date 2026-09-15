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
  confidence: "direct" | "strong" | "possible" | null;
  solAmount: number | null;
}

export interface TopHolder {
  owner: string; // wallet holding the tokens
  tokenAccount: string; // the token account (ATA)
  amount: number | null; // in token units
  pct: number | null; // % of total supply
  tag: "burn" | "creator" | "linked" | "early" | "unknown";
}

export interface TokenLink { label: string; url: string }

export interface MarketInfo {
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volumeH1: number | null;
  volumeH24: number | null;
  txnsH1: { buys: number; sells: number } | null;
  txnsH24: { buys: number; sells: number } | null;
  priceChangeM5: number | null;
  priceChangeH1: number | null;
  priceChangeH6: number | null;
  priceChangeH24: number | null;
  dex: string | null;
  pairUrl: string | null;
  imageUrl: string | null;
  websites: TokenLink[];
  socials: TokenLink[];
  poolCount: number;
  priceWarning: string | null;
}

export interface ContractInfo {
  mintAuthority: string | null; // null = revoked or unreadable
  freezeAuthority: string | null;
}

export interface NetworkSummary {
  creatorPct: number | null;
  linkedCount: number;
  linkedPct: number | null;
  combinedPct: number | null;
  confidence: "high" | "medium" | "none";
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
  topHolders: TopHolder[];
  contract: ContractInfo;
  network: NetworkSummary;
  poolCreatedAt: string | null;
  scannedAt: string;
  market: MarketInfo;
  sanity: SanityScore;
  warnings: string[];
}

// ---------- helpers ----------

const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78TyFST7nbrrZUaFrrCWAJ";
const PUMPSWAP_PROGRAM = "pAMMBay6oceH9fJKBRHGP5d4bD4sWpmnGjkX45zoG73d6";
const BURN_ADDRESS = "11111111111111111111111111111111";

// Infrastructure addresses that must never count as wallet relationships
// (routers, aggregators, system programs, launchpads).
const INFRA_ADDRESSES = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "MemoSq4gqABAXKb96qn9TysNcWxMyWCqXgDLGmfcHr",
  "ComputeBudget111111111111111111111111111111",
  "TokenzQdBNbLqP5VEhdk8jFLqvq8JvQRq5pAv8EVbwaM",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLU7X5QKFoBiExEa6U",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
  "6EF8rrecthR5Dkzon8Nwu78TyFST7nbrrZUaFrrCWAJ",
  "pAMMBay6oceH9fJKBRHGP5d4bD4sWpmnGjkX45zoG73d6",
  "675kPX9MHTjS2zt1bmwtUo2NTMZBJierd1sA2kF6UEf",
]);

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

async function findCreator(mint: string): Promise<{
  address: string; source: CreatorInfo["source"]; name: string | null; symbol: string | null;
  decimals: number | null; supply: number | null; contract: ContractInfo;
}> {
  let name: string | null = null;
  let symbol: string | null = null;
  let decimals: number | null = null;
  let supply: number | null = null;
  const contract: ContractInfo = { mintAuthority: null, freezeAuthority: null };

  // 1) mint account: mintAuthority is usually the deployer; decimals/supply/authorities too
  try {
    const info = await rpc<any>("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const parsed = info?.value?.data?.parsed?.info;
    if (parsed) {
      decimals = typeof parsed.decimals === "number" ? parsed.decimals : null;
      const rawSupply = typeof parsed.supply === "string" ? Number(parsed.supply) : typeof parsed.supply === "number" ? parsed.supply : NaN;
      supply = Number.isFinite(rawSupply) ? rawSupply / 10 ** (decimals ?? 0) : null;
      contract.mintAuthority = typeof parsed.mintAuthority === "string" ? parsed.mintAuthority : null;
      contract.freezeAuthority = typeof parsed.freezeAuthority === "string" ? parsed.freezeAuthority : null;
      const mintAuth: string | null = parsed.mintAuthority ?? null;
      if (mintAuth) return { address: mintAuth, source: "mintAuthority", name, symbol, decimals, supply, contract };
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
      return { address: verified.address, source: "metaplexCreator", name, symbol, decimals, supply, contract };
    }
  } catch { /* fall through, pump.fun tokens have no metaplex creator */ }

  // 3) fallback: oldest signer on the mint = first funder / deployer.
  const { oldest } = await addressBounds(mint);
  if (oldest?.signature) {
    try {
      const tx: any = await rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
      const payer: string | undefined = tx?.transaction?.message?.accountKeys?.[0]?.pubkey;
      if (payer) return { address: payer, source: "firstFunder", name, symbol, decimals, supply, contract };
    } catch { /* ignore */ }
  }

  // 4) last resort: name/symbol from DexScreener, creator unknown
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: "no-store" });
    const json = await res.json();
    const pair: any = (json?.pairs ?? []).find((p: any) => p?.chainId === "solana");
    if (pair?.baseToken) {
      name = pair.baseToken.name ?? name;
      symbol = pair.baseToken.symbol ?? symbol;
    }
  } catch { /* ignore */ }
  if (name || symbol) {
    return { address: "", source: "unknown", name, symbol, decimals, supply, contract };
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
      if (!payer || payer === mint || INFRA_ADDRESSES.has(payer)) continue;
      const pre = tx?.meta?.preBalances?.[0];
      const post = tx?.meta?.postBalances?.[0];
      const solSpent = typeof pre === "number" && typeof post === "number" ? (pre - post) / 1e9 : null;
      if (solSpent === null || solSpent < 0.001) continue; // not a buy
      buyers.push({
        address: payer,
        time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        linkedToCreator: false,
        linkReason: null,
        confidence: null,
        solAmount: solSpent,
      });
    } catch { /* skip */ }
  }
  return buyers;
}

// ---------- step 4: link check (does early buyer connect to creator?) ----------
// Conservative tiers: direct (same wallet), strong (direct interaction),
// possible (shared counterparties). Infra addresses never count.

async function recentCounterparties(address: string, maxTx = 25): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const sigs: any[] = await rpc("getSignaturesForAddress", [address, { limit: maxTx }]);
    for (const s of sigs.slice(0, maxTx)) {
      try {
        const tx: any = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const keys: string[] = (tx?.transaction?.message?.accountKeys ?? []).map((k: any) => k.pubkey ?? k);
        for (const k of keys.slice(0, 12)) {
          if (k !== address && !INFRA_ADDRESSES.has(k)) set.add(k);
        }
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
      b.confidence = "direct";
      b.linkReason = "Same wallet as creator";
      continue;
    }
    const mine = await recentCounterparties(b.address, 10);
    if (mine.has(creator)) {
      b.linkedToCreator = true;
      b.confidence = "strong";
      b.linkReason = "Direct on-chain interaction with creator";
      continue;
    }
    const shared = [...mine].filter((x) => creatorParties.has(x));
    if (shared.length > 0) {
      b.linkedToCreator = true;
      b.confidence = "possible";
      b.linkReason = `Shares ${shared.length} counterpart${shared.length > 1 ? "ies" : "y"} with creator`;
    }
  }
  return buyers;
}

// ---------- step 5: market (DexScreener, no key needed) ----------

export async function getMarket(mint: string): Promise<{ market: MarketInfo; poolCreatedAtMs: number | null }> {
  const fallback: MarketInfo = {
    priceUsd: null, liquidityUsd: null, marketCap: null, fdv: null,
    volumeH1: null, volumeH24: null, txnsH1: null, txnsH24: null,
    priceChangeM5: null, priceChangeH1: null, priceChangeH6: null, priceChangeH24: null,
    dex: null, pairUrl: null, imageUrl: null, websites: [], socials: [],
    poolCount: 0, priceWarning: null,
  };
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: "no-store" });
    if (!res.ok) return { market: fallback, poolCreatedAtMs: null };
    const json = await res.json();
    const pairs: any[] = (json?.pairs ?? []).filter((p: any) => p?.chainId === "solana");
    if (!pairs.length) return { market: fallback, poolCreatedAtMs: null };
    pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    const best = pairs[0];

    // Cross pool validation: flag when top pools disagree hard on price.
    let priceWarning: string | null = null;
    if (pairs.length > 1) {
      const p1 = Number(best?.priceUsd), p2 = Number(pairs[1]?.priceUsd);
      if (p1 > 0 && p2 > 0) {
        const diff = Math.abs(p1 - p2) / Math.min(p1, p2);
        if (diff > 0.2) {
          priceWarning = `Top pools disagree ${(diff * 100).toFixed(0)}% on price. Primary pool shown.`;
        }
      }
    }

    const info = best?.info ?? {};
    const websites: TokenLink[] = Array.isArray(info.websites)
      ? info.websites.filter((w: any) => w?.url).slice(0, 5).map((w: any) => ({ label: "Website", url: String(w.url) }))
      : [];
    const socials: TokenLink[] = Array.isArray(info.socials)
      ? info.socials.filter((s: any) => s?.url).slice(0, 10).map((s: any) => ({ label: String(s.type ?? s.platform ?? "Link"), url: String(s.url) }))
      : [];
    const t1 = best?.txns?.h1, t24 = best?.txns?.h24;
    return {
      market: {
        priceUsd: best?.priceUsd ? Number(best.priceUsd) : null,
        liquidityUsd: best?.liquidity?.usd ?? null,
        marketCap: best?.marketCap ?? best?.fdv ?? null,
        fdv: best?.fdv ?? null,
        volumeH1: best?.volume?.h1 ?? null,
        volumeH24: best?.volume?.h24 ?? null,
        txnsH1: t1 ? { buys: t1.buys ?? 0, sells: t1.sells ?? 0 } : null,
        txnsH24: t24 ? { buys: t24.buys ?? 0, sells: t24.sells ?? 0 } : null,
        priceChangeM5: best?.priceChange?.m5 ?? null,
        priceChangeH1: best?.priceChange?.h1 ?? null,
        priceChangeH6: best?.priceChange?.h6 ?? null,
        priceChangeH24: best?.priceChange?.h24 ?? null,
        dex: best?.dexId ?? null,
        pairUrl: best?.url ?? null,
        imageUrl: typeof info.imageUrl === "string" ? info.imageUrl : null,
        websites,
        socials,
        poolCount: pairs.length,
        priceWarning,
      },
      poolCreatedAtMs: typeof best?.pairCreatedAt === "number" ? best.pairCreatedAt : null,
    };
  } catch {
    return { market: fallback, poolCreatedAtMs: null };
  }
}

// ---------- top holders (largest token accounts + their owner wallets) ----------

async function getTopHolders(mint: string, supply: number | null, limit = 10): Promise<TopHolder[]> {
  // NOTE: getTokenLargestAccounts fails on giant mints (e.g. wSOL ~10M accounts).
  // DAS getTokenAccounts is the capped fallback, it returns owner + amount directly.
  let largest: { address: string; amount: string; decimals: number; owner?: string }[] = [];
  try {
    const r = await rpc<{ value: { address: string; amount: string; decimals: number }[] }>(
      "getTokenLargestAccounts",
      [mint]
    );
    largest = r.value ?? [];
  } catch {
    const r = await das<{ token_accounts: { address: string; owner?: string; amount: number; decimals?: number }[] }>(
      "getTokenAccounts",
      { mint, limit: 20 }
    ).catch(() => ({ token_accounts: [] as { address: string; owner?: string; amount: number; decimals?: number }[] }));
    largest = (r.token_accounts ?? []).map((t) => ({
      address: t.address,
      amount: String(Math.round(t.amount ?? 0)), // DAS amount is raw base units
      decimals: t.decimals ?? 0,
      owner: t.owner,
    }));
    if (!largest.length) throw new Error("holder list unavailable (giant mint, RPC refused largest-accounts)");
  }
  const out: TopHolder[] = [];
  for (const t of largest.slice(0, limit)) {
    let owner = t.owner ?? t.address;
    if (!t.owner) {
      try {
        const info = await rpc<any>("getAccountInfo", [t.address, { encoding: "jsonParsed" }]);
        const o = info?.value?.data?.parsed?.info?.owner;
        if (typeof o === "string" && o) owner = o;
      } catch { /* keep token-account address */ }
    }
    const raw = Number(t.amount);
    const amount = Number.isFinite(raw) ? raw / 10 ** (typeof t.decimals === "number" ? t.decimals : 0) : null;
    out.push({
      owner,
      tokenAccount: t.address,
      amount,
      pct: amount !== null && supply ? (amount / supply) * 100 : null,
      tag: "unknown",
    });
  }
  return out;
}

// ---------- step 6: sanity score (THE $5 TEST) ----------
// Deterministic rules. Higher = more sensible. Meme-trader mindset baked in:
// position sizing (5% of bankroll), liquidity exit, creator concentration,
// early insider overlap, contract permissions, age of pool.

export function scoreSanity(opts: {
  liquidityUsd: number | null;
  creatorSharePct: number | null; // creator token balance / supply * 100
  top1Pct: number | null; // largest holder % of supply
  linkedEarlyCount: number;
  earlyCount: number;
  poolAgeHours: number | null;
  priceChangeH1: number | null;
  creatorBuys: number;
  contractRisk: boolean; // mint or freeze authority still active
}): SanityScore {
  let score = 5;
  const reasons: SanityScore["reasons"] = [];
  const { liquidityUsd, creatorSharePct, top1Pct, linkedEarlyCount, earlyCount, poolAgeHours, priceChangeH1, creatorBuys, contractRisk } = opts;

  reasons.push({ label: "$5 is 5% of $100. Lotto ticket sizing, survivable if it goes to zero", good: true });

  if (liquidityUsd === null) {
    score -= 2;
    reasons.push({ label: "No liquidity data. You may not be able to sell", good: false });
  } else if (liquidityUsd < 10_000) {
    score -= 3;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()}. Too thin, exit may fail`, good: false });
  } else if (liquidityUsd < 50_000) {
    score -= 1;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()}. Thin, expect slippage`, good: false });
  } else {
    score += 1;
    reasons.push({ label: `Liquidity $${Math.round(liquidityUsd).toLocaleString()}. Enough to exit a $5 position`, good: true });
  }

  if (creatorSharePct !== null) {
    if (creatorSharePct > 20) {
      score -= 2;
      reasons.push({ label: `Creator still holds ~${creatorSharePct.toFixed(1)}%. Dump risk`, good: false });
    } else if (creatorSharePct > 5) {
      score -= 1;
      reasons.push({ label: `Creator holds ~${creatorSharePct.toFixed(1)}%. Watch their sells`, good: false });
    } else {
      score += 1;
      reasons.push({ label: `Creator holds ~${creatorSharePct.toFixed(1)}%. Low dump leverage`, good: true });
    }
  }

  if (top1Pct !== null && top1Pct > 50) {
    score -= 2;
    reasons.push({ label: `Top holder controls ~${top1Pct.toFixed(1)}% of supply. One wallet can nuke it`, good: false });
  } else if (top1Pct !== null && top1Pct > 20) {
    score -= 1;
    reasons.push({ label: `Top holder controls ~${top1Pct.toFixed(1)}% of supply`, good: false });
  }

  if (contractRisk) {
    score -= 1;
    reasons.push({ label: "Mint or freeze authority still active. Supply rules can change", good: false });
  } else {
    reasons.push({ label: "Mint and freeze authorities revoked", good: true });
  }

  if (earlyCount > 0) {
    const ratio = linkedEarlyCount / earlyCount;
    if (ratio >= 0.3) {
      score -= 2;
      reasons.push({ label: `${linkedEarlyCount}/${earlyCount} early buyers link to creator. Insider heavy launch`, good: false });
    } else if (linkedEarlyCount > 0) {
      score -= 1;
      reasons.push({ label: `${linkedEarlyCount}/${earlyCount} early buyers link to creator`, good: false });
    } else {
      score += 1;
      reasons.push({ label: "No early buyer links to creator found. Cleaner launch", good: true });
    }
  }

  if (poolAgeHours !== null) {
    if (poolAgeHours < 1) {
      score -= 1;
      reasons.push({ label: "Pool is minutes old. Maximum chaos phase", good: false });
    } else if (poolAgeHours > 24 * 7) {
      score += 1;
      reasons.push({ label: "Survived over a week. Passed the first rug window", good: true });
    }
  }

  if (priceChangeH1 !== null && priceChangeH1 > 200) {
    score -= 1;
    reasons.push({ label: `+${priceChangeH1.toFixed(0)}% in the last hour. You may be the exit liquidity`, good: false });
  }

  if (creatorBuys > 3) {
    score += 1;
    reasons.push({ label: `Creator bought their own token ${creatorBuys}x. Skin in the game (or wash)`, good: true });
  }

  score = Math.max(1, Math.min(10, score));
  const verdict =
    score <= 3 ? "Degenerate gamble. Only money you can burn." :
    score <= 5 ? "Lotto ticket. $5 will not ruin you, but expect zero." :
    score <= 7 ? "Reasonable degen play. Sized right, eyes open." :
    "Unusually clean for a meme. Still not financial advice.";
  return { score, reasons, verdict };
}

// ---------- orchestrator ----------

export async function scanToken(mint: string): Promise<TokenScan> {
  const warnings: string[] = [];
  const found = await findCreator(mint);
  const creatorKnown = found.address !== "";
  if (!creatorKnown) {
    warnings.push("Creator wallet not determinable (mint authority revoked, history too deep). Creator and insider link sections skipped.");
  }
  const [solBalance, tokenBalance] = creatorKnown
    ? await Promise.all([getSolBalance(found.address), getTokenBalance(found.address, mint)])
    : [null, null];
  const creator: CreatorInfo = { address: found.address, source: found.source, solBalance, tokenBalance };

  let creatorBuys: CreatorBuy[] = [];
  if (creatorKnown) {
    try {
      creatorBuys = await getCreatorBuys(found.address, mint);
    } catch { warnings.push("Could not load creator buys."); }
  }

  const { market, poolCreatedAtMs } = await getMarket(mint);
  const poolCreatedAt = poolCreatedAtMs ? new Date(poolCreatedAtMs).toISOString() : null;

  let topHolders: TopHolder[] = [];
  try {
    topHolders = await getTopHolders(mint, found.supply);
  } catch { warnings.push("Could not load top holders."); }

  let earlyBuyers: EarlyBuyer[] = [];
  try {
    earlyBuyers = await getEarlyBuyers(mint, poolCreatedAtMs);
    if (creatorKnown) earlyBuyers = await linkEarlyBuyers(earlyBuyers, found.address);
    if (!earlyBuyers.length && poolCreatedAtMs && Date.now() - poolCreatedAtMs > 2 * 24 * 3_600_000) {
      warnings.push("Pool is older than 2 days. First hour wallets are no longer in RPC paging range.");
    }
  } catch { warnings.push("Could not load first-hour buyers."); }

  // Tag holders: burn, creator, linked, early, unknown.
  const linkedSet = new Set(earlyBuyers.filter((b) => b.linkedToCreator).map((b) => b.address));
  const earlySet = new Set(earlyBuyers.map((b) => b.address));
  for (const h of topHolders) {
    h.tag =
      h.owner === BURN_ADDRESS ? "burn" :
      creatorKnown && h.owner === found.address ? "creator" :
      linkedSet.has(h.owner) ? "linked" :
      earlySet.has(h.owner) ? "early" : "unknown";
  }

  // Tracked linked holdings: current balances of linked early buyers.
  let linkedSum = 0;
  let linkedCounted = 0;
  for (const b of earlyBuyers.filter((b) => b.linkedToCreator).slice(0, 12)) {
    const bal = await getTokenBalance(b.address, mint);
    if (bal !== null) {
      linkedSum += bal;
      linkedCounted++;
    }
  }

  const creatorSharePct =
    tokenBalance !== null && found.supply ? (tokenBalance / found.supply) * 100 : null;
  const linkedPct = found.supply && linkedCounted > 0 ? (linkedSum / found.supply) * 100 : null;
  const combinedPct =
    creatorSharePct !== null || linkedPct !== null
      ? (creatorSharePct ?? 0) + (linkedPct ?? 0)
      : null;
  const linkedCount = earlyBuyers.filter((b) => b.linkedToCreator).length;
  const network: NetworkSummary = {
    creatorPct: creatorSharePct,
    linkedCount,
    linkedPct,
    combinedPct,
    confidence: linkedCount >= 3 ? "high" : linkedCount >= 1 ? "medium" : "none",
  };

  const poolAgeHours = poolCreatedAtMs ? (Date.now() - poolCreatedAtMs) / 3_600_000 : null;
  const contractRisk = !!(found.contract.mintAuthority || found.contract.freezeAuthority);
  const sanity = scoreSanity({
    liquidityUsd: market.liquidityUsd,
    creatorSharePct,
    top1Pct: topHolders[0]?.pct ?? null,
    linkedEarlyCount: linkedCount,
    earlyCount: earlyBuyers.length,
    poolAgeHours,
    priceChangeH1: market.priceChangeH1,
    creatorBuys: creatorBuys.filter((b) => b.side === "buy").length,
    contractRisk,
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
    topHolders,
    contract: found.contract,
    network,
    poolCreatedAt,
    scannedAt: new Date().toISOString(),
    market,
    sanity,
    warnings,
  };
}

export { PUMP_PROGRAM, PUMPSWAP_PROGRAM };
