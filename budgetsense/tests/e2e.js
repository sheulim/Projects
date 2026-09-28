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
  const LIBS = process.env.BS_LIBS || path.resolve(__dirname, '../../..', 'libs');
  const fs = require('fs');
  await ctx.route('https://cdnjs.cloudflare.com/**', route => {
    const u = route.request().url();
    const f = /pdf\.worker\.min\.js$/.test(u) ? 'pdfjs-dist-3.11.174/build/pdf.worker.min.js' : /pdf\.min\.js$/.test(u) ? 'pdfjs-dist-3.11.174/build/pdf.min.js' : /xlsx\.full\.min\.js$/.test(u) ? 'xlsx-0.18.5/dist/xlsx.full.min.js' : null;
    if (!f || !fs.existsSync(path.join(LIBS, f))) return route.abort();
    route.fulfill({path: path.join(LIBS, f), contentType: 'application/javascript'});
  });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(`[${current}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text())) errors.push(`[${current}] ${m.text()}`); });

  // After a failed test, close any overlay so later tests start from a usable screen.
  cleanup = async () => {
    if (await page.isVisible('#tour')) await page.click('#tSkip').catch(() => page.keyboard.press('Escape'));
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
    for (let i = 0; i < 13; i++){
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
    check(titles.length === 12, `expected 12 tour screens, saw ${titles.length}: ${titles.join(' / ')}`);
    check(spoken >= 12, `narration spoke ${spoken} times`);
    check(!(await st()) || (await st()).sample, 'tour data leaked as real data');
    await page.click('[data-tend=voice]'); await page.waitForTimeout(200);
    check(await page.isVisible('#s-voice'), 'Speak my plan did not open voice setup');
    check(!(await st()), 'sample data was left in storage after the tour');
    await page.click('#s-voice [data-back=welcome]');
  });

  await test('Voice setup: one note drafts the full plan', async () => {
    await page.click('#goVoiceSetup');
    await page.evaluate(() => window.__speech.push("x")); await page.click('#setupMic'); await page.waitForTimeout(300);
    check(await page.isVisible('#setupVisual'), 'setup note-taking visual not shown while recording');
    await page.click('#setupMic'); await page.waitForTimeout(700);
    check(!(await page.isVisible('#setupVisual')), 'setup visual not hidden after recording');
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
    await page.evaluate(() => window.__speech.push('rent is 30,000'));
    await page.click('#builderMic'); await page.waitForTimeout(300);
    check(await page.isVisible('#floatVisual'), 'floating note-taking visual not shown while correcting');
    await page.waitForTimeout(200); await page.click('#builderMic'); await page.waitForTimeout(700);
    check(!(await page.isVisible('#floatVisual')), 'floating visual not hidden after correcting');
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

  await test('Note-taking visual plays while recording and while waiting for an answer', async () => {
    const vis = () => page.evaluate(() => { const b = document.getElementById('sheetVisual'); const v = b.querySelector('video');
      return {shown: !b.classList.contains('hide'), label: b.querySelector('b').textContent, playing: !v.paused, src: v.currentSrc}; });
    await page.evaluate(() => window.__speech.push('Metro 240'));
    await page.click('#recBtn'); await page.waitForTimeout(400);
    let v = await vis();
    check(v.shown && v.label === 'Taking notes' && v.playing, 'not shown/playing while recording: ' + JSON.stringify(v));
    check(/notes\.(webm|mp4)$/.test(v.src), 'video source not loaded: ' + v.src);
    await page.click('#recBtn'); await page.waitForTimeout(700);
    v = await vis();
    check(v.shown && v.label === 'Waiting for your answer', 'not shown while waiting for confirmation: ' + JSON.stringify(v));
    await say('yes');
    v = await vis();
    check(!v.shown, 'still shown after the answer');
    await say('how much is left for coffee');
    check(!(await vis()).shown, 'shown for a question answer');
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
    await say('can I afford 3,000 shoes'); check(/Month-end/.test(await text('#draft')) && /(Go ahead|Possible|Not this month)/.test(await text('#draft')), 'before-you-buy answer missing: ' + await text('#draft'));
    await say('not now'); check(!/Month-end/.test(await text('#draft')), 'before-you-buy card not closed');
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

  await test('Several spends in one voice note are all saved', async () => {
    await page.click('[data-tab=pulse]'); await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600);
    const n = (await st()).txs.length;
    await say('10 to a beggar, 5 for the cobbler and 40 on chai');
    const t = (await st()).txs.slice(n);
    check(t.length === 3 && t.map(x => x.amount).join() === '10,5,40', 'multi-item note not split: ' + JSON.stringify(t.map(x => [x.amount, x.description])));
    check(t[0].category === 'Gifts & giving' && t[1].category === 'Small cash', 'multi-item categories wrong');
    await page.click('#sheetClose'); await page.waitForTimeout(200);
  });

  await test('Evening check-in appears after its time and can be closed', async () => {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('budgetsense.v3')); s.prefs.checkin = true; s.prefs.checkinTime = '00:00'; s.checkins = {}; localStorage.setItem('budgetsense.v3', JSON.stringify(s)); });
    await page.reload(); await page.waitForTimeout(300);
    check(await page.isVisible('#checkinSlot .checkin'), 'check-in card missing');
    await page.click('#checkinNone'); await page.waitForTimeout(200);
    check(!(await page.isVisible('#checkinSlot .checkin')), 'check-in card did not close');
    check(Object.keys((await st()).checkins).length === 1, 'check-in not recorded');
  });

  await test('Bank alert import: parses, skips duplicates and OTPs, adds the rest', async () => {
    await page.click('[data-tab=timeline]'); await page.click('#importOpen');
    const alerts = [
      'Rs.5.00 debited from A/c XX1234 on 28-09-26 to VPA cobbler.raju@ybl (UPI Ref No 426512345678). Not you? Call 1800',
      'INR 1,950.00 spent on ICICI Bank Card XX9876 on 26-Sep-26 at AMAZON PAY INDIA. Avl Lmt: INR 1,20,000.00',
      'Your OTP for txn of Rs 500 is 123456',
      'AutoPay: Rs 2,400 debited towards LinkedIn Premium via e-mandate on 12-09-26 from A/c XX1234',
    ].join('\n\n');
    await page.fill('#importText', alerts); await page.click('#importForm button[type=submit]'); await page.waitForTimeout(200);
    check((await page.$$('#importResult .found li')).length === 3, 'expected 3 payments found (OTP skipped)');
    check((await page.$$('#importResult .found li.dup')).length === 1 && /Cobbler/.test(await text('#importResult .found li.dup')), 'voice-logged cobbler payment not recognised as already logged');
    const n = (await st()).txs.length;
    await page.click('#importAdd'); await page.waitForTimeout(200);
    const added = (await st()).txs.slice(n);
    // The ₹5 cobbler payment was already logged by voice earlier, so only 2 are new.
    check(added.length === 2 && added.every(t => t.source === 'bank'), 'imported entries not added: ' + added.length);
    check(added.find(t => /Linkedin Premium/i.test(t.description)).autopay, 'AutoPay not flagged');
    await page.click('#importOpen'); await page.fill('#importText', alerts); await page.click('#importForm button[type=submit]'); await page.waitForTimeout(200);
    check(/Add 0 new/.test(await text('#importAdd')), 'duplicates not detected on second import: ' + await text('#importAdd'));
    await page.click('#importOpen');
    await noOverflow('import');
  });

  await test('Automatic payments are detected and can be marked to cancel', async () => {
    await page.click('[data-tab=pulse]');
    check(/Linkedin Premium/i.test(await text('#recurWrap')), 'LinkedIn AutoPay not listed as automatic');
    await page.click('#recurWrap [data-recur$=":cancel"]'); await page.waitForTimeout(200);
    check(/Marked to cancel/.test(await text('#recurWrap')), 'cancel decision not shown');
    await page.click('[data-ask="What are my automatic payments?"]'); await page.waitForTimeout(200);
    check(/automatic payment/.test(await text('#draft')) && /a year/.test(await text('#draft')), 'automatic payments answer missing: ' + await text('#draft'));
    await page.click('#sheetClose'); await page.waitForTimeout(200);
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

  await test('Spending alarm fires when half the month\'s income is spent', async () => {
    let beeps = 0;
    await page.exposeFunction('__beeped', () => { beeps++; });
    await page.evaluate(() => { const O = window.OscillatorNode.prototype.start; window.OscillatorNode.prototype.start = function(...a){ window.__beeped(); return O.apply(this, a); }; });
    await page.click('[data-tab=pulse]'); await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600);
    await say('rent 46,000'); await say('yes');
    check(await page.isVisible('#alarm'), 'alarm banner not shown at 50%');
    check(/Be alert/.test(await text('#alarmText')) && /51%/.test(await text('#alarmText')), 'alarm text wrong: ' + await text('#alarmText'));
    check(beeps >= 2, 'no alarm sound: ' + beeps);
    await page.click('#alarmClose');
    await say('Starbucks 200'); await say('yes');
    check(!(await page.isVisible('#alarm')), 'alarm repeated for the same threshold');
    await page.click('#sheetClose'); await page.waitForTimeout(200);
  });

  await test('Before you buy: verdicts, goal slip and actions', async () => {
    await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600);
    const d = () => text('#draft');
    await say('should I buy a 500 rupee book');
    check(/Go ahead/.test(await d()), 'small purchase should be Go ahead: ' + await d());
    await say('yes, buy it');
    check((await st()).txs.at(-1).amount === 500, 'purchase not logged after yes');
    await say('should I buy a 5 lakh car');
    check(/Not this month/.test(await d()) && /slips/.test(await d()), 'huge purchase should be Not this month with a goal slip: ' + await d());
    await say('save for it');
    check((await st()).goals.some(g => g.target === 500000), 'save-for-it goal not created');
    await page.click('#sheetClose'); await page.waitForTimeout(200);
    await page.click('[data-tab=pulse]');
    await page.fill('#buyAmt', '2000'); await page.fill('#buyWhat', 'headphones'); await page.click('#buyForm button[type=submit]'); await page.waitForTimeout(200);
    check(/Month-end/.test(await text('#buyResult')), 'form check did not show impact');
    check(/Month-end forecast/.test(await text('#pulseCard')) && /(faster|pace|Slower)/.test(await text('#pulseCard')), 'forecast/pace missing on Pulse');
  });

  await test('Move money between envelopes by voice and by form', async () => {
    const before = (await st()).plan;
    await page.click('#speakBtn'); await page.waitForTimeout(300); await page.click('#recBtn'); await page.waitForTimeout(600);
    await say('move 1,000 from rent to travel');
    const after = (await st()).plan;
    check(after['Rent & home'] === before['Rent & home'] - 1000 && after['Travel'] === (before['Travel'] || 0) + 1000, 'voice move wrong: ' + JSON.stringify([before, after]));
    await page.click('#sheetClose'); await page.waitForTimeout(200);
    await page.click('[data-tab=envelopes]'); await page.click('#moveBtn');
    await page.selectOption('#mvFrom', 'Travel'); await page.selectOption('#mvTo', 'Groceries'); await page.fill('#mvAmt', '400'); await page.click('#moveForm button[type=submit]'); await page.waitForTimeout(200);
    const p2 = (await st()).plan;
    check(p2.Travel === after.Travel - 400 && p2.Groceries === (after.Groceries || 0) + 400, 'form move wrong: ' + JSON.stringify(p2));
    await noOverflow('move form');
  });

  await test('Statement upload: CSV, Excel and PDF are read, with debits and credits told apart', async () => {
    const os = require('os'), fs = require('fs'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-'));
    const now = new Date(new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'}));
    const dd = k => { const d = new Date(now); d.setDate(Math.max(1, now.getDate() - k)); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth() + 1).padStart(2,'0') + '/' + d.getFullYear(); };
    const csv = [
      'Account Statement for XX1234,,,,,',
      'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
      `${dd(3)},UPI-CHAI POINT-chaipoint@ybl-YESB0000001-426577771111-UPI,0000426577771111,${dd(3)},35.00,,50000.00`,
      `${dd(3)},UPI-RAMU COBBLER-ramu@okaxis-UTIB0000001-426577772222-Payment,0000426577772222,${dd(3)},15.00,,49985.00`,
      `${dd(2)},ACH D- LINKEDIN SINGAPORE-MANDATE123,0000000000,${dd(2)},"2,400.00",,47585.00`,
      `${dd(2)},POS 4591XXXXXXXX1234 DECATHLON SPORTS,0000,${dd(2)},"1,299.00",,46286.00`,
      `${dd(1)},NEFT CR-HDFC0000001-ACME TECHNOLOGIES-SALARY SEP,N123,${dd(1)},,"90,000.00",136286.00`,
      `${dd(1)},ATW-4591XXXXXX1234-S1ANHY01-HYDERABAD,0000,${dd(1)},"2,000.00",,134286.00`,
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'stmt.csv'), csv);
    await page.click('[data-tab=timeline]'); await page.click('#stmtOpen');
    await page.setInputFiles('#stmtFile', path.join(dir, 'stmt.csv')); await page.waitForTimeout(400);
    const rows = await page.$$eval('#stmtResult .found li', els => els.map(e => e.textContent.replace(/\s+/g,' ').trim()));
    check(rows.length === 6, 'CSV: expected 6 payments, got ' + rows.length + ' ' + JSON.stringify(rows));
    check(rows.some(r => /Chai Point/.test(r) && /₹35/.test(r)) && rows.some(r => /Ramu Cobbler/.test(r)), 'CSV: UPI payees not named: ' + JSON.stringify(rows));
    check(rows.some(r => /Linkedin Singapore/i.test(r) && /automatic/.test(r)), 'CSV: ACH mandate not flagged automatic');
    check(rows.some(r => /Acme Technologies/.test(r) && /\+₹90,000/.test(r)), 'CSV: salary credit not read as income');
    check(rows.some(r => /Cash withdrawal/.test(r)), 'CSV: ATM withdrawal not recognised');
    const n = (await st()).txs.length; await page.click('#importAdd'); await page.waitForTimeout(200);
    check((await st()).txs.length === n + 6 && (await st()).txs.at(-1).source === 'statement', 'CSV entries not added');
    // Same statement again: everything is already logged.
    await page.click('#stmtOpen'); await page.setInputFiles('#stmtFile', path.join(dir, 'stmt.csv')); await page.waitForTimeout(400);
    check(/Add 0 new/.test(await text('#importAdd')), 'CSV re-import not deduplicated');
    // Excel: write the same rows as .xlsx using the page's SheetJS, then upload it.
    const xlsxB64 = await page.evaluate(async c => { await new Promise((r, j) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = r; s.onerror = j; document.head.appendChild(s); });
      const rows = c.split('\n').map(l => l.match(/("[^"]*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/,'').replace(/^"|"$/g,'')));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.map(r => r.map(v => /^[\d,]+\.\d{2}$/.test(v) ? parseFloat(v.replace(/,/g,'')) : v))), 'S');
      return XLSX.write(wb, {type:'base64', bookType:'xlsx'}); }, csv.replace('CHAI POINT','BLUE TOKAI').replace('426577771111','426599991111').replace('35.00','85.00'));
    fs.writeFileSync(path.join(dir, 'stmt.xlsx'), Buffer.from(xlsxB64, 'base64'));
    await page.setInputFiles('#stmtFile', path.join(dir, 'stmt.xlsx')); await page.waitForTimeout(600);
    check(/Blue Tokai/.test(await text('#stmtResult')) && /Add 1 new/.test(await text('#importAdd')), 'Excel: statement not read or deduplicated: ' + await text('#stmtResult'));
    // PDF: render a bank-style statement table to PDF with Chromium, then upload it.
    const pdfPage = await ctx.newPage();
    await pdfPage.setContent(`<table style="font:12px Arial;border-collapse:collapse" cellpadding="6"><tr><td>Date</td><td>Narration</td><td>Withdrawal</td><td>Deposit</td><td>Balance</td></tr>
      <tr><td>${dd(4)}</td><td>Opening Balance</td><td></td><td></td><td>20,000.00</td></tr>
      <tr><td>${dd(4)}</td><td>UPI/P2M/426511110000/SWIGGY LIMITED</td><td>450.00</td><td></td><td>19,550.00</td></tr>
      <tr><td>${dd(3)}</td><td>UPI/P2A/426511110001/BEGGAR NAME</td><td>10.00</td><td></td><td>19,540.00</td></tr>
      <tr><td>${dd(2)}</td><td>IMPS/426511110002/REFUND FLIPKART</td><td></td><td>1,200.00</td><td>20,740.00</td></tr></table>`);
    fs.writeFileSync(path.join(dir, 'stmt.pdf'), await pdfPage.pdf()); await pdfPage.close();
    await page.setInputFiles('#stmtFile', path.join(dir, 'stmt.pdf')); await page.waitForTimeout(1500);
    const pr = await page.$$eval('#stmtResult .found li', els => els.map(e => e.textContent.replace(/\s+/g,' ').trim()));
    check(pr.length === 3, 'PDF: expected 3 payments, got ' + JSON.stringify(pr) + ' ' + await text('#stmtResult'));
    check(pr.some(r => /Swiggy/.test(r) && /₹450/.test(r)) && pr.some(r => /\+₹1,200/.test(r)), 'PDF: debit/credit wrong: ' + JSON.stringify(pr));
    await page.click('#stmtOpen');
  });

  await test('Connect bank or UPI: consent steps, sample fetch, and an honest "not live" on real data', async () => {
    await page.click('#connectOpen');
    check((await page.$$('#connectBody [data-src]')).length === 9, 'source list missing');
    await page.click('#connectBody [data-src="ICICI Bank"]');
    check(/Transactions only/.test(await text('#connectBody')) && /OTP/.test(await text('#connectBody')), 'consent summary missing');
    await page.click('#cOk');
    check(/Not live yet/.test(await text('#connectBody')) && /Nothing was shared/.test(await text('#connectBody')), 'real-data path should say not live');
    await page.click('#connectOpen');
    await noOverflow('connect');
  });

  await test('Timeline: filter, search, edit and delete entries', async () => {
    await page.click('[data-tt=income]'); await page.waitForTimeout(100);
    const kinds = await page.$$eval('#timeline .items .amt small', els => [...new Set(els.map(e => e.textContent))]);
    check(kinds.length === 1 && kinds[0] === 'In', 'money-in filter shows: ' + kinds);
    await page.click('[data-tt=all]'); await page.fill('#tlSearch', 'cobbler'); await page.waitForTimeout(100);
    const names = await page.$$eval('#timeline .items .t b', els => els.map(e => e.textContent));
    check(names.length >= 1 && names.every(n => /cobbler/i.test(n)), 'search results wrong: ' + names);
    await page.click('#timeline [data-edit]'); await page.selectOption('#edCat', 'Personal care'.replace('Personal care','Self-care')); await page.fill('#edAmt', '20');
    const id = await page.$eval('#timeline [data-edsave]', b => b.getAttribute('data-edsave'));
    await page.click('#timeline [data-edsave]'); await page.waitForTimeout(100);
    const t = (await st()).txs.find(x => x.id === id);
    check(t.amount === 20 && t.category === 'Self-care', 'edit not saved: ' + JSON.stringify(t));
    await page.click('#timeline [data-edit]'); await page.click('#timeline [data-eddel]'); await page.click('#timeline [data-eddel]'); await page.waitForTimeout(100);
    check(!(await st()).txs.some(x => x.id === id), 'delete failed');
    await page.fill('#tlSearch', ''); await page.dispatchEvent('#tlSearch', 'input');
  });

  await test('Load sample data needs two taps', async () => {
    await page.click('[data-tab=me]'); await page.click('#sampleBtn'); await page.click('#sampleBtn'); await page.waitForTimeout(300);
    check((await st()).sample && (await st()).txs.length === 23, 'sample data not loaded: ' + (await st()).txs.length);
    check(/Netflix/.test(await text('#recurWrap')) && /Linkedin|LinkedIn/.test(await text('#recurWrap')), 'sample automatic payments missing');
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
