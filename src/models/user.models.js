import mongoose,{Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const userSchema= new Schema({
    
    name:{
        type:String,
        required :true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        required :true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    microsoftId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        default: undefined
    },
    password:{
        type:String,
        required :[true, "Password is required"],
        trim:true,  

    },
    refreshtoken:{
        type:String,
        default:""
    },
    studentVerification: {
        status: {
            type: String,
            enum: ["unverified", "verified", "fraud"],
            default: "unverified"
        },
        reportCount: {
            type: Number,
            default: 0,
            min: 0
        },
        reportedBy: {
            type: [Schema.Types.ObjectId],
            ref: "User",
            default: []
        },
        otpCodeHash: {
            type: String,
            default: ""
        },
        otpExpiresAt: {
            type: Date,
            default: null
        },
        otpSentAt: {
            type: Date,
            default: null
        },
        otpAttemptCount: {
            type: Number,
            default: 0,
            min: 0
        },
        otpLockedUntil: {
            type: Date,
            default: null
        }
    }
},{timestamps:true}
)
userSchema.pre("save",async function(){
    
    if(!this.isModified("password"))return

    this.password=await bcrypt.hash(this.password,10)
})

userSchema.methods.isPasswordCorrect=async function(password){
    return await bcrypt.compare(password,this.password)
}


userSchema.methods.generateAccessToken=function(){
    //short lived access token
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
}

userSchema.methods.generateRefreshToken=function(){
    //long lived refresh token
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
}
export const User=mongoose.model("User",userSchema)