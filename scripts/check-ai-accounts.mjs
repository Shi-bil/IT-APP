import 'dotenv/config';
import mongoose from 'mongoose';
import AiAccount from '../api/models/AiAccount.js';

await mongoose.connect(process.env.MONGODB_URI);
const docs = await AiAccount.find({}, 'provider label accountEmail createdAt').lean();
console.log(`Found ${docs.length} AiAccount document(s):`);
console.log(JSON.stringify(docs, null, 2));
await mongoose.disconnect();
