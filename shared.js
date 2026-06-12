/**
 * ArenaPlay Shared Data Layer
 * Single source of truth for all localStorage operations across all pages.
 * Include this in every HTML page: <script src="shared.js"></script>
 */

const KEYS = {
  USERS:         'arenaplay_users',
  SESSION:       'arenaplay_session',
  REMEMBER:      'arenaplay_remember',
  DEPOSITS:      'arenaplay_deposits',
  WITHDRAWALS:   'arenaplay_withdraws',
  TOURNAMENTS:   'arenaplay_tournaments',
  SETTINGS:      'arenaplay_settings',
  ANNOUNCEMENTS: 'arenaplay_announcements',
  ADMIN_SESSION: 'arenaplay_admin_session',
  AUDIT_LOG:     'arenaplay_admin_audit',
  GAME_HISTORY:  'arenaplay_game_history',
};

const DB = {
  _get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  },

  /* ── USERS ── */
  getUsers()          { return this._get(KEYS.USERS, {}); },
  saveUsers(u)        { this._set(KEYS.USERS, u); },
  getUser(id)         { return this.getUsers()[id] || null; },
  saveUser(user)      { const u = this.getUsers(); u[user.id] = user; this.saveUsers(u); },

  /* ── SESSION ── */
  getSession()        { return localStorage.getItem(KEYS.SESSION); },
  setSession(id)      { localStorage.setItem(KEYS.SESSION, id); },
  clearSession()      { localStorage.removeItem(KEYS.SESSION); localStorage.removeItem(KEYS.REMEMBER); },

  /* ── CURRENT USER (shortcut) ── */
  currentUser() {
    const id = this.getSession();
    if (!id) return null;
    return this.getUser(id);
  },
  saveCurrentUser(user) {
    const id = this.getSession();
    if (!id) return;
    user.id = id;
    this.saveUser(user);
  },

  /* ── BALANCE ── */
  getBalance() {
    const u = this.currentUser();
    return u ? (u.balance || 0) : 0;
  },
  updateBalance(newBal) {
    const u = this.currentUser();
    if (!u) return;
    u.balance = Math.max(0, newBal);
    this.saveCurrentUser(u);
  },
  adjustBalance(delta) {
    this.updateBalance(this.getBalance() + delta);
  },

  /* ── GAME HISTORY ── */
  getGameHistory() {
    const u = this.currentUser();
    return u ? (u.gameHistory || []) : [];
  },
  pushGameRound(round) {
    const u = this.currentUser();
    if (!u) return;
    u.gameHistory = u.gameHistory || [];
    u.gameHistory.unshift(round);
    if (u.gameHistory.length > 100) u.gameHistory = u.gameHistory.slice(0, 100);
    // update stats
    u.totalWagered = (u.totalWagered || 0) + round.bet;
    if (round.profit > 0) {
      u.totalWins = (u.totalWins || 0) + 1;
      if (round.cashoutMultiplier > (u.biggestMultiplier || 0)) {
        u.biggestMultiplier = round.cashoutMultiplier;
        u.biggestWin = round.profit;
      }
    }
    this.saveCurrentUser(u);
  },

  /* ── DEPOSITS ── */
  getDeposits()          { return this._get(KEYS.DEPOSITS, []); },
  saveDeposits(d)        { this._set(KEYS.DEPOSITS, d); },
  submitDeposit(depObj) {
    const u = this.currentUser();
    if (!u) return null;
    const dep = {
      id: 'DEP' + Date.now(),
      userId: u.id,
      username: u.username,
      email: u.email,
      ...depObj,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    };
    // Save to global deposits list (for admin)
    const deps = this.getDeposits();
    deps.unshift(dep);
    this.saveDeposits(deps);
    // Also save to user's own history
    u.depositHistory = u.depositHistory || [];
    u.depositHistory.unshift(dep);
    this.saveCurrentUser(u);
    // Notification to user
    this.pushNotification(u.id, { type:'deposit', title:'Deposit Submitted', message:`Your deposit of PKR ${dep.amount.toLocaleString()} is pending admin review.`, icon:'💳' });
    return dep;
  },
  approveDeposit(depId, adminNote = '') {
    const deps = this.getDeposits();
    const dep = deps.find(d => d.id === depId);
    if (!dep || dep.status !== 'pending') return false;
    dep.status = 'approved';
    dep.approvedAt = new Date().toISOString();
    dep.adminNote = adminNote;
    this.saveDeposits(deps);
    // Credit user balance
    const users = this.getUsers();
    if (users[dep.userId]) {
      users[dep.userId].balance = (users[dep.userId].balance || 0) + dep.amount;
      users[dep.userId].depositHistory = (users[dep.userId].depositHistory || []).map(d => d.id === depId ? dep : d);
    }
    this.saveUsers(users);
    this.pushNotification(dep.userId, { type:'deposit', title:'Deposit Approved! 💰', message:`PKR ${dep.amount.toLocaleString()} has been added to your balance.`, icon:'✅' });
    this.writeAudit(`Approved deposit ${depId} for ${dep.username} — PKR ${dep.amount}`);
    return true;
  },
  rejectDeposit(depId, reason = '') {
    const deps = this.getDeposits();
    const dep = deps.find(d => d.id === depId);
    if (!dep || dep.status !== 'pending') return false;
    dep.status = 'rejected';
    dep.rejectedAt = new Date().toISOString();
    dep.rejectionReason = reason;
    this.saveDeposits(deps);
    const users = this.getUsers();
    if (users[dep.userId]) {
      users[dep.userId].depositHistory = (users[dep.userId].depositHistory || []).map(d => d.id === depId ? dep : d);
    }
    this.saveUsers(users);
    this.pushNotification(dep.userId, { type:'deposit', title:'Deposit Rejected', message:`Your deposit of PKR ${dep.amount.toLocaleString()} was rejected. Reason: ${reason || 'Contact support.'}`, icon:'❌' });
    this.writeAudit(`Rejected deposit ${depId} for ${dep.username} — Reason: ${reason}`);
    return true;
  },

  /* ── WITHDRAWALS ── */
  getWithdrawals()       { return this._get(KEYS.WITHDRAWALS, []); },
  saveWithdrawals(w)     { this._set(KEYS.WITHDRAWALS, w); },
  submitWithdrawal(wdObj) {
    const u = this.currentUser();
    if (!u) return null;
    if (u.balance < wdObj.amount) return null;
    const wd = {
      id: 'WD' + Date.now(),
      userId: u.id,
      username: u.username,
      email: u.email,
      ...wdObj,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
      proofNote: null,
    };
    // Hold balance
    u.balance -= wd.amount;
    u.withdrawHistory = u.withdrawHistory || [];
    u.withdrawHistory.unshift(wd);
    this.saveCurrentUser(u);
    const wds = this.getWithdrawals();
    wds.unshift(wd);
    this.saveWithdrawals(wds);
    this.pushNotification(u.id, { type:'withdraw', title:'Withdrawal Requested', message:`Your withdrawal of PKR ${wd.amount.toLocaleString()} is pending review.`, icon:'💸' });
    return wd;
  },
  approveWithdrawal(wdId, proofNote = '') {
    const wds = this.getWithdrawals();
    const wd = wds.find(w => w.id === wdId);
    if (!wd || wd.status !== 'pending') return false;
    wd.status = 'approved';
    wd.approvedAt = new Date().toISOString();
    wd.proofNote = proofNote;
    this.saveWithdrawals(wds);
    const users = this.getUsers();
    if (users[wd.userId]) {
      users[wd.userId].withdrawHistory = (users[wd.userId].withdrawHistory || []).map(w => w.id === wdId ? wd : w);
    }
    this.saveUsers(users);
    this.pushNotification(wd.userId, { type:'withdraw', title:'Withdrawal Approved! ✅', message:`PKR ${wd.amount.toLocaleString()} has been sent to your account.`, icon:'💸' });
    this.writeAudit(`Approved withdrawal ${wdId} for ${wd.username} — PKR ${wd.amount}`);
    return true;
  },
  rejectWithdrawal(wdId, reason = '') {
    const wds = this.getWithdrawals();
    const wd = wds.find(w => w.id === wdId);
    if (!wd || wd.status !== 'pending') return false;
    wd.status = 'rejected';
    wd.rejectedAt = new Date().toISOString();
    wd.rejectionReason = reason;
    this.saveWithdrawals(wds);
    // Refund
    const users = this.getUsers();
    if (users[wd.userId]) {
      users[wd.userId].balance = (users[wd.userId].balance || 0) + wd.amount;
      users[wd.userId].withdrawHistory = (users[wd.userId].withdrawHistory || []).map(w => w.id === wdId ? wd : w);
    }
    this.saveUsers(users);
    this.pushNotification(wd.userId, { type:'withdraw', title:'Withdrawal Rejected', message:`Your withdrawal of PKR ${wd.amount.toLocaleString()} was rejected. Funds refunded. Reason: ${reason}`, icon:'❌' });
    this.writeAudit(`Rejected withdrawal ${wdId} for ${wd.username} — Reason: ${reason}`);
    return true;
  },

  /* ── TOURNAMENTS ── */
  getTournaments()       { return this._get(KEYS.TOURNAMENTS, []); },
  saveTournaments(t)     { this._set(KEYS.TOURNAMENTS, t); },
  getTournament(id)      { return this.getTournaments().find(t => t.id === id) || null; },
  joinTournament(tId) {
    const u = this.currentUser();
    if (!u) return { ok:false, msg:'Not logged in' };
    const ts = this.getTournaments();
    const t = ts.find(x => x.id === tId);
    if (!t) return { ok:false, msg:'Tournament not found' };
    if (t.status !== 'open') return { ok:false, msg:'Tournament not open' };
    if (t.players && t.players.find(p => p.userId === u.id)) return { ok:false, msg:'Already joined' };
    if (t.maxPlayers && t.players && t.players.length >= t.maxPlayers) return { ok:false, msg:'Tournament full' };
    if (t.entryFee > 0) {
      if ((u.tickets || 0) < t.entryFee) return { ok:false, msg:'Not enough tickets' };
      u.tickets -= t.entryFee;
      this.saveCurrentUser(u);
    }
    t.players = t.players || [];
    t.players.push({ userId: u.id, username: u.username, points: 0, joinedAt: new Date().toISOString() });
    this.saveTournaments(ts);
    this.pushNotification(u.id, { type:'tournament', title:'Tournament Joined! 🏆', message:`You joined "${t.name}". Good luck!`, icon:'✈️' });
    return { ok:true };
  },
  updateTournamentScore(tId, userId, roundPoints) {
    const ts = this.getTournaments();
    const t = ts.find(x => x.id === tId);
    if (!t) return;
    const player = t.players && t.players.find(p => p.userId === userId);
    if (!player) return;
    player.points = (player.points || 0) + roundPoints;
    player.rounds = (player.rounds || 0) + 1;
    if (roundPoints > (player.bestMultiplier || 0)) player.bestMultiplier = roundPoints;
    this.saveTournaments(ts);
  },

  /* ── NOTIFICATIONS ── */
  getNotifications(userId) {
    const users = this.getUsers();
    return (users[userId] && users[userId].notifications) || [];
  },
  pushNotification(userId, notif) {
    const users = this.getUsers();
    if (!users[userId]) return;
    users[userId].notifications = users[userId].notifications || [];
    users[userId].notifications.unshift({ id: Date.now(), ...notif, read: false, time: new Date().toISOString() });
    if (users[userId].notifications.length > 50) users[userId].notifications = users[userId].notifications.slice(0, 50);
    this.saveUsers(users);
  },
  markNotificationsRead(userId) {
    const users = this.getUsers();
    if (!users[userId]) return;
    (users[userId].notifications || []).forEach(n => n.read = true);
    this.saveUsers(users);
  },

  /* ── SETTINGS ── */
  getSettings() {
    return this._get(KEYS.SETTINGS, {
      houseEdge: 5, minBet: 10, maxBet: 10000,
      maintenanceMode: false,
      easypaisa: true, jazzcash: true, bank: true, usdt: true,
      botMin: 8, botMax: 15,
      announcementTicker: '🔥 ArenaPlay — Pakistan\'s #1 Aviator Tournament Game!'
    });
  },
  saveSettings(s) { this._set(KEYS.SETTINGS, s); },

  /* ── ANNOUNCEMENTS ── */
  getAnnouncements()     { return this._get(KEYS.ANNOUNCEMENTS, []); },
  saveAnnouncements(a)   { this._set(KEYS.ANNOUNCEMENTS, a); },
  getActiveAnnouncements() {
    const now = new Date();
    return this.getAnnouncements().filter(a => !a.expiresAt || new Date(a.expiresAt) > now);
  },

  /* ── AUDIT LOG ── */
  writeAudit(action) {
    const log = this._get(KEYS.AUDIT_LOG, []);
    log.unshift({ time: new Date().toISOString(), action });
    if (log.length > 200) log.pop();
    this._set(KEYS.AUDIT_LOG, log);
  },
};

/* ── NAV HELPER: inject logged-in state into any page nav ── */
function initNav() {
  const u = DB.currentUser();
  const navRight = document.getElementById('nav-right') || document.getElementById('navActions');
  if (!navRight) return;
  if (u) {
    const unread = (u.notifications || []).filter(n => !n.read).length;
    navRight.innerHTML = `
      <a href="game.html" class="btn-secondary" style="font-size:13px;padding:8px 16px">✈️ PLAY</a>
      <a href="dashboard.html" class="nav-user-info" style="display:flex;align-items:center;gap:10px;text-decoration:none">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--blue-glow),var(--purple-glow));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;position:relative">
          ${u.username[0].toUpperCase()}
          ${unread > 0 ? `<span style="position:absolute;top:-4px;right:-4px;background:var(--red-crash);color:#fff;font-size:10px;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center">${unread}</span>` : ''}
        </div>
        <span style="font-family:'Rajdhani',sans-serif;font-weight:600;color:var(--green-win)">PKR ${(u.balance||0).toLocaleString()}</span>
      </a>`;
  }
}

/* ── GENERATE REFERRAL CODE ── */
function generateReferralCode() {
  return 'AVT' + Math.random().toString(36).substring(2,7).toUpperCase();
}

/* ── FORMAT HELPERS ── */
const fmt = {
  currency: (n) => 'PKR ' + Number(n || 0).toLocaleString(),
  multiplier: (n) => Number(n || 0).toFixed(2) + 'x',
  timeAgo: (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
    if (d > 0) return d + 'd ago';
    if (h > 0) return h + 'h ago';
    if (m > 0) return m + 'm ago';
    return 'Just now';
  },
  countdown: (isoEnd) => {
    const diff = new Date(isoEnd).getTime() - Date.now();
    if (diff <= 0) return '00:00:00';
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
  }
};