import { Chat } from "../models/chat.models.js";
import { Product } from "../models/product.models.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { Apierror } from "../utils/Apierror.js";
import { Apiresponse } from "../utils/apiresponse.js";

const mapConversationForClient = (chat, currentUserId) => {
  const isCurrentUserSeller = String(chat.seller?._id || chat.seller) === String(currentUserId);
  const participant = isCurrentUserSeller ? chat.buyer : chat.seller;
  const unreadCount = isCurrentUserSeller
    ? Number(chat.unreadCountForSeller || 0)
    : Number(chat.unreadCountForBuyer || 0);

  return {
    id: chat._id,
    participant: {
      id: participant?._id,
      name: participant?.name || "Unknown User",
      avatar: participant?.avatar || ""
    },
    product: {
      id: chat.product?._id,
      title: chat.product?.title || chat.product?.name || "Unknown Product",
      price: chat.product?.price || 0,
      image: chat.product?.image || chat.product?.images?.[0] || ""
    },
    messages: (chat.messages || []).map((message) => ({
      id: message._id,
      senderId: message.sender?._id || message.sender,
      text: message.text,
      timestamp: message.createdAt
    })),
    unreadCount,
    updatedAt: chat.updatedAt,
    lastMessageAt: chat.lastMessageAt
  };
};

export const getChats = asyncHandler(async (req, res) => {
  const currentUserId = req.user?._id || req.user?.id;

  if (!currentUserId) {
    throw new Apierror(401, "Unauthorized");
  }

  const chats = await Chat.find({
    $or: [{ seller: currentUserId }, { buyer: currentUserId }]
  })
    .populate("seller", "name")
    .populate("buyer", "name")
    .populate("product", "title name price image images")
    .populate("messages.sender", "name")
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  const conversations = chats.map((chat) => mapConversationForClient(chat, currentUserId));
  const totalUnread = conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);

  return res
    .status(200)
    .json(new Apiresponse(200, { conversations, totalUnread }, "chats fetched successfully"));
});

export const startChat = asyncHandler(async (req, res) => {
  const currentUserId = req.user?._id || req.user?.id;
  const { productId, participantId } = req.body;

  if (!currentUserId) {
    throw new Apierror(401, "Unauthorized");
  }

  const product = await Product.findById(productId).select("_id seller title name price image images");

  if (!product) {
    throw new Apierror(404, "product not found");
  }

  const isSeller = String(product.seller) === String(currentUserId);
  const buyerId = isSeller ? participantId : currentUserId;

  if (isSeller && !participantId) {
    throw new Apierror(400, "participantId is required when seller starts a chat");
  }

  if (!isSeller && String(product.seller) === String(currentUserId)) {
    throw new Apierror(403, "You cannot message yourself for your own listing");
  }

  if (String(buyerId) === String(product.seller)) {
    throw new Apierror(403, "You cannot create a chat with yourself");
  }

  const chat = await Chat.findOneAndUpdate(
    {
      product: product._id,
      seller: product.seller,
      buyer: buyerId
    },
    {
      $setOnInsert: {
        product: product._id,
        seller: product.seller,
        buyer: buyerId,
        messages: [],
        lastMessageAt: new Date()
      }
    },
    {
      upsert: true,
      new: true
    }
  )
    .populate("seller", "name")
    .populate("buyer", "name")
    .populate("product", "title name price image images")
    .populate("messages.sender", "name");

  return res
    .status(200)
    .json(new Apiresponse(200, { conversation: mapConversationForClient(chat, currentUserId) }, "chat ready"));
});

export const addChatMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const { text } = req.body;

  if (!currentUserId) {
    throw new Apierror(401, "Unauthorized");
  }

  const chat = await Chat.findById(id);

  if (!chat) {
    throw new Apierror(404, "chat not found");
  }

  const isParticipant =
    String(chat.seller) === String(currentUserId) ||
    String(chat.buyer) === String(currentUserId);

  if (!isParticipant) {
    throw new Apierror(403, "You are not a participant in this chat");
  }

  chat.messages.push({
    sender: currentUserId,
    text
  });
  chat.lastMessageAt = new Date();

  if (String(chat.buyer) === String(currentUserId)) {
    chat.unreadCountForSeller = Number(chat.unreadCountForSeller || 0) + 1;
    chat.unreadCountForBuyer = 0;
  } else {
    chat.unreadCountForBuyer = Number(chat.unreadCountForBuyer || 0) + 1;
    chat.unreadCountForSeller = 0;
  }

  await chat.save();

  const latestMessage = chat.messages[chat.messages.length - 1];

  return res.status(201).json(
    new Apiresponse(
      201,
      {
        message: {
          id: latestMessage._id,
          senderId: currentUserId,
          text: latestMessage.text,
          timestamp: latestMessage.createdAt
        }
      },
      "message sent"
    )
  );
});

export const markChatAsRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user?._id || req.user?.id;
  const { id } = req.params;

  if (!currentUserId) {
    throw new Apierror(401, "Unauthorized");
  }

  const chat = await Chat.findById(id);

  if (!chat) {
    throw new Apierror(404, "chat not found");
  }

  const isSeller = String(chat.seller) === String(currentUserId);
  const isBuyer = String(chat.buyer) === String(currentUserId);

  if (!isSeller && !isBuyer) {
    throw new Apierror(403, "You are not a participant in this chat");
  }

  if (isSeller) {
    chat.unreadCountForSeller = 0;
  }

  if (isBuyer) {
    chat.unreadCountForBuyer = 0;
  }

  await chat.save();

  return res.status(200).json(new Apiresponse(200, {}, "chat marked as read"));
});
