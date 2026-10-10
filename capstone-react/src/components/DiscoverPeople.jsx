import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../lib/api';
import { INTEREST_LABELS } from '../lib/constants';

const CATEGORY_COLORS = {
  academic: '#3b82f6',
  hobby:    '#a855f7',
  social:   '#f59e0b',
  project:  '#22c55e',
};

function ConnectionStatusBadge({ status }) {
  if (status === 'accepted') return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(62,207,142,0.15)', color: '#3ecf8e', border: '1px solid #3ecf8e', fontWeight: 700 }}>
      <i className="fa-solid fa-link" style={{ marginRight: 4 }}></i>Connected
    </span>
  );
  if (status === 'pending') return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(252,238,10,0.1)', color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', fontWeight: 700 }}>
      <i className="fa-solid fa-clock" style={{ marginRight: 4 }}></i>Pending
    </span>
  );
  return null;
}

function UserCard({ user, onConnect, onCancelRequest, onViewProfile, connecting }) {
  const canConnect = !user.connection_status;
  const isPending = user.connection_status === 'pending';
  const initials = (user.full_name || 'U')[0].toUpperCase();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => onViewProfile?.(user.ctu_id)}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,240,255,0.15)', border: '2px solid rgba(0,240,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: 'var(--cyber-cyan)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => onViewProfile?.(user.ctu_id)}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onMouseEnter={e => e.target.style.color = 'var(--cyber-cyan)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-primary)'}
          >
            {user.full_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.course || user.user_type}</div>
        </div>
        <ConnectionStatusBadge status={user.connection_status} />
      </div>

      {/* Interests */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(user.interests || []).slice(0, 5).map(interest => (
          <span key={interest} style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {INTEREST_LABELS[interest] || interest}
          </span>
        ))}
        {user.interests?.length > 5 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>
            +{user.interests.length - 5} more
          </span>
        )}
      </div>

      {/* Shared interests indicator */}
      {user.shared_interest_count > 0 && (
        <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fa-solid fa-bolt" style={{ fontSize: 10 }}></i>
          {user.shared_interest_count} shared interest{user.shared_interest_count !== 1 ? 's' : ''}
        </div>
      )}

      {/* Connect / Cancel button */}
      {canConnect && (
        <button
          onClick={() => onConnect(user.id)}
          disabled={connecting === user.id}
          style={{
            marginTop: 4, padding: '7px 0', width: '100%',
            background: 'rgba(0,240,255,0.08)', border: '1px solid var(--cyber-cyan)',
            borderRadius: 8, color: 'var(--cyber-cyan)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            transition: 'background 0.2s', opacity: connecting === user.id ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (connecting !== user.id) e.currentTarget.style.background = 'rgba(0,240,255,0.18)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,240,255,0.08)'}
        >
          {connecting === user.id
            ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Sending...</>
            : <><i className="fa-solid fa-user-plus" style={{ marginRight: 6 }}></i>Connect</>
          }
        </button>
      )}
      {isPending && (
        <button
          onClick={() => onCancelRequest(user.id, user.connection_id)}
          disabled={connecting === user.id}
          style={{
            marginTop: 4, padding: '7px 0', width: '100%',
            background: 'rgba(247,95,95,0.08)', border: '1px solid var(--red)',
            borderRadius: 8, color: 'var(--red)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,95,95,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(247,95,95,0.08)'}
        >
          <i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i>Cancel Request
        </button>
      )}
    </div>
  );
}

function CircleCard({ circle, onJoin }) {
  const catColor = CATEGORY_COLORS[circle.category] || '#666';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${circle.has_connected_member ? 'rgba(0,240,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12,
      padding: 16,
      position: 'relative',
    }}>
      {circle.has_connected_member && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: 10, padding: '2px 8px', borderRadius: 8,
          background: 'rgba(0,240,255,0.1)', color: 'var(--cyber-cyan)',
          border: '1px solid rgba(0,240,255,0.3)', fontWeight: 700,
        }}>
          <i className="fa-solid fa-link" style={{ marginRight: 4 }}></i>Connection inside
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${catColor}20`, border: `1px solid ${catColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: catColor, fontSize: 16,
        }}>
          <i className="fa-solid fa-users"></i>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{circle.name}</div>
          <div style={{ fontSize: 10, color: catColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {circle.category} · {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      {circle.description && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          {circle.description.slice(0, 100)}{circle.description.length > 100 ? '...' : ''}
        </p>
      )}
      {circle.interest_tag && (
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 8, marginBottom: 10, display: 'inline-block',
          background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {INTEREST_LABELS[circle.interest_tag] || circle.interest_tag}
        </span>
      )}
      {!circle.is_member && (
        <button
          onClick={() => onJoin?.(circle.id)}
          style={{
            display: 'block', width: '100%', padding: '7px 0',
            background: `${catColor}18`, border: `1px solid ${catColor}`,
            borderRadius: 8, color: catColor, cursor: 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit', marginTop: 4,
          }}
        >
          <i className="fa-solid fa-door-open" style={{ marginRight: 6 }}></i>Apply to Join
        </button>
      )}
      {circle.is_member && (
        <div style={{ fontSize: 11, color: '#3ecf8e', marginTop: 4 }}>
          <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }}></i>Already a member
        </div>
      )}
    </div>
  );
}

export default function DiscoverPeople({ user, onShowToast, onViewProfile, onNavigateToCircle }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [circles, setCircles] = useState([]);
  const [view, setView] = useState('suggested'); // 'suggested' | 'all'
  const [activeFilter, setActiveFilter] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [search, setSearch] = useState('');

  const fetchDiscover = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/discover'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.error('[DISCOVER] Server returned non-JSON response — is the local server running?');
        } else {
          const data = await res.json();
          setUsers(data.users || []);
          setCircles(data.circles || []);
        }
      } else {
        const text = await res.text();
        console.error('[DISCOVER] Error response:', res.status, text);
      }
    } catch (err) {
      console.error('[DISCOVER]', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDiscover(); }, [fetchDiscover]);

  const handleCancelRequest = async (targetId, connectionId) => {
    if (!connectionId) return;
    setConnecting(targetId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'remove', connection_id: connectionId }),
      });
      if (res.ok) {
        onShowToast?.('Connection request cancelled.');
        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, connection_status: null, connection_id: null } : u));
      } else {
        onShowToast?.('Failed to cancel request.');
      }
    } catch {
      onShowToast?.('Failed to cancel request.');
    }
    setConnecting(null);
  };

  const handleConnect = async (targetId) => {
    setConnecting(targetId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'request', to: targetId }),
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast?.('Connection request sent!');
        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, connection_status: 'pending' } : u));
      } else {
        onShowToast?.(data.message || 'Failed to send request.');
      }
    } catch {
      onShowToast?.('Connection failed. Please try again.');
    }
    setConnecting(null);
  };

  // Get all unique interests from the user list for filter chips
  const allInterests = [...new Set(users.flatMap(u => u.interests || []))].sort();

  // Filter and view logic
  let displayedUsers = users;
  if (view === 'suggested') {
    displayedUsers = users.filter(u => u.shared_interest_count > 0);
  }
  if (activeFilter) {
    displayedUsers = displayedUsers.filter(u => u.interests?.includes(activeFilter));
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    displayedUsers = displayedUsers.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.course?.toLowerCase().includes(q) ||
      u.interests?.some(i => (INTEREST_LABELS[i] || i).toLowerCase().includes(q))
    );
  }

  // Group by interest for "All" view
  const grouped = {};
  if (view === 'all' && !activeFilter && !search.trim()) {
    allInterests.forEach(interest => {
      const group = displayedUsers.filter(u => u.interests?.includes(interest));
      if (group.length > 0) grouped[interest] = group;
    });
  }

  return (
    <div style={{ width: '100%', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-users-viewfinder" style={{ color: 'var(--cyber-cyan)' }}></i>
          Discover People
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Find students who share your interests and connect with them.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}></i>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, course, or interest..."
          style={{
            width: '100%', padding: '10px 14px 10px 36px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: 'var(--text-primary)', fontSize: 13,
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--cyber-cyan)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['suggested','fa-solid fa-bolt','Suggested'],['all','fa-solid fa-users','All People']].map(([v, icon, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              background: view === v ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${view === v ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
              color: view === v ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer',
            }}>
            <i className={icon} style={{ marginRight: 6 }}></i>{label}
          </button>
        ))}
      </div>

      {/* Interest filter chips */}
      {allInterests.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setActiveFilter(null)}
            style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              background: !activeFilter ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${!activeFilter ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
              color: !activeFilter ? 'var(--cyber-cyan)' : 'var(--text-muted)',
            }}>
            All
          </button>
          {allInterests.map(interest => (
            <button key={interest} onClick={() => setActiveFilter(activeFilter === interest ? null : interest)}
              style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                background: activeFilter === interest ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activeFilter === interest ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`,
                color: activeFilter === interest ? 'var(--cyber-cyan)' : 'var(--text-muted)',
              }}>
              {INTEREST_LABELS[interest] || interest}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--cyber-cyan)', marginBottom: 12, display: 'block' }}></i>
          Loading people...
        </div>
      ) : (
        <>
          {/* Open Circles section */}
          {circles.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                <i className="fa-solid fa-network-wired" style={{ marginRight: 8, color: 'var(--cyber-cyan)' }}></i>
                Open Circles
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {circles.map(circle => (
                  <CircleCard key={circle.id} circle={circle} onJoin={onNavigateToCircle} />
                ))}
              </div>
            </div>
          )}

          {/* People section */}
          {view === 'all' && !activeFilter && !search.trim() ? (
            // Grouped by interest
            Object.keys(grouped).length === 0 ? (
              <EmptyState view={view} />
            ) : (
              Object.entries(grouped).map(([interest, groupUsers]) => (
                <div key={interest} style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                    {INTEREST_LABELS[interest] || interest} · {groupUsers.length}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {groupUsers.map(u => (
                      <UserCard key={u.id} user={u} onConnect={handleConnect} onCancelRequest={handleCancelRequest} onViewProfile={onViewProfile} connecting={connecting} />
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            // Flat list (suggested or filtered)
            displayedUsers.length === 0 ? (
              <EmptyState view={view} filter={activeFilter} search={search} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {displayedUsers.map(u => (
                  <UserCard key={u.id} user={u} onConnect={handleConnect} onCancelRequest={handleCancelRequest} onViewProfile={onViewProfile} connecting={connecting} />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ view, filter, search }) {
  if (search) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
      No results for "{search}"
    </div>
  );
  if (filter) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-filter" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
      No people found with this interest.
    </div>
  );
  if (view === 'suggested') return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-bolt" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
      <div style={{ marginBottom: 6 }}>No suggested people yet.</div>
      <div style={{ fontSize: 12 }}>Switch to "All People" to browse everyone, or update your interests in your profile.</div>
    </div>
  );
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-users" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
      No people to discover yet. Check back later.
    </div>
  );
}
