import { prisma } from '../db';

async function main() {
  console.log('Running safe ThemeMode migration...');

  try {
    // 1. Create enum if not exists
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('ThemeMode enum ensured.');

    // 2. Add column mode if not exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ThemeSettings" ADD COLUMN IF NOT EXISTS "mode" "ThemeMode" NOT NULL DEFAULT 'DARK';
    `);
    console.log('Column "mode" ensured on ThemeSettings.');

    // 3. Drop old single target unique constraint or index
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ThemeSettings" DROP CONSTRAINT IF EXISTS "ThemeSettings_target_key";
    `);
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "ThemeSettings_target_key";
    `);
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "ThemeSettings_target_idx";
    `);
    console.log('Old single-column target constraints & indices dropped.');

    // 4. Create composite unique index
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ThemeSettings_target_mode_key" ON "ThemeSettings"("target", "mode");
    `);
    console.log('Composite unique index on (target, mode) ensured.');

    // 5. Seed default 4 theme configurations
    const now = new Date();
    const defaults = [
      {
        id: 'theme_website_dark',
        target: 'WEBSITE',
        mode: 'DARK',
        primaryColor: '#8b5cf6',
        primaryDarkColor: '#6d28d9',
        accentColor: '#3b82f6',
        accentDarkColor: '#1d4ed8',
        backgroundColor: '#090d16',
        textColor: '#f8fafc',
        displayFont: 'Space Grotesk',
        bodyFont: 'Inter',
        baseSizeScale: 1.0,
      },
      {
        id: 'theme_website_light',
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
        baseSizeScale: 1.0,
      },
      {
        id: 'theme_admin_dark',
        target: 'ADMIN',
        mode: 'DARK',
        primaryColor: '#c9a84c',
        primaryDarkColor: '#e0c069',
        accentColor: '#6366f1',
        accentDarkColor: '#4338ca',
        backgroundColor: '#0b0b0c',
        textColor: '#ededeb',
        displayFont: 'Poppins',
        bodyFont: 'Inter',
        baseSizeScale: 1.0,
      },
      {
        id: 'theme_admin_light',
        target: 'ADMIN',
        mode: 'LIGHT',
        primaryColor: '#b48c36',
        primaryDarkColor: '#8a6518',
        accentColor: '#4f46e5',
        accentDarkColor: '#3730a3',
        backgroundColor: '#fbfaf6',
        textColor: '#1e1e24',
        displayFont: 'Poppins',
        bodyFont: 'Inter',
        baseSizeScale: 1.0,
      },
    ];

    for (const d of defaults) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ThemeSettings" (
          "id", "target", "mode", "primaryColor", "primaryDarkColor",
          "accentColor", "accentDarkColor", "backgroundColor",
          "textColor", "displayFont", "bodyFont", "baseSizeScale",
          "createdAt", "updatedAt"
        ) VALUES (
          '${d.id}', '${d.target}'::"ThemeTarget", '${d.mode}'::"ThemeMode",
          '${d.primaryColor}', '${d.primaryDarkColor}',
          '${d.accentColor}', '${d.accentDarkColor}',
          '${d.backgroundColor}', '${d.textColor}',
          '${d.displayFont}', '${d.bodyFont}', ${d.baseSizeScale},
          NOW(), NOW()
        )
        ON CONFLICT ("target", "mode") DO NOTHING;
      `);
    }

    console.log('Seeded all 4 default theme configurations successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
