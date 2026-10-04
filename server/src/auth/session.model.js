import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    tokenIdHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
  type: Date,
  required: true,
},

    revokedAt: {
      type: Date,
      default: null,
    },

    replacedByTokenIdHash: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export const Session = mongoose.model(
  'Session',
  sessionSchema,
  'sessions',
);