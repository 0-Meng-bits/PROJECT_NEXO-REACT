// ==================== user-portal.js (FULL FIXED VERSION) ====================

const SUPABASE_URL = 'https://llvjglsdwcdobsciqvwu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-KhsJLsr1SkmyCydKygteA_OqA_AVLm';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let communities = [];
let activeCommId = 'global';

const userData = JSON.parse(localStorage.getItem('currentUser'));

if (!userData) {
    window.location.href = 'index.html';
}

// --- DATA & AUTH ---
const defaultCircles = [
    { id: 'global', name: 'Global Feed', description: 'Official campus-wide communication node for all CTU students.', icon: '🌍', type: 'system', creator_id: 'SYSTEM' },
    { id: 'bsit', name: 'BSIT Society', description: 'The hub for all IT students. Tech news and departmental updates.', icon: '💻', type: 'academic', creator_id: 'SYSTEM' }
];

async function loadRealCommunities() {
    try {
        const { data, error } = await supabaseClient
            .from('communities')
            .select('*');

        if (error) {
            console.error("Supabase Fetch Error:", error);
            return;
        }

        communities = [
            { 
                id: 'global', 
                name: 'Global Feed', 
                description: 'Official campus-wide communication node for all CTU students.', 
                icon: '🌍', 
                type: 'system', 
                creator_id: 'SYSTEM' 
            },
            ...(data || [])
        ];

        renderCirclesInDropdown();
    } catch (err) {
        console.error("Unexpected error in loadRealCommunities:", err);
    }
}

// --- INITIALIZE UI ---
async function initApp() {
    try {

        await loadRealCommunities();

        // 2. SECOND: Draw the Dashboard UI (This creates the tags on the screen)
        renderHomeDashboard(); 
        renderCirclesInDropdown();

        // Safe DOM access to prevent "Cannot set properties of null"
        const navIdDisplay = document.getElementById('navIdDisplay');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const navInitials = document.getElementById('navInitials');
        const statCircles = document.getElementById('stat-circles');

        if (navIdDisplay) navIdDisplay.innerText = `ID: ${userData.student_id || 'N/A'}`;
        if (userNameDisplay) userNameDisplay.innerText = (userData.full_name || 'USER').toUpperCase();
        
        if (navInitials && userData.full_name) {
            const parts = userData.full_name.trim().split(' ');
            const initials = parts.length > 1 
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : parts[0][0].toUpperCase();
            navInitials.innerText = initials;
        }

        if (statCircles) statCircles.innerText = communities.length;


        console.log("✅ NEXO Connect initialized successfully");

    } catch (err) {
        console.error("InitApp Error:", err);
        toast("SYSTEM_FAILURE: CHECK_CONSOLE");
    }
}

// --- NAVIGATION LOGIC ---
function toggleCircles() {
    const dropdown = document.getElementById('circlesDropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

function setActiveTab(linkId) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(linkId);
    if (el) el.classList.add('active');
}

function switchComm(id) {
    activeCommId = id;
    const comm = communities.find(c => c.id === id);
    if (!comm) return;

    const feed = document.getElementById('feedList');
    if (!feed) return;

    // 1. RE-BUILD THE HEADER UI
    const isOwner = comm.creator_id === userData.id;
    const roleLabel = isOwner ? 'LEADER' : (comm.creator_id === 'SYSTEM' ? 'OFFICIAL' : 'MEMBER');
    const typeLabel = (comm.category || 'General').toUpperCase();

    let subHTML = `<span>GROUP: ${typeLabel}</span> | <span>ROLE: ${roleLabel}</span>`;
    
    if (isOwner && comm.id !== 'global') {
        subHTML += ` 
            <span onclick="openManagePanel()" class="admin-action" style="color:var(--cyber-yellow); border-color:var(--cyber-yellow); margin-left:15px; cursor:pointer; border:1px solid; padding:2px 8px; border-radius:4px; font-size:10px;">
                ⚙️ MANAGE GROUP
            </span>
            <span onclick="deleteCircle('${comm.id}')" class="admin-action" style="color:#ff4444; border-color:#ff4444; margin-left:10px; cursor:pointer; border:1px solid; padding:2px 8px; border-radius:4px; font-size:10px;">
                TERMINATE
            </span>
        `;
    }

    // This puts the "Circle Header" back into the feedList after the Dashboard cleared it
    feed.innerHTML = `
        <div class="welcome-grid" style="width:100%; margin-bottom: 20px;">
            <div class="post" style="border-left: 4px solid var(--cyber-cyan); width:100%;">
                <h2 style="font-size: 22px; letter-spacing: 1px;">${comm.name.toUpperCase()}</h2>
                <div class="verified-badge">${subHTML}</div>
                <p style="margin-top:15px; color:var(--text-muted); font-size:13px; line-height:1.6;">
                    ${comm.description || "No description provided."}
                </p>
            </div>
        </div>
        <div id="messageHistory" style="display:flex; flex-direction:column; gap:10px; width:100%;">
            </div>
    `;
    
    setActiveTab('link-circles');
    toast(`CONNECTED: ${comm.name}`);
}

function showSection(section) {
    setActiveTab(`link-${section}`);
    
    const feed = document.getElementById('feedList');
    const requests = document.getElementById('requestsView');
    const composer = document.getElementById('composerArea');

    // Reset visibility
    if (feed) feed.style.display = 'none';
    if (requests) requests.style.display = 'none';
    if (composer) composer.style.display = 'none';

    if (section === 'home') {
        if (feed) feed.style.display = 'flex';
        renderHomeDashboard(); 
    } 
    else if (section === 'circles') {
        if (feed) feed.style.display = 'flex';
        if (composer) composer.style.display = 'flex';
        switchComm(activeCommId); 
    }
    else if (section === 'requests') {
        if (requests) requests.style.display = 'block';
    }

}

// --- CIRCLE MANAGEMENT ---
function renderCirclesInDropdown() {
    const container = document.getElementById('circlesDropdown');
    if (!container) return;

    container.innerHTML = communities.map(comm => `
        <div class="ls-item ${activeCommId === comm.id ? 'active' : ''}" 
             onclick="switchComm('${comm.id}')"
             style="margin: 8px 15px; padding: 12px; border-radius: 10px; border: 1px solid rgba(0, 240, 255, 0.1); background: rgba(255, 255, 255, 0.02); display: flex; align-items: center; transition: 0.3s;">
            
            <div style="width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; background: rgba(0, 240, 255, 0.05); border-radius: 8px; font-size: 1.2em;">
                ${comm.icon || '🔹'}
            </div>

            <div style="margin-left: 12px; display: flex; flex-direction: column;">
                <span style="font-size: 13px; font-weight: 600; color: white;">${comm.name}</span>
                <span style="font-size: 9px; color: var(--cyber-cyan); letter-spacing: 1px; font-family: monospace;">NODE_ACTIVE</span>
            </div>
        </div>
    `).join('');
}

function openCreateModal() { 
    const modal = document.getElementById('createModal');
    if (modal) modal.style.display = 'flex'; 
}

function closeModal() { 
    const modal = document.getElementById('createModal');
    if (modal) modal.style.display = 'none'; 
}

async function submitCircle() {
    const nameEl = document.getElementById('newCircleName');
    const descEl = document.getElementById('newCircleDesc');
    const typeEl = document.getElementById('newCircleType');

    if (!nameEl || !nameEl.value.trim()) {
        toast("ERROR: NODE_NAME_REQUIRED");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('communities')
            .insert([{
                name: nameEl.value.trim(),
                description: descEl ? descEl.value.trim() : "No description provided.",
                category: typeEl ? typeEl.value : "Academic / Study Group",
                creator_id: userData.id,
                is_official: false
            }])
            .select();

        if (error) throw error;

        toast(`NODE_CREATED: ${nameEl.value.trim()}`);
        
        if (nameEl) nameEl.value = '';
        if (descEl) descEl.value = '';
        
        closeModal();
        await loadRealCommunities();
        renderCirclesInDropdown();

    } catch (err) {
        console.error("Supabase Submit Error:", err);
        toast("SYSTEM_FAILURE: CHECK_CONSOLE");
    }
}

async function deleteCircle(id) {
    if (confirm("TERMINATE_NODE? This action cannot be undone and will be removed from the database.")) {
        try {
            // 1. Send the DELETE command to Supabase
            const { error } = await supabaseClient
                .from('communities')
                .delete()
                .eq('id', id); // Ensures we only delete the specific circle by its ID

            if (error) throw error;

            // 2. Success Feedback
            toast("NODE_TERMINATED: DATABASE_CLEARED");

            // 3. Refresh the local data so the UI updates
            await loadRealCommunities();
            
            // 4. Redirect the user back to the Global Feed
            switchComm('global');

        } catch (err) {
            console.error("Supabase Delete Error:", err);
            toast("SYSTEM_FAILURE: TERMINATION_FAILED");
        }
    }
}

// --- POSTING & UTILS ---
function sendPost() {
    const input = document.getElementById('compTxt');
    if (!input || !input.value.trim()) return;

    const comm = communities.find(c => c.id === activeCommId);
    if (!comm) return;

    const isLeader = comm.creator_id === userData.id || comm.creator_id === userData.student_id;
    const roleTag = isLeader ? 'LEADER' : 'MEMBER';
    const tagColor = isLeader ? 'var(--cyber-yellow)' : 'var(--cyber-cyan)';

    const postHTML = `
        <div class="post">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
                    <div style="width:30px; height:30px; border-radius:4px; background:${tagColor}; color:#000; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px;">${(userData.full_name || 'U')[0]}</div>
                    <div>
                        <div style="font-weight:700; font-size:13px;">${userData.full_name || 'User'} <span style="font-size:9px; color:${tagColor}; margin-left:5px; border:1px solid; padding:1px 4px; border-radius:3px;">${roleTag}</span></div>
                        <div style="font-size:10px; color:var(--text-muted);">Just now</div>
                    </div>
                </div>
                ${isLeader ? '<button style="background:transparent; border:none; color:#ff4444; cursor:pointer; font-size:12px;">&times;</button>' : ''}
            </div>
            <div style="font-size:14px; color: rgba(255,255,255,0.8); margin-left:42px;">${input.value}</div>
        </div>`;
        
    const feedList = document.getElementById('feedList');
    if (feedList) {
        feedList.insertAdjacentHTML('beforeend', postHTML);
        input.value = '';
        feedList.scrollTop = feedList.scrollHeight;
    }
}

function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg.toUpperCase();
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function logout() { 
    if (confirm("TERMINATE_SESSION?")) { 
        localStorage.removeItem('currentUser'); 
        window.location.href = 'index.html'; 
    } 
}

function openManagePanel() {
    const panel = document.getElementById('managePanel');
    if (panel) panel.style.display = 'flex';
}

function closeManagePanel() {
    const panel = document.getElementById('managePanel');
    if (panel) panel.style.display = 'none';
}

function filterReq(type) {
    const list = document.getElementById('requestList');
    const btnOut = document.getElementById('btn-outgoing');
    const btnIn = document.getElementById('btn-incoming');

    if (!list) return;

    if (type === 'outgoing') {
        if (btnOut) { btnOut.style.background = 'var(--cyber-yellow)'; btnOut.style.color = '#000'; }
        if (btnIn) { btnIn.style.background = '#222'; btnIn.style.color = 'white'; }
        list.innerHTML = `<p style="color:var(--text-muted);">You haven't applied to any circles yet.</p>`;
    } else {
        if (btnIn) { btnIn.style.background = 'var(--cyber-yellow)'; btnIn.style.color = '#000'; }
        if (btnOut) { btnOut.style.background = '#222'; btnOut.style.color = 'white'; }
        list.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:white;">Juan Dela Cruz</strong> 
                    <span style="color:var(--text-muted); font-size:12px;">wants to join <b>BSIT Society</b></span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="cyber-btn" style="padding:5px 10px;" onclick="toast('Approved')">APPROVE</button>
                    <button class="cyber-btn" style="background:#ff4444; padding:5px 10px;" onclick="toast('Denied')">DENY</button>
                </div>
            </div>
        `;
    }
}


function renderHomeDashboard() {
    const feed = document.getElementById('feedList');
    if (!feed) return;

    const trending = communities.slice(0, 4);

    feed.innerHTML = `
        <div style="display: flex; gap: 20px; width: 100%; animation: fadeIn 0.5s ease-out; align-items: stretch;">
            <div class="post" style="border-left: 4px solid var(--cyber-yellow); flex: 2; margin-bottom: 0;">
                <h2 id="userNameDisplay" style="font-size: 18px; letter-spacing: 2px; color:var(--cyber-yellow);">
                    WELCOME, ${(userData.full_name || 'TECHNOLOGIST').toUpperCase()}!
                </h2>
                
                <div class="verified-badge" style="margin-top: 10px; display: inline-flex; align-items: center;">
                    <span>🛡️ Verified Technologist</span>
                    <span style="background: var(--cyber-cyan); color: #000; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; margin-left:5px;">✓</span>
                </div>
                
                <p style="color:var(--text-muted); font-size:12px; margin-top:15px;">Monitoring real-time network activity across all CTU nodes.</p>
            </div>

            <div class="stats-card" style="flex: 1; margin: 0; min-width: 200px;">
                <h4 style="font-size:11px; color:var(--cyber-yellow); margin-bottom:15px; letter-spacing:2px;">QUICK_STATS</h4>
                <div class="stat-line">Active Circles <span class="stat-val" id="stat-circles">${communities.length}</span></div>
                <div class="stat-line">Network Status <span class="stat-val" style="color:#00ff00;">ONLINE</span></div>
                <div class="stat-line">Clearance <span class="stat-val">STUDENT</span></div>
            </div>
        </div>

        <h3 style="font-size:11px; color:var(--cyber-cyan); margin: 30px 0 15px; letter-spacing:2px; text-transform:uppercase;">Trending_Nodes</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
            ${trending.map(c => `
                <div class="stats-card" style="cursor:pointer; transition: 0.3s; border:1px solid #222;" onclick="switchComm('${c.id}')" onmouseover="this.style.borderColor='var(--cyber-cyan)'" onmouseout="this.style.borderColor='#222'">
                    <div style="font-weight:bold; color:white; font-size:14px;">${c.icon || '🔹'} ${c.name}</div>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:5px; text-transform:uppercase;">${c.category || 'General'}</div>
                </div>
            `).join('')}
        </div>

        <h3 style="font-size:11px; color:var(--cyber-cyan); margin-bottom:15px; letter-spacing:2px; text-transform:uppercase;">Recent_Network_Transmissions</h3>
        <div class="post" style="border-color: #222; opacity:0.8;">
            <p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">Scanning for live encrypted traffic...</p>
        </div>
    `;
}

function openProfileModal() {
    const modal = document.getElementById('profileModal'); 
    const modalBody = document.getElementById('profileModalBody');
    if (!modal || !modalBody) return;

    // Get initials (up to 2 letters)
    const initials = userData.full_name 
        ? userData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    modalBody.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="width: 80px; height: 80px; border: 2px solid var(--cyber-cyan); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; margin: 0 auto 15px; color: var(--cyber-cyan); background: rgba(0, 240, 255, 0.05);">
                ${initials}
            </div>

            <h2 style="color:white; margin-bottom:5px; font-size: 20px;">${userData.full_name.toUpperCase()}</h2>
            
            <div class="verified-badge" style="margin: 0 auto 20px; display: inline-flex; align-items: center; gap: 5px;">
                <span>🛡️ Verified Student</span>
                <span style="background: var(--cyber-cyan); color: #000; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800;">✓</span>
            </div>

            <div class="stats-card" style="text-align:left; margin-bottom:20px; padding:15px; border-color:#333; background: rgba(255,255,255,0.02);">
                <div class="stat-line" style="margin-bottom:8px; display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted); font-size:11px;">STUDENT ID</span> 
                    <span class="stat-val" style="color:var(--cyber-yellow); font-family:monospace;">${userData.student_id}</span>
                </div>
                <div class="stat-line" style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted); font-size:11px;">ACTIVE CIRCLES</span> 
                    <span class="stat-val" style="color:var(--cyber-cyan);">${communities.length}</span>
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="cyber-btn" onclick="logout()" style="background: rgba(255, 68, 68, 0.1); color: #ff4444; border-color: #ff4444; width:100%;">
                    TERMINATE SESSION
                </button>
                <button class="cyber-btn" onclick="closeProfileModal()" style="width:100%; background:transparent; border-color:#333; color:var(--text-muted);">
                    CLOSE
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'none';
}


function renderCirclesInDropdown() {
    // Change this ID to match the new 'circle-dock' container
    const dock = document.getElementById('dockIcons'); 
    if (!dock) return;

    dock.innerHTML = communities.map(comm => `
        <div class="dock-icon ${activeCommId === comm.id ? 'active' : ''}" 
             onclick="switchComm('${comm.id}')" 
             title="${comm.name}">
            ${comm.icon || '🔹'}
        </div>
    `).join('');
}


// Start the application
initApp();

