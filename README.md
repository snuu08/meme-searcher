# Meme Searcher

YouTube, TikTok, Instagram 공식 API를 사용해 지금 어떤 밈이 뜨고 있는지 빠르게 확인하고 검색하는 MVP입니다.

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
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_RESEARCH_ENABLED=false
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_IG_USER_ID=
META_GRAPH_VERSION=v23.0
CACHE_MINUTES=60
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
5. TikTok / Instagram / YouTube에서 실제 사례 확인

## 검색

검색을 실행하면 국가 필터가 **전체**로 바뀌고, 검색어를 YouTube·TikTok·Instagram 수집기에 전달합니다. 같은 검색은 캐시 시간 동안 API를 다시 호출하지 않습니다.

## API별 현실적인 범위

- YouTube Data API: 지역별 인기 영상과 최근 키워드 검색을 사용합니다.
- Instagram Graph API: 프로페셔널 계정과 필요한 권한으로 해시태그의 최근 미디어를 조회합니다.
- TikTok Research API: 승인된 연구자만 공개 영상 검색을 사용할 수 있습니다. 승인된 경우에만 `TIKTOK_RESEARCH_ENABLED=true`로 설정합니다. 일반 TikTok 개발자 앱의 Client Key/Secret만으로는 동작하지 않습니다.

API 키가 하나도 없을 때만 Demo 데이터가 표시됩니다. 키가 설정됐지만 수집 결과가 없으면 Demo로 위장하지 않고 빈 결과와 경고를 반환합니다.

## 기술

프론트는 Vanilla HTML, CSS, JavaScript입니다. 공식 API 수집과 Trend Score 계산은 Node.js 서버에서만 합니다.
