# APK 테이블 대조 — 무엇이 들어왔고 무엇이 안 들어왔나 (2026-10-20)

> `global-metadata.dat`의 TableParser 경로에서 뽑은 게임 시스템 테이블 **233개**를 우리 코드와 하나씩 맞춰봤다.

| 표시 | 뜻 | 수 |
|---|---|---:|
| O | 들어옴 | **102** |
| △ | 일부만 | 10 |
| X | 일부러 뺌 | 121 |
| ? | 아직 못 봄 | 0 |

## 결론 먼저

**233개 중 102개가 들어왔고, 121개는 일부러 뺐고, 10개가 반쪽이다.**

뺀 121개의 내역은 이렇다 — 과금 구조(상점·패스·VIP·패키지), 중복 성장축
(룬·고대룬·오파츠·정령·부적·카드), 운영 콘텐츠(이벤트 20여 종·시즌·설문·약관),
그리고 우리가 안 하기로 한 콘텐츠(점술·사신·두루마리·별자리·연금·제작).
**이 중 다시 볼 것은 없다.** [제외 항목 재검토](제외항목_재검토.md)에서 한 번
걸렀고, 그때 건진 셋(창고·출진 준비·성장 안내)은 이미 넣었다.

반쪽이던 16개 중 손볼 가치가 있던 **다섯은 2026-10-20에 전부 넣었다.**
남은 10개는 우리 방식으로 이미 대체했거나, 더하면 축만 늘고 재미는 안 느는 것들이다.

## 반쪽이던 다섯을 메웠다 (2026-10-20)

순위를 매겼던 다섯을 전부 넣었다. 하나씩 무엇을 어떻게 옮겼는지 적는다.

### 1. 무공 칸 성장 (`SkillSlotTable`)

무공이 14종인데 칸이 넷이라 **열 개를 못 썼다.** 저쪽은 슬롯 자체가 테이블이라
성장한다. 우리도 칸을 늘렸다.

- 기본 4칸, **180관문·260관문**에서 한 칸씩 → 최대 6칸 (`SKILL_SLOT_AT`)
- 둘 다 벽 자리다. 새로 열리는 것은 전부 벽에서 열린다는 규칙을 지켰다
- 무공 탭 제목에 "지금 몇 칸 · 다음 칸은 몇 관문"을 띄운다
- 출진 준비(프리셋) 불러오기도 열린 칸 수만큼만 채운다

### 2. 물결 보상 (`WaveRewardTable`)

물결을 넣었는데 넘겨도 배너만 떴다. 한 관문 안의 작은 성취 자리가 비어 있었다.

- 물결을 넘길 때 은자·한철을 준다. 마지막 물결은 비급까지 (`waveReward`)
- 뒤쪽 물결일수록 크고, 마지막은 관문지기로 이어지므로 더 준다
- **한 번 과했다**: 처음에 은자를 `monsterGold × 14 × k`로 뒀더니 한 관문의
  물결 보상이 그 관문 처치 은자의 **3배**였다. 본 보상이 뒤집힌 것이다.
  `× 4`로 낮췄다. 검사에 "물결 보상 < 처치 은자" 항목을 넣어 다시 못 넘게 했다

### 3. 상태이상 넷 (`CrowdControlTable`)

동작은 여섯 가지로 갈라놨는데 **효과가 전부 피해**였다. 무공을 고르는 이유가
수치밖에 없었다.

| 상태이상 | 효과 | 붙은 무공 |
|---|---|---|
| 빙결 | 멈춤 | 빙백신장 3초 |
| 둔화 | 걸음 ×0.45 | 뇌정검 5초 · 연환벽력 4초 · 선풍장 3초 |
| 출혈 | 초당 그 일격의 22% | 선풍검 4초 · 발도돌격 6초 · 일자검기 5초 |
| 파쇄 | 받는 피해 ×1.35 | 만검귀종 8초 · 매화검진 4초 |

- 아홉 무공에 붙였다. 같은 것이 겹치면 **더 긴 쪽이 남는다**
- 출혈은 더 아픈 쪽으로 갈아끼운다 (`applyCC`)
- 장판(매화검진·선풍장)은 장판이 때릴 때마다 다시 건다
- 연쇄·돌격·관통·순간이동도 맞은 적마다 건다

> **검증에서 헤맨 것**: 처음 시험에서 "0마리에 둔화"가 나왔다. 코드 문제가
> 아니었다. 시험용 무인이 세서 **범위 안 적이 전부 죽었던 것**이다 —
> 상태이상이 남을 적이 없었다. 약한 무인으로 다시 돌리니 둔화 25 · 출혈 11 ·
> 파쇄 42가 걸렸다. 검사에도 일부러 약한 무인을 쓴다.

### 4. 선택 상자 (`SelectionBoxTable`)

공략에서 가장 많이 나온 보상이 **"전설 장신구 선택상자"**였다. 우리 장신구
상자는 전부 무작위라 공략의 핵심 판단인 **"가락지만 집중해서 올린다"**가
성립하지 않았다 — 자리를 못 고르니까.

- 무작위 상자와 **따로** 둔다. 더 드물게 주되 **자리를 고르고 등급 바닥을 보장**
- 보품 62% · 신품 28% · 천품 10% (`ACC_PICK_RATES`, 최소 `ACC_PICK_MIN` = 보품)
- 나오는 곳: **백 단위 벽** 관문지기 · 탑의 단이 바뀌는 층 · 소환 10레벨 단위 ·
  그림자 절정/초절정 티어
- 성장 안내가 "선택 상자 N개 — 자리를 골라 열어요"로 집어준다

### 5. 장비 초월 (`TranscendenceTable`)

초월을 장신구와 무공에만 뒀다. 다만 장비는 이미 등급·제련·옵션 칸·세트·총제련으로
다섯 겹이라, **값을 다르게 받아** 제련과 겹치지 않게 했다.

- 제련은 한철이지만 **초월은 천품 장비 자체를 먹는다.** 천품은 더 합성할 윗등급이
  없어서 남는 것이 영원히 쌓이기만 했다 — 그 자리를 쓴 것이다
- 한 단계마다 그 부위 배율 **×1.5**, 최대 6단계 (6초월이면 ×4)
- 비용 `1 + 단계`개, 6초월까지 **천품 21개**. 끼운 하나는 남겨야 하므로 실제 22개
- 장신구 6초월이 ×4.3이므로 세기를 맞췄다

---

### 값 조정 결과

| 지점 | 다섯 전 | 다섯 후 |
|---|---:|---:|
| 8시간 | 374관문 | 387관문 |
| 12시간 | 390관문 | 443관문 |

**8시간을 기준으로 본다.** 12시간 수치는 회귀가 그 직전에 터졌는지에 따라
200관문씩 흔들려서 비교에 못 쓴다 — 기준 측정에서는 `stage 199 best 390`이
나왔고, 같은 변경으로 돌린 세 번이 443 · 450 · 462였다. 전부 노이즈다.
8시간은 네 번 모두 회귀 전이라 그대로 비교된다.

처음에 12시간만 보고 "+14%나 올랐다"고 판단해서 **상태이상을 낮췄는데
오히려 462가 나왔다.** 그래서 노이즈임을 알았다. 8시간으로 다시 재니
374 → 387, **+3.5%**다. 상태이상 값은 원래대로(출혈 22% · 파쇄 ×1.35) 돌렸다.

> **나중에 덧붙임 (같은 날)**: 이 '원복'의 근거도 사실 약했다. 측정 도구를
> 고친 뒤(시뮬이 소환 보상·선택 상자·장비 초월을 안 쓰고 있었다) 다시 재 보니
> 출혈 22%/파쇄 1.35와 출혈 12%/파쇄 1.22의 **진행 차이가 사실상 0**이었다
> (2시간 −3, 4시간 −1, 8시간 0, 12시간 +3 — 전부 노이즈 범위).
>
> 그러니 이 값은 **진행 속도로는 정할 수 없다.** 체감으로 정하는 게 맞고,
> 파쇄 ×1.35가 ×1.22보다 "걸렸다"는 게 느껴지므로 지금 값을 쓴다.
> 수치가 근거가 아니라 **수치가 근거가 못 된다는 것**이 근거다.

물결 보상 은자는 `×14`에서 `×4`로 낮춘 것을 유지한다. 진행 속도 때문이 아니라
**한 관문 중간의 보상이 그 관문 전체 처치 은자를 넘으면 안 되기 때문**이다.
검사에 그 항목을 박아 뒀다.

`node tests/check.mjs`에 **섹션 7**(28개 항목)을 더해 다섯을 전부 검사한다 —
칸이 벽에서 열리는지, 물결 보상이 처치 은자를 안 넘는지, 상태이상 넷이 걸리고
시간이 지나면 풀리는지, 선택 상자가 고른 자리·보장 등급으로만 나오는지,
초월이 상한에서 멈추고 천품을 정확히 21개 먹는지.

---

### 나머지 반쪽 (손 안 대도 되는 것)

`EgoEnchantTable`(심검 강화),
`PetSpecialAbilTable`(영수 고유 효과 — 이미 보유 효과로 있음),
`GodEnchantTable`(제련으로 통합), `FigurePriceTable`(사는 대신 쓰러뜨려 기록),
`ChapterTable`(벽 주기로 대체), `QuestBoardTable`(성장 안내로 대체),
`GuideTable`, `RiftPartsTable`, `GuildBossStepTable`, `GuildMembersRankTable`.

대부분 **우리 방식으로 이미 대체**했거나, 더하면 축만 늘고 재미는 안 느는 것들이다.

---

## 아직 못 본 것 (0개)

없음

## 일부만 들어온 것 (10개)

| 테이블 | 메모 |
|---|---|
| `ChapterTable` | 벽 주기로 대체 |
| `EgoEnchantTable` | 심검 강화 미구현 |
| `FigurePriceTable` | 인물도감 — 사는 게 아니라 쓰러뜨려 기록 |
| `GodEnchantTable` | 천품 강화 — 제련으로 통합 |
| `GuideTable` | 안내 한 줄 |
| `GuildBossStepTable` | 문파 토벌 |
| `GuildMembersRankTable` | 문파원 목록 |
| `PetSpecialAbilTable` | 영수 고유 효과 |
| `QuestBoardTable` | 성장 안내로 대체 |
| `RiftPartsTable` | 균열 — 부품 없음 |

## 들어온 것 (O)

| 테이블 | 우리 쪽 |
|---|---|
| `AccessorySpecialAbillTable` | 특기 — 성 수로 열리고 기본 능력과 다른 축에 붙는다 |
| `CrowdControlTable` | 상태이상 넷 — 빙결·둔화·출혈·파쇄 |
| `SelectionBoxTable` | 선택 상자 — 자리를 고르고 보품 이상 보장 |
| `SkillSlotTable` | 무공 칸 4→6, 180·260관문에서 열린다 |
| `TranscendenceTable` | 장비 초월 — 천품을 먹고 ×1.5씩, 6단계 |
| `WaveRewardTable` | 물결 보상 — 은자·한철, 마지막 물결에 비급 |
| `AbilityTable` | 능력치 |
| `AccessoryTable` | 장신구 3종 |
| `AdBuffTable` | 광고 버프 |
| `ArtifactLevelTable` | 신물 레벨 |
| `ArtifactTable` | 신물 8종 |
| `AssetBoxRewardTable` | 비경 보상 |
| `AssetBoxTable` | 비경 보상 |
| `AssetDungeonTable` | 비경 4종 |
| `AssetStatusTable` | 재화 |
| `AssetTable` | 재화 |
| `AttendanceTable` | 연공 일지 |
| `AttendanceTypeTable` | 출석 |
| `BoxSweepAbilityTable` | 비경 소탕 |
| `BuffTable` | 버프 |
| `CharacterUpgradeTable` | 골드 강화 |
| `ConditionTable` | 해금 조건 |
| `CurseTable` | 혈마의 탑 240층 |
| `DoppelTierRewardTable` | 티어 보상 |
| `DoppelTierTable` | 6티어 |
| `DoppelgangerTable` | 그림자 무림 |
| `DropTable` | 드랍 |
| `EffectTable` | 이펙트 |
| `EgoBonusTable` | 심검 효과 |
| `EgoUpgradeTable` | 심검 단계 |
| `EquipmentTotalLevelTable` | 총 제련 |
| `GachaLvUpTable` | 소환 레벨 3종 |
| `GameModeHudButtonTable` | HUD |
| `GameModeTable` | 모드 11종 |
| `GetAndUseTable` | 재화 수급·소비 |
| `GoldStatusTable` | 골드 강화 6종 |
| `GradeTable` | 6등급 |
| `GradeTotalLevelTable` | 총 제련 |
| `GroupSkinOptionTable` | 의복 전부 모음 |
| `GrowthGuideTable` | 성장 안내 |
| `InformationPopUpTable` | 모달 |
| `ItemAccEnchantTable` | 장신구 승급 |
| `ItemAccUpgradeTable` | 장신구 초월 |
| `ItemEnchantTable` | 제련 |
| `ItemEquipPresetTable` | 출진 준비 |
| `ItemSlotEnchantTable` | 옵션 칸 |
| `ItemTable` | 장비 3부위 |
| `LevelStatusTable` | 스탯 포인트 |
| `LevelUpTable` | 레벨 |
| `LibraryTable` | 인물도감·병기보 |
| `MapTable` | 지역 8종 x 티어 5 |
| `MenuItemTable` | 탭 |
| `MessageBoxTable` | 토스트 |
| `MineTable` | 한철 광맥 |
| `MinerTable` | 광부 |
| `MonsterPoolTable` | 지역별 적 |
| `MonsterTable` | 적 |
| `MultipleBoxTable` | 10연 |
| `OptionSlotCountTable` | 제련 4/10/18/28에 칸 열림 |
| `OptionTable` | 옵션 7종 |
| `PetEngraveLevelTable` | 각인 |
| `PetIntimacyOptionTable` | 교감 효과 |
| `PetIntimacyTable` | 교감 |
| `PetTable` | 영수 |
| `PetTypeTable` | 영수 등급 |
| `PlayerTable` | 세이브 |
| `PresetGroupTable` | 출진 준비 3칸 |
| `ProjectileTable` | 동작 6종 |
| `QuestMissionTable` | 업적 |
| `QuestTable` | 일일 의뢰 |
| `RaidBossTable` | 문파 토벌 |
| `RandomBoxTable` | 뽑기 |
| `RandomFactorTable` | 난수 |
| `RankRewardTable` | 경지 보상 |
| `RankTable` | 경지 |
| `RedDotGraphTable` | 빨간 점 |
| `RewardTable` | 보상 |
| `RiftTicketRewardTable` | 탐색패 |
| `SetAbilTable` | 세트 효과 |
| `SetComponentsTable` | 세 부위 |
| `SetTable` | 한 벌 갖춤 |
| `SkillLevelUpTable` | 연마 |
| `SkillStatusIcon` | 무공 아이콘 |
| `SkillTable` | 무공 14종 |
| `SkillTotalLevelTable` | 총 연마 |
| `SkillTranscendenceTable` | 무공 초월 |
| `SkinInfoTable` | 의복 12벌 |
| `SkinOptionTable` | 의복 보유 효과 |
| `SlotInfoTable` | 슬롯 |
| `SpawnPositionTable` | 원형 생성 |
| `StageRewardTable` | 관문 보상 |
| `StageTable` | 관문 |
| `StringTable` | 문자열 |
| `TextNotationTable` | 숫자 표기 |
| `TicketTable` | 열쇠·탐색패·토벌패·결투패 |
| `TierRewardTable` | 티어 보상 |
| `ToggleUITable` | 자동 전환 |
| `TreasureDropTable` | 비급 탐색 보상 |
| `TreasurehuntBossTable` | 비급 탐색 |
| `UIMenuTable` | 탭 |
| `UITable` | UI |
| `WaveGroupTable` | 물결 1~4 |

## 일부러 뺀 것 (X)

| 테이블 | 이유 |
|---|---|
| `AetherStatusTable` | 에테르 — 성장 축 중복 |
| `AlchemyAbilTable` | 연금 |
| `AlchemyTable` | 연금 |
| `AncientRuneEnchantTable` | 고대룬 |
| `AncientRuneLimitBreakTable` | 고대룬 |
| `BreakBoostTable` | 돌파 |
| `BreakthroughStepTable` | 돌파 |
| `ConquerorPointTable` | 정복자 점수 — 회귀 포인트와 겹침 |
| `ConstellationTable` | 별자리 |
| `CoreCardTable` | 카드 |
| `CoreOpenTable` | 카드 |
| `CostumeEnchantTable` | 코스튬 강화 |
| `DecoAwakeTable` | 장식 |
| `DecoGrindingTable` | 장식 |
| `EmblemTable` | 문장 |
| `EternalEnchantTable` | 영원 강화 — 봉인 계열 |
| `EternalPetAbilityTable` | 영원 펫 |
| `EternalSealEnchantTable` | 봉인 |
| `EternalSealExpTable` | 봉인 |
| `EternalSealTable` | 봉인 |
| `EventBladePassTable` | 패스 |
| `EventConfigTable` | 이벤트 — 운영 콘텐츠 |
| `EventDropTable` | 이벤트 — 운영 콘텐츠 |
| `EventGachaTable` | 이벤트 — 운영 콘텐츠 |
| `EventGroupTable` | 이벤트 — 운영 콘텐츠 |
| `EventItemTable` | 이벤트 — 운영 콘텐츠 |
| `EventMemberTable` | 이벤트 |
| `EventPointTable` | 이벤트 — 운영 콘텐츠 |
| `EventRiftTable` | 이벤트 — 운영 콘텐츠 |
| `EventShopTable` | 이벤트 — 운영 콘텐츠 |
| `EventSpearDodgeProjectileTable` | 이벤트 — 운영 콘텐츠 |
| `EventSpearDodgeTable` | 이벤트 — 운영 콘텐츠 |
| `EventTable` | 이벤트 — 운영 콘텐츠 |
| `FeatureEnchantTable` | 특성 |
| `FeatureTable` | 특성 |
| `FeatureUpgradeTable` | 특성 |
| `FigureBulkSaleTable` | 피규어 판매 |
| `FigureEnchantTable` | 피규어 강화 |
| `FigureResonanceSlotTable` | 공명 |
| `FigureResonanceStoneEnchantTable` | 공명 |
| `FigureResonanceStoneLevelTable` | 공명 |
| `FigureResonanceStoneUpgradeTable` | 공명 |
| `FortuneTellingTable` | 점술 |
| `GameScheduleTable` | 일정 |
| `GimmickSymbolTable` | 기믹 |
| `GoblinShopSlotTable` | 상점 |
| `GoblinShopTable` | 상점 |
| `GoblinVipLevelTable` | VIP |
| `GoblinVipShopTable` | VIP |
| `GuildDrawTable` | 문파 뽑기 |
| `GuildHuntingBattleRewardTable` | 문파 사냥 |
| `GuildHuntingDungeonStepTable` | 문파 사냥 |
| `GuildHuntingZoneTable` | 문파 사냥 |
| `GuildMarkTable` | 문파 문장 |
| `GuildRankRewardTable` | 문파 서열 보상 |
| `ItemPriceTable` | 상점 없음 |
| `ItemQuestTable` | 아이템 의뢰 |
| `ItemTreasureEnchantTable` | 보물 강화 — 중복 |
| `LibraryExchangeTable` | 도감 교환 |
| `MonsterCardEnchantTable` | 몬스터 카드 |
| `MonsterCardTable` | 몬스터 카드 — 인물도감과 겹침 |
| `OopartChangeTable` | 오파츠 |
| `OopartEnchantTable` | 오파츠 |
| `OopartRestoreTable` | 오파츠 |
| `OpenNoticePopUpTable` | 공지 |
| `PackageBuffTable` | 패키지 |
| `PartsTable` | 부품 |
| `PassEventTable` | 패스 |
| `PassQuestTable` | 패스 |
| `PatternAwakenTable` | 인장 |
| `PatternMixTable` | 인장 |
| `PatternTable` | 인장 |
| `PetEngravePageInfoTable` | 각인 페이지 |
| `PetEngravePageUpgradeTable` | 각인 페이지 |
| `PetEngraveSlotBonusTable` | 각인 슬롯 |
| `PostTable` | 우편 |
| `PotentialTable` | 잠재력 — 골드 강화와 겹침 |
| `ProductionInfoTable` | 제작 |
| `ProductionMaterialTable` | 제작 |
| `ProductionRewardTable` | 제작 |
| `ReaperCollectionTable` | 사신 |
| `ReaperItemTable` | 사신 |
| `ReaperLvDropTable` | 사신 |
| `RiftSlotTable` | 균열 슬롯 |
| `RunaSurveyAnswerTable` | 설문 |
| `RunaSurveyQuestionTable` | 설문 |
| `RunaSurveyResultTable` | 설문 |
| `RunaSurveyScoreTable` | 설문 |
| `RunaSurveyTable` | 설문 |
| `RuneCostTable` | 룬 — 신물과 겹침 |
| `RuneEnchantTable` | 룬 |
| `RuneEssenceTable` | 룬 |
| `RuneExpTable` | 룬 |
| `RuneLimitBreakTable` | 룬 |
| `ScrollBonusRewardTable` | 두루마리 |
| `ScrollPenaltyTable` | 두루마리 |
| `ScrollRewardTable` | 두루마리 |
| `ScrollSettingTable` | 두루마리 |
| `ScrollStageTable` | 두루마리 |
| `ScrollTable` | 두루마리 |
| `SealEnchantTable` | 봉인 |
| `SealedForceTable` | 봉인 |
| `SeasonRewardTable` | 시즌 |
| `SeasonRiftUITable` | 시즌 균열 — 운영 콘텐츠 |
| `ServerNameTable` | 서버 |
| `ShopTable` | 상점 — 결제 없음 |
| `SoundTable` | 소리 — 미구현 |
| `SpiritBlessBoostTable` | 정령 |
| `SpiritBlessLevelTable` | 정령 |
| `SpiritBlessTable` | 정령 — 영수와 겹침 |
| `SpiritChoiceTable` | 정령 |
| `SpiritGachaTable` | 정령 |
| `SpiritStatusTable` | 정령 |
| `StartRankSceneTable` | 시작 연출 |
| `TalismanSpecialAbillTable` | 부적 |
| `TalismanTable` | 부적 — 신물과 겹침 |
| `TermsAndConditionsTable` | 약관 |
| `TitleEnchantTable` | 칭호 |
| `TitleTable` | 칭호 — 경지로 대체 |
| `TreasurehuntMasterTable` | 보물찾기 마스터 |
| `URLLinkTable` | 링크 |

---

## 장신구 특기 (2026-10-20)

`AccessoryTableData`가 `mAbilDataList`(보통 능력)와 `mSpecialAbilList`(특기)를
따로 들고, `AccessorySpecialAbillTableData`에 `IsSpecialAbilCheck` · `mStar` ·
`mWithAccessoryIDList`가 있다. **성 수가 조건이 되어 켜지는 두 번째 능력**이다.

### 왜 넣었나 — 선택 상자가 가짜 선택이었다

바로 앞에서 선택 상자를 넣어 "자리를 고르게" 만들었는데,
세 자리가 공격력 · 치명 피해 · 체력이라 **답은 언제나 가락지**였다.
고르는 칸만 만들고 고를 이유는 안 만든 셈이다.

특기는 자리마다 **기본 능력과 다른 축**에 붙여서 셋을 실제로 경쟁시킨다.

| 자리 | 기본 | 특기 | 왜 이 축인가 |
|---|---|---|---|
| 가락지 | 공격력 | 〈파옥〉 두목 피해 | 벽(관문지기)이 진행의 병목이다. 거기를 직접 뚫는다 |
| 귀걸이 | 치명 피해 | 〈연격〉 공격 속도 | 연이어 친다. 상한이 없어서 끝까지 붙는다 |
| 비녀 | 체력 | 〈축재〉 은자 획득 | 체력만으로는 진행을 못 민다. 은자로 바꿔 수련에 꽂게 한다 |

> 이 표는 **처음 넣었을 때와 다르다.** 처음에는 귀걸이 특기를 치명 확률로 두고
> "상한이 있으니 일찍 세고 나중에 포화된다 → 갈아타기가 생긴다"고 적었는데,
> 다음 날 수치로 재 보니 **틀렸다.** 아래 절에 그 과정을 남긴다.

- `ACC_SPECIAL_STAR = 3` — 3성부터 열린다
- 단수 = (성 − 3 + 1) + 초월. 3성 0초월이 1단, 6성 6초월이 10단
- 10단에서 파옥 +220% · 연격 +18%p · 축재 +300%

### 저쪽과 다르게 간 곳

`mWithAccessoryIDList`(다른 장신구를 같이 껴야 켜짐)는 **안 옮겼다.**
공략이 말하는 올바른 수는 "가락지만 집중해서 올린다"인데, 조합을 요구하면
그 수를 깎는다. 우리는 자기 자리에 쏟은 만큼 세지는 쪽으로만 간다.

검증: `node tests/check.mjs` 섹션 8(13개 항목). `node tests/sim.mjs` 8시간 387 → 393관문.

---

## 그 '갈아타기'를 수치로 재 봤다 — 틀렸다 (2026-10-20)

특기를 넣으면서 "귀걸이는 일찍 세고 나중에 포화되니 갈아타기가 생긴다"고 적었다.
설계 의도였을 뿐 **잰 적이 없었다.** 재 봤다.

### 어떻게 쟀나

시뮬레이션 사본에 구간 세이브 덤프를 붙여 실제 진행 상태(관문 271 / 393)를 뽑고,
그 상태에서 장신구 투자만 바꿔 가며 비교했다.

- 예산 = 장신구에 쏟을 수 있는 단계 수 (한 자리에 성 6 + 초월 6 = 12단)
- 전략 다섯: 가락지 몰빵 / 귀걸이 몰빵 / 비녀 몰빵 / 균등 / 귀걸이3성→가락지
- 등급은 신품으로 고정해 **성·초월 배분만** 비교

### 첫 결과 — 전 구간 가락지 몰빵 1등

| 자리 | 12단을 쏟았을 때 (8시간 상태) |
|---|---|
| 가락지 | DPS ×1.80 · 두목 DPS ×2.38 |
| 귀걸이 | DPS ×1.04 · 두목 DPS ×0.82 |
| 비녀 | DPS ×0.91 · 은자 ×1.46 |

**귀걸이에 12단을 전부 쏟아도 DPS가 ×1.04였다.** 사실상 아무 일도 안 일어난다.
갈아타기는 어느 예산에서도 없었다. 원인은 둘이었다.

#### 원인 1 — 특기 〈연격〉이 죽은 축에 붙어 있었다

치명 확률 수련은 **90레벨이 상한이고 그 값이 정확히 50% = `CRIT_CAP`**이다.
시뮬에서 수련 90은 **30분 차(관문 175)**에 이미 찍혀 있었다.
장신구가 3성에 닿는 건 2시간쯤이다. 즉 〈연격〉은 **열리는 순간부터 영원히 0**이었다.

#### 원인 2 — 귀걸이 기본 능력이 가락지의 6분의 1이었다

"치명 피해는 곱이 아니라 더하기로 들어가므로 수치를 작게 잡는다"며 `per`를
0.04로 뒀다(가락지는 0.25). 그런데 실제로 재 보니 둘의 한계 기여가 거의 같다.

```
공격력   : 1 / (1 + m.atk)                      = 1/28.3 = 0.035
치명 피해 : crit / (1 + crit x (critDmg - 1))    = 0.5/13.9 = 0.036
```

더하기로 들어가는 건 맞지만, 플레이어의 치명 피해가 이미 17~27이라
**나누기 6까지 깎을 이유가 없었다.** 어림으로 정한 값이 그대로 굳은 것이다.

### 고친 뒤

- 〈연격〉 치명 확률 → **공격 속도** (`speed`는 상한이 없다). 이름과도 맞다
- 귀걸이 `per` 0.04 → **0.22** (실측한 한계 기여에 맞춤)

| 자리 | 12단 (2시간) | 12단 (8시간) |
|---|---|---|
| 가락지 | 두목 DPS **×3.92** | 두목 DPS **×2.24** |
| 귀걸이 | DPS **×2.35** | DPS **×1.84** |
| 비녀 | 은자 **×2.16** | 은자 **×1.46** |

셋이 각자 1등인 축을 하나씩 갖게 됐다. 예산 6단부터 일반 DPS 1등은 귀걸이로 넘어간다.

### 그래서 갈아타기는 생겼나 — 아니다

**시점에 따른 갈아타기는 끝내 없다.** 두목 DPS 기준으로는 3단이든 36단이든,
2시간이든 8시간이든 가락지 몰빵이 1등이다.

생긴 것은 **목적에 따른 분기**다.

- 벽에 막혔다 → 가락지 (두목 DPS)
- 사냥이 느리다 → 귀걸이 (일반 DPS)
- 돈이 모자라다 → 비녀 (은자)

이것도 선택이긴 하지만, 내가 적었던 "시간이 지나면 답이 바뀐다"와는 다른 것이다.
문서를 그 말대로 고쳤다.

### 남은 문제 — 치명 확률을 주는 아홉 군데가 전부 죽어 있다

〈연격〉만의 문제가 아니었다. 수련 90레벨이 혼자서 상한을 채우기 때문에,
**치명 확률을 주는 모든 시스템이 0이 된다.**

| 시점 | 수련만 | 시스템이 더해준 것 | 실제 적용 | 버려진 것 |
|---|---|---|---|---|
| 30분 (관문 175) | 50% | +2.0%p | 50% | 2.0%p |
| 2시간 (관문 271) | 50% | +14.1%p | 50% | **14.1%p** |
| 8시간 (관문 393) | 50% | +39.5%p | 50% | **39.5%p** |

버려지는 출처: 병기보 부위 완성(+5%p×3) · 옵션 칸 보유 효과(+6%p) ·
천품 보유 효과(+6%p) · 의복 전부(+3%p) · 인물도감 종류 완성(+4%p) ·
장비 세트(+2/3/5%p) · 옵션 칸의 치명 옵션(칸당 최대 +12%p).

공략이 "분량의 1/3"이라 한 **옵션 칸**이 여기 들어 있다. 플레이어가 한철을 써서
치명 옵션을 맞춰도 숫자만 오르고 실제로는 아무 일도 안 일어난다.

이건 특기와 무관하게 원래 있던 결함이다. **바로 이어서 고쳤다** — 아래 절.

---

## 치명 상한에 여유를 만들었다 (2026-10-20)

위에서 찾은 "치명을 주는 아홉 군데가 전부 죽어 있다"를 고쳤다.

### 무엇이 문제였나

```
UPGRADES.crit  max 90,  value(l) = 0.05 + l x 0.005   ->  value(90) = 0.50
CRIT_CAP                                                            = 0.50
```

**수련 상한값과 전체 상한이 글자 그대로 같았다.** 그래서 수련을 끝내는 순간
(실측 30분, 관문 175) 치명을 주는 다른 모든 것이 0이 됐다.

### 고친 값

| | 전 | 후 |
|---|---:|---:|
| 수련 `crit` 상한 레벨 | 90 | **50** |
| 그 값 | 50% | **30%** |
| `CRIT_CAP` | 50% | **75%** |
| 시스템이 채울 여유 | **0%p** | **45%p** |

옛 세이브는 `migrate`에서 상한을 넘는 수련 레벨을 깎는다(치명 90 → 50).
속도 수련도 같은 방식으로 정리한다.

### 결과 — 치명이 '갖춘 만큼' 오른다

| 시점 | 수련 | 시스템 | 적용 | 버려진 것 |
|---|---:|---:|---:|---:|
| 30분 (관문 175) | 30% | +2.0%p | **32.0%** | 0 |
| 2시간 (관문 271) | 30% | +14.1%p | **44.1%** | 0 |
| 4시간 (관문 304) | 30% | +16.6%p | **46.6%** | 0 |
| 8시간 (관문 393) | 30% | +39.5%p | **69.5%** | 0 |

전에는 네 줄 모두 50%였다. 이제 **병기보를 완성하고 옵션 칸을 채울수록 치명이 오른다.**

### 초반 너프가 걱정됐는데, 거의 없었다

같은 세이브에서 치명만 바꿔 계산하면 30분 차 DPS가 **×0.69**로 나온다.
초반 31% 손해는 큰 값이다. 그런데 실제로 돌려 보니 달랐다.

| 시점 | 조정 전 | 조정 후 |
|---|---:|---:|
| 0.25시간 | 83관문 | 83관문 |
| 0.5시간 | 175 | **171** |
| 1시간 | 226 | **222** |
| 2시간 | 266 | **265** |
| 4시간 | 301 | **303** |
| 8시간 | 380 (회귀 끼임) | **396** |

0.5시간 −4관문, 1시간 −4관문. **−2%다.**

계산과 실제가 다른 이유는 **돈이 재배치되기 때문**이다. 수련 치명이 50에서
멈추면 거기 들어갈 은자가 공격력·치명 피해로 간다. 치명 51~90레벨의 비용은
`40 x 1.13^l`이라 레벨당 1.8만~220만으로 매우 비쌌다 — 그 돈이 다른 데서 일한다.

> 교훈: 한 스탯만 떼어 계산한 DPS 배수는 **진행 속도의 대용이 못 된다.**
> 자원이 어디로 흘러가는지까지 봐야 한다. 둘이 ×0.69와 −2%만큼 벌어졌다.

### 화면에도 적었다

수련 탭이 "30% (최대)"만 보여주면 **30%가 천장으로 읽힌다.** 그러면 치명을 주는
시스템을 전부 쓸모없는 것으로 지나치게 된다. 그 줄을 이렇게 바꿨다.

```
혈도 찌르기(치명 확률) Lv.50
30% (수련 최대) · 지금 45% (상한 75% — 나머지는 병기보·옵션 칸·세트·의복에서)
```

### 다시 못 그러게

`tests/check.mjs`에 **섹션 9**를 더했다.

- 수련을 다 해도 상한까지 20%p 넘게 남는가
- 치명을 주는 시스템의 합이 그 여유 안에 들어오는가
- 수련만으로는 상한에 못 닿는가
- 옛 세이브의 넘치는 수련 레벨이 정리되는가

속도(`speed`)도 같이 봤는데, 그쪽은 상한이 수련에만 걸리고 시스템 보너스는
곱으로 따로 붙어서(`min(SPEED_CAP, 수련) x (1 + m.speed)`) 버려지는 게 없다.
상한이 있는 수련은 치명과 속도 둘뿐이고, 나머지 축은 상한이 없다.
