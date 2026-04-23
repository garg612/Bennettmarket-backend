import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema({
    buyer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending"
    }

}, { timestamps: true });

orderSchema.index({ product: 1 }, { unique: true });
orderSchema.index({ buyer: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);