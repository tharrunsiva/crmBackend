import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import EmployeeProfile from '../models/EmployeeProfile.js';
import Document from '../models/Document.js';
import AuditLog from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/responseFormatter.js';
import { sendApprovalEmail } from '../utils/emailService.js';

// Helper to calculate profile completion percentage
const calculateCompletion = (profile, user) => {
  let score = 0;
  let total = 14; // Fields list

  if (profile.dob) score++;
  if (profile.gender) score++;
  if (profile.maritalStatus) score++;
  if (profile.address) score++;
  if (profile.city) score++;
  if (profile.state) score++;
  if (profile.pincode) score++;
  if (profile.bloodGroup) score++;
  if (profile.emergencyContact?.name) score++;
  if (profile.skills?.length > 0) score++;
  if (profile.education?.length > 0) score++;
  
  // Documents verification
  if (profile.documents?.profilePhoto) score++;
  if (profile.documents?.aadhar) score++;
  if (profile.documents?.pan) score++;

  return Math.round((score / total) * 100);
};

// @desc    Submit employee onboarding details
// @route   POST /api/employees/onboarding
// @access  Private (Employee role only)
export const submitOnboarding = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const {
    dob,
    gender,
    maritalStatus,
    address,
    city,
    state,
    country,
    pincode,
    bloodGroup,
    emergencyName,
    emergencyRelation,
    emergencyPhone,
    experienceType,
    currentCompany,
    yearsOfExperience,
    skills,
    education,
    phone,
  } = req.body;

  let parsedEducation = [];
  try {
    parsedEducation = typeof education === 'string' ? JSON.parse(education) : education;
  } catch (err) {
    parsedEducation = [];
  }

  let parsedSkills = [];
  try {
    parsedSkills = typeof skills === 'string' ? JSON.parse(skills) : skills;
  } catch (err) {
    parsedSkills = skills || [];
  }

  // Find or create profile
  let profile = await EmployeeProfile.findOne({ user: userId });
  if (!profile) {
    profile = new EmployeeProfile({ user: userId });
  }

  // Handle uploaded files
  const files = req.files || {};
  const docFields = [
    'profilePhoto',
    'aadhar',
    'pan',
    'resume',
    'certificates',
    'experienceLetter',
    'passportPhoto',
    'addressProof',
    'degreeCertificate',
  ];

  const documentsToSave = [];

  docFields.forEach((field) => {
    if (files[field] && files[field][0]) {
      const fileObj = files[field][0];
      const filePath = `/uploads/documents/${fileObj.filename}`;
      profile.documents[field] = filePath;

      // Track inside Document collection
      let docType = field.charAt(0).toUpperCase() + field.slice(1);
      if (field === 'profilePhoto') docType = 'Passport Photo';
      else if (field === 'pan') docType = 'PAN';
      else if (field === 'aadhar') docType = 'Aadhar';
      else if (field === 'resume') docType = 'Resume';

      documentsToSave.push({
        user: userId,
        name: fileObj.originalname,
        type: docType,
        path: filePath,
        status: 'Pending',
      });
    }
  });

  // Save documents to DB
  if (documentsToSave.length > 0) {
    await Document.insertMany(documentsToSave);
  }

  // Save Profile Details
  profile.dob = dob ? new Date(dob) : profile.dob;
  profile.gender = gender || profile.gender;
  profile.maritalStatus = maritalStatus || profile.maritalStatus;
  profile.address = address || profile.address;
  profile.city = city || profile.city;
  profile.state = state || profile.state;
  profile.country = country || profile.country;
  profile.pincode = pincode || profile.pincode;
  profile.bloodGroup = bloodGroup || profile.bloodGroup;
  profile.emergencyContact = {
    name: emergencyName || profile.emergencyContact?.name,
    relationship: emergencyRelation || profile.emergencyContact?.relationship,
    phone: emergencyPhone || profile.emergencyContact?.phone,
  };
  profile.experienceType = experienceType || profile.experienceType;
  profile.currentCompany = currentCompany || profile.currentCompany;
  profile.yearsOfExperience = yearsOfExperience || profile.yearsOfExperience;
  profile.skills = parsedSkills;
  profile.education = parsedEducation;

  // Calculate completion percentage
  profile.profileCompletion = calculateCompletion(profile, req.user);

  await profile.save();

  // Update onboarding status and phone in User schema
  await User.findByIdAndUpdate(userId, { phone, onboardingStep: 1, status: 'pending' });

  // Audit Log
  await AuditLog.create({
    user: userId,
    action: 'ONBOARDING_SUBMIT',
    details: `Employee submitted onboarding details. Completion: ${profile.profileCompletion}%`,
  });

  sendSuccess(res, 'Onboarding profile submitted successfully', profile);
});

// @desc    Get employee profile details
// @route   GET /api/employees/profile
// @access  Private
export const getMyProfile = asyncHandler(async (req, res) => {
  let profile = await EmployeeProfile.findOne({ user: req.user._id }).populate('user', '-password');
  
  if (!profile) {
    // Gracefully construct blank profile on query if not found
    profile = await EmployeeProfile.create({
      user: req.user._id,
      skills: [],
      education: [],
      documents: {
        profilePhoto: '',
        aadhar: '',
        pan: '',
        resume: '',
      },
      profileCompletion: 0,
    });
    // Populate user details
    profile = await EmployeeProfile.findOne({ user: req.user._id }).populate('user', '-password');
  }

  sendSuccess(res, 'Profile retrieved', profile);
});

// @desc    Update employee profile details
// @route   PUT /api/employees/profile
// @access  Private
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { phone, address, city, state, country, pincode, emergencyContact, skills, education } = req.body;

  let profile = await EmployeeProfile.findOne({ user: req.user._id });
  if (!profile) {
    res.status(404);
    throw new Error('Profile not found. Please complete onboarding first.');
  }

  // Update allowed profile fields
  profile.address = address || profile.address;
  profile.city = city || profile.city;
  profile.state = state || profile.state;
  profile.country = country || profile.country;
  profile.pincode = pincode || profile.pincode;

  if (emergencyContact) {
    profile.emergencyContact = {
      name: emergencyContact.name || profile.emergencyContact?.name,
      relationship: emergencyContact.relationship || profile.emergencyContact?.relationship,
      phone: emergencyContact.phone || profile.emergencyContact?.phone,
    };
  }

  if (skills) profile.skills = skills;
  if (education) profile.education = education;

  // Recalculate completion
  profile.profileCompletion = calculateCompletion(profile, req.user);
  await profile.save();

  // If phone is updated, update user schema as well
  if (phone) {
    await User.findByIdAndUpdate(req.user._id, { phone });
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'PROFILE_UPDATE',
    details: 'Employee updated contact info/skills',
  });

  sendSuccess(res, 'Profile details updated', profile);
});

// @desc    Get all employees with pagination & search (Admin)
// @route   GET /api/admin/employees
// @access  Private (Admin)
export const getEmployeesList = asyncHandler(async (req, res) => {
  const { search, department, status, page = 1, limit = 10 } = req.query;

  const query = { role: 'employee' };

  if (status) {
    query.status = status;
  }
  if (department) {
    query.department = department;
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
    ];
  }

  const skipIndex = (parseInt(page) - 1) * parseInt(limit);
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skipIndex);

  const userIds = users.map((u) => u._id);
  const profiles = await EmployeeProfile.find({ user: { $in: userIds } }).select('user documents.profilePhoto');
  
  const photoMap = {};
  profiles.forEach((p) => {
    if (p.user && p.documents?.profilePhoto) {
      photoMap[p.user.toString()] = p.documents.profilePhoto;
    }
  });

  const usersWithPhotos = users.map((user) => {
    const userObj = user.toObject();
    userObj.documents = {
      profilePhoto: photoMap[user._id.toString()] || ''
    };
    return userObj;
  });

  sendSuccess(res, 'Employees fetched successfully', {
    employees: usersWithPhotos,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Get specific employee profile by ID (Admin)
// @route   GET /api/admin/employees/:id
// @access  Private (Admin)
export const getEmployeeById = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const userObj = await User.findById(userId);
  if (!userObj) {
    res.status(404);
    throw new Error('Employee account not found');
  }

  const profile = await EmployeeProfile.findOne({ user: userId }).populate('user');
  const documents = await Document.find({ user: userId });

  sendSuccess(res, 'Employee detailed records retrieved', {
    user: userObj,
    profile,
    documents,
  });
});

// @desc    Approve or reject pending registration (Admin)
// @route   PUT /api/admin/employees/:id/approve
// @access  Private (Admin)
export const approveRejectEmployee = asyncHandler(async (req, res) => {
  const { status, remarks, department, designation } = req.body; // status: 'active' or 'rejected'
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error('Employee account not found');
  }

  if (status !== 'active' && status !== 'rejected' && status !== 'changes_requested') {
    res.status(400);
    throw new Error('Invalid status. Choose active, rejected, or changes_requested');
  }

  user.status = status;
  if (status === 'active') {
    user.onboardingStep = 2; // Approving onboarding step
    if (department) user.department = department;
    if (designation) user.designation = designation;
  } else if (status === 'changes_requested') {
    user.onboardingStep = 0; // Reset onboarding step for re-submission
  }
  await user.save();

  // Update associated documents statuses
  let docStatus = 'Pending';
  if (status === 'active') docStatus = 'Approved';
  else if (status === 'rejected') docStatus = 'Rejected';
  else if (status === 'changes_requested') docStatus = 'Changes Requested';

  await Document.updateMany({ user: userId, status: 'Pending' }, { status: docStatus, remarks });

  // Send mail notice
  if (status === 'active') {
    await sendApprovalEmail(user);
  }

  await AuditLog.create({
    user: req.user._id,
    action: status === 'active' ? 'APPROVE_EMPLOYEE' : 'REJECT_EMPLOYEE',
    details: `Admin ${status} employee ${user.name} (${user.employeeId})`,
  });

  sendSuccess(res, `Employee has been ${status === 'active' ? 'Approved' : 'Rejected'}`, user);
});

// @desc    Activate or deactivate employee account (Admin)
// @route   PUT /api/admin/employees/:id/status
// @access  Private (Admin)
export const toggleEmployeeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'active' or 'deactivated'
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Employee account not found');
  }

  if (status !== 'active' && status !== 'deactivated') {
    res.status(400);
    throw new Error('Invalid status. Choose active or deactivated');
  }

  user.status = status;
  await user.save();

  await AuditLog.create({
    user: req.user._id,
    action: status === 'active' ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
    details: `Admin toggled status to ${status} for ${user.name}`,
  });

  sendSuccess(res, `Account status set to ${status}`, user);
});

// @desc    Reset password for employee (Admin)
// @route   PUT /api/admin/employees/:id/reset-password
// @access  Private (Admin)
export const resetEmployeePasswordAdmin = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('Employee account not found');
  }

  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  user.password = newPassword;
  await user.save();

  await AuditLog.create({
    user: req.user._id,
    action: 'ADMIN_RESET_PASSWORD',
    details: `Admin reset password for ${user.name}`,
  });

  sendSuccess(res, 'Employee password reset successfully');
});

// @desc    Bulk actions on employees (Admin)
// @route   POST /api/admin/employees/bulk
// @access  Private (Admin)
export const bulkActionEmployees = asyncHandler(async (req, res) => {
  const { ids, action } = req.body; // action: 'approve' | 'reject' | 'delete'

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('Please provide an array of employee IDs');
  }

  if (action === 'approve') {
    await User.updateMany({ _id: { $in: ids }, role: 'employee' }, { status: 'active', onboardingStep: 2 });
    await Document.updateMany({ user: { $in: ids } }, { status: 'Approved' });
  } else if (action === 'reject') {
    await User.updateMany({ _id: { $in: ids }, role: 'employee' }, { status: 'rejected' });
    await Document.updateMany({ user: { $in: ids } }, { status: 'Rejected' });
  } else if (action === 'delete') {
    await User.deleteMany({ _id: { $in: ids }, role: 'employee' });
    await EmployeeProfile.deleteMany({ user: { $in: ids } });
    await Document.deleteMany({ user: { $in: ids } });
  } else {
    res.status(400);
    throw new Error('Invalid bulk action name');
  }

  await AuditLog.create({
    user: req.user._id,
    action: 'BULK_ACTION',
    details: `Admin performed bulk ${action} on ${ids.length} records`,
  });

  sendSuccess(res, `Bulk action ${action} completed successfully`);
});
