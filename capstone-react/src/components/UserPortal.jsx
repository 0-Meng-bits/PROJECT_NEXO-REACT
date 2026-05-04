import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuditionFormBuilder, AuditionReviewPanel, AuditionApplicationForm, auditionStatusLabel, auditionStatusColor } from './AuditionSystem';
import ThemePicker from './ThemePicker';
import { loadTheme } from '../lib/theme';

function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-graduation-cap',
    project:  'fa-solid fa-flask',
    hobby:    'fa-solid fa-gamepad',
    social:   'fa-solid fa-user-group',
    system:   'fa-solid fa-earth-asia',
  };
  return map[category] || 'fa-solid fa-network-wired';
}

function notifIcon(type) {
  const map = {
    join_approved:    'fa-solid fa-circle-check',
    join_denied:      'fa-solid fa-circle-xmark',
    kicked:           'fa-solid fa-user-xmark',
    promoted:         'fa-solid fa-arrow-up',
    audition_update:  'fa-solid fa-microphone',
    new_announcement: 'fa-solid fa-bullhorn',
    invite_accepted:  'fa-solid fa-envelope-open-text',
  };
  return map[type] || 'fa-solid fa-bell';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function categoryGradient(category) {
  const map = {
    academic: 'linear-gradient(135deg, #1a1a4e, #0d3b6e)',
    project:  'linear-gradient(135deg, #1a3a1a, #0d5c2e)',
    hobby:    'linear-gradient(135deg, #3a1a3a, #6e0d5c)',
    social:   'linear-gradient(135deg, #3a2a0d, #6e4a0d)',
  };
  return map[category] || 'linear-gradient(135deg, #0d1a2e, #0a0f1e)';
}

const GLOBAL_COMM = {
  id: 'global', name: 'NEXO Hub',
  description: 'The central gathering space for all CTU students and faculty.',
  icon: null, faIcon: 'fa-solid fa-earth-asia', category: 'system', creator_id: 'SYSTEM',
};

function Toast({ message }) {
  return <div className={`toast ${message ? 'show' : ''}`}>{message?.toUpperCase()}</div>;
}

// â”€â”€ BAD WORDS AUTO-DETECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'puta', 'gago', 'bobo', 'tanga', 'putangina', 'leche', 'pakshet', 'ulol', 'tangina', 'pakyu', 'yawa', 'buang'];

function containsBadWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

// â”€â”€ POST TYPE CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const POST_TYPE = {
  announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
  event:        { label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
  shoutout:     { label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
  general:      { label: 'General',       color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
  poll:         { label: 'Poll',          color: '#a855f7',             icon: 'fa-solid fa-chart-bar' },
};

function AnnouncementCard({ a, user, onPin, onDelete, onVote, onApply, onReport }) {
  const type = POST_TYPE[a.post_type] || POST_TYPE.general;
  const isAnon = a.author_name === 'Anonymous';
  const displayName = isAnon ? 'Anonymous' : a.author_name;
  const avatarChar = isAnon ? '?' : (a.author_name || 'A')[0].toUpperCase();

  // Poll state
  const isPoll = a.post_type === 'poll';
  const pollOptions = isPoll ? (a.poll_options || []) : [];
  const pollVotes = isPoll ? (a.poll_votes || {}) : {};
  const totalVotes = Object.values(pollVotes).reduce((s, v) => s + (v?.length || 0), 0);
  const myVote = isPoll ? pollOptions.find(opt => (pollVotes[opt] || []).includes(user?.id)) : null;

  // Detect audition announcements by title pattern
  const isAuditionPost = a.title?.includes('Audition Open') || a.title?.includes('Internal Audition Open');

  // Comment state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, author_name }
  const [replyInput, setReplyInput] = useState('');

  // Load comment count on mount
  useEffect(() => {
    supabase.from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('announcement_id', a.id)
      .then(({ count }) => setCommentCount(count || 0));
  }, [a.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase.from('post_comments')
      .select('*')
      .eq('announcement_id', a.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(v => !v);
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !user) return;
    setPostingComment(true);
    const { data, error } = await supabase.from('post_comments').insert([{
      announcement_id: a.id,
      author_id: user.id,
      author_name: user.full_name,
      author_type: user.user_type,
      content: commentInput.trim(),
    }]).select().single();
    setPostingComment(false);
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setCommentInput('');
      setCommentCount(prev => prev + 1);
      // Notify the post author (if it's not yourself)
      if (a.author_id && a.author_id !== user.id) {
        await supabase.from('notifications').insert([{
          user_id: a.author_id,
          type: 'new_announcement',
          message: `${user.full_name} commented on your post: "${a.title?.slice(0, 50)}"`,
          link_comm_id: a.community_id || null,
        }]);
      }
      // Auto-flag bad words in comment
      if (containsBadWord(commentInput)) {
        await autoFlagContent({
          reporterId: user.id,
          reportedUserId: user.id,
          contentType: 'message',
          contentId: data.id,
          contentPreview: commentInput,
        });
      }
    }
  };

  const deleteComment = async (commentId) => {
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentCount(prev => Math.max(0, prev - 1));
  };

  const submitReply = async () => {
    if (!replyInput.trim() || !user || !replyingTo) return;
    const content = `@${replyingTo.author_name} ${replyInput.trim()}`;
    const { data, error } = await supabase.from('post_comments').insert([{
      announcement_id: a.id,
      author_id: user.id,
      author_name: user.full_name,
      author_type: user.user_type,
      content,
    }]).select().single();
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setCommentCount(prev => prev + 1);
      setReplyInput('');
      setReplyingTo(null);
      // Notify the person being replied to
      if (replyingTo.author_id && replyingTo.author_id !== user.id) {
        await supabase.from('notifications').insert([{
          user_id: replyingTo.author_id,
          type: 'new_announcement',
          message: `${user.full_name} replied to your comment on "${a.title?.slice(0, 50)}"`,
          link_comm_id: a.community_id || null,
        }]);
      }
      if (containsBadWord(replyInput)) {
        await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: data.id, contentPreview: content });
      }
    }
  };

  return (
    <div className={`announcement-card ${a.pinned ? 'pinned' : ''}`}>
      {a.pinned && (
        <div className="announcement-pin-badge">
          <i className="fa-solid fa-thumbtack"></i> Pinned
        </div>
      )}
      <div className="announcement-header">
        <div className={`announcement-author-avatar ${isAnon ? 'anon' : ''}`}>
          {isAnon ? <i className="fa-solid fa-user-secret"></i> : avatarChar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: isAnon ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {displayName}
            </span>
            {isAnon && (
              <span style={{ fontSize: 10, color: '#666', border: '1px solid #333', padding: '1px 7px', borderRadius: 10, fontStyle: 'italic' }}>
                anonymous
              </span>
            )}
            <span style={{ fontSize: 10, color: type.color, border: `1px solid ${type.color}`, padding: '1px 7px', borderRadius: 10 }}>
              <i className={type.icon} style={{ marginRight: 4 }}></i>{type.label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {isAnon ? 'Anonymous' : a.author_type} · {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        {(user?.user_type === 'Admin' || (!isAnon && a.author_id === user?.id) || (isAnon && a.author_id === user?.id)) && (
          <div style={{ display: 'flex', gap: 6 }}>
            {user?.user_type === 'Admin' && (
              <button className="chat-action-btn" onClick={() => onPin(a.id, a.pinned)}
                style={{ color: 'var(--cyber-yellow)' }} title={a.pinned ? 'Unpin' : 'Pin'}>
                <i className="fa-solid fa-thumbtack"></i>
              </button>
            )}
            <button className="chat-action-btn" onClick={() => onDelete(a.id)} style={{ color: 'var(--red)' }}>
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        )}
        {/* Report button "” always visible to non-owners */}
        {onReport && user?.user_type !== 'Admin' && a.author_id !== user?.id && (
          <button className="chat-action-btn" onClick={() => onReport({ type: 'announcement', id: a.id, preview: `${a.title}: ${a.content}`, reportedUserId: a.author_id })}
            title="Report this post"
            style={{ color: 'var(--text-muted)', marginLeft: 4, opacity: 0.6, transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
            <i className="fa-solid fa-flag"></i>
          </button>
        )}
      </div>

      {/* Flagged content warning */}
      {(containsBadWord(a.title) || containsBadWord(a.content)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 10px', background: 'rgba(247,95,95,0.08)', border: '1px solid rgba(247,95,95,0.25)', borderRadius: 6, fontSize: 11, color: 'var(--red)' }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          This post has been flagged for inappropriate content.
        </div>
      )}

      <h3 className="announcement-title">{a.title}</h3>
      {a.content && <p className="announcement-body">{a.content}</p>}

      {/* â”€â”€ AUDITION APPLY BUTTON â”€â”€ */}
      {isAuditionPost && onApply && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => onApply(a)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(252,238,10,0.1)', border: '1px solid var(--cyber-yellow)', color: 'var(--cyber-yellow)', borderRadius: 8, padding: '9px 20px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(252,238,10,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(252,238,10,0.1)'}>
            <i className="fa-solid fa-microphone"></i> APPLY NOW
          </button>
        </div>
      )}

      {/* â”€â”€ POLL OPTIONS â”€â”€ */}
      {isPoll && pollOptions.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pollOptions.map((opt, i) => {
            const votes = (pollVotes[opt] || []).length;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isMyChoice = myVote === opt;
            return (
              <button key={i} onClick={() => onVote && onVote(a.id, opt, pollVotes)} disabled={!!myVote}
                style={{ position: 'relative', overflow: 'hidden', width: '100%', textAlign: 'left', background: isMyChoice ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMyChoice ? '#a855f7' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '10px 14px', cursor: myVote ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)', transition: 'border-color 0.2s' }}>
                {myVote && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isMyChoice ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', transition: 'width 0.4s ease', borderRadius: 8 }} />}
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{isMyChoice && <i className="fa-solid fa-check" style={{ marginRight: 8, color: '#a855f7', fontSize: 11 }}></i>}{opt}</span>
                  {myVote && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{pct}% · {votes}</span>}
                </div>
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}{myVote ? ` · You voted "${myVote}"` : ' · Click to vote'}
          </div>
        </div>
      )}

      {/* â”€â”€ COMMENT SECTION â”€â”€ */}
      <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        {/* Toggle comments button */}
        <button onClick={toggleComments}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--cyber-cyan)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <i className="fa-regular fa-comment"></i>
          {showComments ? 'Hide comments' : `Comments${commentCount > 0 ? ` (${commentCount})` : ''}`}
          <i className={`fa-solid fa-chevron-${showComments ? 'up' : 'down'}`} style={{ fontSize: 9 }}></i>
        </button>

        {showComments && (
          <div style={{ marginTop: 12 }}>
            {/* Comment list */}
            {loadingComments ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading comments...</p>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No comments yet. Be the first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                      {(c.author_name || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${containsBadWord(c.content) ? 'rgba(247,95,95,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{c.author_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {/* Delete own comment or admin */}
                          {(c.author_id === user?.id || user?.user_type === 'Admin') && (
                            <button onClick={() => deleteComment(c.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '0 2px' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                          {/* Report comment */}
                          {onReport && c.author_id !== user?.id && user?.user_type !== 'Admin' && (
                            <button onClick={() => onReport({ type: 'message', id: c.id, preview: c.content, reportedUserId: c.author_id })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '0 2px', opacity: 0.5 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                              title="Report comment">
                              <i className="fa-solid fa-flag"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      {containsBadWord(c.content) && (
                        <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="fa-solid fa-triangle-exclamation"></i> Flagged
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                    </div>
                    {/* Reply button */}
                    {user?.is_verified && (
                      <button onClick={() => { setReplyingTo(replyingTo?.id === c.id ? null : { id: c.id, author_name: c.author_name, author_id: c.author_id }); setReplyInput(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: '2px 0 0 38px', fontFamily: 'inherit', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--cyber-cyan)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <i className="fa-solid fa-reply" style={{ marginRight: 4 }}></i>Reply
                      </button>
                    )}
                    {/* Inline reply input */}
                    {replyingTo?.id === c.id && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 38, marginTop: 6 }}>
                        <input value={replyInput} onChange={e => setReplyInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitReply()}
                          placeholder={`Reply to ${c.author_name}...`}
                          autoFocus
                          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 20, padding: '6px 12px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none' }} />
                        <button onClick={submitReply} disabled={!replyInput.trim()}
                          style={{ background: 'var(--cyber-cyan)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000', fontSize: 12, flexShrink: 0, opacity: replyInput.trim() ? 1 : 0.4 }}>
                          <i className="fa-solid fa-paper-plane"></i>
                        </button>
                        <button onClick={() => setReplyingTo(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            {user?.is_verified && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                  {(user.full_name || 'U')[0].toUpperCase()}
                </div>
                <input
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                  placeholder="Write a comment..."
                  style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '7px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,240,255,0.3)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button onClick={submitComment} disabled={postingComment || !commentInput.trim()}
                  style={{ background: 'var(--cyber-cyan)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000', fontSize: 13, flexShrink: 0, opacity: commentInput.trim() ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ MESSAGE ITEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MessageItem({ m, tagColor, isOwnerMsg, canDelete, onDelete, onEdit, onReport, currentStudentId }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(m.content);
  const [hovered, setHovered] = useState(false);
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('message_reactions')
        .select('reaction, student_id').eq('message_id', m.id);
      if (data) {
        const grouped = {};
        data.forEach(r => {
          if (!grouped[r.reaction]) grouped[r.reaction] = [];
          grouped[r.reaction].push(r.student_id);
        });
        setReactions(grouped);
      }
    };
    load();
  }, [m.id]);

  const toggleReaction = async (type) => {
    const mine = reactions[type]?.includes(currentStudentId);
    if (mine) {
      await supabase.from('message_reactions')
        .delete().eq('message_id', m.id).eq('student_id', currentStudentId).eq('reaction', type);
      setReactions(prev => ({ ...prev, [type]: (prev[type] || []).filter(s => s !== currentStudentId) }));
    } else {
      await supabase.from('message_reactions')
        .insert([{ message_id: m.id, student_id: currentStudentId, reaction: type }]);
      setReactions(prev => ({ ...prev, [type]: [...(prev[type] || []), currentStudentId] }));
    }
  };

  const handleEdit = async () => {
    if (!editVal.trim() || editVal === m.content) { setEditing(false); return; }
    await onEdit(m.id, editVal.trim());
    setEditing(false);
  };

  const initials = (m.full_name || 'U')[0].toUpperCase();
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const showActions = (isOwnerMsg || canDelete || onReport) && hovered && !editing;

  return (
    <div className={`chat-row ${isOwnerMsg ? 'own' : 'other'}`}>
      {!isOwnerMsg && (
        <div className="chat-avatar" style={{ background: tagColor }}>{initials}</div>
      )}

      <div className="chat-body"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {!isOwnerMsg && (
          <div className="chat-meta">
            <span className="chat-name">{m.full_name}</span>
            {m.role && <span className="chat-role">{m.role}</span>}
            <span className="chat-time">{time}</span>
          </div>
        )}

        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="msg-edit-input" value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus />
            <button className="msg-edit-save" onClick={handleEdit}><i className="fa-solid fa-check"></i></button>
            <button className="msg-edit-cancel" onClick={() => setEditing(false)}><i className="fa-solid fa-xmark"></i></button>
          </div>
        ) : (
          <div className={`chat-bubble ${isOwnerMsg ? 'own' : 'other'}`}
            style={containsBadWord(m.content) ? { borderColor: 'rgba(247,95,95,0.5)', background: isOwnerMsg ? 'rgba(247,95,95,0.15)' : 'rgba(247,95,95,0.08)' } : {}}>
            {containsBadWord(m.content) && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Flagged content
              </div>
            )}
            {m.content}
          </div>
        )}

        {/* Inline action bar "” appears below bubble on hover */}
        {showActions && (
          <div className={`chat-actions ${isOwnerMsg ? 'own' : 'other'}`}>
            {[['heart','❤️'],['laugh','😂'],['sad','😢']].map(([type, emoji]) => (
              <button key={type} className="chat-action-btn" onClick={() => toggleReaction(type)}
                title={type}
                style={{ color: reactions[type]?.includes(currentStudentId) ? 'var(--cyber-cyan)' : 'var(--text-muted)', fontSize: 14 }}>
                {emoji}
              </button>
            ))}
            {isOwnerMsg && (
              <button className="chat-action-btn" onClick={() => setEditing(true)} title="Edit">
                <i className="fa-solid fa-pen"></i>
              </button>
            )}
            {isOwnerMsg && !canDelete && (
              <button className="chat-action-btn" onClick={() => onDelete(m.id)} title="Unsend"
                style={{ color: 'var(--cyber-yellow)' }}>
                <i className="fa-solid fa-rotate-left"></i>
              </button>
            )}
            {canDelete && (
              <button className="chat-action-btn" onClick={() => onDelete(m.id)} title="Delete"
                style={{ color: 'var(--red)' }}>
                <i className="fa-solid fa-trash-can"></i>
              </button>
            )}
            {onReport && !isOwnerMsg && (
              <button className="chat-action-btn" title="Report this message"
                onClick={() => onReport({ type: 'message', id: m.id, preview: m.content, reportedUserId: m.student_id })}
                style={{ color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-flag"></i>
              </button>
            )}
          </div>
        )}

        {Object.entries(reactions).some(([, users]) => users.length > 0) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: isOwnerMsg ? 'flex-end' : 'flex-start' }}>
            {[['heart','❤️'],['laugh','😂'],['sad','😢']].map(([type, emoji]) =>
              reactions[type]?.length > 0 ? (
                <button key={type} onClick={() => toggleReaction(type)}
                  style={{ background: reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '2px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}>
                  {emoji} <span style={{ fontSize: 11 }}>{reactions[type].length}</span>
                </button>
              ) : null
            )}
          </div>
        )}

        {isOwnerMsg && !editing && (
          <div className="chat-meta own">
            {m.edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
            <span className="chat-time">{time}</span>
          </div>
        )}
      </div>

      {isOwnerMsg && (
        <div className="chat-avatar own" style={{ background: tagColor }}>{initials}</div>
      )}
    </div>
  );
}

// Icon options per category
const CATEGORY_ICONS = {
  academic: [
    { icon: 'fa-solid fa-graduation-cap', label: 'Graduation' },
    { icon: 'fa-solid fa-book-open',      label: 'Book' },
    { icon: 'fa-solid fa-flask',          label: 'Science' },
    { icon: 'fa-solid fa-chalkboard',     label: 'Chalkboard' },
  ],
  project: [
    { icon: 'fa-solid fa-diagram-project', label: 'Diagram' },
    { icon: 'fa-solid fa-code',            label: 'Code' },
    { icon: 'fa-solid fa-rocket',          label: 'Rocket' },
    { icon: 'fa-solid fa-lightbulb',       label: 'Idea' },
  ],
  hobby: [
    { icon: 'fa-solid fa-gamepad',         label: 'Gaming' },
    { icon: 'fa-solid fa-music',           label: 'Music' },
    { icon: 'fa-solid fa-palette',         label: 'Art' },
    { icon: 'fa-solid fa-camera',          label: 'Photo' },
  ],
  social: [
    { icon: 'fa-solid fa-user-group',      label: 'Group' },
    { icon: 'fa-solid fa-heart',           label: 'Heart' },
    { icon: 'fa-solid fa-star',            label: 'Star' },
    { icon: 'fa-solid fa-fire',            label: 'Fire' },
  ],
};

// â”€â”€ CREATE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CreateModal({ onClose, onCreated, userId }) {
  const [form, setForm] = useState({ name: '', description: '', category: 'academic', icon: 'fa-solid fa-graduation-cap' });
  const [loading, setLoading] = useState(false);

  const handleCategoryChange = (cat) => {
    // Auto-select first icon of new category
    const firstIcon = CATEGORY_ICONS[cat]?.[0]?.icon || 'fa-solid fa-graduation-cap';
    setForm(f => ({ ...f, category: cat, icon: firstIcon }));
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('communities')
      .insert([{ name: form.name.trim(), description: form.description.trim(), category: form.category, icon: form.icon, creator_id: userId, is_official: false }])
      .select();
    setLoading(false);
    if (error) { alert('Failed to create circle.'); return; }
    onCreated(data[0]);
    onClose();
  };

  const icons = CATEGORY_ICONS[form.category] || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Create New Circle</h3>
        <div className="input-group">
          <label>CIRCLE NAME</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BSIT 3A Team" />
        </div>
        <div className="input-group">
          <label>CLASSIFICATION</label>
          <select value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            <option value="academic">Academic / Study Group</option>
            <option value="project">Special Project / Capstone</option>
            <option value="hobby">Hobby / Interest</option>
            <option value="social">Social / Hangout</option>
          </select>
        </div>

        {/* Icon picker */}
        <div className="input-group">
          <label>CIRCLE ICON</label>
          <div className="icon-picker">
            {icons.map(opt => (
              <button
                key={opt.icon}
                type="button"
                className={`icon-pick-btn ${form.icon === opt.icon ? 'selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, icon: opt.icon }))}
                title={opt.label}
              >
                <i className={opt.icon}></i>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="input-group">
          <label>DESCRIPTION</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Briefly describe this circle's purpose..." />
        </div>
        <div className="modal-actions">
          <button className="cyber-btn" onClick={submit} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'CREATING...' : 'CREATE CIRCLE'}
          </button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// rank_level: 0=Member, 1=Moderator, 2=Co-Leader, 3=Leader/Founder
function rankLabel(level) {
  return ['Member', 'Moderator', 'Co-Leader', 'Leader'][level ?? 0] || 'Member';
}
function rankColor(level) {
  if (level >= 3) return 'var(--cyber-yellow)';
  if (level >= 2) return 'var(--cyber-cyan)';
  if (level >= 1) return 'var(--green)';
  return 'var(--text-muted)';
}

// â”€â”€ MEMBER CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MemberCard({ m, onSetRank, onKick, coLeaderCount, moderatorCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const name = m.profiles?.full_name || '"”';
  const initials = name !== '"”'
    ? name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ranks = [
    { level: 2, label: 'Co-Leader',  capped: coLeaderCount >= 2 },
    { level: 1, label: 'Moderator',  capped: moderatorCount >= 3 },
    { level: 0, label: 'Member',     capped: false },
  ].filter(r => r.level !== m.rank_level);

  return (
    <div className="member-card">
      <div className="member-card-avatar">{initials}</div>
      <div className="member-card-info">
        <div className="member-card-name">{name}</div>
        <div className="member-card-sub">
          <span style={{ color: rankColor(m.rank_level), fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {rankLabel(m.rank_level)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
            {m.profiles?.student_id}
          </span>
        </div>
      </div>
      <div className="member-card-actions" ref={menuRef}>
        <button className="member-card-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
        {menuOpen && (
          <div className="member-card-dropdown">
            {ranks.map(r => (
              <button
                key={r.level}
                onClick={() => { if (!r.capped) { onSetRank(m.id, r.level); setMenuOpen(false); } }}
                style={{ opacity: r.capped ? 0.4 : 1, cursor: r.capped ? 'not-allowed' : 'pointer' }}
                title={r.capped ? `Cap reached` : ''}
              >
                <i className={`fa-solid ${r.level > m.rank_level ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                Set as {r.label}
                {r.capped && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--red)' }}>FULL</span>}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
            <button onClick={() => { onKick(m.id, name); setMenuOpen(false); }} style={{ color: 'var(--red)' }}>
              <i className="fa-solid fa-user-xmark"></i> Kick from Circle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ MANAGE GROUP MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ManageGroupModal({ comm, onClose, onSaved, viewerIsOwner }) {
  const [form, setForm] = useState({ name: comm.name, description: comm.description || '', category: comm.category || 'academic' });
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leader, setLeader] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(viewerIsOwner ? 'settings' : 'members');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResult, setInviteResult] = useState(null); // { id, full_name, student_id }
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    // fetch leader profile
    const { data: leaderData } = await supabase
      .from('profiles')
      .select('full_name, student_id')
      .eq('id', comm.creator_id)
      .single();
    if (leaderData) setLeader(leaderData);

    const { data } = await supabase
      .from('memberships')
      .select('*, profiles(full_name, student_id)')
      .eq('community_id', comm.id);
    if (data) {
      setMembers(data.filter(m => m.status === 'active'));
      setRequests(data.filter(m => m.status === 'pending'));
    }
    setLoadingMembers(false);
  }, [comm.id, comm.creator_id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const saveSettings = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('communities')
      .update({ name: form.name.trim(), description: form.description.trim(), category: form.category })
      .eq('id', comm.id);
    setSaving(false);
    if (error) { alert('Failed to save.'); return; }
    onSaved({ ...comm, ...form });
    onClose();
  };

  const approveRequest = async (memberId) => {
    const member = requests.find(r => r.id === memberId);
    const { error } = await supabase.from('memberships')
      .update({ status: 'active' }).eq('id', memberId);
    if (!error) {
      // Send notification to the applicant
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'join_approved',
          message: `Your request to join "${comm.name}" has been approved!`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
  };

  const denyRequest = async (memberId) => {
    const member = requests.find(r => r.id === memberId);
    const { error } = await supabase.from('memberships').delete().eq('id', memberId);
    if (!error) {
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'join_denied',
          message: `Your request to join "${comm.name}" was not approved.`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
  };

  const kickMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this group?`)) return;
    const member = members.find(m => m.id === memberId);
    const { error } = await supabase.from('memberships').delete().eq('id', memberId);
    if (!error) {
      if (member?.user_id) {
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'kicked',
          message: `You have been removed from "${comm.name}".`,
        }]);
      }
      fetchMembers();
    }
  };

  const setRank = async (memberId, level) => {
    if (level === 2 && members.filter(m => m.rank_level === 2).length >= 2) {
      alert('This circle already has 2 Co-Leaders. Demote one first.'); return;
    }
    if (level === 1 && members.filter(m => m.rank_level === 1).length >= 3) {
      alert('This circle already has 3 Moderators. Demote one first.'); return;
    }
    const member = members.find(m => m.id === memberId);
    const { error } = await supabase.from('memberships')
      .update({ rank_level: level }).eq('id', memberId);
    if (!error) {
      if (member?.user_id && level > (member.rank_level ?? 0)) {
        const labels = ['Member', 'Moderator', 'Co-Leader'];
        await supabase.from('notifications').insert([{
          user_id: member.user_id,
          type: 'promoted',
          message: `You've been promoted to ${labels[level]} in "${comm.name}"!`,
          link_comm_id: comm.id,
        }]);
      }
      fetchMembers();
    }
  };

  const searchInviteStudent = async () => {
    if (!inviteSearch.trim()) return;
    setInviteSearching(true);
    setInviteResult(null);
    const { data } = await supabase.from('profiles')
      .select('id, full_name, student_id')
      .ilike('student_id', `%${inviteSearch.trim()}%`)
      .limit(1)
      .single();
    setInviteResult(data || null);
    setInviteSearching(false);
  };

  const inviteMember = async () => {
    if (!inviteResult) return;
    setInviting(true);
    // Check if already a member
    const { data: existing } = await supabase.from('memberships')
      .select('id, status')
      .eq('community_id', comm.id)
      .eq('user_id', inviteResult.id)
      .maybeSingle();
    if (existing) {
      alert(existing.status === 'active' ? 'This student is already a member.' : 'This student already has a pending request.');
      setInviting(false);
      return;
    }
    const { error } = await supabase.from('memberships').insert([{
      community_id: comm.id,
      user_id: inviteResult.id,
      rank_level: 0,
      status: 'active',
    }]);
    if (!error) {
      await supabase.from('notifications').insert([{
        user_id: inviteResult.id,
        type: 'invite_accepted',
        message: `You have been personally invited to join "${comm.name}"!`,
        link_comm_id: comm.id,
      }]);
      setInviteSearch('');
      setInviteResult(null);
      fetchMembers();
      alert(`${inviteResult.full_name} has been invited and added to the circle!`);
    } else {
      alert('Failed to invite member.');
    }
    setInviting(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manage-modal-box" onClick={e => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h2><i className="fa-solid fa-gear" style={{ marginRight: 10 }}></i>GROUP SETTINGS</h2>
          <button className="manage-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="manage-tabs">
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              <i className="fa-solid fa-sliders"></i> Settings
            </button>
          )}
          <button className={`manage-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            <i className="fa-solid fa-users"></i> Members {members.length > 0 && `(${members.length})`}
          </button>
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              <i className="fa-solid fa-user-clock"></i> Requests
              {requests.length > 0 && <span className="req-badge">{requests.length}</span>}
            </button>
          )}
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'audition' ? 'active' : ''}`} onClick={() => setTab('audition')}>
              <i className="fa-solid fa-microphone"></i> Audition
            </button>
          )}
          {viewerIsOwner && (
            <button className={`manage-tab ${tab === 'invite' ? 'active' : ''}`} onClick={() => setTab('invite')}>
              <i className="fa-solid fa-user-plus"></i> Invite
            </button>
          )}
        </div>

        {tab === 'settings' && (
          <div className="manage-tab-content">
            <div className="input-group">
              <label>CIRCLE NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>CLASSIFICATION</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="academic">Academic / Study Group</option>
                <option value="project">Special Project / Capstone</option>
                <option value="hobby">Hobby / Interest</option>
                <option value="social">Social / Hangout</option>
              </select>
            </div>
            <div className="input-group">
              <label>DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this node's purpose..." />
            </div>
            <div className="modal-actions">
              <button className="cyber-btn" onClick={saveSettings} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'SAVING...' : <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>SAVE CHANGES</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>CANCEL</button>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <div className="manage-tab-content" style={{ padding: 0 }}>
            {/* Leader profile banner */}
            <div className="members-banner">
              <div className="members-banner-avatar">
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
                  {leader?.full_name
                    ? leader.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                    : '?'}
                </span>
              </div>
              <div className="members-banner-name">{leader?.full_name || '"”'}</div>
              <div className="members-banner-handle">
                <span style={{ color: 'var(--cyber-yellow)', fontSize: 11, border: '1px solid var(--cyber-yellow)', padding: '2px 10px', borderRadius: 20 }}>
                  Leader / Founder
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>
                {leader?.student_id}
              </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              {loadingMembers ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading members...</p>
              ) : members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No active members yet.</p>
              ) : (
                <>
                  {(() => {
                    const coLeaderCount = members.filter(m => m.rank_level === 2).length;
                    const moderatorCount = members.filter(m => m.rank_level === 1).length;
                    return [
                      { label: 'Co-Leaders', filter: m => m.rank_level === 2, cap: 2 },
                      { label: 'Moderators', filter: m => m.rank_level === 1, cap: 3 },
                      { label: 'Members',    filter: m => m.rank_level === 0, cap: null },
                    ].map(({ label, filter, cap }) => {
                      const group = members.filter(filter);
                      if (group.length === 0) return null;
                      return (
                        <div key={label}>
                          <div className="members-section-label">
                            <span>{label}</span>
                            <span style={{ color: cap && group.length >= cap ? 'var(--red)' : 'var(--cyber-cyan)', fontSize: 11 }}>
                              {group.length}{cap ? `/${cap}` : ''}
                            </span>
                          </div>
                          {group.map(m => (
                            <MemberCard
                              key={m.id} m={m}
                              onSetRank={setRank} onKick={kickMember}
                              coLeaderCount={coLeaderCount}
                              moderatorCount={moderatorCount}
                            />
                          ))}
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="manage-tab-content">
            {loadingMembers ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading...</p>
            ) : requests.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No pending join requests.</p>
            ) : (
              <table className="members-table">
                <thead><tr><th>NAME</th><th>STUDENT ID</th><th>ACTION</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{r.profiles?.full_name || '"”'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--cyber-cyan)' }}>{r.profiles?.student_id || '"”'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="member-action-btn promote" onClick={() => approveRequest(r.id)}><i className="fa-solid fa-check"></i> Approve</button>
                          <button className="member-action-btn kick" onClick={() => denyRequest(r.id)}><i className="fa-solid fa-xmark"></i> Deny</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'audition' && viewerIsOwner && (
          <div className="manage-tab-content">
            <AuditionFormBuilder
              comm={comm}
              onToggle={(enabled) => onSaved({ ...comm, audition_enabled: enabled })}
            />
            {comm.audition_enabled && (
              <>
                <div className="audition-section-label" style={{ marginTop: 24 }}>
                  <span>Applications Received</span>
                </div>
                <AuditionReviewPanel comm={comm} />
              </>
            )}
          </div>
        )}

        {tab === 'invite' && viewerIsOwner && (
          <div className="manage-tab-content">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyber-cyan)', marginBottom: 6 }}>
                <i className="fa-solid fa-user-plus" style={{ marginRight: 8 }}></i>Personal Invite
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Search for a CTU student by their Student ID and invite them directly into the circle, bypassing the audition process.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="channel-name-input"
                style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                placeholder="Enter Student ID (e.g. 2024-CTU-DB-001)"
                value={inviteSearch}
                onChange={e => setInviteSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchInviteStudent()}
              />
              <button className="cyber-btn" style={{ padding: '8px 16px', fontSize: 12 }}
                onClick={searchInviteStudent} disabled={inviteSearching}>
                {inviteSearching ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </div>

            {inviteResult === null && inviteSearch.trim() && !inviteSearching && (
              <p style={{ fontSize: 12, color: 'var(--red)', padding: '10px 0' }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: 6 }}></i>No student found with that ID.
              </p>
            )}

            {inviteResult && (
              <div style={{
                background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)',
                borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div className="member-card-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                  {(inviteResult.full_name || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{inviteResult.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontFamily: 'monospace', marginTop: 2 }}>{inviteResult.student_id}</div>
                </div>
                <button className="cyber-btn" style={{ padding: '8px 18px', fontSize: 12 }}
                  onClick={inviteMember} disabled={inviting}>
                  {inviting ? 'Inviting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Invite</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ PROFILE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INTEREST_LABELS = {
  art: '🎨 Art', coding: '💻 Coding', design: '🎨 Design', gaming: '🎮 Gaming',
  music: '🎵 Music', sports: '⚽ Sports', research: '🔬 Research',
  photography: '📷 Photography', writing: '✍ Writing', travel: '✈ Travel',
  debate: '🎤 Debate', language: '🌐 Language Learning', anime: '🎌 Anime',
  bxgl: '🏳️‍🌈 Watching BL/GL',
};
const INTEREST_BUBBLES = Object.entries(INTEREST_LABELS).map(([id, label]) => ({ id, label }));
const COURSES = ['BEED','BIT AUTO TECH','BIT COM TECH','BIT ELEC TECH','BSED MATH','BSFI','BSHM','BSIE','BSIT','BTLED-HE'];

function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || user.avatar_url || null);
  const fileInputRef = useRef(null);
  const idPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploaded, setIdUploaded] = useState(!!user.id_photo_url);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ course: user.course || '', year_level: user.year_level || '', interests: user.interests || [] });
  const [profile, setProfile] = useState({ course: user.course || '', year_level: user.year_level || '', interests: user.interests || [] });

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data, error } = await supabase.from('profiles')
        .select('course, year_level, interests, avatar_url, id_photo_url')
        .eq('id', user.id).single();
      if (!error && data) {
        setProfile({ course: data.course || '', year_level: data.year_level || '', interests: data.interests || [] });
        setEditForm({ course: data.course || '', year_level: data.year_level || '', interests: data.interests || [] });
        if (data.avatar_url && !avatarUrl) setAvatarUrl(data.avatar_url);
        if (data.id_photo_url) setIdUploaded(true);
      }
    };
    load();
  }, [user?.id]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/update-profile?userId=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: editForm.course, year_level: editForm.year_level, interests: editForm.interests }),
      });
      if (res.ok) {
        setProfile({ ...editForm });
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, ...editForm }));
        setEditing(false);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleIdPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIdUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise(r => { reader.onload = e => r(e.target.result); reader.readAsDataURL(file); });
      const { error } = await supabase.from('profiles').update({ id_photo_url: dataUrl }).eq('id', user.id);
      if (!error) { setIdUploaded(true); }
    } catch (err) { console.error(err); }
    finally { setIdUploading(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      // Resize + compress to â‰¤200px JPEG before uploading
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Show preview immediately
      setAvatarUrl(compressed);
      onAvatarUpdate(compressed);

      const res = await fetch(`/api/upload-avatar?userId=${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar: compressed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Avatar upload failed:', err);
        // Save to localStorage as fallback so it survives the session
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: compressed }));
        return;
      }

      const { url } = await res.json();
      // Saved to DB "” update localStorage with the persisted value
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: url }));
    } catch (err) {
      console.error('Avatar upload error:', err);
      // Save locally as last resort
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: stored.avatar_url || null }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
        {/* Avatar with edit button */}
        <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 15px' }}>
          <div style={{
            width: 90, height: 90,
            border: '2px solid var(--cyber-cyan)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 'bold',
            color: 'var(--cyber-cyan)',
            overflow: 'hidden',
            background: 'rgba(0,240,255,0.05)',
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
          {/* Camera edit button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Change profile picture"
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--cyber-cyan)', color: '#000',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {uploading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <i className="fa-solid fa-camera" />
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </div>

        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{user.full_name?.toUpperCase()}</h2>
        {user.is_verified ? (
          <div className="verified-badge" style={{ margin: '0 auto 20px' }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i> Verified {user.user_type || 'Student'} âœ“
          </div>
        ) : (
          <div className="verified-badge" style={{ margin: '0 auto 20px', borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}>
            <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i> Pending Verification
          </div>
        )}
        <div className="stats-card" style={{ textAlign: 'left', marginBottom: 20 }}>
          <div className="stat-line"><span>STUDENT ID</span><span className="stat-val" style={{ color: 'var(--cyber-yellow)', fontFamily: 'monospace' }}>{user.student_id}</span></div>
          <div className="stat-line"><span>ACTIVE CIRCLES</span><span className="stat-val">{communities.length}</span></div>
          {profile.course && <div className="stat-line"><span>COURSE</span><span className="stat-val">{profile.course}</span></div>}
          {profile.year_level && <div className="stat-line"><span>YEAR</span><span className="stat-val">{profile.year_level}</span></div>}
        </div>

        {!editing && profile.interests?.length > 0 && (
          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>INTERESTS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.interests.map(id => (
                <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', color: 'var(--cyber-cyan)' }}>
                  {INTEREST_LABELS[id] || id}
                </span>
              ))}
            </div>
          </div>
        )}

        {editing && (
          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, display: 'block', marginBottom: 6 }}>COURSE</label>
              <select value={editForm.course} onChange={e => setEditForm(f => ({ ...f, course: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, color: 'white', padding: '8px 10px', fontSize: 13 }}>
                <option value="">Select course</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, display: 'block', marginBottom: 6 }}>YEAR LEVEL</label>
              <select value={editForm.year_level} onChange={e => setEditForm(f => ({ ...f, year_level: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, color: 'white', padding: '8px 10px', fontSize: 13 }}>
                <option value="">Select year</option>
                {['1st Year','2nd Year','3rd Year','4th Year','Graduate'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, display: 'block', marginBottom: 8 }}>INTERESTS</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {INTEREST_BUBBLES.map(({ id, label }) => (
                  <span key={id} onClick={() => setEditForm(f => ({ ...f, interests: f.interests.includes(id) ? f.interests.filter(i => i !== id) : [...f.interests, id] }))}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                      background: editForm.interests.includes(id) ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${editForm.interests.includes(id) ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
                      color: editForm.interests.includes(id) ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!user.is_verified && (
          <div style={{ textAlign: 'left', marginBottom: 16, padding: '12px 14px', background: 'rgba(247,169,79,0.06)', border: '1px solid rgba(247,169,79,0.25)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              <i className="fa-solid fa-id-card" style={{ marginRight: 6 }} />SCHOOL ID VERIFICATION
            </div>
            {idUploaded && (
              <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />ID photo submitted — awaiting admin review
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              {idUploaded ? 'Want to send a clearer photo? Upload a new one below.' : 'Upload a clear photo of your CTU school ID so the admin can verify your account.'}
            </p>
            <button className="cyber-btn" onClick={() => idPhotoRef.current?.click()} disabled={idUploading}
              style={{ width: '100%', background: 'rgba(247,169,79,0.15)', borderColor: 'var(--orange)', color: 'var(--orange)' }}>
              {idUploading ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />UPLOADING...</>
                : <><i className="fa-solid fa-upload" style={{ marginRight: 6 }} />{idUploaded ? 'RE-UPLOAD SCHOOL ID' : 'UPLOAD SCHOOL ID'}</>}
            </button>
            <input ref={idPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdPhotoUpload} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!editing
            ? <button className="cyber-btn" onClick={() => setEditing(true)} style={{ width: '100%' }}><i className="fa-solid fa-pen" style={{ marginRight: 6 }} />EDIT PROFILE</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button className="cyber-btn secondary" onClick={() => setEditing(false)} style={{ flex: 1 }}>CANCEL</button>
                <button className="cyber-btn" onClick={saveProfile} disabled={saving} style={{ flex: 1 }}>
                  {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />SAVING...</> : 'SAVE'}
                </button>
              </div>
          }
          <button className="cyber-btn danger" onClick={onLogout} style={{ width: '100%' }}>TERMINATE SESSION</button>
          <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ AUDITION DETAIL MODAL (applicant view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AuditionDetailModal({ data, onClose }) {
  const { response: r, community: c, questions } = data;
  const statusColor = auditionStatusColor(r.status, r.phase2_result);
  const statusLabel = auditionStatusLabel(r.status, r.phase2_result);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3><i className="fa-solid fa-microphone" style={{ marginRight: 8 }}></i>My Application "” {c.name}</h3>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px', background: `${statusColor}10`, border: `1px solid ${statusColor}40`, borderRadius: 8 }}>
          <i className="fa-solid fa-circle-info" style={{ color: statusColor }}></i>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: statusColor }}>{statusLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Submitted {new Date(r.submitted_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Phase 2 details */}
        {r.status === 'phase2' && r.phase2_details && (
          <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--cyber-yellow)', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              <i className="fa-solid fa-calendar" style={{ marginRight: 6 }}></i>PHASE 2 "” LIVE SCREENING
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{r.phase2_details}</p>
          </div>
        )}

        {/* Leader feedback */}
        {r.feedback && (
          <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              <i className="fa-solid fa-comment" style={{ marginRight: 6 }}></i>FEEDBACK FROM LEADER
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{r.feedback}</p>
          </div>
        )}

        {/* Submitted answers */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
          Your Submitted Answers
        </div>
        {questions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No questions on record.</p>
        ) : (
          questions.map(q => (
            <div key={q.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{q.question}</div>
              {q.type === 'file' ? (
                r.answers[q.id]
                  ? <a href={r.answers[q.id]} target="_blank" rel="noreferrer" style={{ color: 'var(--cyber-cyan)', fontSize: 13 }}>
                      <i className="fa-solid fa-file" style={{ marginRight: 6 }}></i>View uploaded file
                    </a>
                  : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No file uploaded</span>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {r.answers?.[q.id] || '"”'}
                </div>
              )}
            </div>
          ))
        )}

        <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', marginTop: 8 }}>CLOSE</button>
      </div>
    </div>
  );
}

async function autoFlagContent({ reporterId, reportedUserId, contentType, contentId, contentPreview }) {
  // Create the report only "” admin reviews and decides on formal warnings
  await supabase.from('reports').insert([{
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    content_type: contentType,
    content_id: contentId,
    content_preview: contentPreview?.slice(0, 200),
    reason: 'Auto-detected: inappropriate language',
    status: 'pending',
  }]);
  // Send a mild alert to the user (no point deduction "” admin decides that)
  if (reportedUserId) {
    await supabase.from('notifications').insert([{
      user_id: reportedUserId,
      type: 'audition_update',
      message: 'Your message was flagged for inappropriate language and blocked. Please follow community guidelines.',
    }]);
  }
}

// â”€â”€ REPORT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReportModal({ data, user, onClose }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const REASONS = [
    'Inappropriate language / profanity',
    'Harassment or bullying',
    'Spam or irrelevant content',
    'Misinformation',
    'Hate speech or discrimination',
    'Other',
  ];

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    await supabase.from('reports').insert([{
      reporter_id: user.id,
      reported_user_id: data.reportedUserId || null,
      content_type: data.type,
      content_id: data.id,
      content_preview: data.preview?.slice(0, 200),
      reason,
      status: 'pending',
    }]);
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 36, color: 'var(--green)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--green)', marginBottom: 8 }}>Report Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Thank you. The admin will review this report.
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6 }}>
              <i className="fa-solid fa-flag" style={{ marginRight: 8, color: 'var(--red)' }}></i>
              Report {data.type === 'message' ? 'Message' : 'Post'}
            </h3>
            {data.preview && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontStyle: 'italic' }}>
                "{data.preview.slice(0, 120)}{data.preview.length > 120 ? '...' : ''}"
              </div>
            )}
            <div className="input-group">
              <label>REASON FOR REPORT</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REASONS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: reason === r ? 'var(--text-primary)' : 'var(--text-muted)', padding: '8px 12px', borderRadius: 8, border: `1px solid ${reason === r ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.08)'}`, background: reason === r ? 'rgba(0,240,255,0.06)' : 'transparent', transition: '0.15s' }}>
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: 'var(--cyber-cyan)' }} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason}
                style={{ flex: 1, background: 'rgba(247,95,95,0.15)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                {submitting ? 'Submitting...' : <><i className="fa-solid fa-flag" style={{ marginRight: 6 }}></i>Submit Report</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// â”€â”€ MAIN PORTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function UserPortal() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const [communities, setCommunities] = useState([GLOBAL_COMM]);
  const [myMemberships, setMyMemberships] = useState([]); // { community_id, role, status }
  const [activeCommId, setActiveCommId] = useState('global');
  const [section, setSection] = useState('home');
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [circleChatMessages, setCircleChatMessages] = useState([]);
  const [circleChatInput, setCircleChatInput] = useState('');
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showAuditionForm, setShowAuditionForm] = useState(null); // { comm, audition? }
  const [myAuditions, setMyAuditions] = useState([]);
  const [viewingAudition, setViewingAudition] = useState(null); // { response, community, questions }
  const [search, setSearch] = useState('');
  const [clock, setClock] = useState(new Date());
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [feedFilter, setFeedFilter] = useState('all'); // filter for home feed post types
  const [announcements, setAnnouncements] = useState([]);
  const [circleAnnouncements, setCircleAnnouncements] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''] });
  const [newCirclePost, setNewCirclePost] = useState({ title: '', content: '', post_type: 'announcement', pollOptions: ['', ''] });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [showCircleAnnouncements, setShowCircleAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const toastTimer = useRef(null);
  const feedBottomRef = useRef(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(loadTheme);
  const [showReport, setShowReport] = useState(null); // { type, id, preview, reportedUserId }
  const [sendError, setSendError] = useState(''); // inline error for bad word block
  const [navAvatarUrl, setNavAvatarUrl] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return stored?.avatar_url || null;
  });

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const loadCommunities = useCallback(async () => {
    const { data } = await supabase.from('communities').select('*');
    setCommunities([GLOBAL_COMM, ...(data || [])]);
  }, []);

  const loadChannels = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setChannels([]); setActiveChannelId(null); return; }
    const { data } = await supabase.from('channels').select('*')
      .eq('community_id', commId).order('created_at', { ascending: true });
    const list = data || [];
    setChannels(list);
    setActiveChannelId(prev => list.find(c => c.id === prev) ? prev : (list[0]?.id || null));
  }, []);

  const loadMyMemberships = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('memberships')
      .select('community_id, rank_level, status, id')
      .eq('user_id', user.id);
    setMyMemberships(data || []);
  }, [user?.id]);

  const loadMyAuditions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('audition_responses')
      .select('community_id, status, phase2_result, id')
      .eq('applicant_id', user.id);
    setMyAuditions(data || []);
  }, [user?.id]);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase.from('announcements')
      .select('*')
      .is('community_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }, []);

  const loadCircleAnnouncements = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleAnnouncements([]); return; }
    const { data } = await supabase.from('announcements')
      .select('*')
      .eq('community_id', commId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setCircleAnnouncements(data || []);
  }, []);

  const postAnnouncement = async () => {
    if (!newPost.title.trim()) return;
    if (newPost.post_type !== 'poll' && !newPost.content.trim()) return;
    if (newPost.post_type === 'poll') {
      const validOptions = newPost.pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) { alert('A poll needs at least 2 options.'); return; }
    }
    const allowedTypes = ['announcement', 'event', 'shoutout', 'general', 'poll'];
    const type = allowedTypes.includes(newPost.post_type) ? newPost.post_type : 'general';
    setPostingAnnouncement(true);
    const pollOptions = type === 'poll' ? newPost.pollOptions.filter(o => o.trim()) : null;
    const { error } = await supabase.from('announcements').insert([{
      author_id: user.id,
      author_name: newPost.anonymous ? 'Anonymous' : user.full_name,
      author_type: newPost.anonymous ? 'Anonymous' : user.user_type,
      title: newPost.title.trim(),
      content: newPost.content.trim(),
      post_type: type,
      community_id: null,
      ...(pollOptions ? { poll_options: pollOptions, poll_votes: {} } : {}),
    }]);
    setPostingAnnouncement(false);
    if (!error) {
      // Auto-flag if bad word detected in title or content
      if (containsBadWord(newPost.title) || containsBadWord(newPost.content)) {
        const { data: inserted } = await supabase.from('announcements')
          .select('id').order('created_at', { ascending: false }).limit(1).single();
        if (inserted) {
          await autoFlagContent({
            reporterId: user.id, reportedUserId: user.id,
            contentType: 'announcement', contentId: inserted.id,
            contentPreview: `${newPost.title}: ${newPost.content}`,
          });
        }
      }
      setNewPost({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''] });
      loadAnnouncements();
    }
  };

  const postCircleAnnouncement = async (commId) => {
    if (!newCirclePost.title.trim()) return;
    if (newCirclePost.post_type !== 'poll' && !newCirclePost.content.trim()) return;
    if (newCirclePost.post_type === 'poll') {
      const valid = newCirclePost.pollOptions.filter(o => o.trim());
      if (valid.length < 2) { alert('A poll needs at least 2 options.'); return; }
    }
    setPostingAnnouncement(true);
    const pollOptions = newCirclePost.post_type === 'poll'
      ? newCirclePost.pollOptions.filter(o => o.trim()) : null;
    const { error } = await supabase.from('announcements').insert([{
      author_id: user.id,
      author_name: user.full_name,
      author_type: user.user_type,
      title: newCirclePost.title.trim(),
      content: newCirclePost.content.trim(),
      post_type: newCirclePost.post_type,
      community_id: commId,
      ...(pollOptions ? { poll_options: pollOptions, poll_votes: {} } : {}),
    }]);
    setPostingAnnouncement(false);
    if (!error) {
      setNewCirclePost({ title: '', content: '', post_type: 'announcement', pollOptions: ['', ''] });
      loadCircleAnnouncements(commId);

      // Notify all active members
      const { data: members } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('community_id', commId)
        .eq('status', 'active')
        .neq('user_id', user.id);

      if (members && members.length > 0) {
        const comm = communities.find(c => c.id === commId);
        const notifs = members.map(m => ({
          user_id: m.user_id,
          type: 'new_announcement',
          message: `New ${newCirclePost.post_type === 'poll' ? 'poll' : 'announcement'} in "${comm?.name || 'a circle'}": ${newCirclePost.title.trim()}`,
          link_comm_id: commId,
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  };

  const togglePin = async (id, pinned) => {
    await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id);
    loadAnnouncements();
  };

  const handleVote = async (announcementId, option, currentVotes) => {
    if (!user?.id) return;
    // Remove user from any existing option, add to chosen option
    const updated = { ...currentVotes };
    Object.keys(updated).forEach(opt => {
      updated[opt] = (updated[opt] || []).filter(id => id !== user.id);
    });
    updated[option] = [...(updated[option] || []), user.id];
    await supabase.from('announcements').update({ poll_votes: updated }).eq('id', announcementId);
    loadAnnouncements();
  };

  const handleCircleVote = async (announcementId, option, currentVotes) => {
    if (!user?.id) return;
    const updated = { ...currentVotes };
    Object.keys(updated).forEach(opt => {
      updated[opt] = (updated[opt] || []).filter(id => id !== user.id);
    });
    updated[option] = [...(updated[option] || []), user.id];
    await supabase.from('announcements').update({ poll_votes: updated }).eq('id', announcementId);
    loadCircleAnnouncements(activeCommId);
  };

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    setNotifications(data || []);
  }, [user?.id]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const loadMessages = useCallback(async (commId, channelId) => {
    if (commId === 'global') {
      const { data } = await supabase.from('messages').select('*')
        .is('community_id', null).order('created_at', { ascending: true });
      setMessages(data || []);
    } else if (channelId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('channel_id', channelId).order('created_at', { ascending: true });
      setMessages(data || []);
    } else if (commId) {
      // No channel selected "” load all messages for this community
      const { data } = await supabase.from('messages').select('*')
        .eq('community_id', commId)
        .is('channel_id', null)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } else {
      setMessages([]);
    }
  }, []);

  const loadCircleChatMessages = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleChatMessages([]); return; }
    const { data } = await supabase.from('messages').select('*')
      .eq('community_id', commId)
      .is('channel_id', null)
      .order('created_at', { ascending: true });
    setCircleChatMessages(data || []);
  }, []);

  // Initial load + realtime subscription "” re-runs when channel/community changes
  useEffect(() => {
    loadMessages(activeCommId, activeChannelId);

    // Build a unique channel name per context
    const channelName = activeCommId === 'global'
      ? 'realtime:messages:global'
      : `realtime:messages:${activeChannelId || activeCommId}`;

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          // Only add if it belongs to the current view
          const isGlobal = activeCommId === 'global' && !msg.community_id;
          const isChannel = msg.channel_id === activeChannelId;
          const isCommunityNoChannel = activeCommId !== 'global' && !activeChannelId && msg.community_id === activeCommId && !msg.channel_id;
          if (isGlobal || isChannel || isCommunityNoChannel) {
            setMessages(prev => {
              // Avoid duplicates (our own sent message is already in state)
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [activeCommId, activeChannelId, loadMessages]);

  useEffect(() => { loadCommunities(); loadMyMemberships(); loadMyAuditions(); loadAnnouncements(); loadNotifications(); }, [loadCommunities, loadMyMemberships, loadMyAuditions, loadAnnouncements, loadNotifications]);

  // Reload channels and circle announcements whenever the active community changes
  useEffect(() => {
    loadChannels(activeCommId);
    loadCircleAnnouncements(activeCommId);
    setShowCircleAnnouncements(false);
    // Reset circle-chat section when switching communities
    setSection(prev => prev === 'circle-chat' ? 'circles' : prev);
  }, [activeCommId, loadChannels, loadCircleAnnouncements]);

  // Avatar is persisted in localStorage "” no DB sync needed on mount

  // Realtime home feed (campus-wide announcements)
  useEffect(() => {
    const sub = supabase.channel('rt:announcements:global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          if (!payload.new.community_id) {
            setAnnouncements(prev => {
              if (prev.find(a => a.id === payload.new.id)) return prev;
              const updated = [payload.new, ...prev];
              return updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            });
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' },
        (payload) => {
          if (!payload.new.community_id) {
            setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  // Realtime notifications
  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase.channel('notifications:' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new, ...prev])
      ).subscribe();
    return () => supabase.removeChannel(sub);
  }, [user?.id]);

  // Realtime circle announcements
  useEffect(() => {
    if (!activeCommId || activeCommId === 'global') return;
    const sub = supabase.channel('announcements:' + activeCommId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements', filter: `community_id=eq.${activeCommId}` },
        (payload) => setCircleAnnouncements(prev => [payload.new, ...prev])
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => setCircleAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        (payload) => setCircleAnnouncements(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
      )
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeCommId]);

  // Circle chat "” load and realtime
  useEffect(() => {
    if (!activeCommId || activeCommId === 'global' || section !== 'circle-chat') return;
    loadCircleChatMessages(activeCommId);
    const sub = supabase.channel('circle-chat:' + activeCommId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `community_id=eq.${activeCommId}` },
        (payload) => {
          const msg = payload.new;
          if (!msg.channel_id) {
            setCircleChatMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => setCircleChatMessages(prev => prev.filter(m => m.id !== payload.old.id))
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => setCircleChatMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      )
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeCommId, section, loadCircleChatMessages]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initials = user?.full_name
    ? user.full_name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const logout = () => {
    if (confirm('TERMINATE_SESSION?')) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('accessToken');
      navigate('/auth');
    }
  };

  // Membership helpers
  const getMembership = (commId) => myMemberships.find(m => m.community_id === commId);
  const isMember = (commId) => {
    if (commId === 'global') return true;
    const comm = communities.find(c => c.id === commId);
    if (comm?.creator_id === user?.id) return true;
    const m = getMembership(commId);
    return m?.status === 'active';
  };
  const isPending = (commId) => getMembership(commId)?.status === 'pending';
  const getMyAudition = (commId) => myAuditions.find(a => a.community_id === commId);

  const requestJoin = async (commId) => {
    const { error } = await supabase.from('memberships').insert([{
      community_id: commId, user_id: user.id, rank_level: 0, status: 'pending'
    }]);
    if (!error) { await loadMyMemberships(); showToast('Request sent!'); }
    else showToast('Already requested.');
  };

  const sendPost = async () => {
    if (!msgInput.trim()) return;
    // Block bad words "” don't send, show error
    if (containsBadWord(msgInput)) {
      setSendError('âš ï¸ Your message contains inappropriate language and was not sent.');
      setTimeout(() => setSendError(''), 4000);
      // Still auto-flag for admin awareness
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: 'blocked', contentPreview: msgInput });
      return;
    }
    setSendError('');
    const comm = communities.find(c => c.id === activeCommId);
    const isLeader = comm?.creator_id === user?.id;
    const payload = {
      student_id: user.student_id,
      full_name: user.full_name,
      content: msgInput,
      community_id: activeCommId === 'global' ? null : activeCommId,
      channel_id: activeCommId === 'global' ? null : activeChannelId,
      role: isLeader ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER'),
    };
    const { data, error } = await supabase.from('messages').insert([payload]).select();
    if (!error && data) {
      setMessages(prev => [...prev, data[0]]);
      setMsgInput('');
    }
  };

  const sendCircleChatPost = async () => {
    if (!circleChatInput.trim()) return;
    if (containsBadWord(circleChatInput)) {
      setSendError('âš ï¸ Your message contains inappropriate language and was not sent.');
      setTimeout(() => setSendError(''), 4000);
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: 'blocked', contentPreview: circleChatInput });
      return;
    }
    setSendError('');
    const comm = communities.find(c => c.id === activeCommId);
    const isLeader = comm?.creator_id === user?.id;
    const payload = {
      student_id: user.student_id,
      full_name: user.full_name,
      content: circleChatInput,
      community_id: activeCommId,
      channel_id: null,
      role: isLeader ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER'),
    };
    const { data, error } = await supabase.from('messages').insert([payload]).select();
    if (!error && data) {
      setCircleChatMessages(prev => [...prev, data[0]]);
      setCircleChatInput('');
    }
  };

  const handleCommCreated = (newComm) => {
    setCommunities(prev => [...prev, newComm]);
    showToast(`Circle created: ${newComm.name}`);
  };

  const deleteCircle = async (id) => {
    if (!confirm('Delete this circle? This cannot be undone.')) return;
    const token = localStorage.getItem('accessToken');
    const params = new URLSearchParams({ id });
    if (user?.id) params.set('userId', user.id);
    try {
      const res = await fetch(`/api/delete-community?${params}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Failed to delete circle.'); return; }
      showToast('Circle deleted.');
      await loadCommunities();
      setActiveCommId('global'); setSection('home');
    } catch (err) {
      showToast('Network error "” could not delete circle.');
    }
  };

  const leaveCircle = async (commId) => {
    if (!confirm('Leave this circle? You will need to request to join again.')) return;
    const membership = getMembership(commId);
    if (!membership) return;
    const { error } = await supabase.from('memberships').delete().eq('id', membership.id);
    if (error) { showToast('Failed to leave circle.'); return; }
    showToast('You have left the circle.');
    await loadMyMemberships();
    setActiveCommId('global'); setSection('home');
  };

  const addChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    const { data, error } = await supabase.from('channels')
      .insert([{ community_id: activeCommId, name, created_by: user.id }])
      .select();
    if (!error && data) {
      setChannels(prev => [...prev, data[0]]);
      setActiveChannelId(data[0].id);
      setNewChannelName('');
      setShowAddChannel(false);
    }
  };

  const deleteChannel = async (channelId) => {
    if (!confirm('Delete this channel and all its messages?')) return;
    const { error } = await supabase.from('channels').delete().eq('id', channelId);
    if (!error) {
      const remaining = channels.filter(c => c.id !== channelId);
      setChannels(remaining);
      setActiveChannelId(remaining[0]?.id || null);
    }
  };

  const activeComm = communities.find(c => c.id === activeCommId) || GLOBAL_COMM;
  const isOwner = activeComm.creator_id === user?.id;
  const myRankLevel = getMembership(activeCommId)?.rank_level ?? (isOwner ? 3 : 0);
  const myRole = isOwner ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER');
  const canModerate = isOwner || myRankLevel >= 2; // leader or co-leader
  const tagColor = myRole === 'LEADER' ? 'var(--cyber-yellow)' : myRole === 'CO-LEADER' ? 'var(--cyber-cyan)' : 'var(--text-muted)';

  const deleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (!error) setMessages(prev => prev.filter(m => m.id !== msgId));
    else showToast('DELETE_FAILED');
  };

  const editMessage = async (msgId, newContent) => {
    const { error } = await supabase.from('messages')
      .update({ content: newContent, edited: true }).eq('id', msgId);
    if (!error) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, edited: true } : m));
    else showToast('EDIT_FAILED');
  };

  // Joined circles for dock (only active memberships + owned)
  const myCircles = communities.filter(c =>
    c.id === 'global' || c.creator_id === user?.id || isMember(c.id)
  );

  return (
    <div className="portal-layout">
      {/* PENDING BANNER */}
      {!user?.is_verified && (
        <div className="pending-banner">
          <i className="fa-solid fa-clock" style={{ marginRight: 8 }}></i>
          Your account is pending admin verification. You can browse but cannot post, message, or join circles yet.
        </div>
      )}

      {/* TOP NAV */}
      <nav className="top-nav-bar">
        {/* LEFT "” hamburger (mobile) + date & time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(o => !o)}>
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="nav-clock">
          <span className="nav-clock-time">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="nav-clock-date">
            {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        </div>

        {/* CENTER "” search */}
        <div className="nav-search-wrap">
          <i className="fa-solid fa-magnifying-glass nav-search-icon"></i>
          <input
            className="nav-search-input"
            placeholder="Search communities or users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="nav-search-clear" onClick={() => setSearch('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          {/* Dropdown results */}
          {search.trim() && (
            <div className="nav-search-results">
              {/* Communities */}
              {communities.filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                <>
                  <div className="search-result-label">COMMUNITIES</div>
                  {communities
                    .filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase()))
                    .slice(0, 4)
                    .map(c => (
                      <div key={c.id} className="search-result-item" onClick={() => {
                        setActiveCommId(c.id); setSection('circles'); setSearch('');
                      }}>
                        <i className={(c.icon || getCategoryIcon(c.category))} style={{ color: 'var(--cyber-cyan)', marginRight: 10 }}></i>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{c.category}</div>
                        </div>
                      </div>
                    ))
                  }
                </>
              )}
              {/* No results */}
              {communities.filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>No results found.</div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT "” notifications + user hud */}
        <div className="user-hud">
          {/* Theme Picker Button */}
          <button
            className="notif-bell"
            onClick={() => setShowThemePicker(true)}
            title="Change Theme"
            style={{ marginRight: 4 }}
          >
            <i className="fa-solid fa-palette"></i>
          </button>

          {/* Notification Bell */}
          <div className="notif-wrap" ref={notifRef}>
            <button className="notif-bell" onClick={() => { setShowNotifications(o => !o); markAllRead(); }}>
              <i className="fa-solid fa-bell"></i>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="notif-dot">{notifications.filter(n => !n.is_read).length}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', fontSize: 11, cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <i className="fa-solid fa-bell-slash"></i>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifications.map(n => (
                    <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => {
                        markRead(n.id);
                        if (n.link_comm_id) { setActiveCommId(n.link_comm_id); setSection('circles'); }
                        setShowNotifications(false);
                      }}>
                      <div className="notif-icon">
                        <i className={notifIcon(n.type)}></i>
                      </div>
                      <div className="notif-content">
                        <p className="notif-msg">{n.message}</p>
                        <span className="notif-time">{timeAgo(n.created_at)}</span>
                      </div>
                      {!n.is_read && <div className="notif-unread-dot"></div>}
                    </div>
                  ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hud-chip">
            <span className="hud-label">USER_ID:</span>
            <span className="hud-value">{user?.student_id}</span>
          </div>
          <div className="hud-avatar" onClick={() => setShowProfile(true)}>
            {navAvatarUrl
              ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
        </div>
      </nav>

      <div className="main">
        {/* CIRCLE DOCK "” only joined circles */}
        <div className="circle-dock">
          <div className="dock-branding">
            <img src="/logoo.png" className="brand-logo-small" alt="NEXO" />
          </div>
          {myCircles.map(c => (
            <div key={c.id} className={`dock-icon ${activeCommId === c.id ? 'active' : ''}`}
              title={c.name} onClick={() => {
                setActiveCommId(c.id);
                setSection(c.id === 'global' ? 'home' : 'circles');
              }}>
              <i className={c.id === 'global' ? 'fa-solid fa-earth-asia' : (c.icon || (c.icon || getCategoryIcon(c.category)))}></i>
            </div>
          ))}
          {user?.is_verified && (
            <div className="dock-add-btn" title="Create Circle" onClick={() => setShowCreate(true)}>+</div>
          )}
        </div>

        {/* SIDEBAR BACKDROP (mobile) */}
        {mobileSidebarOpen && (
          <div className="sidebar-backdrop show" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* SIDEBAR "” context aware */}
        <div className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
          {activeCommId === 'global' ? (
            /* â”€â”€ GLOBAL / HOME sidebar â”€â”€ */
            <>
              <div className="sidebar-brand-area">
                <h2 className="sidebar-title">NEXO <span className="cyan-text">CONNECT</span></h2>
              </div>
              <div className="sidebar-scroll">
              <div className="sidebar-label">MAIN</div>
              <div className="nav-links">
                <div className={`ls-item ${section === 'home' ? 'active' : ''}`} onClick={() => { setSection('home'); setMobileSidebarOpen(false); }}>
                  <i className="nav-icon fa-solid fa-house-chimney"></i>
                  <span className="node-name">Home Feed</span>
                </div>
                <div className={`ls-item ${section === 'global' ? 'active' : ''}`} onClick={() => { setSection('global'); setActiveCommId('global'); setMobileSidebarOpen(false); }}>
                  <i className="nav-icon fa-solid fa-message"></i>
                  <span className="node-name">Global Feed</span>
                </div>
                <div className={`ls-item ${section === 'activity' && activeCategory === 'all' ? 'active' : ''}`} onClick={() => { setSection('activity'); setActiveCategory('all'); }}>
                  <i className="nav-icon fa-solid fa-compass"></i>
                  <span className="node-name">Explore</span>
                </div>
              </div>
              <div className="sidebar-label" style={{ marginTop: 12 }}>CATEGORIES</div>
              <div className="nav-links">
                {[
                  { key: 'academic', label: 'Academic',  icon: 'fa-solid fa-graduation-cap' },
                  { key: 'project',  label: 'Projects',  icon: 'fa-solid fa-flask' },
                  { key: 'hobby',    label: 'Hobbies',   icon: 'fa-solid fa-gamepad' },
                  { key: 'social',   label: 'Social',    icon: 'fa-solid fa-user-group' },
                ].map(cat => (
                  <div key={cat.key}
                    className={`ls-item ${section === 'activity' && activeCategory === cat.key ? 'active' : ''}`}
                    onClick={() => { setSection('activity'); setActiveCategory(cat.key); }}
                  >
                    <i className={`nav-icon ${cat.icon}`} style={{ fontStyle: 'normal' }}></i>
                    <span className="node-name">{cat.label}</span>
                  </div>
                ))}
              </div>
              </div>
            </>
          ) : (
            /* â”€â”€ CIRCLE sidebar â”€â”€ */
            <>
              <div className="sidebar-brand-area" style={{ paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <i className={activeComm.icon || activeComm.faIcon || getCategoryIcon(activeComm.category)} style={{ color: 'var(--cyber-cyan)' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>{activeComm.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{activeComm.category || 'circle'}</div>
                  </div>
                </div>
              </div>

              <div className="sidebar-scroll">
              <div className="sidebar-label">CHANNELS</div>
              <div className="nav-links">
                {/* Announcements "” always first, powered by announcements table */}
                <div
                  className={`ls-item ${showCircleAnnouncements ? 'active' : ''}`}
                  onClick={() => { setShowCircleAnnouncements(true); setSection('circles'); }}
                >
                  <i className="channel-hash">#</i>
                  <span className="node-name">announcements</span>
                  {circleAnnouncements.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{circleAnnouncements.length}</span>
                  )}
                </div>



                {channels.length === 0 && (
                  <div style={{ padding: '8px 15px', fontSize: 12, color: 'var(--text-muted)' }}>
                    No channels yet.
                  </div>
                )}
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`ls-item ${activeChannelId === ch.id && !showCircleAnnouncements ? 'active' : ''}`}
                    onClick={() => { setActiveChannelId(ch.id); setSection('circles'); setShowCircleAnnouncements(false); }}
                  >
                    <i className="channel-hash">#</i>
                    <span className="node-name">{ch.name}</span>
                    {canModerate && (
                      <i
                        className="fa-solid fa-xmark channel-delete-btn"
                        onClick={e => { e.stopPropagation(); deleteChannel(ch.id); }}
                        title="Delete channel"
                      ></i>
                    )}
                  </div>
                ))}

                {/* Add channel "” leaders/co-leaders only */}
                {canModerate && (
                  showAddChannel ? (
                    <div style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                      <input
                        className="channel-name-input"
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addChannel(); if (e.key === 'Escape') setShowAddChannel(false); }}
                        placeholder="channel-name"
                        autoFocus
                      />
                      <button className="channel-confirm-btn" onClick={addChannel}>
                        <i className="fa-solid fa-check"></i>
                      </button>
                      <button className="channel-cancel-btn" onClick={() => setShowAddChannel(false)}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="ls-item add-channel-btn" onClick={() => setShowAddChannel(true)}>
                      <i className="channel-hash" style={{ color: 'var(--text-muted)' }}>+</i>
                      <span className="node-name" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Add Channel</span>
                    </div>
                  )
                )}
              </div>

              {/* Moderators can see members but not settings/delete */}
              {canModerate && (
                <>
                  <div className="sidebar-label" style={{ marginTop: 12 }}>MANAGE</div>
                  <div className="nav-links">
                    {isOwner && (
                      <>
                        <div className="ls-item" onClick={() => setShowManage(true)}>
                          <i className="nav-icon fa-solid fa-gear"></i>
                          <span className="node-name">Settings</span>
                        </div>
                        <div className="ls-item" style={{ color: 'var(--red)' }} onClick={() => deleteCircle(activeComm.id)}>
                          <i className="nav-icon fa-solid fa-circle-xmark"></i>
                          <span className="node-name">Delete Circle</span>
                        </div>
                      </>
                    )}
                    {!isOwner && (
                      <div className="ls-item" onClick={() => setShowManage(true)}>
                        <i className="nav-icon fa-solid fa-users"></i>
                        <span className="node-name">View Members</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              </div>{/* end sidebar-scroll */}

              <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,240,255,0.08)', flexShrink: 0 }}>
                {!isOwner && isMember(activeCommId) && activeCommId !== 'global' && (
                  <div className="ls-item" style={{ color: 'var(--red)', marginBottom: 4 }}
                    onClick={() => leaveCircle(activeCommId)}>
                    <i className="nav-icon fa-solid fa-right-from-bracket"></i>
                    <span className="node-name">Leave Circle</span>
                  </div>
                )}
                <div className="ls-item" onClick={() => { setActiveCommId('global'); setSection('home'); }}>
                  <i className="nav-icon fa-solid fa-arrow-left"></i>
                  <span className="node-name">Back to Home</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* â”€â”€ HOME â”€â”€ */}
          {section === 'home' && (
            <div className="c-feed fade-in">

              {/* Hero banner */}
              <div className="home-hero">
                <div className="home-hero-text">
                  <p className="home-hero-welcome">Welcome, Technologist.</p>
                  <h1>Find Your Circle<br/>at CTU</h1>
                  <p>Discover communities built around your interests, join the conversation, and make your campus experience count.</p>
                  <button className="cyber-btn" style={{ width: 'auto', padding: '10px 24px', marginTop: 16 }}
                    onClick={() => { setSection('activity'); setActiveCategory('all'); }}>
                    <i className="fa-solid fa-compass" style={{ marginRight: 8 }}></i>Explore Circles
                  </button>
                </div>
              </div>

              {/* Welcome + stats "” kept from before */}
              <div className="welcome-grid">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-yellow)' }}>
                  <h2 style={{ fontSize: 18, letterSpacing: 2, color: 'var(--cyber-yellow)' }}>
                    WELCOME, {user?.full_name?.toUpperCase() || 'TECHNOLOGIST'}!
                  </h2>
                  {user?.is_verified ? (
                    <div className="verified-badge">
                      <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i> Verified {user?.user_type || 'Student'} âœ“
                    </div>
                  ) : (
                    <div className="verified-badge" style={{ borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}>
                      <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i> Pending Verification
                    </div>
                  )}
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 15 }}>
                    Monitoring real-time network activity across all CTU circles.
                  </p>
                </div>
                <div className="stats-card">
                  <h4 style={{ fontSize: 11, color: 'var(--cyber-yellow)', marginBottom: 15, letterSpacing: 2 }}>QUICK_STATS</h4>
                  <div className="stat-line">My Circles <span className="stat-val">{myCircles.length}</span></div>
                  <div className="stat-line">Network Status <span className="stat-val" style={{ color: '#00ff00' }}>ONLINE</span></div>
                  <div className="stat-line">Clearance <span className="stat-val">{user?.user_type?.toUpperCase()}</span></div>
                </div>
              </div>

              {/* â”€â”€ POST COMPOSER "” verified users only â”€â”€ */}
              {user?.is_verified && (
                <div className="home-post-composer">
                  <div className="home-composer-header">
                    <div className="home-composer-avatar">
                      {navAvatarUrl
                        ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials
                      }
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Share something with the campus</span>
                  </div>
                  <input
                    className="home-composer-title"
                    placeholder="Title"
                    value={newPost.title}
                    onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  />
                  {newPost.post_type !== 'poll' && (
                    <textarea
                      className="home-composer-body"
                      placeholder="What's on your mind? Share news, events, shoutouts..."
                      value={newPost.content}
                      onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                      rows={3}
                    />
                  )}
                  {/* Poll options */}
                  {newPost.post_type === 'poll' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {newPost.pollOptions.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="home-composer-title"
                            style={{ marginBottom: 0, flex: 1 }}
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                            onChange={e => {
                              const opts = [...newPost.pollOptions];
                              opts[i] = e.target.value;
                              setNewPost(p => ({ ...p, pollOptions: opts }));
                            }}
                          />
                          {newPost.pollOptions.length > 2 && (
                            <button type="button" onClick={() => setNewPost(p => ({ ...p, pollOptions: p.pollOptions.filter((_, idx) => idx !== i) }))}
                              style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', padding: '0 10px', fontSize: 13 }}>
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>
                      ))}
                      {newPost.pollOptions.length < 6 && (
                        <button type="button" onClick={() => setNewPost(p => ({ ...p, pollOptions: [...p.pollOptions, ''] }))}
                          style={{ background: 'none', border: '1px dashed rgba(168,85,247,0.4)', borderRadius: 8, color: '#a855f7', cursor: 'pointer', padding: '8px', fontSize: 12, fontFamily: 'inherit' }}>
                          <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Add Option
                        </button>
                      )}
                    </div>
                  )}
                  <div className="home-composer-footer">
                    <div className="home-composer-types">
                      {['announcement', 'event', 'shoutout', 'general', 'poll'].map(t => {
                        const cfg = POST_TYPE[t];
                        return (
                          <button key={t}
                            className={`home-type-btn ${newPost.post_type === t ? 'active' : ''}`}
                            style={{ '--type-color': cfg.color }}
                            onClick={() => setNewPost(p => ({ ...p, post_type: t }))}>
                            <i className={cfg.icon}></i> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        className={`home-anon-btn ${newPost.anonymous ? 'active' : ''}`}
                        onClick={() => setNewPost(p => ({ ...p, anonymous: !p.anonymous }))}
                        title={newPost.anonymous ? 'Posting anonymously "” click to use your name' : 'Post anonymously'}>
                        <i className="fa-solid fa-user-secret"></i>
                        <span>{newPost.anonymous ? 'Anonymous' : 'Post as me'}</span>
                      </button>
                      <button className="cyber-btn"
                        style={{ width: 'auto', padding: '8px 22px', fontSize: 12 }}
                        disabled={postingAnnouncement || !newPost.title.trim() || (newPost.post_type !== 'poll' && !newPost.content.trim())}
                        onClick={postAnnouncement}>
                        {postingAnnouncement
                          ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Posting...</>
                          : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* â”€â”€ CAMPUS FEED â”€â”€ */}
              <div className="home-section-header" style={{ marginTop: 4 }}>
                <span><i className="fa-solid fa-bullhorn" style={{ marginRight: 8, color: 'var(--cyber-cyan)' }}></i>Campus Feed</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{announcements.length} posts</span>
              </div>

              {/* Feed filter tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { key: 'all',          label: 'All',          icon: 'fa-solid fa-layer-group' },
                  { key: 'announcement', label: 'Announcement', icon: 'fa-solid fa-bullhorn' },
                  { key: 'event',        label: 'Event',        icon: 'fa-solid fa-calendar' },
                  { key: 'shoutout',     label: 'Shoutout',     icon: 'fa-solid fa-star' },
                  { key: 'general',      label: 'General',      icon: 'fa-solid fa-comment' },
                  { key: 'poll',         label: 'Poll',         icon: 'fa-solid fa-chart-bar' },
                ].map(f => {
                  const cfg = POST_TYPE[f.key];
                  const color = cfg?.color || 'var(--cyber-cyan)';
                  const isActive = feedFilter === f.key;
                  return (
                    <button key={f.key}
                      onClick={() => setFeedFilter(f.key)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                        background: isActive ? `${color}18` : 'transparent',
                        color: isActive ? color : 'var(--text-muted)',
                        fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                      <i className={f.icon} style={{ fontSize: 10 }}></i>{f.label}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const filtered = feedFilter === 'all' ? announcements : announcements.filter(a => a.post_type === feedFilter);
                return filtered.length === 0 ? (
                  <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                    <i className="fa-solid fa-bullhorn" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {feedFilter === 'all'
                        ? (user?.is_verified ? 'No posts yet. Be the first to share something!' : 'No posts yet. Verify your account to post.')
                        : `No ${feedFilter} posts yet.`}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filtered.map(a => (
                      <AnnouncementCard key={a.id} a={a} user={user}
                        onPin={togglePin}
                        onDelete={deleteAnnouncement}
                        onVote={handleVote}
                        onReport={(data) => setShowReport(data)}
                        onApply={(ann) => {
                          const match = ann.title?.match(/\(([^)]+)\)$/);
                          const commName = match?.[1];
                          const comm = commName
                            ? communities.find(c => c.name === commName)
                            : communities.find(c => ann.title?.includes(c.name));
                          if (comm) setShowAuditionForm({ comm });
                          else alert('Could not find the audition circle. Try visiting the circle directly.');
                        }} />
                    ))}
                  </div>
                );
              })()}

              {/* Featured Communities */}
              <div className="home-section-header" style={{ marginTop: 16 }}>
                <span>Featured Circles</span>
                <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
              </div>
              {communities.filter(c => c.id !== 'global').length === 0 ? (
                <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                  <i className="fa-solid fa-network-wired" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No circles yet. Be the first to create one!</p>
                  {user?.is_verified && (
                    <button className="cyber-btn" style={{ width: 'auto', padding: '8px 20px', marginTop: 12 }}
                      onClick={() => setShowCreate(true)}>
                      <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Create a Circle
                    </button>
                  )}
                </div>
              ) : (
                <div className="featured-grid">
                  {communities.filter(c => c.id !== 'global').slice(0, 4).map(c => (
                    <div key={c.id} className="featured-card"
                      onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                      <div className="featured-card-bg" style={{
                        background: c.cover_url ? undefined : categoryGradient(c.category),
                        backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}></div>
                      <div className="featured-card-body">
                        <div className="featured-card-icon">
                          <i className={(c.icon || getCategoryIcon(c.category))}></i>
                        </div>
                        <div className="featured-card-name">{c.name}</div>
                        <div className="featured-card-desc">{c.description || 'No description provided.'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Popular by category */}
              {communities.filter(c => c.id !== 'global').length > 0 && (
                <>
                  <div className="home-section-header" style={{ marginTop: 8 }}>
                    <span>Popular Right Now</span>
                    <span className="home-see-all" onClick={() => { setSection('activity'); setActiveCategory('all'); }}>See all</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {communities.filter(c => c.id !== 'global').slice(0, 3).map(c => (
                      <div key={c.id} className="popular-row"
                        onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                        <div className="popular-row-icon" style={{
                          background: c.cover_url ? undefined : categoryGradient(c.category),
                          backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}>
                          {!c.cover_url && <i className={(c.icon || getCategoryIcon(c.category))}></i>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{c.category}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }}></i>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>
          )}

          {/* â”€â”€ GLOBAL FEED "” campus-wide chat â”€â”€ */}
          {section === 'global' && (
            <>
              <div className="c-feed fade-in">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                    <i className="fa-solid fa-network-wired" style={{ marginRight: 10 }}></i>GLOBAL FEED
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                    Campus-wide chat "” open to all verified students and faculty.
                  </p>
                </div>

                {messages.map(m => {
                  const isOwnerMsg = m.student_id === user?.student_id;
                  return (
                    <MessageItem key={m.id} m={m}
                      tagColor="var(--cyber-cyan)"
                      isOwnerMsg={isOwnerMsg}
                      canDelete={isOwnerMsg || user?.user_type === 'Admin'}
                      onDelete={deleteMessage}
                      onEdit={editMessage}
                      onReport={(data) => setShowReport(data)}
                      currentStudentId={user?.student_id}
                    />
                  );
                })}
                <div ref={feedBottomRef} />
              </div>

              {user?.is_verified && (
                <div className="composer">
                  <div className="c-input-wrap">
                    <input value={msgInput} onChange={e => { setMsgInput(e.target.value); setSendError(''); }}
                      onKeyDown={e => e.key === 'Enter' && sendPost()}
                      placeholder="Say something to the campus..."
                      style={sendError ? { borderColor: 'var(--red)' } : {}} />
                    <button className="cyber-btn" onClick={sendPost}>SEND</button>
                  </div>
                  {sendError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-triangle-exclamation"></i>{sendError}</div>}
                </div>
              )}
            </>
          )}

          {/* â”€â”€ ACTIVITY HUB "” discover & join circles â”€â”€ */}
          {section === 'activity' && (
            <div className="c-feed fade-in">
              <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                  <i className="fa-solid fa-compass" style={{ marginRight: 10 }}></i>
                  {activeCategory === 'all' ? 'EXPLORE ALL CIRCLES' : activeCategory.toUpperCase()}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                  Discover circles and request to join. Click a category in the sidebar to filter.
                </p>
              </div>

              {(() => {
                const filtered = communities.filter(c =>
                  c.id !== 'global' && (activeCategory === 'all' || c.category === activeCategory)
                );
                return filtered.length === 0 ? (
                  <div className="post"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No circles found in this category.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(c => {
                      const owned = c.creator_id === user?.id;
                      const joined = isMember(c.id);
                      const pending = isPending(c.id);
                      const myAudition = getMyAudition(c.id);
                      return (
                        <div key={c.id} className="post" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <i className={(c.icon || getCategoryIcon(c.category))} style={{ color: 'var(--cyber-cyan)', fontSize: 16 }}></i>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid #333', padding: '2px 6px', borderRadius: 4 }}>{c.category}</span>
                            {owned && <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 6px', borderRadius: 4 }}>YOUR CIRCLE</span>}
                            {c.audition_enabled && !owned && <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', border: '1px solid var(--cyber-cyan)', padding: '2px 6px', borderRadius: 4 }}><i className="fa-solid fa-microphone" style={{ marginRight: 4 }}></i>Audition Required</span>}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.description || 'No description provided.'}</p>
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 20 }}>
                          {owned || joined ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="group-action-btn manage"
                                onClick={() => { setActiveCommId(c.id); setSection('circles'); }}>
                                <i className="fa-solid fa-arrow-right-to-bracket"></i> ENTER
                              </button>
                              {!owned && (
                                <button className="group-action-btn terminate"
                                  onClick={() => leaveCircle(c.id)}
                                  title="Leave circle">
                                  <i className="fa-solid fa-right-from-bracket"></i>
                                </button>
                              )}
                            </div>
                          ) : !user?.is_verified ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid #333', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-lock" style={{ marginRight: 5 }}></i>Verify to join
                            </span>
                          ) : pending ? (
                            <span style={{ fontSize: 11, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: 5 }}></i>PENDING
                            </span>
                          ) : myAudition ? (
                            <span
                              style={{
                                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                                color: auditionStatusColor(myAudition.status, myAudition.phase2_result),
                                border: `1px solid ${auditionStatusColor(myAudition.status, myAudition.phase2_result)}`,
                                cursor: 'pointer',
                              }}
                              onClick={async () => {
                                const [rRes, qRes] = await Promise.all([
                                  supabase.from('audition_responses').select('*').eq('id', myAudition.id).single(),
                                  supabase.from('audition_questions').select('*').eq('community_id', c.id).order('order_index'),
                                ]);
                                setViewingAudition({ response: rRes.data, community: c, questions: qRes.data || [] });
                              }}
                            >
                              <i className="fa-solid fa-microphone" style={{ marginRight: 5 }}></i>
                              {auditionStatusLabel(myAudition.status, myAudition.phase2_result)}
                              <i className="fa-solid fa-eye" style={{ marginLeft: 6, fontSize: 9 }}></i>
                            </span>
                          ) : (
                            c.audition_enabled ? (
                              // Internal audition: outsiders can still REQUEST to join; audition is only for existing members
                              c.internal_audition ? (
                                <button className="group-action-btn manage" onClick={() => requestJoin(c.id)}>
                                  <i className="fa-solid fa-paper-plane"></i> REQUEST
                                </button>
                              ) : (
                                <button className="group-action-btn manage" onClick={() => setShowAuditionForm({ comm: c })}>
                                  <i className="fa-solid fa-microphone"></i> APPLY
                                </button>
                              )
                            ) : (
                              <button className="group-action-btn manage" onClick={() => requestJoin(c.id)}>
                                <i className="fa-solid fa-paper-plane"></i> REQUEST
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* â”€â”€ MY CIRCLES / CIRCLE FEED â”€â”€ */}
          {section === 'circles' && (
            <>
              <div className="c-feed fade-in">
                {/* â”€â”€ CIRCLE COVER BANNER â”€â”€ */}
                <div className="circle-cover-banner" style={{
                  background: activeComm.cover_url
                    ? `url(${activeComm.cover_url}) center/cover no-repeat`
                    : categoryGradient(activeComm.category),
                }}>
                  {/* Cover photo edit button "” top-right, only for creator */}
                  {isOwner && (
                    <label className="circle-cover-edit-btn" title="Change circle cover photo">
                      <i className="fa-solid fa-image"></i>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const compressed = await new Promise((resolve, reject) => {
                            const img = new Image();
                            const objUrl = URL.createObjectURL(file);
                            img.onload = () => {
                              URL.revokeObjectURL(objUrl);
                              const MAX_W = 900, MAX_H = 300;
                              const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
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

                          // Optimistically update UI immediately
                          setCommunities(prev => prev.map(c =>
                            c.id === activeComm.id ? { ...c, cover_url: compressed } : c
                          ));

                          // Save via server (uses service role key, bypasses RLS)
                          let saved = false;
                          try {
                            const serverRes = await fetch(`/api/upload-cover?userId=${user.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ cover: compressed, communityId: activeComm.id }),
                            });
                            if (serverRes.ok) {
                              saved = true;
                            } else {
                              const errBody = await serverRes.json().catch(() => ({}));
                              console.error('[cover upload] server error:', serverRes.status, errBody);
                            }
                          } catch (fetchErr) {
                            console.error('[cover upload] fetch failed:', fetchErr);
                          }

                          showToast(saved ? 'COVER_PHOTO_UPDATED' : 'UPLOAD_FAILED');
                        }}
                      />
                    </label>
                  )}
                  <div className="circle-cover-overlay">
                    <div className="circle-cover-icon">
                      <i className={activeComm.icon || getCategoryIcon(activeComm.category)}></i>
                    </div>
                    <div>
                      <h2 className="circle-cover-title">
                        {activeComm.name.toUpperCase()}
                        {activeChannelId && channels.find(c => c.id === activeChannelId) && (
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, fontSize: 15, marginLeft: 10 }}>
                            # {channels.find(c => c.id === activeChannelId)?.name}
                          </span>
                        )}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <div className="verified-badge" style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.3)' }}>
                          GROUP: {(activeComm.category || 'General').toUpperCase()} | ROLE: {myRole}
                        </div>
                      </div>
                      <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
                        {activeComm.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Access gate for non-members */}
                {!isMember(activeCommId) ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>This node requires membership to access transmissions.</p>
                    {isPending(activeCommId) ? (
                      <span style={{ color: 'var(--cyber-yellow)', fontSize: 12 }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i>Join request pending approval...
                      </span>
                    ) : (
                      activeComm.audition_enabled ? (
                        activeComm.internal_audition ? (
                          <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                            <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                          </button>
                        ) : (
                          <button className="group-action-btn manage" onClick={() => setShowAuditionForm({ comm: activeComm })}>
                            <i className="fa-solid fa-microphone"></i> APPLY TO JOIN
                          </button>
                        )
                      ) : (
                        <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                          <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                        </button>
                      )
                    )}
                  </div>
                ) : showCircleAnnouncements ? (
                  /* â”€â”€ CIRCLE ANNOUNCEMENTS VIEW â”€â”€ */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Post composer "” all members can post */}
                    {isMember(activeCommId) && user?.is_verified && (
                      <div className="home-post-composer">
                        <div className="home-composer-header">
                          <div className="home-composer-avatar" style={{ background: 'rgba(252,238,10,0.15)', border: '1px solid rgba(252,238,10,0.3)', color: 'var(--cyber-yellow)' }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                            Post to {activeComm.name}
                          </span>
                        </div>
                        <input className="home-composer-title" placeholder="Title"
                          value={newCirclePost.title}
                          onChange={e => setNewCirclePost(p => ({ ...p, title: e.target.value }))} />
                        {newCirclePost.post_type !== 'poll' && (
                          <textarea className="home-composer-body" placeholder="Write your announcement, event, or shoutout..."
                            value={newCirclePost.content}
                            onChange={e => setNewCirclePost(p => ({ ...p, content: e.target.value }))}
                            rows={3} />
                        )}
                        {/* Poll options */}
                        {newCirclePost.post_type === 'poll' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                            {newCirclePost.pollOptions.map((opt, i) => (
                              <div key={i} style={{ display: 'flex', gap: 6 }}>
                                <input
                                  className="home-composer-title"
                                  style={{ marginBottom: 0, flex: 1 }}
                                  placeholder={`Option ${i + 1}`}
                                  value={opt}
                                  onChange={e => {
                                    const opts = [...newCirclePost.pollOptions];
                                    opts[i] = e.target.value;
                                    setNewCirclePost(p => ({ ...p, pollOptions: opts }));
                                  }}
                                />
                                {newCirclePost.pollOptions.length > 2 && (
                                  <button type="button"
                                    onClick={() => setNewCirclePost(p => ({ ...p, pollOptions: p.pollOptions.filter((_, idx) => idx !== i) }))}
                                    style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', padding: '0 10px', fontSize: 13 }}>
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                )}
                              </div>
                            ))}
                            {newCirclePost.pollOptions.length < 6 && (
                              <button type="button"
                                onClick={() => setNewCirclePost(p => ({ ...p, pollOptions: [...p.pollOptions, ''] }))}
                                style={{ background: 'none', border: '1px dashed rgba(168,85,247,0.4)', borderRadius: 8, color: '#a855f7', cursor: 'pointer', padding: '8px', fontSize: 12, fontFamily: 'inherit' }}>
                                <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>Add Option
                              </button>
                            )}
                          </div>
                        )}
                        <div className="home-composer-footer">
                          <div className="home-composer-types">
                            {['announcement', 'event', 'shoutout', 'general', 'poll'].map(t => {
                              const cfg = POST_TYPE[t];
                              return (
                                <button key={t}
                                  className={`home-type-btn ${newCirclePost.post_type === t ? 'active' : ''}`}
                                  style={{ '--type-color': cfg.color }}
                                  onClick={() => setNewCirclePost(p => ({ ...p, post_type: t }))}>
                                  <i className={cfg.icon}></i> {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                          <button className="cyber-btn"
                            style={{ width: 'auto', padding: '8px 20px', fontSize: 12 }}
                            disabled={postingAnnouncement || !newCirclePost.title.trim() || (newCirclePost.post_type !== 'poll' && !newCirclePost.content.trim())}
                            onClick={() => postCircleAnnouncement(activeCommId)}>
                            {postingAnnouncement
                              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Posting...</>
                              : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                          </button>
                        </div>
                      </div>
                    )}
                    {circleAnnouncements.length === 0 ? (
                      <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                        <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No announcements yet.</p>
                      </div>
                    ) : (
                      circleAnnouncements.map(a => (
                        <AnnouncementCard key={a.id} a={a} user={user}
                          onPin={togglePin}
                          onDelete={(id) => { deleteAnnouncement(id); loadCircleAnnouncements(activeCommId); }}
                          onVote={handleCircleVote}
                          onReport={(data) => setShowReport(data)}
                          onApply={() => setShowAuditionForm({ comm: activeComm })} />
                      ))
                    )}
                  </div>
                ) : (
                  messages.map(m => {
                    const isOwnerMsg = m.student_id === user?.student_id;
                    const canDelete = isOwnerMsg || canModerate;
                    return (
                      <MessageItem
                        key={m.id}
                        m={m}
                        tagColor={tagColor}
                        isOwnerMsg={isOwnerMsg}
                        canDelete={canDelete}
                        onDelete={deleteMessage}
                        onEdit={editMessage}
                        onReport={(data) => setShowReport(data)}
                        currentStudentId={user?.student_id}
                      />
                    );
                  })
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && !showCircleAnnouncements && user?.is_verified && (
                <div className="composer">
                  <div className="c-input-wrap">
                    <input value={msgInput} onChange={e => { setMsgInput(e.target.value); setSendError(''); }}
                      onKeyDown={e => e.key === 'Enter' && sendPost()} placeholder="Write a message..."
                      style={sendError ? { borderColor: 'var(--red)' } : {}} />
                    <button className="cyber-btn" onClick={sendPost}>SEND</button>
                  </div>
                  {sendError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-triangle-exclamation"></i>{sendError}</div>}
                </div>
              )}
            </>
          )}

          {/* â”€â”€ CIRCLE CHAT â”€â”€ */}
          {section === 'circle-chat' && activeCommId !== 'global' && (
            <>
              <div className="c-feed fade-in">
                <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                  <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                    <i className="fa-solid fa-comments" style={{ marginRight: 10 }}></i>CIRCLE CHAT
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                    Private chat exclusive to members of {activeComm.name}.
                  </p>
                </div>

                {!isMember(activeCommId) ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--text-muted)' }}>You must be a member to access Circle Chat.</p>
                  </div>
                ) : (
                  circleChatMessages.map(m => {
                    const isOwnerMsg = m.student_id === user?.student_id;
                    const canDelete = isOwnerMsg || canModerate;
                    return (
                      <MessageItem
                        key={m.id}
                        m={m}
                        tagColor={tagColor}
                        isOwnerMsg={isOwnerMsg}
                        canDelete={canDelete}
                        onDelete={async (id) => {
                          if (!confirm('Delete this message?')) return;
                          await supabase.from('messages').delete().eq('id', id);
                          setCircleChatMessages(prev => prev.filter(msg => msg.id !== id));
                        }}
                        onEdit={async (id, content) => {
                          await supabase.from('messages').update({ content, edited: true }).eq('id', id);
                          setCircleChatMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content, edited: true } : msg));
                        }}
                        currentStudentId={user?.student_id}
                      />
                    );
                  })
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && user?.is_verified && (
                <div className="composer">
                  <div className="c-input-wrap">
                    <input value={circleChatInput} onChange={e => setCircleChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendCircleChatPost()}
                      placeholder={`Message ${activeComm.name}...`} />
                    <button className="cyber-btn" onClick={sendCircleChatPost}>SEND</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showManage && (
        <ManageGroupModal comm={activeComm} onClose={() => setShowManage(false)}
          viewerIsOwner={isOwner}
          onSaved={(updated) => {
            setCommunities(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            showToast('SETTINGS_SAVED');
          }}
        />
      )}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCommCreated} userId={user?.id} />}
      {showProfile && <ProfileModal user={user} communities={myCircles} onClose={() => setShowProfile(false)} onLogout={logout} onAvatarUpdate={(url) => setNavAvatarUrl(url)} currentAvatarUrl={navAvatarUrl} />}
      {showAuditionForm && (
        <AuditionApplicationForm
          comm={showAuditionForm.comm}
          audition={showAuditionForm.audition || null}
          applicantId={user?.id}
          onSubmitted={() => { setShowAuditionForm(null); showToast('Application submitted!'); loadMyMemberships(); loadMyAuditions(); }}
          onCancel={() => setShowAuditionForm(null)}
        />
      )}
      {viewingAudition && (
        <AuditionDetailModal data={viewingAudition} onClose={() => setViewingAudition(null)} />
      )}
      <Toast message={toast} />

      {showReport && (
        <ReportModal data={showReport} user={user} onClose={() => setShowReport(null)} />
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <ThemePicker
          currentTheme={currentTheme}
          onClose={() => setShowThemePicker(false)}
          onThemeChange={(t) => setCurrentTheme(t)}
        />
      )}
    </div>
  );
}




