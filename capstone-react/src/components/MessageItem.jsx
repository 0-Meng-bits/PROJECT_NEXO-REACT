import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { containsBadWord } from './AnnouncementCard';
import { MediaMessage } from './MediaMessageHelpers';
import CustomizedUsername from './CustomizedUsername';

// -- MESSAGE ITEM --------------------------------------------------------------
export default function MessageItem({ m, tagColor, isOwnerMsg, canDelete, onDelete, onEdit, onReport, currentStudentId, avatarUrl, onViewProfile, online, readers, isLastOwn, isGrouped, isLastInGroup, userCustomizations, onReply }) {
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
        .select('reaction, sender_id').eq('message_id', m.id);
      if (data) {
        const grouped = {};
        data.forEach(r => {
          if (!grouped[r.reaction]) grouped[r.reaction] = [];
          grouped[r.reaction].push(r.sender_id);
        });
        setReactions(grouped);
        // Fetch names for all reactors
        const ids = [...new Set(data.map(r => r.sender_id).filter(Boolean))];
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
        .delete().eq('message_id', m.id).eq('sender_id', currentStudentId);
      setReactions(prev => ({ ...prev, [type]: (prev[type] || []).filter(s => s !== currentStudentId) }));
    } else {
      // Delete any existing reaction first, then add the new one
      await supabase.from('message_reactions')
        .delete().eq('message_id', m.id).eq('sender_id', currentStudentId);
      await supabase.from('message_reactions')
        .insert([{ message_id: m.id, sender_id: currentStudentId, reaction: type }]);
      
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
              <div className="chat-avatar" onClick={() => onViewProfile && onViewProfile(m.sender_id)}
                style={{ background: avatarUrl ? 'transparent' : tagColor, overflow: 'hidden', cursor: onViewProfile ? 'pointer' : 'default' }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              {/* Companion sticker on chat avatar */}
              {(() => {
                const companion = userCustomizations?.[m.sender_id]?.companion;
                if (!companion?.css_data) return null;
                const d = typeof companion.css_data === 'string' ? JSON.parse(companion.css_data) : companion.css_data;
                if (!d?.url) return null;
                return (
                  <img src={d.url} alt="" style={{
                    position: 'absolute', top: '-15%', left: '-15%',
                    width: '55%', height: 'auto',
                    pointerEvents: 'none', zIndex: 2,
                    filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
                    transform: 'rotate(-15deg)',
                  }} />
                );
              })()}
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
            <span className="chat-name" onClick={() => onViewProfile && onViewProfile(m.sender_id)}
              style={{ cursor: onViewProfile ? 'pointer' : 'default', transition: 'color 0.15s' }}
              onMouseEnter={e => { if (onViewProfile) e.target.style.color = 'var(--cyber-cyan)'; }}
              onMouseLeave={e => { e.target.style.color = ''; }}>
              <CustomizedUsername 
                studentId={m.sender_id} 
                username={m.full_name}
                customizations={userCustomizations[m.sender_id]}
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
        ) : m.message_type === 'shoutout' ? (
          // -- SHOUTOUT BUBBLE --
          <div style={{
            background: 'linear-gradient(135deg, rgba(252,238,10,0.15), rgba(247,169,79,0.1))',
            border: '1.5px solid rgba(252,238,10,0.5)',
            borderRadius: 16, padding: '10px 16px',
            boxShadow: '0 0 16px rgba(252,238,10,0.15)',
            position: 'relative', maxWidth: 320,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <i className="fa-solid fa-star" style={{ color: '#f5e642', fontSize: 13 }}></i>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#f5e642', letterSpacing: 2, textTransform: 'uppercase' }}>Shoutout</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {m.content.replace(/^shoutout!\s*/i, '')}
            </p>
            {m.edited && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4, display: 'block' }}>edited</span>}
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

        {/* Inline action bar — appears below bubble on hover */}
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
                  {[['heart','fa-solid fa-heart','#f43f5e'],['laugh','fa-solid fa-face-laugh-squint','#facc15'],['sad','fa-solid fa-face-sad-tear','#60a5fa'],['fire','fa-solid fa-fire','#f97316'],['wow','fa-solid fa-face-surprise','#a78bfa']].map(([type, icon, color]) => (
                    <button key={type} onClick={() => { toggleReaction(type); setShowEmojiPicker(false); }}
                      style={{ background: reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.15)' : 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 4px', borderRadius: 8, transition: 'transform 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                      <i className={icon} style={{ color, fontSize: 18 }}></i>
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
                onClick={() => onReport({ type: 'message', id: m.id, preview: m.content, reportedUserId: m.sender_id })}
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
              {[['heart','fa-solid fa-heart','#f43f5e'],['laugh','fa-solid fa-face-laugh-squint','#facc15'],['sad','fa-solid fa-face-sad-tear','#60a5fa'],['fire','fa-solid fa-fire','#f97316'],['wow','fa-solid fa-face-surprise','#a78bfa']].map(([type, icon, color]) =>
                reactions[type]?.length > 0 ? (
                  <button key={type} onClick={() => { setShowReactors(true); setReactorTab(type); }}
                    style={{ background: reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${reactions[type]?.includes(currentStudentId) ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '2px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}>
                    <i className={icon} style={{ color, fontSize: 13 }}></i> <span style={{ fontSize: 11 }}>{reactions[type].length}</span>
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
                  {[['heart','fa-solid fa-heart','#f43f5e'],['laugh','fa-solid fa-face-laugh-squint','#facc15'],['sad','fa-solid fa-face-sad-tear','#60a5fa'],['fire','fa-solid fa-fire','#f97316'],['wow','fa-solid fa-face-surprise','#a78bfa']].map(([type, icon, color]) =>
                    reactions[type]?.length > 0 ? (
                      <button key={type} onClick={() => setReactorTab(type)}
                        style={{ background: reactorTab === type ? 'rgba(0,240,255,0.15)' : 'none', border: `1px solid ${reactorTab === type ? 'var(--cyber-cyan)' : 'transparent'}`, borderRadius: 20, padding: '3px 8px', fontSize: 12, cursor: 'pointer', color: reactorTab === type ? 'var(--cyber-cyan)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <i className={icon} style={{ color, fontSize: 12 }}></i> {reactions[type].length}
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
                  {[['heart','fa-solid fa-heart','#f43f5e'],['laugh','fa-solid fa-face-laugh-squint','#facc15'],['sad','fa-solid fa-face-sad-tear','#60a5fa'],['fire','fa-solid fa-fire','#f97316'],['wow','fa-solid fa-face-surprise','#a78bfa']]
                    .filter(([type]) => reactorTab === 'all' || reactorTab === type)
                    .flatMap(([type, icon, color]) =>
                      (reactions[type] || []).map(id => ({ id, icon, color, type }))
                    )
                    .map(({ id, icon, color, type }) => (
                      <div key={type + '-' + id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: id === currentStudentId ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.85)' }}>
                          {reactorNames[id] || '...'}
                          {id === currentStudentId && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-muted)' }}>you</span>}
                        </span>
                        <i className={icon} style={{ color, fontSize: 16 }}></i>
                      </div>
                    ))
                  }
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {!editing && (isLastInGroup || m.edited) && (
          <div className={`chat-meta${isOwnerMsg ? ' own' : ''}`} style={!isOwnerMsg ? { marginTop: 2 } : {}}>
            {m.edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
            {isLastInGroup && <span className="chat-time">{time}</span>}
            {isLastInGroup && readers?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }} title={`Seen by: ${readers.map(r => r.full_name).join(', ')}`}>
                {readers.slice(0, 5).map((r, i) => (
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
                {readers.length > 5 && (
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--card-bg)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'var(--text-muted)', marginLeft: -4, flexShrink: 0 }}>
                    +{readers.length - 5}
                  </div>
                )}
              </div>
            )}
            {isOwnerMsg && isLastInGroup && (!readers || readers.length === 0) && (isLastOwn || hovered) && (
              <span style={{ marginLeft: 3, color: 'var(--text-muted)', fontSize: 10 }} title="Sent">
                <i className="fa-solid fa-check" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
