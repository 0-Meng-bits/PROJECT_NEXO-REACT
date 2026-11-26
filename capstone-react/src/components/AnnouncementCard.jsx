import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import CommentTree from './CommentTree';
import EventPollBadge from './EventPollBadge';
import PollClosureButton from './PollClosureButton';
import GeneratedEventLink from './GeneratedEventLink';

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
      <span>{Number.isInteger(points) ? points : points.toFixed(1)}</span>
      {showLabel && <span style={{ fontSize: s.font - 1, opacity: 0.8, marginLeft: 2 }}>? {color.label}</span>}
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

async function autoFlagContent({ reporterId, reportedUserId, contentType, contentId, contentPreview }) {
  await supabase.from('reports').insert([{
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    content_type: contentType,
    content_id: contentId,
    content_preview: contentPreview?.slice(0, 200),
    reason: 'Auto-detected: inappropriate language',
    status: 'pending',
  }]);
  if (reportedUserId) {
    await supabase.from('notifications').insert([{
      user_id: reportedUserId,
      type: 'application_update',
      message: 'Your message was flagged for inappropriate language and blocked. Please follow community guidelines.',
    }]);
  }
}

// -- POST TYPE CONFIG ----------------------------------------------------------
const POST_TYPE = {
  announcement: { label: 'Announcement', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-bullhorn' },
  event:        { label: 'Event',         color: 'var(--cyber-cyan)',   icon: 'fa-solid fa-calendar' },
  shoutout:     { label: 'Shoutout',      color: 'var(--green)',        icon: 'fa-solid fa-star' },
  general:      { label: 'Thread',        color: '#a78bfa',             icon: 'fa-solid fa-comments' },
  thread:       { label: 'Thread',        color: '#a78bfa',             icon: 'fa-solid fa-comments' },
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
  { id: 'effort',    label: 'Effort',    emoji: '💪', color: '#22c55e' },
  { id: 'creative',  label: 'Creative',  emoji: '🎨', color: '#a855f7' },
  { id: 'technique', label: 'Technique', emoji: '🔧', color: '#3b82f6' },
  { id: 'style',     label: 'Style',     emoji: '✨', color: '#ec4899' },
  { id: 'impact',    label: 'Impact',    emoji: '💥', color: '#ef4444' },
];

// -- SHOWCASE TAG BAR ----------------------------------------------------------
// Renders feedback-tag reaction buttons for showcase posts.
// Uses post_reactions table with reaction_type = 'tag:<tagId>'.
function ShowcaseTagBar({ announcementId, authorId, communityId, currentUserId, currentUserName, onShowToast }) {
  const [tagCounts, setTagCounts] = useState({});
  const [myTags, setMyTags] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!announcementId) return;
    supabase
      .from('post_reactions')
      .select('user_id, reaction_type')
      .eq('announcement_id', announcementId)
      .like('reaction_type', 'tag:%')
      .then(({ data }) => {
        const counts = {};
        const mine = new Set();
        (data || []).forEach(r => {
          const tag = r.reaction_type.replace('tag:', '');
          counts[tag] = (counts[tag] || 0) + 1;
          if (r.user_id === currentUserId) mine.add(tag);
        });
        setTagCounts(counts);
        setMyTags(mine);
      });
  }, [announcementId, currentUserId]);

  const toggleTag = async (tagId) => {
    if (!currentUserId) return;
    if (currentUserId === authorId) {
      onShowToast?.('You cannot tag your own showcase.');
      return;
    }
    setLoading(true);
    const reactionType = `tag:${tagId}`;
    if (myTags.has(tagId)) {
      await supabase.from('post_reactions')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('user_id', currentUserId)
        .eq('reaction_type', reactionType);
      setMyTags(prev => { const s = new Set(prev); s.delete(tagId); return s; });
      setTagCounts(prev => ({ ...prev, [tagId]: Math.max(0, (prev[tagId] || 1) - 1) }));
    } else {
      await supabase.from('post_reactions')
        .insert([{ announcement_id: announcementId, user_id: currentUserId, reaction_type: reactionType }]);
      setMyTags(prev => new Set([...prev, tagId]));
      setTagCounts(prev => ({ ...prev, [tagId]: (prev[tagId] || 0) + 1 }));
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 }}>
      {FEEDBACK_TAGS.map(tag => {
        const active = myTags.has(tag.id);
        const count = tagCounts[tag.id] || 0;
        return (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 14, fontSize: 11, fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: active ? `${tag.color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? tag.color : 'rgba(255,255,255,0.1)'}`,
              color: active ? tag.color : 'var(--text-muted)',
              transition: 'all 0.15s',
              fontWeight: active ? 700 : 400,
            }}>
            <span>{tag.emoji}</span>
            <span>{tag.label}</span>
            {count > 0 && <span style={{ opacity: 0.75 }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function AnnouncementCard({ a, user, onPin, onDelete, onVote, onApply, onReport, avatarCache, communityCreatorId, onReload, onViewEvents, onViewProfile, onViewProfileById }) {
  const type = POST_TYPE[a.post_type] || POST_TYPE.general;
  const isAnon = !!a.anonymous || a.author_name === 'Anonymous';
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
        .maybeSingle()
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
  const [replyingTo, setReplyingTo] = useState(null); // { id, author_name, author_id }
  const [replyInput, setReplyInput] = useState('');
  const [commentHearts, setCommentHearts] = useState({}); // commentId -> { count, likedByMe }
  const [commentAvatarCache, setCommentAvatarCache] = useState({}); // author_id (UUID) -> avatar_url
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentVal, setEditingCommentVal] = useState('');
  const [commentSort, setCommentSort] = useState('new'); // 'new' | 'old' | 'top'
  const [collapsedThreads, setCollapsedThreads] = useState({});

  // Post like state
  const [postLiked, setPostLiked] = useState(false);
  const [postLikeCount, setPostLikeCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('post_reactions')
      .select('user_id', { count: 'exact' })
      .eq('announcement_id', a.id)
      .eq('reaction_type', 'like')
      .then(({ data, count, error }) => {
        if (error) { console.error('[POST LIKE] fetch error:', error.message); return; }
        setPostLikeCount(count || 0);
        setPostLiked((data || []).some(r => r.user_id === user.id));
      });
  }, [a.id, user?.id]);

  const togglePostLike = async () => {
    if (!user?.id) return;
    if (postLiked) {
      const { error } = await supabase.from('post_reactions').delete().eq('announcement_id', a.id).eq('user_id', user.id).eq('reaction_type', 'like');
      if (error) { console.error('[POST LIKE] unlike error:', error.message); return; }
      setPostLiked(false);
      setPostLikeCount(p => Math.max(0, p - 1));
    } else {
      const { error } = await supabase.from('post_reactions').insert([{ announcement_id: a.id, user_id: user.id, reaction_type: 'like' }]);
      if (error) { console.error('[POST LIKE] like error:', error.message); return; }
      setPostLiked(true);
      setPostLikeCount(p => p + 1);
    }
  };

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
      .select('id, announcement_id, author_id, content, created_at, parent_id, edited')
      .eq('announcement_id', a.id)
      .order('created_at', { ascending: true });

    let enrichedComments = data || [];
    // Load author profiles & avatars (keyed by UUID)
    if (enrichedComments.length > 0) {
      const authorIds = [...new Set([...enrichedComments.map(c => c.author_id).filter(Boolean), user?.id].filter(Boolean))];
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('accounts')
          .select('id, full_name, user_type, account_details(avatar_url)')
          .in('id', authorIds);
        if (profiles) {
          const avatarMap = {};
          const accMap = {};
          profiles.forEach(p => {
            accMap[p.id] = p;
            if (p.account_details?.avatar_url) avatarMap[p.id] = p.account_details.avatar_url;
          });
          setCommentAvatarCache(avatarMap);
          enrichedComments = enrichedComments.map(c => ({
            ...c,
            author_name: accMap[c.author_id]?.full_name || 'User',
            author_type: accMap[c.author_id]?.user_type || 'Student',
          }));
        }
      }
    }

    // Store flat — tree is built at render time by CommentTree
    setComments(enrichedComments);
    setLoadingComments(false);
    // Load heart counts for these comments
    if (enrichedComments.length && user?.id) {
      const ids = enrichedComments.map(c => c.id);
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
      content: commentInput.trim(),
    }]).select('id, announcement_id, author_id, content, created_at, parent_id, edited').single();
    setPostingComment(false);
    if (!error && data) {
      const enriched = {
        ...data,
        author_name: user.full_name || user.student_id || 'User',
        author_type: user.user_type || 'Student',
      };
      setComments(prev => [...prev, enriched]);
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

  const updateComment = async (commentId, newContent) => {
    if (!newContent.trim()) return;
    const { error } = await supabase.from('post_comments')
      .update({ content: newContent.trim(), edited: true })
      .eq('id', commentId);
    if (!error) {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: newContent.trim(), edited: true } : c));
      setEditingCommentId(null);
      setEditingCommentVal('');
    }
  };

  const submitReply = async () => {
    if (!replyInput.trim() || !user || !replyingTo) return;
    const content = `@${replyingTo.author_name} ${replyInput.trim()}`;
    const { data, error } = await supabase.from('post_comments').insert([{
      announcement_id: a.id,
      author_id: user.id,
      content,
      parent_id: replyingTo.id,
    }]).select('id, announcement_id, author_id, content, created_at, parent_id, edited').single();
    if (!error && data) {
      const enriched = {
        ...data,
        author_name: user.full_name || user.student_id || 'User',
        author_type: user.user_type || 'Student',
      };
      // Just append flat — CommentTree handles ordering via parent_id
      setComments(prev => [...prev, enriched]);
      setCommentCount(prev => prev + 1);
      setReplyInput('');
      setReplyingTo(null);
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
        <div className={`announcement-author-avatar ${isAnon ? 'anon' : ''}`}
          style={{ overflow: 'hidden', padding: 0, cursor: !isAnon && onViewProfile ? 'pointer' : 'default' }}
          onClick={() => !isAnon && onViewProfile && onViewProfile(a.author_student_id)}>
          {isAnon
            ? <i className="fa-solid fa-user-secret"></i>
            : (() => {
                const url = avatarCache?.[a.author_student_id] || avatarCache?.[String(a.author_student_id)];
                // For circle auto-posts (no author_student_id), use circle logo from avatarCache keyed by community_id
                const circleLogoUrl = !a.author_student_id && a.community_id ? avatarCache?.[`circle_${a.community_id}`] : null;
                return (url || circleLogoUrl)
                  ? <img src={url || circleLogoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : avatarChar;
              })()
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{ fontWeight: 700, fontSize: 13, color: isAnon ? 'var(--text-muted)' : 'var(--text-primary)', cursor: !isAnon && onViewProfile ? 'pointer' : 'default', transition: 'color 0.15s' }}
              onClick={() => !isAnon && onViewProfile && onViewProfile(a.author_student_id)}
              onMouseEnter={e => { if (!isAnon && onViewProfile) e.target.style.color = 'var(--cyber-cyan)'; }}
              onMouseLeave={e => { e.target.style.color = isAnon ? 'var(--text-muted)' : 'var(--text-primary)'; }}>
              {displayName}
            </span>
            {isAnon && (
              <span style={{ fontSize: 10, color: '#666', border: '1px solid #333', padding: '1px 7px', borderRadius: 10, fontStyle: 'italic' }}>
                anonymous
              </span>
            )}
            <span className="post-type-badge" style={{ fontSize: 10, color: type.color, border: `1px solid ${type.color}`, padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i className={type.icon}></i><span className="post-type-label">{type.label}</span>
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
            {!isAnon && a.post_type === 'thread' && a.author_student_id && (
              <span style={{ marginLeft: 4, color: 'var(--text-muted)' }}>? {a.author_student_id}</span>
            )}
          </div>
          {a.cross_posted_from && a.post_type !== 'thread' && a.post_type !== 'general' && (
            <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-circle-check"></i>
              Published from a verified circle
            </div>
          )}
          {a.visibility === 'connections' && (
            <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fa-solid fa-lock"></i>
              Connections only
            </div>
          )}
        </div>
        {(user?.user_type === 'Admin' || (!isAnon && a.author_id === user?.id) || (isAnon && a.author_id === user?.id)) && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
      {a.media_url && (
        <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
          {a.media_url.match(/\.(mp4|webm|mov)$/i)
            ? <video src={a.media_url} controls style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 10, display: 'block' }} />
            : <img src={a.media_url} alt="Post attachment" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 10, cursor: 'pointer', display: 'block' }} onClick={() => window.open(a.media_url, '_blank')} />
          }
        </div>
      )}

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
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{myVote ? ` ? You voted "${myVote}"` : a.event_metadata?.is_closed ? " ? Poll Closed" : " ? Click to vote"}
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
            {a.event_metadata.winning_option && ` ? Winning option: ${a.event_metadata.winning_option}`}
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
            onReload?.();
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
        {/* Action bar: like + comments toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Like button */}
          <button onClick={togglePostLike}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: postLiked ? '#f43f5e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
            onMouseLeave={e => e.currentTarget.style.color = postLiked ? '#f43f5e' : 'var(--text-muted)'}>
            <i className={postLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
            {postLikeCount > 0 && <span>{postLikeCount}</span>}
          </button>
          {/* Toggle comments button */}
          <button onClick={toggleComments}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--cyber-cyan)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <i className="fa-regular fa-comment"></i>
            {showComments ? 'Hide comments' : `Comments${commentCount > 0 ? ` (${commentCount})` : ''}`}
            <i className={`fa-solid fa-chevron-${showComments ? 'up' : 'down'}`} style={{ fontSize: 9 }}></i>
          </button>
        </div>{/* end action bar */}

        {showComments && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
            {/* Sort bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sort:</span>
              {[['new','New'],['old','Old'],['top','Top']].map(([key, label]) => (
                <button key={key} onClick={() => setCommentSort(key)}
                  style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: commentSort === key ? 700 : 400,
                    background: commentSort === key ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: commentSort === key ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Scrollable comment list ? max 400px, input stays pinned below */}
            <div style={{ overflowY: 'auto', maxHeight: 400, paddingRight: 4 }}>
            {loadingComments ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading comments...</p>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No comments yet. Be the first!</p>
            ) : (
              <CommentTree
                comments={comments}
                commentSort={commentSort}
                commentHearts={commentHearts}
                collapsedThreads={collapsedThreads}
                setCollapsedThreads={setCollapsedThreads}
                editingCommentId={editingCommentId}
                editingCommentVal={editingCommentVal}
                setEditingCommentId={setEditingCommentId}
                setEditingCommentVal={setEditingCommentVal}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                setReplyInput={setReplyInput}
                user={user}
                avatarCache={{ ...avatarCache, ...commentAvatarCache }}
                onViewProfileById={onViewProfileById}
                onReport={onReport}
                isQuestion={isQuestion}
                isAuthorizedSolver={isAuthorizedSolver}
                solutionCommentId={a.solution_comment_id}
                markingSolution={markingSolution}
                markSolution={markSolution}
                updateComment={updateComment}
                deleteComment={deleteComment}
                toggleCommentHeart={toggleCommentHeart}
                containsBadWord={containsBadWord}
              />
            )}
            </div>{/* end scrollable */}
            {user?.is_verified && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 8 }}>
                {replyingTo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 10px', background: 'rgba(0,240,255,0.06)', borderRadius: 8, fontSize: 11 }}>
                    <i className="fa-solid fa-reply" style={{ color: 'var(--cyber-cyan)', fontSize: 10 }}></i>
                    <span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>Replying to {replyingTo.author_name}</span>
                    <button onClick={() => setReplyingTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0, overflow: 'hidden' }}>
                    {commentAvatarCache?.[user.id] || avatarCache?.[user.id] ? <img src={commentAvatarCache[user.id] || avatarCache[user.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (user.full_name || 'U')[0].toUpperCase()}
                  </div>
                  <input
                    value={replyingTo ? replyInput : commentInput}
                    onChange={e => replyingTo ? setReplyInput(e.target.value) : setCommentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { replyingTo ? submitReply() : submitComment(); } }}
                    placeholder={replyingTo ? `Reply to ${replyingTo.author_name}...` : 'Write a comment...'}
                    style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '7px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,240,255,0.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button
                    onClick={() => replyingTo ? submitReply() : submitComment()}
                    disabled={postingComment || !(replyingTo ? replyInput.trim() : commentInput.trim())}
                    style={{ background: 'var(--cyber-cyan)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000', fontSize: 12, flexShrink: 0, opacity: (replyingTo ? replyInput.trim() : commentInput.trim()) ? 1 : 0.4 }}>
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}


export { Toast, TrustPointsBadge, POST_TYPE, timeSince, containsBadWord, autoFlagContent, FEEDBACK_TAGS };
export default AnnouncementCard;