import { seedAllClients } from '@/scripts/db/seed';

seedAllClients()
  .then(() => {
    console.log('\n🎉 OAuth client seeding completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ OAuth client seeding failed:', error);
    process.exit(1);
  });
