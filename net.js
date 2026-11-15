// Collegamento tra il tavolo (computer) e i telefoni, via PeerJS (WebRTC).
// Con ?peer=host:porta si usa un server di segnalazione locale (serve per le prove).
const PREFIX = 'ridotto1758-';
export function peerOptions() {
  const p = new URLSearchParams(location.search).get('peer');
  if (!p) return { debug: 0 };
  const [host, port] = p.split(':');
  return { host, port: +port || 9000, path: '/', secure: false, debug: 0 };
}
export function randomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

// h: { onOpen(), onMsg(connId, msg), onClose(connId), onError(type) }
export function hostRoom(code, h) {
  let peer = null, n = 0, dead = false, tries = 0;
  const conns = new Map();
  function start() {
    peer = new Peer(PREFIX + code, peerOptions());
    peer.on('open', () => { tries = 0; h.onOpen && h.onOpen(); });
    peer.on('connection', c => {
      const id = 'c' + (++n);
      c.on('open', () => conns.set(id, c));
      c.on('data', d => { if (d && typeof d === 'object') { if (!conns.has(id)) conns.set(id, c); h.onMsg(id, d); } });
      const bye = () => { if (conns.delete(id)) h.onClose(id); };
      c.on('close', bye); c.on('error', bye);
    });
    peer.on('disconnected', () => { if (!dead) setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* riprova al prossimo giro */ } }, 1500); });
    peer.on('error', e => {
      const type = e && e.type || 'errore';
      if (type === 'unavailable-id' && tries++ < 4) { try { peer.destroy(); } catch (x) { /* già chiuso */ } setTimeout(start, 1600); return; }
      if (type === 'peer-unavailable') return;
      h.onError && h.onError(type);
    });
  }
  start();
  return {
    send(id, m) { const c = conns.get(id); if (c && c.open) { try { c.send(m); } catch (e) { /* connessione persa */ } } },
    drop(id) { const c = conns.get(id); if (c) { try { c.close(); } catch (e) { /* già chiusa */ } conns.delete(id); } },
    destroy() { dead = true; try { peer.destroy(); } catch (e) { /* già chiuso */ } },
  };
}

// h: { onState('connecting'|'open'|'lost'|'noroom'), onMsg(msg) }
export function joinRoom(code, h) {
  let peer = null, conn = null, stop = false, timer = null, lastSeen = 0, fails = 0;
  const retry = (ms = 2000) => { if (stop) return; clearTimeout(timer); timer = setTimeout(connect, ms); };
  function connect() {
    if (stop) return;
    try { if (peer) peer.destroy(); } catch (e) { /* già chiuso */ }
    conn = null; h.onState(fails > 2 ? 'noroom' : 'connecting');
    peer = new Peer(peerOptions());
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const giveUp = setTimeout(() => { if (!c.open) { fails++; retry(500); } }, 9000);
      c.on('open', () => { clearTimeout(giveUp); conn = c; fails = 0; lastSeen = Date.now(); h.onState('open'); });
      c.on('data', d => { lastSeen = Date.now(); if (d && typeof d === 'object' && d.t !== 'pong') h.onMsg(d); });
      const bye = () => { clearTimeout(giveUp); if (conn === c) { conn = null; h.onState('lost'); } retry(); };
      c.on('close', bye); c.on('error', bye);
    });
    peer.on('error', e => { if (e && e.type === 'peer-unavailable') fails++; retry(2500); });
    peer.on('disconnected', () => { if (!conn) retry(); });
  }
  connect();
  const beat = setInterval(() => {
    if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) { /* si riconnette */ } if (Date.now() - lastSeen > 14000) { conn = null; h.onState('lost'); retry(100); } }
  }, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !(conn && conn.open)) retry(100); });
  return {
    send(m) { if (conn && conn.open) { try { conn.send(m); return true; } catch (e) { return false; } } return false; },
    close() { stop = true; clearInterval(beat); clearTimeout(timer); try { peer.destroy(); } catch (e) { /* già chiuso */ } },
  };
}
