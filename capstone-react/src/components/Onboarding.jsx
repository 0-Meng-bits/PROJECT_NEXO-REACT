import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const COURSES = [
  'BEED',
  'BIT AUTO TECH',
  'BIT COM TECH',
  'BIT ELEC TECH',
  'BSED MATH',
  'BSFI',
  'BSHM',
  'BSIE',
  'BSIT',
  'BTLED-HE',
];

const YEAR_LEVELS = ['1st', '2nd', '3rd', '4th', 'Graduate'];

const INTEREST_BUBBLES = [
  { id: 'coding',            label: '💻 Coding',             color: '#00f0ff' },
  { id: 'design',            label: '🎨 Design',              color: '#a855f7' },
  { id: 'gaming',            label: '🎮 Gaming',              color: '#22c55e' },
  { id: 'music',             label: '🎵 Music',               color: '#f59e0b' },
  { id: 'sports',            label: '⚽ Sports',              color: '#ef4444' },
  { id: 'research',          label: '🔬 Research',            color: '#3b82f6' },
  { id: 'art',               label: '🖼️ Art',                 color: '#ec4899' },
  { id: 'photography',       label: '📷 Photography',         color: '#14b8a6' },
  { id: 'writing',           label: '✍️ Writing',             color: '#f97316' },
  { id: 'robotics',          label: '🤖 Robotics',            color: '#8b5cf6' },
  { id: 'business',          label: '💼 Business',            color: '#fcee0a' },
  { id: 'cooking',           label: '🍳 Cooking',             color: '#84cc16' },
  { id: 'travel',            label: '✈️ Travel',              color: '#06b6d4' },
  { id: 'anime',             label: '🌸 Anime',               color: '#f43f5e' },
  { id: 'fitness',           label: '💪 Fitness',             color: '#10b981' },
  { id: 'debate',            label: '🗣️ Debate',              color: '#6366f1' },
  { id: 'reading',           label: '📚 Reading',             color: '#0ea5e9' },
  { id: 'podcasting',        label: '🎙️ Podcasting',          color: '#d946ef' },
  { id: 'language_learning', label: '🌐 Language Learning',   color: '#f59e0b' },
  { id: 'bl_gl',             label: '🏳️‍🌈 Watching BL/GL',    color: '#fb7185' },
  { id: 'esports',           label: '🏆 E-Sports',            color: '#4ade80' },
  { id: 'dancing',           label: '💃 Dancing',             color: '#c084fc' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const [step, setStep] = useState(1); // 1=avatar, 2=course/year, 3=interests
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [auraMatch, setAuraMatch] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch aura match when interests change
  useEffect(() => {
    if (selectedInterests.length === 0) { setAuraMatch(null); return; }
    const fetchAura = async () => {
      // Count students with at least one matching interest (only works after migration)
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .overlaps('interests', selectedInterests)
        .neq('id', user.id || '');

      // Find top community whose category matches selected interests
      // Map interests to community categories
      const categoryMap = {
        coding: 'project', design: 'hobby', gaming: 'hobby',
        music: 'hobby', sports: 'social', research: 'academic',
        art: 'hobby', photography: 'hobby', writing: 'hobby',
        robotics: 'project', business: 'academic', cooking: 'hobby',
        travel: 'social', anime: 'hobby', fitness: 'social', debate: 'academic',
        reading: 'hobby', podcasting: 'hobby', language_learning: 'academic',
        bl_gl: 'social', esports: 'hobby', dancing: 'social',
      };
      const matchedCategories = [...new Set(selectedInterests.map(i => categoryMap[i]).filter(Boolean))];

      let topCommunity = null;
      if (matchedCategories.length > 0) {
        const { data: comms } = await supabase
          .from('communities')
          .select('name')
          .in('category', matchedCategories)
          .limit(1);
        topCommunity = comms?.[0]?.name || null;
      }

      setAuraMatch({
        count: count || 0,
        topCommunity,
      });
    };
    fetchAura();
  }, [selectedInterests, user.id]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const toggleInterest = (id) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    if (!user?.id) { navigate('/portal'); return; }
    setSaving(true);

    let avatarUrl = null;

    // Upload avatar via server (same path as profile pic change — uses service role)
    if (avatarFile) {
      try {
        // Compress to ≤200px before uploading
        const compressed = await new Promise((resolve, reject) => {
          const img = new Image();
          const objUrl = URL.createObjectURL(avatarFile);
          img.onload = () => {
            URL.revokeObjectURL(objUrl);
            const MAX = 200;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.onerror = reject;
          img.src = objUrl;
        });

        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/upload-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(!token && user?.id ? { 'x-user-id': user.id } : {}),
          },
          body: JSON.stringify({ avatar: compressed }),
        });

        if (res.ok) {
          const { url } = await res.json();
          avatarUrl = url;
        } else {
          // Fallback: save base64 locally so it shows in the session
          avatarUrl = compressed;
        }
      } catch (err) {
        console.error('Avatar upload error during onboarding:', err);
      }
    }

    // Update profile
    const updates = {
      course,
      year_level: yearLevel,
      interests: selectedInterests,
      onboarding_complete: true,
      ...(avatarUrl && { avatar_url: avatarUrl }),
    };

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updatedProfile) {
      // Merge avatar_url in case it was saved separately via /api/upload-avatar
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({
        ...updatedProfile,
        avatar_url: updatedProfile.avatar_url || avatarUrl || stored.avatar_url || null,
      }));
    } else if (avatarUrl) {
      // Profile update failed but we still have the avatar — save it locally
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: avatarUrl }));
    }

    setSaving(false);
    navigate('/portal');
  };

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="onboarding-page">
      <div className="onboarding-orb orb-1" />
      <div className="onboarding-orb orb-2" />

      <div className="auth-card-glow" style={{ width: '520px', maxWidth: '95vw' }}>
        <div className="onboarding-card">
        {/* Progress bar */}
        <div className="onboarding-progress">
          {[1, 2, 3].map(s => (
            <div key={s} className={`ob-step ${step >= s ? 'active' : ''} ${step > s ? 'done' : ''}`}>
              <div className="ob-step-dot">
                {step > s ? <i className="fa-solid fa-check" /> : s}
              </div>
              <span className="ob-step-label">
                {s === 1 ? 'Profile' : s === 2 ? 'Details' : 'Interests'}
              </span>
            </div>
          ))}
          <div className="ob-progress-line">
            <div className="ob-progress-fill" style={{ width: `${((step - 1) / 2) * 100}%` }} />
          </div>
        </div>

        {/* ── STEP 1: Avatar ── */}
        {step === 1 && (
          <div className="ob-step-content fade-in">
            <h2 className="ob-title">Set Your Profile Picture</h2>
            <p className="ob-subtitle">Put a face to your name — or skip for now</p>

            <div className="ob-avatar-wrap">
              <div className="ob-avatar">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="ob-avatar-img" />
                  : <span className="ob-avatar-initials">{initials}</span>
                }
                <label className="ob-avatar-edit" htmlFor="avatar-upload">
                  <i className="fa-solid fa-camera" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*"
                  onChange={handleAvatarChange} style={{ display: 'none' }} />
              </div>
              <p className="ob-avatar-hint">Click the camera icon to upload</p>
            </div>

            <div className="ob-actions">
              <button className="cyber-btn" onClick={() => setStep(2)}>
                {avatarPreview ? 'NEXT →' : 'SKIP FOR NOW →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Course + Year ── */}
        {step === 2 && (
          <div className="ob-step-content fade-in">
            <h2 className="ob-title">Your Academic Identity</h2>
            <p className="ob-subtitle">Help us connect you with the right people</p>

            <div className="input-group">
              <label>COURSE / PROGRAM</label>
              <select value={course} onChange={e => setCourse(e.target.value)}>
                <option value="">Select your course...</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>YEAR LEVEL</label>
              <div className="ob-year-grid">
                {YEAR_LEVELS.map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`ob-year-btn ${yearLevel === y ? 'selected' : ''}`}
                    onClick={() => setYearLevel(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="ob-actions">
              <button className="cyber-btn secondary" onClick={() => setStep(1)}>← BACK</button>
              <button className="cyber-btn" onClick={() => setStep(3)}
                disabled={!course || !yearLevel}>
                NEXT →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Interests + Aura Match ── */}
        {step === 3 && (
          <div className="ob-step-content fade-in">
            <h2 className="ob-title">What Are You Into?</h2>
            <p className="ob-subtitle">Select your interests — pick as many as you like</p>

            <div className="ob-bubbles">
              {INTEREST_BUBBLES.map(b => (
                <button
                  key={b.id}
                  type="button"
                  className={`ob-bubble ${selectedInterests.includes(b.id) ? 'selected' : ''}`}
                  style={selectedInterests.includes(b.id) ? {
                    borderColor: b.color,
                    background: `${b.color}18`,
                    color: b.color,
                  } : {}}
                  onClick={() => toggleInterest(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Aura Match Preview */}
            {auraMatch && selectedInterests.length > 0 && (
              <div className="aura-match-card fade-in">
                <div className="aura-match-icon">
                  <i className="fa-solid fa-bolt" />
                </div>
                <div className="aura-match-text">
                  <div className="aura-match-title">AURA MATCH</div>
                  <div className="aura-match-body">
                    {auraMatch.count > 0 ? (
                      <>
                        You share interests with{' '}
                        <strong style={{ color: '#7C2D2D' }}>{auraMatch.count} student{auraMatch.count !== 1 ? 's' : ''}</strong>
                        {auraMatch.topCommunity && (
                          <> · Suggested circle: <strong style={{ color: '#9B3A3A' }}>{auraMatch.topCommunity}</strong></>
                        )}
                      </>
                    ) : (
                      <>
                        Be the first with these interests!
                        {auraMatch.topCommunity && (
                          <> · Check out: <strong style={{ color: '#9B3A3A' }}>{auraMatch.topCommunity}</strong></>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="ob-actions">
              <button className="cyber-btn secondary" onClick={() => setStep(2)}>← BACK</button>
              <button className="cyber-btn" onClick={handleFinish} disabled={saving}>
                {saving ? 'SAVING...' : 'ENTER NEXO →'}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
