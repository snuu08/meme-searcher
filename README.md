# Meme Searcher

지금 인터넷에서 어떤 밈이 뜨고 있는지 빠르게 확인하고, 해당 밈이 무엇인지 이해하는 MVP입니다.

국가는 비교가 아니라 필터입니다. 검색은 항상 전체 데이터를 대상으로 합니다.

## 실행 (권장)

API 키는 브라우저에 넣지 않습니다. Node 서버로 실행하세요.

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 파일 만들기

Windows:

```bash
copy .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

3. `.env`에 가진 키만 입력합니다. 비워 두면 Demo 데이터로 화면이 유지됩니다.

```
YOUTUBE_API_KEY=
X_BEARER_TOKEN=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_IG_USER_ID=
CACHE_MINUTES=1440
```

개발 중 매번 새로 받으려면 `CACHE_MINUTES=0`.

4. 서버 시작

```bash
npm start
```

5. 브라우저에서 연다.

```
http://127.0.0.1:3000
```

Live Server만 켜면 `/api/trends`가 없어서 Demo 데이터로 떨어집니다. API 시크릿이 브라우저에 노출되는 구조는 아닙니다.

## 사용 흐름

1. 사이트 접속 → 전체 밈 확인
2. 4열 Grid에서 탐색
3. 국가 / 상태 / 기간 필터 사용
4. 밈 클릭 → 의미 이해
5. TikTok / Instagram / X / YouTube에서 실제 사례 확인

## 검색

검색은 선택한 국가와 관계없이 **이미 수집된 전체 데이터**를 대상으로 합니다. 검색을 실행하면 국가 필터는 자동으로 **전체**로 바뀝니다. 입력마다 외부 API를 다시 치지 않습니다.

## 기술

프론트는 Vanilla HTML, CSS, JavaScript입니다. 공식 API 수집과 Trend Score 계산은 Node.js 서버에서만 합니다.
