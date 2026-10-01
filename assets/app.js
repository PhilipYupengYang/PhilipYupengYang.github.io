// Renders the page from /content/*.json (edited through Pages CMS) and runs the hero graph.
(async function () {
  const load = (f) => fetch(`content/${f}.json`, { cache: 'no-cache' }).then((r) => r.json());
  const [profile, projects, leadership, writing, honors] = await Promise.all(
    ['profile', 'projects', 'leadership', 'writing', 'honors'].map(load)
  );

  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') n.textContent = v;
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    }
    [].concat(kids).filter(Boolean).forEach((c) => n.append(c));
    return n;
  };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // simple bindings: data-bind="key", data-bind-href="key" or "key:mailto"
  document.querySelectorAll('[data-bind]').forEach((n) => { n.textContent = profile[n.dataset.bind] || ''; });
  document.querySelectorAll('[data-bind-href]').forEach((n) => {
    const [key, scheme] = n.dataset.bindHref.split(':');
    const v = profile[key];
    if (v) n.href = scheme ? `${scheme}:${v}` : v; else n.remove();
  });
  document.title = profile.shortName;
  document.getElementById('year').textContent = new Date().getFullYear();

  // now
  const nowList = document.getElementById('now-list');
  (profile.now || []).forEach((t) => nowList.append(el('li', { text: t })));

  // projects
  const stats = (list) => (list && list.length
    ? el('ul', { class: 'stats' }, list.map((s) => el('li', {}, [el('b', { text: s.value }), el('span', { text: s.label })])))
    : null);
  const link = (p) => (p.linkUrl
    ? el('a', { class: 'textlink', href: p.linkUrl, target: '_blank', rel: 'noopener', text: p.linkLabel || 'Open' })
    : null);
  const meta = (p) => el('div', { class: 'meta' }, [el('span', { class: 'mono', text: p.dates }), el('span', { text: p.role })]);

  const featured = projects.find((p) => p.featured) || projects[0];
  const rest = projects.filter((p) => p !== featured);
  if (featured) {
    document.getElementById('featured').append(
      el('article', { class: 'featured', id: `p-${slug(featured.title)}` }, [
        el('div', {}, [
          meta(featured),
          el('h3', { text: featured.title }),
          el('p', { class: 'summary', text: featured.summary }),
          link(featured),
          featured.image ? el('img', { class: 'shot', src: featured.image, alt: `${featured.title} screenshot`, loading: 'lazy' }) : null,
        ]),
        stats(featured.stats),
      ])
    );
  }
  const grid = document.getElementById('projects');
  rest.forEach((p) => grid.append(
    el('article', { class: 'project', id: `p-${slug(p.title)}` }, [
      meta(p),
      el('h3', { text: p.title }),
      el('p', { class: 'summary', text: p.summary }),
      p.image ? el('img', { class: 'shot', src: p.image, alt: `${p.title} image`, loading: 'lazy' }) : null,
      stats(p.stats),
      link(p),
    ])
  ));

  // writing
  const wl = document.getElementById('writing-list');
  writing.forEach((w) => wl.append(el('li', {}, [
    el('span', { class: 'mono', text: w.kind }),
    w.url
      ? el('a', { href: w.url, target: '_blank', rel: 'noopener' }, [w.title, el('span', { class: 'ext', text: '(opens in new tab)' })])
      : el('span', { text: w.title }),
  ])));

  // leadership
  const tl = document.getElementById('timeline');
  leadership.forEach((l) => tl.append(el('li', { id: `l-${slug(l.title)}` }, [
    el('span', { class: 'mono muted', text: l.dates }),
    el('h3', { text: l.title }),
    el('p', { class: 'org', text: l.org }),
    el('p', { class: 'sum', text: l.summary }),
  ])));

  // honors marquee (second copy is decorative, for the seamless loop)
  const hl = document.getElementById('honors-list');
  const items = honors.items || [];
  items.forEach((h) => hl.append(el('li', { text: h })));
  items.forEach((h) => hl.append(el('li', { text: h, 'aria-hidden': 'true' })));

  // optional headshot, shown above the contact section
  if (profile.photo) {
    document.getElementById('contact').prepend(el('img', { class: 'avatar', src: profile.photo, alt: `Portrait of ${profile.shortName}`, width: 88, height: 88, loading: 'lazy' }));
  }

  // contact links
  const links = document.getElementById('links');
  const addLink = (label, href) => href && links.append(el('li', {}, el('a', { class: 'btn', href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener', text: label })));
  addLink('GitHub', profile.github);
  addLink('LinkedIn', profile.linkedin);
  addLink('Résumé', profile.resume);
  if (profile.showPhone && profile.phone) addLink(profile.phone, `tel:${profile.phone.replace(/\s/g, '')}`);

  // theme toggle
  document.querySelector('.theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    graph.recolor();
  });

  const graph = buildGraph(document.getElementById('graph'), profile, projects, leadership, slug);
})();

function buildGraph(canvas, profile, projects, leadership, slug) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const topics = profile.interests || [];
  const nodes = [];
  const edges = [];

  topics.forEach((t) => nodes.push({ id: `t:${t}`, label: t, kind: 'topic' }));
  const addItem = (item, kind, target) => {
    const tags = (item.tags || []).filter((t) => topics.includes(t));
    if (!tags.length) return;
    const n = { id: `${kind}:${item.title}`, label: item.short || item.title, kind, target };
    nodes.push(n);
    tags.forEach((t) => edges.push([n, nodes.find((x) => x.id === `t:${t}`)]));
  };
  projects.forEach((p) => addItem(p, 'project', `p-${slug(p.title)}`));
  leadership.forEach((l) => addItem(l, 'role', `l-${slug(l.title)}`));

  let W = 0, H = 0, colors = {}, hover = null, visible = true, t0 = performance.now();
  const pulses = [];

  function recolor() {
    const cs = getComputedStyle(document.documentElement);
    const v = (k) => cs.getPropertyValue(k).trim();
    colors = { text: v('--text'), muted: v('--muted'), line: v('--line'), accent: v('--accent'), surface: v('--surface'), bg: v('--bg') };
    if (reduce) draw(performance.now());
  }

  // topics sit on a fixed ring; each item sits between its topics (or just outside a single one),
  // then items are nudged apart so labels never collide
  function layout() {
    const cx = W / 2, cy = H / 2 - 12, rx = W * 0.33, ry = H * 0.3;
    const tNodes = nodes.filter((n) => n.kind === 'topic');
    tNodes.forEach((n, i) => {
      const a = -Math.PI * 0.75 + (i / tNodes.length) * Math.PI * 2;
      n.x = cx + Math.cos(a) * rx; n.y = cy + Math.sin(a) * ry; n.a = a;
    });
    const perTopic = {};
    nodes.filter((n) => n.kind !== 'topic').forEach((n) => {
      const ts = edges.filter((e) => e[0] === n).map((e) => e[1]);
      if (ts.length > 1) {
        n.x = ts.reduce((s, t) => s + t.x, 0) / ts.length;
        n.y = ts.reduce((s, t) => s + t.y, 0) / ts.length;
      } else {
        const t = ts[0], k = (perTopic[t.id] = (perTopic[t.id] || 0) + 1) - 1;
        const a = t.a + (k % 2 ? -1 : 1) * (0.45 + 0.35 * Math.floor(k / 2));
        n.x = t.x + Math.cos(a) * rx * 0.62; n.y = t.y + Math.sin(a) * ry * 0.7;
      }
    });
    ctx.font = '400 12px "Geist Mono", ui-monospace, monospace';
    nodes.forEach((n) => { n.w = ctx.measureText(n.label).width + (n.kind === 'topic' ? 20 : 0); });
    const box = (n) => {
      const left = n.x > W * 0.62;
      return left ? [n.x - n.w - 18, n.y - 12, n.x + 8, n.y + 12] : [n.x - 8, n.y - 12, n.x + n.w + 18, n.y + 12];
    };
    const free = nodes.filter((n) => n.kind !== 'topic');
    for (let step = 0; step < 200; step++) {
      for (const a of free) for (const b of nodes) {
        if (a === b) continue;
        const A = box(a), B = box(b);
        const ox = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), oy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
        if (ox > 0 && oy > 0) {
          if (oy < ox) a.y += (a.y < b.y ? -1 : 1) * Math.min(oy, 4);
          else a.x += (a.x < b.x ? -1 : 1) * Math.min(ox, 4);
        }
      }
      for (const n of free) {
        const [x0, , x1] = box(n);
        if (x0 < 12) n.x += 12 - x0;
        if (x1 > W - 12) n.x -= x1 - (W - 12);
        n.y = Math.max(24, Math.min(H - 20, n.y));
      }
    }
    nodes.forEach((n, i) => { n.bx = n.x; n.by = n.y; n.phase = i * 1.7; });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw(performance.now());
  }

  const linked = (n) => edges.filter((e) => e.includes(n)).flatMap((e) => e);
  const radius = (n) => (n.kind === 'topic' ? 7 : n.kind === 'project' ? 5 : 4);

  function draw(now) {
    const t = (now - t0) / 1000;
    if (!reduce) nodes.forEach((n) => { n.x = n.bx + Math.sin(t * 0.5 + n.phase) * 3; n.y = n.by + Math.cos(t * 0.4 + n.phase) * 3; });
    ctx.clearRect(0, 0, W, H);
    const focus = hover ? new Set(linked(hover).concat(hover)) : null;

    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const on = focus && focus.has(a) && focus.has(b);
      ctx.strokeStyle = on ? colors.accent : colors.line;
      ctx.globalAlpha = focus && !on ? 0.35 : 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // signals travelling along edges
    if (!reduce) {
      if (Math.random() < 0.04 && pulses.length < 6) {
        const e = edges[(Math.random() * edges.length) | 0];
        pulses.push({ e, p: 0, dir: Math.random() < 0.5 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const s = pulses[i]; s.p += 0.012;
        if (s.p >= 1) { pulses.splice(i, 1); continue; }
        const [a, b] = s.dir ? s.e : [s.e[1], s.e[0]];
        ctx.fillStyle = colors.accent;
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * s.p, a.y + (b.y - a.y) * s.p, 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    for (const n of nodes) {
      const dim = focus && !focus.has(n);
      ctx.globalAlpha = dim ? 0.35 : 1;
      const r = radius(n);
      ctx.beginPath(); ctx.arc(n.x, n.y, r + (n === hover ? 2 : 0), 0, Math.PI * 2);
      if (n.kind === 'topic') { ctx.fillStyle = colors.bg; ctx.fill(); ctx.strokeStyle = colors.accent; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = n.kind === 'project' ? colors.accent : colors.muted; ctx.fill(); }

      ctx.font = n.kind === 'topic' ? '600 15px Geist, system-ui, sans-serif' : '400 12px "Geist Mono", ui-monospace, monospace';
      ctx.fillStyle = n.kind === 'topic' ? colors.text : colors.muted;
      if (n === hover) ctx.fillStyle = colors.text;
      const w = ctx.measureText(n.label).width;
      const lx = n.bx > W * 0.62 ? n.x - r - 8 - w : n.x + r + 8;
      ctx.fillText(n.label, lx, n.y + 4);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) { if (visible) draw(now); requestAnimationFrame(loop); }

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 26;
    for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  canvas.addEventListener('pointermove', (ev) => {
    hover = pick(ev);
    canvas.style.cursor = hover && hover.target ? 'pointer' : 'default';
    if (reduce) draw(performance.now());
  });
  canvas.addEventListener('pointerleave', () => { hover = null; if (reduce) draw(performance.now()); });
  canvas.addEventListener('click', (ev) => {
    const n = pick(ev);
    const target = n && n.target && document.getElementById(n.target);
    if (!target) return;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
  });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  recolor();
  document.fonts && document.fonts.ready.then(() => draw(performance.now()));
  if (!reduce) requestAnimationFrame(loop);
  return { recolor };
}
