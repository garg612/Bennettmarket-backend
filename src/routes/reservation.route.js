import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { validateBody, validateParams } from "../middlewares/validate.middlewares.js";
import {
  cancelMyReservation,
  createReservationRequest,
  decideReservation,
  getIncomingReservations,
  getMyReservations
} from "../controllers/reservation.controllers.js";
import { reservationDecisionSchema, reservationParamsSchema } from "../validations/reservation.validation.js";

const router = Router();

router.route("/request/:id").post(verifyJWT, validateParams(reservationParamsSchema), createReservationRequest);
router.route("/incoming").get(verifyJWT, getIncomingReservations);
router.route("/mine").get(verifyJWT, getMyReservations);
router.route("/:id/decision").patch(
  verifyJWT,
  validateParams(reservationParamsSchema),
  validateBody(reservationDecisionSchema),
  decideReservation
);
router.route("/:id/cancel").patch(verifyJWT, validateParams(reservationParamsSchema), cancelMyReservation);

export default router;
