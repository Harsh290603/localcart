const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const bodyParser = require('body-parser');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const path       = require('path');
const fs         = require('fs');

const app = express();

// --- MIDDLEWARES (Sirf Limit badhayi hai baki same hai) ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Uploads folder setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// --- MULTER SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// --- DATABASE CONNECTION ---
const mongoURI = "mongodb://admin:admin123@ac-mace584-shard-00-00.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-01.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-02.te4cxvl.mongodb.net:27017/?ssl=true&replicaSet=atlas-82hwcv-shard-0&authSource=admin&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("🔥 MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- MODELS (Pura Purana Logic) ---
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

// --- ROUTES (Fixed Upload logic + Restored original logic) ---

app.post('/api/upload', upload.single('shopImage'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file received" });
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ success: true, imageUrl });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/upload-multiple', upload.array('productImages', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files received" });
        const imageUrls = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
        res.json({ success: true, imageUrls });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Signup & Login
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword, role: role || 'customer' });
        if (newUser.role === 'business') await Shop.findOneAndUpdate({ ownerEmail: newUser.email }, { ownerEmail: newUser.email }, { upsert: true });
        res.status(201).json({ message: "Account created!", user: { username, email, role } });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Galat email/password" });
        res.json({ message: "Welcome!", user });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Shop & Product
app.post('/api/shop-setup', async (req, res) => {
    try {
        const shop = await Shop.findOneAndUpdate({ ownerEmail: req.body.ownerEmail.toLowerCase() }, req.body, { upsert: true, new: true });
        res.json({ success: true, shop });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/add-product', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json({ success: true, product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/update-product', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.body.productId, req.body, { new: true });
        res.json({ success: true, product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/get-shop-all/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        const shop = await Shop.findOne({ ownerEmail: email });
        const products = await Product.find({ shopEmail: email });
        res.json({ success: true, shop, products });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Order Routes (Restored Pending Orders Logic)
app.post('/api/place-order', async (req, res) => {
    try {
        const order = await Order.create(req.body);
        res.status(201).json({ success: true, order });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/owner-orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ "items.shopEmail": req.params.email.toLowerCase() }).sort({ orderDate: -1 });
        res.json({ success: true, orders });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/update-order-status', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.body.orderId, { status: req.body.status }, { new: true });
        res.json({ success: true, order });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/all-shops', async (req, res) => {
    try {
        const shops = await Shop.find({ isLive: true });
        res.json({ success: true, shops });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Port Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));