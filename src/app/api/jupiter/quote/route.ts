import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { inputMint, outputMint, amount, slippageBps } = await request.json();

    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get quote from Jupiter");
    }

    const quoteResponse = await response.json();
    return NextResponse.json(quoteResponse);
  } catch (error) {
    console.error("Error in quote route:", error);
    return NextResponse.json({ error: "Failed to get quote" }, { status: 500 });
  }
} 