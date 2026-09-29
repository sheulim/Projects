// End-to-end tests for sign-in, sync between devices and automatic capture of bank SMS and emails.
// Supabase is replaced by an in-memory fake that answers the same REST calls the app makes.
// Usage: node budgetsense/tests/account.js
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SB = 'https://demo.supabase.co', PUB = 'sb_publishable_test_key_0000000000';
const results = [];
let current = '';
function check(cond, msg){ if (!cond) throw new Error(msg); }
async function test(name, fn){
  current = name; process.stderr.write('… ' + name + '\n');
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}

// ---------- Fake Supabase ----------
const fake = {calls: [], users: {}, rows: {}, inbox: [], keys: {}, nextId: 1, seq: 0};
const userFor = auth => { const t = (auth || '').replace(/^Bearer /, ''); return Object.values(fake.users).find(u => (u.tokens || []).includes(t)); };
function push(key, raw, channel, receivedAt){
  const uid = Object.keys(fake.keys).find(u => fake.keys[u] === key);
  if (!uid) return false;
  fake.inbox.push({id: fake.nextId++, user_id: uid, raw, channel, received_at: receivedAt || new Date().toISOString()});
  return true;
}
async function handle(route){
  const req = route.request(), u = new URL(req.url()), h = req.headers(), m = req.method();
  const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'};
  const send = (status, body) => route.fulfill({status, headers: Object.assign({'content-type': 'application/json'}, cors), body: body === undefined ? '' : JSON.stringify(body)});
  if (m === 'OPTIONS') return send(204);
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  fake.calls.push(m + ' ' + u.pathname + u.search);
  if (h.apikey !== PUB) return send(401, {message: 'Invalid API key'});
  const me = userFor(h.authorization);
  const session = user => { const tok = 'tok-' + user.id + '-' + (++fake.seq); (user.tokens = user.tokens || []).push(tok); return {access_token: tok, refresh_token: 'ref-' + user.id, expires_in: 3600, user: {id: user.id, email: user.email}}; };
  switch (u.pathname){
    case '/auth/v1/otp':
      fake.users[body.email] = fake.users[body.email] || {id: 'u' + (Object.keys(fake.users).length + 1), email: body.email};
      fake.lastRedirect = u.searchParams.get('redirect_to'); return send(200, {});
    case '/auth/v1/verify':
      if (body.token !== '123456' || !fake.users[body.email]) return send(403, {msg: 'Token has expired or is invalid'});
      return send(200, session(fake.users[body.email]));
    case '/auth/v1/token': { const user = Object.values(fake.users).find(x => 'ref-' + x.id === body.refresh_token); return user ? send(200, session(user)) : send(400, {error_description: 'Invalid Refresh Token'}); }
    case '/auth/v1/user': return me ? send(200, {id: me.id, email: me.email}) : send(401, {msg: 'no user'});
    case '/auth/v1/logout': return send(204);
    case '/rest/v1/bs_state':
      if (!me) return send(401, {message: 'JWT required'});
      if (m === 'GET') return send(200, fake.rows[me.id] ? [fake.rows[me.id]] : []);
      fake.rows[me.id] = {data: body.data, updated_at: body.updated_at}; return send(201);
    case '/rest/v1/rpc/bs_my_key':
      if (!me) return send(401, {message: 'sign in first'});
      if (body.fresh || !fake.keys[me.id]) fake.keys[me.id] = 'k'.repeat(8) + me.id + '-' + (++fake.seq) + 'x'.repeat(40);
      return send(200, fake.keys[me.id]);
    case '/rest/v1/rpc/bs_add':
      return push(body.key || h['x-bs-key'], body.raw, body.channel || 'email') ? send(200, 'ok') : send(403, {message: 'unknown capture key'});
    case '/rest/v1/bs_inbox': {
      if (!me) return send(401, {message: 'JWT required'});
      if (m === 'GET') return send(200, fake.inbox.filter(r => r.user_id === me.id));
      const ids = (u.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map(Number);
      fake.inbox = fake.inbox.filter(r => !(r.user_id === me.id && ids.includes(r.id))); return send(204);
    }
  }
  return send(404, {message: 'not found'});
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function device(width){
    const ctx = await browser.newContext({viewport: {width, height: 844}});
    await ctx.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
    await ctx.route(SB + '/**', handle);
    const page = await ctx.newPage(); page.setDefaultTimeout(5000);
    page.on('pageerror', e => errors.push(`[${current}] ${e.message}`));
    page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errors.push(`[${current}] ${msg.text()}`); });
    return {ctx, page};
  }
  const toastSays = async (page, re) => { await page.waitForFunction(r => new RegExp(r).test(document.getElementById('toast').textContent), re.source, {timeout: 4000}); };
  const stateOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('budgetsense.v3') || 'null'));
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10).split('-').reverse().map((x, i) => i === 2 ? x.slice(2) : x).join('-');

  // Seed: the account already holds a real (non-sample) plan saved from another device.
  const seed = await device(390);
  await seed.page.goto(PAGE + '#test');
  await seed.page.click('#goSample'); await seed.page.waitForTimeout(200);
  const seedData = await seed.page.evaluate(() => { window.__bs.state.sample = false; window.__bs.save(); return JSON.parse(localStorage.getItem('budgetsense.v3')); });
  await seed.ctx.close();
  fake.users['me@example.com'] = {id: 'u1', email: 'me@example.com'};
  fake.rows.u1 = {data: seedData, updated_at: new Date(Date.now() - 3600e3).toISOString()};

  const A = await device(390), a = A.page;
  await a.goto(PAGE + '#test');

  await test('Tabs use plain words', async () => {
    await a.click('#goSample'); await a.waitForTimeout(200);
    const tabs = await a.$$eval('[role=tab]', els => els.map(e => e.textContent.trim()));
    check(JSON.stringify(tabs) === JSON.stringify(['Overview', 'Budgets', 'Spending log', 'Me']), 'tabs: ' + tabs);
    await a.click('[data-tab=envelopes]');
    const heads = await a.$$eval('#envBody h2', els => els.map(e => e.textContent));
    check(heads.includes('Savings goals') && heads.includes('Needs') && heads.includes('Wants'), 'budget headings: ' + heads);
    // Wipe the sample so the phone starts empty, as a new device would.
    await a.evaluate(() => localStorage.clear()); await a.reload();
  });

  await test('Sign in from the welcome screen: connection, email link, wrong code, right code', async () => {
    await a.click('#goSignin');
    await a.fill('#acctWelcome [data-acct=url]', SB + '/'); await a.fill('#acctWelcome [data-acct=key]', PUB);
    await a.click('#acctWelcome [data-acct-do=project]');
    await a.fill('#acctWelcome [data-acct=email]', 'me@example.com'); await a.click('#acctWelcome [data-acct-do=send]');
    await toastSays(a, /Check your email/);
    check(fake.calls.some(c => c.startsWith('POST /auth/v1/otp')), 'no sign-in email requested');
    check(/index\.html$/.test(fake.lastRedirect || ''), 'redirect_to not this page: ' + fake.lastRedirect);
    await a.fill('#acctWelcome [data-acct=code]', '000000'); await a.click('#acctWelcome [data-acct-do=verify]');
    await toastSays(a, /expired or is invalid/);
    await a.fill('#acctWelcome [data-acct=code]', '123456'); await a.click('#acctWelcome [data-acct-do=verify]');
    await a.waitForSelector('#app:not(.hide)', {timeout: 5000});
    const s = await stateOf(a);
    check(s.profile && s.profile.name === seedData.profile.name && s.txs.length === seedData.txs.length, 'account data not brought in');
  });

  await test('Automatic capture: SMS and email of one payment count once; chats ignored; two identical chai payments both kept', async () => {
    await a.click('[data-tab=me]');
    await a.waitForFunction(() => /Automatic capture/.test(document.getElementById('acctMe').textContent));
    const key = Object.values(fake.keys)[0]; check(key, 'no capture key made');
    const t0 = Date.now();
    push(key, `Rs.249.00 debited from A/c XX1234 on ${today} to VPA swiggy@icici UPI Ref 512345678901. Not you? Call 1800`, 'sms', new Date(t0).toISOString());
    push(key, 'Transaction alert. You have made a UPI payment of Rs 249.00 to SWIGGY from account xx1234.', 'email', new Date(t0 + 120e3).toISOString());
    push(key, 'Are we still on for 7 tonight?', 'sms');
    push(key, `Rs.20.00 debited from A/c XX1234 on ${today} to VPA chaiwala@ybl UPI Ref 600000000001`, 'sms');
    push(key, `Rs.20.00 debited from A/c XX1234 on ${today} to VPA chaiwala@ybl UPI Ref 600000000002`, 'sms');
    const before = (await stateOf(a)).txs.length;
    await a.click('#acctMe [data-acct-do=check]');
    await toastSays(a, /Added 3 payments from your bank SMS and emails/);
    const s = await stateOf(a);
    const added = s.txs.slice(before);
    check(added.length === 3, 'added: ' + added.map(t => t.amount + ' ' + t.description).join(', '));
    check(added.filter(t => t.amount === 249).length === 1 && added.filter(t => t.amount === 20).length === 2, 'wrong entries: ' + added.map(t => t.amount).join(','));
    check(added.every(t => t.source === 'bank' && t.recvAt), 'entries not marked as bank captures');
    check(fake.inbox.length === 0, 'messages not deleted from the server');
    check(/automatic/.test(s.lastImport.label), 'last-import note not set');
    await a.click('[data-tab=timeline]');
    check(/bank SMS and emails \(automatic\)/.test(await a.textContent('#lastImport')), 'import note on Spending log missing');
  });

  await test('Changes sync up to the account', async () => {
    await a.waitForFunction(() => /Synced/.test((document.querySelector('[data-acct-status]') || {}).textContent || ''), null, {timeout: 6000}).catch(() => {});
    await a.waitForTimeout(2200);
    const row = fake.rows.u1;
    check(row.data.txs.some(t => t.amount === 249 && t.source === 'bank'), 'captured payment not pushed');
  });

  await test('Send a test: reaches the inbox and reports success without adding an entry', async () => {
    await a.click('[data-tab=me]');
    const n = (await stateOf(a)).txs.length;
    await a.click('#acctMe [data-acct-do=test]');
    await toastSays(a, /Automatic capture is working/);
    check((await stateOf(a)).txs.length === n, 'test message was added as a payment');
    check(/Test passed/.test(await a.textContent('#acctMe')), 'test result not shown');
    if (process.env.SHOTS){ await a.$$eval('#acctMe details', ds => ds.forEach(d => d.open = true)); await a.locator('#acctMe').screenshot({path: path.join(process.env.SHOTS, 'account-card.png')}); }
  });

  await test('Gmail script is filled in and valid JavaScript', async () => {
    const js = await a.evaluate(() => window.__bs.gmailScript());
    check(js.includes('"https://demo.supabase.co"') && js.includes(PUB) && js.includes(Object.values(fake.keys)[0]), 'details missing from script');
    new Function(js + '\nreturn [start, sendNew];')();
    check(/-subject:\(OTP/.test(js), 'OTP emails not excluded');
  });

  await test('Second device: signs in by the emailed link, gets everything, and its own entry merges back', async () => {
    const B = await device(1280), b = B.page;
    await b.goto(PAGE + '#test');
    await b.evaluate(([url, key]) => localStorage.setItem('budgetsense.cloud', JSON.stringify({url, key})), [SB, PUB]);
    const token = 'tok-u1-link'; (fake.users['me@example.com'].tokens = fake.users['me@example.com'].tokens || []).push(token);
    await b.goto('about:blank');   // a real emailed link is a fresh page load, not a hash change
    await b.goto(PAGE + `#access_token=${token}&refresh_token=ref-u1&expires_in=3600&token_type=bearer&type=magiclink`);
    await b.waitForSelector('#app:not(.hide)', {timeout: 5000});
    check(!/access_token/.test(await b.evaluate(() => location.href)), 'token left in the address bar');
    let s = await stateOf(b);
    check(s.txs.some(t => t.amount === 249 && t.source === 'bank'), 'second device missing the captured payment');
    // Add an entry on B with the typed fallback, then let it sync.
    await b.click('#speakBtn'); await b.waitForTimeout(300);
    await b.click('#typeBtn'); await b.fill('#tfAmt', '333'); await b.fill('#tfDesc', 'books');
    await b.click('#typeForm button[type=submit]');
    await b.waitForTimeout(2500);
    check(fake.rows.u1.data.txs.some(t => t.amount === 333), 'entry from device B not pushed');
    // Device A pulls it without losing its own entries.
    const nA = (await stateOf(a)).txs.length;
    await a.click('#acctMe [data-acct-do=sync]'); await toastSays(a, /Synced/);
    s = await stateOf(a);
    check(s.txs.some(t => t.amount === 333) && s.txs.length === nA + 1, 'device A did not merge: ' + (s.txs.length - nA));
    await B.ctx.close();
  });

  await test('Merge keeps both sides, newer wins on settings, deleted entries stay deleted', async () => {
    const r = await a.evaluate(() => window.__bs.mergeData(
      {txs: [{id: 'a', amount: 1}, {id: 'b', amount: 2}], plan: {Coffee: 500}, deleted: ['c'], savedAt: 1},
      {txs: [{id: 'b', amount: 5}, {id: 'c', amount: 3}], plan: {Coffee: 900}, deleted: [], savedAt: 2}, true));
    check(r.txs.length === 2 && r.txs.find(t => t.id === 'b').amount === 5 && !r.txs.find(t => t.id === 'c'), 'merge txs wrong: ' + JSON.stringify(r.txs));
    check(r.plan.Coffee === 900, 'newer plan did not win');
  });

  await test('Expired sign-in asks to sign in again; sign out keeps data on the device', async () => {
    await a.evaluate(() => { const c = JSON.parse(localStorage.getItem('budgetsense.cloud')); c.session.expires_at = 1; c.session.refresh_token = 'bad'; localStorage.setItem('budgetsense.cloud', JSON.stringify(c)); });
    await a.reload(); await a.click('[data-tab=me]');
    await a.waitForFunction(() => /Email me a link/.test(document.getElementById('acctMe').textContent), null, {timeout: 5000});
    const s = await stateOf(a);
    check(s.profile && s.txs.length > 0, 'local data lost after sign-in expired');
  });

  await test('Account card fits a 360px phone', async () => {
    await a.setViewportSize({width: 360, height: 800}); await a.click('[data-tab=me]');
    const w = await a.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    check(w[0] <= w[1], `page scrolls sideways (${w[0]} > ${w[1]})`);
  });

  current = 'console';
  results.push([errors.length ? 'FAIL' : 'PASS', 'No script errors in the console', errors.slice(0, 5).join(' | ')]);
  await browser.close();
  for (const [s, n, d] of results) console.log(`${s === 'PASS' ? '✔' : '✘'} ${n}${d ? '  — ' + d : ''}`);
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
