#!/usr/bin/env bash
# v436 한꺼번에 점검 — 커밋 전에 이것 하나만 돌린다
#   bash tests/all.sh            : 엔진 · 몽키 봇(짧게) · 브라우저(오프라인) · 화면 훑기
#   EMU=1 bash tests/all.sh      : + 에뮬레이터 온라인(e2e 온라인 · 둘이 함께) — 에뮬레이터를 먼저 켜 둔다
#       firebase emulators:start --only auth,firestore,database --project idle-69772
#       FIREBASE_PKG=<firebase@js/firebase-config.js 와 같은 판>/node_modules/firebase
#   HOURS=24 bash tests/all.sh   : 몽키 봇(엔진)을 길게 · MONKEY_SECS=600 이면 화면 몽키도 길게
#   세이브 하나 재현: node tests/replay.cjs <세이브.json>   (🐞 신고함에서 받은 세이브 · 몽키 봇이 남긴 tests/shots/soak-fail-*.json)
set -u
cd "$(dirname "$0")/.."
PORT=8123
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx --yes http-server -p $PORT -s -c-1 . >/dev/null 2>&1 &
  SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
  for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.25; done
fi
FAIL=()
run() { local name="$1"; shift; echo; echo "━━ $name"; if "$@"; then echo "━━ $name ✓"; else echo "━━ $name ✗"; FAIL+=("$name"); fi; }
run "배선"        node tests/wiring.mjs
run "엔진"        node tests/world.mjs
run "몽키 봇"     env HOURS="${HOURS:-2}" node tests/soak.mjs
run "늦은 세이브 모든 창" env SECS=3 node tests/replay.cjs tests/shots/soak-end-sword-late.json
run "브라우저"    env -u FIREBASE_PKG node tests/e2e.cjs
run "화면 몽키"   env SECS="${MONKEY_SECS:-45}" node tests/monkey.cjs
run "화면 훑기"   node tests/sweep.cjs
run "컴퓨터 화면" node tests/desktop.cjs
if [ "${EMU:-}" = 1 ]; then
  run "온라인(에뮬레이터)" node tests/e2e.cjs
  run "둘이 함께(에뮬레이터)" node tests/online2.cjs
fi
echo
if [ ${#FAIL[@]} -eq 0 ]; then echo "✓ 전부 통과"; else echo "✗ 실패: ${FAIL[*]}"; exit 1; fi
