// 새 시즌 장(지역) 15 — 칸 10개씩(1장 = 1~10칸 …). 배경 · 발판 그림은 art/s2/bg|ledge/c{장}.webp
export const CHAPTERS = ['죽림', '서역 사막', '설산 빙궁', '혈사곡', '황궁 금위영', '장강 나루', '낙양 야시장', '남만 밀림', '곤륜 선경', '사천 절벽', '마교 총단', '독곡', '화산', '지하 용암굴', '천외천'];
export const chapterOf = (idx) => Math.max(1, Math.min(CHAPTERS.length, Math.ceil(idx / 10)));
export const chapterName = (idx) => CHAPTERS[chapterOf(idx) - 1];
