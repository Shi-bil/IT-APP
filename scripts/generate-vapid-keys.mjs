#!/usr/bin/env node
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\nVAPID keys generated. Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:aiworkstation00@gmail.com`);
console.log('\nAlso expose the public key to the client (Vite picks it up automatically):');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('');
