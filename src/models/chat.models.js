import mongoose, { Schema } from "mongoose";

const chatMessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    }
  },
  { timestamps: true }
);

const chatSchema = new Schema(
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
    messages: {
      type: [chatMessageSchema],
      default: []
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    unreadCountForSeller: {
      type: Number,
      default: 0,
      min: 0
    },
    unreadCountForBuyer: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

chatSchema.index({ buyer: 1, lastMessageAt: -1 });
chatSchema.index({ seller: 1, lastMessageAt: -1 });
chatSchema.index({ product: 1, buyer: 1, seller: 1 }, { unique: true });

export const Chat = mongoose.model("Chat", chatSchema);
