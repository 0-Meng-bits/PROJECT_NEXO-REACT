import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { clearCustomizationCache } from '../lib/customization';
import { ApplicationFormBuilder, ApplicationReviewPanel, ApplicationApplicationForm, ApplicationStatusLabel, ApplicationStatusColor } from './ApplicationSystem';
import ThemePicker from './ThemePicker';
import ProfileShop from './ProfileShop';
import CustomizedUsername from './CustomizedUsername';
import TaskBoard from './TaskBoard';
import ShowcaseTagBar from './ShowcaseTagBar';
import PollEventMetadataForm from './PollEventMetadataForm';
import EventPollBadge from './EventPollBadge';
import PollClosureButton from './PollClosureButton';
import GeneratedEventLink from './GeneratedEventLink';
import EventCard from './EventCard';
import { loadTheme } from '../lib/theme';
import { MediaUploadButton, VoiceRecorder, MediaPreview, uploadMediaFile, MediaMessage } from './MediaMessageHelpers';
import HelpModal from './HelpModal';

const SHOP_API = window.location.hostname === 'localhost'
  ? '/api/shop'
  : `${import.meta.env.VITE_API_URL || ''}/api/shop`;

function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-graduati?on-cap',
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
    application_update:  'fa-solid fa-microphone',
    new_announcement: 'fa-solid fa-bullhorn',
    invite_accepted:  'fa-solid fa-envelope-open-text',
    circle_invite:    'fa-solid fa-envelope',
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

// -- TRUST POINTS BADGE --------------------------------------------------------
function TrustPointsBadge({ points, size = 'medium', showLabel = true }) {
  const getColor = (p) => {
    if (p >= 10) return { bg: 'rgba(62, 207, 142, 0.15)', border: '#3ecf8e', text: '#3ecf8e', label: 'Good Standing' };
    if (p >= 7) return { bg: 'rgba(252, 238, 10, 0.15)', border: 'var(--cyber-yellow)', text: 'var(--cyber-yellow)', label: 'Low Trust' };
    if (p >= 4) return { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#f97316', label: 'Restricted' };
    return { bg: 'rgba(247, 95, 95, 0.15)', border: 'var(--red)', text: 'var(--red)', label: 'Severe Risk' };
  };
  
  const color = getColor(points);
  const sizes = {
    small: { font: 10, padding: '2px 8px', iconSize: 9 },
    medium: { font: 11, padding: '4px 10px', iconSize: 10 },
    large: { font: 13, padding: '6px 14px', iconSize: 12 },
  };
  const s = sizes[size] || sizes.medium;
  
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 12, padding: s.padding, fontSize: s.font, fontWeight: 700, color: color.text }}>
      <i className="fa-solid fa-shield-halved" style={{ fontSize: s.iconSize }}></i>
      <span>{points.toFixed(1)}</span>
      {showLabel && <span style={{ fontSize: s.font - 1, opacity: 0.8, marginLeft: 2 }}>· {color.label}</span>}
    </div>
  );
}

// -- BAD WORDS AUTO-DETECTION -------------------------------------------------
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'puta', 'gago', 'bobo', 'tanga', 'putangina', 'leche', 'pakshet', 'ulol', 'tangina', 'pakyu', 'yawa', 'buang'];

function containsBadWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

// -- POST TYPE CONFIG ----------------------------------------------------------
const POST_TYPE = {
  announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
  event:        { label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
  shoutout:     { label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
  general:      { label: 'General',       color: 'var(--text-muted)',   icon: 'fa-solid fa-comment' },
  poll:         { label: 'Poll',          color: '#a855f7',             icon: 'fa-solid fa-chart-bar' },
  showcase:     { label: 'Showcase',      color: '#f59e0b',             icon: 'fa-solid fa-palette' },
  question:     { label: 'Question',      color: '#22d3ee',             icon: 'fa-solid fa-circle-question' },
};

// -- TIME SINCE HELPER --------------------------------------------------------
const timeSince = (dateStr) => {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
};

// -- FEEDBACK TAGS CONFIG ------------------------------------------------------
const FEEDBACK_TAGS = [
  { id: 'effort',    label: 'Effort',    emoji: '??', color: '#22c55e' },
  { id: 'creative',  label: 'Creative',  emoji: '??', color: '#a855f7' },
  { id: 'technique', label: 'Technique', emoji: '??', color: '#3b82f6' },
  { id: 'style',     label: 'Style',     emoji: '??', color: '#ec4899' },
  { id: 'impact',    label: 'Impact',    emoji: '??', color: '#ef4444' },
];

function AnnouncementCard({ a, user, onPin, onDelete, onVote, onApply, onReport, avatarCache, communityCreatorId, onReload, onViewEvents }) {
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

  // Fetch user's rank level for this community (for PollClosureButton)
  const [userRankLevel, setUserRankLevel] = useState(0);
  
  useEffect(() => {
    if (a.community_id && user?.id) {
      supabase.from('memberships')
        .select('rank_level')
        .eq('user_id', user.id)
        .eq('community_id', a.community_id)
        .eq('status', 'active')
        .single()
        .then(({ data }) => {
          setUserRankLevel(data?.rank_level || 0);
        });
    }
  }, [a.community_id, user?.id]);

  // Detect showcase posts
  const isShowcase = a.post_type === 'showcase';

  // Detect question posts
  const isQuestion = a.post_type === 'question';
  const isSolved = isQuestion && !!a.solution_comment_id;
  const [markingSolution, setMarkingSolution] = useState(false);
  const isAuthorizedSolver = isQuestion && (
    user?.id === a.author_id ||
    user?.id === communityCreatorId
  );

  // Detect Application announcements by title pattern
  const isApplicationPost = a.title?.includes('Application Open') || a.title?.includes('Internal Application Open');

  // Comment state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, author_name }
  const [replyInput, setReplyInput] = useState('');
  const [commentHearts, setCommentHearts] = useState({}); // commentId -> { count, likedByMe }

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
    // Load heart counts for these comments
    if (data?.length && user?.id) {
      const ids = data.map(c => c.id);
      const { data: hearts } = await supabase
        .from('comment_hearts')
        .select('comment_id, user_id')
        .in('comment_id', ids);
      if (hearts) {
        const map = {};
        hearts.forEach(h => {
          if (!map[h.comment_id]) map[h.comment_id] = { count: 0, likedByMe: false };
          map[h.comment_id].count++;
          if (h.user_id === user.id) map[h.comment_id].likedByMe = true;
        });
        setCommentHearts(map);
      }
    }
  };

  const toggleCommentHeart = async (commentId) => {
    if (!user?.id) return;
    const current = commentHearts[commentId] || { count: 0, likedByMe: false };
    if (current.likedByMe) {
      await supabase.from('comment_hearts').delete().eq('comment_id', commentId).eq('user_id', user.id);
      setCommentHearts(prev => ({ ...prev, [commentId]: { count: Math.max(0, (prev[commentId]?.count || 1) - 1), likedByMe: false } }));
    } else {
      await supabase.from('comment_hearts').insert([{ comment_id: commentId, user_id: user.id }]);
      setCommentHearts(prev => ({ ...prev, [commentId]: { count: (prev[commentId]?.count || 0) + 1, likedByMe: true } }));
    }
  };

  const markSolution = async (commentId) => {
    // Validate comment belongs to this question
    const targetComment = comments.find(c => c.id === commentId);
    if (!targetComment || targetComment.announcement_id !== a.id) {
      console.error('Comment does not belong to this question');
      return;
    }
    setMarkingSolution(true);
    // Toggle: if already solution ? NULL, otherwise ? commentId
    const newValue = a.solution_comment_id === commentId ? null : commentId;
    const { error } = await supabase
      .from('announcements')
      .update({ solution_comment_id: newValue })
      .eq('id', a.id);
    if (error) {
      alert('Failed to update solution: ' + error.message);
    } else {
      // Notify comment author on mark (not unmark, not self)
      if (newValue && targetComment.author_id !== user.id) {
        await supabase.from('notifications').insert([{
          user_id: targetComment.author_id,
          type: 'solution_marked',
          message: `Your answer was marked as the solution in "${a.title}"`,
          link_comm_id: a.community_id,
        }]);
      }
      onReload?.();
    }
    setMarkingSolution(false);
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
      author_name: user.full_name || user.student_id || 'User',
      author_type: user.user_type || 'Student',
      content: commentInput.trim(),
    }]).select('id, announcement_id, author_id, author_name, author_type, content, created_at').single();
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
      author_name: user.full_name || user.student_id || 'User',
      author_type: user.user_type || 'Student',
      content,
    }]).select('id, announcement_id, author_id, author_name, author_type, content, created_at').single();
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
    <div className={`announcement-card ${a.pinned ? 'pinned' : ''} ${isShowcase ? 'showcase' : ''}`}>
      {a.pinned && (
        <div className="announcement-pin-badge">
          <i className="fa-solid fa-thumbtack"></i> Pinned
        </div>
      )}
      {isShowcase && (
        <div className="showcase-badge">
          <i className="fa-solid fa-palette"></i> SHOWCASE
        </div>
      )}
      <div className="announcement-header">
        <div className={`announcement-author-avatar ${isAnon ? 'anon' : ''}`} style={{ overflow: 'hidden', padding: 0 }}>
          {isAnon
            ? <i className="fa-solid fa-user-secret"></i>
            : (() => {
                const url = avatarCache?.[a.author_student_id] || avatarCache?.[String(a.author_student_id)];
                return url
                  ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : avatarChar;
              })()
          }
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
            {isQuestion && (
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10, marginLeft: 6, fontWeight: 700,
                background: isSolved ? 'rgba(34,211,238,0.1)' : 'rgba(251,191,36,0.1)',
                color: isSolved ? '#22d3ee' : '#fbbf24',
                border: `1px solid ${isSolved ? 'rgba(34,211,238,0.3)' : 'rgba(251,191,36,0.3)'}`,
              }}>
                {isSolved ? '? Solved' : '? Unanswered'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {isAnon ? 'Anonymous' : a.author_type} ? {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
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
        {/* Report button "? always visible to non-owners */}
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

      {/* -- Application APPLY BUTTON -- */}
      {isApplicationPost && onApply && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => onApply(a)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(252,238,10,0.1)', border: '1px solid var(--cyber-yellow)', color: 'var(--cyber-yellow)', borderRadius: 8, padding: '9px 20px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(252,238,10,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(252,238,10,0.1)'}>
            <i className="fa-solid fa-microphone"></i> APPLY NOW
          </button>
        </div>
      )}

      {/* -- POLL OPTIONS -- */}
      {isPoll && pollOptions.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pollOptions.map((opt, i) => {
            const votes = (pollVotes[opt] || []).length;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isMyChoice = myVote === opt;
            const isClosed = a.event_metadata?.is_closed;
            const isWinning = isClosed && opt === a.event_metadata?.winning_option;
            return (
              <button key={i} onClick={() => onVote && !isClosed && onVote(a.id, opt, pollVotes)} disabled={!!myVote || isClosed}
                className={isWinning ? 'poll-winning-option' : ''}
                style={{ position: 'relative', overflow: 'hidden', width: '100%', textAlign: 'left', background: isMyChoice ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMyChoice ? '#a855f7' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '10px 14px', cursor: myVote || isClosed ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)', transition: 'border-color 0.2s' }}>
                {myVote && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isMyChoice ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', transition: 'width 0.4s ease', borderRadius: 8 }} />}
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{isMyChoice && <i className="fa-solid fa-check" style={{ marginRight: 8, color: '#a855f7', fontSize: 11 }}></i>}{opt}</span>
                  {myVote && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{pct}% ? {votes}</span>}
                </div>
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{myVote ? ` � You voted "${myVote}"` : a.event_metadata?.is_closed ? " � Poll Closed" : " � Click to vote"}
          </div>
        </div>
      )}

      {/* -- EVENT POLL BADGE -- */}
      {isPoll && a.event_metadata?.event_date && (
        <EventPollBadge
          eventDate={a.event_metadata.event_date}
          eventTime={a.event_metadata.event_time}
          location={a.event_metadata.location}
        />
      )}

      {/* -- POLL CLOSED BANNER -- */}
      {isPoll && a.event_metadata?.is_closed && (
        <div className="poll-closed-banner">
          <i className="fa-solid fa-lock"></i>
          <span>
            Poll closed on {new Date(a.event_metadata.closed_at).toLocaleDateString()}
            {a.event_metadata.winning_option && ` � Winning option: ${a.event_metadata.winning_option}`}
          </span>
        </div>
      )}

      {/* -- POLL CLOSURE BUTTON -- */}
      {isPoll && user && a.community_id && (
        <PollClosureButton
          announcementId={a.id}
          communityId={a.community_id}
          userRankLevel={userRankLevel}
          hasEventMetadata={!!a.event_metadata?.event_date}
          isClosed={!!a.event_metadata?.is_closed}
          onPollClosed={(eventId) => {
            // Reload announcements to show updated state
            window.location.reload();
          }}
        />
      )}

      {/* -- GENERATED EVENT LINK -- */}
      {isPoll && a.event_metadata?.generated_event_id && (
        <GeneratedEventLink
          eventId={a.event_metadata.generated_event_id}
          eventTitle={a.event_metadata.winning_option || 'Campus Event'}
          isAdmin={user?.user_type === 'Admin'}
          onViewEvents={onViewEvents}
        />
      )}

      {/* -- SHOWCASE TAG BAR -- */}
      {isShowcase && user && (
        <ShowcaseTagBar
          announcementId={a.id}
          authorId={a.author_id}
          communityId={a.community_id}
          currentUserId={user.id}
          currentUserName={user.full_name || user.student_id || 'User'}
          onShowToast={(msg) => {
            // Use existing toast system if available, or console.error
            console.error(msg);
          }}
        />
      )}

      {/* -- COMMENT SECTION -- */}
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
                {comments.map(c => {
                  const isSolutionComment = c.id === a.solution_comment_id;
                  return (
                  <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                      {(c.author_name || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, background: isSolutionComment ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSolutionComment ? 'rgba(34,211,238,0.4)' : containsBadWord(c.content) ? 'rgba(247,95,95,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '8px 12px' }}>
                      {/* Solution badge */}
                      {isSolutionComment && (
                        <div style={{ fontSize: 10, color: '#22d3ee', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ? Accepted Answer
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            ? solved {timeSince(c.created_at)}
                          </span>
                        </div>
                      )}
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
                      {/* Mark / Unmark Solution button */}
                      {isQuestion && isAuthorizedSolver && (
                        <button
                          onClick={() => markSolution(c.id)}
                          disabled={markingSolution}
                          style={{
                            marginTop: 6, fontSize: 10, padding: '2px 8px', borderRadius: 8, cursor: 'pointer',
                            border: isSolutionComment ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            background: isSolutionComment ? 'rgba(34,211,238,0.1)' : 'transparent',
                            color: isSolutionComment ? '#22d3ee' : 'var(--text-muted)',
                          }}
                        >
                          {isSolutionComment ? '? Unmark Solution' : '? Mark as Solution'}
                        </button>
                      )}
                    </div>
                    {/* Heart react */}
                    {user?.is_verified && (
                      <button onClick={() => toggleCommentHeart(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: commentHearts[c.id]?.likedByMe ? '#f43f5e' : 'var(--text-muted)', padding: '2px 0 0 38px', fontFamily: 'inherit', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                        onMouseLeave={e => e.currentTarget.style.color = commentHearts[c.id]?.likedByMe ? '#f43f5e' : 'var(--text-muted)'}>
                        <i className={commentHearts[c.id]?.likedByMe ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
                        {commentHearts[c.id]?.count > 0 && <span>{commentHearts[c.id].count}</span>}
                      </button>
                    )}
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
                  );
                })}
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

// -- ONLINE USERS STACK -------------------------------------------------------
function OnlineStack({ onlineProfiles, circleMateIds, avatarCache, maxShow = 5, onClick }) {
  if (!onlineProfiles.length) return null;

  // Sort: circle mates first, then others
  const sorted = [...onlineProfiles].sort((a, b) => {
    const aIsMate = circleMateIds.has(a.id);
    const bIsMate = circleMateIds.has(b.id);
    return bIsMate - aIsMate;
  });

  const shown = sorted.slice(0, maxShow);
  const rest = onlineProfiles.length - shown.length;

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? 'See who\'s online' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((p, i) => {
          const url = avatarCache[p.student_id] || p.avatar_url;
          const initials = (p.full_name || '?')[0].toUpperCase();
          return (
            <div key={p.id} title={p.full_name}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '2px solid var(--card-bg)',
                background: url ? 'transparent' : 'rgba(0,240,255,0.15)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--cyber-cyan)',
                marginLeft: i === 0 ? 0 : -8,
                zIndex: maxShow - i,
                position: 'relative',
                flexShrink: 0,
              }}>
              {url
                ? <img src={url} alt={p.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
          );
        })}
        {rest > 0 && (
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '2px solid var(--card-bg)',
            background: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
            marginLeft: -8, position: 'relative', zIndex: 0, flexShrink: 0,
          }}>
            +{rest}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ecf8e', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {onlineProfiles.length} online
        </span>
      </div>
    </div>
  );
}

// -- CHAT TIME SEPARATOR -------------------------------------------------------
function ChatTimeSeparator({ date }) {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now - d) / 86400000);
  let label;
  if (diffDays === 0) {
    label = 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    label = 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    label = d.toLocaleDateString([], { weekday: 'long' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
  }
  return (
    <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

// -- UNREAD DIVIDER -----------------------------------------------------------
function UnreadDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(247,95,95,0.4)' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
        NEW MESSAGES
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(247,95,95,0.4)' }} />
    </div>
  );
}

// -- MESSAGE ITEM --------------------------------------------------------------
function MessageItem({ m, tagColor, isOwnerMsg, canDelete, onDelete, onEdit, onReport, currentStudentId, avatarUrl, onViewProfile, online, readers, isLastOwn, isGrouped, isLastInGroup, userCustomizations, onReply }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(m.content);
  const [hovered, setHovered] = useState(false);
  const [reactions, setReactions] = useState({});
  const [reactorNames, setReactorNames] = useState({}); // studentId -> full_name
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactors, setShowReactors] = useState(false); // show the reactions modal
  const [reactorTab, setReactorTab] = useState('all'); // active tab in the modal

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
        // Fetch names for all reactors
        const ids = [...new Set(data.map(r => r.student_id).filter(Boolean))];
        if (ids.length) {
          const { data: accounts } = await supabase
            .from('accounts').select('ctu_id, full_name').in('ctu_id', ids);
          if (accounts) {
            const map = {};
            accounts.forEach(a => { map[a.ctu_id] = a.full_name; });
            setReactorNames(map);
          }
        }
      }
    };
    load();
  }, [m.id]);

  const toggleReaction = async (type) => {
    const mine = reactions[type]?.includes(currentStudentId);
    if (mine) {
      // Remove the reaction if clicking the same emoji
      await supabase.from('message_reactions')
        .delete().eq('message_id', m.id).eq('student_id', currentStudentId);
      setReactions(prev => ({ ...prev, [type]: (prev[type] || []).filter(s => s !== currentStudentId) }));
    } else {
      // Delete any existing reaction first, then add the new one
      await supabase.from('message_reactions')
        .delete().eq('message_id', m.id).eq('student_id', currentStudentId);
      await supabase.from('message_reactions')
        .insert([{ message_id: m.id, student_id: currentStudentId, reaction: type }]);
      
      // Update state: remove user from all reactions, then add to the new one
      const updated = {};
      Object.keys(reactions).forEach(key => {
        updated[key] = (reactions[key] || []).filter(s => s !== currentStudentId);
      });
      updated[type] = [...(updated[type] || []), currentStudentId];
      setReactions(updated);
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
    <div className={`chat-row ${isOwnerMsg ? 'own' : 'other'} ${isGrouped ? 'grouped' : ''}`}>
      {!isOwnerMsg && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {!isGrouped ? (
            <>
              <div className="chat-avatar" onClick={() => onViewProfile && onViewProfile(m.student_id)}
                style={{ background: avatarUrl ? 'transparent' : tagColor, overflow: 'hidden', cursor: onViewProfile ? 'pointer' : 'default' }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              {online && (
                <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: '#3ecf8e', border: '2px solid var(--bg-black)', zIndex: 1 }} />
              )}
            </>
          ) : (
            <div style={{ width: 40, height: 40 }} />
          )}
        </div>
      )}

      <div className="chat-body"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {!isOwnerMsg && !isGrouped && (
          <div className="chat-meta">
            <span className="chat-name" onClick={() => onViewProfile && onViewProfile(m.student_id)}
              style={{ cursor: onViewProfile ? 'pointer' : 'default', transition: 'color 0.15s' }}
              onMouseEnter={e => { if (onViewProfile) e.target.style.color = 'var(--cyber-cyan)'; }}
              onMouseLeave={e => { e.target.style.color = ''; }}>
              <CustomizedUsername 
                studentId={m.student_id} 
                username={m.full_name}
                customizations={userCustomizations[m.student_id]}
              />
            </span>
            {m.role && m.role !== 'MEMBER' && <span className="chat-role">{m.role}</span>}
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
            style={{
              ...(containsBadWord(m.content) ? { borderColor: 'rgba(247,95,95,0.5)', background: isOwnerMsg ? 'rgba(247,95,95,0.15)' : 'rgba(247,95,95,0.08)' } : {}),
              borderRadius: isOwnerMsg 
                ? (isGrouped && !isLastInGroup ? '16px 16px 4px 16px' : isGrouped && isLastInGroup ? '16px 4px 16px 16px' : '16px')
                : (isGrouped && !isLastInGroup ? '16px 16px 16px 4px' : isGrouped && isLastInGroup ? '4px 16px 16px 16px' : '16px')
            }}>
            {containsBadWord(m.content) && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Flagged content
              </div>
            )}
            {/* Reply quote block */}
            {m.reply_to_id && (
              <div style={{ background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid rgba(0,240,255,0.5)', borderRadius: '6px 6px 0 0', padding: '5px 8px', marginBottom: 6, fontSize: 11 }}>
                <div style={{ color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 2 }}>{m.reply_to_author || 'Unknown'}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {m.reply_to_preview || '...'}
                </div>
              </div>
            )}
            <MediaMessage message={m} />
          </div>
        )}

        {/* Inline action bar "? appears below bubble on hover */}
        {showActions && (
          <div className={`chat-actions ${isOwnerMsg ? 'own' : 'other'}`}>
            {/* Reply button */}
            <button className="chat-action-btn" onClick={() => onReply && onReply(m)} title="Reply">
              <i className="fa-solid fa-reply"></i>
            </button>
            {/* Emoji reaction button */}
            <div style={{ position: 'relative' }}>
              <button className="chat-action-btn" onClick={() => setShowEmojiPicker(p => !p)} title="React">
                <i className="fa-regular fa-face-smile"></i>
              </button>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '100%', [isOwnerMsg ? 'right' : 'left']: 0, display: 'flex', gap: 4, background: 'var(--bg-card, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 8px', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {[['heart','❤️'],['laugh','😂'],['sad','😢'],['fire','🔥'],['wow','😮']].map(([type, emoji]) => (
                    <button key={type} onClick={() => { toggleReaction(type); setShowEmojiPicker(false); }}
                      style={{ background: reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.15)' : 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 4px', borderRadius: 8, transition: 'transform 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div style={{ position: 'relative' }}>
            {/* Single row of all reaction chips — click any to open the unified popup */}
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: isOwnerMsg ? 'flex-end' : 'flex-start' }}>
              {[['heart','❤️'],['laugh','😂'],['sad','😢'],['fire','🔥'],['wow','😮']].map(([type, emoji]) =>
                reactions[type]?.length > 0 ? (
                  <button key={type} onClick={() => { setShowReactors(true); setReactorTab(type); }}
                    style={{ background: reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '2px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}>
                    {emoji} <span style={{ fontSize: 11 }}>{reactions[type].length}</span>
                  </button>
                ) : null
              )}
            </div>

            {/* Unified reactions popup — rendered as fixed overlay to avoid layout glitch */}
            {showReactors && (
              <>
                {/* Backdrop to close on outside click */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setShowReactors(false)} />
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)',
                  [isOwnerMsg ? 'right' : 'left']: 0,
                  background: 'rgba(15,15,28,0.98)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 14, zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  minWidth: 220, maxWidth: 280, overflow: 'hidden',
                }}>
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '6px 8px', gap: 4, overflowX: 'auto' }}>
                  {/* All tab */}
                  {(() => {
                    const total = Object.values(reactions).reduce((s, arr) => s + arr.length, 0);
                    return (
                      <button onClick={() => setReactorTab('all')}
                        style={{ background: reactorTab === 'all' ? 'rgba(0,240,255,0.15)' : 'none', border: `1px solid ${reactorTab === 'all' ? 'var(--cyber-cyan)' : 'transparent'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: reactorTab === 'all' ? 'var(--cyber-cyan)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        All {total}
                      </button>
                    );
                  })()}
                  {[['heart','❤️'],['laugh','😂'],['sad','😢'],['fire','🔥'],['wow','😮']].map(([type, emoji]) =>
                    reactions[type]?.length > 0 ? (
                      <button key={type} onClick={() => setReactorTab(type)}
                        style={{ background: reactorTab === type ? 'rgba(0,240,255,0.15)' : 'none', border: `1px solid ${reactorTab === type ? 'var(--cyber-cyan)' : 'transparent'}`, borderRadius: 20, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: reactorTab === type ? 'var(--cyber-cyan)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {emoji} {reactions[type].length}
                      </button>
                    ) : null
                  )}
                  <button onClick={() => setShowReactors(false)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                {/* Reactor list */}
                <div style={{ padding: '6px 4px', maxHeight: 180, overflowY: 'auto' }}>
                  {[['heart','❤️'],['laugh','😂'],['sad','😢'],['fire','🔥'],['wow','😮']]
                    .filter(([type]) => reactorTab === 'all' || reactorTab === type)
                    .flatMap(([type, emoji]) =>
                      (reactions[type] || []).map(id => ({ id, emoji, type }))
                    )
                    .map(({ id, emoji }) => (
                      <div key={`${emoji}-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: id === currentStudentId ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.85)' }}>
                          {reactorNames[id] || '...'}
                          {id === currentStudentId && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-muted)' }}>you</span>}
                        </span>
                        <span style={{ fontSize: 16 }}>{emoji}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {isOwnerMsg && !editing && (isLastInGroup || m.edited) && (
          <div className="chat-meta own">
            {m.edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
            {isLastInGroup && <span className="chat-time">{time}</span>}
            {isLastInGroup && readers?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }} title={readers.map(r => r.full_name).join(', ')}>
                {readers.slice(0, 10).map((r, i) => (
                  <div key={r.reader_id} style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '1px solid var(--card-bg)',
                    background: r.avatar_url ? 'transparent' : 'rgba(0,240,255,0.2)',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 7, fontWeight: 700, color: 'var(--cyber-cyan)',
                    marginLeft: i === 0 ? 0 : -4, position: 'relative', zIndex: 10 - i, flexShrink: 0,
                  }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt={r.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (r.full_name?.[0] || '?').toUpperCase()
                    }
                  </div>
                ))}
                {readers.length > 10 && (
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--card-bg)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'var(--text-muted)', marginLeft: -4, flexShrink: 0 }}>
                    +{readers.length - 10}
                  </div>
                )}
              </div>
            )}
            {isLastInGroup && (!readers || readers.length === 0) && (isLastOwn || hovered) && (
              <span style={{ marginLeft: 3, color: 'var(--text-muted)', fontSize: 10 }} title="Sent">
                <i className="fa-solid fa-check" />
              </span>
            )}
          </div>
        )}
        {/* Time for other users' messages — shown below the last bubble in a group */}
        {!isOwnerMsg && !editing && isLastInGroup && (
          <div className="chat-meta" style={{ marginTop: 2 }}>
            <span className="chat-time">{time}</span>
          </div>
        )}
      </div>
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

// -- CREATE MODAL --------------------------------------------------------------
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
    const token = localStorage.getItem('accessToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    else if (userId) headers['x-user-id'] = userId;

    try {
      const res = await fetch(getApiUrl('/api/communities'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim(), category: form.category, icon: form.icon }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Failed to submit request.'); setLoading(false); return; }
      // Request submitted for approval
      alert(`Your circle "${form.name.trim()}" has been submitted for admin approval. You'll be notified once it's reviewed.`);
      onClose();
    } catch {
      alert('Network error ? could not submit request.');
    }
    setLoading(false);
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
            {loading ? 'SUBMITTING...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />SUBMIT FOR APPROVAL</>}
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

// -- MEMBER CARD ---------------------------------------------------------------
function MemberCard({ m, onSetRank, onKick, coLeaderCount, moderatorCount, canManage = true, onGivePoints, onFlagUser, communityCategory, onUpdateRole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [trustPoints, setTrustPoints] = useState(10);
  const menuRef = useRef(null);
  const name = m.accounts?.full_name || '??';
  const initials = name !== '??'
    ? name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  // Load trust points
  useEffect(() => {
    if (!m.user_id) return;
    supabase.from('account_status')
      .select('trust_points')
      .eq('id', m.user_id)
      .single()
      .then(({ data }) => setTrustPoints(data?.trust_points ?? 10));
  }, [m.user_id]);

  const ranks = [
    { level: 2, label: 'Co-Leader',  capped: coLeaderCount >= 2 },
    { level: 1, label: 'Moderator',  capped: moderatorCount >= 3 },
    { level: 0, label: 'Member',     capped: false },
  ].filter(r => r.level !== m.rank_level);

  return (
    <div className="member-card">
      <div className="member-card-avatar">
        {m.accounts?.avatar_url ? (
          <img src={m.accounts.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      <div className="member-card-info">
        <div className="member-card-name">{name}</div>
        <div className="member-card-sub">
          <span style={{ color: rankColor(m.rank_level), fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            {rankLabel(m.rank_level)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
            {m.accounts?.ctu_id}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <TrustPointsBadge points={trustPoints} size="small" showLabel={false} />
        </div>
        {/* Project Role Dropdown - only for project communities */}
        {communityCategory === 'project' && canManage && (
          <div style={{ marginTop: 8 }}>
            <select
              value={m.project_role || ''}
              onChange={(e) => onUpdateRole && onUpdateRole(m.id, e.target.value)}
              disabled={!canManage}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: 10,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,240,255,0.2)',
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">No Role</option>
              <option value="Leader">?? Leader</option>
              <option value="Developer">?? Developer</option>
              <option value="Designer">?? Designer</option>
              <option value="Tester">?? Tester</option>
              <option value="Other">?? Other</option>
            </select>
          </div>
        )}
      </div>
      <div className="member-card-actions" ref={menuRef}>
        <button className="member-card-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          <i className="fa-solid fa-ellipsis-vertical"></i>
        </button>
        {menuOpen && (
          <div className="member-card-dropdown">
            {/* Give Points - always available */}
            {onGivePoints && (
              <>
                <button onClick={() => { onGivePoints(m); setMenuOpen(false); }} style={{ color: 'var(--cyber-cyan)' }}>
                  <i className="fa-solid fa-heart"></i> Give Trust Points
                </button>
                <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
              </>
            )}
            
            {/* Management actions - only for leaders/co-leaders */}
            {canManage && (
              <>
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
              </>
            )}
            
            {/* Flag User - only for leaders/co-leaders */}
            {canManage && onFlagUser && (
              <button onClick={() => { onFlagUser(m); setMenuOpen(false); }} style={{ color: 'var(--cyber-yellow)' }}>
                <i className="fa-solid fa-flag"></i> Flag for Admin Review
              </button>
            )}
            
            {/* Kick - only for leaders/co-leaders */}
            {canManage && (
              <>
                <div style={{ borderTop: '1px solid #222', margin: '4px 0' }}></div>
                <button onClick={() => { onKick(m.id, name); setMenuOpen(false); }} style={{ color: 'var(--red)' }}>
                  <i className="fa-solid fa-user-xmark"></i> Kick from Circle
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -- MANAGE GROUP MODAL --------------------------------------------------------
function ManageGroupModal({ comm, onClose, onSaved, viewerIsOwner, viewerRankLevel = 0, onGivePoints, onFlagUser }) {
  const [form, setForm] = useState({ name: comm.name, description: comm.description || '', category: comm.category || 'academic' });
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leader, setLeader] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(viewerIsOwner ? 'settings' : 'members');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(comm.logo_url || null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMode, setLogoMode] = useState(comm.logo_url ? 'photo' : 'icon'); // 'icon' | 'photo'
  const logoInputRef = useRef(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    // fetch leader profile with avatar
    const { data: leaderData } = await supabase
      .from('accounts')
      .select('full_name, ctu_id, account_details(avatar_url)')
      .eq('id', comm.creator_id)
      .single();
    if (leaderData) setLeader({ 
      full_name: leaderData.full_name, 
      student_id: leaderData.ctu_id, 
      avatar_url: leaderData.account_details?.avatar_url 
    });

    const { data, error } = await supabase
      .from('memberships')
      .select(`
        *,
        accounts:user_id (
          full_name,
          ctu_id,
          account_details(avatar_url)
        )
      `)
      .eq('community_id', comm.id);
    
    if (error) {
      console.error('Error fetching members:', error);
    }
    
    if (data) {
      setMembers(data.filter(m => m.status === 'active').map(m => ({
        ...m,
        accounts: {
          ...m.accounts,
          avatar_url: m.accounts?.account_details?.avatar_url
        }
      })));
      setRequests(data.filter(m => m.status === 'pending'));
      setRequests(data.filter(m => m.status === 'pending'));
    }
    setLoadingMembers(false);
  }, [comm.id, comm.creator_id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const saveSettings = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const updates = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      logo_url: logoMode === 'photo' && logoUrl ? logoUrl : null,
    };
    // Use service-role API to bypass RLS
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl(`/api/upload-cover`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...updates, communityId: comm.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (err.message || res.status));
        setSaving(false);
        return;
      }
      onSaved({ ...comm, ...updates });
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const SIZE = 200;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(SIZE / img.width, SIZE / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          ctx.drawImage(img, (SIZE - sw) / 2, (SIZE - sh) / 2, sw, sh);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });
      setLogoUrl(compressed);
      setLogoMode('photo');
    } catch (err) { console.error(err); }
    finally { setLogoUploading(false); }
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

  const updateMemberRole = async (membershipId, newRole) => {
    const { error } = await supabase
      .from('memberships')
      .update({ project_role: newRole || null })
      .eq('id', membershipId);
    
    if (error) {
      alert('Failed to update role: ' + error.message);
    } else {
      fetchMembers();
    }
  };

  const searchInviteStudent = async () => {
    if (!inviteSearch.trim()) return;
    setInviteSearching(true);
    setInviteResult(null);
    const { data } = await supabase.from('accounts')
      .select('id, full_name, ctu_id')
      .ilike('ctu_id', `%${inviteSearch.trim()}%`)
      .limit(1).single();
    setInviteResult(data ? { ...data, student_id: data.ctu_id } : null);
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
      status: 'invited',
    }]);
    if (!error) {
      await supabase.from('notifications').insert([{
        user_id: inviteResult.id,
        type: 'circle_invite',
        message: `You've been invited to join "${comm.name}"! Visit Explore to accept or decline.`,
        link_comm_id: comm.id,
      }]);
      setInviteSearch('');
      setInviteResult(null);
      alert(`Invite sent to ${inviteResult.full_name}. They can accept or decline from their notifications.`);
    } else {
      alert('Failed to send invite.');
    }
    setInviting(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manage-modal-box" onClick={e => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h2><i className="fa-solid fa-gear" style={{ marginRight: 10 }}></i>CIRCLE SETTINGS</h2>
          <button className="manage-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="manage-tabs">
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              <i className="fa-solid fa-sliders"></i><span> Settings</span>
            </button>
          )}
          <button className={`manage-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            <i className="fa-solid fa-users"></i><span> Members {members.length > 0 && `(${members.length})`}</span>
          </button>
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              <i className="fa-solid fa-user-clock"></i><span> Requests</span>
              {requests.length > 0 && <span className="req-badge">{requests.length}</span>}
            </button>
          )}
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'Application' ? 'active' : ''}`} onClick={() => setTab('Application')}>
              <i className="fa-solid fa-microphone"></i><span> Application</span>
            </button>
          )}
          {(viewerIsOwner || viewerRankLevel >= 2) && (
            <button className={`manage-tab ${tab === 'invite' ? 'active' : ''}`} onClick={() => setTab('invite')}>
              <i className="fa-solid fa-user-plus"></i><span> Invite</span>
            </button>
          )}
        </div>

        {tab === 'settings' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            {/* CIRCLE LOGO */}
            <div className="input-group">
              <label>CIRCLE LOGO</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={() => setLogoMode('icon')}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${logoMode === 'icon' ? 'var(--cyber-cyan)' : '#333'}`, background: logoMode === 'icon' ? 'rgba(0,240,255,0.1)' : 'transparent', color: logoMode === 'icon' ? 'var(--cyber-cyan)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  <i className="fa-solid fa-icons" style={{ marginRight: 6 }} />ICON
                </button>
                <button type="button" onClick={() => { setLogoMode('photo'); logoInputRef.current?.click(); }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${logoMode === 'photo' ? 'var(--cyber-cyan)' : '#333'}`, background: logoMode === 'photo' ? 'rgba(0,240,255,0.1)' : 'transparent', color: logoMode === 'photo' ? 'var(--cyber-cyan)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  {logoUploading ? <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} /> : <i className="fa-solid fa-image" style={{ marginRight: 6 }} />}PHOTO
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              </div>
              {/* Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid #222' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {logoMode === 'photo' && logoUrl
                    ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className={comm.icon || getCategoryIcon(comm.category)} style={{ fontSize: 22, color: 'var(--cyber-cyan)' }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{form.name || comm.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {logoMode === 'photo' && logoUrl ? 'Custom photo set' : 'Using category icon'}
                  </div>
                </div>
                {logoMode === 'photo' && logoUrl && (
                  <button type="button" onClick={() => { setLogoUrl(null); setLogoMode('icon'); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}
                    title="Remove photo">
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>
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
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this channel's purpose..." />
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
                {leader?.avatar_url ? (
                  <img src={leader.avatar_url} alt={leader.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
                    {leader?.full_name
                      ? leader.full_name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                      : '?'}
                  </span>
                )}
              </div>
              <div className="members-banner-name">{leader?.full_name || '"?'}</div>
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
                    // Filter out the leader from members list to avoid duplicate display
                    const membersWithoutLeader = members.filter(m => m.user_id !== comm?.creator_id);
                    const coLeaderCount = membersWithoutLeader.filter(m => m.rank_level === 2).length;
                    const moderatorCount = membersWithoutLeader.filter(m => m.rank_level === 1).length;
                    return [
                      { label: 'Co-Leaders', filter: m => m.rank_level === 2, cap: 2 },
                      { label: 'Moderators', filter: m => m.rank_level === 1, cap: 3 },
                      { label: 'Members',    filter: m => m.rank_level === 0, cap: null },
                    ].map(({ label, filter, cap }) => {
                      const group = membersWithoutLeader.filter(filter);
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
                              canManage={viewerRankLevel >= 2}
                              onGivePoints={onGivePoints}
                              onFlagUser={viewerRankLevel >= 2 ? onFlagUser : null}
                              communityCategory={comm.category}
                              onUpdateRole={updateMemberRole}
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

        {tab === 'requests' && (viewerIsOwner || viewerRankLevel >= 2) && (
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
                      <td style={{ color: 'var(--text-primary)' }}>{r.accounts?.full_name || '??'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--cyber-cyan)' }}>{r.accounts?.ctu_id || '??'}</td>
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

        {tab === 'Application' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            <ApplicationFormBuilder
              comm={comm}
              onToggle={(enabled) => onSaved({ ...comm, application_enabled: enabled })}
            />
            {comm.application_enabled && (
              <>
                <div className="Application-section-label" style={{ marginTop: 24 }}>
                  <span>Applications Received</span>
                </div>
                <ApplicationReviewPanel comm={comm} />
              </>
            )}
          </div>
        )}

        {tab === 'invite' && (viewerIsOwner || viewerRankLevel >= 2) && (
          <div className="manage-tab-content">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyber-cyan)', marginBottom: 6 }}>
                <i className="fa-solid fa-user-plus" style={{ marginRight: 8 }}></i>Personal Invite
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Search for a CTU student by their Student ID and invite them directly into the circle, bypassing the Application process.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="channel-name-input"
                style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                placeholder="Enter Student ID (e.g. 1234567)"
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

// -- PROFILE MODAL -------------------------------------------------------------
const INTEREST_LABELS = {
  art: 'Art', coding: 'Coding', design: 'Design', gaming: 'Gaming',
  music: 'Music', sports: 'Sports', research: 'Research',
  photography: 'Photography', writing: 'Writing', travel: 'Travel',
  debate: 'Debate', language: 'Language Learning', anime: 'Anime',
  bxgl: 'Watching BL/GL',
};
const INTEREST_BUBBLES = Object.entries(INTEREST_LABELS).map(([id, label]) => ({ id, label }));
const COURSES = ['BEED','BIT AUTO TECH','BIT COM TECH','BIT ELEC TECH','BSED MATH','BSFI','BSHM','BSIE','BSIT','BTLED-HE'];

// -- PROFILE TRUST POINTS SECTION ---------------------------------------------
function ProfileTrustPointsSection({ userId, onViewHistory }) {
  const [trustPoints, setTrustPoints] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase
        .from('account_status')
        .select('trust_points')
        .eq('id', userId)
        .single();
      setTrustPoints(data?.trust_points ?? 10);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 16, color: 'var(--text-muted)' }}></i>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>
        TRUST POINTS
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TrustPointsBadge points={trustPoints} size="large" showLabel={true} />
        <button
          onClick={onViewHistory}
          style={{
            background: 'rgba(0,240,255,0.1)',
            border: '1px solid rgba(0,240,255,0.3)',
            color: 'var(--cyber-cyan)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <i className="fa-solid fa-history"></i>
          View History
        </button>
      </div>
      {trustPoints < 10 && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <i className="fa-solid fa-info-circle" style={{ marginRight: 4, color: 'var(--cyber-cyan)' }}></i>
          You can earn points through peer appreciation and daily good behavior.
        </div>
      )}
    </div>
  );
}

// -- PROFILE PHOTOS SECTION ----------------------------------------------------
function ProfilePhotosSection({ user, readOnly, editing }) {
  const [photos, setPhotos] = useState([null, null]);
  const [photoUploading, setPhotoUploading] = useState([false, false]);
  const [reactions, setReactions] = useState({});
  const photoRefs = [useRef(null), useRef(null)];

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profile_photos').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        const arr = [null, null];
        data.forEach(p => { arr[p.slot - 1] = p; });
        setPhotos(arr);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    const photoIds = photos.filter(p => p?.id).map(p => p.id);
    if (!photoIds.length) return;
    supabase.from('profile_photo_reactions').select('photo_id, user_id').in('photo_id', photoIds)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(r => {
          if (!map[r.photo_id]) map[r.photo_id] = { count: 0, myReact: false };
          map[r.photo_id].count++;
          if (r.user_id === user.id) map[r.photo_id].myReact = true;
        });
        setReactions(map);
      });
  }, [photos[0]?.id, photos[1]?.id, user?.id]);

  const handleUpload = async (slotIdx, file) => {
    if (!file) return;
    setPhotoUploading(prev => { const n = [...prev]; n[slotIdx] = true; return n; });
    const ext = file.name.split('.').pop();
    const path = `profile-photos/${user.id}/slot${slotIdx + 1}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const slot = slotIdx + 1;
      await supabase.from('profile_photos').upsert({ user_id: user.id, slot, photo_url: publicUrl, is_public: photos[slotIdx]?.is_public ?? true }, { onConflict: 'user_id,slot' });
      setPhotos(prev => { const n = [...prev]; n[slotIdx] = { ...(n[slotIdx] || {}), photo_url: publicUrl, slot, is_public: n[slotIdx]?.is_public ?? true }; return n; });
    }
    setPhotoUploading(prev => { const n = [...prev]; n[slotIdx] = false; return n; });
  };

  const handleDelete = async (slotIdx) => {
    await supabase.from('profile_photos').delete().eq('user_id', user.id).eq('slot', slotIdx + 1);
    setPhotos(prev => { const n = [...prev]; n[slotIdx] = null; return n; });
  };

  const togglePrivacy = async (slotIdx) => {
    const current = photos[slotIdx];
    if (!current) return;
    const newVal = !current.is_public;
    await supabase.from('profile_photos').update({ is_public: newVal }).eq('user_id', user.id).eq('slot', slotIdx + 1);
    setPhotos(prev => { const n = [...prev]; n[slotIdx] = { ...n[slotIdx], is_public: newVal }; return n; });
  };

  const toggleReact = async (photoId) => {
    const curr = reactions[photoId];
    if (curr?.myReact) {
      await supabase.from('profile_photo_reactions').delete().eq('photo_id', photoId).eq('user_id', user.id);
      setReactions(prev => ({ ...prev, [photoId]: { count: (prev[photoId]?.count || 1) - 1, myReact: false } }));
    } else {
      await supabase.from('profile_photo_reactions').insert([{ photo_id: photoId, user_id: user.id }]);
      setReactions(prev => ({ ...prev, [photoId]: { count: (prev[photoId]?.count || 0) + 1, myReact: true } }));
    }
  };

  const visiblePhotos = readOnly ? photos.filter(p => p?.is_public) : photos;
  if (readOnly && visiblePhotos.every(p => !p)) return null;

  return (
    <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>PHOTOS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[0, 1].map(i => {
          const photo = photos[i];
          const isUploading = photoUploading[i];
          return (
            <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {photo?.photo_url ? (
                <>
                  <img src={photo.photo_url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {!readOnly && editing && (
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button onClick={() => togglePrivacy(i)} title={photo.is_public ? 'Public' : 'Private'}
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: photo.is_public ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                        <i className={`fa-solid ${photo.is_public ? 'fa-globe' : 'fa-lock'}`}></i>
                      </button>
                      <button onClick={() => photoRefs[i].current?.click()} title="Replace"
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: 'white' }}>
                        <i className="fa-solid fa-camera"></i>
                      </button>
                      <button onClick={() => handleDelete(i)} title="Delete"
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: 'var(--red)' }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  )}
                  {readOnly && photo.id && (
                    <button onClick={() => toggleReact(photo.id)}
                      style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                      <i className="fa-solid fa-heart" style={{ color: reactions[photo.id]?.myReact ? '#ff4d6d' : 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}></i>
                      {reactions[photo.id]?.count > 0 && <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>{reactions[photo.id].count}</span>}
                    </button>
                  )}
                </>
              ) : (
                !readOnly && editing && (
                  <div onClick={() => photoRefs[i].current?.click()}
                    style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {isUploading
                      ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22 }}></i>
                      : <><i className="fa-solid fa-plus" style={{ fontSize: 22 }}></i><span style={{ fontSize: 11 }}>Add Photo</span></>
                    }
                  </div>
                )
              )}
              {!readOnly && editing && (
                <input ref={photoRefs[i]} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleUpload(i, e.target.files[0])} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- PROFILE MODAL -------------------------------------------------------------
function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl, readOnly }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || user.avatar_url || null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const idPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploaded, setIdUploaded] = useState(!!user.id_photo_url);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ course: user.course || '', year_level: user.year_level || '', interests: user.interests || [], bio: user.bio || '' });
  const [profile, setProfile] = useState({ course: user.course || '', year_level: user.year_level || '', interests: user.interests || [], bio: user.bio || '' });
  const [coverUrl, setCoverUrl] = useState(user.cover_url || null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [showWarningHistory, setShowWarningHistory] = useState(false);
  const [appealingWarning, setAppealingWarning] = useState(null);
  const [customizations, setCustomizations] = useState(null);
  const [ownedItems, setOwnedItems] = useState([]);
  const [custSettings, setCustSettings] = useState(null);
  const [profilePhotos, setProfilePhotos] = useState({ 1: null, 2: null }); // slot -> { id, photo_url, is_public }
  const [photoUploading, setPhotoUploading] = useState(null); // slot being uploaded
  const photo1Ref = useRef(null);
  const photo2Ref = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data, error } = await supabase.from('account_details')
        .select('course, year_level, interests, avatar_url, id_photo_url, cover_url, bio')
        .eq('id', user.id).single();
      if (!error && data) {
        setProfile({ course: data.course || '', year_level: data.year_level || '', interests: data.interests || [], bio: data.bio || '' });
        setEditForm({ course: data.course || '', year_level: data.year_level || '', interests: data.interests || [], bio: data.bio || '' });
        if (data.avatar_url && !avatarUrl) setAvatarUrl(data.avatar_url);
        if (data.cover_url) setCoverUrl(data.cover_url);
        if (data.id_photo_url) setIdUploaded(true);
      }
      // Load profile photos
      if (user?.id) {
        const { data: photos } = await supabase.from('profile_photos')
          .select('*').eq('user_id', user.id);
        if (photos) {
          const map = { 1: null, 2: null };
          photos.forEach(p => { map[p.slot] = p; });
          setProfilePhotos(map);
        }
      }
    };
    load();
  }, [user?.id]);

  // Load active customizations + owned items
  useEffect(() => {
    if (!user?.id) return;
    const loadCustomizations = async () => {
      const { data: settings } = await supabase
        .from('user_profile_settings')
        .select('active_badge, active_name_color, active_background, active_theme, active_avatar_border, active_companion')
        .eq('user_id', user.id)
        .maybeSingle();

      setCustSettings(settings || {});

      if (settings) {
        const itemIds = [settings.active_badge, settings.active_name_color, settings.active_background, settings.active_theme, settings.active_avatar_border, settings.active_companion].filter(Boolean);
        if (itemIds.length > 0) {
          const { data: items } = await supabase.from('shop_items').select('*').in('id', itemIds);
          if (items) {
            setCustomizations({
              badge: items.find(i => i.id === settings.active_badge),
              name_color: items.find(i => i.id === settings.active_name_color),
              background: items.find(i => i.id === settings.active_background),
              theme: items.find(i => i.id === settings.active_theme),
              avatar_border: items.find(i => i.id === settings.active_avatar_border),
              companion: items.find(i => i.id === settings.active_companion),
            });
          }
        }
      }

      // Load owned items for the customize panel
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('item_id, shop_items(*)')
        .eq('user_id', user.id);
      if (purchases) setOwnedItems(purchases);
    };
    loadCustomizations();
  }, [user?.id]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/update-profile?userId=${user.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: editForm.course, year_level: editForm.year_level, interests: editForm.interests, bio: editForm.bio }),
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

  const handlePhotoUpload = async (slot, file) => {
    if (!file || !user?.id) return;
    setPhotoUploading(slot);
    try {
      const ext = file.name.split('.').pop();
      const path = `profile-photos/${user.id}/slot${slot}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;
      const existing = profilePhotos[slot];
      if (existing) {
        await supabase.from('profile_photos').update({ photo_url: photoUrl }).eq('id', existing.id);
        setProfilePhotos(prev => ({ ...prev, [slot]: { ...existing, photo_url: photoUrl } }));
      } else {
        const { data } = await supabase.from('profile_photos').insert([{ user_id: user.id, photo_url: photoUrl, slot, is_public: true }]).select().single();
        setProfilePhotos(prev => ({ ...prev, [slot]: data }));
      }
    } catch (err) { console.error('Photo upload error:', err); }
    setPhotoUploading(null);
  };

  const handlePhotoDelete = async (slot) => {
    const photo = profilePhotos[slot];
    if (!photo) return;
    await supabase.from('profile_photos').delete().eq('id', photo.id);
    setProfilePhotos(prev => ({ ...prev, [slot]: null }));
  };

  const togglePhotoPrivacy = async (slot) => {
    const photo = profilePhotos[slot];
    if (!photo) return;
    const newVal = !photo.is_public;
    await supabase.from('profile_photos').update({ is_public: newVal }).eq('id', photo.id);
    setProfilePhotos(prev => ({ ...prev, [slot]: { ...photo, is_public: newVal } }));
  };

  const applyCustomization = async (type, itemId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'apply-customization', userId: user.id, type, itemId }),
      });
      if (!res.ok) return;
      clearCustomizationCache(user.id);
      // Update local settings state
      setCustSettings(prev => ({ ...prev, [`active_${type}`]: itemId }));
      // Reload customizations display
      if (itemId) {
        const { data: item } = await supabase.from('shop_items').select('*').eq('id', itemId).single();
        if (item) setCustomizations(prev => ({ ...prev, [type]: item }));
      } else {
        setCustomizations(prev => ({ ...prev, [type]: null }));
      }
    } catch (err) { console.error(err); }
  };

  const handleIdPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIdUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `id-photos/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('id-photos')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('id-photos').getPublicUrl(path);
      const { error: dbError } = await supabase.from('account_details').update({ id_photo_url: urlData.publicUrl }).eq('id', user.id);
      if (dbError) throw dbError;
      setIdUploaded(true);
    } catch (err) {
      console.error(err);
      alert('Failed to upload ID photo. Please try again.');
    } finally { setIdUploading(false); }
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const W = 900, H = 300;
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(W / img.width, H / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });
      
      // Update UI immediately
      setCoverUrl(compressed);
      
      // Save via backend API (has service role permissions)
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/update-profile'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          userId: user.id, 
          cover_url: compressed 
        }),
      });
      
      if (res.ok) {
        // Also update localStorage
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, cover_url: compressed }));
      } else {
        console.error('Failed to save cover photo');
        setCoverUrl(user.cover_url || null); // Revert on failure
      }
    } catch (err) { 
      console.error(err); 
      setCoverUrl(user.cover_url || null); // Revert on error
    }
    finally { setCoverUploading(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });
      setAvatarUrl(compressed);
      onAvatarUpdate(compressed);
      const res = await fetch(getApiUrl(`/api/upload-avatar`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, avatar: compressed }),
      });
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (res.ok) {
        const { url } = await res.json();
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: url }));
      } else {
        localStorage.setItem('currentUser', JSON.stringify({ ...stored, avatar_url: compressed }));
      }
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  const coverGradients = [
    'linear-gradient(135deg,#0d3b6e 0%,#00f0ff 100%)',
    'linear-gradient(135deg,#1a003a 0%,#c084fc 100%)',
    'linear-gradient(135deg,#003a1a 0%,#3ecf8e 100%)',
    'linear-gradient(135deg,#3a1a00 0%,#f97316 100%)',
    'linear-gradient(135deg,#1a0a0f 0%,#f43f5e 100%)',
  ];
  const gradIdx = (user.student_id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % coverGradients.length;
  const coverBg = coverUrl ? `url(${coverUrl}) center/cover no-repeat` : coverGradients[gradIdx];

  const getBackgroundStyle = () => {
    if (customizations?.background?.css_data) {
      const data = typeof customizations.background.css_data === 'string' 
        ? JSON.parse(customizations.background.css_data) 
        : customizations.background.css_data;
      
      if (data.pattern) {
        return {
          background: data.pattern,
          backgroundSize: data.size || '30px 30px'
        };
      }
      if (data.backgroundImage) {
        return {
          backgroundImage: data.backgroundImage,
          backgroundSize: data.backgroundSize || 'cover',
          backgroundPosition: data.backgroundPosition || 'center',
          backgroundRepeat: data.backgroundRepeat || 'no-repeat',
        };
      }
      if (data.image) {
        return { 
          background: data.image,
          backgroundSize: data.backgroundSize || 'auto',
          backgroundRepeat: data.backgroundRepeat || 'repeat'
        };
      }
      if (data.gradient) return { background: data.gradient };
    }
    return {};
  };

  const getThemeStyle = () => {
    if (customizations?.theme?.css_data) {
      const data = typeof customizations.theme.css_data === 'string' 
        ? JSON.parse(customizations.theme.css_data) 
        : customizations.theme.css_data;
      
      return {
        '--cyber-cyan': data.primary || 'var(--cyber-cyan)',
        '--cyber-yellow': data.secondary || 'var(--cyber-yellow)'
      };
    }
    return {};
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: 'var(--card-bg)',
        ...getBackgroundStyle(),
        ...getThemeStyle(),
        border: '1px solid rgba(0,240,255,0.15)',
        borderRadius: 16, width: '100%', maxWidth: 820,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,240,255,0.2) transparent',
      }}>

        {/* COVER */}
        <div className="profile-modal-cover" style={{ position: 'relative', height: 220, background: coverBg, borderRadius: '16px 16px 0 0', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
          {!readOnly && editing && (
            <>
              <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading} title="Change cover"
                style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(6px)' }}>
                {coverUploading ? <><i className="fa-solid fa-spinner fa-spin" /> UPLOADING</> : <><i className="fa-solid fa-image" /> COVER</>}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </>
          )}
        </div>

        {/* AVATAR + NAME ROW */}
        <div style={{ position: 'relative', padding: '0 28px', marginTop: -60 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="profile-modal-avatar" style={{ 
                width: 116, 
                height: 116, 
                border: customizations?.avatar_border?.css_data?.border || '4px solid var(--card-bg)', 
                borderRadius: '50%', 
                background: 'rgba(0,240,255,0.08)', 
                overflow: 'hidden', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: 38, 
                fontWeight: 800, 
                color: 'var(--cyber-cyan)', 
                boxShadow: customizations?.avatar_border?.css_data?.boxShadow || '0 0 20px rgba(0,240,255,0.25)'
              }}>
                {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              {/* Companion sticker */}
              {customizations?.companion?.css_data && (() => {
                const d = typeof customizations.companion.css_data === 'string'
                  ? JSON.parse(customizations.companion.css_data)
                  : customizations.companion.css_data;
                return (
                  <img
                    src={d.url}
                    alt="companion"
                    className="profile-modal-companion"
                    style={{
                      position: 'absolute',
                      bottom: -18,
                      right: -28,
                      width: '72px',
                      height: 'auto',
                      pointerEvents: 'none',
                      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))',
                      zIndex: 2,
                    }}
                  />
                );
              })()}
              {!readOnly && editing && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Change photo"
                    style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%', background: 'var(--cyber-cyan)', color: '#000', border: '2px solid var(--card-bg)', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-camera" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </>
              )}
            </div>

            <div style={{ paddingBottom: 8, flex: 1, minWidth: 0 }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span className="profile-modal-name" style={{
                  fontSize: 24, 
                  fontWeight: 800,
                  letterSpacing: 1, 
                  lineHeight: 1.2,
                  ...(customizations?.name_color?.css_data 
                    ? (typeof customizations.name_color.css_data === 'string' 
                        ? JSON.parse(customizations.name_color.css_data) 
                        : customizations.name_color.css_data).gradient 
                      ? { 
                          background: (typeof customizations.name_color.css_data === 'string' 
                            ? JSON.parse(customizations.name_color.css_data) 
                            : customizations.name_color.css_data).gradient,
                          backgroundSize: '100%',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          color: 'transparent',
                          display: 'inline-block'
                        }
                      : { 
                          color: (typeof customizations.name_color.css_data === 'string' 
                            ? JSON.parse(customizations.name_color.css_data) 
                            : customizations.name_color.css_data).color 
                        }
                    : { color: 'var(--text-primary)' }
                  )
                }}>
                  {user.full_name?.toUpperCase()}
                </span>
                {customizations?.badge && (
                  <span style={{ fontSize: 16 }} title={customizations.badge.name}>
                    {customizations.badge.preview_url}
                  </span>
                )}
                <span style={{
                  fontSize: 13,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: 1,
                  ...(customizations?.name_color?.css_data
                    ? (() => {
                        const d = typeof customizations.name_color.css_data === 'string'
                          ? JSON.parse(customizations.name_color.css_data)
                          : customizations.name_color.css_data;
                        return d.gradient
                          ? { background: d.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                          : { color: d.color };
                      })()
                    : { color: 'var(--cyber-cyan)' })
                }}>· {user.student_id}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {user.is_verified
                  ? <span className="verified-badge" style={{ fontSize: 11 }}><i className="fa-solid fa-shield-halved" style={{ marginRight: 5 }} />Verified {user.user_type || 'Student'}<i className="fa-solid fa-certificate" style={{ marginLeft: 6, color: 'var(--cyber-cyan)' }} /></span>
                  : <span className="verified-badge" style={{ fontSize: 11, borderColor: 'var(--orange)', color: 'var(--orange)', background: 'rgba(247,169,79,0.05)' }}><i className="fa-solid fa-clock" style={{ marginRight: 5 }} />Pending Verification</span>
                }
              </div>
            </div>

            <div className="profile-edit-actions" style={{ display: 'flex', gap: 8, paddingBottom: 8, flexShrink: 0, marginLeft: 'auto' }}>
              {!readOnly && (!editing
                ? <button className="cyber-btn" onClick={() => setEditing(true)} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}><i className="fa-solid fa-pen" style={{ marginRight: 5 }} />EDIT</button>
                : <>
                    <button className="cyber-btn secondary" onClick={() => setEditing(false)} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>CANCEL</button>
                    <button className="cyber-btn" onClick={saveProfile} disabled={saving} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>
                      {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 5 }} />SAVING</> : 'SAVE'}
                    </button>
                  </>
              )}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="profile-modal-body" style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Member Since — always read-only */}
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${editing ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 10, padding: '10px 14px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>BIO</div>
                {editing ? (
                  <>
                    <textarea
                      value={editForm.bio}
                      onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                      maxLength={200}
                      placeholder="Write something about yourself..."
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', fontFamily: 'inherit', minHeight: 60, boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{(editForm.bio || '').length}/200</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: profile.bio ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.6, fontStyle: profile.bio ? 'normal' : 'italic' }}>
                    {profile.bio || 'No bio yet.'}
                  </div>
                )}
              </div>
              {/* Course — editable inline */}
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${editing ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>COURSE</div>
                {editing ? (
                  <select value={editForm.course} onChange={e => setEditForm(f => ({ ...f, course: e.target.value }))}
                    className="dark-select"
                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--cyber-cyan)', fontSize: 13, fontWeight: 700, padding: 0, outline: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ background: '#1a1a2e', color: 'white' }}>Select course</option>
                    {COURSES.map(c => <option key={c} value={c} style={{ background: '#1a1a2e', color: 'white' }}>{c}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)' }}>{profile.course || '—'}</div>
                )}
              </div>
              {/* Year — editable inline, students only */}
              {user.user_type !== 'Faculty' && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${editing ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>YEAR</div>
                {editing ? (
                  <select value={editForm.year_level} onChange={e => setEditForm(f => ({ ...f, year_level: e.target.value }))}
                    className="dark-select"
                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--cyber-cyan)', fontSize: 13, fontWeight: 700, padding: 0, outline: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ background: '#1a1a2e', color: 'white' }}>Select year</option>
                    {['1st Year','2nd Year','3rd Year','4th Year'].map(y => <option key={y} value={y} style={{ background: '#1a1a2e', color: 'white' }}>{y}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)' }}>{profile.year_level || '—'}</div>
                )}
              </div>
              )}
            </div>

            {/* Trust Points Badge */}
            <ProfileTrustPointsSection userId={user.id} onViewHistory={() => setShowWarningHistory(true)} />

            {/* Interests — view or edit inline */}
            {(!editing && profile.interests?.length > 0) && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>INTERESTS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {profile.interests.map(id => (
                    <span key={id} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.3)', color: 'var(--cyber-cyan)', fontWeight: 600 }}>
                      {INTEREST_LABELS[id] || id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!readOnly && editing && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid var(--cyber-cyan)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>INTERESTS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INTEREST_BUBBLES.map(({ id, label }) => (
                    <span key={id}
                      onClick={() => setEditForm(f => ({ ...f, interests: f.interests.includes(id) ? f.interests.filter(i => i !== id) : [...f.interests, id] }))}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                        background: editForm.interests.includes(id) ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${editForm.interests.includes(id) ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
                        color: editForm.interests.includes(id) ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* PROFILE PHOTOS */}
            <ProfilePhotosSection user={user} readOnly={readOnly} editing={editing} />

            {/* CUSTOMIZE panel — shown in edit mode */}
            {!readOnly && editing && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid var(--cyber-cyan)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
                  <i className="fa-solid fa-palette" style={{ marginRight: 6 }} />CUSTOMIZE
                </div>
                {ownedItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>You don't own any items yet. Visit the Profile Shop to get some!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {['badge', 'name_color', 'avatar_border', 'background', 'companion', 'theme'].map(type => {
                      const typeItems = ownedItems.filter(p => p.shop_items?.type === type);
                      if (typeItems.length === 0) return null;
                      const activeId = custSettings?.[`active_${type}`];
                      return (
                        <div key={type}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 7, textTransform: 'uppercase' }}>
                            {type.replace('_', ' ')}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => applyCustomization(type, null)}
                              style={{ padding: '5px 11px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                                background: !activeId ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.4)',
                                color: !activeId ? '#000' : 'var(--text-muted)',
                                border: `1px solid ${!activeId ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}` }}>
                              None
                            </button>
                            {typeItems.map(p => (
                              <button key={p.item_id} onClick={() => applyCustomization(type, p.item_id)}
                                title={p.shop_items.name}
                                style={{ padding: '5px 11px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                                  background: activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.4)',
                                  color: activeId === p.item_id ? '#000' : 'var(--text-primary)',
                                  border: `1px solid ${activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}` }}>
                                {/* Show emoji for badges, name for everything else */}
                                {p.shop_items.type === 'badge' && p.shop_items.preview_url
                                  ? <>{p.shop_items.preview_url} {p.shop_items.name}</>
                                  : p.shop_items.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!readOnly && !user.is_verified && (
              <div style={{ padding: '12px 14px', background: 'rgba(247,169,79,0.06)', border: '1px solid rgba(247,169,79,0.25)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                  <i className="fa-solid fa-id-card" style={{ marginRight: 6 }} />SCHOOL ID VERIFICATION
                </div>
                {idUploaded && (
                  <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />ID submitted ? awaiting admin review
                  </div>
                )}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  {idUploaded ? 'Want to send a clearer photo? Upload a new one below.' : 'Upload a clear photo of your CTU school ID so the admin can verify your account.'}
                </p>
                <button className="cyber-btn" onClick={() => idPhotoRef.current?.click()} disabled={idUploading}
                  style={{ width: '100%', background: 'rgba(247,169,79,0.15)', borderColor: 'var(--orange)', color: 'var(--orange)', fontSize: 11 }}>
                  {idUploading ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />UPLOADING...</> : <><i className="fa-solid fa-upload" style={{ marginRight: 6 }} />{idUploaded ? 'RE-UPLOAD SCHOOL ID' : 'UPLOAD SCHOOL ID'}</>}
                </button>
                <input ref={idPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleIdPhotoUpload} />
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {communities.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>MY CIRCLES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                  {communities.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--cyber-cyan)', overflow: 'hidden' }}>
                        {c.logo_url
                          ? <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                          : <i className={c.faIcon || c.icon || 'fa-solid fa-circle-nodes'} style={{ fontSize: 12 }} />
                        }
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              {!readOnly && (
                <button className="cyber-btn danger" onClick={onLogout} style={{ width: '100%', fontSize: 11, background: 'rgba(180,30,30,0.85)', borderColor: 'var(--red)', color: '#fff', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 6 }} />LOGOUT
                </button>
              )}
              <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', fontSize: 11, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.5)', color: 'var(--cyber-cyan)', fontWeight: 700 }}>CLOSE</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Warning History Modal */}
      {showWarningHistory && (
        <WarningHistoryModal
          userId={user.id}
          onClose={() => setShowWarningHistory(false)}
          onAppeal={(warning) => { setAppealingWarning(warning); setShowWarningHistory(false); }}
        />
      )}
      
      {/* Appeal Modal */}
      {appealingWarning && (
        <AppealModal
          warning={appealingWarning}
          userId={user.id}
          onClose={() => { setAppealingWarning(null); setShowWarningHistory(true); }}
        />
      )}
    </div>
  );
}

function ApplicationDetailModal({ data, onClose }) {
  const { response: r, community: c, questions } = data;
  const statusColor = ApplicationStatusColor(r.status, r.phase2_result);
  const statusLabel = ApplicationStatusLabel(r.status, r.phase2_result);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3><i className="fa-solid fa-microphone" style={{ marginRight: 8 }}></i>My Application "? {c.name}</h3>

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
              <i className="fa-solid fa-calendar" style={{ marginRight: 6 }}></i>PHASE 2 "? LIVE SCREENING
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
                  {r.answers?.[q.id] || '"?'}
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
  // Create the report only "? admin reviews and decides on formal warnings
  await supabase.from('reports').insert([{
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    content_type: contentType,
    content_id: contentId,
    content_preview: contentPreview?.slice(0, 200),
    reason: 'Auto-detected: inappropriate language',
    status: 'pending',
  }]);
  // Send a mild alert to the user (no point deduction "? admin decides that)
  if (reportedUserId) {
    await supabase.from('notifications').insert([{
      user_id: reportedUserId,
      type: 'application_update',
      message: 'Your message was flagged for inappropriate language and blocked. Please follow community guidelines.',
    }]);
  }
}

// -- REPORT MODAL -------------------------------------------------------------
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

// -- GIVE POINTS MODAL ---------------------------------------------------------
function GivePointsModal({ targetUser, onClose, currentUser, communityId, myRankLevel }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const maxAmount = myRankLevel >= 2 ? 0.5 : 0.3;
  const maxRecipients = myRankLevel >= 2 ? 5 : 3;

  const submit = async () => {
    if (!reason.trim() || amount <= 0) return;
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'give-appreciation',
          giverId: currentUser.id,
          receiverId: targetUser.id,
          amount: amount,
          reason: reason.trim(),
          communityId: communityId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to give points');
        setSubmitting(false);
        return;
      }

      setDone(true);
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-heart" style={{ fontSize: 36, color: 'var(--cyber-cyan)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-cyan)', marginBottom: 8 }}>Points Sent!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              You gave <strong style={{ color: 'var(--cyber-yellow)' }}>{amount} point{amount !== 1 ? 's' : ''}</strong> to <strong>{targetUser.full_name}</strong>
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-heart" style={{ marginRight: 8 }}></i>
              Give Trust Points
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Recognize {targetUser.full_name} for positive contributions
            </p>

            {/* Target user card */}
            <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cyber-cyan), #00a2ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#000', overflow: 'hidden' }}>
                {targetUser.avatar_url ? (
                  <img src={targetUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  targetUser.full_name?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{targetUser.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{targetUser.ctu_id}</div>
              </div>
            </div>

            {/* Amount selector */}
            <div className="input-group">
              <label>POINTS TO GIVE (Max: {maxAmount})</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0.1, 0.2, 0.3, myRankLevel >= 2 ? 0.4 : null, myRankLevel >= 2 ? 0.5 : null].filter(Boolean).map(val => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className="cyber-btn"
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: 13,
                      background: amount === val ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.1)',
                      color: amount === val ? '#000' : 'var(--cyber-cyan)',
                      border: `1px solid ${amount === val ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.3)'}`
                    }}
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="input-group">
              <label>REASON (REQUIRED)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., 'Helped me understand the lesson', 'Great team player', 'Organized a helpful event'"
                style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                maxLength={200}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {reason.length}/200
              </div>
            </div>

            {/* Daily limit info */}
            <div style={{ background: 'rgba(252,238,10,0.08)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--cyber-yellow)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>
              Daily limit: {maxRecipients} recipients ? Cooldown: 12 hours per person
            </div>

            {error && (
              <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button className="cyber-btn" onClick={submit} disabled={submitting || !reason.trim() || amount <= 0} style={{ flex: 1 }}>
                {submitting ? 'Sending...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Give Points</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- FLAG USER MODAL -----------------------------------------------------------
function FlagUserModal({ targetUser, onClose, currentUser, communityId }) {
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const SEVERITIES = [
    { value: 'minor', label: 'Minor', desc: 'Small issue, needs attention', color: 'var(--orange)' },
    { value: 'moderate', label: 'Moderate', desc: 'Concerning behavior', color: 'var(--cyber-yellow)' },
    { value: 'severe', label: 'Severe', desc: 'Serious violation', color: 'var(--red)' },
    { value: 'critical', label: 'Critical', desc: 'Immediate admin action needed', color: '#ff0000' },
  ];

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'flag-user',
          flaggerId: currentUser.id,
          flaggedUserId: targetUser.id,
          communityId: communityId,
          reason: reason.trim(),
          severity: severity
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to flag user');
        setSubmitting(false);
        return;
      }

      setDone(true);
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-flag-checkered" style={{ fontSize: 36, color: 'var(--cyber-yellow)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-yellow)', marginBottom: 8 }}>Flag Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              A system admin will review this flag within 24-48 hours.
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-yellow)' }}>
              <i className="fa-solid fa-flag" style={{ marginRight: 8 }}></i>
              Flag User for Admin Review
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              This will notify admins to review {targetUser.full_name}'s behavior. Only admins can issue official warnings.
            </p>

            {/* Target user card */}
            <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.15)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cyber-yellow), #f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#000', overflow: 'hidden' }}>
                {targetUser.avatar_url ? (
                  <img src={targetUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  targetUser.full_name?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{targetUser.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{targetUser.ctu_id}</div>
              </div>
            </div>

            {/* Severity selector */}
            <div className="input-group">
              <label>SEVERITY LEVEL</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SEVERITIES.map(s => (
                  <label
                    key={s.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${severity === s.value ? s.color : 'rgba(255,255,255,0.08)'}`,
                      background: severity === s.value ? `${s.color}15` : 'transparent',
                      transition: '0.15s'
                    }}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={s.value}
                      checked={severity === s.value}
                      onChange={() => setSeverity(s.value)}
                      style={{ accentColor: s.color }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: severity === s.value ? s.color : 'var(--text-primary)' }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="input-group">
              <label>REASON (REQUIRED)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe the issue in detail. Include specific examples if possible."
                style={{ width: '100%', minHeight: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                maxLength={500}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {reason.length}/500
              </div>
            </div>

            {/* Warning */}
            <div style={{ background: 'rgba(247,95,95,0.08)', border: '1px solid rgba(247,95,95,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--red)' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
              False flagging may result in consequences for your account. Be honest and factual.
            </div>

            {error && (
              <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="cyber-btn"
                onClick={submit}
                disabled={submitting || !reason.trim()}
                style={{ flex: 1, background: 'rgba(252,238,10,0.15)', color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)' }}
              >
                {submitting ? 'Submitting...' : <><i className="fa-solid fa-flag" style={{ marginRight: 6 }}></i>Submit Flag</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- WARNING HISTORY MODAL -----------------------------------------------------
function WarningHistoryModal({ userId, onClose, onAppeal }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active'); // 'active' | 'appealed' | 'overturned'

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_warnings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setWarnings(data || []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const getSeverityColor = (s) => {
    if (s === 'critical') return 'var(--red)';
    if (s === 'severe') return '#ff5555';
    if (s === 'moderate') return 'var(--cyber-yellow)';
    return 'var(--orange)';
  };

  const getStatusBadge = (status) => {
    const map = {
      active: { label: 'Active', color: 'var(--red)', bg: 'rgba(247,95,95,0.15)' },
      appealed: { label: 'Appealed', color: 'var(--cyber-yellow)', bg: 'rgba(252,238,10,0.15)' },
      overturned: { label: 'Overturned', color: '#3ecf8e', bg: 'rgba(62,207,142,0.15)' },
      expired: { label: 'Expired', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
    };
    const s = map[status] || map.active;
    return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}` }}>{s.label}</span>;
  };

  const filtered = warnings.filter(w => {
    if (tab === 'active') return w.status === 'active';
    if (tab === 'appealed') return w.status === 'appealed';
    if (tab === 'overturned') return w.status === 'overturned' || w.status === 'expired';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: 6, color: 'var(--red)' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>
          Warning History
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
          All warnings issued to your account.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
          {['active', 'appealed', 'overturned'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'rgba(0,240,255,0.1)' : 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--cyber-cyan)' : '2px solid transparent',
                color: tab === t ? 'var(--cyber-cyan)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: '0.2s'
              }}
            >
              {t} ({warnings.filter(w => t === 'overturned' ? (w.status === 'overturned' || w.status === 'expired') : w.status === t).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 10 }}></i>
            <p>Loading warnings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 32, color: '#3ecf8e', marginBottom: 10 }}></i>
            <p>No {tab} warnings</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(w => (
              <div
                key={w.id}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${getSeverityColor(w.severity)}`,
                  borderRadius: 10,
                  padding: 16,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: getSeverityColor(w.severity), textTransform: 'uppercase', letterSpacing: 1 }}>
                        {w.severity}
                      </span>
                      {getStatusBadge(w.status)}
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{w.reason}</p>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)', marginLeft: 12 }}>
                    -{w.points_deducted} pts
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <i className="fa-solid fa-clock" style={{ marginRight: 4 }}></i>
                  {new Date(w.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>

                {w.status === 'active' && (
                  <button
                    onClick={() => onAppeal(w)}
                    style={{
                      marginTop: 12,
                      width: '100%',
                      background: 'rgba(0,240,255,0.1)',
                      border: '1px solid rgba(0,240,255,0.3)',
                      color: 'var(--cyber-cyan)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <i className="fa-solid fa-gavel"></i>
                    Appeal This Warning
                  </button>
                )}

                {w.appeal_reason && (
                  <div style={{ marginTop: 10, padding: 10, background: 'rgba(252,238,10,0.08)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyber-yellow)', marginBottom: 4 }}>
                      <i className="fa-solid fa-gavel" style={{ marginRight: 4 }}></i> Appeal Submitted
                    </div>
                    <p style={{ fontSize: 12, margin: 0, color: 'var(--text-primary)' }}>{w.appeal_reason}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', marginTop: 18 }}>Close</button>
      </div>
    </div>
  );
}

// -- APPEAL MODAL --------------------------------------------------------------
function AppealModal({ warning, onClose, userId }) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/moderation'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'appeal-warning',
          warningId: warning.id,
          userId: userId,
          appealReason: reason.trim(),
          evidence: evidence.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit appeal');
        setSubmitting(false);
        return;
      }

      setDone(true);
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const getSeverityColor = (s) => {
    if (s === 'critical') return 'var(--red)';
    if (s === 'severe') return '#ff5555';
    if (s === 'moderate') return 'var(--cyber-yellow)';
    return 'var(--orange)';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <i className="fa-solid fa-gavel" style={{ fontSize: 36, color: 'var(--cyber-cyan)', marginBottom: 14, display: 'block' }}></i>
            <h3 style={{ color: 'var(--cyber-cyan)', marginBottom: 8 }}>Appeal Submitted</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              A system admin will review your appeal within 24-48 hours.
            </p>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 6, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-gavel" style={{ marginRight: 8 }}></i>
              Appeal Warning
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Explain why you believe this warning was issued incorrectly.
            </p>

            {/* Warning being appealed */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${getSeverityColor(warning.severity)}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: getSeverityColor(warning.severity), textTransform: 'uppercase', letterSpacing: 1 }}>
                  {warning.severity} WARNING
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', marginLeft: 'auto' }}>
                  -{warning.points_deducted} pts
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 0' }}>{warning.reason}</p>
            </div>

            {/* Appeal reason */}
            <div className="input-group">
              <label>YOUR APPEAL (REQUIRED)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this warning should be overturned. Be clear and factual."
                style={{ width: '100%', minHeight: 100, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                maxLength={500}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {reason.length}/500
              </div>
            </div>

            {/* Evidence (optional) */}
            <div className="input-group">
              <label>EVIDENCE (OPTIONAL)</label>
              <textarea
                value={evidence}
                onChange={e => setEvidence(e.target.value)}
                placeholder="Provide any additional context, screenshots, or proof that supports your appeal."
                style={{ width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                maxLength={500}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {evidence.length}/500
              </div>
            </div>

            {/* Info box */}
            <div style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }}></i>
              If your appeal is approved, the points will be restored to your account plus a +1 bonus.
            </div>

            {error && (
              <div style={{ background: 'rgba(247,95,95,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }}></i>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="cyber-btn"
                onClick={submit}
                disabled={submitting || !reason.trim()}
                style={{ flex: 1 }}
              >
                {submitting ? 'Submitting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Submit Appeal</>}
              </button>
              <button className="cyber-btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -- MAIN PORTAL ---------------------------------------------------------------
export default function UserPortal() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser')));
  const user = currentUser;
  const [communities, setCommunities] = useState([GLOBAL_COMM]);
  const [myMemberships, setMyMemberships] = useState([]); // { community_id, role, status }
  const [activeCommId, setActiveCommId] = useState(() => new URLSearchParams(window.location.search).get('commId') || 'global');
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get('section') || 'home');
  const [messages, setMessages] = useState([]);
  const [userCustomizations, setUserCustomizations] = useState({}); // studentId -> customizations
  const [avatarCache, setAvatarCache] = useState({}); // student_id -> avatar_url
  const [profileIdCache, setProfileIdCache] = useState({}); // student_id -> UUID
  const msgInputRef = useRef('');
  const circleChatInputRef = useRef('');
  const [pendingMedia, setPendingMedia] = useState(null); // { file, mediaType, duration? }
  const [uploading, setUploading] = useState(false);
  const [circleChatMessages, setCircleChatMessages] = useState([]);
  const [circlePendingMedia, setCirclePendingMedia] = useState(null);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [circleChatMembers, setCircleChatMembers] = useState([]); // members for the panel
  const [showApplicationForm, setShowApplicationForm] = useState(null); // { comm, Application? }
  const [myApplications, setMyApplications] = useState([]);
  const [viewingApplication, setViewingApplication] = useState(null); // { response, community, questions }
  const [search, setSearch] = useState('');
  const [clock, setClock] = useState(new Date());
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);

  // Helper: update section + community in both state and URL so back/refresh work
  const navTo = useCallback((newSection, newCommId) => {
    const comm = newCommId !== undefined ? newCommId : activeCommId;
    setSection(newSection);
    if (newCommId !== undefined) setActiveCommId(newCommId);
    // Push a real history entry when leaving home so back returns here first.
    // Replace when already on a non-home section (no need to stack multiple entries).
    const params = new URLSearchParams();
    params.set('section', newSection);
    if (comm && comm !== 'global') params.set('commId', comm);
    const url = window.location.pathname + '?' + params.toString();
    if (newSection !== 'home' && (new URLSearchParams(window.location.search).get('section') || 'home') === 'home') {
      window.history.pushState({ portalNav: true }, '', url);
    } else {
      window.history.replaceState({ portalNav: true }, '', url);
    }
  }, [activeCommId]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('chat'); // chat, tasks (tasks only for project circles)
  const [activeCategory, setActiveCategory] = useState('all');
  const [feedFilter, setFeedFilter] = useState('all'); // filter for home feed post types
  const [announcements, setAnnouncements] = useState([]);
  const [circleAnnouncements, setCircleAnnouncements] = useState([]);
  const [qaFilter, setQaFilter] = useState('all'); // 'all' | 'questions' | 'unanswered'
  const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''], event_metadata: null });
  const [newCirclePost, setNewCirclePost] = useState({ title: '', content: '', post_type: 'announcement', pollOptions: ['', ''], event_metadata: null });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showCircleAnnouncements, setShowCircleAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const toastTimer = useRef(null);
  const feedBottomRef = useRef(null);
  const firstUnreadRef = useRef(null); // ref to scroll to on load
  const firstUnreadMsgId = useRef(null); // message id of the first unread message
  const sectionRef = useRef(section); // track current section for popstate handler
  const openAnnouncementsOnEnter = useRef(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showDock, setShowDock] = useState(false);
  const [memberCounts, setMemberCounts] = useState({});
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(loadTheme);
  const [showReport, setShowReport] = useState(null); // { type, id, preview, reportedUserId }
  const [viewingProfile, setViewingProfile] = useState(null); // fetched profile object for viewing
  const [showGivePoints, setShowGivePoints] = useState(null); // { targetUser }
  const [showFlagUser, setShowFlagUser] = useState(null); // { targetUser }
  const [showShop, setShowShop] = useState(false); // Profile Shop modal
  const [showHelp, setShowHelp] = useState(false); // Help Center modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [messageReads, setMessageReads] = useState({}); // message_id -> [{ reader_id, full_name, avatar_url }]
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [campusEvents, setCampusEvents] = useState([]);
  const [circleEvents, setCircleEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Block navigation away from /portal when on home feed — show logout modal instead
  const blocker = { state: 'idle', reset: () => {}, proceed: () => {} };

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowLogoutConfirm(true);
    }
  }, [blocker.state]);

  // When user cancels logout, just close the modal
  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // When user confirms logout
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/auth');
  };

  const viewUserProfile = async (studentId) => {
    if (!studentId) return;
    const { data, error } = await supabase
      .from('accounts')
      .select('id, full_name, ctu_id, user_type, account_status(is_verified), account_details(course, year_level, interests, avatar_url, cover_url)')
      .eq('ctu_id', String(studentId)).single();
    if (!error && data) {
      const flat = {
        ...data,
        student_id: data.ctu_id,
        is_verified: data.account_status?.is_verified,
        ...(data.account_details || {}),
      };
      delete flat.account_status; delete flat.account_details;
      // fetch their active circle memberships
      const { data: memberships } = await supabase
        .from('memberships')
        .select('community_id')
        .eq('user_id', data.id)
        .in('status', ['active', 'approved']);
      
      let circles = [];
      if (memberships?.length) {
        const commIds = memberships.map(m => m.community_id);
        const { data: comms } = await supabase
          .from('communities')
          .select('id, name, icon, cover_url, logo_url, category')
          .in('id', commIds);
        circles = comms || [];
      }
      setViewingProfile({ ...flat, _circles: circles });
    } else {
      console.error('viewUserProfile error:', error, 'studentId:', studentId);
    }
  };

  // Fetch read receipts (reader profiles) for a batch of messages
  // Also treats reactors as implicit readers since reacting means they saw the message
  const fetchReadCounts = useCallback(async (msgIds) => {
    if (!msgIds?.length) return;

    // Fetch actual reads
    const { data: reads } = await supabase
      .from('message_reads')
      .select('message_id, reader_id, accounts:reader_id(full_name, account_details(avatar_url))')
      .in('message_id', msgIds);

    // Fetch reactors (implicit reads)
    const { data: reacts } = await supabase
      .from('message_reactions')
      .select('message_id, student_id, accounts:student_id(id, full_name, account_details(avatar_url))')
      .in('message_id', msgIds);

    const grouped = {};
    msgIds.forEach(id => { grouped[id] = []; });

    // Add actual readers
    (reads || []).forEach(r => {
      if (!grouped[r.message_id]) grouped[r.message_id] = [];
      if (!grouped[r.message_id].find(x => x.reader_id === r.reader_id)) {
        grouped[r.message_id].push({
          reader_id: r.reader_id,
          full_name: r.accounts?.full_name || '',
          avatar_url: r.accounts?.account_details?.avatar_url || null,
        });
      }
    });

    // Add reactors as implicit readers — use accounts.id (UUID) for consistent dedup
    (reacts || []).forEach(r => {
      const uuid = r.accounts?.id;
      if (!uuid) return;
      if (!grouped[r.message_id]) grouped[r.message_id] = [];
      if (!grouped[r.message_id].find(x => x.reader_id === uuid)) {
        grouped[r.message_id].push({
          reader_id: uuid,
          full_name: r.accounts?.full_name || '',
          avatar_url: r.accounts?.account_details?.avatar_url || null,
        });
      }
    });

    // Final dedup pass — ensure no duplicate reader_ids per message
    Object.keys(grouped).forEach(msgId => {
      const seen = new Set();
      grouped[msgId] = grouped[msgId].filter(r => {
        if (seen.has(r.reader_id)) return false;
        seen.add(r.reader_id);
        return true;
      });
    });

    setMessageReads(prev => ({ ...prev, ...grouped }));
  }, []);

  // Mark visible messages as read
  const markMessagesRead = useCallback(async (msgs) => {
    if (!user?.id || !msgs?.length) return;
    // Only attempt if user has a real Supabase auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const others = msgs.filter(m => m.student_id !== user.student_id);
    if (!others.length) return;
    const inserts = others.map(m => ({ message_id: m.id, reader_id: user.id }));
    try {
      await supabase.from('message_reads').upsert(inserts, { onConflict: 'message_id,reader_id', ignoreDuplicates: true });
      const myMsgs = msgs.filter(m => m.student_id === user.student_id).map(m => m.id);
      if (myMsgs.length) fetchReadCounts(myMsgs);
    } catch (_) {}
  }, [user?.id, user?.student_id, fetchReadCounts]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, content, full_name } — message being replied to
  const [navAvatarUrl, setNavAvatarUrl] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return stored?.avatar_url || null;
  });

  // Load campus events
  const loadEvents = useCallback(async () => {
    if (!user) return;
    setEventsLoading(true);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Single query - RLS automatically filters by membership
    const { data, error } = await supabase
      .from('campus_events')
      .select(`
        id,
        community_id,
        title,
        description,
        event_date,
        event_time,
        event_end_date,
        location,
        category,
        is_official,
        communities:community_id (
          id,
          name,
          category
        )
      `)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })
      .limit(50);
    
    if (!error && data) {
      // Separate campus-wide from circle events
      const campus = data.filter(e => e.community_id === null);
      const circles = data.filter(e => e.community_id !== null);
      
      setCampusEvents(campus);
      setCircleEvents(circles);
    } else if (error) {
      console.error('Failed to load events:', error);
    }
    
    setEventsLoading(false);
  }, [user]);

  // -- ONLINE PRESENCE ----------------------------------------------------------
  const [onlineUsers, setOnlineUsers] = useState(new Set()); // set of profile UUIDs

  // On mount: re-check is_verified from DB in case admin approved after login
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('account_status').select('is_verified').eq('id', user.id).single().then(({ data }) => {
      if (data && data.is_verified !== user.is_verified) {
        const updated = { ...user, is_verified: data.is_verified };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        setCurrentUser(updated);
      }
    });
  }, [user?.id]);

  // Heartbeat: update last_seen every 30s
  useEffect(() => {
    if (!user?.id) return;
    const ping = () => fetch(getApiUrl('/api/update-profile?userId=' + user.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_seen: new Date().toISOString() }),
    }).catch(() => {});
    ping();
    const t = setInterval(ping, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  // Poll online users every 30s (online = last_seen within 2 minutes)
  const [onlineProfiles, setOnlineProfiles] = useState([]); // full profile objects of online users
  const [circleMateIds, setCircleMateIds] = useState(new Set()); // UUIDs of users sharing a circle

  useEffect(() => {
    const fetchOnline = async () => {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min window (truly online)
      const { data } = await supabase.from('accounts')
        .select('id, full_name, ctu_id, account_details!inner(avatar_url, last_seen)')
        .gte('account_details.last_seen', since)
        .not('account_details.last_seen', 'is', null);
      const profiles = (data || []).map(a => ({
        ...a, student_id: a.ctu_id, avatar_url: a.account_details?.avatar_url,
      }));
      setOnlineUsers(new Set(profiles.map(p => p.id)));
      // Keep self in the list for display ? just mark them differently if needed
      setOnlineProfiles(profiles);
    };
    fetchOnline();
    const t = setInterval(fetchOnline, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  // Fetch circle mates (people in same circles as you)
  useEffect(() => {
    if (!user?.id || !myMemberships?.length) return;
    const commIds = myMemberships.filter(m => m.status === 'active').map(m => m.community_id);
    if (!commIds.length) return;
    supabase.from('memberships')
      .select('user_id')
      .in('community_id', commIds)
      .eq('status', 'active')
      .neq('user_id', user.id)
      .then(({ data }) => {
        setCircleMateIds(new Set((data || []).map(m => m.user_id)));
      });
  }, [user?.id, myMemberships]);

  const isOnline = useCallback((profileId) => onlineUsers.has(profileId), [onlineUsers]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setShowMoreMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const loadCommunities = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/communities'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setCommunities([GLOBAL_COMM, ...(Array.isArray(data) ? data : [])]);
    } catch {
      setCommunities([GLOBAL_COMM]);
    }
  }, []);

  const loadChannels = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setChannels([]); return; }
    const { data } = await supabase.from('channels').select('*')
      .eq('community_id', commId).order('created_at', { ascending: true });
    setChannels(data || []);
  }, []);

  const loadMyMemberships = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('memberships')
      .select('community_id, rank_level, status, id')
      .eq('user_id', user.id);
    setMyMemberships(data || []);
  }, [user?.id]);

  const loadMyApplications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('application_submissions')
      .select('community_id, status, phase2_result, id')
      .eq('applicant_id', user.id);
    setMyApplications(data || []);
  }, [user?.id]);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase.from('announcements')
      .select('*')
      .is('community_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
    const authorIds = [...new Set((data || []).map(a => a.author_student_id).filter(Boolean))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('accounts').select('ctu_id, account_details(avatar_url)').in('ctu_id', authorIds);
      if (profiles) {
        const map = {};
        profiles.forEach(p => { map[p.ctu_id] = p.account_details?.avatar_url || null; });
        setAvatarCache(prev => ({ ...prev, ...map }));
      }
    }
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
      author_student_id: user.student_id,
      author_name: newPost.anonymous ? 'Anonymous' : user.full_name,
      author_type: newPost.anonymous ? 'Anonymous' : user.user_type,
      title: newPost.title.trim(),
      content: newPost.content.trim(),
      post_type: type,
      community_id: null,
      ...(pollOptions ? { poll_options: pollOptions, poll_votes: {} } : {}),
      ...(type === 'poll' && newPost.event_metadata ? { event_metadata: newPost.event_metadata } : {}),
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
      setNewPost({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''], event_metadata: null });
      loadAnnouncements();
    } else {
      console.error('Post announcement error:', error);
      showToast('Failed to post: ' + (error.message || 'Unknown error'));
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
      author_student_id: user.student_id,
      author_name: user.full_name,
      author_type: user.user_type,
      title: newCirclePost.title.trim(),
      content: newCirclePost.content.trim(),
      post_type: newCirclePost.post_type,
      community_id: commId,
      ...(pollOptions ? { poll_options: pollOptions, poll_votes: {} } : {}),
      ...(newCirclePost.post_type === 'poll' && newCirclePost.event_metadata ? { event_metadata: newCirclePost.event_metadata } : {}),
    }]);
    setPostingAnnouncement(false);
    if (!error) {
      setNewCirclePost({ title: '', content: '', post_type: 'announcement', pollOptions: ['', ''], event_metadata: null });
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

  const fetchAvatarsForMessages = useCallback(async (msgs) => {
    const uncached = [...new Set((msgs || []).map(m => m.student_id).filter(id => id))];
    if (uncached.length === 0) return;
    const { data } = await supabase.from('accounts').select('id, ctu_id, account_details(avatar_url)').in('ctu_id', uncached);
    if (data) {
      const map = {};
      const idMap = {};
      data.forEach(p => {
        map[p.ctu_id] = p.account_details?.avatar_url || null;
        idMap[p.ctu_id] = p.id;
      });
      setAvatarCache(prev => ({ ...prev, ...map }));
      setProfileIdCache(prev => ({ ...prev, ...idMap }));
    }
  }, []);

  const loadCustomizationsForMessages = useCallback(async (msgs) => {
    if (!msgs || msgs.length === 0) return;
    
    const studentIds = [...new Set(msgs.map(m => m.student_id).filter(Boolean))];
    if (studentIds.length === 0) return;

    try {
      // Get account IDs from student IDs
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, ctu_id')
        .in('ctu_id', studentIds);

      if (!accounts || accounts.length === 0) return;

      const accountIds = accounts.map(a => a.id);
      
      // Load all customizations at once
      const { data: settings } = await supabase
        .from('user_profile_settings')
        .select(`
          user_id,
          active_theme,
          active_badge,
          active_name_color,
          active_background
        `)
        .in('user_id', accountIds);

      if (!settings) return;

      // Get shop items for the active customizations
      const itemIds = settings.flatMap(s => 
        [s.active_theme, s.active_badge, s.active_name_color, s.active_background].filter(Boolean)
      );

      const { data: items } = await supabase
        .from('shop_items')
        .select('*')
        .in('id', itemIds);

      if (!items) return;

      // Map back to student IDs
      const customsMap = {};
      accounts.forEach(acc => {
        const setting = settings.find(s => s.user_id === acc.id);
        if (setting) {
          customsMap[acc.ctu_id] = {
            badge: items.find(i => i.id === setting.active_badge),
            name_color: items.find(i => i.id === setting.active_name_color),
            background: items.find(i => i.id === setting.active_background),
            theme: items.find(i => i.id === setting.active_theme)
          };
        }
      });

      setUserCustomizations(prev => ({ ...prev, ...customsMap }));
    } catch (err) {
      console.error('Failed to load customizations:', err);
    }
  }, []);

  const loadMessages = useCallback(async (commId, channelId) => {
    // Reset first unread on each load
    firstUnreadMsgId.current = null;

    const calcFirstUnread = async (msgs) => {
      if (!user?.id || !msgs?.length) return;
      const otherMsgs = msgs.filter(m => m.student_id !== user.student_id);
      if (!otherMsgs.length) return;
      const { data: reads } = await supabase.from('message_reads')
        .select('message_id').eq('reader_id', user.id)
        .in('message_id', otherMsgs.map(m => m.id));
      const readIds = new Set((reads || []).map(r => r.message_id));
      const first = otherMsgs.find(m => !readIds.has(m.id));
      if (first) firstUnreadMsgId.current = first.id;
    };

    if (commId === 'global') {
      const { data } = await supabase.from('messages').select('*')
        .is('community_id', null).order('created_at', { ascending: true });
      await calcFirstUnread(data || []);
      setMessages(data || []);
      fetchAvatarsForMessages(data || []);
      loadCustomizationsForMessages(data || []);
      markMessagesRead(data || []);
      const myIds = (data || []).filter(m => m.student_id === user?.student_id).map(m => m.id);
      if (myIds.length) fetchReadCounts(myIds);
    } else if (channelId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('channel_id', channelId).order('created_at', { ascending: true });
      await calcFirstUnread(data || []);
      setMessages(data || []);
      fetchAvatarsForMessages(data || []);
      loadCustomizationsForMessages(data || []);
      markMessagesRead(data || []);
      const myIds = (data || []).filter(m => m.student_id === user?.student_id).map(m => m.id);
      if (myIds.length) fetchReadCounts(myIds);
    } else if (commId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('community_id', commId)
        .is('channel_id', null)
        .order('created_at', { ascending: true });
      await calcFirstUnread(data || []);
      setMessages(data || []);
      fetchAvatarsForMessages(data || []);
      loadCustomizationsForMessages(data || []);
      markMessagesRead(data || []);
      const myIds = (data || []).filter(m => m.student_id === user?.student_id).map(m => m.id);
      if (myIds.length) fetchReadCounts(myIds);
    } else {
      setMessages([]);
    }
  }, [fetchAvatarsForMessages, loadCustomizationsForMessages, markMessagesRead, fetchReadCounts, user?.student_id, user?.id]);

  const loadCircleChatMessages = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleChatMessages([]); return; }
    firstUnreadMsgId.current = null;
    const { data } = await supabase.from('messages').select('*')
      .eq('community_id', commId)
      .is('channel_id', null)
      .order('created_at', { ascending: true });
    // Find first unread before marking as read
    if (user?.id && data?.length) {
      const otherMsgs = data.filter(m => m.student_id !== user.student_id);
      if (otherMsgs.length) {
        const { data: reads } = await supabase.from('message_reads')
          .select('message_id').eq('reader_id', user.id)
          .in('message_id', otherMsgs.map(m => m.id));
        const readIds = new Set((reads || []).map(r => r.message_id));
        const first = otherMsgs.find(m => !readIds.has(m.id));
        if (first) firstUnreadMsgId.current = first.id;
      }
    }
    setCircleChatMessages(data || []);
    fetchAvatarsForMessages(data || []);
    loadCustomizationsForMessages(data || []);
    markMessagesRead(data || []);
    const myMsgIds = (data || []).filter(m => m.student_id === user?.student_id).map(m => m.id);
    if (myMsgIds.length) fetchReadCounts(myMsgIds);
  }, [fetchAvatarsForMessages, loadCustomizationsForMessages, markMessagesRead, fetchReadCounts, user?.student_id, user?.id]);

  // Initial load + realtime subscription ? re-runs when channel/community changes
  useEffect(() => {
    loadMessages(activeCommId, activeChannelId);
  }, [activeCommId, activeChannelId]); // eslint-disable-line

  // Realtime subscription ? separate from load so it doesn't cause extra reloads
  useEffect(() => {
    const channelName = activeCommId === 'global'
      ? 'realtime:messages:global'
      : `realtime:messages:${activeChannelId || activeCommId}`;

    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          const isGlobal = activeCommId === 'global' && !msg.community_id;
          const isChannel = msg.channel_id === activeChannelId && activeChannelId !== null;
          const isCommunityNoChannel = activeCommId !== 'global' && !activeChannelId && msg.community_id === activeCommId && !msg.channel_id;
          if (isGlobal || isChannel || isCommunityNoChannel) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              fetchAvatarsForMessages([msg]);
              return [...prev, msg];
            });
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => { setMessages(prev => prev.filter(m => m.id !== payload.old.id)); }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => { setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)); }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [activeCommId, activeChannelId]);

  useEffect(() => { loadCommunities(); loadMyMemberships(); loadMyApplications(); loadAnnouncements(); loadNotifications(); }, [loadCommunities, loadMyMemberships, loadMyApplications, loadAnnouncements, loadNotifications]);

  // Load member counts for all communities
  useEffect(() => {
    const ids = communities.filter(c => c.id !== 'global').map(c => c.id);
    if (ids.length === 0) return;
    supabase.from('memberships')
      .select('community_id')
      .in('community_id', ids)
      .eq('status', 'active')
      .then(({ data }) => {
        if (!data) return;
        const counts = {};
        data.forEach(m => { counts[m.community_id] = (counts[m.community_id] || 0) + 1; });
        setMemberCounts(counts);
      });
  }, [communities]);

  // Keep sectionRef in sync
  useEffect(() => { sectionRef.current = section; }, [section]);

  // Ref that always holds the latest state values needed by the back handler.
  // Avoids stale closures — listener registered once, reads fresh values via ref.
  const backStateRef = useRef({});
  useEffect(() => {
    backStateRef.current = {
      section,
      showProfile, viewingProfile, showManage, showMembersPanel,
      showNotifications, showShop, showHelp, showThemePicker, showEventsModal,
      showCreate, showApplicationForm, viewingApplication,
    };
  });

  // Guard flag: set to true when WE trigger replaceState/pushState so popstate
  // Back-button / swipe-back handler — registered ONCE on mount.
  // pushState never fires popstate — only the user's back gesture does.
  // So every popstate here is a genuine back press, no need to suppress.
  useEffect(() => {
    // Push a trap entry so we can intercept the back button
    window.history.pushState({ portalTrap: true }, '');

    const onPopState = () => {
      window.history.pushState({ portalTrap: true }, '');

      const s = backStateRef.current;

      // a. Close open overlays first
      if (s.showProfile)         { setShowProfile(false);        return; }
      if (s.viewingProfile)      { setViewingProfile(null);      return; }
      if (s.showManage)          { setShowManage(false);         return; }
      if (s.showMembersPanel)    { setShowMembersPanel(false);   return; }
      if (s.showNotifications)   { setShowNotifications(false);  return; }
      if (s.showShop)            { setShowShop(false);           return; }
      if (s.showHelp)            { setShowHelp(false);           return; }      if (s.showThemePicker)     { setShowThemePicker(false);    return; }
      if (s.showEventsModal)     { setShowEventsModal(false);    return; }
      if (s.showCreate)          { setShowCreate(false);         return; }
      if (s.showApplicationForm) { setShowApplicationForm(null); return; }
      if (s.viewingApplication)  { setViewingApplication(null); return; }

      // b. Not on home → go to home feed
      if (s.section !== 'home') {
        setSection('home');
        setActiveCommId('global');
        setActiveChannelId(null);
        window.history.replaceState({ portalNav: true }, '', window.location.pathname + '?section=home');
        return;
      }

      // c. On home → show logout modal
      setShowLogoutConfirm(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Reload channels and circle announcements whenever the active community changes
  useEffect(() => {
    loadChannels(activeCommId);
    loadCircleAnnouncements(activeCommId);
    setQaFilter('all'); // reset Q&A filter when switching communities
    // Load members for the panel whenever we switch circles
    if (activeCommId && activeCommId !== 'global') {
      supabase.from('memberships')
        .select('rank_level, user_id, accounts:user_id(id, full_name, ctu_id, account_details(avatar_url))')
        .eq('community_id', activeCommId).eq('status', 'active')
        .then(({ data, error }) => {
          if (error) console.error('Error loading circle members:', error);
          setCircleChatMembers((data || []).map(m => ({ 
            ...m.accounts, 
            avatar_url: m.accounts?.account_details?.avatar_url,
            rank_level: m.rank_level,
            student_id: m.accounts?.ctu_id
          })));
        });
    }
    setShowCircleAnnouncements(false);
    setSection(prev => prev === 'circle-chat' ? 'circles' : prev);
    if (openAnnouncementsOnEnter.current) {
      openAnnouncementsOnEnter.current = false;
      setShowCircleAnnouncements(true);
    }
  }, [activeCommId, loadChannels, loadCircleAnnouncements]);

  // Avatar is persisted in localStorage "? no DB sync needed on mount

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

  // Circle chat "? load and realtime
  useEffect(() => {
    if (!activeCommId || activeCommId === 'global' || section !== 'circle-chat') return;
    loadCircleChatMessages(activeCommId);
    // Load members for the panel
    supabase.from('memberships')
      .select('rank_level, user_id, accounts:user_id(id, full_name, ctu_id, account_details(avatar_url))')
      .eq('community_id', activeCommId).eq('status', 'active')
      .then(({ data, error }) => {
        if (error) console.error('Error loading circle members:', error);
        setCircleChatMembers((data || []).map(m => ({ 
          ...m.accounts, 
          avatar_url: m.accounts?.account_details?.avatar_url,
          rank_level: m.rank_level,
          student_id: m.accounts?.ctu_id
        })));
      });
    const sub = supabase.channel('circle-chat:' + activeCommId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `community_id=eq.${activeCommId}` },
        (payload) => {
          const msg = payload.new;
          if (!msg.channel_id) {
            setCircleChatMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              fetchAvatarsForMessages([msg]);
              markMessagesRead([msg]);
              if (msg.student_id === user?.student_id) fetchReadCounts([msg.id]);
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

  // Auto-scroll: go to first unread if exists, otherwise scroll to bottom
  useEffect(() => {
    if (firstUnreadRef.current) {
      firstUnreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const initials = user?.full_name
    ? user.full_name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) : 'U';

  const logout = () => {
    setShowLogoutConfirm(true);
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
  const isInvited = (commId) => getMembership(commId)?.status === 'invited';
  const getMyApplication = (commId) => myApplications.find(a => a.community_id === commId);

  const requestJoin = async (commId) => {
    const { error } = await supabase.from('memberships').insert([{
      community_id: commId, user_id: user.id, rank_level: 0, status: 'pending'
    }]);
    if (!error) { await loadMyMemberships(); showToast('Request sent!'); }
    else showToast('Already requested.');
  };

  const acceptInvite = async (commId) => {
    const membership = myMemberships.find(m => m.community_id === commId && m.status === 'invited');
    if (!membership) return;
    const { error } = await supabase.from('memberships').update({ status: 'active' }).eq('id', membership.id);
    if (!error) {
      await loadMyMemberships();
      showToast('You joined the circle!');
      navTo('circles', commId);
    } else showToast('Failed to accept invite.');
  };

  const declineInvite = async (commId) => {
    const membership = myMemberships.find(m => m.community_id === commId && m.status === 'invited');
    if (!membership) return;
    const { error } = await supabase.from('memberships').delete().eq('id', membership.id);
    if (!error) { await loadMyMemberships(); showToast('Invite declined.'); }
    else showToast('Failed to decline invite.');
  };

  const sendPost = async () => {
    const msgInput = msgInputRef.current?.value || '';
    if (!msgInput.trim() && !pendingMedia) return;
    if (msgInput.trim() && containsBadWord(msgInput)) {
      setSendError('⚠️ Your message contains inappropriate language and was not sent.');
      setTimeout(() => setSendError(''), 4000);
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: 'blocked', contentPreview: msgInput });
      return;
    }
    setSendError('');
    setUploading(true);

    try {
      const comm = communities.find(c => c.id === activeCommId);
      const isLeader = comm?.creator_id === user?.id;
      
      let mediaUrl = null;
      let mediaSize = null;
      let mediaDuration = null;
      let messageType = 'text';

      if (pendingMedia) {
        mediaUrl = await uploadMediaFile(pendingMedia.file, user.id, pendingMedia.mediaType);
        mediaSize = pendingMedia.file.size;
        mediaDuration = pendingMedia.duration || null;
        messageType = pendingMedia.mediaType;
      }

      const payload = {
        student_id: user.student_id,
        full_name: user.full_name,
        content: msgInput.trim() || '',
        message_type: messageType,
        media_url: mediaUrl,
        media_size: mediaSize,
        media_duration: mediaDuration,
        community_id: activeCommId === 'global' ? null : activeCommId,
        channel_id: activeCommId === 'global' ? null : activeChannelId,
        role: isLeader ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER'),
        ...(replyTo ? { reply_to_id: replyTo.id, reply_to_preview: replyTo.content?.slice(0, 100), reply_to_author: replyTo.full_name } : {}),
      };

      const { data, error } = await supabase.from('messages').insert([payload]).select();
      if (!error && data) {
        setMessages(prev => prev.find(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
        if (msgInputRef.current) msgInputRef.current.value = '';
        setPendingMedia(null);
        setReplyTo(null);
      } else {
        throw new Error(error?.message || 'Failed to send');
      }
    } catch (err) {
      setSendError('Failed to send message. Please try again.');
      setTimeout(() => setSendError(''), 4000);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const sendCircleChatPost = async () => {
    const circleChatInput = circleChatInputRef.current?.value || '';
    if (!circleChatInput.trim() && !circlePendingMedia) return;
    if (circleChatInput.trim() && containsBadWord(circleChatInput)) {
      setSendError('⚠️ Your message contains inappropriate language and was not sent.');
      setTimeout(() => setSendError(''), 4000);
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: 'blocked', contentPreview: circleChatInput });
      return;
    }
    setSendError('');
    setUploading(true);

    try {
      const comm = communities.find(c => c.id === activeCommId);
      const isLeader = comm?.creator_id === user?.id;

      let mediaUrl = null;
      let mediaSize = null;
      let mediaDuration = null;
      let messageType = 'text';

      if (circlePendingMedia) {
        mediaUrl = await uploadMediaFile(circlePendingMedia.file, user.id, circlePendingMedia.mediaType);
        mediaSize = circlePendingMedia.file.size;
        mediaDuration = circlePendingMedia.duration || null;
        messageType = circlePendingMedia.mediaType;
      }

      const payload = {
        student_id: user.student_id,
        full_name: user.full_name,
        content: circleChatInput.trim() || '',
        message_type: messageType,
        media_url: mediaUrl,
        media_size: mediaSize,
        media_duration: mediaDuration,
        community_id: activeCommId,
        channel_id: null,
        role: isLeader ? 'LEADER' : (getMembership(activeCommId)?.role?.toUpperCase() || 'MEMBER'),
        ...(replyTo ? { reply_to_id: replyTo.id, reply_to_preview: replyTo.content?.slice(0, 100), reply_to_author: replyTo.full_name } : {}),
      };

      const { data, error } = await supabase.from('messages').insert([payload]).select();
      if (!error && data) {
        setCircleChatMessages(prev => prev.find(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
        if (circleChatInputRef.current) circleChatInputRef.current.value = '';
        setCirclePendingMedia(null);
        setReplyTo(null);
      } else {
        throw new Error(error?.message || 'Failed to send');
      }
    } catch (err) {
      setSendError('Failed to send message. Please try again.');
      setTimeout(() => setSendError(''), 4000);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleCommCreated = (newComm) => {
    setCommunities(prev => [...prev, newComm]);
    showToast(`Circle created: ${newComm.name}`);
  };

  const deleteCircle = async (id) => {
    if (!confirm('Delete this circle? This cannot be undone.')) return;
    console.log('[DELETE CIRCLE]', { id });
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(getApiUrl(`/api/delete-community?id=${id}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      console.log('[DELETE CIRCLE] Response:', { status: res.status, data });
      if (!res.ok) { showToast(data.message || data.error || 'Failed to delete circle.'); return; }
      showToast('Circle deleted.');
      await loadCommunities();
      navTo('home', 'global');
    } catch (err) {
      console.error('[DELETE CIRCLE] Error:', err);
      showToast('Network error ? could not delete circle.');
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
    navTo('home', 'global');
  };

  const addChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    const { data, error } = await supabase.from('channels')
      .insert([{ 
        community_id: activeCommId, 
        name, 
        channel_type: newChannelType,
        created_by: user.id 
      }])
      .select();
    if (!error && data) {
      setChannels(prev => [...prev, data[0]]);
      setActiveChannelId(data[0].id);
      setNewChannelName('');
      setNewChannelType('chat');
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
    try {
      const res = await fetch(getApiUrl('/api/messages'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msgId, content: newContent, studentId: user?.student_id }),
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, edited: true } : m));
        setCircleChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, edited: true } : m));
      } else {
        showToast('Edit failed.');
      }
    } catch { showToast('Edit failed.'); }
  };

  // Joined circles for dock (only active memberships + owned)
  const myCircles = communities.filter(c =>
    c.id === 'global' || c.creator_id === user?.id || isMember(c.id)
  );

  // Circles for profile display — excludes the global feed
  const myCirclesForProfile = myCircles.filter(c => c.id !== 'global');

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
        {/* LEFT "? hamburger (mobile) + date & time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="mobile-menu-btn" onClick={() => {
            const next = !showDock;
            setShowDock(next);
            setMobileSidebarOpen(next);
          }}>
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

        {/* CENTER "? search */}
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
                        setActiveChannelId(null); navTo('circles', c.id); setSearch('');
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

        {/* RIGHT — notifications + user hud */}
        <div className="user-hud">
          {/* Desktop-only: Shop + Theme + Calendar buttons */}
          <button className="notif-bell desktop-only-btn" onClick={() => setShowShop(true)} title="Profile Shop">
            <i className="fa-solid fa-store"></i>
          </button>
          <button className="notif-bell desktop-only-btn" onClick={() => setShowThemePicker(true)} title="Change Theme">
            <i className="fa-solid fa-palette"></i>
          </button>
          <button className="notif-bell desktop-only-btn" onClick={() => setShowHelp(true)} title="Help Center">
            <i className="fa-solid fa-circle-question"></i>
          </button>

          {/* Mobile-only: ⋯ more menu */}
          <div className="notif-wrap mobile-more-wrap" ref={moreMenuRef}>
            <button className="notif-bell mobile-only-btn" onClick={() => setShowMoreMenu(o => !o)} title="More">
              <i className="fa-solid fa-ellipsis"></i>
            </button>
            {showMoreMenu && (
              <div className="more-dropdown">
                <button onClick={() => { setShowShop(true); setShowMoreMenu(false); }}>
                  <i className="fa-solid fa-store"></i> Profile Shop
                </button>
                <button onClick={() => { setShowThemePicker(true); setShowMoreMenu(false); }}>
                  <i className="fa-solid fa-palette"></i> Appearance
                </button>
                <button onClick={() => { setShowHelp(true); setShowMoreMenu(false); }}>
                  <i className="fa-solid fa-circle-question"></i> Help Center
                </button>
              </div>
            )}
          </div>

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
                        if (n.type === 'circle_invite' && n.link_comm_id) {
                          navTo('activity', 'global');
                          setActiveCategory('all');
                        } else if (n.link_comm_id) {
                          setActiveChannelId(null);
                          navTo('circles', n.link_comm_id);
                        }
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
            <span className="hud-label">SCHOOL_ID:</span>
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
        {/* CIRCLE DOCK ? always visible on desktop, toggle overlay on mobile */}
        <div className={`circle-dock${(showDock || mobileSidebarOpen) ? " dock-mobile-open" : ""}`}>
          <div className="dock-branding">
            <img src="/logoo.png" className="brand-logo-small" alt="NEXO" />
          </div>
          {myCircles.map(c => (
            <div key={c.id} className={`dock-icon ${activeCommId === c.id ? "active" : ""}`}
              title={c.name} onClick={() => {
                navTo(c.id === "global" ? "home" : "circles", c.id);
                setActiveChannelId(null);
                setShowDock(false);
                setMobileSidebarOpen(true);
              }}>
              {c.id === "global"
                ? <i className="fa-solid fa-earth-asia"></i>
                : c.logo_url
                  ? <img src={c.logo_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                  : <i className={c.icon || getCategoryIcon(c.category)}></i>
              }
            </div>
          ))}
          {user?.is_verified && (
            <div className="dock-add-btn" title="Create Circle" onClick={() => { setShowCreate(true); setShowDock(false); }}>+</div>
          )}
        </div>
        {/* Backdrop ? closes dock + sidebar on mobile */}
        {(showDock || mobileSidebarOpen) && (
          <div className="sidebar-backdrop show" onClick={() => { setShowDock(false); setMobileSidebarOpen(false); }} />
        )}

        {/* SIDEBAR "? context aware */}
        <div className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
          {activeCommId === 'global' ? (
            /* -- GLOBAL / HOME sidebar -- */
            <>
              <div className="sidebar-brand-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 className="sidebar-title">NEXO <span className="cyan-text">CONNECT</span></h2>
                </div>
              </div>
              <div className="sidebar-scroll">
              <div className="sidebar-label">MAIN</div>
              <div className="nav-links">
                <div className={`ls-item ${section === 'home' ? 'active' : ''}`} onClick={() => { navTo('home', 'global'); setMobileSidebarOpen(false); setShowDock(false); }}>
                  <i className="nav-icon fa-solid fa-house-chimney"></i>
                  <span className="node-name">Home Feed</span>
                </div>
                <div className={`ls-item ${section === 'global' ? 'active' : ''}`} onClick={() => { navTo('global', 'global'); loadMessages('global', null); setMobileSidebarOpen(false); setShowDock(false); }}>
                  <i className="nav-icon fa-solid fa-message"></i>
                  <span className="node-name">Global Feed</span>
                </div>
                <div className={`ls-item ${section === 'activity' && activeCategory === 'all' ? 'active' : ''}`} onClick={() => { navTo('activity', 'global'); setActiveCategory('all'); setMobileSidebarOpen(false); setShowDock(false); }}>
                  <i className="nav-icon fa-solid fa-compass"></i>
                  <span className="node-name">Explore</span>
                </div>
                <div className={`ls-item ${showEventsModal ? 'active' : ''}`} onClick={() => { loadEvents(); setShowEventsModal(true); setMobileSidebarOpen(false); setShowDock(false); }}>
                  <i className="nav-icon fa-solid fa-calendar-days"></i>
                  <span className="node-name">Campus Events</span>
                </div>
              </div>
              </div>
            </>
          ) : (
            /* -- CIRCLE sidebar -- */
            <>
              <div className="sidebar-brand-area" style={{ paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      <i className={activeComm.icon || activeComm.faIcon || getCategoryIcon(activeComm.category)} style={{ color: 'var(--cyber-cyan)' }}></i>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeComm.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{activeComm.category || 'circle'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sidebar-scroll">
              <div className="sidebar-label">CHANNELS</div>
              <div className="nav-links">
                {/* Announcements ? always first, powered by announcements table */}
                <div
                  className={`ls-item ${showCircleAnnouncements ? 'active' : ''}`}
                  onClick={() => { setShowCircleAnnouncements(true); navTo('circles', activeCommId); }}
                >
                  <i className="channel-hash">#</i>
                  <span className="node-name">announcements</span>
                  {circleAnnouncements.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{circleAnnouncements.length}</span>
                  )}
                </div>

                {/* General ? virtual default channel, stores channel_id=null messages */}
                <div
                  className={`ls-item ${!showCircleAnnouncements && activeChannelId === null ? 'active' : ''}`}
                  onClick={() => { setActiveChannelId(null); setShowCircleAnnouncements(false); navTo('circles', activeCommId); loadMessages(activeCommId, null); }}
                >
                  <i className="channel-hash">#</i>
                  <span className="node-name">general</span>
                </div>



                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`ls-item ${activeChannelId === ch.id && !showCircleAnnouncements ? 'active' : ''}`}
                    onClick={() => { setActiveChannelId(ch.id); navTo('circles', activeCommId); setShowCircleAnnouncements(false); }}
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

                {/* Add channel - leaders/co-leaders only */}
                {canModerate && (
                  showAddChannel ? (
                    <div
                      style={{ padding: "6px 10px" }}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setShowAddChannel(false);
                          setNewChannelType("chat");
                          setNewChannelName("");
                        }
                      }}
                    >
                      <input
                        className="channel-name-input"
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addChannel(); if (e.key === "Escape") { setShowAddChannel(false); setNewChannelType("chat"); } }}
                        placeholder="channel-name"
                        autoFocus
                        style={{ marginBottom: 6 }}
                      />
                      {activeComm?.category === "project" && (
                        <select
                          value={newChannelType}
                          onChange={e => setNewChannelType(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(0,240,255,0.2)",
                            borderRadius: 6,
                            color: "white",
                            fontSize: 11,
                            marginBottom: 6
                          }}
                        >
                          <option value="chat">Chat</option>
                          <option value="tasks">Tasks</option>
                        </select>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="channel-confirm-btn" onClick={addChannel} style={{ flex: 1 }}>
                          <i className="fa-solid fa-check"></i> Create
                        </button>
                        <button className="channel-cancel-btn" onClick={() => { setShowAddChannel(false); setNewChannelType("chat"); setNewChannelName(""); }}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ls-item add-channel-btn" onClick={() => setShowAddChannel(true)}>
                      <i className="channel-hash" style={{ color: "var(--text-muted)" }}>+</i>
                      <span className="node-name" style={{ color: "var(--text-muted)", fontSize: 12 }}>Add Channel</span>
                    </div>
                  )
                )}
              </div>

              {/* Leaders and Co-Leaders can manage, regular members can view members */}
              {activeCommId !== 'global' && isMember(activeCommId) && (
                <>
                  <div className="sidebar-label" style={{ marginTop: 12 }}>
                    {canModerate ? 'MANAGE' : 'INFO'}
                  </div>
                  <div className="nav-links">
                    {/* Leaders see Settings + Delete */}
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
                    {/* Co-Leaders see Settings (no delete) */}
                    {!isOwner && canModerate && (
                      <div className="ls-item" onClick={() => setShowManage(true)}>
                        <i className="nav-icon fa-solid fa-gear"></i>
                        <span className="node-name">Settings</span>
                      </div>
                    )}
                    {/* Regular members see View Members */}
                    {!canModerate && (
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
                  <div className="ls-item" style={{ color: 'var(--red)' }}
                    onClick={() => leaveCircle(activeCommId)}>
                    <i className="nav-icon fa-solid fa-right-from-bracket"></i>
                    <span className="node-name">Leave Circle</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* CONTENT */}
        <div className="content">

          {/* -- HOME -- */}
          {section === 'home' && (
            <div className="c-feed fade-in">

              {/* Hero banner */}
              <div className="home-hero">
                <div className="home-hero-text">
                  <p className="home-hero-welcome">Welcome, {user?.full_name || 'Technologist'}.</p>
                  <h1>Find Your Circle<br/>at CTU</h1>
                  <p>Discover communities built around your interests, join the conversation, and make your campus experience count.</p>
                  <button className="cyber-btn" style={{ width: 'auto', padding: '10px 24px', marginTop: 16 }}
                    onClick={() => { navTo('activity', 'global'); setActiveCategory('all'); }}>
                    <i className="fa-solid fa-compass" style={{ marginRight: 8 }}></i>Explore Circles
                  </button>
                </div>
              </div>

              {/* Popular Right Now ? moved up, replaces redundant welcome/stats cards */}
              {communities.filter(c => c.id !== 'global').length > 0 && (
                <>
                  <div className="home-section-header" style={{ marginTop: 8 }}>
                    <span>Popular Right Now</span>
                    <span className="home-see-all" onClick={() => { navTo('activity', 'global'); setActiveCategory('all'); }}>See all</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {communities.filter(c => c.id !== 'global')
                      .sort((a, b) => (memberCounts[b.id] || 0) - (memberCounts[a.id] || 0))
                      .slice(0, 3).map(c => (
                      <div key={c.id} className="popular-row"
                        onClick={() => { navTo('circles', c.id); }}>
                        <div className="popular-row-icon" style={{
                          background: c.cover_url ? undefined : categoryGradient(c.category),
                          backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                        }}>
                          {!c.cover_url && <i className={(c.icon || getCategoryIcon(c.category))}></i>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
                            {c.category}
                            {memberCounts[c.id] > 0 && (
                              <span style={{ marginLeft: 8, color: 'var(--cyber-cyan)' }}>
                                <i className="fa-solid fa-user" style={{ fontSize: 9, marginRight: 3 }}></i> {memberCounts[c.id]} member{memberCounts[c.id] !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }}></i>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* -- POST COMPOSER "? verified users only -- */}
              {user?.is_verified && (
                <div className="home-post-composer">
                  {/* Collapsed prompt — click to expand */}
                  {!showComposer ? (
                    <div className="home-composer-header" onClick={() => setShowComposer(true)}
                      style={{ cursor: 'pointer' }}>
                      <div className="home-composer-avatar">
                        {navAvatarUrl
                          ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials
                        }
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, flex: 1 }}>
                        What's on your mind? Share news, events, shoutouts...
                      </span>
                      <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--cyber-cyan)', fontSize: 14 }}></i>
                    </div>
                  ) : (
                    <>
                  <div className="home-composer-header">
                    <div className="home-composer-avatar">
                      {navAvatarUrl
                        ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initials
                      }
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>Share something with the campus</span>
                    <button onClick={() => { setShowComposer(false); setNewPost({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''], event_metadata: null }); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <input
                    className="home-composer-title"
                    placeholder="Title"
                    value={newPost.title}
                    onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                    autoFocus
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
                    <>
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
                      <PollEventMetadataForm
                        communityCategory="social"
                        onChange={(metadata) => setNewPost(p => ({ ...p, event_metadata: metadata }))}
                      />
                    </>
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
                        title={newPost.anonymous ? 'Posting anonymously — click to use your name' : 'Post anonymously'}>
                        <i className="fa-solid fa-user-secret"></i>
                        <span>{newPost.anonymous ? 'Anonymous' : 'Post as me'}</span>
                      </button>
                      <button className="cyber-btn"
                        style={{ width: 'auto', padding: '8px 22px', fontSize: 12 }}
                        disabled={postingAnnouncement || !newPost.title.trim() || (newPost.post_type !== 'poll' && !newPost.content.trim())}
                        onClick={() => { postAnnouncement(); setShowComposer(false); }}>
                        {postingAnnouncement
                          ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Posting...</>
                          : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                      </button>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* -- CAMPUS FEED -- */}
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
                        avatarCache={avatarCache}
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
                          if (comm) setShowApplicationForm({ comm });
                          else alert('Could not find the Application circle. Try visiting the circle directly.');
                        }}
                        onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                    ))}
                  </div>
                );
              })()}

              {/* Featured Communities */}
              <div className="home-section-header" style={{ marginTop: 16 }}>
                <span>Featured Circles</span>
                <span className="home-see-all" onClick={() => { navTo('activity', 'global'); setActiveCategory('all'); }}>See all</span>
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
                      onClick={() => { navTo('circles', c.id); }}>
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

              {/* Popular by category ? now shown above, removed from here */}

            </div>
          )}

          {/* -- GLOBAL FEED "? campus-wide chat -- */}
          {section === 'global' && (
            <>
              {/* Global feed header ? stays visible, doesn't scroll */}
              <div className="circle-banner-wrap" style={{ margin: '10px 0 0 0', borderRadius: '15px 15px 0 0', background: 'rgba(13,13,18,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: '18px 25px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)', display: 'flex', alignItems: 'center' }}>
                    <i className="fa-solid fa-network-wired" style={{ marginRight: 10 }}></i>GLOBAL FEED
                  </h2>
                  <OnlineStack onlineProfiles={onlineProfiles} circleMateIds={circleMateIds} avatarCache={avatarCache} />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                  Campus-wide chat, open to all verified users.
                </p>
              </div>
              <div className="c-feed fade-in c-feed-chat" style={{ margin: '0 20px 0 0', borderRadius: '0', flex: 1 }}>

                {(() => {
                  const lastOwnIdx = messages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                  return messages.map((m, idx) => {
                    const isOwnerMsg = m.student_id === user?.student_id;
                    const prev = messages[idx - 1];
                    const next = messages[idx + 1];
                    const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                    const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                    
                    // Group consecutive messages from same user within 3 minutes
                    const isGrouped = prev && 
                      prev.student_id === m.student_id && 
                      (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;
                    
                    const isLastInGroup = !next || 
                      next.student_id !== m.student_id || 
                      (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;
                    
                    return (
                      <React.Fragment key={m.id}>
                        {showSep && <ChatTimeSeparator date={m.created_at} />}
                        {m.id === firstUnreadMsgId.current && (
                          <div ref={firstUnreadRef}><UnreadDivider /></div>
                        )}
                        <MessageItem m={m}
                          tagColor="var(--cyber-cyan)"
                          isOwnerMsg={isOwnerMsg}
                          canDelete={isOwnerMsg || user?.user_type === 'Admin'}
                          onDelete={deleteMessage}
                          onEdit={editMessage}
                          onReport={(data) => setShowReport(data)}
                          currentStudentId={user?.student_id}
                          avatarUrl={avatarCache[m.student_id] || null}
                          onViewProfile={viewUserProfile}
                          online={isOnline(profileIdCache[m.student_id])}
                          readers={messageReads[m.id] || []}
                          isLastOwn={isLastOwn}
                          isGrouped={isGrouped}
                          isLastInGroup={isLastInGroup}
                          userCustomizations={userCustomizations}
                          onReply={(msg) => setReplyTo(msg)}
                        />
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={feedBottomRef} />
              </div>

              {user?.is_verified && (
                <div className="composer composer-chat">
                  {/* Reply preview bar */}
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(0,240,255,0.06)', borderTop: '1px solid rgba(0,240,255,0.15)', fontSize: 12 }}>
                      <i className="fa-solid fa-reply" style={{ color: 'var(--cyber-cyan)', fontSize: 11 }}></i>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>{replyTo.full_name} </span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content?.slice(0, 80)}</span>
                      </div>
                      <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  )}
                  {pendingMedia && (
                    <MediaPreview 
                      file={pendingMedia.file} 
                      mediaType={pendingMedia.mediaType}
                      onCancel={() => setPendingMedia(null)}
                    />
                  )}
                  <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MediaUploadButton 
                      onMediaSelected={setPendingMedia} 
                      disabled={uploading || !!pendingMedia}
                    />
                    <VoiceRecorder 
                      onVoiceRecorded={setPendingMedia} 
                      disabled={uploading || !!pendingMedia}
                    />
                    <input ref={msgInputRef} onChange={() => setSendError('')}
                      onKeyDown={e => e.key === 'Enter' && !uploading && sendPost()}
                      placeholder="Say something to the Global Feed..."
                      disabled={uploading}
                      style={sendError ? { borderColor: 'var(--red)', flex: 1 } : { flex: 1 }} />
                    <button className="chat-send-btn" onClick={sendPost} disabled={uploading} title="Send">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                  {sendError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-triangle-exclamation"></i>{sendError}</div>}
                </div>
              )}
            </>
          )}

          {/* -- ACTIVITY HUB "? discover & join circles -- */}
          {section === 'activity' && (
            <div className="c-feed fade-in">
              <div className="post" style={{ borderLeft: '4px solid var(--cyber-cyan)', marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)' }}>
                  <i className="fa-solid fa-compass" style={{ marginRight: 10 }}></i>
                  EXPLORE CIRCLES
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8, marginBottom: 12 }}>
                  Discover circles and request to join.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all',      label: 'All',      icon: 'fa-solid fa-border-all' },
                    { key: 'academic', label: 'Academic', icon: 'fa-solid fa-graduation-cap' },
                    { key: 'project',  label: 'Projects', icon: 'fa-solid fa-flask' },
                    { key: 'hobby',    label: 'Hobbies',  icon: 'fa-solid fa-gamepad' },
                    { key: 'social',   label: 'Social',   icon: 'fa-solid fa-user-group' },
                  ].map(cat => (
                    <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: activeCategory === cat.key ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${activeCategory === cat.key ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
                        color: activeCategory === cat.key ? 'var(--cyber-cyan)' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}>
                      <i className={cat.icon} style={{ fontSize: 11 }} />{cat.label}
                    </button>
                  ))}
                </div>
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
                      const invited = isInvited(c.id);
                      const myApplication = getMyApplication(c.id);
                      return (
                        <div key={c.id} className="post circle-explore-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <i className={(c.icon || getCategoryIcon(c.category))} style={{ color: 'var(--cyber-cyan)', fontSize: 16 }}></i>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid #333', padding: '2px 6px', borderRadius: 4 }}>{c.category}</span>
                            {owned && <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 6px', borderRadius: 4 }}>YOUR CIRCLE</span>}
                            {c.application_enabled && !owned && <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', border: '1px solid var(--cyber-cyan)', padding: '2px 6px', borderRadius: 4 }}><i className="fa-solid fa-microphone" style={{ marginRight: 4 }}></i>Application Required</span>}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.description || 'No description provided.'}</p>
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 20 }}>
                          {owned || joined ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="group-action-btn manage"
                                onClick={() => { navTo('circles', c.id); }}>
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
                          ) : invited ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', fontWeight: 700, letterSpacing: 1 }}>
                                <i className="fa-solid fa-envelope" style={{ marginRight: 5 }}></i>INVITED
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="group-action-btn manage"
                                  onClick={() => acceptInvite(c.id)}
                                  style={{ background: 'rgba(62,207,142,0.15)', borderColor: 'var(--green)', color: 'var(--green)' }}>
                                  <i className="fa-solid fa-check"></i> ACCEPT
                                </button>
                                <button className="group-action-btn terminate"
                                  onClick={() => declineInvite(c.id)}>
                                  <i className="fa-solid fa-xmark"></i> DECLINE
                                </button>
                              </div>
                            </div>
                          ) : !user?.is_verified ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid #333', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-lock" style={{ marginRight: 5 }}></i>Verify to join
                            </span>
                          ) : pending ? (
                            <span style={{ fontSize: 11, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '5px 12px', borderRadius: 20 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: 5 }}></i>PENDING
                            </span>
                          ) : myApplication ? (
                            <span
                              style={{
                                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                                color: ApplicationStatusColor(myApplication.status, myApplication.phase2_result),
                                border: `1px solid ${ApplicationStatusColor(myApplication.status, myApplication.phase2_result)}`,
                                cursor: 'pointer',
                              }}
                              onClick={async () => {
                                const [rRes, qRes] = await Promise.all([
                                  supabase.from('application_submissions').select('*').eq('id', myApplication.id).single(),
                                  supabase.from('Application_questions').select('*').eq('community_id', c.id).order('order_index'),
                                ]);
                                setViewingApplication({ response: rRes.data, community: c, questions: qRes.data || [] });
                              }}
                            >
                              <i className="fa-solid fa-microphone" style={{ marginRight: 5 }}></i>
                              {ApplicationStatusLabel(myApplication.status, myApplication.phase2_result)}
                              <i className="fa-solid fa-eye" style={{ marginLeft: 6, fontSize: 9 }}></i>
                            </span>
                          ) : (
                            c.application_enabled ? (
                              // Internal Application: outsiders can still REQUEST to join; Application is only for existing members
                              c.internal_Application ? (
                                <button className="group-action-btn manage" onClick={() => requestJoin(c.id)}>
                                  <i className="fa-solid fa-paper-plane"></i> REQUEST
                                </button>
                              ) : (
                                <button className="group-action-btn manage" onClick={() => setShowApplicationForm({ comm: c })}>
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

          {/* -- MY CIRCLES / CIRCLE FEED -- */}
          {section === 'circles' && (
            <>
              {/* Banner sits outside the scrollable feed ? stays visible */}
              <div className="circle-banner-wrap" style={{ margin: '10px 0 0 0', borderRadius: '15px 15px 0 0', overflow: 'hidden', flexShrink: 0 }}>
                <div className="circle-cover-banner" style={{
                  borderRadius: 0,
                  background: activeComm.cover_url
                    ? `url(${activeComm.cover_url}) center/cover no-repeat`
                    : categoryGradient(activeComm.category),
                }}>
                  {/* Cover photo edit button "? top-right, only for creator */}
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
                            const token = localStorage.getItem('accessToken');
                            const serverRes = await fetch(getApiUrl(`/api/upload-cover`), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                              },
                              body: JSON.stringify({ cover_url: compressed, communityId: activeComm.id }),
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
                      {activeComm.logo_url
                        ? <img src={activeComm.logo_url} alt={activeComm.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : <i className={activeComm.icon || getCategoryIcon(activeComm.category)}></i>
                      }
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
                        {activeCommId !== 'global' && (
                          <div className="verified-badge" style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.3)' }}>
                            CIRCLE: {(activeComm.category || 'General').toUpperCase()} | ROLE: {myRole}
                          </div>
                        )}
                        {(() => {
                          const currentCircleMemberIds = new Set(circleChatMembers.map(m => m.id));
                          const circleOnline = onlineProfiles.filter(p => currentCircleMemberIds.has(p.id));
                          return circleOnline.length > 0
                            ? <OnlineStack onlineProfiles={circleOnline} circleMateIds={circleMateIds} avatarCache={avatarCache} maxShow={5} onClick={() => setShowOnlineModal(true)} />
                            : null;
                        })()}
                      </div>
                      <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
                        {activeComm.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>{/* end banner wrapper */}

              {/* Online Members Modal */}
              {showOnlineModal && (
                <div className="modal-overlay" onClick={() => setShowOnlineModal(false)}>
                  <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 340, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 14, color: 'var(--cyber-cyan)' }}>
                        <i className="fa-solid fa-users" style={{ marginRight: 8 }}></i>
                        Circle Members
                      </h3>
                      <button onClick={() => setShowOnlineModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                    <div style={{ padding: '12px 0', maxHeight: 400, overflowY: 'auto' }}>
                      {[
                        { label: 'ONLINE', filter: m => isOnline(m.id) },
                        { label: 'OFFLINE', filter: m => !isOnline(m.id) },
                      ].map(({ label, filter }) => {
                        const group = circleChatMembers.filter(filter);
                        if (!group.length) return null;
                        return (
                          <div key={label}>
                            <div style={{ padding: '6px 20px 4px', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700 }}>
                              {label} ? {group.length}
                            </div>
                            {group.map(m => {
                              const url = avatarCache[m.student_id] || m.avatar_url;
                              const initials = (m.full_name || '?')[0].toUpperCase();
                              return (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px', opacity: isOnline(m.id) ? 1 : 0.45, cursor: 'pointer' }}
                                  onClick={() => { 
                                  setShowOnlineModal(false); 
                                  if (m.student_id === user?.student_id || m.student_id === user?.ctu_id) {
                                    setShowProfile(true);
                                  } else {
                                    viewUserProfile(m.student_id); 
                                  }
                                }}>

                                  <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--cyber-cyan)' }}>
                                      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                                    </div>
                                    {isOnline(m.id) && (
                                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#3ecf8e', border: '2px solid var(--card-bg)' }} />
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.full_name}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.student_id}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="c-feed fade-in c-feed-chat" style={{ margin: '0 20px 0 0', borderRadius: '0', flex: 1 }}>
                {/* Access gate for non-members */}
                {!isMember(activeCommId) ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>This circle requires membership to access.</p>
                    {isPending(activeCommId) ? (
                      <span style={{ color: 'var(--cyber-yellow)', fontSize: 12 }}>
                        <i className="fa-solid fa-clock" style={{ marginRight: 6 }}></i>Join request pending approval...
                      </span>
                    ) : (
                      activeComm.application_enabled ? (
                        activeComm.internal_Application ? (
                          <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                            <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                          </button>
                        ) : (
                          <button className="group-action-btn manage" onClick={() => setShowApplicationForm({ comm: activeComm })}>
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
                  /* -- CIRCLE ANNOUNCEMENTS VIEW -- */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Post composer "? all members can post */}
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
                          <>
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
                            {/* Event metadata form - only for social communities */}
                            <PollEventMetadataForm
                              communityCategory={activeComm?.category}
                              onChange={(metadata) => setNewCirclePost(p => ({ ...p, event_metadata: metadata }))}
                            />
                          </>
                        )}
                        <div className="home-composer-footer">
                          <div className="home-composer-types">
                            {['announcement', 'event', 'shoutout', 'general', 'poll', ...(activeComm.category === 'hobby' ? ['showcase'] : []), ...(activeComm.category === 'academic' ? ['question'] : [])].map(t => {
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
                    {/* Q&A Filter bar ? academic circles only */}
                    {activeComm?.category === 'academic' && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {[
                          { key: 'all', label: 'All Posts' },
                          { key: 'questions', label: '? Questions' },
                          { key: 'unanswered', label: '?? Unanswered' },
                        ].map(f => (
                          <button key={f.key} onClick={() => setQaFilter(f.key)} style={{
                            padding: '4px 12px', fontSize: 11, borderRadius: 12, cursor: 'pointer',
                            border: qaFilter === f.key ? '1px solid #22d3ee' : '1px solid rgba(0,240,255,0.2)',
                            background: qaFilter === f.key ? 'rgba(34,211,238,0.1)' : 'rgba(0,0,0,0.3)',
                            color: qaFilter === f.key ? '#22d3ee' : 'var(--text-muted)',
                            fontWeight: qaFilter === f.key ? 700 : 400, transition: 'all 0.2s'
                          }}>{f.label}</button>
                        ))}
                      </div>
                    )}
                    {circleAnnouncements.length === 0 ? (
                      <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                        <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No announcements yet.</p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = qaFilter === 'questions'
                          ? circleAnnouncements.filter(a => a.post_type === 'question')
                          : qaFilter === 'unanswered'
                          ? circleAnnouncements.filter(a => a.post_type === 'question' && !a.solution_comment_id)
                          : circleAnnouncements;
                        return filtered.map(a => (
                          <AnnouncementCard key={a.id} a={a} user={user}
                            avatarCache={avatarCache}
                            onPin={togglePin}
                            onDelete={(id) => { deleteAnnouncement(id); loadCircleAnnouncements(activeCommId); }}
                            onVote={handleCircleVote}
                            onReport={(data) => setShowReport(data)}
                            onApply={() => setShowApplicationForm({ comm: activeComm })}
                            communityCreatorId={activeComm?.creator_id}
                            onReload={() => loadCircleAnnouncements(activeCommId)}
                            onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                        ));
                      })()
                    )}
                  </div>
                ) : (
                  (() => {
                    // Get current channel info
                    const currentChannel = channels.find(c => c.id === activeChannelId);
                    const channelType = currentChannel?.channel_type || 'chat';

                    // If it's a task channel, show Task Board
                    if (activeChannelId && channelType === 'tasks') {
                      return (
                        <div style={{ height: '100%', overflow: 'hidden' }}>
                          <TaskBoard 
                            channelId={activeChannelId}
                            canManage={myRankLevel >= 1}
                            currentUserId={user.id}
                          />
                        </div>
                      );
                    }

                    // Otherwise show regular chat messages
                    const lastOwnIdx = messages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                    return messages.map((m, idx) => {
                      const isOwnerMsg = m.student_id === user?.student_id;
                      const canDelete = isOwnerMsg || canModerate;
                      const prev = messages[idx - 1];
                      const next = messages[idx + 1];
                      const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                      const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                      
                      // Group consecutive messages from same user within 3 minutes
                      const isGrouped = prev && 
                        prev.student_id === m.student_id && 
                        (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;
                      
                      const isLastInGroup = !next || 
                        next.student_id !== m.student_id || 
                        (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;
                      
                      return (
                        <React.Fragment key={m.id}>
                          {showSep && <ChatTimeSeparator date={m.created_at} />}
                          <MessageItem
                            m={m}
                            tagColor={tagColor}
                            isOwnerMsg={isOwnerMsg}
                            canDelete={canDelete}
                            onDelete={deleteMessage}
                            onEdit={editMessage}
                            onReport={(data) => setShowReport(data)}
                            currentStudentId={user?.student_id}
                            avatarUrl={avatarCache[m.student_id] || null}
                            onViewProfile={viewUserProfile}
                            online={isOnline(profileIdCache[m.student_id])}
                            readers={messageReads[m.id] || []}
                            isLastOwn={isLastOwn}
                            isGrouped={isGrouped}
                            isLastInGroup={isLastInGroup}
                            userCustomizations={userCustomizations}
                            onReply={(msg) => setReplyTo(msg)}
                          />
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && !showCircleAnnouncements && user?.is_verified && channels.find(c => c.id === activeChannelId)?.channel_type !== 'tasks' && (
                <div className="composer composer-chat">
                  {/* Reply preview bar */}
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(0,240,255,0.06)', borderTop: '1px solid rgba(0,240,255,0.15)', fontSize: 12 }}>
                      <i className="fa-solid fa-reply" style={{ color: 'var(--cyber-cyan)', fontSize: 11 }}></i>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>{replyTo.full_name} </span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content?.slice(0, 80)}</span>
                      </div>
                      <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  )}
                  {pendingMedia && (
                    <MediaPreview 
                      file={pendingMedia.file} 
                      mediaType={pendingMedia.mediaType}
                      onCancel={() => setPendingMedia(null)}
                    />
                  )}
                  <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MediaUploadButton 
                      onMediaSelected={setPendingMedia} 
                      disabled={uploading || !!pendingMedia}
                    />
                    <VoiceRecorder 
                      onVoiceRecorded={setPendingMedia} 
                      disabled={uploading || !!pendingMedia}
                    />
                    <input ref={msgInputRef} onChange={() => setSendError('')}
                      onKeyDown={e => e.key === 'Enter' && !uploading && sendPost()} 
                      placeholder={`Say something to ${activeComm?.name || 'Circle Chat'}...`}
                      disabled={uploading}
                      style={sendError ? { borderColor: 'var(--red)', flex: 1 } : { flex: 1 }} />
                    <button className="chat-send-btn" onClick={sendPost} disabled={uploading} title="Send">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                  {sendError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-triangle-exclamation"></i>{sendError}</div>}
                </div>
              )}
            </>
          )}

          {/* -- CIRCLE CHAT -- */}
          {section === 'circle-chat' && activeCommId !== 'global' && (
            <>
              {/* Circle chat header ? fixed, doesn't scroll */}
              <div style={{ margin: '20px 20px 0 0', borderRadius: '15px 15px 0 0', background: 'rgba(13,13,18,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: '18px 25px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 16, letterSpacing: 2, color: 'var(--cyber-cyan)', display: 'flex', alignItems: 'center' }}>
                    <i className="fa-solid fa-comments" style={{ marginRight: 10 }}></i>CIRCLE CHAT
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(() => {
                      const circleOnline = onlineProfiles.filter(p => circleMateIds.has(p.id) || p.id === user?.id);
                      const toShow = circleOnline.length > 0 ? circleOnline : onlineProfiles.slice(0, 5);
                      return toShow.length > 0 ? <OnlineStack onlineProfiles={toShow} circleMateIds={circleMateIds} avatarCache={avatarCache} maxShow={6} /> : null;
                    })()}
                    {/* All members can view members list */}
                    <button onClick={() => setShowMembersPanel(p => !p)} title="Toggle members"
                      style={{ background: showMembersPanel ? 'rgba(0,240,255,0.15)' : 'transparent', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 8, color: showMembersPanel ? 'var(--cyber-cyan)' : 'var(--text-muted)', padding: '5px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-solid fa-users" />
                      <span>{circleChatMembers.length}</span>
                    </button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                  Private chat exclusive to members of {activeComm.name}.
                </p>
              </div>

              {/* Chat + optional members panel side by side */}
              <div style={{ display: 'flex', flex: 1, margin: '0 0 0 0', overflow: 'hidden', gap: 0 }}>
                <div className="c-feed fade-in" style={{ margin: 0, borderRadius: showMembersPanel ? '0 0 0 15px' : '0 0 15px 15px', flex: 1 }}>

                {!isMember(activeCommId) ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--text-muted)' }}>You must be a member to access Circle Chat.</p>
                  </div>
                ) : (
                  (() => {
                    const lastOwnIdx = circleChatMessages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                    return circleChatMessages.map((m, idx) => {
                      const isOwnerMsg = m.student_id === user?.student_id;
                      const canDelete = isOwnerMsg || canModerate;
                      const prev = circleChatMessages[idx - 1];
                      const next = circleChatMessages[idx + 1];
                      const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                      const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                      
                      // Group consecutive messages from same user within 3 minutes
                      const isGrouped = prev && 
                        prev.student_id === m.student_id && 
                        (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;
                      
                      const isLastInGroup = !next || 
                        next.student_id !== m.student_id || 
                        (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;
                      
                      return (
                        <React.Fragment key={m.id}>
                          {showSep && <ChatTimeSeparator date={m.created_at} />}
                          {m.id === firstUnreadMsgId.current && (
                            <div ref={firstUnreadRef}><UnreadDivider /></div>
                          )}
                          <MessageItem
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
                            avatarUrl={avatarCache[m.student_id] || null}
                            onViewProfile={viewUserProfile}
                            online={isOnline(profileIdCache[m.student_id])}
                            readers={messageReads[m.id] || []}
                            isLastOwn={isLastOwn}
                            isGrouped={isGrouped}
                            isLastInGroup={isLastInGroup}
                            userCustomizations={userCustomizations}
                            onReply={(msg) => setReplyTo(msg)}
                          />
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && user?.is_verified && (
                <div className="composer composer-chat">
                  {/* Reply preview bar */}
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(0,240,255,0.06)', borderTop: '1px solid rgba(0,240,255,0.15)', fontSize: 12 }}>
                      <i className="fa-solid fa-reply" style={{ color: 'var(--cyber-cyan)', fontSize: 11 }}></i>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>{replyTo.full_name} </span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content?.slice(0, 80)}</span>
                      </div>
                      <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  )}
                  {circlePendingMedia && (
                    <MediaPreview 
                      file={circlePendingMedia.file} 
                      mediaType={circlePendingMedia.mediaType}
                      onCancel={() => setCirclePendingMedia(null)}
                    />
                  )}
                  <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MediaUploadButton 
                      onMediaSelected={setCirclePendingMedia} 
                      disabled={uploading || !!circlePendingMedia}
                    />
                    <VoiceRecorder 
                      onVoiceRecorded={setCirclePendingMedia} 
                      disabled={uploading || !!circlePendingMedia}
                    />
                    <input ref={circleChatInputRef}
                      onKeyDown={e => e.key === 'Enter' && !uploading && sendCircleChatPost()}
                      placeholder={`Message ${activeComm.name}...`}
                      disabled={uploading}
                      style={{ flex: 1 }} />
                    <button className="chat-send-btn" onClick={sendCircleChatPost} disabled={uploading} title="Send">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              )}
              {showMembersPanel && (
                <div style={{ width: 220, background: 'rgba(13,13,18,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: 'none', borderRadius: '0 0 15px 0', overflowY: 'auto', flexShrink: 0, padding: '14px 0' }}>
                  <div style={{ padding: '0 14px 10px', fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700 }}>MEMBERS ? {circleChatMembers.length}</div>
                  {[
                    { label: 'ONLINE', filter: m => isOnline(m.id) },
                    { label: 'OFFLINE', filter: m => !isOnline(m.id) },
                  ].map(({ label, filter }) => {
                    const group = circleChatMembers.filter(filter);
                    if (!group.length) return null;
                    return (
                      <div key={label}>
                        <div style={{ padding: '8px 14px 4px', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700 }}>
                          {label} ? {group.length}
                        </div>
                        {group.map(m => {
                          const url = avatarCache[m.student_id] || m.avatar_url;
                          const initials = (m.full_name || '?')[0].toUpperCase();
                          const rankLabels = ['', 'MOD', 'CO-LEAD', 'LEADER'];
                          return (
                            <div key={m.id} onClick={() => viewUserProfile(m.student_id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', opacity: isOnline(m.id) ? 1 : 0.45, cursor: 'pointer' }}>
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--cyber-cyan)' }}>
                                  {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                                </div>
                                {isOnline(m.id) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#3ecf8e', border: '2px solid var(--bg-black)' }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</div>
                                {m.rank_level > 0 && <div style={{ fontSize: 9, color: 'var(--cyber-yellow)', letterSpacing: 1 }}>{rankLabels[m.rank_level] || ''}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>{/* end chat+panel wrapper */}
            </>
          )}
        </div>
      </div>

      {showManage && (
        <ManageGroupModal comm={activeComm} onClose={() => setShowManage(false)}
          viewerIsOwner={isOwner}
          viewerRankLevel={myRankLevel}
          onSaved={(updated) => {
            setCommunities(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            showToast('SETTINGS_SAVED');
          }}
          onGivePoints={(member) => {
            setShowGivePoints({
              targetUser: {
                id: member.user_id,
                full_name: member.accounts?.full_name || '??',
                ctu_id: member.accounts?.ctu_id || '',
                avatar_url: member.accounts?.avatar_url || null
              }
            });
          }}
          onFlagUser={(member) => {
            setShowFlagUser({
              targetUser: {
                id: member.user_id,
                full_name: member.accounts?.full_name || '??',
                ctu_id: member.accounts?.ctu_id || '',
                avatar_url: member.accounts?.avatar_url || null
              }
            });
          }}
        />
      )}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCommCreated} userId={user?.id} />}
      {showProfile && <ProfileModal user={user} communities={myCirclesForProfile} onClose={() => setShowProfile(false)} onLogout={logout} onAvatarUpdate={(url) => setNavAvatarUrl(url)} currentAvatarUrl={navAvatarUrl} />}
      {viewingProfile && (
        <ProfileModal
          user={viewingProfile}
          communities={viewingProfile._circles || []}
          onClose={() => setViewingProfile(null)}
          onLogout={() => {}}
          onAvatarUpdate={() => {}}
          currentAvatarUrl={viewingProfile.avatar_url}
          readOnly
        />
      )}
      {showApplicationForm && (
        <ApplicationApplicationForm
          comm={showApplicationForm.comm}
          Application={showApplicationForm.Application || null}
          applicantId={user?.id}
          onSubmitted={() => { setShowApplicationForm(null); showToast('Application submitted!'); loadMyMemberships(); loadMyApplications(); }}
          onCancel={() => setShowApplicationForm(null)}
        />
      )}
      {viewingApplication && (
        <ApplicationDetailModal data={viewingApplication} onClose={() => setViewingApplication(null)} />
      )}
      <Toast message={toast} />

      {showReport && (
        <ReportModal data={showReport} user={user} onClose={() => setShowReport(null)} />
      )}
      {showGivePoints && (
        <GivePointsModal
          targetUser={showGivePoints.targetUser}
          currentUser={user}
          communityId={activeCommId}
          myRankLevel={myRankLevel}
          onClose={() => setShowGivePoints(null)}
        />
      )}
      {showFlagUser && (
        <FlagUserModal
          targetUser={showFlagUser.targetUser}
          currentUser={user}
          communityId={activeCommId}
          onClose={() => setShowFlagUser(null)}
        />
      )}
      {showReport && (
        <ReportModal data={showReport} user={user} onClose={() => setShowReport(null)} />
      )}

      {/* Profile Shop Modal */}
      {showShop && (
        <ProfileShop user={user} onClose={() => setShowShop(false)} />
      )}
      {/* Help Center Modal */}
      {showHelp && (
        <HelpModal user={user} onClose={() => setShowHelp(false)} />
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <ThemePicker
          currentTheme={currentTheme}
          onClose={() => setShowThemePicker(false)}
          onThemeChange={(t) => setCurrentTheme(t)}
        />
      )}

      {/* -- EVENTS MODAL -- */}
      {showEventsModal && (
        <div className="modal-overlay" onClick={() => setShowEventsModal(false)}>
          <div className="events-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="events-modal-header">
              <h2>
                <i className="fa-solid fa-calendar-days" style={{ marginRight: 10 }}></i>
                Campus Events
              </h2>
              <button onClick={() => setShowEventsModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            
            {/* Content */}
            <div className="events-modal-content">
              {eventsLoading ? (
                <div className="events-loading">
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                  Loading events...
                </div>
              ) : (
                <>
                  {/* Campus-Wide Events Section */}
                  <div className="events-section">
                    <h3 className="events-section-title">
                      <i className="fa-solid fa-university"></i> Campus-Wide
                    </h3>
                    {campusEvents.length === 0 ? (
                      <div className="events-empty">No upcoming campus events</div>
                    ) : (
                      <div className="events-list">
                        {campusEvents.map(event => (
                          <EventCard key={event.id} event={event} showCircleName={false} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Circle Events Section */}
                  <div className="events-section">
                    <h3 className="events-section-title">
                      <i className="fa-solid fa-users"></i> Your Circles
                    </h3>
                    {circleEvents.length === 0 ? (
                      <div className="events-empty">
                        {communities.length === 0 
                          ? "Join circles to see their events"
                          : "No upcoming events from your circles"}
                      </div>
                    ) : (
                      <div className="events-list">
                        {circleEvents.map(event => (
                          <EventCard key={event.id} event={event} showCircleName={true} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card-bg)', border: '1px solid rgba(247,95,95,0.4)',
            borderRadius: 16, padding: 28, maxWidth: 340, width: '90%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)', textAlign: 'center',
          }}>
            <i className="fa-solid fa-right-from-bracket" style={{ fontSize: 32, color: 'var(--red)', marginBottom: 14, display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: 1 }}>LOG OUT?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Are you sure you want to end your session?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="cyber-btn secondary" onClick={handleCancelLogout}
                style={{ flex: 1, fontSize: 13 }}>Cancel</button>
              <button className="cyber-btn" onClick={confirmLogout}
                style={{ flex: 1, fontSize: 13, background: 'rgba(180,30,30,0.85)', borderColor: 'var(--red)', color: '#fff' }}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



