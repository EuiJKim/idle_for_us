# ⚔️ 우리끼리 키우기

친구 5명이서 같이 하는 방치형 RPG. 웹앱(PWA)이라 **안드로이드와 아이폰 모두** 홈 화면에 추가해서 앱처럼 쓸 수 있다.

**▶ 플레이: https://euijkim.github.io/idle_for_us/**

## 폰에 설치하기

- **아이폰:** 사파리로 링크 열기 → 아래 공유 버튼 → **홈 화면에 추가**
- **안드로이드:** 크롬으로 링크 열기 → 오른쪽 위 ⋮ → **홈 화면에 추가** (또는 **앱 설치**)

홈 화면 아이콘으로 열면 주소창 없이 전체화면으로 열리고, 새 버전은 다시 열 때 자동으로 반영된다.

## 게임 구성

| 시스템 | 내용 |
|---|---|
| 자동 전투 | 스테이지마다 몬스터 10마리 → 보스(30초 제한). 보스에게 지면 그 스테이지에서 골드를 모으다가 "보스 도전" |
| 강화 | 골드로 공격력·체력·치명타 확률/피해·공격 속도·골드 획득 강화 (x1 / x10 / MAX) |
| 장비 | 다이아로 뽑기 (일반~신화 6등급). 같은 등급 4개 → 상위 1개 합성. 가장 좋은 장비 자동 장착 + 보유 효과 |
| 스킬 | 회전베기·광폭화·치유의 빛·천둥. 스테이지를 깨면 해금, 자동 사용 |
| 방치 보상 | 앱을 꺼 둔 동안 골드가 쌓인다 (최대 12시간) |
| 랭킹 | 친구들 전투력 순위. 이름을 누르면 캐릭터(장비·스킬) 구경 |
| 길드 | 코드로 가입(최대 10명), 출석·기부로 길드 레벨 → 전원 공격력 버프, 실시간 채팅 |
| 길드 레이드 | 매일 새 보스. 길드원 피해를 합쳐서 잡고, 처치하면 참여한 사람 모두 보상. 하루 3번 도전 |

다이아는 매일 첫 접속 300개, 보스 첫 처치(10스테이지마다 100개), 레이드 보상으로 얻는다.

## 처음 한 번만: Firebase 설정

프로젝트 `idle-69772` ([Firebase 콘솔](https://console.firebase.google.com/project/idle-69772))

1. **Authentication → 로그인 방법 → 익명** 사용 설정
2. **Firestore Database → 데이터베이스 만들기** (위치 `asia-northeast3` 서울, 프로덕션 모드)
3. **Firestore Database → 규칙** 탭에 [`firestore.rules`](firestore.rules) 내용을 그대로 붙여넣고 **게시**

규칙을 게시하지 않으면 랭킹·길드·레이드가 "권한 없음"으로 실패한다. 혼자 하기는 Firebase 없이도 된다.

## 처음 한 번만: GitHub Pages

저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`** → Save.
1~2분 뒤 위 플레이 주소가 열린다.

## 개발

빌드 과정 없는 순수 HTML/JS(ES 모듈)다.

```bash
npx http-server -p 8123 -s -c-1 .     # http://localhost:8123
node tests/sim.mjs 24                  # 밸런스 시뮬레이션 (24시간 쉬지 않고 플레이 시 도달 스테이지)
```

```
js/data.js      수치 테이블 (강화 비용, 몬스터 체력, 장비 효과 …) ← 밸런스는 여기만 고치면 된다
js/game.js      게임 규칙 (DOM 없음, Node에서도 동작)
js/battle.js    전투 화면 캔버스 연출
js/ui.js        하단 탭 화면 (강화·장비·스킬·랭킹·길드)
js/net.js       Firebase (익명 로그인, 프로필, 길드, 채팅, 레이드)
js/main.js      시작, 저장, 게임 루프, 방치 보상, 설정
sw.js           오프라인 캐시 (파일을 바꾸면 CACHE 이름을 올릴 것)
```

### 브라우저 테스트 (Firebase 에뮬레이터)

```bash
npm i firebase-tools firebase@10.12.2           # 다른 폴더에서
firebase emulators:start --only auth,firestore --project idle-69772
FIREBASE_PKG=/path/to/node_modules/firebase node tests/e2e.cjs
```

혼자 하기(전투·강화·뽑기·합성·방치 보상·저장)와 두 명이 같이 하는 흐름(길드 생성·가입·출석·채팅·레이드·보상·랭킹·구경)을 확인한다. `?emu=1`을 붙이면 앱이 에뮬레이터에 연결된다.
