import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

async function main() {
  const adminEmail = 'admin@jobflow.com';
  console.log('Seeding database...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    await prisma.user.create({
      data: {
        id: 'admin-id-1234',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        isVerified: true,
      },
    });
    console.log('Admin user seeded successfully.');
  } else {
    console.log('Admin user already exists. Skipping seed.');
  }
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
