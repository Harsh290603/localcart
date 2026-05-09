const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const path       = require('path');
const fs         = require('fs');

const app = express();

// --- 1. MIDDLEWARES (Updated Limits) ---
app.use(cors());
// Image upload ke liye limits ko 10MB ya 50MB tak badhana zaroori hai
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static Folder Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// --- 2. MULTER SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    }
});

// --- 3. DATABASE CONNECTION ---
const mongoURI = "mongodb://admin:admin123@ac-mace584-shard-00-00.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-01.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-02.te4cxvl.mongodb.net:27017/?ssl=true&replicaSet=atlas-82hwcv-shard-0&authSource=admin&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("🔥 MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- 4. MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
    username : { type: String, required: true },
    email    : { type: String, required: true, unique: true, lowercase: true },
    password : { type: String, required: true },
    role     : { type: String, required: true, enum: ['customer', 'business'], default: 'customer' }
}));

const Shop = mongoose.model('Shop', new mongoose.Schema({
    ownerEmail: { type: String, unique: true, required: true, lowercase: true },
    name      : { type: String, default: '' },
    phone     : { type: String, default: '' },
    dealIn    : { type: String, default: 'General' },
    address   : { type: String, default: '' },
    image     : { type: String, default: '' },
    isLive    : { type: Boolean, default: false },
    updatedAt : { type: Date, default: Date.now }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
    shopEmail  : { type: String, required: true, lowercase: true },
    name       : { type: String, required: true },
    price      : { type: Number, required: true },
    description: { type: String, default: '' },
    category   : { type: String, default: 'General' },
    images     : [String],
    inStock    : { type: Boolean, default: true },
    createdAt  : { type: Date, default: Date.now }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    customerName   : { type: String, required: true },
    customerEmail  : { type: String, required: true, lowercase: true },
    customerPhone  : { type: String, required: true },
    customerAddress: { type: String, required: true },
    items          : { type: Array, required: true },
    totalAmount    : { type: Number, required: true },
    status         : { type: String, default: 'Pending' },
    orderDate      : { type: Date, default: Date.now }
}));

// --- 5. ROUTES ---

// Helper function to build clean URLs for images
const getFullUrl = (req, filename) => {
    // Render fix: Check if secure protocol is used by proxy
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/uploads/${filename}`;
};

app.post('/api/upload', upload.single('shopImage'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file received" });
        const imageUrl = getFullUrl(req, req.file.filename);
        res.json({ success: true, imageUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/upload-multiple', upload.array('productImages', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files received" });
        const imageUrls = req.files.map(file => getFullUrl(req, file.filename));
        res.json({ success: true, imageUrls });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Auth Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password) return res.status(400).json({ message: "All fields are required." });

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(409).json({ message: "Email already exists." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword, role: role || 'customer' });

        if (newUser.role === 'business') {
            await Shop.create({ ownerEmail: newUser.email });
        }

        res.status(201).json({ 
            message: `Account created! Welcome, ${username}`, 
            user: { username: newUser.username, email: newUser.email, role: newUser.role } 
        });
    } catch (err) {
        res.status(500).json({ message: "Server error during signup." });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "Account not found." });
        if (role && user.role !== role) return res.status(401).json({ message: "Role mismatch." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Incorrect password." });

        res.json({ 
            message: `Welcome back, ${user.username}!`, 
            user: { username: user.username, email: user.email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

// Shop setup
app.post('/api/shop-setup', async (req, res) => {
    try {
        const { ownerEmail, ...updateData } = req.body;
        if (!ownerEmail) return res.status(400).json({ success: false, message: "ownerEmail required." });
        
        const shop = await Shop.findOneAndUpdate(
            { ownerEmail: ownerEmail.toLowerCase() },
            { ...updateData, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/add-product', async (req, res) => {
    try {
        const { shopEmail, name, price, ...other } = req.body;
        const newProduct = await Product.create({
            shopEmail: shopEmail.toLowerCase(),
            name,
            price: Number(price),
            ...other
        });
        res.status(201).json({ success: true, product: newProduct });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/update-product', async (req, res) => {
    try {
        const { productId, ...updateData } = req.body;
        const updated = await Product.findByIdAndUpdate(productId, updateData, { new: true });
        res.json({ success: true, product: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Orders & Marketplace
app.get('/api/all-shops', async (req, res) => {
    try {
        const shops = await Shop.find({ isLive: true }).sort({ updatedAt: -1 });
        res.json({ success: true, shops });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/get-shop-all/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        const shop = await Shop.findOne({ ownerEmail: email });
        const products = await Product.find({ shopEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, shop, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});