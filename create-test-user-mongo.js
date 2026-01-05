import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

async function createTestUser() {
  const client = new MongoClient(process.env.DATABASE_URL);

  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('User');

    // Hash the password
    const passwordHash = bcrypt.hashSync('testpass123', 10);

    // Create the test user
    const result = await users.updateOne(
      { email: 'testuser@example.com' },
      {
        $set: {
          email: 'testuser@example.com',
          passwordHash,
          name: 'Test User',
          phoneNumber: '+971501234567',
          role: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          id: 'test-user-id',
        }
      },
      { upsert: true }
    );

    console.log('✅ Test user created/updated:', result.upsertedId || 'existing user updated');
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await client.close();
  }
}

createTestUser();
