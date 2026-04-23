import { Router } from "express";
import { optionalJWT, verifyJWT } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import {
    validateBody,
    validateParams,
    validateQuery
} from "../middlewares/validate.middlewares.js";
import {
    buyProductParamsSchema,
    createProductSchema,
    getProductsQuerySchema,
    updateProductSchema
} from "../validations/product.validation.js";

import {
    createproduct,
    buyproduct,
    getproducts,
    getmyproducts,
    getproductbyid,
    reportSellerVerification,
    updateproduct,
}from "../controllers/product.controllers.js"

const router=Router();

router.route("/createproduct").post(verifyJWT,
    upload.fields([{
        name:"images",
        maxCount:5
    },{
        name:"image",
        maxCount:1
    }]),
    validateBody(createProductSchema),
    createproduct
)
router.route("/buyproduct/:id").post(verifyJWT, validateParams(buyProductParamsSchema), buyproduct);
router.route("/:id/report_verification").post(verifyJWT, validateParams(buyProductParamsSchema), reportSellerVerification);
router.route("/mine").get(verifyJWT, getmyproducts);
router.route("/:id").patch(
    verifyJWT,
    validateParams(buyProductParamsSchema),
    upload.fields([
        {
            name: "images",
            maxCount: 5
        },
        {
            name: "image",
            maxCount: 1
        }
    ]),
    validateBody(updateProductSchema),
    updateproduct
);
router.route("/:id").get(optionalJWT, validateParams(buyProductParamsSchema), getproductbyid);
router.route("/").get(validateQuery(getProductsQuerySchema), getproducts);

export default router;