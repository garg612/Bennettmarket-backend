import { Product } from "../models/product.models.js";
import { Reservation } from "../models/reservation.models.js";
import { Apierror } from "../utils/Apierror.js";
import { Apiresponse } from "../utils/apiresponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const mapReservationForClient = (reservation) => ({
  id: reservation._id,
  status: reservation.status,
  decidedAt: reservation.decidedAt,
  createdAt: reservation.createdAt,
  product: {
    id: reservation.product?._id,
    title: reservation.product?.title || reservation.product?.name || "Unknown Product",
    price: reservation.product?.price || 0,
    image: reservation.product?.image || reservation.product?.images?.[0] || "",
    status: reservation.product?.status || "available"
  },
  buyer: {
    id: reservation.buyer?._id,
    name: reservation.buyer?.name || "Unknown Buyer",
    email: reservation.buyer?.email || ""
  },
  seller: {
    id: reservation.seller?._id,
    name: reservation.seller?.name || "Unknown Seller",
    email: reservation.seller?.email || ""
  }
});

export const createReservationRequest = asyncHandler(async (req, res) => {
  const buyerId = req.user?._id || req.user?.id;
  const { id: productId } = req.params;

  if (!buyerId) {
    throw new Apierror(401, "Unauthorized");
  }

  const product = await Product.findById(productId).select("_id seller status title name price image images");

  if (!product) {
    throw new Apierror(404, "product not found");
  }

  if (String(product.seller) === String(buyerId)) {
    throw new Apierror(403, "You cannot reserve your own listing");
  }

  if (product.status !== "available") {
    throw new Apierror(409, "This listing is no longer available");
  }

  const existingOwnActiveRequest = await Reservation.findOne({
    product: productId,
    buyer: buyerId,
    status: { $in: ["pending", "reserved"] }
  })
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email");

  if (existingOwnActiveRequest) {
    return res.status(200).json(
      new Apiresponse(
        200,
        { reservation: mapReservationForClient(existingOwnActiveRequest) },
        "Reservation request already exists"
      )
    );
  }

  let reservation;
  try {
    reservation = await Reservation.create({
      product: productId,
      seller: product.seller,
      buyer: buyerId,
      status: "pending"
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new Apierror(409, "Another reservation request is already active for this listing");
    }

    throw error;
  }

  const hydratedReservation = await Reservation.findById(reservation._id)
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email");

  return res.status(201).json(
    new Apiresponse(201, { reservation: mapReservationForClient(hydratedReservation) }, "Reservation request sent")
  );
});

export const getIncomingReservations = asyncHandler(async (req, res) => {
  const sellerId = req.user?._id || req.user?.id;

  if (!sellerId) {
    throw new Apierror(401, "Unauthorized");
  }

  const reservations = await Reservation.find({
    seller: sellerId,
    status: { $in: ["pending", "reserved"] }
  })
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email")
    .sort({ status: 1, createdAt: -1 });

  return res
    .status(200)
    .json(new Apiresponse(200, { reservations: reservations.map(mapReservationForClient) }, "Reservations fetched"));
});

export const getMyReservations = asyncHandler(async (req, res) => {
  const buyerId = req.user?._id || req.user?.id;

  if (!buyerId) {
    throw new Apierror(401, "Unauthorized");
  }

  const reservations = await Reservation.find({
    buyer: buyerId
  })
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email")
    .sort({ createdAt: -1 })
    .limit(50);

  return res
    .status(200)
    .json(new Apiresponse(200, { reservations: reservations.map(mapReservationForClient) }, "Reservations fetched"));
});

export const decideReservation = asyncHandler(async (req, res) => {
  const sellerId = req.user?._id || req.user?.id;
  const { id } = req.params;
  const { action } = req.body;

  if (!sellerId) {
    throw new Apierror(401, "Unauthorized");
  }

  const reservation = await Reservation.findById(id);

  if (!reservation) {
    throw new Apierror(404, "reservation not found");
  }

  if (String(reservation.seller) !== String(sellerId)) {
    throw new Apierror(403, "You can only decide requests for your own listings");
  }

  if (action === "reserve") {
    if (reservation.status !== "pending") {
      throw new Apierror(409, "Only pending requests can be reserved");
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: reservation.product, status: "available" },
      { $set: { status: "reserved" } },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Apierror(409, "Listing is no longer available");
    }

    reservation.status = "reserved";
    reservation.decidedAt = new Date();
    await reservation.save();
  }

  if (action === "cancel") {
    if (!["pending", "reserved"].includes(reservation.status)) {
      throw new Apierror(409, "This reservation is already closed");
    }

    if (reservation.status === "reserved") {
      await Product.findByIdAndUpdate(reservation.product, { $set: { status: "available" } });
    }

    reservation.status = reservation.status === "pending" ? "rejected" : "cancelled";
    reservation.decidedAt = new Date();
    await reservation.save();
  }

  const updatedReservation = await Reservation.findById(reservation._id)
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email");

  return res
    .status(200)
    .json(new Apiresponse(200, { reservation: mapReservationForClient(updatedReservation) }, "Reservation updated"));
});

export const cancelMyReservation = asyncHandler(async (req, res) => {
  const buyerId = req.user?._id || req.user?.id;
  const { id } = req.params;

  if (!buyerId) {
    throw new Apierror(401, "Unauthorized");
  }

  const reservation = await Reservation.findById(id);

  if (!reservation) {
    throw new Apierror(404, "reservation not found");
  }

  if (String(reservation.buyer) !== String(buyerId)) {
    throw new Apierror(403, "You can only cancel your own reservation");
  }

  if (!["pending", "reserved"].includes(reservation.status)) {
    throw new Apierror(409, "This reservation is already closed");
  }

  if (reservation.status === "reserved") {
    await Product.findByIdAndUpdate(reservation.product, { $set: { status: "available" } });
  }

  reservation.status = "cancelled";
  reservation.decidedAt = new Date();
  await reservation.save();

  const updatedReservation = await Reservation.findById(reservation._id)
    .populate("product", "title name price image images status")
    .populate("buyer", "name email")
    .populate("seller", "name email");

  return res
    .status(200)
    .json(new Apiresponse(200, { reservation: mapReservationForClient(updatedReservation) }, "Reservation cancelled"));
});
