// Local UI fixture only. Never starts the backend or connects to any database.
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const activities = [
  ['SNOOKER', 'Snooker', 10, 'PER_MINUTE'],
  ['PS5_OPEN', 'PS5 Gaming', 600, 'PER_HOUR'],
  ['CINEMA', 'Private Cinema', 1300, 'PER_HOUR'],
  ['PS5_PRIVATE', 'Private PS5 Room', 900, 'PER_HOUR'],
  ['TABLE_TENNIS', 'Table Tennis Room', 800, 'PER_HOUR'],
  ['CAR_SIMULATOR', 'Car Simulator', 900, 'PER_HOUR', 500, 900],
].map(([resourceType, name, basePrice, pricingUnit, halfHourPrice, fullHourPrice], i) => ({
  id: 'cfixtureactivity00000000' + i,
  resourceType,
  name,
  basePrice,
  pricingUnit,
  halfHourPrice: halfHourPrice ?? null,
  fullHourPrice: fullHourPrice ?? null,
}));
const light = {
  target: 'WEBSITE',
  mode: 'LIGHT',
  primaryColor: '#7c3aed',
  primaryDarkColor: '#6d28d9',
  accentColor: '#2563eb',
  accentDarkColor: '#1d4ed8',
  backgroundColor: '#f8fafc',
  textColor: '#0f172a',
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  baseSizeScale: 1,
  glassEffectEnabled: false,
};
const dark = {
  ...light,
  mode: 'DARK',
  primaryColor: '#8b5cf6',
  primaryDarkColor: '#6d28d9',
  accentColor: '#3b82f6',
  backgroundColor: '#090d16',
  textColor: '#f8fafc',
};
async function startFixture() {
  let scenario = 'empty';
  let failures = '';
  const fixture = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    const send = (value) => response.end(JSON.stringify(value));
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/theme') {
      const glassEffectEnabled = scenario === 'glass' || process.env.REDESIGN_GLASS === '1';
      const previewLight = { ...light, glassEffectEnabled };
      const previewDark = { ...dark, glassEffectEnabled };
      return send({ ...previewDark, light: previewLight, dark: previewDark });
    }
    if (pathname === '/api/system-settings')
      return send({
        maintenanceMode: false,
        bookingsEnabled: scenario !== 'paused',
        emergencyClosedToday: false,
      });
    if (pathname === '/api/pricing') return send(scenario === 'offline' ? [] : activities);
    if (pathname === '/api/public-stats') {
      if (scenario === 'stats-unavailable') {
        response.statusCode = 503;
        return send({ error: 'Fixture statistics unavailable' });
      }
      return send({ totalPlayerVisits: scenario === 'live' ? 2500 : 0 });
    }
    if (pathname === '/api/offers/active')
      return send(
        scenario === 'live'
          ? [
              {
                id: 'fixture-offer',
                title: 'Fixture offer — test only',
                description: 'Controlled design test; not a business promotion.',
                discountType: 'PERCENTAGE',
                discountValue: 10,
                applicableTo: 'ALL_ACTIVITIES',
                isActive: true,
                isVisibleOnWebsite: true,
                promoCode: 'TEST ONLY & SAFE',
                validFrom: '2026-01-01T00:00:00Z',
                validUntil: '2030-01-01T00:00:00Z',
              },
            ]
          : [],
      );
    if (pathname === '/api/reviews')
      return send(
        scenario === 'live'
          ? {
              reviews: [
                {
                  id: 'fixture-review',
                  customerName: 'Fixture reviewer',
                  reviewText: 'Controlled review for UI testing only.',
                  rating: 4,
                  isApproved: true,
                  isFeatured: true,
                  createdAt: '2026-10-03T00:00:00Z',
                },
              ],
              stats: { totalReviews: 1, averageRating: 4 },
            }
          : { reviews: [], stats: { totalReviews: 0, averageRating: 0 } },
      );
    if (pathname === '/api/popup-settings') return send({ isEnabled: false });
    if (pathname === '/api/auth/me') {
      if (scenario === 'account')
        return send({
          id: 'fixture-account',
          name: 'Fixture Player',
          phone: '03000000000',
          isRegistered: true,
        });
      response.statusCode = 401;
      return send({ error: 'No fixture user' });
    }
    if (pathname === '/api/auth/logout') {
      scenario = 'empty';
      return send({ success: true });
    }
    if (pathname === '/api/gallery' || pathname === '/api/reels' || pathname === '/api/addons')
      return send([]);
    if (pathname === '/api/availability')
      return send({
        resources: [],
        date: new URL(request.url, 'http://localhost').searchParams.get('date'),
      });
    if (pathname === '/api/public-settings') return send({});
    response.statusCode = 404;
    send({ error: 'Fixture route unavailable' });
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + fixture.address().port;
  const website = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'start', '-p', '4322'],
    {
      cwd: path.join(root, 'website'),
      windowsHide: true,
      env: { ...process.env, NODE_ENV: 'production', API_URL: api, NEXT_PUBLIC_API_URL: api },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  website.stderr.on('data', (data) => {
    failures = (failures + data).slice(-4000);
  });
  website.stdout.on('data', () => {});
  const url = 'http://localhost:4322';
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status === 200)
        return {
          url,
          api,
          setScenario: (value) => {
            scenario = value;
          },
          close: async () => {
            website.kill();
            fixture.closeAllConnections();
            await new Promise((resolve) => fixture.close(resolve));
          },
        };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  website.kill();
  fixture.close();
  throw Error('Website fixture failed to start: ' + failures);
}
module.exports = { startFixture };
if (require.main === module)
  startFixture()
    .then((context) => {
      console.log(
        'Local website design preview: ' + context.url + ' (fixture data, no real database)',
      );
      const close = () => {
        void context.close().then(() => process.exit());
      };
      process.on('SIGINT', close);
      process.on('SIGTERM', close);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
