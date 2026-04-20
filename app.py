from contextlib import asynccontextmanager
from typing import List

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------
MODEL_DIR = "./model"
MAX_LEN   = 128
LABELS    = {0: "부정", 1: "긍정"}

# ---------------------------------------------------------------------------
# 모델 싱글턴 (앱 시작 시 1회 로드)
# ---------------------------------------------------------------------------
_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
    model.to(device).eval()

    _state["tokenizer"] = tokenizer
    _state["model"]     = model
    _state["device"]    = device
    print(f"모델 로드 완료 (device={device})")

    yield

    _state.clear()


app = FastAPI(
    title="감성 분석 API",
    description="klue/bert-base 파인튜닝 모델로 한국어 텍스트의 감성(긍정/부정)을 분류합니다.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# 스키마
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text는 빈 문자열일 수 없습니다.")
        return v


class PredictResponse(BaseModel):
    text:        str
    label:       str        # "긍정" | "부정"
    label_id:    int        # 1 | 0
    score:       float      # 해당 레이블의 확률
    pos_score:   float      # 긍정 확률
    neg_score:   float      # 부정 확률


class BatchPredictRequest(BaseModel):
    texts: List[str]

    @field_validator("texts")
    @classmethod
    def texts_not_empty(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("texts 배열이 비어 있습니다.")
        if len(v) > 64:
            raise ValueError("한 번에 최대 64개까지 처리할 수 있습니다.")
        return v


class BatchPredictResponse(BaseModel):
    results: List[PredictResponse]


# ---------------------------------------------------------------------------
# 추론 헬퍼
# ---------------------------------------------------------------------------
def _infer(texts: List[str]) -> List[PredictResponse]:
    tokenizer = _state["tokenizer"]
    model     = _state["model"]
    device    = _state["device"]

    encoding = tokenizer(
        texts,
        max_length=MAX_LEN,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    encoding = {k: v.to(device) for k, v in encoding.items()}

    with torch.no_grad():
        logits = model(**encoding).logits

    probs = torch.softmax(logits, dim=-1).cpu()

    results = []
    for text, prob in zip(texts, probs):
        label_id  = int(prob.argmax())
        results.append(
            PredictResponse(
                text=text,
                label=LABELS[label_id],
                label_id=label_id,
                score=round(prob[label_id].item(), 4),
                pos_score=round(prob[1].item(), 4),
                neg_score=round(prob[0].item(), 4),
            )
        )
    return results


# ---------------------------------------------------------------------------
# 엔드포인트
# ---------------------------------------------------------------------------
@app.get("/health", tags=["상태 확인"])
def health():
    """서버 및 모델 로드 상태를 반환합니다."""
    return {"status": "ok", "model": MODEL_DIR, "device": str(_state.get("device", "unloaded"))}


@app.post("/predict", response_model=PredictResponse, tags=["감성 분석"])
def predict(req: PredictRequest):
    """단일 텍스트의 감성을 분석합니다."""
    try:
        return _infer([req.text])[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch", response_model=BatchPredictResponse, tags=["감성 분석"])
def predict_batch(req: BatchPredictRequest):
    """여러 텍스트를 한 번에 분석합니다 (최대 64개)."""
    try:
        return BatchPredictResponse(results=_infer(req.texts))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
