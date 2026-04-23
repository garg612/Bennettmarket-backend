import {Product} from "../models/product.models.js";
import { Reservation } from "../models/reservation.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { Apierror } from "../utils/Apierror.js";
import { Apiresponse } from "../utils/apiresponse.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const mapProductForClient = (productDoc) => {
    const product = productDoc?.toObject ? productDoc.toObject() : productDoc;
    if (!product) {
        return null;
    }

    return {
        id: product._id,
        title: product.title || product.name,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        condition: product.condition || "Good",
        image: product.image,
        images: Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : (product.image ? [product.image] : []),
        seller: product.seller
            ? {
                id: product.seller?._id || product.seller,
                name: product.seller?.name || "Unknown Seller",
                email: product.seller?.email || "",
                studentVerification: {
                    status: product.seller?.studentVerification?.status || "unverified",
                    idCardFront: product.seller?.studentVerification?.idCardFront || "",
                    idCardBack: product.seller?.studentVerification?.idCardBack || "",
                    submittedAt: product.seller?.studentVerification?.submittedAt || null,
                    reportCount: product.seller?.studentVerification?.reportCount || 0
                }
            }
            : null,
        status: product.status,
        listedAt: product.listedAt || product.createdAt,
        views: product.views || 0,
        tags: product.tags || [],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
    };
};


export const createproduct=asyncHandler(async(req,res)=>{
    const {name,description,price,category,condition}=req.body
    const sellerId = req.user?._id || req.user?.id;

    if (!sellerId) {
        throw new Apierror(401, "Unauthorized");
    }

    const imageFiles = [
        ...(req.files?.images || []),
        ...(req.files?.image || [])
    ];

    if(imageFiles.length === 0){
        throw new Apierror(400,"product image is required")
    }

    let uploadedImages = [];
    let product;

    try{
        uploadedImages = await Promise.all(
            imageFiles.map((file) => uploadOnCloudinary(file.path))
        );
    }catch(error){
        throw new Apierror(500,"failed to upload image")
    }

    if (!uploadedImages.length || uploadedImages.some((image) => !image?.url)) {
        await Promise.all(
            uploadedImages
                .filter((image) => image?.public_id)
                .map((image) => deleteFromCloudinary(image.public_id))
        );
        throw new Apierror(500, "failed to upload product image");
    }

    const imageUrls = uploadedImages.map((image) => image.url);

    try{
    product=await Product.create({
        name,
        title: name,
        description,
        price,
        category,
        condition: condition || "Good",
        image:imageUrls[0],
        images:imageUrls,
        listedAt: new Date(),
        seller:sellerId
    });
}catch(error){
    await Promise.all(
        uploadedImages
            .filter((image) => image?.public_id)
            .map((image) => deleteFromCloudinary(image.public_id))
    );

    if (error?.name === "ValidationError") {
        const details = Object.values(error.errors || {}).map((item) => ({
            path: item.path,
            message: item.message
        }));
        throw new Apierror(400, "product validation failed", details);
    }

    throw new Apierror(500, error?.message || "failed to create product")
    
}
    return res.status(201).json(new Apiresponse(201,{product: mapProductForClient(product)},"product created successfully"))
})

export const buyproduct=asyncHandler(async(req,res)=>{
    const {id}=req.params
    const buyerId = req.user?._id || req.user?.id;

    if (!buyerId) {
        throw new Apierror(401, "Unauthorized");
    }

    const product = await Product.findById(id).select("_id seller status");

    if (!product) {
        throw new Apierror(404, "product not found");
    }

    if (String(product.seller) === String(buyerId)) {
        throw new Apierror(403, "You cannot reserve your own listing");
    }

    if (product.status !== "available") {
        throw new Apierror(409, "This listing is no longer available");
    }

    const existingReservation = await Reservation.findOne({
        product: id,
        buyer: buyerId,
        status: { $in: ["pending", "reserved"] }
    });

    if (existingReservation) {
        return res.status(200).json(
            new Apiresponse(200, { reservation: existingReservation }, "Reservation request already exists")
        );
    }

    try {
        const reservation = await Reservation.create({
            product: id,
            seller: product.seller,
            buyer: buyerId,
            status: "pending"
        });

        return res.status(201).json(new Apiresponse(201, { reservation }, "reservation request sent"));
    } catch (error) {
        if (error?.code === 11000) {
            throw new Apierror(409, "Another reservation request is already active for this listing");
        }

        throw error;
    }
});

export const getproducts=asyncHandler(async(req,res)=>{
    const {page=1,limit=10}=req.query;
    const boundedLimit = Math.min(limit, 50);
    const options={
        page,
        limit:boundedLimit,
        populate:{
            path:"seller",
            select:"name email studentVerification"
        },
        sort:{createdAt:-1}
    }
    const products=await Product.paginate({status: { $in: ["available", "reserved"] }},options)
    return res.status(200).json(new Apiresponse(
        200,
        {
            products: {
                ...products,
                docs: products.docs.map(mapProductForClient)
            }
        },
        "products fetched successfully"
    ))
    
})

export const getmyproducts = asyncHandler(async (req, res) => {
    const sellerId = req.user?._id || req.user?.id;

    if (!sellerId) {
        throw new Apierror(401, "Unauthorized");
    }

    const products = await Product.find({ seller: sellerId })
        .populate({
            path: "seller",
            select: "name email studentVerification"
        })
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new Apiresponse(200, { products: products.map(mapProductForClient) }, "products fetched successfully")
    );
});

export const getproductbyid = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const viewerId = req.user?._id || req.user?.id;

    const product = await Product.findById(id)
        .populate({
            path: "seller",
            select: "name email studentVerification"
        });

    if (!product) {
        throw new Apierror(404, "product not found");
    }

    const sellerId = product?.seller?._id || product?.seller;
    const shouldIncrementViews = viewerId && String(sellerId) !== String(viewerId);

    let resolvedProduct = product;

    if (shouldIncrementViews) {
        const updatedProduct = await Product.findOneAndUpdate(
            {
                _id: id,
                viewedBy: { $ne: viewerId }
            },
            {
                $inc: { views: 1 },
                $addToSet: { viewedBy: viewerId }
            },
            { new: true }
        ).populate({
            path: "seller",
            select: "name email studentVerification"
        });

        if (updatedProduct) {
            resolvedProduct = updatedProduct;
        }
    }

    let viewerReservationStatus = null;
    let viewerReservationId = null;

    if (viewerId && String(sellerId) !== String(viewerId)) {
        const viewerReservation = await Reservation.findOne({
            product: id,
            buyer: viewerId,
            status: { $in: ["pending", "reserved"] }
        }).select("_id status");

        if (viewerReservation) {
            viewerReservationStatus = viewerReservation.status;
            viewerReservationId = viewerReservation._id;
        }
    }

    return res.status(200).json(
        new Apiresponse(
            200,
            {
                product: {
                    ...mapProductForClient(resolvedProduct),
                    viewerReservationStatus,
                    viewerReservationId
                }
            },
            "product fetched successfully"
        )
    );
});

export const updateproduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sellerId = req.user?._id || req.user?.id;

    if (!sellerId) {
        throw new Apierror(401, "Unauthorized");
    }

    const product = await Product.findById(id);

    if (!product) {
        throw new Apierror(404, "product not found");
    }

    if (String(product.seller) !== String(sellerId)) {
        throw new Apierror(403, "You can only edit your own listing");
    }

    if (product.status !== "available") {
        throw new Apierror(409, "Sold listings cannot be edited");
    }

    const { name, description, price, category, condition } = req.body;
    const updates = {};

    if (name !== undefined) {
        updates.name = name;
        updates.title = name;
    }

    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (category !== undefined) updates.category = category;
    if (condition !== undefined) updates.condition = condition;

    const imageFiles = [
        ...(req.files?.images || []),
        ...(req.files?.image || [])
    ];

    let uploadedImages = [];

    if (imageFiles.length > 0) {
        uploadedImages = await Promise.all(
            imageFiles.map((file) => uploadOnCloudinary(file.path))
        );

        if (uploadedImages.some((image) => !image?.url)) {
            await Promise.all(
                uploadedImages
                    .filter((image) => image?.public_id)
                    .map((image) => deleteFromCloudinary(image.public_id))
            );
            throw new Apierror(500, "failed to upload product image");
        }

        const imageUrls = uploadedImages.map((image) => image.url);
        updates.image = imageUrls[0];
        updates.images = imageUrls;
    }

    if (Object.keys(updates).length === 0) {
        throw new Apierror(400, "No updates provided");
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate({
            path: "seller",
            select: "name email studentVerification"
        });

        return res.status(200).json(
            new Apiresponse(200, { product: mapProductForClient(updatedProduct) }, "product updated successfully")
        );
    } catch (error) {
        await Promise.all(
            uploadedImages
                .filter((image) => image?.public_id)
                .map((image) => deleteFromCloudinary(image.public_id))
        );

        if (error?.name === "ValidationError") {
            const details = Object.values(error.errors || {}).map((item) => ({
                path: item.path,
                message: item.message
            }));
            throw new Apierror(400, "product validation failed", details);
        }

        throw new Apierror(500, error?.message || "failed to update product");
    }
});

export const reportSellerVerification = asyncHandler(async (req, res) => {
    const reporterId = req.user?._id || req.user?.id;
    const { id: productId } = req.params;

    if (!reporterId) {
        throw new Apierror(401, "Unauthorized");
    }

    const product = await Product.findById(productId).select("seller");

    if (!product) {
        throw new Apierror(404, "product not found");
    }

    const sellerId = product.seller;

    if (String(sellerId) === String(reporterId)) {
        throw new Apierror(403, "You cannot report your own verification");
    }

    const updatedSeller = await User.findOneAndUpdate(
        {
            _id: sellerId,
            "studentVerification.status": "verified",
            "studentVerification.reportedBy": { $ne: reporterId }
        },
        {
            $addToSet: { "studentVerification.reportedBy": reporterId },
            $inc: { "studentVerification.reportCount": 1 }
        },
        { new: true }
    ).select("studentVerification");

    if (!updatedSeller) {
        const seller = await User.findById(sellerId).select("studentVerification");

        if (!seller) {
            throw new Apierror(404, "seller not found");
        }

        if (seller.studentVerification?.status !== "verified") {
            throw new Apierror(409, "Seller verification is not reportable right now");
        }

        throw new Apierror(409, "You have already reported this seller verification");
    }

    if (Number(updatedSeller.studentVerification?.reportCount || 0) > 4) {
        updatedSeller.studentVerification.status = "fraud";
        await updatedSeller.save({ validateBeforeSave: false });
    }

    return res.status(200).json(
        new Apiresponse(
            200,
            {
                studentVerification: {
                    status: updatedSeller.studentVerification?.status || "unverified",
                    reportCount: updatedSeller.studentVerification?.reportCount || 0
                }
            },
            "verification report submitted"
        )
    );
});