// End-to-end tests for BudgetSense Voice.
// Runs the real page in Chromium with a fake microphone (Chromium's built-in test device)
// and a scripted SpeechRecognition, so the full record → transcribe → act → store path is exercised.
// Usage: node budgetsense/tests/e2e.js
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const results = [];
let current = '';
function check(cond, msg){ if (!cond) throw new Error(msg); }
let cleanup = async () => {};
async function test(name, fn){
  current = name; process.stderr.write('… ' + name + '\n');
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); await cleanup().catch(() => {}); }
}

// Scripted speech engine: each start() "hears" the next queued phrase.
const FAKE_SR = () => {
  window.__speech = [];
  class FakeSR {
    start(){
      this._on = true;
      const text = window.__speech.shift();
      if (text == null) return;
      setTimeout(() => {
        if (!this._on) return;
        const alt = {transcript: text, confidence: .95};
        const res = Object.assign([alt], {isFinal: true});
        this.onresult && this.onresult({resultIndex: 0, results: [res]});
      }, 120);
    }
    stop(){ this._on = false; setTimeout(() => this.onend && this.onend(), 10); }
    abort(){ this.stop(); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  window.speechSynthesis && (window.speechSynthesis.speak = () => {});
};

(async () => {
  const browser = await chromium.launch({args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, permissions: ['microphone']});
  await ctx.addInitScript(FAKE_SR);
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(`[${current}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text())) errors.push(`[${current}] ${m.text()}`); });

  // After a failed test, close any overlay so later tests start from a usable screen.
  cleanup = async () => {
    if (await page.isVisible('#tour')) await page.click('#tSkip').catch(() => page.keyboard.press('Escape'));
    if (await page.isVisible('#scrim')) await page.click('#sheetClose');
  };
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('budgetsense.v3') || 'null'));
  const say = async (text, mic = '#recBtn') => {
    await page.evaluate(t => window.__speech.push(t), text);
    await page.click(mic);                     // start recording
    await page.waitForTimeout(450);            // speak
    await page.click(mic);                     // stop
    await page.waitForTimeout(700);            // flush + process
  };
  const speakNote = async text => { await page.click('#speakBtn'); await page.waitForTimeout(450); await page.evaluate(t => window.__speech.push(t), text);
    // the dock button already started recording before the phrase was queued; restart cleanly
    await page.click('#recBtn'); await page.waitForTimeout(700); await say(text); };
  const noOverflow = async label => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); check(w[0] <= w[1], `${label}: page scrolls sideways (${w[0]} > ${w[1]})`); };
  const text = sel => page.textContent(sel);

  await page.goto(PAGE); await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('budgetsense-voice'); }); await page.reload();

  await test('Welcome screen shows the three setup routes', async () => {
    check(await page.isVisible('#goVoiceSetup') && await page.isVisible('#goManualSetup') && await page.isVisible('#goSample'), 'setup routes missing');
    await noOverflow('welcome');
  });

  await test('Voice tour: every step spotlights, narrates, and leaves nothing saved', async () => {
    let spoken = 0;
    await page.exposeFunction('__spoke', () => { spoken++; });
    await page.evaluate(() => { speechSynthesis.speak = () => window.__spoke(); });
    await page.click('#tourStart');
    const titles = [];
    for (let i = 0; i < 12; i++){
      await page.waitForTimeout(500);
      titles.push(await text('#tTitle'));
      const hole = await page.$eval('#tHole', h => { const r = h.getBoundingClientRect(); return {none: h.classList.contains('none'), w: r.width, h: r.height, top: r.top, bottom: r.bottom}; });
      const card = await page.$eval('#tCard', c => { const r = c.getBoundingClientRect(); return {top: r.top, bottom: r.bottom}; });
      if (!hole.none){
        check(hole.w > 20 && hole.h > 20, `step ${i + 1}: spotlight missing`);
        check(card.bottom <= hole.top + 4 || card.top >= hole.bottom - 4 || hole.h > 500, `step ${i + 1} (${titles.at(-1)}): card covers the spotlight`);
      }
      await noOverflow('tour step ' + (i + 1));
      if (await page.isVisible('#tEnd button')) break;
      await page.click('#tNext');
    }
    check(titles.length === 11, `expected 11 tour screens, saw ${titles.length}: ${titles.join(' / ')}`);
    check(spoken >= 11, `narration spoke ${spoken} times`);
    check(!(await st()) || (await st()).sample, 'tour data leaked as real data');
    await page.click('[data-tend=voice]'); await page.waitForTimeout(200);
    check(await page.isVisible('#s-voice'), 'Speak my plan did not open voice setup');
    check(!(await st()), 'sample data was left in storage after the tour');
    await page.click('#s-voice [data-back=welcome]');
  });

  await test('Voice setup: one note drafts the full plan', async () => {
    await page.click('#goVoiceSetup');
    await say("I'm Sheuli. I take home 1.5 lakh a month. Rent is 32,000, electricity and internet about 3,000, groceries 8,000, transport 4,000. I spend around 4,000 eating out and 1,500 on coffee. I'm saving for a Goa trip, 60,000 by December.", '#setupMic');
    const got = await page.$$eval('#setupChecks .check.got', els => els.length);
    check(got === 4, `expected 4 of 4 checklist items ticked, got ${got}`);
    check(await page.isEnabled('#setupDraft'), 'Draft my plan stays disabled');
    await page.click('#setupDraft');
    check(await page.inputValue('#bName') === 'Sheuli', 'name not drafted');
    check(await page.inputValue('#bIncome') === '150000', 'income not drafted: ' + await page.inputValue('#bIncome'));
    check(await page.inputValue('[data-cat="Rent & home"]') === '32000', 'rent not drafted');
    check(await page.inputValue('[data-cat="Eating out"]') === '4000', 'eating out not drafted');
    check(await page.inputValue('#gName') === 'Goa Trip' && await page.inputValue('#gTarget') === '60000', 'goal not drafted');
    check(/covers it|needs/.test(await text('#pbVerdict')), 'plan verdict missing');
    await noOverflow('plan builder');
  });

  await test('Plan builder: voice correction updates a line', async () => {
    await say('rent is 30,000', '#builderMic');
    check(await page.inputValue('[data-cat="Rent & home"]') === '30000', 'rent not corrected: ' + await page.inputValue('[data-cat="Rent & home"]'));
  });

  await test('Plan builder: saving opens the app with the plan', async () => {
    await page.click('#builderSave'); await page.waitForTimeout(200);
    check(await page.isVisible('#app'), 'app not shown');
    check((await text('#hello')).includes('Sheuli'), 'greeting lacks name');
    const s = await st();
    check(s.profile.income === 150000 && s.plan['Rent & home'] === 30000 && s.goals[0].name === 'Goa Trip', 'plan not stored correctly');
    check(s.recs.some(r => r.source === 'setup' && r.hasAudio), 'setup voice note not kept with audio');
  });

  await test('Voice note: draft, then correct the envelope by voice', async () => {
    await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600); // close the auto-started empty note
    await say('four fifty at Swiggy');
    check(await page.isVisible('#draft .draft'), 'draft card not shown');
    check((await text('#draft')).includes('₹450'), 'draft amount wrong');
    await say('no, make it coffee');
    const s = await st(); const t = s.txs.at(-1);
    check(t.amount === 450 && t.category === 'Coffee & chai', `saved ${t.amount} to ${t.category}`);
    check(s.recs.filter(r => r.hasAudio).length >= 3, 'voice notes not kept with audio');
  });

  await test('Voice note: "yes" confirms the AI pick', async () => {
    await say('Uber to office 310 yesterday'); await say('yes');
    const t = (await st()).txs.at(-1);
    check(t.category === 'Transport' && t.amount === 310, 'Uber not saved to Transport');
    const y = new Date(new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'})); y.setDate(y.getDate() - 1);
    if (y.getMonth() === new Date(t.date).getMonth()) check(t.date === y.toISOString().slice(0,10), 'yesterday not applied: ' + t.date);
  });

  await test('Voice note: salary is recorded as income', async () => {
    await say('salary credited 1.5 lakh'); await say('yes');
    const t = (await st()).txs.at(-1);
    check(t.type === 'income' && t.amount === 150000 && t.category === 'Salary', JSON.stringify(t));
  });

  await test('Limits by voice, with spoken alert at 75%', async () => {
    await say('coffee limit 500');
    check((await st()).plan['Coffee & chai'] === 500, 'coffee limit not set');
    await say('Starbucks 100'); await say('yes');
    check(/Heads up|over its limit/.test(await text('#status')), 'no limit alert: ' + await text('#status'));
  });

  await test('New envelope by voice for an unknown name', async () => {
    await say('pet care limit 2,000');
    check((await st()).plan['Pet Care'] === 2000, 'Pet Care envelope not created');
    await say('vet visit for pet care 800'); await say('yes');
    check((await st()).txs.at(-1).category === 'Pet Care', 'spend not filed to Pet Care');
  });

  await test('Milestones: create and top up by voice', async () => {
    await say('new goal laptop 80,000 by March');
    const g = (await st()).goals.find(x => x.name === 'Laptop');
    check(g && g.target === 80000 && g.by.endsWith('-03'), 'laptop milestone wrong: ' + JSON.stringify(g));
    await say('put 5,000 in Goa trip');
    check((await st()).goals.find(x => x.name === 'Goa Trip').saved === 5000, 'Goa top-up not applied');
  });

  await test('Questions are answered', async () => {
    await say('how much is left for coffee'); check(/left in Coffee|overdrawn/.test(await text('#draft')), 'left answer: ' + await text('#draft'));
    await say('safe to spend today'); check(/safely spend/.test(await text('#draft')), 'safe answer missing');
    await say('can I afford 3,000 shoes'); check(/^💬 (Yes|Not comfortably)/.test((await text('#draft')).trim()), 'afford answer missing');
    await say('what did I spend on swiggy'); check(/entr/.test(await text('#draft')), 'term spend answer missing');
  });

  await test('Mood, move-last and undo by voice', async () => {
    await say('Zomato dinner 1,200'); await say('yes');
    await say('regret it');
    check((await st()).txs.at(-1).mood === false, 'regret not stored');
    await say('move last to shopping');
    check((await st()).txs.at(-1).category === 'Shopping', 'move last failed');
    const n = (await st()).txs.length;
    await say('undo');
    check((await st()).txs.length === n - 1, 'undo failed');
  });

  await test('Fix what I heard (typed correction of a note)', async () => {
    await say('mumble');                              // not understood
    await page.click('#fixBtn');
    await page.evaluate(() => { document.getElementById('words').textContent = 'Netflix renewal 649'; });
    await page.click('#fixBtn'); await page.waitForTimeout(300);
    await say('yes');
    const t = (await st()).txs.at(-1);
    check(t.description.startsWith('Netflix') && t.category === 'Subscriptions', 'corrected note not processed: ' + JSON.stringify(t));
  });

  await test('Type instead (manual entry)', async () => {
    await page.click('#typeBtn');
    await page.fill('#tfAmt', '250'); await page.fill('#tfDesc', 'chai at office');
    check(await page.inputValue('#tfCat') === 'Coffee & chai', 'typed category not suggested');
    await page.click('#typeForm button[type=submit]'); await page.waitForTimeout(200);
    const t = (await st()).txs.at(-1);
    check(t.amount === 250 && t.source === 'typed', 'typed entry not saved');
    await noOverflow('voice sheet');
  });

  await test('Quick save skips the confirmation for confident picks', async () => {
    await page.click('#sheetClose'); await page.waitForTimeout(200);
    await page.click('[data-tab=me]'); await page.click('#swQuick');
    await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600);
    const n = (await st()).txs.length;
    await say('DMart groceries 2,100');
    check((await st()).txs.length === n + 1 && !(await page.isVisible('#draft .draft')), 'quick save did not save directly');
    await page.click('#sheetClose'); await page.waitForTimeout(200);
    await page.click('#swQuick');
  });

  await test('Pulse screen shows ring, safe-to-spend, alerts, milestones', async () => {
    await page.click('[data-tab=pulse]');
    check(await page.isVisible('#pulseCard .ring svg'), 'ring missing');
    check(/Safe to spend today/.test(await text('#pulseCard')), 'safe-to-spend missing');
    check(/Coffee & chai/.test(await text('#alerts')), 'coffee alert missing');
    check((await page.$$('#milestones .ms')).length === 2, 'milestones missing');
    check(/regretted|Next step/.test(await text('#readout')), 'read-out missing');
    await noOverflow('pulse');
  });

  await test('Ask-me chips answer on tap', async () => {
    await page.click('[data-ask="Safe to spend today?"]'); await page.waitForTimeout(200);
    check(/safely spend/.test(await text('#draft')), 'chip answer missing');
    await page.click('#sheetClose'); await page.waitForTimeout(200);
  });

  await test('Envelopes: filters and the ＋ New form', async () => {
    await page.click('[data-tab=envelopes]');
    for (const [f, must] of [['goal', 'Milestones'], ['must', 'Must-pay'], ['life', 'Lifestyle']]){
      await page.click(`[data-f=${f}]`);
      const h = await page.$$eval('#envBody h2', els => els.map(e => e.textContent));
      check(h.length === 1 && h[0] === must, `filter ${f} shows ${h}`);
    }
    await page.click('[data-f=all]');
    await page.click('#newEnvBtn'); await page.click('#neKind [data-k=goal]');
    await page.fill('#neName', 'car deposit'); await page.fill('#neAmt', '200000'); await page.click('#neIcons [data-i="🚗"]');
    await page.click('#newEnv button[type=submit]'); await page.waitForTimeout(200);
    const g = (await st()).goals.find(x => x.name === 'Car Deposit');
    check(g && g.icon === '🚗' && g.target === 200000, 'form milestone not created');
    await noOverflow('envelopes');
  });

  await test('Timeline groups by day and plays the original note', async () => {
    await page.click('[data-tab=timeline]');
    check((await page.$$('#timeline .day')).length >= 1, 'no day groups');
    const play = await page.$('#timeline [data-play]');
    check(play, 'no playable voice note in timeline');
    await play.click(); await page.waitForTimeout(300);
    check(!/not on this device/.test(await text('#toast')), 'audio missing for note');
    const again = await page.$('#timeline [data-mood$=":1"]');
    if (again){ await again.click(); }
    await noOverflow('timeline');
  });

  await test('Me: voice diary lists every note with its result', async () => {
    await page.click('[data-tab=me]');
    const s = await st();
    const rows = await page.$$('#diary li');
    check(rows.length === s.recs.length, `diary shows ${rows.length} of ${s.recs.length} notes`);
    check(/→ /.test(await text('#diary')), 'results not shown in diary');
    await noOverflow('me');
  });

  await test('Month switcher moves between months', async () => {
    const now = await text('#mLabel');
    check(await page.isDisabled('#mNext'), 'future month should be disabled');
    await page.click('#mPrev'); check(await text('#mLabel') !== now, 'previous month not shown');
    await page.click('#mNext'); check(await text('#mLabel') === now, 'did not return to current month');
  });

  await test('Data and audio survive a reload', async () => {
    const before = await st();
    await page.reload(); await page.waitForTimeout(300);
    check(await page.isVisible('#app'), 'app not restored');
    const after = await st();
    check(after.txs.length === before.txs.length, 'entries lost');
    await page.click('[data-tab=timeline]');
    const play = await page.$('#timeline [data-play]'); await play.click(); await page.waitForTimeout(300);
    check(!/not on this device/.test(await text('#toast')), 'audio lost after reload');
  });

  await test('Month by month history is kept and each month keeps its own limits', async () => {
    await page.click('[data-tab=me]');
    check((await page.$$('#history [data-month]')).length >= 1, 'no month history');
    const s = await st(); const cur = Object.keys(s.planByMonth)[0];
    check(cur && s.planByMonth[cur]['Coffee & chai'] === 500, 'current month plan not snapshotted');
    // Seed a previous month with a tighter coffee limit and one coffee spend.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('budgetsense.v3'));
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      s.planByMonth[k] = Object.assign({}, s.plan, {'Coffee & chai': 100});
      s.txs.push({id:'past1', date:k + '-10', amount:200, type:'expense', description:'Old coffee', category:'Coffee & chai', source:'voice', at:1});
      localStorage.setItem('budgetsense.v3', JSON.stringify(s));
    });
    await page.reload(); await page.waitForTimeout(300);
    await page.click('[data-tab=me]');
    check((await page.$$('#history [data-month]')).length >= 2, 'previous month missing from history');
    await page.click('#history [data-month]:nth-child(2)'); await page.waitForTimeout(200);
    await page.click('[data-tab=envelopes]');
    const tile = await page.$$eval('#envBody .env', els => els.map(e => e.textContent).find(t => t.includes('Coffee')));
    check(tile && /Overdrawn/.test(tile) && /₹100/.test(tile), 'past month not judged against its own limit: ' + tile);
    await page.click('#mNext'); await page.waitForTimeout(100);
    const now = await page.$$eval('#envBody .env', els => els.map(e => e.textContent).find(t => t.includes('Coffee')));
    check(/₹500/.test(now), 'current month lost its limit: ' + now);
  });

  await test('Tour replay keeps the user\'s own data', async () => {
    const before = await st();
    await page.click('[data-tab=me]'); await page.click('#tourReplay'); await page.waitForTimeout(200);
    await page.click('#tNext'); await page.click('#tNext'); await page.waitForTimeout(200);
    await page.click('#tSkip'); await page.waitForTimeout(300);
    const after = await st();
    check(after.profile.name === before.profile.name && after.txs.length === before.txs.length && !after.sample, 'tour changed the user data');
    check((await text('#hello')).includes('Sheuli'), 'did not return to own plan');
  });

  await test('Dark mode toggle', async () => {
    await page.click('[data-tab=me]'); await page.click('#swDark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(bg === 'rgb(11, 20, 25)', 'dark background not applied: ' + bg);
    await page.click('#swDark');
  });

  await test('Wipe everything needs two taps and returns to setup', async () => {
    await page.click('#wipeBtn');
    check(await page.isVisible('#app'), 'wiped on first tap');
    await page.click('#wipeBtn'); await page.waitForTimeout(300);
    check(await page.isVisible('#s-welcome'), 'welcome not shown after wipe');
    check((await st()).txs.length === 0 && !(await st()).profile, 'data not wiped');
  });

  await test('Manual setup: build a plan by hand', async () => {
    await page.click('#goManualSetup');
    await page.fill('#bName', 'Asha'); await page.fill('#bIncome', '90000');
    await page.fill('[data-cat="Rent & home"]', '25000');
    await page.click('[data-add="Travel"]'); await page.fill('[data-cat="Travel"]', '3000');
    await page.click('[data-drop="Coffee & chai"]');
    await page.fill('#gName', 'Emergency fund'); await page.fill('#gTarget', '100000');
    check(/free/.test(await text('#pbFree')), 'plan meter missing');
    await page.click('#builderSave'); await page.waitForTimeout(200);
    const s = await st();
    check(s.profile.name === 'Asha' && s.plan.Travel === 3000 && !('Coffee & chai' in s.plan) && s.goals[0].icon === '🛟', 'manual plan wrong: ' + JSON.stringify(s.plan));
  });

  await test('Load sample data needs two taps', async () => {
    await page.click('[data-tab=me]'); await page.click('#sampleBtn'); await page.click('#sampleBtn'); await page.waitForTimeout(300);
    check((await st()).sample && (await st()).txs.length === 18, 'sample data not loaded');
  });

  await test('Guided demo runs from setup to summary', async () => {
    await page.click('[data-tab=me]'); await page.click('#demoBtn');
    await page.waitForFunction(() => /Demo (complete|stopped)/.test(document.getElementById('demoTitle').textContent), null, {timeout: 120000});
    check((await text('#demoTitle')) === 'Demo complete', 'demo did not complete');
    const s = await st();
    check(s.profile.name === 'Asha' && s.goals[0].saved === 15000, 'demo end state wrong');
    check(s.recs.length === 18 && s.recs.every(r => r.outcome && r.outcome !== 'Not understood'), 'a demo line was not understood');
  });

  await test('Microphone refused: clear message, no crash', async () => {
    const c2 = await browser.newContext({viewport: {width: 390, height: 844}});
    await c2.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
    const p2 = await c2.newPage();
    await p2.goto(PAGE); await p2.click('#goSample'); await p2.click('#speakBtn'); await p2.waitForTimeout(300);
    check(/blocked/.test(await p2.textContent('#status')), 'no blocked-mic message');
    await c2.close();
  });

  await test('Layout holds at 360px and desktop widths', async () => {
    for (const w of [360, 1280]){
      await page.setViewportSize({width: w, height: 800});
      for (const t of ['pulse', 'envelopes', 'timeline', 'me']){ await page.click(`[data-tab=${t}]`); await noOverflow(`${t} @${w}`); }
    }
    await page.setViewportSize({width: 390, height: 844});
  });

  current = 'console';
  results.push([errors.length ? 'FAIL' : 'PASS', 'No script errors in the console', errors.slice(0, 5).join(' | ')]);
  await browser.close();
  for (const [s, n, d] of results) console.log(`${s === 'PASS' ? '✔' : '✘'} ${n}${d ? '  — ' + d : ''}`);
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
