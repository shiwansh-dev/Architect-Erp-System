/**
 * Script to add /billing to user's allowedPaths
 * Run with: node scripts/add-billing-path.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'your-database-name';

async function addBillingPath() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // Add /billing to all users' allowedPaths
    const result = await usersCollection.updateMany(
      {},
      {
        $addToSet: { allowedPaths: '/billing' }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users with /billing path`);
    
    // Also update specific user by email if needed
    const specificUser = await usersCollection.updateOne(
      { email: 'shiwanshaggarwal2004@gmail.com' },
      {
        $addToSet: { allowedPaths: '/billing' }
      }
    );
    
    console.log(`Updated specific user: ${specificUser.modifiedCount} document(s)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

addBillingPath();




