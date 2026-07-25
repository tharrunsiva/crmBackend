import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Annual', 'Medical', 'Emergency', 'Permission', 'Half-Day', 'Custom'],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    halfDayType: {
      type: String,
      enum: ['First Half', 'Second Half', 'None'],
      default: 'None',
    },
    reason: {
      type: String,
      required: [true, 'Please add a reason for leave'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
    adminComments: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;
