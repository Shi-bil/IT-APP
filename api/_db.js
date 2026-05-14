import mongoose from 'mongoose';

// Cache the database connection across hot-reloads and serverless invocations
const globalForMongoose = globalThis;

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = { conn: null, promise: null };
}

const cached = globalForMongoose._mongoose;

// Skip running validators on update; we trust app-level validation and gain speed.
mongoose.set('runValidators', false);
// Strict queries are slightly faster + safer.
mongoose.set('strictQuery', true);
// Disable buffering so we fail fast instead of queueing ops when disconnected.
mongoose.set('bufferCommands', false);

export default async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    const dbName = process.env.MONGODB_DB || undefined;
    cached.promise = mongoose
      .connect(uri, {
        dbName,
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 5000,
        family: 4,
        autoIndex: false,
      })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
