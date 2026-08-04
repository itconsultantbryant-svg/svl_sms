import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Login endpoint
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt:', { username });

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDatabase();

    // FIXED: Use correct column names from database schema
    const user = db.prepare(`
      SELECT u.*,
             r.role_code, r.role_name,
             i.institution_name, i.institution_code,
             b.branch_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN institutions i ON u.institution_id = i.id
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.username = ? AND u.is_active = 1
    `).get(username) as any;

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User found:', { username: user.username, hasPassword: !!user.password_hash });

    // FIXED: Use password_hash column
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Login successful:', username);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (exclude password)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar,
        user_type: user.user_type,
        institution_id: user.institution_id,
        institution_name: user.institution_name,
        institution_code: user.institution_code,
        role: {
          id: user.role_id,
          code: user.role_code,
          name: user.role_name
        },
        branch: user.branch_id ? {
          id: user.branch_id,
          name: user.branch_name
        } : null
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = getDatabase();

    const user = db.prepare(`
      SELECT u.*,
             r.role_code, r.role_name,
             i.institution_name, i.institution_code,
             b.branch_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN institutions i ON u.institution_id = i.id
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId) as any;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      user_type: user.user_type,
      institution_id: user.institution_id,
      institution_name: user.institution_name,
      institution_code: user.institution_code,
      role: {
        id: user.role_id,
        code: user.role_code,
        name: user.role_name
      },
      branch: user.branch_id ? {
        id: user.branch_id,
        name: user.branch_name
      } : null
    });

  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
authRouter.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});
