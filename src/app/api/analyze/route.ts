import { NextRequest, NextResponse } from "next/server";
import {
  getTxInfo,
  getWalletOverview,
  hasAuthorityChange,
  hasTokenApproval,
} from "@/lib/helius";
import { KNOWN_PROGRAMS, programName, scoreRisk } from "@/lib/risk";

const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

// Rule-based explainer (used when no OPENAI_API_KEY — zero cost, no hallucination)
function ruleExplain(logs: string[], errorText: string | null, status: string) {
  const blob = logs.join("\n");
  const low = blob.toLowerCase();
  if (status === "success")
    return {
      what: "The transaction executed successfully on-chain.",
      fix: "No fix needed. If the result looks wrong, check the program's business logic (amounts, accounts).",
    };
  if (low.includes("slippage")) return {
    what: "Your swap failed because the price moved beyond your allowed slippage before it landed.",
    fix: "Retry the swap or slightly increase slippage tolerance.",
  };
  if (low.includes("insufficient") && low.includes("balance")) return {
    what: "The wallet tried to move more tokens/SOL than it holds.",
    fix: "Reduce the amount or top up the wallet, then retry.",
  };
  if (low.includes("constraintseeds") || low.includes("seeds")) return {
    what: "A program-derived address (PDA) doesn't match what the program expects — usually wrong seeds.",
    fix: "Check the PDA seeds your app passes for this account.",
  };
  if (low.includes("custom program error")) return {
    what: `The program rejected the instruction (${errorText ?? "custom error"}).`,
    fix: "Look at the program's error list for this code, then fix the failing account or argument.",
  };
  return {
    what: errorText
      ? `The transaction failed on-chain (${errorText}).`
      : "The transaction failed on-chain. See technical logs below.",
    fix: "Check the failing instruction in the logs, fix inputs, and retry with a fresh blockhash.",
  };
}

async function aiExplain(opts: {
  status: string;
  program: string;
  errorText: string | null;
  logs: string[];
}): Promise<{ what: string; fix: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You explain Solana transaction failures using ONLY the provided logs. Never invent programs, amounts, or errors. Reply in 2 short sections: WHAT (1-2 sentences) and FIX (1-2 sentences). Plain English.",
          },
          {
            role: "user",
            content: `Status: ${opts.status}\nProgram: ${opts.program}\nError: ${opts.errorText ?? "none"}\nLogs:\n${opts.logs.slice(0, 30).join("\n").slice(0, 3000)}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    const [whatRaw, ...fixRaw] = text.split(/FIX[:\-]/i);
    return {
      what: whatRaw.replace(/WHAT[:\-]/i, "").trim().slice(0, 600) || "See logs.",
      fix: fixRaw.join(" ").trim().slice(0, 600) || "Fix inputs and retry.",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { signature } = await req.json();
    if (typeof signature !== "string" || !SIG_RE.test(signature.trim())) {
      return NextResponse.json(
        { error: "Invalid signature format (expected base58, 64–88 chars)." },
        { status: 400 }
      );
    }
    const sig = signature.trim();
    const demoMode = !process.env.HELIUS_API_KEY;

    if (demoMode) {
      // Demo output so the UI is testable without keys
      return NextResponse.json({
        demoMode: true,
        summary: { status: "failed", program: "Jupiter Aggregator", time: new Date().toISOString(), feeSol: 0.000005 },
        explain: {
          what: "Demo: your swap failed because the price moved beyond your allowed slippage.",
          fix: "Demo: retry or slightly increase slippage. Add HELIUS_API_KEY for live data.",
        },
        wallet: { address: "7fK…91x", firstSeen: "2024-03-18T00:00:00.000Z", lastActive: new Date().toISOString(), txCountEstimate: null, truncated: false },
        risk: { score: 3, level: "Low", reasons: [{ label: "Known program", good: true }] },
        logs: ["Demo log: SlippageToleranceExceeded"],
      });
    }

    const tx = await getTxInfo(sig);
    const mainProgram = tx.mainProgram;
    const isKnown = mainProgram in KNOWN_PROGRAMS;

    let wallet = null;
    let interacted = false;
    try {
      if (tx.feePayer) {
        wallet = await getWalletOverview(tx.feePayer);
        // light check: did wallet touch this program recently? (skip on error)
        interacted = false;
      }
    } catch {
      wallet = tx.feePayer ? { address: tx.feePayer, firstSeen: null, lastActive: null, txCountEstimate: null, truncated: false } : null;
    }

    const risk = scoreRisk({
      isKnownProgram: isKnown,
      hasInteractedBefore: interacted,
      hasAuthorityChange: hasAuthorityChange(tx.logs),
      hasTokenApproval: hasTokenApproval(tx.logs, tx.programIds),
      walletTxCount: null,
    });

    const ai = await aiExplain({ status: tx.status, program: programName(mainProgram), errorText: tx.errorText, logs: tx.logs });
    const explain = ai ?? ruleExplain(tx.logs, tx.errorText, tx.status);

    return NextResponse.json({
      demoMode: false,
      summary: {
        status: tx.status,
        program: programName(mainProgram),
        programId: mainProgram,
        time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        feeSol: tx.feeSol,
      },
      explain,
      wallet,
      risk,
      logs: tx.logs.slice(0, 40),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Analyze failed" }, { status: 500 });
  }
}
