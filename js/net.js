// Firebase 연동: 익명 로그인, 프로필·서열, 문파·채팅, 문파 토벌.
// SDK를 동적으로 불러오므로 실패해도 혼자 하기는 그대로 동작한다.
import { firebaseConfig, FIREBASE_SDK_VERSION } from './firebase-config.js';
import { dayKey } from './game.js';
import {
  EQUIP_TYPES, PETS, GUILD_MAX, GUILD_CHECKIN_EXP, GUILD_DONATE_GEMS, GUILD_DONATE_EXP, RAID_HP_SECONDS, raidReward,
} from './data.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const PROFILE_INTERVAL = 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class Net {
  constructor(game, { onChange } = {}) {
    this.game = game;
    this.onChange = onChange || (() => {});
    this.status = 'connecting';
    this.uid = null;
    this.guild = null;
    this.messages = [];
    this.raid = null;
    this.unsubs = [];
    this.lastProfile = 0;
  }

  get online() { return this.status === 'online'; }

  changed(what) { this.onChange(what); }

  async init() {
    try {
      const [appM, authM, fs] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
      ]);
      this.fs = fs;
      const app = appM.initializeApp(firebaseConfig);
      this.auth = authM.getAuth(app);
      this.db = fs.getFirestore(app);
      const emu = new URLSearchParams(location.search).get('emu');
      if (emu) {
        const host = emu === '1' ? '127.0.0.1' : emu;
        authM.connectAuthEmulator(this.auth, `http://${host}:9099`, { disableWarnings: true });
        fs.connectFirestoreEmulator(this.db, host, 8080);
      }
      const cred = await authM.signInAnonymously(this.auth);
      this.uid = cred.user.uid;
      this.status = 'online';
      this.changed('status');
      await this.pushProfile(true);
      if (this.game.s.guildId) this.watchGuild(this.game.s.guildId);
    } catch (err) {
      console.warn('[net] offline:', err?.message || err);
      this.status = 'offline';
      this.changed('status');
    }
  }

  ref(...path) { return this.fs.doc(this.db, ...path); }

  // ---------- 프로필 / 서열 ----------
  profileData() {
    const g = this.game;
    const p = g.power();
    const best = Object.fromEntries(Object.keys(EQUIP_TYPES).map((t) => [t, g.bestGrade(t)]));
    const pet = PETS.find((x) => x.id === g.s.pet);
    return {
      nickname: g.s.nickname || '이름없음',
      power: p.power, dps: p.dps, atk: p.atk, hp: p.hp,
      crit: p.crit, critDmg: p.critDmg, speed: p.speed, petHit: p.petHit,
      maxStage: g.s.maxStage, bestStage: g.s.bestStage, stage: g.s.stage, level: g.s.level, rank: g.s.rank,
      regress: g.s.regress.count,
      pet: pet?.id || null, petLv: pet ? g.s.pets[pet.id] : 0, petEmoji: pet?.emoji || null,
      weaponGrade: best.weapon, enhance: { ...g.s.enhance },
      pvp: { ...g.s.pvp },
      best, skills: { ...g.s.skills }, skillSlots: [...g.s.skillSlots], upgrades: { ...g.s.upgrades },
      guildId: g.s.guildId || null, guildName: this.guild?.name || null,
      updatedAt: this.fs.serverTimestamp(),
    };
  }

  async pushProfile(force = false) {
    if (!this.online || !this.game.s.nickname) return;
    const now = Date.now();
    if (!force && now - this.lastProfile < PROFILE_INTERVAL) return;
    this.lastProfile = now;
    try {
      await this.fs.setDoc(this.ref('players', this.uid), this.profileData(), { merge: true });
    } catch (err) {
      console.warn('[net] profile', err);
    }
  }

  async ranking() {
    const { collection, query, orderBy, limit, getDocs } = this.fs;
    const snap = await getDocs(query(collection(this.db, 'players'), orderBy('power', 'desc'), limit(50)));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  async player(uid) {
    const snap = await this.fs.getDoc(this.ref('players', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  }

  // ---------- 문파 ----------
  async createGuild(name) {
    const { runTransaction, serverTimestamp } = this.fs;
    const nick = this.game.s.nickname;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      const ref = this.ref('guilds', code);
      const ok = await runTransaction(this.db, async (tx) => {
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, {
          name, code, owner: this.uid,
          memberIds: [this.uid], members: { [this.uid]: nick },
          exp: 0, checkins: {}, createdAt: serverTimestamp(),
        });
        return true;
      });
      if (ok) return this.enterGuild(code);
    }
    throw new Error('문파 코드를 만들지 못했어요. 다시 시도해 주세요.');
  }

  async joinGuild(rawCode) {
    const code = rawCode.trim().toUpperCase();
    const { runTransaction } = this.fs;
    const ref = this.ref('guilds', code);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('그런 문파 코드가 없어요.');
      const g = snap.data();
      if (g.memberIds.includes(this.uid)) return;
      if (g.memberIds.length >= GUILD_MAX) throw new Error(`문파가 가득 찼어요 (최대 ${GUILD_MAX}명).`);
      tx.update(ref, {
        memberIds: [...g.memberIds, this.uid],
        members: { ...g.members, [this.uid]: this.game.s.nickname },
      });
    });
    return this.enterGuild(code);
  }

  async enterGuild(code) {
    this.game.s.guildId = code;
    this.watchGuild(code);
    await this.pushProfile(true);
    this.changed('guild');
  }

  async leaveGuild() {
    const gid = this.game.s.guildId;
    if (!gid) return;
    const { updateDoc, arrayRemove, deleteField } = this.fs;
    try {
      await updateDoc(this.ref('guilds', gid), {
        memberIds: arrayRemove(this.uid),
        [`members.${this.uid}`]: deleteField(),
      });
    } finally {
      this.stopWatching();
      this.game.s.guildId = null;
      this.game.guildExp = 0;
      this.guild = null;
      this.messages = [];
      this.raid = null;
      await this.pushProfile(true);
      this.changed('guild');
    }
  }

  stopWatching() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  watchGuild(gid) {
    if (!this.online) return;
    this.stopWatching();
    const { onSnapshot, collection, query, orderBy, limit } = this.fs;
    this.unsubs.push(onSnapshot(this.ref('guilds', gid), (snap) => {
      if (!snap.exists() || !snap.data().memberIds.includes(this.uid)) {
        // 문파가 사라졌거나 내보내졌을 때
        this.stopWatching();
        this.game.s.guildId = null;
        this.game.guildExp = 0;
        this.guild = null;
        this.changed('guild');
        return;
      }
      const prevName = this.guild?.name;
      this.guild = { id: gid, ...snap.data() };
      this.game.guildExp = this.guild.exp || 0;
      if (prevName !== this.guild.name) this.pushProfile(true);
      this.changed('guild');
    }, (err) => console.warn('[net] guild', err)));

    this.unsubs.push(onSnapshot(
      query(collection(this.db, 'guilds', gid, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
      (snap) => {
        this.messages = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse();
        this.changed('chat');
      },
      (err) => console.warn('[net] chat', err),
    ));

    this.watchRaid(gid);
  }

  watchRaid(gid) {
    const day = dayKey();
    this.raidDay = day;
    const unsub = this.fs.onSnapshot(this.ref('guilds', gid, 'raids', day), (snap) => {
      this.raid = snap.exists() ? { id: day, ...snap.data() } : null;
      this.changed('raid');
    }, (err) => console.warn('[net] raid', err));
    this.unsubs.push(unsub);
  }

  // 날짜가 바뀌면 새 토벌 문서를 본다
  refreshDay() {
    if (this.guild && this.raidDay !== dayKey()) this.watchGuild(this.guild.id);
  }

  async sendChat(text, type = 'chat') {
    const clean = text.trim().slice(0, 200);
    if (!clean || !this.guild) return;
    await this.fs.addDoc(this.fs.collection(this.db, 'guilds', this.guild.id, 'messages'), {
      uid: this.uid, name: this.game.s.nickname, text: clean, type, createdAt: this.fs.serverTimestamp(),
    });
  }

  checkedInToday() {
    return this.guild?.checkins?.[this.uid] === dayKey();
  }

  async checkin() {
    if (!this.guild || this.checkedInToday()) return false;
    await this.fs.updateDoc(this.ref('guilds', this.guild.id), {
      exp: this.fs.increment(GUILD_CHECKIN_EXP),
      [`checkins.${this.uid}`]: dayKey(),
    });
    return true;
  }

  async donate() {
    if (!this.guild || this.game.s.gems < GUILD_DONATE_GEMS) return false;
    this.game.s.gems -= GUILD_DONATE_GEMS;
    try {
      await this.fs.updateDoc(this.ref('guilds', this.guild.id), { exp: this.fs.increment(GUILD_DONATE_EXP) });
    } catch (err) {
      this.game.s.gems += GUILD_DONATE_GEMS;
      throw err;
    }
    return true;
  }

  // ---------- 토벌 ----------
  async ensureRaid() {
    if (!this.guild) throw new Error('문파에 먼저 들어가 주세요.');
    const day = dayKey();
    const ref = this.ref('guilds', this.guild.id, 'raids', day);
    const existing = await this.fs.getDoc(ref);
    if (existing.exists()) return { id: day, ...existing.data() };

    // 문파원들의 DPS 합으로 오늘 두목 체력을 정한다
    const profiles = await Promise.all(this.guild.memberIds.map((id) => this.player(id).catch(() => null)));
    const mine = this.game.power().dps;
    const sum = profiles.reduce((acc, p) => acc + (p?.uid === this.uid ? mine : (p?.dps || 0)), 0) || mine;
    const maxHp = Math.max(1000, sum * RAID_HP_SECONDS);
    await this.fs.runTransaction(this.db, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      tx.set(ref, {
        maxHp, total: 0, damage: {}, names: {}, claimed: {}, killedAt: null,
        createdAt: this.fs.serverTimestamp(),
      });
    });
    const snap = await this.fs.getDoc(ref);
    return { id: day, ...snap.data() };
  }

  async commitRaidDamage(amount, raidId) {
    if (!this.guild || !(amount > 0)) return null;
    const ref = this.ref('guilds', this.guild.id, 'raids', raidId);
    const killed = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const r = snap.data();
      if (r.total >= r.maxHp) return false;
      const total = Math.min(r.maxHp, r.total + amount);
      const update = {
        total,
        [`damage.${this.uid}`]: (r.damage?.[this.uid] || 0) + amount,
        [`names.${this.uid}`]: this.game.s.nickname,
      };
      const nowKilled = total >= r.maxHp;
      if (nowKilled) update.killedAt = this.fs.serverTimestamp();
      tx.update(ref, update);
      return nowKilled;
    });
    if (killed) {
      await this.sendChat(`🐲 ${this.game.s.nickname}님이 마무리 일격! 오늘의 토벌 두목 처치! 보상을 받아 가세요.`, 'system')
        .catch(() => {});
    }
    return killed;
  }

  canClaimRaid() {
    const r = this.raid;
    return !!(r && r.total >= r.maxHp && (r.damage?.[this.uid] || 0) > 0 && !r.claimed?.[this.uid]);
  }

  async claimRaid() {
    if (!this.guild || !this.raid) return null;
    const ref = this.ref('guilds', this.guild.id, 'raids', this.raid.id);
    const ok = await this.fs.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      const r = snap.data();
      if (!r || r.total < r.maxHp || !(r.damage?.[this.uid] > 0) || r.claimed?.[this.uid]) return false;
      tx.update(ref, { [`claimed.${this.uid}`]: true });
      return true;
    });
    if (!ok) return null;
    return this.game.grant(raidReward(this.game.s.maxStage));
  }
}
