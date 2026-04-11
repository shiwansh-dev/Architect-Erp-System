/**
 * Helper script to set up Google Drive service account environment variable
 * 
 * Usage:
 *   node scripts/setup-google-drive-env.js path/to/service-account.json
 * 
 * This will output the environment variable value that you can add to your .env file
 */

const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.argv[2];

if (!serviceAccountPath) {
  console.error('Usage: node scripts/setup-google-drive-env.js <path-to-service-account.json>');
  process.exit(1);
}

try {
  const fullPath = path.resolve(serviceAccountPath);
  const serviceAccountContent = fs.readFileSync(fullPath, 'utf8');
  
  // Validate it's valid JSON
  const serviceAccount = JSON.parse(serviceAccountContent);
  
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    console.error('Error: Invalid service account file. Missing required fields.');
    process.exit(1);
  }
  
  // Stringify the JSON for environment variable
  const envValue = JSON.stringify(serviceAccount);
  
  console.log('\n✅ Service account file is valid!');
  console.log('\n📋 Add this to your .env or .env.local file:\n');
  console.log('GOOGLE_SERVICE_ACCOUNT_KEY=' + envValue.replace(/\n/g, '\\n'));
  console.log('\n⚠️  Important: Make sure the service account email has access to your Google Drive folder!');
  console.log('   Service account email:', serviceAccount.client_email);
  console.log('\n📁 To share the folder with the service account:');
  console.log('   1. Open your Google Drive folder');
  console.log('   2. Click "Share"');
  console.log('   3. Add this email:', serviceAccount.client_email);
  console.log('   4. Give it "Viewer" access\n');
  
} catch (error) {
  console.error('Error reading service account file:', error.message);
  process.exit(1);
}

