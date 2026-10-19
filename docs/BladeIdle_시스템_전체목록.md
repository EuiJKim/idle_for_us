# Blade Idle 전체 시스템 목록과 우리와의 격차 (2026-10-18)

> 근거: `global-metadata.dat`에 남은 `Assets/Scripts/TableParser/*.cs` 경로 **271개**.
> 이게 Blade Idle이 가진 시스템의 **완전한 목록**이다. 욕설 필터·국가코드 같은
> 게임과 무관한 것을 빼면 **게임 시스템 테이블 233개**.
>
> 이 문서를 먼저 만들었어야 했다. 지금까지는 생각나는 것만 하나씩 집어서
> 물어보는 식이었고, 그건 APK를 받은 의미를 못 살린 것이다.

## 요약

| | Blade Idle | 우리 (v0.7) |
|---|---:|---:|
| 게임 시스템 테이블 | **233** | 약 15 |
| 콘텐츠 종류(StageTable type) | **22** | 5 |
| 성장 축 | 아래 20종 | 6 |

**1:1 복제는 불가능하다.** 233개 중 상당수는 과금 구조(상점 7종·패스·VIP·패키지)다.
그래서 "가져올 가치가 있는 것"만 골라 순서를 매긴다.

---

## 1. 성장 — 캐릭터

| 시스템 | Blade Idle 테이블 | 우리 |
|---|---|---|
| 레벨/스탯 | LevelUpTable, LevelStatusTable, PlayerTable | ○ 레벨·스탯포인트 |
| 골드 스탯 | GoldStatusTable, CharacterUpgradeTable | ○ 골드 강화 7종 |
| 경지/랭크 | RankTable, RankRewardTable | ○ 경지 |
| 잠재력 | **PotentialTable** | ✗ |
| 정복자 점수 | **ConquerorPointTable** | ✗ |
| 에테르 | **AetherStatusTable** | ✗ |

## 2. 장비

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 아이템/등급 | ItemTable, GradeTable | ○ 3부위 6등급 |
| 강화 | ItemEnchantTable, ItemSlotEnchantTable | ○ 제련 |
| **옵션 슬롯** | **OptionTable, OptionSlotCountTable** | ✗ 공략의 핵심(슈치뎀 4줄) |
| **세트 효과** | **SetTable, SetAbilTable, SetComponentsTable** | △ 병기보로 일부 |
| **총 레벨 보너스** | **EquipmentTotalLevelTable, GradeTotalLevelTable** | ✗ |
| 갓 등급 강화 | GodEnchantTable | ✗ |
| **초월** | **TranscendenceTable** | ✗ |
| 프리셋 | ItemEquipPresetTable, PresetGroupTable | ✗ (골경작용) |

## 3. 장신구 · 부적 · 칭호

| 시스템 | 테이블 | 우리 |
|---|---|---|
| **장신구** | **AccessoryTable, AccessorySpecialAbillTable, ItemAccEnchantTable, ItemAccUpgradeTable** | ✗ |
| 부적 | TalismanTable, TalismanSpecialAbillTable | ✗ |
| 칭호 | TitleTable, TitleEnchantTable | ✗ |

## 4. 에고 (전용 무기)

EgoUpgradeTable, EgoEnchantTable, EgoBonusTable — ✗ 없음.
공략에서 "길고 긴 튜토리얼이 끝나고 시작하는 본게임"이라 부르는 것.

## 5. 유물 · 룬 · 오파츠

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 유물 | ArtifactTable, ArtifactLevelTable | ○ 신물 8종 |
| **룬** | RuneCostTable, RuneEnchantTable, RuneEssenceTable, RuneExpTable, RuneLimitBreakTable | ✗ |
| 고대 룬 | AncientRuneEnchantTable, AncientRuneLimitBreakTable | ✗ |
| 오파츠 | OopartChangeTable, OopartEnchantTable, OopartRestoreTable | ✗ |

## 6. 피규어 (보유만 해도 공격력 ×14.78)

FigurePriceTable, FigureEnchantTable, FigureBulkSaleTable,
FigureResonanceSlotTable, FigureResonanceStone{Enchant,Level,Upgrade}Table — ✗ 없음.
병기보가 이 발상의 축소판이다.

## 7. 펫 · 정령

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 펫 | PetTable, PetTypeTable, PetSpecialAbilTable | ○ 영수 |
| 친밀도 | PetIntimacyTable, PetIntimacyOptionTable | ○ 교감 |
| 각인 | PetEngrave{Level,PageInfo,PageUpgrade,SlotBonus}Table | △ 각인 1단계만 |
| **정령** | Spirit{Bless,BlessBoost,BlessLevel,Choice,Gacha,Status}Table | ✗ |

## 8. 스킬

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 스킬/레벨업 | SkillTable, SkillLevelUpTable | ○ 14종 |
| 슬롯 | SkillSlotTable | △ 4칸 고정 |
| **총 레벨 보너스** | **SkillTotalLevelTable** | ✗ |
| **초월** | **SkillTranscendenceTable** | ✗ |
| 투사체 | ProjectileTable | ○ 동작 6종 추가 완료 |
| 군중제어 | CrowdControlTable | △ 빙결만 |

## 9. 문장 · 인장 · 카드 · 별자리

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 문장 | EmblemTable | ✗ |
| 인장(패턴) | PatternTable, PatternAwakenTable, PatternMixTable | ✗ |
| 봉인 | SealedForceTable, SealEnchantTable, EternalSeal{,Enchant,Exp}Table | ✗ |
| 코어 카드 | CoreCardTable, CoreOpenTable | ✗ |
| 몬스터 카드 | MonsterCardTable, MonsterCardEnchantTable | ✗ |
| 별자리 | ConstellationTable | ✗ |

## 10. 코스튬 · 스킨

SkinInfoTable, SkinOptionTable, GroupSkinOptionTable, CostumeEnchantTable — ✗ 없음.
공략 기준 **코어공격력 +210%**가 여기서 나온다. 전부 "보유 효과".

## 11. 제작 · 연금

AlchemyTable, AlchemyAbilTable, Production{Info,Material,Reward}Table,
DecoAwakeTable, DecoGrindingTable — ✗ 없음.

## 12. 콘텐츠

| 콘텐츠 | 테이블 | 우리 |
|---|---|---|
| 메인 스테이지 | StageTable, ChapterTable, MapTable | ○ 관문 |
| 웨이브 | WaveGroupTable, WaveRewardTable, SpawnPositionTable | △ 단일 웨이브 |
| 몬스터 | MonsterTable, MonsterPoolTable | ○ |
| 재화 던전 | Asset{Dungeon,Box,BoxReward,Status,}Table | ○ 비경 4종 |
| 레이드 | RaidBossTable | ○ 토벌 |
| **도플갱어** | **Doppelganger/DoppelTier/DoppelTierRewardTable** | ✗ 주간 PvP 콘텐츠 |
| 길드 | GuildBossStep, GuildDraw, GuildHunting×3, GuildMark, GuildMembersRank, GuildRankReward | △ 문파(기부·토벌) |
| **광산** | MineTable, MinerTable | ✗ 방치 수급 |
| **균열** | Rift{Parts,Slot,TicketReward}Table | ✗ |
| **저주탑** | CurseTable | ✗ 유일하게 보스 수치가 들어있는 콘텐츠 |
| **보물찾기** | Treasure{Drop}Table, Treasurehunt{Boss,Master}Table | ✗ |
| 돌파 | BreakthroughStepTable, BreakBoostTable | ✗ |
| 두루마리 | Scroll{,Stage,Reward,BonusReward,Penalty,Setting}Table | ✗ |
| 사신 | Reaper{Collection,Item,LvDrop}Table | ✗ |
| **도서관(도감)** | LibraryTable, LibraryExchangeTable | △ 병기보 |
| 점술 | FortuneTellingTable | ✗ |

## 13. 경제 · 상점 · 일일

| 시스템 | 테이블 | 우리 |
|---|---|---|
| 상점 | ShopTable, Goblin{Shop,ShopSlot,VipLevel,VipShop}Table | ✗ |
| 뽑기 | GachaLvUpTable | △ 등급 확률만 (**달성 보상 없음**) |
| 상자 | Random/Selection/Multiple/BoxSweepAbilityTable | △ |
| 보상 | DropTable, RewardTable, TierRewardTable, StageRewardTable | ○ |
| 퀘스트 | Quest{,Board,Mission}Table, ItemQuestTable | ○ 일일 의뢰 |
| 패스 | PassEventTable, PassQuestTable, EventBladePassTable | ✗ |
| 출석 | AttendanceTable, AttendanceTypeTable | ○ 연공 일지 |
| **광고 버프** | **AdBuffTable** | ○ |
| 패키지 버프 | PackageBuffTable | ✗ (과금) |

---

## 가져올 순서 (과금 구조 제외)

**1순위 — 공략이 "필수"라고 부른 것**

1. **장비 옵션 슬롯** (OptionTable/OptionSlotCountTable) — 공략 분량의 1/3이 이것. 4슬롯 전부 신화 이상이면 보유 효과 발동
2. **장신구** (AccessoryTable + 초월) — "초월 하느냐 안 하느냐의 차이가 어마어마"
3. **피규어** (FigureTable) — 등급별 1개씩 보유만 해도 공격력 ×14.78
4. **코스튬 보유 효과** (SkinOptionTable) — 코어공격력 +210%

**2순위 — 성장 축을 늘리는 것**

5. **뽑기 레벨 달성 보상** (GachaLvUpTable) — "소환레벨 6에 전설 선택상자 21개"
6. **스킬 초월 + 총 레벨 보너스** (SkillTranscendence/TotalLevel)
7. **장비 세트 효과 + 총 레벨 보너스**
8. **에고** (전용 무기, 갓3 이상 장비를 먹여 성장)

**3순위 — 콘텐츠**

9. **웨이브** (WaveGroupTable) — 한 관문을 4웨이브로
10. **도플갱어** (주간 티어 PvP)
11. **광산** (방치 수급)
12. **저주탑 / 균열 / 보물찾기**

**빼는 것**: 상점 7종, 패스, VIP, 패키지, 점술, 사신, 두루마리, 별자리, 카드 2종,
룬·고대룬·오파츠(유물과 중복), 정령(펫과 중복).
2인용 게임에 과금 구조와 중복 성장축은 필요 없다.


---

## 적용 기록

### 1순위 — 2026-10-18 전부 완료

| # | 시스템 | 어디에 | 공략 수치와 대조 |
|---|---|---|---|
| 1 | **장비 옵션 칸** | 병기 탭 | 네 칸 천품 공격력 9.00배, 치명 5→17%, 치명피해 1.50→2.50배 |
| 2 | **장신구** | 병기 탭 | 전설 6성6초월 +1524% ≈ 신품 6성3초월 +1559% ≈ 천품 6성1초월 +1514% — 공략의 등가 성립. 초월 유무 4.30배 |
| 3 | **인물도감** (피규어) | 영수 탭 | 전부 채우면 **공격력 14.78배 / 체력 6.16배** — 공략의 14.78 / 6.13과 일치 |
| 4 | **의복** (코스튬) | 영수 탭 | 전부 보유 시 공격력 **+210%** · 은자 +30%, 총 비용 **원보 275,000** — 공략과 일치 |

설계상 중요한 점:

- **①은 '좋은 옵션 하나'보다 '네 칸을 채우는 것'이 먼저가 되게 만든다.**
  다시 굴리는 값이 잠근 칸 수에 따라 2.2배씩 오른다. 공략의
  "자물쇠가 안 잠겨있을 때 제일 저렴하다"를 그대로 옮긴 것.
- **②는 승급(성)과 초월을 따로 쌓는다.** 등급 배수를 1.66으로 풀어
  공략의 등가 관계가 성립하게 맞췄다.
- **③④는 '갖고만 있어도' 붙는다.** 장착 슬롯 경쟁이 없으니 모으는 것
  자체가 성장이고, 뽑기를 돌릴 이유가 영구히 생긴다.

수치는 전부 공략의 결과에서 **역산**했다. 추측으로 정하지 않았다.

### 2순위 — 2026-10-19 전부 완료

| # | 시스템 | 어디에 | 핵심 |
|---|---|---|---|
| 5 | **소환 레벨 + 달성 보상** | 병기·영수·신물 | 레벨이 상위 등급을 연다. 진품 2 / 보품 5 / 신품 9 / **천품 12레벨** — 공략의 "갓1등급은 12레벨 이후" 그대로 |
| 6 | **무공 초월 + 총 연마** | 무공 탭 | 칸이 넷인데 무공이 열넷이라, 총 연마 보너스가 없으면 열 개는 영영 1레벨. 14무공 65레벨이면 공격력 5.00배 |
| 7 | **장비 세트 + 총 제련** | 병기 탭 | 세트는 세 부위 **최저** 등급 기준. 한 부위만 좋아선 안 붙는다 |
| 8 | **심검** (에고) | 병기 탭 | 보품 이상 장비를 먹여 키운다. 남은 양보다 많이 먹이면 넘치는 만큼 사라진다 — 공략의 "엄청난 낭비" |

### 덤: 시뮬레이터 두 가지를 고쳤다

1. **결과가 매번 달랐다.** `Game` 생성자가 `Math.random`으로 첫 스폰을 끝낸 뒤에야
   시드 rng로 갈아끼우기 때문이었다. 첫 적 위치가 달라지면 그 뒤가 전부 갈린다.
   시드로 다시 깔게 하니 같은 조건에서 233/233/233으로 같아졌다.
   **이전까지의 밸런스 비교 숫자들은 이 편차를 포함한 값이다.**
2. 1순위에서 넣은 소비 로직이 매 초 돌아 3시간 시뮬이 10분을 넘겼다.
   무거운 것만 1분 주기로 떼어내 19초로 되돌렸다.
