import mongoose from 'mongoose';

const employeeProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    },
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed'],
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    bloodGroup: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    experienceType: {
      type: String,
      enum: ['Fresher', 'Experienced'],
      default: 'Fresher',
    },
    currentCompany: {
      type: String,
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
    },
    skills: {
      type: [String],
      default: [],
    },
    education: [
      {
        degree: { type: String, required: true },
        institution: { type: String, required: true },
        passingYear: { type: Number, required: true },
        percentage: { type: Number, required: true },
      },
    ],
    documents: {
      profilePhoto: { type: String }, // File URLs/paths
      aadhar: { type: String },
      pan: { type: String },
      resume: { type: String },
      certificates: { type: String },
      experienceLetter: { type: String },
      passportPhoto: { type: String },
      addressProof: { type: String },
      degreeCertificate: { type: String },
    },
    profileCompletion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const EmployeeProfile = mongoose.model('EmployeeProfile', employeeProfileSchema);
export default EmployeeProfile;
