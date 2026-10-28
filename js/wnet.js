// 바람식 개편 — 서버. 로그인·프로필·서열은 옛 Net을 그대로 쓰고, 프로필 모양과 서열만 새로.
//
// 옛 판 프로필도 같은 players 모음에 남아 있다(전투력 10^100 같은 것). 거기에 섞이면 새 판 사람은
// 서열에 안 보인다 — **world: 1** 표시가 있는 것만 모아 레벨 순으로 늘어놓는다.
// 색인을 새로 만들지 않으려고 서버 정렬 없이 넉넉히 읽어서 여기서 거른다(친구끼리라 몇십 명이다).
import { Net } from './net.js';
import * as W from './world/wdata.js';

export class WNet extends Net {
  profileData() {
    const g = this.game;
    const s = g.s;
    const st = g.stats();
    return {
      world: 1,
      nickname: s.nickname || '이름없음',
      level: s.level,
      job: s.job || null,
      jobTier: s.jobTier,
      tierName: g.tierName(),
      map: s.huntMap,
      mapName: W.mapOf(s.huntMap).name,
      power: st.power,
      atk: Math.round(st.atk), hp: Math.round(st.hp),
      weaponGrade: g.bestGrade('weapon'),
      titles: s.titles || [],
      updatedAt: this.fs.serverTimestamp(),
    };
  }

  async ranking() {
    const { collection, query, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'players'), limit(300)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((p) => p.world === 1);
  }

  ready() { return this.online && !this.blocked; }
}
