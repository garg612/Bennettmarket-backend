import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { validateBody, validateParams } from "../middlewares/validate.middlewares.js";
import { addMessageSchema, chatParamsSchema, startChatSchema } from "../validations/chat.validation.js";
import { addChatMessage, getChats, markChatAsRead, startChat } from "../controllers/chat.controllers.js";

const router = Router();

router.route("/").get(verifyJWT, getChats);
router.route("/start").post(verifyJWT, validateBody(startChatSchema), startChat);
router.route("/:id/messages").post(verifyJWT, validateParams(chatParamsSchema), validateBody(addMessageSchema), addChatMessage);
router.route("/:id/read").patch(verifyJWT, validateParams(chatParamsSchema), markChatAsRead);

export default router;
