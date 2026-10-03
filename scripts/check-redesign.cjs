// Optional browser QA; install Playwright/@axe-core/playwright in a test tool directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startFixture } = require('./redesign-fixture.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const AxeBuilder = require(process.env.AXE_MODULE_PATH || '@axe-core/playwright').default;
const output = process.env.REDESIGN_QA_OUTPUT;
if (!output) throw Error('Set REDESIGN_QA_OUTPUT to a local QA artifact directory.');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const fixture = await startFixture();
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    headless: true,
  });
  const results = [];
  try {
    for (const [mode, width] of [
      ['LIGHT', 1440],
      ['DARK', 1440],
      ['LIGHT', 390],
      ['DARK', 390],
      ['LIGHT', 320],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        (value) => localStorage.setItem('zeroone-theme-mode', value),
        mode,
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        (value) => document.documentElement.classList.contains(value.toLowerCase()),
        mode,
      );
      await page.locator('.zo-hero').waitFor();
      await page.waitForFunction(
        (value) => document.documentElement.classList.contains(value.toLowerCase()),
        mode,
      );
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('.zo-feature-grid .zo-feature').count(), 3);
      assert.equal(await page.locator('.zo-activity-card').count(), 6);
      assert.equal(await page.locator('.zo-benefit').count(), 4);
      assert.match(await page.locator('.zo-stats').innerText(), /24\/7/);
      assert.equal(await page.locator('.zo-stats > div').nth(2).locator('strong').innerText(), '0');
      assert.equal(
        await page.locator('.zo-home img[src*="redesign"]').count(),
        0,
        'Real venue photos replace illustrations',
      );
      assert.match(
        await page
          .locator('.zo-nav-inner')
          .evaluate((element) => getComputedStyle(element).backdropFilter),
        /^(none|blur\(0px\))$/,
        'Appearance toggle off disables blur',
      );
      if (width === 1440) {
        await page.locator('.zo-desktop-theme button').click();
        assert.equal(
          await page.evaluate(() =>
            document.documentElement.classList.contains('theme-transition'),
          ),
          false,
          'Reduced motion also disables theme animation',
        );
        await page.locator('.zo-desktop-theme button').click();
        assert.equal(
          await page.evaluate(() => localStorage.getItem('zeroone-theme-mode')),
          mode,
          'Theme choice remains persistent',
        );
      }
      assert.equal(await page.locator('.zo-feature-grid .zo-feature-accent .zo-feature-photo').getAttribute('data-photo-shape'), '01');
      assert.match(await page.locator('.zo-hero').innerText(), /Reviews coming soon/);
      assert.match(await page.locator('.zo-hero').innerText(), /Open 24\/7/);
      assert.equal(
        await page
          .locator('.zo-home')
          .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `No horizontal overflow at ${width}px`,
      );
      assert.ok(
        await page
          .locator('.zo-feature-grid .zo-feature-accent .zo-feature-photo')
          .evaluate((element) =>
            getComputedStyle(element).maskImage.includes('data:image/svg+xml'),
          ),
        'Bold 01 photo mask is active',
      );
      const activity = page.locator('.zo-activity-card').first();
      assert.match(await activity.getAttribute('href'), /\/book\?activity=/);
      await activity.click();
      await page.waitForURL('**/book?activity=*');
      await page.getByRole('heading', { name: 'Date & Duration' }).waitFor({ timeout: 15000 });
      await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      if (width < 700) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        assert.equal(
          await page
            .getByRole('button', { name: 'Close navigation' })
            .getAttribute('aria-expanded'),
          'true',
        );
        await page.keyboard.press('Escape');
        assert.equal(
          await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'),
          'false',
        );
      }
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      fs.writeFileSync(
        path.join(output, `axe-${mode.toLowerCase()}-${width}.json`),
        JSON.stringify(accessibility.violations, null, 2),
      );
      assert.deepEqual(
        accessibility.violations.map((item) => ({ id: item.id, nodes: item.nodes.length })),
        [],
        `Accessibility ${mode}/${width}`,
      );
      assert.deepEqual(errors, [], 'No runtime page errors');
      if (width !== 320) {
        for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 700) {
          await page.evaluate((value) => scrollTo(0, value), y);
          await page.waitForTimeout(100);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(600);
      }
      if (width !== 320) {
        const images = await page.locator('.zo-home img').evaluateAll((elements) =>
          elements
            .filter((image) => image.getBoundingClientRect().width > 0)
            .map((image) => ({
              src: image.currentSrc,
              loaded: image.complete && image.naturalWidth > 0,
            })),
        );
        assert.ok(
          images.every((image) => image.loaded),
          'All visible venue images load successfully',
        );
      }
      if (width !== 320)
        await page.screenshot({
          path: path.join(output, `website-${mode.toLowerCase()}-${width}.png`),
          fullPage: true,
        });
      results.push({
        mode,
        width,
        overflow: false,
        runtimeErrors: errors.length,
        accessibilityViolations: accessibility.violations.length,
      });
      await context.close();
    }
    fixture.setScenario('glass');
    const widePage = await browser.newPage({
      viewport: { width: 1864, height: 892 },
      reducedMotion: 'reduce',
    });
    await widePage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await widePage.waitForFunction(() =>
      getComputedStyle(document.querySelector('.zo-nav-inner')).backdropFilter.includes('20px'),
    );
    const geometry = await widePage.evaluate(() => {
      const nav = document.querySelector('.zo-nav-inner').getBoundingClientRect();
      const hero = document.querySelector('.zo-hero').getBoundingClientRect();
      const logo = [...document.querySelectorAll('.zo-nav-logo img')]
        .find((image) => getComputedStyle(image).display !== 'none')
        .getBoundingClientRect();
      return {
        navWidth: nav.width,
        navHeight: nav.height,
        logoWidth: logo.width,
        heroWidth: hero.width,
        heroHeight: hero.height,
        overlay: nav.top > hero.top && nav.bottom < hero.bottom,
      };
    });
    assert.equal(geometry.navWidth, 1320);
    assert.equal(geometry.navHeight, 64);
    assert.equal(geometry.logoWidth, 116);
    assert.equal(geometry.heroWidth, 1840);
    assert.ok(geometry.heroHeight >= 868 && geometry.overlay);
    await widePage.locator('.zo-hero > img').evaluate(image => image.decode());
    await widePage.locator('.zo-nav-logo img:not(.hidden)').evaluate(image => image.decode());
    await widePage.screenshot({ path: path.join(output, 'website-wide-glass.png') });
    await widePage.close();
    results.push({
      requestedHeaderGeometry: 'pass',
      fullscreenHero: 'pass',
      appearanceGlassToggle: 'pass',
      realVenuePhotos: 'pass',
      realRatesAndReviewCounts: 'pass',
    });
    fixture.setScenario('live');
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    assert.match(
      await page.locator('.zo-feature-grid .zo-feature-accent').getAttribute('href'),
      /offerId=fixture-offer&promo=TEST\+ONLY\+%26\+SAFE/,
    );
    assert.match(
      await page.locator('.zo-feature-grid .zo-feature-accent').innerText(),
      /Fixture offer/,
    );
    assert.match(await page.locator('.zo-testimonial').innerText(), /Controlled review/);
    assert.equal(
      await page.locator('.zo-stats > div').nth(2).locator('strong').innerText(),
      '2.5K',
    );
    fixture.setScenario('stats-unavailable');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.match(
      await page.locator('.zo-stats').innerText(),
      /Visit count temporarily unavailable/,
    );
    fixture.setScenario('live');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('.zo-hero').innerText(), /4.0 \/ 5/);
    fixture.setScenario('offline');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('.zo-pricing').innerText(), /Indicative rates/);
    assert.equal(await page.locator('.zo-price-row').count(), 6);
    assert.equal(
      await page
        .locator('.zo-feature-grid .zo-feature-photo')
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      '0s',
      'Reduced motion disables image animation',
    );
    fixture.setScenario('empty');
    const motionPage = await browser.newPage({ reducedMotion: 'no-preference' });
    await motionPage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await motionPage.locator('.zo-feature-grid .zo-feature-accent').hover();
    await motionPage.waitForTimeout(650);
    assert.notEqual(
      await motionPage
        .locator('.zo-feature-grid .zo-feature-accent .zo-feature-photo')
        .evaluate((element) => getComputedStyle(element).transform),
      'none',
      'Feature blob subtly animates on hover',
    );
    await motionPage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await motionPage.waitForFunction(() =>
      document.querySelector('.zo-feature-grid .zo-reveal-pending'),
    );
    const initialDrift = await motionPage
      .locator('.zo-hero')
      .evaluate((element) => element.style.getPropertyValue('--zo-photo-drift'));
    await motionPage.evaluate(() => scrollTo(0, 350));
    await motionPage.waitForFunction(
      (value) =>
        document.querySelector('.zo-hero').style.getPropertyValue('--zo-photo-drift') !== value,
      initialDrift,
    );
    await motionPage.locator('.zo-feature-grid').scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(
      () => !document.querySelector('.zo-feature-grid .zo-reveal-pending'),
    );
    await motionPage.locator('.zo-connect-form').scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(() =>
      document.querySelector('.zo-feature-grid .zo-reveal-pending'),
    );
    await motionPage.locator('.zo-feature-grid').scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(
      () => !document.querySelector('.zo-feature-grid .zo-reveal-pending'),
    );
    await motionPage.emulateMedia({ reducedMotion: 'reduce' });
    await motionPage.waitForFunction(
      () => !document.querySelector('.zo-hero').style.getPropertyValue('--zo-photo-drift'),
    );
    assert.equal(
      await motionPage.locator('.zo-reveal-pending').count(),
      0,
      'Changing reduced motion immediately exposes all sections',
    );
    await motionPage.getByRole('button', { name: 'Enable animations' }).click();
    await motionPage.waitForFunction(
      () => document.querySelector('[data-motion]').getAttribute('data-motion') === 'on',
    );
    assert.notEqual(
      await motionPage
        .locator('.zo-feature-accent .zo-feature-photo')
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      '0s',
      'Explicit website preference enables motion even with system reduced motion',
    );
    assert.equal(await motionPage.evaluate(() => localStorage.getItem('zeroone-motion')), 'on');
    await motionPage.reload({ waitUntil: 'domcontentloaded' });
    await motionPage.getByRole('button', { name: 'Pause animations' }).waitFor();
    await motionPage.getByRole('button', { name: 'Pause animations' }).click();
    await motionPage.waitForFunction(
      () => !document.querySelector('.zo-hero').style.getPropertyValue('--zo-photo-drift'),
    );
    assert.equal(await motionPage.locator('.zo-reveal-pending').count(), 0);
    const planner = motionPage.locator('.zo-connect-form');
    await planner.locator('select').selectOption('cfixtureactivity000000001');
    await planner.getByRole('button', { name: 'Continue to Booking' }).click();
    await motionPage.waitForURL('**/book?activity=*');
    await motionPage.getByRole('heading', { name: 'Date & Duration' }).waitFor();
    await motionPage.close();
    fixture.setScenario('paused');
    const pausedPage = await browser.newPage({ viewport: { width: 320, height: 850 } });
    await pausedPage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await pausedPage
      .locator('.zo-navigation')
      .getByRole('link', { name: 'Bookings Paused' })
      .click();
    await pausedPage.getByRole('heading', { name: 'Online Bookings Paused' }).waitFor();
    await pausedPage.close();
    fixture.setScenario('account');
    const accountPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await accountPage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await accountPage.locator('.zo-account-menu summary').click();
    assert.equal(
      await accountPage
        .locator('.zo-account-menu')
        .getByRole('link', { name: 'My Profile' })
        .getAttribute('href'),
      '/profile',
    );
    assert.equal(
      await accountPage
        .locator('.zo-account-menu')
        .getByRole('link', { name: 'My Bookings' })
        .getAttribute('href'),
      '/my-bookings',
    );
    await accountPage.locator('.zo-account-menu').getByRole('button', { name: 'Sign Out' }).click();
    await accountPage.locator('.zo-nav-account').getByRole('link', { name: 'Sign In' }).waitFor();
    await accountPage.close();
    for (const scenario of ['account-photo', 'account-broken', 'account']) {
      fixture.setScenario(scenario);
      const avatarPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      await avatarPage.goto(fixture.url, { waitUntil: 'domcontentloaded' });
      const summary = avatarPage.locator('.zo-account-menu summary');
      await summary.waitFor();
      assert.equal(await summary.getAttribute('aria-label'), 'Account');
      if (scenario === 'account-photo') {
        await summary.locator('img').evaluate(image => image.decode());
        assert.equal(await summary.locator('img').evaluate(image => image.naturalWidth > 0), true);
        await summary.screenshot({ path: path.join(output, 'account-avatar.png') });
      } else {
        await summary.locator('svg').waitFor();
        assert.equal(await summary.locator('img').count(), 0, 'Missing or failed profile photos show the account icon');
      }
      await summary.click();
      await avatarPage.getByRole('link', { name: 'My Profile', exact: true }).waitFor();
      await avatarPage.close();
    }
    results.push({
      liveOffersAndReviews: 'pass',
      bookingActivityPreselection: 'pass',
      sessionPlanner: 'pass',
      offlinePriceLabel: 'pass',
      reducedMotion: 'pass',
      featureHover: 'pass',
      scrollRevealAndPhotoDrift: 'pass',
      dynamicReducedMotion: 'pass',
      explicitMotionPreference: 'pass',
      compactVisitCountAndUnavailableState: 'pass',
      confirmedOpeningHours: 'pass',
      pausedBooking: 'pass',
      accountMenuAndLogout: 'pass',
      accountPhotoAndIconFallback: 'pass',
    });
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await fixture.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
