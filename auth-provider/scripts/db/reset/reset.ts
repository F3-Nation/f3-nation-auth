import { resetAll } from '@/scripts/db/reset';

resetAll()
  .then(() => {
    console.log('\n🎉 Reset completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  });
