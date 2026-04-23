import mongoose,{Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
const productSchema= new Schema({

    title:{
        type:String,
        trim:true,
    },

    name:{
        type:String,
        required :true,
        trim:true,
    },
    description:{
        type:String,
        required:true,
        trim:true,
    },
    price:{
        type:Number,
        required:true,
    },
    category:{
        type:String,
        required:true,
    },
    image:{
        type:String,
        required:true,
    },
    images:{
        type:[String],
        default:[]
    },
    condition:{
        type:String,
        enum:["New","Like New","Good","Fair","Used"],
        default:"Good"
    },
    listedAt:{
        type:Date,
        default:Date.now
    },
    views:{
        type:Number,
        default:0,
        min:0
    },
    viewedBy:{
        type:[Schema.Types.ObjectId],
        ref:"User",
        default:[]
    },
    tags:{
        type:[String],
        default:[]
    },
    seller:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    status:{
        type:String,
        enum:["available","reserved","sold out"],
        default:"available"
    }

},{timestamps:true}
)

productSchema.pre("validate", function() {
    if (!this.name && this.title) {
        this.name = this.title;
    }

    if (!this.title && this.name) {
        this.title = this.name;
    }

    if ((!this.images || this.images.length === 0) && this.image) {
        this.images = [this.image];
    }

    if ((!this.image || this.image.length === 0) && this.images && this.images.length > 0) {
        this.image = this.images[0];
    }

    if (!this.listedAt && this.createdAt) {
        this.listedAt = this.createdAt;
    }
});

productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1, createdAt: -1 });

productSchema.plugin(mongoosePaginate)
export const Product=mongoose.model("Product",productSchema)
export default Product;