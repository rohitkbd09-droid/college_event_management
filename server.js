const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use(express.static(__dirname));

// Database connection configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 18031,
    ssl: {
        rejectUnauthorized: false
    },
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Initialize database
async function initializeDatabase() {
    try {
        // Create tables
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    role ENUM('admin', 'super_admin') DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    event_date DATE NOT NULL,
                    description TEXT,
                    category VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create registrations table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS registrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    branch VARCHAR(100),
                    phone VARCHAR(20),
                    event_type VARCHAR(100),
                    sub_events TEXT,
                    email VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create new_registrations table (used by register-user)
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS new_registrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    firstname VARCHAR(255),
                    lastname VARCHAR(255),
                    username VARCHAR(255) UNIQUE,
                    password VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create notifications table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES new_registrations(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create programs table (used by add-program)
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS programs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    event_id INT,
                    program_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create contact_form table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS contact_form (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255),
                    contact VARCHAR(50),
                    message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create feedback table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS feedback (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255),
                    message TEXT,
                    rating INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create categories table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create regular_events table
        await new Promise((resolve, reject) => {
            db.query(`
                CREATE TABLE IF NOT EXISTS regular_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    category_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    event_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create default admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await new Promise((resolve, reject) => {
            db.query(`
                INSERT INTO admin_users (username, password, email, role)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE id=id
            `, ['admin', hashedPassword, 'admin@collegefest.com', 'super_admin'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', err);
        return;
    }
    console.log('Connected to MySQL');
    // Initialize database after connection is established
    initializeDatabase();
});

// JWT secret
const JWT_SECRET = 'your-secret-key';

// Email configuration - reusable function for production
async function sendEmails(userMailOptions, adminMailOptions) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'srinivasgalla30@gmail.com',
                pass: process.env.EMAIL_PASSWORD || 'qkzo owkl dkzy epti'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        // Verify transporter configuration
        await transporter.verify();
        console.log('Email transporter verified successfully');
        
        // Send both emails in parallel
        const [userResult, adminResult] = await Promise.allSettled([
            transporter.sendMail(userMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);
        
        if (userResult.status === 'fulfilled') {
            console.log('User email sent successfully to:', userMailOptions.to);
        } else {
            console.error('Error sending user email:', userResult.reason);
        }
        
        if (adminResult.status === 'fulfilled') {
            console.log('Admin email sent successfully to:', adminMailOptions.to);
        } else {
            console.error('Error sending admin email:', adminResult.reason);
        }
        
        return { userResult, adminResult };
    } catch (error) {
        console.error('Email transporter setup error:', error);
        // Don't throw error - just log it so registration doesn't fail
        console.log('Email sending failed, but registration continues...');
    }
}

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.query('SELECT * FROM admin_users WHERE id = ?', [decoded.id], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (rows.length === 0) {
                return res.status(401).json({ error: 'Invalid token' });
            }
            req.admin = rows[0];
            next();
        });
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/register-user', (req, res) => res.sendFile(path.join(__dirname, 'register.html'))); // User account registration
app.get('/event-register', (req, res) => res.sendFile(path.join(__dirname, 'registration.html'))); // Event participation registration
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/add-events', (req, res) => res.sendFile(path.join(__dirname, 'addevents.html')));
app.get('/participate', (req, res) => res.sendFile(path.join(__dirname, 'participate.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/feedback', (req, res) => res.sendFile(path.join(__dirname, 'feedback.html')));

// View registrations (supports optional filtering by branch/category/event)
app.get('/registrations', (req, res) => {
    const { branch, category, event } = req.query;

    let sql = 'SELECT * FROM registrations';
    const params = [];
    const whereClauses = [];

    // Filter by branch (exact match)
    if (branch) {
        whereClauses.push('branch = ?');
        params.push(branch);
    }

    // Filter by category (maps to event_type from registration form)
    if (category) {
        whereClauses.push('event_type = ?');
        params.push(category);
    }

    // Filter by specific event name (checks both event_type and sub_events list)
    if (event) {
        whereClauses.push('(event_type = ? OR sub_events LIKE ?)');
        params.push(event, `%${event}%`);
    }

    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY id DESC';

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Fetch error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get events for users (public endpoint)
app.get('/api/user-events', (req, res) => {
    const sql = `
        SELECT 
            e.id,
            e.name,
            e.event_date,
            e.description,
            e.category,
            e.created_at
        FROM events e 
        WHERE e.category IS NOT NULL 
        ORDER BY e.event_date ASC, e.created_at DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching events for users:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Group events by category
        const eventsByCategory = {};
        results.forEach(event => {
            const category = event.category || 'other';
            if (!eventsByCategory[category]) {
                eventsByCategory[category] = [];
            }
            eventsByCategory[category].push({
                name: event.name,
                date: event.event_date,
                description: event.description,
                id: event.id
            });
        });
        
        res.json(eventsByCategory);
    });
});

// Test route
app.get('/test', (req, res) => res.send('Server is running fine!'));

// DB healthcheck
app.get('/db-health', (req, res) => {
    db.query('SELECT 1 + 1 AS result', (err, rows) => {
        if (err) {
            console.error('DB health check failed:', err);
            return res.status(500).json({ healthy: false, error: err.message });
        }
        res.json({ healthy: true, result: rows[0].result });
    });
});

// Event Registration (from registration.html)
app.post("/register", (req, res) => {
    console.log('Registration request received:', req.body);
    
    const { name, branch, phone, eventType, subEvents, email } = req.body;
    
    // Validate required fields
    if (!name || !branch || !phone || !eventType || !email) {
        console.log('Missing required fields:', { name, branch, phone, eventType, email });
        return res.status(400).json({
            error: 'Missing required fields',
            missing: Object.entries({ name, branch, phone, eventType, email })
                .filter(([_, value]) => !value)
                .map(([key]) => key)
        });
    }

    if (!email || !email.includes('@')) {
        console.log('Invalid email:', email);
        return res.status(400).json({ error: 'Invalid or missing email' });
    }

    const subEventsString = Array.isArray(subEvents) ? subEvents.join(', ') : subEvents;

    const sql = 'INSERT INTO registrations (name, branch, phone, event_type, sub_events, email) VALUES (?, ?, ?, ?, ?, ?)';
    console.log('Executing SQL:', sql);
    console.log('Values:', [name, branch, phone, eventType, subEventsString, email]);
    
    db.query(sql, [name, branch, phone, eventType, subEventsString, email], (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            console.log('Database unavailable, but continuing with email notifications...');
            // Don't fail the request if database is down, just log the error
        } else {
            console.log('Registration saved to database successfully');
        }
        
        // Respond immediately so the client isn't blocked by email delivery
        res.status(200).send('Registration Successful & Emails Sent');

        // Send email notifications asynchronously (do not block response)
        const userMail = {
                from: process.env.EMAIL_FROM || 'srinivasgalla30@gmail.com',
                to: email,
                subject: '🎉 College Fest Registration Confirmed!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                        <div style="background: linear-gradient(135deg, #00c9ff, #92fe9d); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Registration Successful!</h1>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; margin-top: 0;">Hello ${name}!</h2>
                            <p style="color: #666; font-size: 16px; line-height: 1.6;">Congratulations! You have successfully registered for our College Fest events.</p>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #333; margin-top: 0;">📋 Registration Details:</h3>
                                <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
                                <p style="margin: 5px 0;"><strong>Branch:</strong> ${branch}</p>
                                <p style="margin: 5px 0;"><strong>Event Type:</strong> ${eventType}</p>
                                <p style="margin: 5px 0;"><strong>Selected Events:</strong> ${subEventsString}</p>
                                <p style="margin: 5px 0;"><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
                            </div>
                            
                            <p style="color: #666; font-size: 16px; line-height: 1.6;">We're excited to have you participate in our College Fest! Stay tuned for more updates and event schedules.</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="http://localhost:3000" style="background: linear-gradient(135deg, #00c9ff, #92fe9d); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Visit Our Website</a>
                            </div>
                            
                            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">Best regards,<br>College Fest Team</p>
                        </div>
                    </div>
                `
            };

            const adminMail = {
                from: process.env.EMAIL_FROM || 'srinivasgalla30@gmail.com',
                to: process.env.ADMIN_EMAIL || 'srinivasgalla30@gmail.com',
                subject: '🔔 New College Fest Registration Received',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                        <div style="background: linear-gradient(135deg, #ff6b6b, #ffa726); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🔔 New Registration!</h1>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; margin-top: 0;">New Student Registration</h2>
                            <p style="color: #666; font-size: 16px; line-height: 1.6;">A new student has registered for College Fest events.</p>
                            
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #333; margin-top: 0;">👤 Student Information:</h3>
                                <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
                                <p style="margin: 5px 0;"><strong>Branch:</strong> ${branch}</p>
                                <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                                <p style="margin: 5px 0;"><strong>Event Type:</strong> ${eventType}</p>
                                <p style="margin: 5px 0;"><strong>Selected Events:</strong> ${subEventsString}</p>
                                <p style="margin: 5px 0;"><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #1976d2; font-weight: bold;">📊 Quick Actions:</p>
                                <p style="margin: 5px 0; color: #666;">• View all registrations in admin dashboard</p>
                                <p style="margin: 5px 0; color: #666;">• Contact student if needed: <a href="mailto:${email}" style="color: #1976d2;">${email}</a></p>
                            </div>
                            
                            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">Admin Dashboard - College Fest Management System</p>
                        </div>
                    </div>
                `
            };

        // Send emails asynchronously
        sendEmails(userMail, adminMail).catch(err => {
            console.error('Failed to send emails:', err);
        });
    });
});

// User Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM new_registrations WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Login failed" });
        }

        if (results.length > 0) {
            res.json({ success: true, message: "Login successful" });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    });
});

// Register User Account (from register.html)
// Get user notifications
app.get('/api/notifications/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC`;
    
    db.query(query, [userId], (err, notifications) => {
        if (err) {
            console.error('Error fetching notifications:', err);
            return res.status(500).json({ error: 'Failed to fetch notifications' });
        }
        res.json(notifications);
    });
});

// Mark notification as read
app.put('/api/notifications/:notificationId', (req, res) => {
    const notificationId = req.params.notificationId;
    const query = 'UPDATE notifications SET is_read = TRUE WHERE id = ?';
    
    db.query(query, [notificationId], (err) => {
        if (err) {
            console.error('Error updating notification:', err);
            return res.status(500).json({ error: 'Failed to update notification' });
        }
        res.json({ message: 'Notification marked as read' });
    });
});

app.post("/register-user", (req, res) => {
    // Log incoming payload for debugging
    console.log('Register-user payload:', req.body);

    const { firstName, lastName, username, password } = req.body;

    const query = `INSERT INTO new_registrations(firstname, lastname, username, password) VALUES (?, ?, ?, ?)`;

    db.query(query, [firstName, lastName, username, password], (err, result) => {
        if (err) {
            // Log full error server-side and return a helpful error message for debugging
            console.error("Registration Error:", err);
            return res.status(500).json({
                message: "Registration failed",
                error: err.message,
                code: err.code
            });
        }

        res.status(200).json({ message: "Registration successful", id: result.insertId });
    });
});

// Add Event
app.post('/add-event', (req, res) => {
    const { eventName, eventDate } = req.body;
    const sql = 'INSERT INTO events (name, event_date) VALUES (?, ?)';
    db.query(sql, [eventName, eventDate], async (err, result) => {
        if (err) return res.status(500).send('Error inserting event');

        // Get all registered users
        db.query('SELECT id, firstname, email FROM new_registrations', async (err, users) => {
            if (err) {
                console.error('Error fetching users:', err);
                return;
            }

            // Insert notifications for all users
            const notificationPromises = users.map(user => {
                return new Promise((resolve, reject) => {
                    const notification = {
                        user_id: user.id,
                        title: 'New Event Added!',
                        message: `A new event "${eventName}" has been added to the college fest, scheduled for ${eventDate}. Check it out!`
                    };
                    
                    db.query(
                        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                        [notification.user_id, notification.title, notification.message],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );

                    // Send email notification
                    try {
                        const transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: process.env.EMAIL_USER || 'srinivasgalla30@gmail.com',
                                pass: process.env.EMAIL_PASSWORD || 'qkzo owkl dkzy epti'
                            }
                        });

                        const mailOptions = {
                            from: process.env.EMAIL_FROM || 'srinivasgalla30@gmail.com',
                            to: user.email,
                            subject: 'New College Fest Event Added!',
                            text: `Hello ${user.firstname},\n\nA new event "${eventName}" has been added to the college fest, scheduled for ${eventDate}.\n\nCheck out the website for more details and registration!\n\nBest regards,\nCollege Fest Team`
                        };

                        transporter.sendMail(mailOptions);
                    } catch (mailErr) {
                        console.error('Error sending email notification:', mailErr);
                    }
                });
            });

            try {
                await Promise.all(notificationPromises);
                console.log('Notifications sent to all users');
            } catch (notifErr) {
                console.error('Error sending notifications:', notifErr);
            }
        });

        res.send('Event added successfully');
    });
});

// Add Program
app.post('/add-program', (req, res) => {
    const { eventType, programName } = req.body;
    const getEventIdQuery = 'SELECT id FROM events WHERE name = ?';

    db.query(getEventIdQuery, [eventType], (err, results) => {
        if (err || results.length === 0) return res.status(400).send('Event not found');
        
        const eventId = results[0].id;
        const insertProgramQuery = 'INSERT INTO programs (event_id, program_name) VALUES (?, ?)';
        db.query(insertProgramQuery, [eventId, programName], (err, result) => {
            if (err) return res.status(500).send('Error inserting program');
            res.send('Program added successfully');
        });
    });
});

// Contact Form Submission
app.post('/submit-form', (req, res) => {
    const { name, email, contact, message } = req.body;
    const sql = 'INSERT INTO contact_form (name, email, contact, message) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, contact, message], (err, result) => {
        if (err) {
            console.error('Error inserting contact form:', err);
            return res.status(500).send('Failed to submit form');
        }
        res.status(200).send('Form submitted successfully');
    });
});

// Feedback Submission
app.post('/submit-feedback', (req, res) => {
    const { name, email, message, rating } = req.body;

    const sql = 'INSERT INTO feedback (name, email, message, rating) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, message, rating], (err, result) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error submitting feedback');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'srinivasgalla30@gmail.com',
                pass: 'qkzo owkl dkzy epti'
            }
        });

        const mailOptions = {
            from: email,
            to: 'srinivasgalla30@gmail.com',
            subject: 'New Event Feedback',
            text: `Name: ${name}\nEmail: ${email}\nRating: ${rating} stars\nFeedback: ${message}`
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending email:', err);
                return res.status(500).send('Error sending feedback email');
            }
            console.log('Email sent: ' + info.response);
        });

        res.status(200).send('Feedback submitted successfully');
    });
});

// Categories API - Updated for proper categories table
app.get('/api/categories', verifyAdmin, (req, res) => {
    db.query('SELECT * FROM categories ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(rows);
    });
});

app.post('/api/categories', verifyAdmin, (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    db.query(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [name, description],
        (err, result) => {
            if (err) {
                console.error('Error adding category:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            res.json({ id: result.insertId, name, description });
        }
    );
});

app.delete('/api/categories/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM categories WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting category:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Category deleted successfully' });
    });
});

// Regular Events API
app.get('/api/regular-events', verifyAdmin, (req, res) => {
    db.query(`
        SELECT re.*, c.name as category_name
        FROM regular_events re
        JOIN categories c ON re.category_id = c.id
        ORDER BY re.event_date ASC, re.created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error fetching regular events:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(rows);
    });
});

app.post('/api/regular-events', verifyAdmin, (req, res) => {
    const { category_id, name, description, event_date } = req.body;
    if (!category_id || !name) {
        return res.status(400).json({ error: 'Category and name are required' });
    }

    db.query(
        'INSERT INTO regular_events (category_id, name, description, event_date) VALUES (?, ?, ?, ?)',
        [category_id, name, description, event_date],
        (err, result) => {
            if (err) {
                console.error('Error adding regular event:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            res.json({ 
                id: result.insertId, 
                category_id, 
                name, 
                description, 
                event_date 
            });
        }
    );
});

app.delete('/api/regular-events/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM regular_events WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting regular event:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Regular event deleted successfully' });
    });
});

// Public API to get categories for users
app.get('/api/public/categories', (req, res) => {
    db.query('SELECT id, name, description FROM categories ORDER BY name ASC', (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(rows);
    });
});

// Public API to get regular events for users (grouped by category)
app.get('/api/public/regular-events', (req, res) => {
    db.query(`
        SELECT re.*, c.name as category_name, c.description as category_description
        FROM regular_events re
        JOIN categories c ON re.category_id = c.id
        ORDER BY c.name ASC, re.event_date ASC
    `, (err, rows) => {
        if (err) {
            console.error('Error fetching regular events for users:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        // Group events by category
        const eventsByCategory = {};
        rows.forEach(event => {
            const categoryName = event.category_name;
            if (!eventsByCategory[categoryName]) {
                eventsByCategory[categoryName] = {
                    category_description: event.category_description,
                    events: []
                };
            }
            eventsByCategory[categoryName].events.push({
                id: event.id,
                name: event.name,
                description: event.description,
                event_date: event.event_date
            });
        });
        
        res.json(eventsByCategory);
    });
});

// Category-wise notification API
app.post('/api/notify-category', verifyAdmin, (req, res) => {
    const { category_id, event_name, event_description, event_date } = req.body;
    
    if (!category_id || !event_name) {
        return res.status(400).json({ error: 'Category ID and event name are required' });
    }

    // Get category details
    db.query('SELECT name, description FROM categories WHERE id = ?', [category_id], (err, categoryRows) => {
        if (err || categoryRows.length === 0) {
            console.error('Error fetching category:', err);
            return res.status(500).json({ error: 'Failed to fetch category' });
        }

        const category = categoryRows[0];
        
        // Get all registered users (you can filter by category preferences if you add that feature)
        db.query('SELECT id, email, firstname FROM new_registrations WHERE email IS NOT NULL', async (err, users) => {
            if (err) {
                console.error('Error fetching users for notifications:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }

            if (users.length === 0) {
                return res.json({ message: 'No users to notify' });
            }

            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER || 'srinivasgalla30@gmail.com',
                        pass: process.env.EMAIL_PASSWORD || 'qkzo owkl dkzy epti'
                    }
                });

                // Send emails to all users
                const emailPromises = users.map(user => {
                    const mailOptions = {
                        from: process.env.EMAIL_FROM || 'srinivasgalla30@gmail.com',
                        to: user.email,
                        subject: `🎉 New Event in ${category.name} Category!`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                                <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                                    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Event Added!</h1>
                                </div>
                                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                    <h2 style="color: #333; margin-top: 0;">Hello ${user.firstname}!</h2>
                                    <p style="color: #666; font-size: 16px; line-height: 1.6;">A new event has been added to the ${category.name} category!</p>
                                    
                                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="color: #333; margin-top: 0;">📅 Event Details:</h3>
                                        <p style="margin: 5px 0;"><strong>Event Name:</strong> ${event_name}</p>
                                        ${event_date ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(event_date).toLocaleDateString()}</p>` : ''}
                                        ${event_description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${event_description}</p>` : ''}
                                        <p style="margin: 5px 0;"><strong>Category:</strong> ${category.name}</p>
                                    </div>
                                    
                                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <p style="margin: 0; color: #1976d2; font-weight: bold;">🏷️ ${category.name}</p>
                                        ${category.description ? `<p style="margin: 5px 0; color: #666;">${category.description}</p>` : ''}
                                    </div>
                                    
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="http://localhost:3000" style="background: linear-gradient(135deg, #00c9ff, #92fe9d); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Visit Our Website</a>
                                    </div>
                                    
                                    <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">Best regards,<br>College Fest Team</p>
                                </div>
                            </div>
                        `
                    };

                    return new Promise((resolve, reject) => {
                        transporter.sendMail(mailOptions, (err, info) => {
                            if (err) {
                                console.error(`Error sending email to ${user.email}:`, err);
                                reject(err);
                            } else {
                                console.log(`Email sent to ${user.email}:`, info.response);
                                resolve(info);
                            }
                        });
                    });
                });

                await Promise.all(emailPromises);
                
                // Insert notifications into database for all users
                const notificationPromises = users.map(user => {
                    return new Promise((resolve, reject) => {
                        const notification = {
                            user_id: user.id,
                            title: `New Event in ${category.name} Category!`,
                            message: `A new event "${event_name}" has been added to the ${category.name} category. ${event_description ? event_description : ''}`
                        };
                        
                        db.query(
                            'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                            [notification.user_id, notification.title, notification.message],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                });

                await Promise.all(notificationPromises);
                
                res.json({ message: `Notifications sent to ${users.length} users about the new ${category.name} event` });
                
            } catch (error) {
                console.error('Error sending notifications:', error);
                res.status(500).json({ error: 'Failed to send notifications' });
            }
        });
    });
});

// Events API
app.get('/api/events', verifyAdmin, (req, res) => {
    db.query(`
        SELECT e.*, c.name as category_name 
        FROM events e 
        LEFT JOIN events c ON e.category = c.name
        WHERE e.category IS NULL
    `, (err, rows) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(rows);
    });
});

app.post('/api/events', verifyAdmin, (req, res) => {
    const { category_id, name, event_date, description } = req.body;
    if (!category_id || !name || !event_date) {
        return res.status(400).json({ error: 'Category, name, and date are required' });
    }

    db.query('SELECT name FROM events WHERE id = ?', [category_id], (err, category) => {
        if (err) {
            console.error('Error fetching category:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        if (category.length === 0) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        db.query(
            'INSERT INTO events (name, category, event_date, description) VALUES (?, ?, ?, ?)',
            [name, category[0].name, event_date, description],
            (err, result) => {
                if (err) {
                    console.error('Error adding event:', err);
                    return res.status(500).json({ error: 'Server error' });
                }
                res.json({ id: result.insertId, name, event_date, description });
            }
        );
    });
});

app.delete('/api/events/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM events WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting event:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Event deleted successfully' });
    });
});

// Admin login route
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.query('SELECT * FROM admin_users WHERE username = ?', [username], async (err, rows) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Server error' });
        }

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = rows[0];
        try {
            const validPassword = await bcrypt.compare(password, admin.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Update last login
            db.query('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id], (err) => {
                if (err) {
                    console.error('Error updating last login:', err);
                }
            });

            // Generate JWT token
            const token = jwt.sign(
                { id: admin.id, username: admin.username, role: admin.role },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ token });
        } catch (error) {
            console.error('Password comparison error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// Protected admin routes
app.get('/api/admin/dashboard', verifyAdmin, (req, res) => {
    res.json({ message: 'Welcome to admin dashboard' });
});

// Upcoming Events API
app.get('/api/upcoming-events', (req, res) => {
    const sql = `
        SELECT 
            id,
            name,
            category,
            event_date,
            description,
            created_at
        FROM events 
        WHERE category IS NOT NULL 
        AND event_date >= CURDATE()
        ORDER BY event_date ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching upcoming events:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.post('/api/upcoming-events', verifyAdmin, (req, res) => {
    const { name, category, event_date, description } = req.body;
    
    if (!name || !category || !event_date) {
        return res.status(400).json({ error: 'Name, category, and date are required' });
    }
    
    const sql = 'INSERT INTO events (name, category, event_date, description) VALUES (?, ?, ?, ?)';
    
    db.query(sql, [name, category, event_date, description], (err, result) => {
        if (err) {
            console.error('Error adding upcoming event:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ 
            id: result.insertId, 
            name, 
            category, 
            event_date, 
            description 
        });
    });
});

app.delete('/api/upcoming-events/:id', verifyAdmin, (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM events WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Error deleting upcoming event:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Upcoming event deleted successfully' });
    });
});

// Send notifications to all users
app.post('/api/notify-users', verifyAdmin, (req, res) => {
    const { type, title, message, eventName, eventDate, categoryName } = req.body;
    
    // Get all registered users
    db.query('SELECT email, firstname FROM new_registrations WHERE email IS NOT NULL', async (err, users) => {
        if (err) {
            console.error('Error fetching users for notifications:', err);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        if (users.length === 0) {
            return res.json({ message: 'No users to notify' });
        }

        try {
            const transporter = nodemailer.createTransporter({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER || 'srinivasgalla30@gmail.com',
                    pass: process.env.EMAIL_PASSWORD || 'qkzo owkl dkzy epti'
                }
            });

            // Send emails to all users
            const emailPromises = users.map(user => {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'srinivasgalla30@gmail.com',
                    to: user.email,
                    subject: `🎉 ${title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                            <div style="background: linear-gradient(135deg, #00c9ff, #92fe9d); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                                <h1 style="color: white; margin: 0; font-size: 28px;">🎉 ${title}</h1>
                            </div>
                            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                <h2 style="color: #333; margin-top: 0;">Hello ${user.firstname}!</h2>
                                <p style="color: #666; font-size: 16px; line-height: 1.6;">${message}</p>
                                
                                ${eventName && eventDate ? `
                                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="color: #333; margin-top: 0;">📅 Event Details:</h3>
                                        <p style="margin: 5px 0;"><strong>Event:</strong> ${eventName}</p>
                                        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(eventDate).toLocaleDateString()}</p>
                                    </div>
                                ` : ''}
                                
                                ${categoryName ? `
                                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <p style="margin: 0; color: #1976d2; font-weight: bold;">🏷️ New Category: ${categoryName}</p>
                                    </div>
                                ` : ''}
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="http://localhost:3000" style="background: linear-gradient(135deg, #00c9ff, #92fe9d); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Visit Our Website</a>
                                </div>
                                
                                <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">Best regards,<br>College Fest Team</p>
                            </div>
                        </div>
                    `
                };

                return new Promise((resolve, reject) => {
                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                            console.error(`Error sending email to ${user.email}:`, err);
                            reject(err);
                        } else {
                            console.log(`Email sent to ${user.email}:`, info.response);
                            resolve(info);
                        }
                    });
                });
            });

            await Promise.all(emailPromises);
            res.json({ message: `Notifications sent to ${users.length} users` });
            
        } catch (error) {
            console.error('Error sending notifications:', error);
            res.status(500).json({ error: 'Failed to send notifications' });
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start server
app.listen(port, (err) => {
    if (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
    console.log(`Server is running on http://localhost:${port}`);
});
