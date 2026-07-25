import mongoose from 'mongoose';

const idCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cardId: {
      type: String,
      required: true,
      unique: true,
    },
    qrCodeUrl: {
      type: String,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Revoked'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

const IDCard = mongoose.model('IDCard', idCardSchema);
export default IDCard;
