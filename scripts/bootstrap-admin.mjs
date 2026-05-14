import 'dotenv/config';
import connectToDatabase from '../api/_db.js';
import User from '../api/models/User.js';
import bcrypt from 'bcryptjs';

try {
  const email = process.argv[2] || 'admin@admin.com';
  const password = process.argv[3] || '123456';
  const username = process.argv[4] || 'admin';

  await connectToDatabase();

  const hash = await bcrypt.hash(password, 12);
  let user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    user = await User.create({
      email,
      username,
      passwordHash: hash,
      fullname: 'Administrator',
      role: 'admin',
      isActive: true,
      emailVerified: true,
    });
    console.log('created', String(user._id));
  } else {
    user.passwordHash = hash;
    user.role = 'admin';
    user.isActive = true;
    user.emailVerified = true;
    await user.save();
    console.log('updated', String(user._id));
  }
  process.exit(0);
} catch (e) {
  console.error('error:', e);
  process.exit(1);
}


