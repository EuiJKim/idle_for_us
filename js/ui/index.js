import { growthTab } from './growth.js';
import { trainTab } from './train.js';
import { equipTab } from './equip.js';
import { skillTab } from './skill.js';
import { companionTab } from './companion.js';
import { dungeonTab } from './dungeon.js';
import { socialTab } from './social.js';

export { h, toast, openModal, closeModal, modalOpen, rewardText, RES_DEFS } from './common.js';
export { showProfile } from './social.js';
export { openMissions } from './missions.js';

export const TABS = {
  train: trainTab,
  growth: growthTab,
  equip: equipTab,
  skill: skillTab,
  companion: companionTab,
  dungeon: dungeonTab,
  social: socialTab,
};
