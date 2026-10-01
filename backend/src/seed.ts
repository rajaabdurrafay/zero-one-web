import { PrismaClient, ResourceType, PricingUnit, AdminRole } from '@prisma/client';
import { hashPassword } from './utils/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Seed Super Admin account if none exists
  const existingAdmins = await prisma.adminUser.count();
  if (existingAdmins === 0) {
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        name: 'Super Admin',
        password: hashPassword('admin123'),
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log('✅ Created initial Super Admin account (admin / admin123)');
  } else {
    console.log('⚡ Admin users already exist. Skipping admin seed.');
  }

  // Seed default Addon items if none exist
  const existingAddons = await prisma.addonItem.count();
  if (existingAddons === 0) {
    await prisma.addonItem.createMany({
      data: [
        {
          name: 'Cold Drink (Can 250ml)',
          description: 'Chilled Pepsi, 7Up, Coke, or Sprite',
          price: 100,
          category: 'Drinks',
          stock: 50,
          isAvailable: true,
        },
        {
          name: 'Monster / Red Bull Energy',
          description: 'Premium energy drink to keep your gaming session sharp',
          price: 350,
          category: 'Drinks',
          stock: 25,
          isAvailable: true,
        },
        {
          name: 'Lays / Kurkure Chips',
          description: 'Crispy snacks in various flavours',
          price: 80,
          category: 'Snacks',
          stock: 40,
          isAvailable: true,
        },
        {
          name: 'Karak Doodh Patti Chai',
          description: 'Freshly brewed aromatic desi tea',
          price: 120,
          category: 'Hot Beverages',
          stock: null, // Unlimited stock
          isAvailable: true,
        },
        {
          name: 'Loaded Cheese Nachos',
          description: 'Warm tortilla chips smothered in melted cheddar cheese and jalapeños',
          price: 250,
          category: 'Fast Food',
          stock: 20,
          isAvailable: true,
        }
      ]
    });
    console.log('✅ Seeded initial café and snack add-on items.');
  }

  // 2. Check if activities already exist — skip if already seeded
  const existingActivities = await prisma.activity.count();
  if (existingActivities > 0) {
    console.log('⚡ Activities & resources already seeded. Done!');
    return;
  }

  // Create Activities with pricing
  const activities = await Promise.all([
    prisma.activity.create({
      data: {
        name: 'Snooker',
        resourceType: ResourceType.SNOOKER,
        pricingUnit: PricingUnit.PER_HOUR,
        basePrice: 500,
      },
    }),
    prisma.activity.create({
      data: {
        name: 'PS5 Open Gaming',
        resourceType: ResourceType.PS5_OPEN,
        pricingUnit: PricingUnit.PER_HOUR,
        basePrice: 300,
      },
    }),
    prisma.activity.create({
      data: {
        name: 'PS5 Private Room',
        resourceType: ResourceType.PS5_PRIVATE,
        pricingUnit: PricingUnit.PER_HOUR,
        basePrice: 800,
      },
    }),
    prisma.activity.create({
      data: {
        name: 'Private Cinema',
        resourceType: ResourceType.CINEMA,
        pricingUnit: PricingUnit.PER_HOUR,
        basePrice: 1000,
      },
    }),
    prisma.activity.create({
      data: {
        name: 'Table Tennis',
        resourceType: ResourceType.TABLE_TENNIS,
        pricingUnit: PricingUnit.PER_HOUR,
        basePrice: 400,
      },
    }),
    prisma.activity.create({
      data: {
        name: 'Car Simulator',
        resourceType: ResourceType.CAR_SIMULATOR,
        pricingUnit: PricingUnit.PER_MINUTE,
        basePrice: 20,
      },
    }),
  ]);

  console.log('✅ Created activities:', activities.length);

  // Create Resources
  const resources = await Promise.all([
    // Snooker Tables
    prisma.resource.create({
      data: { name: 'Snooker Table 1', type: ResourceType.SNOOKER },
    }),
    prisma.resource.create({
      data: { name: 'Snooker Table 2', type: ResourceType.SNOOKER },
    }),
    prisma.resource.create({
      data: { name: 'Snooker Table 3', type: ResourceType.SNOOKER },
    }),

    // PS5 Open (Hall)
    prisma.resource.create({
      data: { name: 'PS5 Station 1', type: ResourceType.PS5_OPEN },
    }),
    prisma.resource.create({
      data: { name: 'PS5 Station 2', type: ResourceType.PS5_OPEN },
    }),
    prisma.resource.create({
      data: { name: 'PS5 Station 3', type: ResourceType.PS5_OPEN },
    }),
    prisma.resource.create({
      data: { name: 'PS5 Station 4', type: ResourceType.PS5_OPEN },
    }),

    // PS5 Private Room
    prisma.resource.create({
      data: { name: 'PS5 Private Room', type: ResourceType.PS5_PRIVATE },
    }),

    // Cinema
    prisma.resource.create({
      data: { name: 'Private Cinema Hall', type: ResourceType.CINEMA },
    }),

    // Table Tennis
    prisma.resource.create({
      data: { name: 'Table Tennis Room', type: ResourceType.TABLE_TENNIS },
    }),

    // Car Simulator
    prisma.resource.create({
      data: { name: 'Car Simulator', type: ResourceType.CAR_SIMULATOR },
    }),
  ]);

  console.log('✅ Created resources:', resources.length);

  // Create sample customer
  await prisma.customer.create({
    data: {
      name: 'Test Customer',
      phone: '03001234567',
      email: 'test@example.com',
    },
  });

  console.log('✅ Created sample customer');
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
