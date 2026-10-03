// Presentation regression checks against an isolated in-memory API. No real DB or writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startFixture } = require("./redesign-fixture.cjs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const AxeBuilder = require(
  process.env.AXE_MODULE_PATH || "@axe-core/playwright",
).default;
async function main() {
  const output = process.env.REDESIGN_QA_OUTPUT;
  if (!output) throw Error("Set REDESIGN_QA_OUTPUT.");
  const fixture = await startFixture();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH,
  });
  const results = [];
  try {
    for (const [mode, width] of [
      ["LIGHT", 1440],
      ["DARK", 390],
      ["LIGHT", 320],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        (value) => localStorage.setItem("zeroone-theme-mode", value),
        mode,
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const route of [
        "activities",
        "about",
        "gallery",
        "reviews",
        "location",
        "contact",
        "login",
        "signup",
        "forgot-password",
        "reset-password",
        "review",
        "book",
        "profile",
        "my-bookings",
      ]) {
        fixture.setScenario(
          ["profile", "my-bookings"].includes(route) ? "account" : "empty",
        );
        await page.goto(`${fixture.url}/${route}`, {
          waitUntil: "domcontentloaded",
        });
        await page.locator(".zo-pages").waitFor();
        await page.locator("h1").waitFor();
        await page.waitForFunction(
          () => !document.body.innerText.includes("Loading your profile"),
        );
        assert.equal(await page.locator("header.zo-navigation").count(), 1);
        assert.equal(await page.locator(".zo-footer").count(), 1);
        assert.equal(
          await page.locator("h1").count(),
          1,
          `${route} has one title`,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${route} overflows at ${width}`,
        );
        if (
          [
            "activities",
            "about",
            "gallery",
            "reviews",
            "location",
            "contact",
          ].includes(route)
        ) {
          assert.equal(
            await page
              .locator(`.zo-nav-links a[href='/${route}']`)
              .getAttribute("aria-current"),
            "page",
          );
          assert.equal(
            await page
              .locator('.zo-nav-links a[href="/"]')
              .getAttribute("aria-current"),
            null,
          );
        }
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const violations = scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        }));
        results.push({ route, mode, width, violations });
        fs.writeFileSync(
          path.join(output, "customer-page-results.json"),
          JSON.stringify(results, null, 2),
        );
        console.log(
          mode,
          width,
          route,
          violations.length ? JSON.stringify(violations) : "OK",
        );
        if (
          width !== 320 &&
          ["activities", "about", "login", "book", "contact"].includes(route)
        ) {
          for (const img of await page.locator("img").all()) {
            if (await img.isVisible()) await img.scrollIntoViewIfNeeded();
          }
          await page.evaluate(async () => {
            await Promise.all(
              Array.from(document.images)
                .filter((i) => i.getBoundingClientRect().width > 0)
                .map((i) =>
                  Promise.race([
                    i.decode().catch(() => {}),
                    new Promise((resolve) => setTimeout(resolve, 2000)),
                  ]),
                ),
            );
          });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: path.join(
              output,
              `page-${route}-${mode.toLowerCase()}-${width}.png`,
            ),
            fullPage: true,
          });
        }
        assert.doesNotMatch(
          await page.locator("main").innerText(),
          /â†|â€¢|CafÃ/,
          "UI text is valid Unicode",
        );
        if (route === "gallery") {
          const photo = page.getByRole("button", {
            name: "View Snooker",
            exact: true,
          });
          await photo.focus();
          await photo.press("Enter");
          await page
            .getByRole("button", { name: "Close lightbox", exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
          await page
            .getByRole("button", { name: "Close lightbox", exact: true })
            .waitFor({ state: "hidden" });
        }
        if (route === "login") {
          const logo = page.locator(".zo-account-form img:visible");
          assert.match(
            await logo.getAttribute("src"),
            mode === "DARK" ? /logo.png/ : /logo-dark.png/,
          );
        }
        if (route === "activities") {
          await page
            .getByRole("link", { name: /Book Station/ })
            .first()
            .click();
          await page
            .getByRole("heading", { name: "Date & Duration", exact: true })
            .waitFor();
        }
      }
      // Public pages remain reachable through the same mobile dialog; auth links close it too.
      if (width === 390) {
        await page.goto(`${fixture.url}/about`);
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
        await page
          .getByRole("navigation", { name: "Mobile navigation", exact: true })
          .getByRole("link", { name: "Gallery", exact: true })
          .click();
        await page.waitForURL("**/gallery");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      assert.deepEqual(errors, [], `Runtime errors at ${mode}/${width}`);
      await context.close();
    }
    fs.writeFileSync(
      path.join(output, "customer-page-results.json"),
      JSON.stringify(results, null, 2),
    );
    const failures = results.filter((r) => r.violations.length);
    assert.deepEqual(
      failures,
      [],
      "Accessibility violations; see customer-page-results.json",
    );
    console.log(
      `PASS: ${results.length} route/theme/viewport checks; navigation, booking links, no overflow or runtime errors.`,
    );
  } finally {
    await browser.close();
    await fixture.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
