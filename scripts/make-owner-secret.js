#!/usr/bin/env node
// Makes the owner's second-factor secret (and, with --key, a new strong owner key).
// Run it on YOUR computer, not on the server. Nothing is sent anywhere or saved to disk.
//   node scripts/make-owner-secret.js          -> prints ADMIN_TOTP_SECRET
//   node scripts/make-owner-secret.js --key    -> also prints a new ADMIN_KEY
const crypto = require('crypto'), S = require('../lib/security');
const secret = S.newTotpSecret();
console.log('\n1. On Render > your service > Environment, add:\n\n   ADMIN_TOTP_SECRET = ' + secret + '\n');
if (process.argv.includes('--key')) console.log('   ADMIN_KEY        = ' + crypto.randomBytes(24).toString('base64url') + '\n   (replace the old key; anyone who ever saw the old one should be assumed to have it)\n');
console.log('2. In your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password...),');
console.log('   choose "Add account" > "Enter a setup key", and type:\n');
console.log('   Account name: Haggle owner');
console.log('   Key:          ' + secret);
console.log('   Type:         Time based (TOTP), 6 digits, 30 seconds\n');
console.log('   Or, if your app can read an otpauth link, use:\n   ' + S.otpauthUri(secret, 'owner', 'Haggle') + '\n');
console.log('3. Save the key in a password manager as a backup. If you lose both the app and the key,');
console.log('   you must make a new secret and change ADMIN_TOTP_SECRET on Render.');
console.log('4. Close this window: the secret is shown only now.\n');
