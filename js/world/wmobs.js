// 지역마다 몹 아홉 (v117) — 구역 1·2·3이 셋씩 나눠 갖고, 두목 구역에는 아홉이 다 나온다.
// 옛 지역 몹 넷(data.js ZONES[z].mobs)에 다섯을 더했다: 사람 둘·셋에 들짐승 둘·셋.
// 들짐승은 creatures.js 그림으로 그린다(beast = 그림 이름, bscale = 몹 자리에서의 크기).
// 십이지왕 지역은 옛 지역 그림을 빌리지만 몹은 왕마다 따로 여섯 — 왕의 문도와 그 땅의 짐승.
import { ZONES } from '../data.js';

const P = (name, look) => ({ name, look });
const B = (name, beast, bscale = 1.7) => ({ name, beast, bscale });

// 보통 지역에 더하는 다섯 — [구역1 하나, 구역2 둘, 구역3 둘]
const ADD = {
  1: [ // 죽림
    B('대숲 늑대', 'wolf'),
    B('죽림 판다', 'panda', 1.5), P('죽창수', { robe: '#4d7c0f', head: 'hat', weapon: 'spear' }),
    B('대나무 독사', 'snake', 1.6), P('죽림 은자', { robe: '#d9f99d', trim: '#365314', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'sword' }),
  ],
  2: [ // 황사 서역
    B('모래 승냥이', 'jackal'),
    B('사막 전갈', 'scorpion', 1.6), P('서역 주술사', { robe: '#b45309', trim: '#fde68a', head: 'hood', weapon: 'fan', eyes: '#fbbf24' }),
    B('사막 독수리', 'eagle', 1.5), P('낙타 기수', { robe: '#9a3412', trim: '#fef3c7', head: 'band', band: '#fef3c7', weapon: 'saber', beard: true, scale: 1.1 }),
  ],
  3: [ // 천산 설원
    B('설원 늑대', 'swolf'),
    B('설산 백곰', 'sbear', 1.5), P('설산 사냥꾼', { robe: '#a8a29e', trim: '#f8fafc', head: 'hat', weapon: 'spear', beard: true }),
    B('얼음 뱀', 'isnake', 1.6), P('빙궁 검녀', { robe: '#e0f2fe', trim: '#0369a1', head: 'topknot', weapon: 'sword', aura: '#bae6fd' }),
  ],
  4: [ // 혈사곡
    B('혈랑', 'rwolf'),
    B('핏빛 박쥐', 'vbat', 2.3), P('혈교 사도', { robe: '#7f1d1d', trim: '#fca5a5', head: 'hood', weapon: 'dagger', eyes: '#ef4444' }),
    B('혈사', 'rsnake', 1.6), P('혈마 수라', { robe: '#450a0a', trim: '#dc2626', head: 'bald', weapon: 'axe', scale: 1.15, eyes: '#ef4444' }),
  ],
  5: [ // 귀곡
    B('무덤 까마귀', 'crow', 1.9),
    P('떠도는 원혼', { robe: '#cbd5e1', head: 'hood', weapon: 'claw', ghost: true }), B('귀곡 박쥐', 'bat', 2.3),
    P('백골 강시', { robe: '#e7e5e4', trim: '#78716c', head: 'jiangshi', skin: '#d6d3d1', weapon: 'claw', jiangshi: true }), B('귀화 늑대', 'fwolf'),
  ],
  6: [ // 무당 운해
    B('운해 백학', 'wcrane', 1.5),
    P('운해 선동', { robe: '#e2e8f0', trim: '#1e3a8a', head: 'topknot', hair: '#111', weapon: 'fan' }), B('운해 사슴', 'sdeer', 1.5),
    P('태극 검수', { robe: '#0f172a', trim: '#f8fafc', head: 'topknot', weapon: 'sword', beard: true }), B('구름 원숭이', 'sape', 1.6),
  ],
  7: [ // 십만대산 마교
    B('마교 흑랑', 'bwolf'),
    P('마교 혈위', { robe: '#1c1917', trim: '#b91c1c', head: 'mask', weapon: 'saber' }), B('흑표', 'btiger', 1.45),
    P('천마신교 장로', { robe: '#18181b', trim: '#dc2626', head: 'topknot', hair: '#9ca3af', beard: true, weapon: 'claw', aura: '#7f1d1d' }), B('마교 독거미', 'spider', 1.6),
  ],
  8: [ // 장강 수로
    B('장강 물뱀', 'eel', 1.5),
    P('수적 쾌선수', { robe: '#0c4a6e', head: 'band', band: '#38bdf8', weapon: 'dagger' }), B('강가 게', 'crab', 1.6),
    P('작살잡이', { robe: '#164e63', trim: '#a5f3fc', head: 'hat', weapon: 'spear', beard: true, scale: 1.1 }), B('물수리', 'eagle', 1.5),
  ],
  9: [ // 소림 사원
    B('산문 멧돼지', 'boar', 1.5),
    P('나한 무승', { robe: '#ea580c', trim: '#fde68a', head: 'bald', weapon: 'fist', scale: 1.1 }), B('숭산 범', 'mtiger', 1.45),
    P('계율원 승병', { robe: '#78350f', trim: '#fbbf24', head: 'bald', weapon: 'spear' }), B('숭산 곰', 'bear', 1.5),
  ],
  10: [ // 낙양 야시장
    B('도둑고양이 떼', 'leopard', 1.2),
    P('야시장 소매치기', { robe: '#292524', head: 'hood', weapon: 'dagger' }), B('들개', 'wolf', 1.5),
    P('흑도 해결사', { robe: '#1c1917', trim: '#f59e0b', head: 'band', band: '#f59e0b', weapon: 'saber', beard: true }), P('기루 자객', { robe: '#be185d', trim: '#fbcfe8', head: 'topknot', weapon: 'fan' }),
  ],
  11: [ // 화산 절벽
    B('절벽 수리', 'eagle', 1.6),
    P('화산 검수', { robe: '#fff1f2', trim: '#be123c', head: 'topknot', weapon: 'sword' }), B('바위 곰', 'bear', 1.55),
    P('매화 검녀', { robe: '#fecdd3', trim: '#e11d48', head: 'topknot', weapon: 'sword', aura: '#fda4af' }), B('화산 표범', 'leopard', 1.45),
  ],
  12: [ // 남만 독림
    B('독림 구렁이', 'python', 1.5),
    P('남만 주술사', { robe: '#365314', trim: '#facc15', head: 'hood', weapon: 'fan', eyes: '#a3e635' }), B('독거미', 'pspider', 1.7),
    P('오독 문도', { robe: '#14532d', trim: '#86efac', head: 'mask', weapon: 'claw' }), B('밀림 원숭이', 'ape', 1.6),
  ],
  13: [ // 고묘 지하
    B('지하 박쥐', 'bat', 2.3),
    P('묘지기', { robe: '#1f2937', trim: '#a3e635', head: 'hood', weapon: 'axe', beard: true }), B('고묘 독거미', 'spider', 1.8),
    P('고묘 망령', { robe: '#d9f99d', head: 'topknot', hair: '#ecfccb', weapon: 'sword', ghost: true }), B('검은 전갈', 'bscorp', 1.7),
  ],
  14: [ // 동해 해안
    B('갈매기 떼', 'gull', 1.9),
    P('왜구 낭인', { robe: '#1e293b', trim: '#e2e8f0', head: 'band', band: '#e2e8f0', weapon: 'saber' }), B('바닷게', 'crab', 1.8),
    P('해룡문 무사', { robe: '#0e7490', trim: '#67e8f9', head: 'topknot', weapon: 'spear', aura: '#22d3ee' }), B('바다뱀', 'eel', 1.7),
  ],
  15: [ // 천외천
    B('천상 백학', 'wcrane', 1.6),
    P('천외 선인', { robe: '#eef2ff', trim: '#6366f1', head: 'topknot', hair: '#ffffff', beard: true, weapon: 'fan', aura: '#c7d2fe' }), B('천호', 'sape', 1.7),
    P('성좌 검객', { robe: '#312e81', trim: '#fde68a', head: 'topknot', weapon: 'sword', aura: '#a5b4fc' }), B('하늘 늑대', 'fwolf', 1.8),
  ],
};

// 십이지왕 — 지역 번호 16(권왕) … 27(검왕). 왕마다 여섯 [구역1 둘, 구역2 둘, 구역3 둘].
const KING_MOBS = {
  16: [ // 제12왕 권왕 — 유혼권
    P('유혼 권사', { robe: '#1c1917', trim: '#ef4444', head: 'band', band: '#7f1d1d', weapon: 'fist' }), B('권귀 원숭이', 'ape', 1.8),
    P('철권 수라', { robe: '#450a0a', trim: '#f87171', head: 'bald', weapon: 'fist', scale: 1.2, aura: '#ef4444' }), B('흑곰', 'bear', 1.7),
    P('유혼귀', { robe: '#fecaca', head: 'band', band: '#7f1d1d', weapon: 'fist', ghost: true }), P('혈권 호법', { robe: '#7f1d1d', trim: '#fde68a', head: 'band', band: '#111', weapon: 'fist', beard: true, scale: 1.2 }),
  ],
  17: [ // 제11왕 철왕 — 기관
    P('기관 목인', { robe: '#57534e', trim: '#a8a29e', head: 'mask', weapon: 'axe', scale: 1.15 }), B('기관 거미', 'ispider', 1.8),
    P('철갑 병사', { robe: '#374151', trim: '#9ca3af', head: 'mask', weapon: 'spear' }), B('강철 곰', 'ibear', 1.7),
    P('노궁 기관사', { robe: '#1f2937', trim: '#f59e0b', head: 'hat', weapon: 'spear', beard: true }), P('철갑 수호신', { robe: '#4b5563', trim: '#e5e7eb', head: 'mask', weapon: 'axe', scale: 1.35, eyes: '#f97316' }),
  ],
  18: [ // 제10왕 음왕 — 귀혼음
    P('귀혼 악사', { robe: '#312e81', trim: '#a5b4fc', head: 'hat', weapon: 'fan' }), B('소리 까마귀', 'crow', 2.0),
    P('비파 여귀', { robe: '#c7d2fe', head: 'topknot', hair: '#111', weapon: 'fan', ghost: true }), B('음파 박쥐', 'bat', 2.4),
    P('음공 제자', { robe: '#1e1b4b', trim: '#818cf8', head: 'topknot', weapon: 'fan' }), P('혼령 고수', { robe: '#4338ca', trim: '#e0e7ff', head: 'band', band: '#e0e7ff', weapon: 'fist', aura: '#818cf8', scale: 1.2 }),
  ],
  19: [ // 제9왕 혈왕 — 혈해
    B('혈왕의 혈랑', 'rwolf', 1.8), P('혈해 사도', { robe: '#7f1d1d', trim: '#fecaca', head: 'hood', weapon: 'claw', eyes: '#ef4444' }),
    B('흡혈 박쥐', 'vbat', 2.4), P('혈강시', { robe: '#450a0a', trim: '#dc2626', head: 'jiangshi', skin: '#a8a29e', weapon: 'claw', jiangshi: true }),
    B('핏빛 구렁이', 'rsnake', 1.9), P('혈의 무사', { robe: '#991b1b', trim: '#fde68a', head: 'topknot', weapon: 'saber', aura: '#dc2626', scale: 1.2 }),
  ],
  20: [ // 제8왕 목왕 — 목형천혼
    P('목인 위사', { robe: '#14532d', trim: '#a3e635', head: 'mask', weapon: 'spear', scale: 1.15 }), B('숲 사슴', 'sdeer', 1.6),
    P('덩굴 요괴', { robe: '#166534', trim: '#4ade80', head: 'hood', weapon: 'claw', eyes: '#bef264' }), B('숲 곰', 'bear', 1.7),
    P('수목 정령', { robe: '#bbf7d0', head: 'topknot', hair: '#86efac', weapon: 'fan', ghost: true }), B('초록 독사', 'snake', 1.9),
  ],
  21: [ // 제7왕 화왕 — 천녀야우
    P('화선 무희', { robe: '#fbcfe8', trim: '#db2777', head: 'topknot', weapon: 'fan' }), B('꽃사슴', 'ldeer', 1.6),
    P('야우 검녀', { robe: '#be185d', trim: '#fce7f3', head: 'topknot', weapon: 'sword', aura: '#f9a8d4' }), B('홍학', 'wcrane', 1.6),
    P('화접 요녀', { robe: '#f472b6', trim: '#fdf2f8', head: 'hood', weapon: 'fan', eyes: '#f0abfc' }), P('홍매 자객', { robe: '#831843', trim: '#fda4af', head: 'mask', weapon: 'dagger' }),
  ],
  22: [ // 제6왕 암왕 — 암천야신
    P('암야 자객', { robe: '#0a0a0a', trim: '#6b21a8', head: 'mask', weapon: 'dagger' }), B('그림자 늑대', 'bwolf', 1.8),
    P('암영귀', { robe: '#3b0764', head: 'hood', weapon: 'claw', ghost: true, eyes: '#c084fc' }), B('야행 까마귀', 'crow', 2.1),
    B('흑표', 'btiger', 1.6), P('야행 살수', { robe: '#18181b', trim: '#a855f7', head: 'hood', weapon: 'dagger', aura: '#7c3aed' }),
  ],
  23: [ // 제5왕 환왕 — 환영
    P('환영 분신', { robe: '#4c1d95', trim: '#c4b5fd', head: 'mask', weapon: 'fan', ghost: true }), B('환술 여우', 'fox', 1.8),
    P('환술사', { robe: '#5b21b6', trim: '#ddd6fe', head: 'hat', weapon: 'fan', beard: true }), B('환영 학', 'wcrane', 1.6),
    P('거울 요녀', { robe: '#ede9fe', trim: '#7c3aed', head: 'topknot', weapon: 'fan', aura: '#c4b5fd' }), P('신기루 검객', { robe: '#a78bfa', head: 'topknot', weapon: 'sword', ghost: true }),
  ],
  24: [ // 제4왕 살왕 — 명부
    P('저승 차사', { robe: '#0a0a0a', trim: '#e5e7eb', head: 'hat', weapon: 'saber' }), B('명부 까마귀', 'crow', 2.1),
    P('백골 병사', { robe: '#e7e5e4', trim: '#57534e', head: 'jiangshi', skin: '#e7e5e4', weapon: 'spear', jiangshi: true }), B('귀화 늑대', 'fwolf', 1.8),
    P('우두 옥졸', { robe: '#7c2d12', trim: '#111', head: 'bald', weapon: 'axe', scale: 1.35, eyes: '#ef4444' }), P('명부 사자', { robe: '#18181b', trim: '#991b1b', head: 'mask', weapon: 'dagger', aura: '#991b1b' }),
  ],
  25: [ // 제3왕 투왕 — 투신
    P('투신 문도', { robe: '#78350f', trim: '#fbbf24', head: 'bald', weapon: 'fist' }), B('맹호', 'mtiger', 1.7),
    P('쌍도 투사', { robe: '#92400e', trim: '#fde68a', head: 'band', band: '#b91c1c', weapon: 'saber', beard: true }), B('철곰', 'ibear', 1.8),
    P('투귀', { robe: '#451a03', trim: '#f59e0b', head: 'bald', weapon: 'fist', aura: '#f59e0b', scale: 1.2 }), P('거구 장사', { robe: '#57534e', trim: '#fbbf24', head: 'band', band: '#111', weapon: 'axe', beard: true, scale: 1.4 }),
  ],
  26: [ // 제2왕 도왕 — 일월암혈
    P('일월 도객', { robe: '#1e293b', trim: '#f8fafc', head: 'band', band: '#111', weapon: 'saber' }), B('그믐 늑대', 'swolf', 1.8),
    P('혈월 도수', { robe: '#7f1d1d', trim: '#fecaca', head: 'topknot', weapon: 'saber', aura: '#fca5a5' }), B('월야 박쥐', 'vbat', 2.4),
    P('흑월 자객', { robe: '#0f172a', trim: '#94a3b8', head: 'mask', weapon: 'saber' }), P('도마', { robe: '#18181b', trim: '#ef4444', head: 'band', band: '#ef4444', weapon: 'saber', scale: 1.3, eyes: '#ef4444' }),
  ],
  27: [ // 제1왕 검왕 — 무형신검
    P('무형 검귀', { robe: '#f8fafc', head: 'topknot', hair: '#f1f5f9', weapon: 'sword', ghost: true }), B('검왕의 백학', 'wcrane', 1.8),
    P('검노', { robe: '#e5e7eb', trim: '#fbbf24', head: 'topknot', hair: '#e5e7eb', beard: true, weapon: 'sword' }), B('천검 백호', 'tiger', 1.9),
    P('비검 수호', { robe: '#fffbeb', trim: '#f59e0b', head: 'topknot', weapon: 'sword', aura: '#fde68a', scale: 1.2 }), P('천검 문도', { robe: '#1e293b', trim: '#fde68a', head: 'topknot', weapon: 'sword' }),
  ],
};

// 구역의 몹 목록. a: 1·2·3 = 들판 구역, 4 = 두목 구역(전부)
export function areaMobs(z, a, art) {
  const k = KING_MOBS[z];
  if (k) {
    if (a >= 4) return k;
    return [k[(a - 1) * 2], k[(a - 1) * 2 + 1], k[(a * 2) % 6]];
  }
  const old = ZONES[art ?? z]?.mobs || [];
  const add = ADD[z] || [];
  const areas = [[old[0], old[1], add[0]], [old[2], add[1], add[2]], [old[3], add[3], add[4]]];
  if (a >= 4) return areas.flat().filter(Boolean);
  return areas[a - 1].filter(Boolean);
}
export const zoneMobCount = (z) => areaMobs(z, 4).length;
