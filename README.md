# BERT를 활용한 한국어 감성분석 API

사전학습된 한국어 BERT 모델(`klue/bert-base`)을 네이버 영화 리뷰 데이터(NSMC)로 파인튜닝하여 한국어 텍스트의 감성(긍정/부정)을 분류하는 FastAPI 서버를 구현합니다.

- 모델: [klue/bert-base](https://huggingface.co/klue/bert-base)
- 데이터: [NSMC (Naver Sentiment Movie Corpus)](https://github.com/e9t/nsmc)
  - 훈련 데이터: 150,000건
  - 테스트 데이터: 50,000건

---

## 프로젝트 구조

```
bert-example/
├── .gitignore                      # Git 무시 파일 목록
├── README.md                       # 프로젝트 문서
├── app.py                          # FastAPI 서버
├── BERT_example.ipynb              # 모델 학습 노트북
├── requirements.txt                # 의존 패키지
├── data/                           # NSMC 데이터셋
│   ├── .gitkeep
│   ├── ratings_train.txt
│   └── ratings_test.txt
├── model/                          # 파인튜닝된 모델 파일
│   ├── .gitkeep
│   ├── config.json
│   ├── model.safetensors
│   ├── tokenizer.json
│   └── tokenizer_config.json
```

---

## 모델 학습

서버 실행 전에 `BERT_example.ipynb` 노트북을 실행하여 모델을 학습하고 저장해야 합니다.

| 항목 | 값 |
|------|----|
| 베이스 모델 | `klue/bert-base` |
| 학습 데이터 | NSMC 훈련셋 (최대 150,000건) |
| 최대 토큰 길이 | 128 |
| 배치 크기 | 32 |
| 에폭 | 3 |
| 학습률 | 2e-5 |
| 예상 정확도 | 약 90~91% (전체 데이터 + GPU 기준) |

---

## 실행 방법

### 1. Python 버전 확인

이 프로젝트는 **Python 3.12 이상**(권장: 3.12.11)에서 실행하는 것을 권장합니다.

```bash
python3 --version
```

### 2. `.venv` 가상환경 생성 및 활성화

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

> 비활성화가 필요할 때는 `deactivate` 명령을 사용하세요.

### 3. 패키지 설치

```bash
pip install -r requirements.txt
```

### 4. 서버 실행

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

서버가 정상 실행되면 아래 주소에서 접근할 수 있습니다.

- API 서버: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## API 명세

### `GET /health` — 서버 상태 확인

```bash
curl http://localhost:8000/health
```

**응답**

```json
{
  "status": "ok",
  "model": "./model",
  "device": "cpu"
}
```

---

### `POST /predict` — 단일 텍스트 감성 분석

**요청**

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "이 영화 정말 재밌었어요!"}'
```

**요청 바디**

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | string | 분석할 텍스트 (필수, 빈 문자열 불가) |

**응답**

```json
{
  "text": "이 영화 정말 재밌었어요!",
  "label": "긍정",
  "label_id": 1,
  "score": 0.9821,
  "pos_score": 0.9821,
  "neg_score": 0.0179
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `label` | string | 예측 레이블 (`"긍정"` / `"부정"`) |
| `label_id` | int | 레이블 ID (`1` = 긍정, `0` = 부정) |
| `score` | float | 예측 레이블의 확률 |
| `pos_score` | float | 긍정 확률 |
| `neg_score` | float | 부정 확률 |

---

### `POST /predict/batch` — 배치 감성 분석

한 번에 최대 **64개** 텍스트를 분석합니다.

**요청**

```bash
curl -X POST http://localhost:8000/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "이 영화 정말 재밌었어요!",
      "시간 낭비였습니다. 별로예요.",
      "그냥 평범한 영화였어요."
    ]
  }'
```

**응답**

```json
{
  "results": [
    {
      "text": "이 영화 정말 재밌었어요!",
      "label": "긍정",
      "label_id": 1,
      "score": 0.9821,
      "pos_score": 0.9821,
      "neg_score": 0.0179
    },
    {
      "text": "시간 낭비였습니다. 별로예요.",
      "label": "부정",
      "label_id": 0,
      "score": 0.9654,
      "pos_score": 0.0346,
      "neg_score": 0.9654
    },
    {
      "text": "그냥 평범한 영화였어요.",
      "label": "부정",
      "label_id": 0,
      "score": 0.6123,
      "pos_score": 0.3877,
      "neg_score": 0.6123
    }
  ]
}
```

---

## 에러 응답

| HTTP 상태 코드 | 원인 |
|---------------|------|
| `422 Unprocessable Entity` | 요청 바디 유효성 검사 실패 (빈 문자열, 배열 초과 등) |
| `500 Internal Server Error` | 모델 추론 중 오류 |