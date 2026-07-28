require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';
const memoryUsers = [];
let nextMemoryId = 1;

const isValidDatabaseUrl = (value) => {
  return typeof value === 'string' && value.startsWith('postgres') && !value.includes('[user]') && !value.includes('[password]') && !value.includes('[host]');
};

let pool = null;
const databaseUrl = process.env.DATABASE_URL;

if (isValidDatabaseUrl(databaseUrl)) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
} else {
  console.warn('DATABASE_URL is missing or using placeholder values. Falling back to in-memory storage for local testing.');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

const findUserByEmail = async (email) => {
  if (pool) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  return memoryUsers.find((user) => user.email === email) || null;
};

const createUserRecord = async (fullName, email, hashedPassword) => {
  if (pool) {
    const newUser = await pool.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email',
      [fullName, email, hashedPassword]
    );
    return newUser.rows[0];
  }

  const user = {
    id: `demo-${nextMemoryId++}`,
    full_name: fullName,
    email,
    password_hash: hashedPassword,
    created_at: new Date().toISOString(),
  };
  memoryUsers.push(user);
  return user;
};

const findUserById = async (id) => {
  if (pool) {
    const result = await pool.query('SELECT id, full_name as "fullName", email FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  return memoryUsers.find((user) => user.id === id) || null;
};

app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await createUserRecord(fullName, email, hashedPassword);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid Email or Password' });

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: 'Invalid Email or Password' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, fullName: user.full_name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ id: user.id, fullName: user.full_name || user.fullName, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
