import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { quoteResponse, userPublicKey } = await request.json();

    const response = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get swap transaction from Jupiter");
    }

    const swapResponse = await response.json();
    return NextResponse.json(swapResponse);
  } catch (error) {
    console.error("Error in swap route:", error);
    return NextResponse.json({ error: "Failed to create swap transaction" }, { status: 500 });
  }
} 