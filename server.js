import app from './app.js';
import connectDB from './config/db.js';
import User from './models/User.js';

const PORT = process.env.PORT || 5000;

// Seed initial Admin User if database is empty
const seedAdminUser = async () => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      console.log('Seeding initial administrator account...');
      await User.create({
        name: 'Vinsup HR Admin',
        email: 'admin@vinsup.com',
        password: 'adminpassword',
        role: 'admin',
        hrId: 'HR-0001',
        status: 'active',
        onboardingStep: 2,
        phone: '1234567890',
        department: 'Human Resources',
        designation: 'HR Executive',
      });
      console.log('--- Admin Account Seeded ---');
      console.log('Email: admin@vinsup.com');
      console.log('Password: adminpassword');
      console.log('----------------------------');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

// Connect database and launch server
const startServer = async () => {
  try {
    await connectDB();
    await seedAdminUser();
    
    app.listen(PORT, () => {
      console.log(`Server is operating in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error(`Database connection or startup failure: ${err.message}`);
    process.exit(1);
  }
};

startServer();
