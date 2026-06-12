/* ════════════════════════════════════════════════════════════════════
   ArenaPlay Tournament Engine  v2.0  |  Phase 4
   Core tournament system: data, logic, admin, events, simulation
   ════════════════════════════════════════════════════════════════════ */

class TournamentEngine {
  constructor() {
    this.K = {
      TOURNAMENTS : 'arenaplay_tournaments',
      PLAYERS     : 'arenaplay_players',
      USER        : 'arenaplay_current_user',
      HISTORY     : 'arenaplay_tournament_history',
      PAYMENTS    : 'arenaplay_payment_requests',
    };
    this._ev = {};
    this.init();
  }

  /* ─── INIT ─────────────────────────────────────────────────── */
  init() {
    if (!this._get(this.K.TOURNAMENTS)) this._seedTournaments();
    if (!this._get(this.K.PLAYERS))     this._seedPlayers();
    if (!this._get(this.K.USER))        this._seedUser();
    if (!this._get(this.K.PAYMENTS))    this._seedPayments();
    this._startSim();
  }

  reset() {
    Object.values(this.K).forEach(k => localStorage.removeItem(k));
    this.init();
  }

  /* ─── STORAGE ───────────────────────────────────────────────── */
  _get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  _set(k, v) { localStorage.setItem(k, JSON.stringify(v)); return v; }

  /* ─── SEED DATA ─────────────────────────────────────────────── */
  _seedTournaments() {
    const N = Date.now(), H = 3600000, D = 86400000;
    this._set(this.K.TOURNAMENTS, [
      /* 1 — Active ticket tournament (featured) */
      {
        id:'TRN_002', name:'🚀 Supersonic Sprint', type:'ticket',
        entryFee:50, prizePool:3150, maxPlayers:100,
        currentPlayers: this._ids(63),
        startTime: N - 30*60000, endTime: N + 3.5*H, status:'active',
        leaderboard: this._lb(63), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[
          {rank:'1',pct:45},{rank:'2',pct:25},{rank:'3',pct:15},
          {rank:'4-5',pct:10},{rank:'6-10',pct:5}
        ],
        featured:true, inviteOnly:false, badge:'TICKET', createdBy:'system',
        description:'Pay 50 tickets to enter. Prize pool grows with every entry.',
      },
      /* 2 — Open freeroll */
      {
        id:'TRN_001', name:'☁️ Daily Skyward Roll', type:'freeroll',
        entryFee:0, prizePool:10, maxPlayers:200,
        currentPlayers: this._ids(47),
        startTime: N + 2*H, endTime: N + 4*H, status:'open',
        leaderboard: this._lb(47), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[
          {rank:'1',pct:50},{rank:'2',pct:25},{rank:'3',pct:15},{rank:'4-10',pct:10}
        ],
        featured:false, inviteOnly:false, badge:'FREE', createdBy:'system',
        description:'Free entry. Top 10 players win ticket prizes. Resets daily.',
      },
      /* 3 — VIP open */
      {
        id:'TRN_003', name:'👑 VIP Elite Champions', type:'vip',
        entryFee:500, prizePool:50000, maxPlayers:50,
        currentPlayers: this._ids(31),
        startTime: N + 6*H, endTime: N + 10*H, status:'open',
        leaderboard: this._lb(31), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[
          {rank:'1',pct:40},{rank:'2',pct:20},{rank:'3',pct:15},
          {rank:'4-5',pct:15},{rank:'6-10',pct:10}
        ],
        featured:true, inviteOnly:false, badge:'VIP', createdBy:'admin',
        description:'Admin-curated VIP tournament. Elite competition, massive prizes.',
      },
      /* 4 — Knockout open */
      {
        id:'TRN_004', name:'⚡ Thunderbolt Knockout', type:'knockout',
        entryFee:100, prizePool:4800, maxPlayers:64,
        currentPlayers: this._ids(48),
        startTime: N + H, endTime: N + 5*H, status:'open',
        leaderboard: this._lb(48), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[{rank:'1',pct:50},{rank:'2',pct:30},{rank:'3-4',pct:20}],
        knockoutConfig:{ roundDuration:15*60000, eliminationsPerRound:12, currentRound:0, totalRounds:4 },
        featured:false, inviteOnly:false, badge:'KNOCKOUT', createdBy:'system',
        description:'Last players standing win. 12 eliminated each round.',
      },
      /* 5 — Completed */
      {
        id:'TRN_005', name:"🌟 Yesterday's Grand Prix", type:'ticket',
        entryFee:200, prizePool:20000, maxPlayers:100,
        currentPlayers: this._ids(100),
        startTime: N-D-4*H, endTime: N-D, status:'completed',
        leaderboard: this._lb(100,true), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[
          {rank:'1',pct:40},{rank:'2',pct:20},{rank:'3',pct:15},{rank:'4-10',pct:25}
        ],
        featured:false, inviteOnly:false, badge:'TICKET', createdBy:'system',
        description:'Completed. Final rankings locked.',
      },
      /* 6 — Upcoming freeroll */
      {
        id:'TRN_006', name:'🌙 Midnight Freebird', type:'freeroll',
        entryFee:0, prizePool:25, maxPlayers:300,
        currentPlayers: this._ids(12),
        startTime: N+18*H, endTime: N+20*H, status:'open',
        leaderboard: this._lb(12), rounds:[], eliminatedPlayers:[],
        prizeDistribution:[{rank:'1',pct:50},{rank:'2',pct:30},{rank:'3-5',pct:20}],
        featured:false, inviteOnly:false, badge:'FREE', createdBy:'system',
        description:"Tonight's expanded free roll — bigger prize pool!",
      },
      /* 7 — Draft VIP */
      {
        id:'TRN_007', name:'🔥 Weekend Inferno', type:'vip',
        entryFee:1000, prizePool:100000, maxPlayers:30,
        currentPlayers:[], startTime: N+2*D, endTime: N+2*D+6*H, status:'draft',
        leaderboard:[], rounds:[], eliminatedPlayers:[],
        prizeDistribution:[
          {rank:'1',pct:50},{rank:'2',pct:25},{rank:'3',pct:15},{rank:'4-5',pct:10}
        ],
        featured:false, inviteOnly:true, badge:'VIP', createdBy:'admin',
        description:'The ultimate weekend showdown. Invite-only VIP.',
      },
    ]);
  }

  _seedPlayers() {
    const ns = ['AceFlyer','SkyHunter','TurboJet','NightOwl','CloudBurst',
      'StormRider','VelocityX','AeroKing','SonicBoom','AltitudeX',
      'ZephyrPro','MachOne','WingWarden','PilotPro','SkyBaron',
      'TornadoAce','StratoFlyer','PlasmaJet','NeonPilot','IronEagle'];
    const av = ['✈️','🚀','🛩️','🦅','⚡','🌪️','💫','🔥','🌟','👑'];
    this._set(this.K.PLAYERS, ns.map((n,i) => ({
      id:`PLR_${String(i+1).padStart(3,'0')}`, username:n, avatar:av[i%av.length],
      balance:Math.floor(Math.random()*10000)+1000,
      tickets:Math.floor(Math.random()*2000)+100,
      totalWins:Math.floor(Math.random()*20), joinedTournaments:[],
    })));
  }

  _seedUser() {
    this._set(this.K.USER, {
      id:'PLR_CURRENT', username:'YoungPilot', avatar:'🎯',
      balance:5000, tickets:750, totalWins:3, joinedTournaments:[],
    });
  }

  _seedPayments() {
    this._set(this.K.PAYMENTS, [
      { id:'PAY_001', userId:'PLR_003', username:'TurboJet', avatar:'🛩️',
        ticketsRequested:1000, amount:10, paymentRef:'TXN-20241201-TJ001',
        note:'EasyPaisa transfer', status:'pending', requestedAt:Date.now()-3600000 },
      { id:'PAY_002', userId:'PLR_007', username:'AeroKing', avatar:'⚡',
        ticketsRequested:5000, amount:50, paymentRef:'TXN-20241201-AK002',
        note:'JazzCash — screenshot shared on WhatsApp', status:'pending', requestedAt:Date.now()-7200000 },
      { id:'PAY_003', userId:'PLR_001', username:'AceFlyer', avatar:'✈️',
        ticketsRequested:500, amount:5, paymentRef:'TXN-20241130-AF003',
        note:'', status:'approved', requestedAt:Date.now()-86400000, processedAt:Date.now()-82800000 },
    ]);
  }

  /* ─── TOURNAMENT CRUD ───────────────────────────────────────── */
  getTournaments()    { return this._get(this.K.TOURNAMENTS) || []; }
  getTournament(id)   { return this.getTournaments().find(t => t.id === id) || null; }

  _save(list) { this._set(this.K.TOURNAMENTS, list); this.emit('tournaments:updated', list); }

  createTournament(data) {
    const list = this.getTournaments();
    const t = { id:`TRN_${Date.now()}`, createdAt:Date.now(),
      currentPlayers:[], leaderboard:[], rounds:[], eliminatedPlayers:[], status:'draft', ...data };
    list.push(t); this._save(list); return t;
  }

  updateTournament(id, patch) {
    const list = this.getTournaments();
    const i = list.findIndex(t => t.id === id);
    if (i===-1) return null;
    list[i] = { ...list[i], ...patch }; this._save(list); return list[i];
  }

  deleteTournament(id) { this._save(this.getTournaments().filter(t => t.id !== id)); }

  /* ─── CURRENT USER ──────────────────────────────────────────── */
  getUser()          { return this._get(this.K.USER); }
  updateUser(patch)  { return this._set(this.K.USER, { ...this.getUser(), ...patch }); }

  /* ─── PLAYERS ───────────────────────────────────────────────── */
  getPlayers()   { return this._get(this.K.PLAYERS) || []; }
  getPlayer(id)  { return id==='PLR_CURRENT' ? this.getUser() : this.getPlayers().find(p=>p.id===id)||null; }

  /* ─── JOIN TOURNAMENT ───────────────────────────────────────── */
  joinTournament(tid, pid='PLR_CURRENT') {
    const t = this.getTournament(tid);
    if (!t)                               return { ok:false, msg:'Tournament not found' };
    if (t.status !== 'open')              return { ok:false, msg:'Tournament not open for entry' };
    if (t.currentPlayers.includes(pid))   return { ok:false, msg:'Already joined' };
    if (t.currentPlayers.length >= t.maxPlayers) return { ok:false, msg:'Tournament is full' };

    const user = this.getUser();
    if (pid==='PLR_CURRENT' && t.entryFee > 0) {
      if (user.tickets < t.entryFee) return { ok:false, msg:'Insufficient tickets' };
      this.updateUser({ tickets: user.tickets - t.entryFee });
    }

    const p = this.getPlayer(pid) || user;
    t.currentPlayers.push(pid);
    t.leaderboard.push({
      playerId:pid, username:p.username, avatar:p.avatar,
      points:0, biggestMultiplier:0, roundsPlayed:0,
      rank:t.currentPlayers.length, prizeWon:0, joinedAt:Date.now(),
    });
    this.updateTournament(tid, { currentPlayers:t.currentPlayers, leaderboard:t.leaderboard });

    if (pid==='PLR_CURRENT') {
      const joined = user.joinedTournaments||[];
      if (!joined.includes(tid)) this.updateUser({ joinedTournaments:[...joined,tid] });
    }
    this.emit('tournament:joined', { tid, pid });
    return { ok:true };
  }

  /* ─── GAMEPLAY RECORDING ────────────────────────────────────── */
  recordRound(tid, bet, mult, pid='PLR_CURRENT') {
    const t = this.getTournament(tid);
    if (!t || t.status!=='active') return null;
    const pts = this.calcPts(bet, mult);
    const lb  = t.leaderboard;
    const ent = lb.find(e=>e.playerId===pid);
    if (!ent) return null;
    const oldRank = ent.rank;
    ent.points += pts;
    ent.roundsPlayed++;
    if (mult > ent.biggestMultiplier) ent.biggestMultiplier = mult;
    lb.sort((a,b) => b.points - a.points);
    lb.forEach((e,i) => { e.rank = i+1; });
    t.rounds.push({ pid, bet, mult, pts, ts:Date.now() });
    this.updateTournament(tid, { leaderboard:lb, rounds:t.rounds });
    this.emit('lb:updated', { tid, leaderboard:lb });
    return { pts, rank:ent.rank, oldRank };
  }

  calcPts(bet, mult) { return Math.round(bet * mult * 100) / 100; }

  /* ─── LEADERBOARD ───────────────────────────────────────────── */
  getLeaderboard(tid) {
    const t = this.getTournament(tid);
    return t ? [...t.leaderboard].sort((a,b) => b.points - a.points) : [];
  }

  getPlayerRank(tid, pid='PLR_CURRENT') {
    const lb = this.getLeaderboard(tid);
    const i  = lb.findIndex(e=>e.playerId===pid);
    return i>=0 ? i+1 : null;
  }

  getPlayerEntry(tid, pid='PLR_CURRENT') {
    return this.getTournament(tid)?.leaderboard.find(e=>e.playerId===pid) || null;
  }

  /* ─── PRIZE DISTRIBUTION ────────────────────────────────────── */
  calcPrizes(t) {
    const lb = [...t.leaderboard].sort((a,b)=>b.points-a.points);
    const prizes = {};
    t.prizeDistribution.forEach(({rank,pct}) => {
      const amt = Math.floor(t.prizePool * pct / 100);
      if (String(rank).includes('-')) {
        const [s,e] = String(rank).split('-').map(Number);
        const per = Math.floor(amt/(e-s+1));
        for (let r=s; r<=e; r++) if (lb[r-1]) prizes[lb[r-1].playerId] = per;
      } else {
        if (lb[parseInt(rank)-1]) prizes[lb[parseInt(rank)-1].playerId] = amt;
      }
    });
    return prizes;
  }

  distributePrizes(tid) {
    const t = this.getTournament(tid);
    if (!t) return null;
    const prizes = this.calcPrizes(t);
    t.leaderboard.forEach(e => { e.prizeWon = prizes[e.playerId]||0; });
    if (prizes['PLR_CURRENT']) {
      const u = this.getUser();
      this.updateUser({ tickets: u.tickets + prizes['PLR_CURRENT'] });
    }
    this.updateTournament(tid, { status:'completed', leaderboard:t.leaderboard, completedAt:Date.now() });
    this._saveHistory(tid, prizes);
    this.emit('tournament:completed', { tid, prizes });
    return prizes;
  }

  _saveHistory(tid, prizes) {
    const t = this.getTournament(tid);
    const h = this._get(this.K.HISTORY)||[];
    h.unshift({
      tournamentId:tid, tournamentName:t?.name, completedAt:Date.now(),
      finalRank: this.getPlayerRank(tid), prizeWon: prizes['PLR_CURRENT']||0,
      totalPlayers: t?.currentPlayers.length,
      points: t?.leaderboard.find(e=>e.playerId==='PLR_CURRENT')?.points||0,
    });
    this._set(this.K.HISTORY, h.slice(0,50));
  }

  getHistory() { return this._get(this.K.HISTORY)||[]; }

  /* ─── ADMIN CONTROLS ────────────────────────────────────────── */
  adminSetStatus(tid, status) {
    const t = this.getTournament(tid);
    if (!t) return { ok:false, msg:'Not found' };
    const valid = { draft:['open'], open:['active','draft'], active:['completed'], completed:[] };
    if (!valid[t.status]?.includes(status))
      return { ok:false, msg:`Cannot go from ${t.status} → ${status}` };
    if (status==='completed') return { ok:true, prizes: this.distributePrizes(tid) };
    return { ok:true, tournament: this.updateTournament(tid,{status,updatedAt:Date.now()}) };
  }

  adminOverridePrize(tid, pid, amount) {
    const t = this.getTournament(tid); if (!t) return null;
    const e = t.leaderboard.find(x=>x.playerId===pid);
    if (e) { e.prizeWon = amount; this.updateTournament(tid,{leaderboard:t.leaderboard}); }
    return e;
  }

  adminBanPlayer(tid, pid) {
    const t = this.getTournament(tid); if (!t) return {ok:false};
    t.currentPlayers = t.currentPlayers.filter(id=>id!==pid);
    t.leaderboard    = t.leaderboard.filter(e=>e.playerId!==pid);
    t.eliminatedPlayers.push({playerId:pid,reason:'banned',ts:Date.now()});
    this.updateTournament(tid,{currentPlayers:t.currentPlayers,leaderboard:t.leaderboard,eliminatedPlayers:t.eliminatedPlayers});
    return {ok:true};
  }

  /* ─── PAYMENT REQUESTS (Manual Payment System) ─────────────── */
  getPayments() { return this._get(this.K.PAYMENTS)||[]; }

  submitPayment(userId, username, avatar, tickets, amount, ref, note='') {
    const list = this.getPayments();
    const req  = { id:`PAY_${Date.now()}`, userId, username, avatar,
      ticketsRequested:tickets, amount, paymentRef:ref, note,
      status:'pending', requestedAt:Date.now() };
    list.unshift(req); this._set(this.K.PAYMENTS,list);
    this.emit('payment:submitted', req); return req;
  }

  adminApprovePayment(payId) {
    const list = this.getPayments();
    const p    = list.find(x=>x.id===payId);
    if (!p || p.status!=='pending') return {ok:false};
    p.status='approved'; p.processedAt=Date.now();
    this._set(this.K.PAYMENTS,list);
    if (p.userId==='PLR_CURRENT') {
      const u = this.getUser();
      this.updateUser({ tickets: u.tickets + p.ticketsRequested });
    }
    this.emit('payment:approved',p); return {ok:true,payment:p};
  }

  adminRejectPayment(payId, reason='') {
    const list = this.getPayments();
    const p    = list.find(x=>x.id===payId);
    if (!p || p.status!=='pending') return {ok:false};
    p.status='rejected'; p.processedAt=Date.now(); p.rejectReason=reason;
    this._set(this.K.PAYMENTS,list); this.emit('payment:rejected',p); return {ok:true};
  }

  /* ─── KNOCKOUT ENGINE ───────────────────────────────────────── */
  processKnockoutRound(tid) {
    const t = this.getTournament(tid);
    if (!t || t.type!=='knockout') return null;
    const cfg = t.knockoutConfig;
    const lb  = [...t.leaderboard].sort((a,b)=>b.points-a.points);
    const out = lb.slice(-cfg.eliminationsPerRound);
    out.forEach(p => t.eliminatedPlayers.push({playerId:p.playerId,round:cfg.currentRound,pts:p.points}));
    t.leaderboard = lb.slice(0, lb.length-cfg.eliminationsPerRound);
    cfg.currentRound++;
    if (t.leaderboard.length<=1 || cfg.currentRound>cfg.totalRounds)
      return this.distributePrizes(tid);
    this.updateTournament(tid,{leaderboard:t.leaderboard,eliminatedPlayers:t.eliminatedPlayers,knockoutConfig:cfg});
    this.emit('knockout:round',{tid,eliminated:out,round:cfg.currentRound});
    return { eliminated:out, round:cfg.currentRound };
  }

  /* ─── STATS & HELPERS ───────────────────────────────────────── */
  getStats() {
    const ts = this.getTournaments();
    return {
      total:ts.length, active:ts.filter(t=>t.status==='active').length,
      open:ts.filter(t=>t.status==='open').length,
      completed:ts.filter(t=>t.status==='completed').length,
      totalPool:ts.filter(t=>t.status!=='completed').reduce((s,t)=>s+t.prizePool,0),
      totalPlayers:ts.reduce((s,t)=>s+t.currentPlayers.length,0),
    };
  }

  getFeatured() {
    const ts = this.getTournaments();
    return ts.find(t=>t.featured && t.status==='active')
        || ts.find(t=>t.featured && t.status==='open')
        || ts.find(t=>t.status==='active')
        || ts.find(t=>t.status==='open')
        || null;
  }

  getJoined(pid='PLR_CURRENT') {
    return this.getTournaments().filter(t=>t.currentPlayers.includes(pid) && t.status!=='completed');
  }

  timeParts(target) {
    const d = Math.max(0, target - Date.now());
    return {
      h: String(Math.floor(d/3600000)).padStart(2,'0'),
      m: String(Math.floor((d%3600000)/60000)).padStart(2,'0'),
      s: String(Math.floor((d%60000)/1000)).padStart(2,'0'),
    };
  }

  timeLeft(endTime) {
    const d = endTime - Date.now();
    if (d<=0) return 'Ended';
    const h=Math.floor(d/3600000), m=Math.floor((d%3600000)/60000), s=Math.floor((d%60000)/1000);
    if (h>0) return `${h}h ${m}m`; if (m>0) return `${m}m ${s}s`; return `${s}s`;
  }

  fmtNum(n) { return n>=1000000 ? (n/1000000).toFixed(1)+'M' : n>=1000 ? (n/1000).toFixed(1)+'K' : String(n); }

  /* ─── GAME.HTML INTEGRATION HELPERS ────────────────────────── */
  // Called by game.html every round in tournament mode
  // Usage: TE.recordRound(TE.getActiveTournamentId(), betAmount, cashoutMultiplier)
  getActiveTournamentId() {
    return this.getJoined()[0]?.id || null;
  }

  isTournamentMode() {
    return this.getJoined().some(t => t.status === 'active');
  }

  // HUD data for game.html overlay
  getHUDData(tid) {
    const t  = this.getTournament(tid); if (!t) return null;
    const lb = this.getLeaderboard(tid);
    const me = lb.find(e=>e.playerId==='PLR_CURRENT');
    return {
      tournamentName : t.name,
      top5           : lb.slice(0,5),
      myRank         : me?.rank || null,
      myPoints       : me?.points || 0,
      timeLeft       : this.timeLeft(t.endTime),
      roundsLeft     : t.knockoutConfig ? (t.knockoutConfig.totalRounds - t.knockoutConfig.currentRound) : null,
      totalPlayers   : t.currentPlayers.length,
    };
  }

  /* ─── SIMULATION (live demo activity) ──────────────────────── */
  _startSim() {
    this._simT = setInterval(() => {
      const active = this.getTournaments().filter(t=>t.status==='active');
      active.forEach(t => {
        if (!t.leaderboard.length) return;
        const lb = t.leaderboard;
        const n  = Math.floor(Math.random()*4)+1;
        for (let i=0;i<n;i++) {
          const idx  = Math.floor(Math.random()*lb.length);
          const bet  = Math.floor(Math.random()*200)+10;
          const mult = parseFloat((Math.random()*9+1.1).toFixed(2));
          lb[idx].points += Math.round(bet*mult);
          lb[idx].roundsPlayed++;
          if (mult>lb[idx].biggestMultiplier) lb[idx].biggestMultiplier=mult;
        }
        lb.sort((a,b)=>b.points-a.points);
        lb.forEach((e,i)=>{e.rank=i+1;});
        this.updateTournament(t.id,{leaderboard:lb});
      });
      this.emit('sim:tick',{});
    },3000);
  }

  stopSim() { clearInterval(this._simT); }

  /* ─── EVENT SYSTEM ──────────────────────────────────────────── */
  on(ev,cb)  { (this._ev[ev]=this._ev[ev]||[]).push(cb); return ()=>this.off(ev,cb); }
  off(ev,cb) { this._ev[ev]=(this._ev[ev]||[]).filter(x=>x!==cb); }
  emit(ev,d) { (this._ev[ev]||[]).forEach(cb=>cb(d)); }

  /* ─── PRIVATE HELPERS ───────────────────────────────────────── */
  _ids(n) { return Array.from({length:n},(_,i)=>`PLR_${String(i+1).padStart(3,'0')}`); }

  _lb(n, done=false) {
    const ns=['AceFlyer','SkyHunter','TurboJet','NightOwl','CloudBurst','StormRider','VelocityX',
      'AeroKing','SonicBoom','AltitudeX','ZephyrPro','MachOne','WingWarden','PilotPro','SkyBaron',
      'TornadoAce','StratoFlyer','PlasmaJet','NeonPilot','IronEagle','LightSpeed','DawnPatrol',
      'SkyGhost','ApexHunter','VortexX','FlightAce','CycloneZ','NovaStar','GlideKing','SwiftWing'];
    const av=['✈️','🚀','🛩️','🦅','⚡','🌪️','💫','🔥','🌟','👑'];
    return Array.from({length:n},(_,i)=>({
      playerId:`PLR_${String(i+1).padStart(3,'0')}`,
      username: ns[i%ns.length]+(i>=ns.length?`_${Math.floor(i/ns.length)}`:''),
      avatar: av[i%av.length],
      points: done ? Math.floor(Math.random()*50000)+5000 : Math.floor(Math.random()*15000)+100,
      biggestMultiplier: parseFloat((Math.random()*14+1.1).toFixed(2)),
      roundsPlayed: Math.floor(Math.random()*50)+1,
      rank:i+1, prizeWon:0,
    })).sort((a,b)=>b.points-a.points).map((e,i)=>({...e,rank:i+1}));
  }
}

/* ─── GLOBAL INSTANCE ──────────────────────────────────────────── */
window.TE = new TournamentEngine();