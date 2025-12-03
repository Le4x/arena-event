import { PrismaClient, Role, QuestionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@arena-event.com' },
    update: {},
    create: {
      email: 'admin@arena-event.com',
      password: adminPassword,
      role: Role.SUPER_ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create organizer user
  const organizerPassword = await bcrypt.hash('organizer123', 10);
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@arena-event.com' },
    update: {},
    create: {
      email: 'organizer@arena-event.com',
      password: organizerPassword,
      role: Role.ORGANIZER,
      firstName: 'John',
      lastName: 'Organizer',
    },
  });

  console.log('✅ Organizer user created:', organizer.email);

  // Create a demo event
  const event = await prisma.event.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Blind Test - 90s Music',
      description: 'A demo event with sample questions for testing',
      ownerId: organizer.id,
    },
  });

  console.log('✅ Demo event created:', event.name);

  // Create rounds
  const round1 = await prisma.round.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      eventId: event.id,
      name: 'Round 1: Pop Hits',
      description: 'Famous pop songs from the 90s',
      order: 0,
    },
  });

  console.log('✅ Round 1 created:', round1.name);

  // Create sample questions
  await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      roundId: round1.id,
      type: QuestionType.MCQ,
      content: 'Who sang "Baby One More Time"?',
      timeLimit: 30,
      points: 100,
      order: 0,
      choices: ['Britney Spears', 'Christina Aguilera', 'Backstreet Boys', 'NSYNC'],
      correctAnswer: 'Britney Spears',
    },
  });

  await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      roundId: round1.id,
      type: QuestionType.TRUE_FALSE,
      content: '"Smells Like Teen Spirit" was released by Nirvana in 1991',
      timeLimit: 20,
      points: 50,
      order: 1,
      choices: ['True', 'False'],
      correctAnswer: 'True',
    },
  });

  await prisma.question.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      roundId: round1.id,
      type: QuestionType.BUZZER,
      content: 'First to buzz gets to answer!',
      timeLimit: 15,
      points: 150,
      order: 2,
    },
  });

  console.log('✅ Sample questions created');

  console.log('\n🎉 Seed completed!\n');
  console.log('📝 Demo credentials:');
  console.log('   Admin: admin@arena-event.com / admin123');
  console.log('   Organizer: organizer@arena-event.com / organizer123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
