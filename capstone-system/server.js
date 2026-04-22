require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = 3000;

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware
app.use(express.json()); 
app.use(express.static('public')); 

// --- ROUTES ---

// 1. Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Login Endpoint (STRENGTHENED)
app.post('/api/login', async (req, res) => {
    // 1. Get the CTU_ID and Password from the frontend request
    const { studentId, password } = req.body;

    // 2. Look for the user in your Supabase 'profiles' table
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('student_id', studentId)
        .single();

    // 3. Check if user exists
    if (error || !data) {
        return res.status(401).json({ message: "CTU_ID not found in the system." });
    }

    // 4. Check if password matches
    if (data.password !== password) {
        return res.status(401).json({ message: "Invalid credentials." });
    }

    // 5. Check if they are verified (Security Gate)
    if (data.is_verified !== true) {
        return res.status(403).json({ 
            message: "Account pending approval by Admin.",
            status: "pending" 
        }); 
    }

    // 6. Success! Send the user data back to the frontend
    res.json({ message: "Authentication successful", user: data });
});

// 2. SIGNUP Endpoint (STRENGTHENED)
app.post('/api/signup', async (req, res) => {
    const { email, password, fullName, studentId, user_type } = req.body;

    const { data, error } = await supabase
        .from('profiles')
        .insert([
            { 
                student_id: studentId, 
                full_name: fullName, 
                email: email, 
                password: password, 
                user_type: user_type, 
                is_verified: false 
            }
        ])
        .select()
        .single();

    if (error) {
        console.error("Signup Error Details:", error); // Check your terminal for this!
        return res.status(400).json({ 
            message: error.message, // This will tell the frontend the EXACT problem
            details: error.details 
        });
    }

    res.status(403).json({ message: "Awaiting approval", user: data });
});

// 3. Admin: Get ALL Students
app.get('/api/students', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Error:", error);
            return res.status(400).json(error);
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// 4. Admin: Verify a Student
app.post('/api/verify-student/:id', async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', id);

    if (error) {
        return res.status(400).json(error);
    }
    
    res.json({ message: "Student verified!" });
});


// POST a new message to the feed
app.post('/api/messages', async (req, res) => {
    const { studentId, fullName, content } = req.body;

    const { data, error } = await supabase
        .from('messages')
        .insert([{ 
            student_id: studentId, 
            full_name: fullName, 
            content: content 
        }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
});

// GET all messages for the Global Feed
app.get('/api/messages', async (req, res) => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Start Server
app.listen(port, () => {
    console.log(`✅ CTU Connect server running at http://localhost:${port}`);
});