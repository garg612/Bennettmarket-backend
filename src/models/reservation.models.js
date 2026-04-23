import mongoose, { Schema } from "mongoose";

const reservationSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "reserved", "rejected", "cancelled"],
      default: "pending"
    },
    decidedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

reservationSchema.index(
  { product: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "reserved"] } }
  }
);
reservationSchema.index({ seller: 1, status: 1, updatedAt: -1 });
reservationSchema.index({ buyer: 1, createdAt: -1 });

export const Reservation = mongoose.model("Reservation", reservationSchema);
