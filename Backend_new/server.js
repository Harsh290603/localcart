const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const path       = require('path');
const fs         = require('fs');

const app = express();

// --- 1. MIDDLEWARES (With 50MB Limit) ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// --- 2. MULTER SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- 3. DATABASE CONNECTION ---
const mongoURI = "mongodb://admin:admin123@ac-mace584-shard-00-00.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-01.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-02.te4cxvl.mongodb.net:27017/?ssl=true&replicaSet=atlas-82hwcv-shard-0&authSource=admin&appName=Cluster0";
mongoose.connect(mongoURI).then(() => console.log("🔥 MongoDB Connected")).catch(err => console.log(err));

// --- 4. MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true, lowercase: true }, password: { type: String, required: true }, role: String
}));
const Shop = mongoose.model('Shop', new mongoose.Schema({
    ownerEmail: { type: String, unique: true, lowercase: true }, name: String, phone: String, dealIn: String, address: String, image: String, isLive: Boolean
}));
const Product = mongoose.model('Product', new mongoose.Schema({
    shopEmail: { type: String, lowercase: true }, name: String, price: Number, description: String, category: String, images: [String], inStock: { type: Boolean, default: true }
}));
const Order = mongoose.model('Order', new mongoose.Schema({
    customerName: String, customerEmail: { type: String, lowercase: true }, customerPhone: String, customerAddress: String, items: Array, totalAmount: Number, status: { type: String, default: 'Pending' }, orderDate: { type: Date, default: Date.now }
}));

// --- 5. ROUTES ---

// Image Uploads
app.post('/api/upload', upload.single('shopImage'), (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const imageUrl = `${protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
});

app.post('/api/upload-multiple', upload.array('productImages', 10), (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const imageUrls = req.files.map(file => `${protocol}://${req.get('host')}/uploads/${file.filename}`);
    res.json({ success: true, imageUrls });
});

// Auth
app.post('/signup', async (req, res) => {
    const { username, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword, role });
    if (role === 'business') await Shop.create({ ownerEmail: email.toLowerCase() });
    res.status(201).json({ message: "Success", user });
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (user && await bcrypt.compare(req.body.password, user.password)) return res.json({ message: "Ok", user });
    res.status(401).json({ message: "Invalid credentials" });
});

// Shop & Products
app.post('/api/shop-setup', async (req, res) => {
    const shop = await Shop.findOneAndUpdate({ ownerEmail: req.body.ownerEmail.toLowerCase() }, req.body, { upsert: true, new: true });
    res.json({ success: true, shop });
});

app.post('/api/add-product', async (req, res) => {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
});

app.get('/api/get-shop-all/:email', async (req, res) => {
    const email = req.params.email.toLowerCase();
    const shop = await Shop.findOne({ ownerEmail: email });
    const products = await Product.find({ shopEmail: email });
    res.json({ success: true, shop, products });
});

// --- TRACKING & ORDERS (Fixed Routes) ---

// 1. Place Order
app.post('/api/place-order', async (req, res) => {
    try {
        const order = await Order.create(req.body);
        res.status(201).json({ success: true, order });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 2. Customer Order Tracking (MY ORDERS PAGE)
app.get('/api/my-orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ customerEmail: req.params.email.toLowerCase() }).sort({ orderDate: -1 });
        res.json({ success: true, orders });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 3. Business Dashboard Orders
app.get('/api/owner-orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ "items.shopEmail": req.params.email.toLowerCase() }).sort({ orderDate: -1 });
        res.json({ success: true, orders });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 4. Update Status (Pending to Delivered etc)
app.post('/api/update-order-status', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.body.orderId, { status: req.body.status }, { new: true });
        res.json({ success: true, order });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Marketplace
app.get('/api/all-shops', async (req, res) => {
    const shops = await Shop.find({ isLive: true });
    res.json({ success: true, shops });
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));