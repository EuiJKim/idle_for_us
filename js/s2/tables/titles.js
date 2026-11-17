// v537 칭호 — 얻은 칭호는 모일수록 능력치(수집 효과) · 하나를 달면 사냥터에서 무인 이름 위에 뜬다.
//   S.titles(얻은 칭호 이름 목록)는 v532(장 두목 첫 처치) · v536(28일 개근)부터 쌓였다 — 이름으로 맞춘다.
import { CHBOSS } from './chboss.js';
export const TITLES = [
  ...CHBOSS.slice(1).map((d, i) => ({ id: `chb${i + 1}`, name: `${d.name} 격파`, how: `${i + 1}장 두목(${(i + 1) * 10}칸) 첫 처치`, col: d.col })),
  { id: 'att28', name: '28일 개근', how: '출석 28일 채우기', col: '#fde68a' },
  { id: 'dex15', name: '두목 도감 완성', how: '장 두목 15명 모두 토벌 ★3', col: '#fde047' },   // v555
];
// 칭호 하나마다(‰) — 공격 +1% · 보스 피해 +1%
export const TITLE_EACH = { atkP: 10, bossDmg: 10 };
export const titleByName = (nm) => TITLES.find((t) => t.name === nm) || null;
