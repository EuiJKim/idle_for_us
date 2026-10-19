# APK 테이블 대조 — 무엇이 들어왔고 무엇이 안 들어왔나 (2026-10-19)

> `global-metadata.dat`의 TableParser 경로에서 뽑은 게임 시스템 테이블 **233개**를 우리 코드와 하나씩 맞춰봤다.

| 표시 | 뜻 | 수 |
|---|---|---:|
| O | 들어옴 | **96** |
| △ | 일부만 | 16 |
| X | 일부러 뺌 | 121 |
| ? | 아직 못 봄 | 0 |

## 결론 먼저

**233개 중 96개가 들어왔고, 121개는 일부러 뺐고, 16개가 반쪽이다.**

뺀 121개의 내역은 이렇다 — 과금 구조(상점·패스·VIP·패키지), 중복 성장축
(룬·고대룬·오파츠·정령·부적·카드), 운영 콘텐츠(이벤트 20여 종·시즌·설문·약관),
그리고 우리가 안 하기로 한 콘텐츠(점술·사신·두루마리·별자리·연금·제작).
**이 중 다시 볼 것은 없다.** [제외 항목 재검토](제외항목_재검토.md)에서 한 번
걸렀고, 그때 건진 셋(창고·출진 준비·성장 안내)은 이미 넣었다.

남은 건 **반쪽인 16개**다. 그중 손볼 가치가 있는 것만 순서대로 적는다.

## 손볼 가치 순위

### 1. 무공 칸이 4개 고정 (`SkillSlotTable`) ★

무공이 **14종인데 칸이 넷**이다. 저쪽은 슬롯 자체가 테이블이라 성장한다.
동작 아키타입 6종을 넣어 무공이 다양해진 만큼, 지금은 **열 개를 못 쓴다.**
총 연마 보너스로 "안 쓰는 무공도 올릴 이유"는 만들었지만, 쓸 자리는 안 만들었다.

→ 관문이나 경지에 따라 5·6칸으로 늘리는 것.

### 2. 물결에 보상이 없다 (`WaveRewardTable`) ★

물결을 넣었는데(3순위 ⑨) **물결을 넘길 때 아무 일도 안 일어난다.**
배너만 뜬다. 저쪽은 물결마다 보상 테이블이 따로 있다.
한 관문 안에 네 번의 작은 성취가 생길 자리를 비워둔 셈이다.

### 3. 상태이상이 빙결 하나뿐 (`CrowdControlTable`) ★

무공 14종 중 상태이상은 빙백신장의 빙결뿐이다.
기절·둔화·출혈·방어 감소가 있으면 **무공을 고르는 이유**가 수치 말고 하나 더 생긴다.
동작은 여섯 가지로 갈라놨는데 효과는 전부 "피해"다.

### 4. 선택 상자가 없다 (`SelectionBoxTable`)

공략에서 가장 많이 나온 보상이 **"전설 장신구 선택상자"**였다.
골라 받는 것과 무작위는 체감이 다르다. 지금 장신구 상자는 전부 무작위라,
"가락지만 집중해서 올린다"는 공략의 핵심 판단이 안 된다.

### 5. 장비 초월이 없다 (`TranscendenceTable`)

초월을 장신구와 무공에만 넣었다. 저쪽은 장비에도 있다.
다만 장비는 이미 등급·제련·옵션 칸·세트·총제련으로 다섯 겹이라, 급하지는 않다.

### 나머지 반쪽 (손 안 대도 되는 것)

`AccessorySpecialAbillTable`(장신구 특수 능력), `EgoEnchantTable`(심검 강화),
`PetSpecialAbilTable`(영수 고유 효과 — 이미 보유 효과로 있음),
`GodEnchantTable`(제련으로 통합), `FigurePriceTable`(사는 대신 쓰러뜨려 기록),
`ChapterTable`(벽 주기로 대체), `QuestBoardTable`(성장 안내로 대체),
`GuideTable`, `RiftPartsTable`, `GuildBossStepTable`, `GuildMembersRankTable`.

대부분 **우리 방식으로 이미 대체**했거나, 더하면 축만 늘고 재미는 안 느는 것들이다.

---

## 아직 못 본 것 (0개)

없음

## 일부만 들어온 것 (16개)

| 테이블 | 메모 |
|---|---|
| `AccessorySpecialAbillTable` | 특수 능력 미구현 |
| `ChapterTable` | 벽 주기로 대체 |
| `CrowdControlTable` | 빙결만 |
| `EgoEnchantTable` | 심검 강화 미구현 |
| `FigurePriceTable` | 인물도감 — 사는 게 아니라 쓰러뜨려 기록 |
| `GodEnchantTable` | 천품 강화 — 제련으로 통합 |
| `GuideTable` | 안내 한 줄 |
| `GuildBossStepTable` | 문파 토벌 |
| `GuildMembersRankTable` | 문파원 목록 |
| `PetSpecialAbilTable` | 영수 고유 효과 |
| `QuestBoardTable` | 성장 안내로 대체 |
| `RiftPartsTable` | 균열 — 부품 없음 |
| `SelectionBoxTable` | 선택 상자 없음 |
| `SkillSlotTable` | 4칸 고정 — 성장 안 함 |
| `TranscendenceTable` | 초월 — 장신구·무공에만 있음 |
| `WaveRewardTable` | 물결 보상 없음 |

## 들어온 것 (O)

| 테이블 | 우리 쪽 |
|---|---|
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
