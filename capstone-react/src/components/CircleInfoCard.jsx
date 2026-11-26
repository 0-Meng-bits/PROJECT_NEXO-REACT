import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// -- CIRCLE INFO CARD ----------------------------------------------------------
// Read-only info card for a circle — leader profile, recent members, stats,
// reviews, and join/leave/apply/invite controls.
export default function CircleInfoCard({ circle, memberCount, myMemberships, myApplications, currentUser, onClose, onEnter, onRequestJoin, onApply, onAcceptInvite, onDeclineInvite, onLeave, onViewApplication, onViewLeaderProfile, onReport }) {
  const [leaderProfile, setLeaderProfile] = useState(null);
  const [recentMembers, setRecentMembers] = useState([]);
  const [stats, setStats] = useState({ postsThisMonth: 0, daysSinceCreated: 0 });
  const [reviews, setReviews] = useState([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [myReview, setMyReview] = useState(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const rawTags = circle.interest_tags ?? circle.interest_tag;
  const tags = Array.isArray(rawTags)
    ? rawTags
    : (rawTags ? String(rawTags).split(',').map(t => t.trim()).filter(Boolean) : []);

  // Fetch leader + recent members + stats
  useEffect(() => {
    if (!circle.creator_id) return;
    // Leader
    supabase.from('accounts').select('id, full_name, ctu_id, account_details(avatar_url)')
      .eq('id', circle.creator_id).maybeSingle()
      .then(({ data }) => { if (data) setLeaderProfile({ id: data.id, full_name: data.full_name, ctu_id: data.ctu_id, avatar_url: data.account_details?.avatar_url || null }); });
    // Recently joined — only fetch if user is a member (RLS blocks non-members)
    const isUserMember = myMemberships?.some(m => m.community_id === circle.id && m.status === 'active');
    if (isUserMember) {
      supabase.from('memberships').select('user_id, created_at')
        .eq('community_id', circle.id).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(5)
        .then(async ({ data: mData, error }) => {
          if (error || !mData?.length) return;
          const ids = mData.map(m => m.user_id);
          const { data: accs } = await supabase.from('accounts').select('id, full_name, account_details(avatar_url)').in('id', ids);
          if (accs) {
            const map = {};
            accs.forEach(a => { map[a.id] = { full_name: a.full_name, avatar_url: a.account_details?.avatar_url || null }; });
            setRecentMembers(mData.map(m => ({ ...m, _acc: map[m.user_id] || {} })));
          }
        });
    }
    // Stats
    const now = new Date();
    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    const daysSince = circle.created_at ? Math.floor((now - new Date(circle.created_at)) / (1000 * 60 * 60 * 24)) : 0;
    supabase.from('announcements').select('id', { count: 'exact', head: true })
      .eq('community_id', circle.id).gte('created_at', monthAgo.toISOString())
      .then(({ count }) => setStats(prev => ({ ...prev, postsThisMonth: count || 0, daysSinceCreated: daysSince })));
    // Reviews — two-step to avoid RLS join issues
    supabase.from('circle_reviews').select('id, rating, comment, created_at, reviewer_id')
      .eq('community_id', circle.id).order('created_at', { ascending: false }).limit(20)
      .then(async ({ data }) => {
        if (!data?.length) return;
        setReviews(data);
        const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
        // Fetch reviewer accounts separately
        const ids = data.map(r => r.reviewer_id).filter(Boolean);
        if (ids.length) {
          const { data: accs } = await supabase.from('accounts').select('id, full_name, account_details(avatar_url)').in('id', ids);
          if (accs) {
            const map = {};
            accs.forEach(a => { map[a.id] = { full_name: a.full_name, avatar_url: a.account_details?.avatar_url || null }; });
            setReviews(prev => prev.map(r => ({ ...r, _reviewer: map[r.reviewer_id] || {} })));
          }
        }
      });
    if (currentUser?.id) {
      supabase.from('circle_reviews').select('id, rating, comment').eq('community_id', circle.id).eq('reviewer_id', currentUser.id).maybeSingle()
        .then(({ data }) => { if (data) { setMyReview(data); setReviewRating(data.rating); setReviewComment(data.comment || ''); } });
    }
  }, [circle.id, circle.creator_id, circle.created_at]);

  // Membership state
  const getMembership = (commId) => myMemberships.find(m => m.community_id === commId);
  const isOwner = circle.creator_id === currentUser?.id;
  const membership = getMembership(circle.id);
  const isActive = isOwner || membership?.status === 'active';
  const isPending = membership?.status === 'pending';
  const isInvitedState = membership?.status === 'invited';
  const myApp = myApplications.find(a => a.community_id === circle.id);
  const isAcceptedApp = myApp && (myApp.status === 'accepted' || myApp.status === 'approved' || myApp.phase2_result === 'accepted');
  const activeApp = myApp && !isAcceptedApp ? myApp : null;
  const isVerified = currentUser?.is_verified;

  const catColors = { academic: 'var(--cyber-cyan)', project: 'var(--cyber-yellow)', hobby: 'var(--green)', social: '#a78bfa' };
  const catColor = catColors[circle.category] || 'var(--cyber-cyan)';

  // Action button
  let actionBtn = null;
  if (isActive) {
    actionBtn = (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="group-action-btn manage" onClick={() => onEnter(circle.id)} style={{ fontSize: 12, padding: '8px 20px' }}>
          <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: 7 }}></i>ENTER CIRCLE
        </button>
        {!isOwner && (
          <button className="group-action-btn terminate" onClick={() => onLeave && onLeave(circle.id)} style={{ fontSize: 12, padding: '8px 12px' }}>
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        )}
      </div>
    );
  } else if (isInvitedState) {
    actionBtn = (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="group-action-btn manage" onClick={() => onAcceptInvite && onAcceptInvite(circle.id)} style={{ fontSize: 12, padding: '8px 18px', background: 'rgba(62,207,142,0.15)', borderColor: 'var(--green)', color: 'var(--green)' }}>
          <i className="fa-solid fa-check" style={{ marginRight: 7 }}></i>ACCEPT
        </button>
        <button className="group-action-btn terminate" onClick={() => onDeclineInvite && onDeclineInvite(circle.id)} style={{ fontSize: 12, padding: '8px 18px' }}>
          <i className="fa-solid fa-xmark" style={{ marginRight: 7 }}></i>DECLINE
        </button>
      </div>
    );
  } else if (!isVerified) {
    actionBtn = <span style={{ fontSize: 12, color: 'var(--text-muted)', border: '1px solid #333', padding: '8px 18px', borderRadius: 20 }}><i className="fa-solid fa-lock" style={{ marginRight: 6 }}></i>Verify to join</span>;
  } else if (isPending) {
    actionBtn = <span style={{ fontSize: 12, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '8px 18px', borderRadius: 20 }}><i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i>PENDING APPROVAL</span>;
  } else if (activeApp) {
    const appColor = { pending: 'var(--cyber-yellow)', phase2: 'var(--cyber-cyan)', accepted: 'var(--green)', approved: 'var(--green)', rejected: 'var(--red)' }[activeApp.status] || 'var(--cyber-cyan)';
    actionBtn = (
      <button onClick={() => onViewApplication && onViewApplication(activeApp, circle)}
        style={{ fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 20, color: appColor, border: `1px solid ${appColor}`, background: 'transparent', cursor: 'pointer' }}>
        <i className="fa-solid fa-microphone" style={{ marginRight: 6 }}></i>APPLICATION {(activeApp.status || '').toUpperCase()}
      </button>
    );
  } else if (circle.application_enabled && !circle.internal_Application) {
    actionBtn = (
      <button className="group-action-btn manage" onClick={() => onApply(circle)} style={{ fontSize: 12, padding: '8px 20px' }}>
        <i className="fa-solid fa-microphone" style={{ marginRight: 7 }}></i>APPLY TO JOIN
      </button>
    );
  } else {
    actionBtn = (
      <button className="group-action-btn manage" onClick={() => onRequestJoin(circle.id)} style={{ fontSize: 12, padding: '8px 20px' }}>
        <i className="fa-solid fa-paper-plane" style={{ marginRight: 7 }}></i>JOIN CIRCLE
      </button>
    );
  }

  const initials = leaderProfile?.full_name ? leaderProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const submitReview = async () => {
    if (!reviewRating) return;
    setSubmittingReview(true);
    if (myReview) {
      await supabase.from('circle_reviews').update({ rating: reviewRating, comment: reviewComment.trim() }).eq('id', myReview.id);
    } else {
      await supabase.from('circle_reviews').insert([{ community_id: circle.id, reviewer_id: currentUser.id, rating: reviewRating, comment: reviewComment.trim() }]);
    }
    // Refresh reviews
    const { data } = await supabase.from('circle_reviews').select('id, rating, comment, created_at, reviewer_id').eq('community_id', circle.id).order('created_at', { ascending: false }).limit(20);
    if (data) { setReviews(data); const avg = data.length ? data.reduce((s, r) => s + r.rating, 0) / data.length : 0; setAvgRating(Math.round(avg * 10) / 10); }
    const { data: mine } = await supabase.from('circle_reviews').select('id, rating, comment').eq('community_id', circle.id).eq('reviewer_id', currentUser.id).maybeSingle();
    if (mine) setMyReview(mine);
    setShowReviewForm(false);
    setSubmittingReview(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, padding: 0, overflow: 'hidden', borderRadius: 16 }}>

        {/* Cover banner */}
        <div style={{ height: 160, position: 'relative', background: circle.cover_url ? `url(${circle.cover_url}) center/cover no-repeat` : `linear-gradient(135deg, ${catColor}30, rgba(0,0,0,0.6))`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
          {/* Logo + name + leader overlapping bottom of cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {/* Logo */}
            <div style={{ width: 66, height: 66, borderRadius: 14, border: '3px solid var(--bg-primary)', overflow: 'hidden', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {circle.logo_url ? <img src={circle.logo_url} alt={circle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={circle.icon || 'fa-solid fa-circle-nodes'} style={{ fontSize: 26, color: 'var(--cyber-cyan)' }} />}
            </div>
            {/* Name + Leader stacked */}
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{circle.name}</span>
                {circle.is_official && <span style={{ fontSize: 10, color: 'var(--green)', border: '1px solid var(--green)', padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'rgba(0,0,0,0.5)' }}><i className="fa-solid fa-circle-check" style={{ marginRight: 4 }}></i>Verified</span>}
              </div>
              {leaderProfile && (
                <button onClick={() => { onClose(); onViewLeaderProfile && onViewLeaderProfile(leaderProfile.ctu_id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 10px 3px 5px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Leader</span>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                    {leaderProfile.avatar_url ? <img src={leaderProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{leaderProfile.full_name}</span>
                  <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px 20px', overflowY: 'auto', maxHeight: 'calc(85vh - 160px)', height: 380 }}>

          {/* Two-column layout — left wider, right narrower. On mobile: single column */}
          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 480 ? '1fr' : '1fr 160px', gap: 10, marginBottom: 10 }}>

            {/* Left column — two separate cards stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Top card — badges + interests */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10, color: catColor, border: `1px solid ${catColor}`, padding: '2px 9px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>{circle.category}</span>
                  {circle.status === 'pending' && <span style={{ fontSize: 10, color: 'var(--orange)', border: '1px solid var(--orange)', padding: '2px 9px', borderRadius: 20 }}><i className="fa-solid fa-hourglass-half" style={{ marginRight: 4 }}></i>Forming</span>}
                  {circle.is_open && circle.status !== 'pending' && <span style={{ fontSize: 10, color: '#3ecf8e', border: '1px solid #3ecf8e', padding: '2px 9px', borderRadius: 20 }}><i className="fa-solid fa-door-open" style={{ marginRight: 4 }}></i>Open</span>}
                  {!circle.is_open && circle.status !== 'pending' && <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid #444', padding: '2px 9px', borderRadius: 20 }}><i className="fa-solid fa-lock" style={{ marginRight: 4 }}></i>Closed</span>}
                  {circle.application_enabled && <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', border: '1px solid var(--cyber-cyan)', padding: '2px 9px', borderRadius: 20 }}><i className="fa-solid fa-microphone" style={{ marginRight: 4 }}></i>Application Required</span>}
                </div>
                {/* Interests */}
                {tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>INTERESTS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {tags.map((tag, i) => (
                        <span key={i} style={{ fontSize: 11, background: 'rgba(0,240,255,0.07)', border: '1px solid rgba(0,240,255,0.18)', color: 'var(--cyber-cyan)', padding: '3px 10px', borderRadius: 20 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Recently Joined */}
                {recentMembers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>RECENTLY JOINED</div>
                    <div style={{ display: 'flex' }}>
                      {recentMembers.map((m, i) => {
                        const avatarUrl = m._acc?.avatar_url;
                        const name = m._acc?.full_name || '?';
                        return (
                          <div key={i} title={name} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--bg-primary)', overflow: 'hidden', background: 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--cyber-cyan)', marginLeft: i > 0 ? -8 : 0, zIndex: recentMembers.length - i }}>
                            {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0].toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Bottom card — description only, scrollable */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, marginBottom: 5 }}>DESCRIPTION</div>
                <p style={{ fontSize: 12, color: circle.description ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)', lineHeight: 1.6, margin: 0, fontStyle: circle.description ? 'normal' : 'italic', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto', paddingRight: 4 }}>
                  {circle.description || 'No description provided.'}
                </p>
              </div>
            </div>

            {/* Right column — 3 stat cards, stretch to fill total left height */}
            <div style={{ display: 'flex', flexDirection: window.innerWidth < 480 ? 'row' : 'column', gap: 8 }}>
              {[
                { label: 'Members', value: memberCount, icon: 'fa-solid fa-users', color: 'var(--cyber-cyan)' },
                { label: 'Posts/mo', value: stats.postsThisMonth, icon: 'fa-solid fa-bullhorn', color: 'var(--cyber-yellow)' },
                { label: 'Days active', value: stats.daysSinceCreated, icon: 'fa-solid fa-calendar', color: 'var(--green)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <i className={s.icon} style={{ fontSize: 14, color: s.color, flexShrink: 0 }}></i>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Review section */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700 }}>REVIEWS</div>
                {avgRating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>{avgRating}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(s => (
                        <i key={s} className={s <= Math.round(avgRating) ? 'fa-solid fa-star' : 'fa-regular fa-star'} style={{ fontSize: 10, color: '#f59e0b' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({reviews.length})</span>
                  </div>
                )}
              </div>
              {isActive && (
                <button onClick={() => setShowReviewForm(v => !v)}
                  style={{ fontSize: 11, color: 'var(--cyber-cyan)', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 20, padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {myReview ? 'Edit Review' : '+ Review'}
                </button>
              )}
            </div>

            {/* Review form */}
            {showReviewForm && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 20, color: s <= reviewRating ? '#f59e0b' : 'rgba(255,255,255,0.2)' }}>
                      <i className={s <= reviewRating ? 'fa-solid fa-star' : 'fa-regular fa-star'} />
                    </button>
                  ))}
                </div>
                <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Share your experience (optional)..."
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none', resize: 'none', height: 60, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                    style={{ flex: 1, background: 'var(--cyber-cyan)', border: 'none', borderRadius: 8, padding: '6px 0', cursor: 'pointer', color: '#000', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
                    {submittingReview ? 'Saving...' : 'Submit'}
                  </button>
                  <button onClick={() => setShowReviewForm(false)}
                    style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 0', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Recent reviews list — collapsible */}
            {reviews.length === 0 ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', margin: 0 }}>No reviews yet. Be the first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {(showAllReviews ? reviews : reviews.slice(0, 2)).map(r => (
                  <div key={r.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                        {r._reviewer?.avatar_url ? <img src={r._reviewer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (r._reviewer?.full_name || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{r._reviewer?.full_name || 'Member'}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1,2,3,4,5].map(s => <i key={s} className={s <= r.rating ? 'fa-solid fa-star' : 'fa-regular fa-star'} style={{ fontSize: 9, color: '#f59e0b' }} />)}
                      </div>
                    </div>
                    {r.comment && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{r.comment}</p>}
                  </div>
                ))}
                {reviews.length > 2 && (
                  <button onClick={() => setShowAllReviews(v => !v)}
                    style={{ fontSize: 11, color: 'var(--cyber-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left', fontFamily: 'inherit' }}>
                    {showAllReviews ? '▲ Show less' : `▼ Show ${reviews.length - 2} more review${reviews.length - 2 !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            {onReport && currentUser?.user_type !== 'Admin' && (
              <button onClick={() => { onClose(); onReport({ type: 'circle', id: circle.id, preview: `Circle: ${circle.name}`, reportedUserId: circle.creator_id }); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', opacity: 0.6, transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                <i className="fa-solid fa-flag" style={{ fontSize: 10 }}></i> Report Circle
              </button>
            )}
            <div style={{ marginLeft: 'auto' }}>{actionBtn}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
