// 새 시즌 장마다 몹 모습(v501) — 그림만 정한다(강함은 레벨 · 종류(일반/정예/두목)가 정한다).
// art: 'cr:키' = 지금 게임 짐승 그림(art/cr) · 's2:키' = 새로 그린 옆보기 전신(art/s2/mob — 일반 c· · 칸 두목 b·, v502) · 'boss:키' = 지금 게임 두목 그림(art/boss, 정예)
// 장마다 일반 넷(짐승 둘 · 사람/요괴 둘~셋) · 정예 하나 · 칸 두목 하나
export const ROSTER = [
  { mobs: [['원숭이', 'cr:ape'], ['멧돼지', 'cr:boar'], ['죽림 산적', 's2:c1a'], ['삿갓 낭인', 's2:c1b']], elite: ['죽림 검귀', 'boss:zb-12'], boss: ['죽림쌍검', 's2:b1'] },
  { mobs: [['사막 전갈', 'cr:scorpion'], ['자칼', 'cr:jackal'], ['사막 도적', 's2:c2a'], ['서역 주술사', 's2:c2b']], elite: ['사막 도객', 'boss:zb-2'], boss: ['서역 광마', 's2:b2'] },
  { mobs: [['설원 늑대', 'cr:swolf'], ['설인', 'cr:sape'], ['빙궁 검녀', 's2:c3a'], ['빙궁 창위', 's2:c3b']], elite: ['빙궁 장로', 'boss:zb-19'], boss: ['빙궁주', 's2:b3'] },
  { mobs: [['핏빛 늑대', 'cr:rwolf'], ['흡혈 박쥐', 'cr:vbat'], ['혈곡 도끼잡이', 's2:c4a'], ['혈교 자객', 's2:c4b']], elite: ['혈마 검객', 'boss:m-hyeolcheon'], boss: ['혈사곡주', 's2:b4'] },
  { mobs: [['궁중 범', 'cr:mtiger'], ['금위 창병', 's2:c5a'], ['금의위', 's2:c5b'], ['환관 고수', 's2:c5c']], elite: ['동창 제독', 'boss:zb-5'], boss: ['금위대장', 's2:b5'] },
  { mobs: [['강게', 'cr:crab'], ['물뱀', 'cr:isnake'], ['장강 수적', 's2:c6a'], ['뱃사공 무사', 's2:c6b']], elite: ['수채 두령', 'boss:zb-8'], boss: ['장강 용왕', 's2:b6'] },
  { mobs: [['들개', 'cr:jackal'], ['까마귀', 'cr:crow'], ['소매치기', 's2:c7a'], ['취권 술꾼', 's2:c7b']], elite: ['표국 표사', 'boss:zb-0'], boss: ['야시장 흑막', 's2:b7'] },
  { mobs: [['표범', 'cr:leopard'], ['독거미', 'cr:pspider'], ['남만 전사', 's2:c8a'], ['남만 무당', 's2:c8b']], elite: ['남만 맹수왕', 'boss:m-bulpae'], boss: ['남만 대제사장', 's2:b8'] },
  { mobs: [['선학', 'cr:wcrane'], ['백록', 'cr:sdeer'], ['곤륜 도사', 's2:c9a'], ['선경 수호령', 's2:c9b']], elite: ['곤륜 장로', 'boss:m-baekmanggi'], boss: ['곤륜 선인', 's2:b9'] },
  { mobs: [['산중 판다', 'cr:panda'], ['독수리', 'cr:eagle'], ['당문 암기수', 's2:c10a'], ['청성 검수', 's2:c10b']], elite: ['당문 독수', 'boss:zb-13'], boss: ['당문주', 's2:b10'] },
  { mobs: [['흑호', 'cr:btiger'], ['흑랑', 'cr:bwolf'], ['마교 광신도', 's2:c11a'], ['마교 호법', 's2:c11b']], elite: ['마교 장로', 'boss:m-seophon'], boss: ['천마', 's2:b11'] },
  { mobs: [['흑전갈', 'cr:bscorp'], ['비단구렁이', 'cr:python'], ['독시', 's2:c12a'], ['독곡 고수', 's2:c12b']], elite: ['독곡 장로', 'boss:zb-18'], boss: ['독왕', 's2:b12'] },
  { mobs: [['금빛 원숭이', 'cr:gape'], ['산곰', 'cr:bear'], ['화산 검수', 's2:c13a'], ['매화 검녀', 's2:c13b']], elite: ['매화검존', 'boss:zb-16'], boss: ['화산 검후', 's2:b13'] },
  { mobs: [['용암 거미', 'cr:ispider'], ['화염 박쥐', 'cr:bat'], ['용암 마졸', 's2:c14a'], ['불도깨비', 's2:c14b']], elite: ['염마', 'boss:zb-20'], boss: ['화신', 's2:b14'] },
  { mobs: [['구름말', 'cr:cloud'], ['천계 기린', 'cr:h3'], ['천병', 's2:c15a'], ['선녀 무사', 's2:c15b']], elite: ['천장', 'boss:wb-takap'], boss: ['옥황', 's2:b15'] },
];
export const S2_MOB_ART = ROSTER.flatMap((r) => r.mobs.map((m) => m[1])).filter((a) => a.startsWith('s2:')).map((a) => a.slice(3));
// 장(1~15) · 몹 하나 → 그 몹의 [이름, 그림]. 같은 몹은 늘 같은 모습(번호로 고른다)
export function mobLook(ch, m) {
  const R = ROSTER[Math.max(0, Math.min(ROSTER.length - 1, ch - 1))];
  if (m.kind === 'boss') return R.boss;
  if (m.kind === 'elite') return R.elite;
  return R.mobs[(m.id * 7 + 3) % R.mobs.length];
}
