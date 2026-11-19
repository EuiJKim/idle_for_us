// v610 창 줄 그림 아이콘 — 한자 한 글자 딱지 대신 그림(art/s2/ui/<이름>.webp · 그린 것은 tools/s2art/uiicons.py)
// 줄(R)의 넷째 값은 그대로 글자다. 글자 → 그림 이름은 GLY_ICON에서 찾고,
// 한 글자가 줄마다 다른 뜻이면 줄에서 'i:이름:글자'로 그림을 바로 고른다(글자는 그림이 안 뜰 때 대신 보인다).
export const UI_ICONS = [
  'pull', 'pullw', 'pullp', 'pullr', 'stone', 'chest', 'silver',
  'training', 'sweep', 'raid', 'tower', 'exped', 'time', 'map', 'auto', 'dex', 'wboss', 'duel', 'gate',
  'stamp', 'mission', 'medal', 'realm',
  'guild', 'letter', 'friend',
  'atk', 'hp', 'def', 'crit', 'scale', 'lock', 'reset', 'skill', 'mastery', 'job', 'title',
  'equip', 'enhance', 'starsoul', 'dismantle', 'shard', 'bag',
  'shake', 'meter', 'dodge', 'cloud', 'key', 'vib', 'screen', 'moon', 'lantern',
];
export const GLY_ICON = {
  // 뽑기 · 가게
  '抽': 'pull', '兵': 'pullw', '伴': 'pullp', '靈': 'pullr', '石': 'stone', '덤': 'chest', '賞': 'chest', '衆': 'chest', '銀': 'silver',
  // 던전 · 나들이
  '洞': 'training', '修': 'training', '掃': 'sweep', '討': 'raid', '塔': 'tower', '征': 'exped', '時': 'time', '地': 'map',
  '自': 'auto', '進': 'auto', '育': 'auto', '鑑': 'dex', '龍': 'wboss', '魔': 'wboss', '鬪': 'duel',
  '開': 'gate', '入': 'gate', '出': 'gate', '舊': 'gate',
  // 오늘 · 임무
  '印': 'stamp', '日': 'mission', '介': 'mission', '功': 'medal', '境': 'realm',
  // 문파 · 벗
  '派': 'guild', '創': 'guild', '招': 'letter', '募': 'letter', '友': 'friend', '同': 'friend',
  // 캐릭터
  '攻': 'atk', '體': 'hp', '銳': 'crit', '數': 'crit', '均': 'scale', '鎖': 'lock', '還': 'reset', '環': 'reset', '原': 'reset',
  '學': 'mastery', '得': 'mastery', '轉': 'job', '稱': 'title', '名': 'title',
  // 장비
  '裝': 'equip', '强': 'enhance', '鍊': 'enhance', '魂': 'starsoul', '分': 'dismantle', '片': 'shard', '解': 'bag', '…': 'bag',
  // 설정
  '震': 'vib', '搖': 'shake', '測': 'meter', '避': 'dodge', '雲': 'cloud', '碼': 'key', '全': 'screen', '畵': 'screen', '眠': 'moon', '燈': 'lantern',
};
// 줄 글자 → [그림 이름('' = 그림 없음), 대신 보일 글자]
export function uiIcon(gly) {
  const s = String(gly ?? '');
  if (s.startsWith('i:')) { const [, name, fb = ''] = s.split(':'); return [UI_ICONS.includes(name) ? name : '', fb]; }
  return [GLY_ICON[s] || '', s];
}
