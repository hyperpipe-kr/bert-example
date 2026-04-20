"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface PredictionResult {
  text: string;
  label: string;
  label_id: number;
  score: number;
  pos_score: number;
  neg_score: number;
}

function toPercent(score: number) {
  return `${(score * 100).toFixed(2)}%`;
}

export default function HomePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sentimentVariant = useMemo(() => {
    if (!result) {
      return "default" as const;
    }
    return result.label === "긍정" ? ("positive" as const) : ("negative" as const);
  }, [result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMessage("문장을 입력한 뒤 분석 버튼을 눌러주세요.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/sentiment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data?.message === "string"
            ? data.message
            : "감성분석 중 문제가 발생했습니다.";
        throw new Error(message);
      }

      setResult(data as PredictionResult);
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle>한국어 감성 분석</CardTitle>
          <CardDescription>
            문장을 입력하면 BERT 기반 감성분석 모델 API로 긍정/부정을 예측합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="예) 오늘 하루가 정말 행복했어요."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  "감성 분석하기"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setText("");
                  setResult(null);
                  setErrorMessage(null);
                }}
                disabled={isLoading}
              >
                초기화
              </Button>
            </div>
          </form>

          {errorMessage ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          {result ? (
            <section className="mt-6 space-y-4 rounded-lg border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">분석 결과</h2>
                <Badge variant={sentimentVariant}>{result.label}</Badge>
              </div>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-muted-foreground">신뢰도(score)</dt>
                  <dd className="mt-1 font-medium">{toPercent(result.score)}</dd>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-muted-foreground">긍정 확률(pos_score)</dt>
                  <dd className="mt-1 font-medium">{toPercent(result.pos_score)}</dd>
                </div>
                <div className="rounded-md border bg-background p-3 md:col-span-2">
                  <dt className="text-muted-foreground">부정 확률(neg_score)</dt>
                  <dd className="mt-1 font-medium">{toPercent(result.neg_score)}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
