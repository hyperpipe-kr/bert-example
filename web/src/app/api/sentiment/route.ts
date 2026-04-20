import { NextResponse } from "next/server";

const API_BASE_URL = process.env.SENTIMENT_API_URL ?? "http://127.0.0.1:8000";

interface PredictRequest {
  text?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PredictRequest;
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { message: "분석할 문장을 입력해 주세요." },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
    });

    if (!response.ok) {
      const fallbackMessage = "감성분석 API 호출에 실패했습니다.";
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = await response.text();
      }

      return NextResponse.json(
        {
          message: fallbackMessage,
          details,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: "요청 처리 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
