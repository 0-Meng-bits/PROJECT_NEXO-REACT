import { useState } from 'react';

const timeSince = (dateStr) => {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Recursively renders a comment + its children up to maxDepth
function CommentNode({
  c, depth, maxDepth,
  commentHearts, collapsedThreads, setCollapsedThreads,
  editingCommentId, editingCommentVal, setEditingCommentId, setEditingCommentVal,
  replyingTo, setReplyingTo, setReplyInput,
  user, avatarCache, onViewProfileById, onReport,
  isQuestion, isAuthorizedSolver, solutionCommentId, markingSolution, markSolution,
  updateComment, deleteComment, toggleCommentHeart, containsBadWord,
}) {
  const isSolution = c.id === solutionCommentId;
  const replyCount = c._children?.length || 0;
  const isCollapsed = collapsedThreads[c.id];

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {depth > 0 && (
          <div style={{ width: 2, alignSelf: 'stretch', background: 'rgba(0,240,255,0.18)', borderRadius: 2, flexShrink: 0 }} />
        )}
        {/* Avatar */}
        <div
          style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--cyber-cyan)', flexShrink: 0, overflow: 'hidden', cursor: onViewProfileById ? 'pointer' : 'default' }}
          onClick={() => onViewProfileById && onViewProfileById(c.author_id)}>
          {avatarCache?.[c.author_id]
            ? <img src={avatarCache[c.author_id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (c.author_name || 'U')[0].toUpperCase()}
        </div>
        {/* Bubble */}
        <div style={{ flex: 1, background: isSolution ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSolution ? 'rgba(34,211,238,0.4)' : containsBadWord(c.content) ? 'rgba(247,95,95,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '7px 11px' }}>
          {isSolution && <div style={{ fontSize: 10, color: '#22d3ee', fontWeight: 700, marginBottom: 4 }}>✓ Accepted Answer</div>}
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{c.author_name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeSince(c.created_at)}</span>
              {c.edited && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>· edited</span>}
              {c.author_id === user?.id && (
                <button onClick={() => { setEditingCommentId(c.id); setEditingCommentVal(c.content); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '0 2px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--cyber-cyan)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <i className="fa-solid fa-pen"></i>
                </button>
              )}
              {(c.author_id === user?.id || user?.user_type === 'Admin') && (
                <button onClick={() => deleteComment(c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '0 2px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              )}
              {onReport && c.author_id !== user?.id && user?.user_type !== 'Admin' && (
                <button onClick={() => onReport({ type: 'message', id: c.id, preview: c.content, reportedUserId: c.author_id })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 10, padding: '0 2px', opacity: 0.5 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                  <i className="fa-solid fa-flag"></i>
                </button>
              )}
            </div>
          </div>
          {containsBadWord(c.content) && (
            <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 3 }}>
              <i className="fa-solid fa-triangle-exclamation"></i> Flagged
            </div>
          )}
          {/* Edit input or content */}
          {editingCommentId === c.id ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
              <input value={editingCommentVal} onChange={e => setEditingCommentVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') updateComment(c.id, editingCommentVal);
                  if (e.key === 'Escape') { setEditingCommentId(null); setEditingCommentVal(''); }
                }}
                autoFocus
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.35)', borderRadius: 8, padding: '4px 9px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, outline: 'none' }} />
              <button onClick={() => updateComment(c.id, editingCommentVal)} disabled={!editingCommentVal.trim()}
                style={{ background: 'var(--cyber-cyan)', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', color: '#000', fontSize: 10 }}>
                <i className="fa-solid fa-check" />
              </button>
              <button onClick={() => { setEditingCommentId(null); setEditingCommentVal(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
          )}
          {/* Solution button */}
          {isQuestion && isAuthorizedSolver && (
            <button onClick={() => markSolution(c.id)} disabled={markingSolution}
              style={{ marginTop: 4, fontSize: 10, padding: '2px 8px', borderRadius: 8, cursor: 'pointer', border: isSolution ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.1)', background: isSolution ? 'rgba(34,211,238,0.1)' : 'transparent', color: isSolution ? '#22d3ee' : 'var(--text-muted)' }}>
              {isSolution ? '✓ Unmark Solution' : '✓ Mark as Solution'}
            </button>
          )}
          {/* Heart + Reply */}
          {user?.is_verified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <button onClick={() => toggleCommentHeart(c.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: commentHearts[c.id]?.likedByMe ? '#f43f5e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                onMouseLeave={e => e.currentTarget.style.color = commentHearts[c.id]?.likedByMe ? '#f43f5e' : 'var(--text-muted)'}>
                <i className={commentHearts[c.id]?.likedByMe ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
                {commentHearts[c.id]?.count > 0 && <span style={{ fontSize: 10 }}>{commentHearts[c.id].count}</span>}
              </button>
              {depth < maxDepth && (
                <button
                  onClick={() => { setReplyingTo({ id: c.id, author_name: c.author_name, author_id: c.author_id }); setReplyInput(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: replyingTo?.id === c.id ? 'var(--cyber-cyan)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--cyber-cyan)'}
                  onMouseLeave={e => e.currentTarget.style.color = replyingTo?.id === c.id ? 'var(--cyber-cyan)' : 'var(--text-muted)'}>
                  <i className="fa-solid fa-reply"></i>Reply
                </button>
              )}
            </div>
          )}
          {/* Collapse toggle */}
          {replyCount > 0 && (
            <button
              onClick={() => setCollapsedThreads(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--cyber-cyan)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0 0', fontFamily: 'inherit' }}>
              <i className={`fa-solid fa-chevron-${isCollapsed ? 'down' : 'up'}`} style={{ fontSize: 9 }}></i>
              {isCollapsed ? `Show ${replyCount} repl${replyCount > 1 ? 'ies' : 'y'}` : 'Hide replies'}
            </button>
          )}
        </div>
      </div>
      {/* Render children */}
      {!isCollapsed && c._children?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {c._children.map(child => (
            <CommentNode key={child.id} c={child} depth={depth + 1} maxDepth={maxDepth}
              commentHearts={commentHearts} collapsedThreads={collapsedThreads} setCollapsedThreads={setCollapsedThreads}
              editingCommentId={editingCommentId} editingCommentVal={editingCommentVal}
              setEditingCommentId={setEditingCommentId} setEditingCommentVal={setEditingCommentVal}
              replyingTo={replyingTo} setReplyingTo={setReplyingTo} setReplyInput={setReplyInput}
              user={user} avatarCache={avatarCache} onViewProfileById={onViewProfileById} onReport={onReport}
              isQuestion={isQuestion} isAuthorizedSolver={isAuthorizedSolver} solutionCommentId={solutionCommentId}
              markingSolution={markingSolution} markSolution={markSolution}
              updateComment={updateComment} deleteComment={deleteComment}
              toggleCommentHeart={toggleCommentHeart} containsBadWord={containsBadWord}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentTree({
  comments, commentSort, commentHearts, collapsedThreads, setCollapsedThreads,
  editingCommentId, editingCommentVal, setEditingCommentId, setEditingCommentVal,
  replyingTo, setReplyingTo, setReplyInput,
  user, avatarCache, onViewProfileById, onReport,
  isQuestion, isAuthorizedSolver, solutionCommentId, markingSolution, markSolution,
  updateComment, deleteComment, toggleCommentHeart, containsBadWord,
  maxDepth = 3,
}) {
  const buildTree = (nodes, parentId = null, depth = 0) => {
    if (depth > maxDepth) return [];
    return nodes
      .filter(c => (c.parent_id || null) === parentId)
      .map(c => ({ ...c, _depth: depth, _children: buildTree(nodes, c.id, depth + 1) }));
  };

  const sorted = [...comments];
  if (commentSort === 'top') sorted.sort((a, b) => (commentHearts[b.id]?.count || 0) - (commentHearts[a.id]?.count || 0));
  else if (commentSort === 'new') sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const tree = buildTree(sorted);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {tree.map(c => (
        <CommentNode key={c.id} c={c} depth={0} maxDepth={maxDepth}
          commentHearts={commentHearts} collapsedThreads={collapsedThreads} setCollapsedThreads={setCollapsedThreads}
          editingCommentId={editingCommentId} editingCommentVal={editingCommentVal}
          setEditingCommentId={setEditingCommentId} setEditingCommentVal={setEditingCommentVal}
          replyingTo={replyingTo} setReplyingTo={setReplyingTo} setReplyInput={setReplyInput}
          user={user} avatarCache={avatarCache} onViewProfileById={onViewProfileById} onReport={onReport}
          isQuestion={isQuestion} isAuthorizedSolver={isAuthorizedSolver} solutionCommentId={solutionCommentId}
          markingSolution={markingSolution} markSolution={markSolution}
          updateComment={updateComment} deleteComment={deleteComment}
          toggleCommentHeart={toggleCommentHeart} containsBadWord={containsBadWord}
        />
      ))}
    </div>
  );
}
