// 새 시즌(S1) 콘텐츠 차단 깃발 — 문제가 생긴 기능만 서버 설정 하나로 끈다(계획서 §L6).
// 서버: Firestore config/flags 문서 { off: ['gacha', 'pvp', …], msg: '점검 중…' } — 운영자만 쓴다(규칙은 S8에서).
// 엔진·화면은 기능을 열기 전에 blocked(이름)를 본다. 서버를 못 읽으면 모두 열린 것으로 본다(혼자 하는 게임을 막지 않는다).
export const FLAG_NAMES = ['gacha', 'gearGacha', 'starforce', 'pull', 'pvp', 'worldBoss', 'guild', 'guildContent', 'expedition', 'mail', 'chat', 'ranking', 'offline', 'event', 'shopAd'];
let off = new Set();
let msg = '';
export function setFlags(doc) {
  off = new Set(Array.isArray(doc?.off) ? doc.off.filter((x) => FLAG_NAMES.includes(x)) : []);
  msg = typeof doc?.msg === 'string' ? doc.msg.slice(0, 200) : '';
}
export const blocked = (name) => off.has(name);
export const blockedMsg = () => msg;
export const blockedList = () => [...off];
