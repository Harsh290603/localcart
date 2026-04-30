const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const bodyParser = require('body-parser');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const path       = require('path');
const fs         = require('fs');

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// --- FOLDER & MULTER SETUP ---
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Only image files allowed!'));
    }
});

// --- DATABASE CONNECTION ---
const mongoURI = "mongodb://admin:admin123@ac-mace584-shard-00-00.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-01.te4cxvl.mongodb.net:27017,ac-mace584-shard-00-02.te4cxvl.mongodb.net:27017/?ssl=true&replicaSet=atlas-82hwcv-shard-0&authSource=admin&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("🔥 MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// --- MODELS ---
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

// --- ROUTES ---

// 1. Image Upload Routes
app.post('/api/upload', upload.single('shopImage'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file received" });
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ success: true, imageUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/upload-multiple', upload.array('productImages', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files received" });
        const imageUrls = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
        res.json({ success: true, imageUrls });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Auth Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        if (!username || !email || !password)
            return res.status(400).json({ message: "Username, email aur password zaroori hai." });

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists)
            return res.status(409).json({ message: "Ye email already registered hai. Login karein." });

        // Password hash karo — plain text kabhi save mat karo
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({ username, email, password: hashedPassword, role: role || 'customer' });

        // Business user ke liye empty shop auto-create
        if (newUser.role === 'business') {
            await Shop.findOneAndUpdate(
                { ownerEmail: newUser.email },
                { ownerEmail: newUser.email },
                { upsert: true, new: true }
            );
        }

        res.status(201).json({
            message: `Account ban gaya! Welcome, ${username}`,
            user: { username: newUser.username, email: newUser.email, role: newUser.role }
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: "Server error during signup." });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "Email aur password daalein." });

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user)
            return res.status(404).json({ message: "Is email se koi account nahi mila." });

        // Role check
        if (role && user.role !== role)
            return res.status(401).json({ message: `Ye account '${user.role}' ke liye hai, '${role}' ke liye nahi.` });

        // Password compare (bcrypt)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(401).json({ message: "Password galat hai. Dobara try karein." });

        res.json({
            message: `Welcome back, ${user.username}!`,
            user: { username: user.username, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error during login." });
    }
});

// 3. Shop & Product Management
app.post('/api/shop-setup', async (req, res) => {
    try {
        const { ownerEmail, name, phone, dealIn, address, image, isLive } = req.body;

        if (!ownerEmail)
            return res.status(400).json({ success: false, message: "ownerEmail required." });

        // Sirf jo fields aayi hain unhi ko update karo
        const updateData = { updatedAt: new Date() };
        if (name    !== undefined) updateData.name    = name;
        if (phone   !== undefined) updateData.phone   = phone;
        if (dealIn  !== undefined) updateData.dealIn  = dealIn;
        if (address !== undefined) updateData.address = address;
        if (image   !== undefined) updateData.image   = image;
        if (isLive  !== undefined) updateData.isLive  = isLive;

        const shop = await Shop.findOneAndUpdate(
            { ownerEmail: ownerEmail.toLowerCase() },
            updateData,
            { upsert: true, new: true }
        );
        res.json({ success: true, shop });
    } catch (err) {
        console.error("Shop setup error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/add-product', async (req, res) => {
    try {
        const { shopEmail, name, price, category, description, images } = req.body;

        if (!shopEmail || !name || price === undefined)
            return res.status(400).json({ success: false, message: "shopEmail, name aur price zaroori hai." });

        const newProduct = await Product.create({
            shopEmail: shopEmail.toLowerCase(),
            name,
            price: Number(price),
            category: category || 'General',
            description: description || '',
            images: images || []
        });
        res.status(201).json({ success: true, product: newProduct });
    } catch (err) {
        console.error("Add product error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/update-product', async (req, res) => {
    try {
        const { productId, name, price, category, description, images } = req.body;

        if (!productId)
            return res.status(400).json({ success: false, message: "productId required." });

        const updated = await Product.findByIdAndUpdate(
            productId,
            { name, price: Number(price), category, description, images },
            { new: true }
        );

        if (!updated)
            return res.status(404).json({ success: false, message: "Product nahi mila." });

        res.json({ success: true, message: "Product update ho gaya!", product: updated });
    } catch (err) {
        console.error("Update product error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/toggle-stock', async (req, res) => {
    try {
        const { id, inStock } = req.body;
        if (!id) return res.status(400).json({ success: false, message: "Product id required." });

        const product = await Product.findByIdAndUpdate(id, { inStock }, { new: true });
        if (!product) return res.status(404).json({ success: false, message: "Product nahi mila." });

        res.json({ success: true, product });
    } catch (err) {
        console.error("Toggle stock error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/delete-product/:id', async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: "Product nahi mila." });

        // Disk se images bhi delete karo
        if (deleted.images && deleted.images.length) {
            deleted.images.forEach(url => {
                const filename = path.basename(url);
                const filepath = path.join(__dirname, 'uploads', filename);
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            });
        }

        res.json({ success: true, message: "Product delete ho gaya." });
    } catch (err) {
        console.error("Delete product error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Order Routes
app.post('/api/place-order', async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, customerAddress, items, totalAmount } = req.body;

        if (!customerName || !customerEmail || !customerPhone || !customerAddress || !items || items.length === 0)
            return res.status(400).json({ success: false, message: "Saari order details zaroori hain." });

        const newOrder = await Order.create({
            customerName,
            customerEmail: customerEmail.toLowerCase(),
            customerPhone,
            customerAddress,
            items,
            totalAmount: Number(totalAmount) || 0,
            status: 'Pending'
        });
        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        console.error("Place order error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/my-orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ customerEmail: req.params.email.toLowerCase() }).sort({ orderDate: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        console.error("My orders error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/owner-orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ "items.shopEmail": req.params.email.toLowerCase() }).sort({ orderDate: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        console.error("Owner orders error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/update-order-status', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (!orderId || !status)
            return res.status(400).json({ success: false, message: "orderId aur status required." });

        const order = await Order.findByIdAndUpdate(req.body.orderId, { status: req.body.status }, { new: true });
        if (!order) return res.status(404).json({ success: false, message: "Order nahi mila." });

        res.json({ success: true, order });
    } catch (err) {
        console.error("Update order status error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Marketplace Routes
app.get('/api/all-shops', async (req, res) => {
    try {
        const shops = await Shop.find({ isLive: true }).sort({ updatedAt: -1 });
        res.json({ success: true, shops });
    } catch (err) {
        console.error("All shops error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/get-shop-all/:email', async (req, res) => {
    try {
        const email    = req.params.email.toLowerCase();
        const shop     = await Shop.findOne({ ownerEmail: email });
        const products = await Product.find({ shopEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, shop: shop || null, products });
    } catch (err) {
        console.error("Get shop error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT,'0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads folder: ${path.join(__dirname, 'uploads')}`);
});
