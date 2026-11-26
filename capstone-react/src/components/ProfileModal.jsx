import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { clearCustomizationCache } from '../lib/customization';
import Cropper from 'react-easy-crop';
import { TrustPointsBadge } from './AnnouncementCard';
import { GivePointsModal, WarningHistoryModal, AppealModal } from './ModerationModals';
import ThemePicker from './ThemePicker';
import ProfileShop from './ProfileShop';
import CustomizedUsername from './CustomizedUsername';

// -- HELPERS ------------------------------------------------------------------
const SHOP_API = window.location.hostname === 'localhost'
  ? '/api/shop'
  : `${import.meta.env.VITE_API_URL || ''}/api/shop`;

async function getFreshToken() {
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) {
      localStorage.setItem('accessToken', data.session.access_token);
      localStorage.setItem('refreshToken', data.session.refresh_token);
      return data.session.access_token;
    }
  } catch { /* fall through */ }
  return localStorage.getItem('accessToken');
}

function getCroppedImg(imageSrc, pixelCrop, outputW, outputH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputW, outputH);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

function ImageCropModal({ file, aspect, circular, outputW, outputH, onConfirm, onCancel }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  }, [file]);

  const onCropComplete = useCallback((_, cap) => setCroppedAreaPixels(cap), []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setConfirming(true);
    try {
      const result = await getCroppedImg(imageSrc, croppedAreaPixels, outputW, outputH);
      onConfirm(result);
    } catch (err) { console.error('Crop error:', err); }
    finally { setConfirming(false); }
  };

  if (!imageSrc) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 0, overflow: 'hidden', borderRadius: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--cyber-cyan)', letterSpacing: 1 }}>
            <i className="fa-solid fa-crop-simple" style={{ marginRight: 8 }}></i>
            {circular ? 'CROP PROFILE PHOTO' : 'CROP COVER PHOTO'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%', height: circular ? 340 : 220, background: '#000' }}>
          <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={aspect} cropShape={circular ? 'round' : 'rect'} showGrid={!circular} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
        </div>
        <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="fa-solid fa-magnifying-glass-minus" style={{ fontSize: 12, color: 'var(--text-muted)' }}></i>
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--cyber-cyan)' }} />
          <i className="fa-solid fa-magnifying-glass-plus" style={{ fontSize: 12, color: 'var(--text-muted)' }}></i>
        </div>
        <div style={{ padding: '10px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="cyber-btn secondary" onClick={onCancel} style={{ fontSize: 12, padding: '7px 18px' }}><i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i>CANCEL</button>
          <button className="cyber-btn" onClick={handleConfirm} disabled={confirming} style={{ fontSize: 12, padding: '7px 18px' }}>
            {confirming ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>PROCESSING...</> : <><i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>CONFIRM</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- CONSTANTS ----------------------------------------------------------------
const INTEREST_LABELS = {
  art: 'Art', coding: 'Coding', design: 'Design', gaming: 'Gaming',
  music: 'Music', sports: 'Sports', research: 'Research',
  photography: 'Photography', writing: 'Writing', travel: 'Travel',
  debate: 'Debate', language: 'Language Learning', anime: 'Anime',
  bxgl: 'Watching BL/GL',
};
const INTEREST_BUBBLES = Object.entries(INTEREST_LABELS).map(([id, label]) => ({ id, label }));
const PROGRAMS = ['BEED','BIT - AUTOMOTIVE','BIT - COMPUTER TECHNOLOGY','BIT - ELECTRONICS','BSED - MATH','BSFI','BSHM','BSIE','BSIT','BTLED - HE'];

// -- PROFILE TRUST POINTS SECTION ---------------------------------------------
function ProfileTrustPointsSection({ userId, onViewHistory }) {
  const [trustPoints, setTrustPoints] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from('account_status').select('trust_points').eq('id', userId).single();
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
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>TRUST POINTS</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TrustPointsBadge points={trustPoints} size="large" showLabel={true} />
        <button onClick={onViewHistory} style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', color: 'var(--cyber-cyan)', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-history"></i> View History
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

// -- PROFILE PHOTOS SECTION ---------------------------------------------------
function ProfilePhotosSection({ user, readOnly, editing, pendingPhotos, photoUploading, onUpload, onDelete, onTogglePrivacy, onReport }) {
  const [savedPhotos, setSavedPhotos] = useState([null, null]);
  const [reactions, setReactions] = useState({});
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const photoRefs = [useRef(null), useRef(null)];

  useEffect(() => {
    if (viewingPhoto) {
      window.history.pushState({ photoViewer: true }, '');
      window.__nexoOverlayCloser = () => setViewingPhoto(null);
      return () => { window.__nexoOverlayCloser = null; };
    }
  }, [viewingPhoto]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profile_photos').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        const arr = [null, null];
        data.forEach(p => { arr[p.slot - 1] = p; });
        setSavedPhotos(arr);
      }
    });
  }, [user?.id]);

  const photos = editing && pendingPhotos ? [pendingPhotos[1], pendingPhotos[2]] : savedPhotos;

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
          const slot = i + 1;
          const photo = photos[i];
          const isUploading = photoUploading === slot;
          return (
            <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {photo?.photo_url ? (
                <>
                  <img src={photo.photo_url} alt={`Photo ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: !editing ? 'pointer' : 'default' }}
                    onClick={() => !editing && setViewingPhoto({ url: photo.photo_url, id: photo.id })}
                  />
                  {!readOnly && editing && (
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button onClick={() => onTogglePrivacy(slot)} title={photo.is_public ? 'Public' : 'Private'}
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: photo.is_public ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                        <i className={`fa-solid ${photo.is_public ? 'fa-globe' : 'fa-lock'}`}></i>
                      </button>
                      <button onClick={() => photoRefs[i].current?.click()} title="Replace"
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: 'white' }}>
                        <i className="fa-solid fa-camera"></i>
                      </button>
                      <button onClick={() => onDelete(slot)} title="Delete"
                        style={{ background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 11, color: 'var(--red)' }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  )}
                  {readOnly && photo.id && (
                    <>
                      <button onClick={() => toggleReact(photo.id)}
                        style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                        <i className="fa-solid fa-heart" style={{ color: reactions[photo.id]?.myReact ? '#ff4d6d' : 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}></i>
                        {reactions[photo.id]?.count > 0 && <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>{reactions[photo.id].count}</span>}
                      </button>
                      {onReport && (
                        <button onClick={() => onReport({ type: 'profile_photo', id: photo.id, preview: `Profile photo ${slot} of ${user?.full_name}`, reportedUserId: user?.id })}
                          title="Report this photo"
                          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(247,95,95,0.4)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 10, color: 'var(--red)' }}>
                          <i className="fa-solid fa-flag" />
                        </button>
                      )}
                    </>
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
                <input ref={photoRefs[i]} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onUpload(slot, e.target.files[0])} />
              )}
            </div>
          );
        })}
      </div>
      {viewingPhoto && ReactDOM.createPortal(
        <div onClick={() => setViewingPhoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button onClick={() => setViewingPhoto(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: 'white', zIndex: 1 }}>
            <i className="fa-solid fa-xmark" />
          </button>
          <img src={viewingPhoto.url} alt="Profile photo" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
          {viewingPhoto.id && reactions[viewingPhoto.id] !== undefined && (
            <button onClick={e => { e.stopPropagation(); toggleReact(viewingPhoto.id); }}
              style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <i className="fa-solid fa-heart" style={{ color: reactions[viewingPhoto.id]?.myReact ? '#ff4d6d' : 'rgba(255,255,255,0.5)' }} />
              {reactions[viewingPhoto.id]?.count > 0 && <span style={{ color: 'white', fontWeight: 700 }}>{reactions[viewingPhoto.id].count}</span>}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// -- PROFILE MODAL ------------------------------------------------------------
export default function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl, readOnly, onUpdateUser, onCircleInfo, onReport, currentUserId, onShowToast }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || user.avatar_url || null);

  // -- Connection & block state (read-only / other-user view only) --
  const [connStatus, setConnStatus]     = useState(null);
  const [connId, setConnId]             = useState(null);
  const [connIsSender, setConnIsSender] = useState(false);
  const [connLoading, setConnLoading]   = useState(false);
  const [isBlocked, setIsBlocked]       = useState(false);

  useEffect(() => {
    if (!readOnly || !currentUserId || !user?.id) return;
    setConnStatus(null);
    setConnId(null);
    setConnIsSender(false);
    setIsBlocked(false);
    const fetchConn = async () => {
      const [{ data }, { data: blockRow }] = await Promise.all([
        supabase.from('connections').select('id, status, user_id')
          .or(`and(user_id.eq.${currentUserId},connected_user_id.eq.${user.id}),and(user_id.eq.${user.id},connected_user_id.eq.${currentUserId})`)
          .maybeSingle(),
        supabase.from('blocks').select('id')
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', user.id)
          .maybeSingle(),
      ]);
      setIsBlocked(!!blockRow);
      if (data && data.status !== 'declined') {
        setConnStatus(data.status);
        setConnId(data.id);
        setConnIsSender(data.user_id === currentUserId);
      }
    };
    fetchConn();
  }, [readOnly, currentUserId, user?.id]);

  const handleConnect = async () => {
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'request', to: user.id }),
      });
      const data = await res.json();
      if (res.ok) { setConnStatus('pending'); setConnId(data.connection?.id || null); setConnIsSender(true); onShowToast?.('Connection request sent!'); }
      else onShowToast?.(data.message || 'Failed to send request.');
    } catch { onShowToast?.('Connection failed. Please try again.'); }
    setConnLoading(false);
  };

  const handleCancelOrDisconnect = async () => {
    if (!connId) return;
    if (connStatus === 'accepted' && !confirm(`Disconnect from ${user.full_name || 'this user'}?`)) return;
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'remove', connection_id: connId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const wasAccepted = connStatus === 'accepted';
        setConnStatus(null);
        setConnId(null);
        setConnectionsCount(prev => wasAccepted ? Math.max(0, prev - 1) : prev);
        onShowToast?.(wasAccepted ? 'Disconnected.' : 'Request cancelled.');
      } else {
        onShowToast?.(data.message || 'Action failed.');
      }
    } catch { onShowToast?.('Action failed. Please try again.'); }
    setConnLoading(false);
  };

  const handleDecline = async () => {
    if (!connId) return;
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'decline', connection_id: connId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setConnStatus(null); setConnId(null); onShowToast?.('Connection request declined.'); }
      else onShowToast?.(data.message || 'Failed to decline.');
    } catch { onShowToast?.('Failed. Please try again.'); }
    setConnLoading(false);
  };

  const handleAccept = async () => {
    if (!connId) return;
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'accept', connection_id: connId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConnStatus('accepted');
        setConnectionsCount(prev => prev + 1);
        onShowToast?.('Connection accepted!');
      } else {
        onShowToast?.(data.message || 'Failed to accept.');
      }
    } catch { onShowToast?.('Failed. Please try again.'); }
    setConnLoading(false);
  };

  const handleBlockUser = async () => {
    if (!user?.id || !confirm(`Block ${user.full_name || 'this user'}? They will be disconnected and unable to send you connection requests.`)) return;
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'block', target_id: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (connStatus === 'accepted') setConnectionsCount(prev => Math.max(0, prev - 1));
        setIsBlocked(true);
        setConnStatus(null);
        setConnId(null);
        onShowToast?.(`${user.full_name || 'User'} blocked.`);
      } else {
        onShowToast?.(data.message || 'Failed to block user.');
      }
    } catch { onShowToast?.('Failed to block user.'); }
    setConnLoading(false);
  };

  const handleUnblockUser = async () => {
    if (!user?.id) return;
    setConnLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(getApiUrl('/api/connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'unblock', target_id: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsBlocked(false);
        onShowToast?.(`${user.full_name || 'User'} unblocked.`);
      } else {
        onShowToast?.(data.message || 'Failed to unblock user.');
      }
    } catch { onShowToast?.('Failed to unblock user.'); }
    setConnLoading(false);
  };

  const [pendingAvatarUrl, setPendingAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const idPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [idUploaded, setIdUploaded] = useState(!!user.id_photo_url);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: user.full_name || '', program: user.program || '', year_level: user.year_level || '', interests: user.interests || [], bio: user.bio || '', discoverable: user.discoverable !== false });
  const [profile, setProfile] = useState({ program: user.program || '', year_level: user.year_level || '', interests: user.interests || [], bio: user.bio || '' });
  const [coverUrl, setCoverUrl] = useState(user.cover_url || null);
  const [viewingCover, setViewingCover] = useState(false);

  useEffect(() => {
    if (viewingCover) {
      window.history.pushState({ coverViewer: true }, '');
      window.__nexoOverlayCloser = () => setViewingCover(false);
      return () => { window.__nexoOverlayCloser = null; };
    }
  }, [viewingCover]);

  const [pendingCoverUrl, setPendingCoverUrl] = useState(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState(null);
  const [showWarningHistory, setShowWarningHistory] = useState(false);
  const [appealingWarning, setAppealingWarning] = useState(null);
  const [customizations, setCustomizations] = useState(null);
  const [ownedItems, setOwnedItems] = useState([]);
  const [custSettings, setCustSettings] = useState(null);
  const [pendingCustSettings, setPendingCustSettings] = useState(null);
  const [profilePhotos, setProfilePhotos] = useState({ 1: null, 2: null });
  const [pendingPhotos, setPendingPhotos] = useState({ 1: null, 2: null });
  const [photoUploading, setPhotoUploading] = useState(null);
  const photo1Ref = useRef(null);
  const photo2Ref = useRef(null);
  const [profileConnections, setProfileConnections] = useState([]);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [expandedAvatar, setExpandedAvatar] = useState(false);

  useEffect(() => {
    if (expandedAvatar) {
      window.history.pushState({ avatarViewer: true }, '');
      window.__nexoOverlayCloser = () => setExpandedAvatar(false);
      return () => { if (window.__nexoOverlayCloser) window.__nexoOverlayCloser = null; };
    }
  }, [expandedAvatar]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const [{ data, error }, { data: interestRows }] = await Promise.all([
        supabase.from('account_details').select('program, year_level, avatar_url, id_photo_url, cover_url, bio, discoverable').eq('id', user.id).maybeSingle(),
        supabase.from('user_interests').select('interest').eq('user_id', user.id),
      ]);
      const interests = (interestRows || []).map(r => r.interest);
      if (!error && data) {
        const disc = data.discoverable !== false;
        setProfile({ program: data.program || '', year_level: data.year_level || '', interests, bio: data.bio || '', discoverable: disc });
        setEditForm(f => ({ ...f, full_name: user.full_name || f.full_name || '', program: data.program || '', year_level: data.year_level || '', interests, bio: data.bio || '', discoverable: disc }));
        if (data.avatar_url && !avatarUrl) setAvatarUrl(data.avatar_url);
        if (data.cover_url) setCoverUrl(data.cover_url);
        if (data.id_photo_url) setIdUploaded(true);
      } else if (interests.length > 0) {
        setProfile(p => ({ ...p, interests }));
        setEditForm(f => ({ ...f, interests }));
      }
      if (user?.id) {
        const { data: photos } = await supabase.from('profile_photos').select('*').eq('user_id', user.id);
        if (photos) {
          const map = { 1: null, 2: null };
          photos.forEach(p => { map[p.slot] = p; });
          setProfilePhotos(map);
          setPendingPhotos({ ...map });
        }
      }
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (readOnly) {
      supabase.from('connections').select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`).eq('status', 'accepted')
        .then(({ count }) => setConnectionsCount(count || 0));
    } else {
      getFreshToken().then(token => fetch(getApiUrl('/api/connections'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.json())
        .then(data => {
          const rows = Array.isArray(data) ? data : [];
          const accepted = rows.filter(c => c.status === 'accepted');
          setConnectionsCount(accepted.length);
          setProfileConnections(accepted);
        })
        .catch(() => {}));
      // Fetch blocked users list for own profile
      supabase.from('blocks').select('id, blocked_id, accounts!blocked_id(id, full_name, ctu_id)')
        .eq('blocker_id', user.id)
        .then(({ data }) => setBlockedUsers(data || []));
    }
  }, [user?.id, readOnly]);

  useEffect(() => {
    if (!user?.id) return;
    const loadCustomizations = async () => {
      const { data: settings } = await supabase.from('user_profile_settings')
        .select('active_name_color, active_background, active_theme, active_avatar_border, active_companion')
        .eq('user_id', user.id).maybeSingle();
      setCustSettings(settings || {});
      setPendingCustSettings(settings || {});
      if (settings) {
        const itemIds = [settings.active_name_color, settings.active_background, settings.active_theme, settings.active_avatar_border, settings.active_companion].filter(Boolean);
        if (itemIds.length > 0) {
          const { data: items } = await supabase.from('shop_items').select('*').in('id', itemIds);
          if (items) {
            setCustomizations({
              name_color: items.find(i => i.id === settings.active_name_color),
              background: items.find(i => i.id === settings.active_background),
              theme: items.find(i => i.id === settings.active_theme),
              avatar_border: items.find(i => i.id === settings.active_avatar_border),
              companion: items.find(i => i.id === settings.active_companion),
            });
          }
        }
      }
      const { data: purchases } = await supabase.from('user_purchases').select('item_id, shop_items(*)').eq('user_id', user.id);
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
        body: JSON.stringify({ full_name: editForm.full_name, program: editForm.program, year_level: editForm.year_level, interests: editForm.interests, bio: editForm.bio, discoverable: editForm.discoverable !== false }),
      });
      if (!res.ok) {
        // Fallback: save directly via authenticated Supabase client
        const detailsPayload = {
          program: editForm.program,
          year_level: editForm.year_level,
          bio: editForm.bio,
          discoverable: editForm.discoverable !== false,
        };
        const [accRes, detRes, delIntRes] = await Promise.all([
          editForm.full_name?.trim()
            ? supabase.from('accounts').update({ full_name: editForm.full_name.trim() }).eq('id', user.id)
            : Promise.resolve({ error: null }),
          supabase.from('account_details').upsert([{ id: user.id, ...detailsPayload }], { onConflict: 'id' }),
          supabase.from('user_interests').delete().eq('user_id', user.id),
        ]);
        let intErr = delIntRes.error;
        if (!intErr && Array.isArray(editForm.interests) && editForm.interests.length > 0) {
          const insIntRes = await supabase.from('user_interests').insert(
            editForm.interests.map(interest => ({ user_id: user.id, interest }))
          );
          intErr = insIntRes.error;
        }
        if (accRes.error || detRes.error || intErr) {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.message || detRes.error?.message || accRes.error?.message || intErr?.message || 'Failed to save profile changes.';
          onShowToast ? onShowToast(msg) : alert(msg);
          setSaving(false);
          return;
        }
      }
      setProfile({ ...editForm });
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const updates = { ...editForm };

      if (pendingCoverUrl) {
        const token = localStorage.getItem('accessToken');
        await fetch(getApiUrl('/api/update-profile'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ userId: user.id, cover_url: pendingCoverUrl }),
        });
        setCoverUrl(pendingCoverUrl);
        setPendingCoverUrl(null);
        updates.cover_url = pendingCoverUrl;
      }

      if (pendingAvatarUrl) {
        const res2 = await fetch(getApiUrl('/api/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('accessToken') ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } : {}) },
          body: JSON.stringify({ action: 'upload-avatar', userId: user.id, avatar: pendingAvatarUrl }),
        });
        if (res2.ok) {
          const { url } = await res2.json();
          onAvatarUpdate(url || pendingAvatarUrl);
          updates.avatar_url = url || pendingAvatarUrl;
        } else {
          onAvatarUpdate(pendingAvatarUrl);
          updates.avatar_url = pendingAvatarUrl;
        }
        setPendingAvatarUrl(null);
      }

      localStorage.setItem('currentUser', JSON.stringify({ ...stored, ...updates }));
      onUpdateUser && onUpdateUser(prev => ({ ...(prev || {}), ...updates }));

      if (pendingCustSettings) {
        const token = localStorage.getItem('accessToken');
        const types = ['name_color', 'avatar_border', 'background', 'companion', 'theme'];
        for (const type of types) {
          const pendingVal = pendingCustSettings[`active_${type}`];
          const savedVal = custSettings?.[`active_${type}`];
          if (pendingVal !== savedVal) {
            await fetch(SHOP_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ action: 'apply-customization', userId: user.id, type, itemId: pendingVal || null }),
            });
          }
        }
        clearCustomizationCache(user.id);
        setCustSettings({ ...pendingCustSettings });
      }

      const nextPhotos = { ...profilePhotos };
      for (const slot of [1, 2]) {
        const pending = pendingPhotos[slot];
        const saved = profilePhotos[slot];
        if (pending === null && saved) {
          await supabase.from('profile_photos').delete().eq('id', saved.id);
          nextPhotos[slot] = null;
        } else if (pending && pending !== saved) {
          if (saved) {
            await supabase.from('profile_photos').update({ photo_url: pending.photo_url, is_public: pending.is_public }).eq('id', saved.id);
            nextPhotos[slot] = { ...saved, photo_url: pending.photo_url, is_public: pending.is_public };
          } else {
            const { data } = await supabase.from('profile_photos').insert([{ user_id: user.id, photo_url: pending.photo_url, slot, is_public: pending.is_public ?? true }]).select().single();
            if (data) nextPhotos[slot] = data;
          }
        } else if (pending && pending.is_public !== saved?.is_public) {
          await supabase.from('profile_photos').update({ is_public: pending.is_public }).eq('id', saved.id);
          nextPhotos[slot] = { ...saved, is_public: pending.is_public };
        }
      }
      setProfilePhotos(nextPhotos);
      setPendingPhotos({ ...nextPhotos });
      setEditing(false);
      onShowToast?.('Profile updated!');
    } catch (err) {
      console.error(err);
      onShowToast?.('Failed to save profile.');
    }
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
      setPendingPhotos(prev => ({ ...prev, [slot]: { ...(prev[slot] || {}), photo_url: urlData.publicUrl, slot, is_public: prev[slot]?.is_public ?? true } }));
    } catch (err) { console.error('Photo upload error:', err); }
    setPhotoUploading(null);
  };

  const handlePhotoDelete = async (slot) => {
    setPendingPhotos(prev => ({ ...prev, [slot]: null }));
  };

  const togglePhotoPrivacy = async (slot) => {
    setPendingPhotos(prev => ({ ...prev, [slot]: prev[slot] ? { ...prev[slot], is_public: !prev[slot].is_public } : null }));
  };

  const applyCustomization = async (type, itemId) => {
    setPendingCustSettings(prev => ({ ...prev, [`active_${type}`]: itemId }));
    if (itemId) {
      const { data: item } = await supabase.from('shop_items').select('*').eq('id', itemId).single();
      if (item) setCustomizations(prev => ({ ...prev, [type]: item }));
    } else {
      setCustomizations(prev => ({ ...prev, [type]: null }));
    }
  };

  const handleIdPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIdUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `id-photos/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('id-photos').upload(path, file, { contentType: file.type, upsert: true });
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

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingCropFile({ file, type: 'cover' });
    e.target.value = '';
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingCropFile({ file, type: 'avatar' });
    e.target.value = '';
  };

  const coverGradients = [
    'linear-gradient(135deg,#0d3b6e 0%,#00f0ff 100%)',
    'linear-gradient(135deg,#1a003a 0%,#c084fc 100%)',
    'linear-gradient(135deg,#003a1a 0%,#3ecf8e 100%)',
    'linear-gradient(135deg,#3a1a00 0%,#f97316 100%)',
    'linear-gradient(135deg,#1a0a0f 0%,#f43f5e 100%)',
  ];
  const gradIdx = (user.student_id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % coverGradients.length;
  const displayCoverUrl = editing ? (pendingCoverUrl ?? coverUrl) : coverUrl;
  const coverBg = displayCoverUrl ? `url(${displayCoverUrl}) center/cover no-repeat` : coverGradients[gradIdx];

  const getBackgroundStyle = () => {
    if (customizations?.background?.css_data) {
      const data = typeof customizations.background.css_data === 'string' ? JSON.parse(customizations.background.css_data) : customizations.background.css_data;
      if (data.pattern) return { background: data.pattern, backgroundSize: data.size || '30px 30px' };
      if (data.backgroundImage) return { backgroundImage: data.backgroundImage, backgroundSize: data.backgroundSize || 'cover', backgroundPosition: data.backgroundPosition || 'center', backgroundRepeat: data.backgroundRepeat || 'no-repeat' };
      if (data.image) return { background: data.image, backgroundSize: data.backgroundSize || 'auto', backgroundRepeat: data.backgroundRepeat || 'repeat' };
      if (data.gradient) return { background: data.gradient };
    }
    return {};
  };

  const getThemeStyle = () => {
    if (customizations?.theme?.css_data) {
      const data = typeof customizations.theme.css_data === 'string' ? JSON.parse(customizations.theme.css_data) : customizations.theme.css_data;
      return { '--cyber-cyan': data.primary || 'var(--cyber-cyan)', '--cyber-yellow': data.secondary || 'var(--cyber-yellow)' };
    }
    return {};
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal-box" onClick={e => e.stopPropagation()} style={{
        backgroundColor: 'var(--card-bg)', ...getBackgroundStyle(), ...getThemeStyle(),
        border: '1px solid rgba(0,240,255,0.15)', borderRadius: 16, width: '100%', maxWidth: 820,
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.7)', scrollbarWidth: 'none',
      }}>

        {/* COVER */}
        <div className="profile-modal-cover" style={{ position: 'relative', height: 220, background: coverBg, borderRadius: '16px 16px 0 0', overflow: 'hidden', flexShrink: 0, cursor: displayCoverUrl && !editing ? 'pointer' : 'default' }}
          onClick={() => displayCoverUrl && !editing && setViewingCover(true)}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
          {!readOnly && editing && (
            <>
              <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading} title="Change cover"
                style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(6px)' }}>
                {coverUploading ? <><i className="fa-solid fa-spinner fa-spin" /> UPLOADING</> : <><i className="fa-solid fa-image" /> COVER</>}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </>
          )}
          {readOnly && user?.cover_url && onReport && (
            <button onClick={() => onReport({ type: 'profile_photo', id: user.id, preview: `Cover photo of ${user.full_name}`, reportedUserId: user.id })}
              title="Report this cover photo"
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(247,95,95,0.4)', color: 'var(--red)', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(6px)', opacity: 0.8 }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.8}>
              <i className="fa-solid fa-flag" style={{ fontSize: 10 }} /> Report Cover
            </button>
          )}
        </div>

        {/* AVATAR + NAME ROW */}
        <div style={{ position: 'relative', padding: '0 28px', marginTop: -60 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="profile-modal-avatar" style={{ width: 116, height: 116, border: customizations?.avatar_border?.css_data?.border || '4px solid var(--card-bg)', borderRadius: '50%', background: 'rgba(0,240,255,0.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 800, color: 'var(--cyber-cyan)', boxShadow: customizations?.avatar_border?.css_data?.boxShadow || '0 0 20px rgba(0,240,255,0.25)' }}>
                {avatarUrl ? <img src={avatarUrl} alt="avatar" onClick={() => setExpandedAvatar(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} /> : initials}
              </div>
              {customizations?.companion?.css_data && (() => {
                const d = typeof customizations.companion.css_data === 'string' ? JSON.parse(customizations.companion.css_data) : customizations.companion.css_data;
                return <img src={d.url} alt="companion" className="profile-modal-companion" style={{ position: 'absolute', top: -28, left: -24, width: '80px', height: 'auto', pointerEvents: 'none', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.8))', zIndex: 3, transform: 'rotate(-15deg)' }} />;
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
              {readOnly && avatarUrl && onReport && (
                <button onClick={() => onReport({ type: 'profile_photo', id: user.id, preview: `Avatar photo of ${user.full_name}`, reportedUserId: user.id })}
                  title="Report this profile photo"
                  style={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(247,95,95,0.5)', color: 'var(--red)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-flag" />
                </button>
              )}
            </div>

            <div style={{ paddingBottom: 8, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editing ? (
                  <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} maxLength={60} autoComplete="off" className="profile-modal-name"
                    style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1, lineHeight: 1.2, background: 'transparent', border: 'none', borderBottom: '2px solid var(--cyber-cyan)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', textTransform: 'uppercase', padding: '0 2px', width: 'auto', minWidth: 60, maxWidth: 260 }} placeholder="YOUR NAME" />
                ) : (
                  <span className="profile-modal-name" style={{
                    fontSize: 24, fontWeight: 800, letterSpacing: 1, lineHeight: 1.2,
                    ...(customizations?.name_color?.css_data
                      ? (typeof customizations.name_color.css_data === 'string' ? JSON.parse(customizations.name_color.css_data) : customizations.name_color.css_data).gradient
                        ? { background: (typeof customizations.name_color.css_data === 'string' ? JSON.parse(customizations.name_color.css_data) : customizations.name_color.css_data).gradient, backgroundSize: '100%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent', display: 'inline-block' }
                        : { color: (typeof customizations.name_color.css_data === 'string' ? JSON.parse(customizations.name_color.css_data) : customizations.name_color.css_data).color }
                      : { color: 'var(--text-primary)' }
                    )
                  }}>
                    {user.full_name?.toUpperCase()}
                  </span>
                )}
                {customizations?.badge && <span style={{ fontSize: 16 }} title={customizations.badge.name}>{customizations.badge.preview_url}</span>}
                {user?.gender === 'Male' && <i className="fa-solid fa-mars" style={{ fontSize: 13, color: 'var(--cyber-cyan)', marginLeft: 4 }} title="Male" />}
                {user?.gender === 'Female' && <i className="fa-solid fa-venus" style={{ fontSize: 13, color: '#f472b6', marginLeft: 4 }} title="Female" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1, color: 'rgba(0,240,255,0.65)' }}>
                  <i className="fa-solid fa-id-card" style={{ marginRight: 5 }}></i>{user.student_id}
                </span>
                {user.is_verified
                  ? <i className="fa-solid fa-shield-halved" style={{ fontSize: 13, color: 'var(--cyber-cyan)' }} title="Verified Student" />
                  : <i className="fa-solid fa-clock" style={{ fontSize: 13, color: 'var(--orange)' }} title="Pending Verification" />
                }
              </div>
            </div>

            <div className="profile-edit-actions" style={{ display: 'flex', gap: 8, paddingBottom: 8, flexShrink: 0, marginLeft: 'auto' }}>
              {readOnly && (
                <>
                  {isBlocked ? (
                    <button className="cyber-btn secondary" onClick={handleUnblockUser} disabled={connLoading} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap', borderColor: '#f97316', color: '#f97316' }}>
                      {connLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-unlock" style={{ marginRight: 5 }} />UNBLOCK</>}
                    </button>
                  ) : (
                    <>
                      {connStatus === null && (
                        <button className="cyber-btn" onClick={handleConnect} disabled={connLoading} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>
                          {connLoading ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 5 }} />Sending...</> : <><i className="fa-solid fa-user-plus" style={{ marginRight: 5 }} />CONNECT</>}
                        </button>
                      )}
                      {connStatus === 'pending' && connIsSender && (
                        <button className="cyber-btn secondary" onClick={handleCancelOrDisconnect} disabled={connLoading} title="Click to cancel request" style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>
                          {connLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-clock" style={{ marginRight: 5 }} />PENDING</>}
                        </button>
                      )}
                      {connStatus === 'pending' && !connIsSender && (
                        <>
                          <button className="cyber-btn" onClick={handleAccept} disabled={connLoading} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>
                            {connLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" style={{ marginRight: 5 }} />ACCEPT</>}
                          </button>
                          <button className="cyber-btn secondary" onClick={handleDecline} disabled={connLoading} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>DECLINE</button>
                        </>
                      )}
                      {connStatus === 'accepted' && (
                        <button className="cyber-btn secondary" onClick={handleCancelOrDisconnect} disabled={connLoading} title="Click to disconnect" style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap', borderColor: '#3ecf8e', color: '#3ecf8e' }}>
                          {connLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-link" style={{ marginRight: 5 }} />CONNECTED</>}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
              {!readOnly && (!editing
                ? <button className="cyber-btn" onClick={() => { setEditForm(f => ({ ...f, ...profile, full_name: user.full_name || '' })); setEditing(true); }} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}><i className="fa-solid fa-pen" style={{ marginRight: 5 }} />EDIT</button>
                : <>
                    <button className="cyber-btn secondary" onClick={() => {
                      setEditForm({ ...profile, full_name: user.full_name || '' });
                      setPendingCustSettings({ ...custSettings });
                      setPendingPhotos({ ...profilePhotos });
                      setPendingCoverUrl(null);
                      setPendingAvatarUrl(null);
                      setAvatarUrl(currentAvatarUrl || user.avatar_url || null);
                      if (custSettings) {
                        const itemIds = Object.values(custSettings).filter(Boolean);
                        if (itemIds.length > 0) {
                          supabase.from('shop_items').select('*').in('id', itemIds).then(({ data: items }) => {
                            if (items) setCustomizations({
                              name_color: items.find(i => i.id === custSettings.active_name_color),
                              background: items.find(i => i.id === custSettings.active_background),
                              theme: items.find(i => i.id === custSettings.active_theme),
                              avatar_border: items.find(i => i.id === custSettings.active_avatar_border),
                              companion: items.find(i => i.id === custSettings.active_companion),
                            });
                          });
                        } else { setCustomizations(null); }
                      }
                      setEditing(false);
                    }} style={{ fontSize: 11, padding: '7px 14px', whiteSpace: 'nowrap' }}>CANCEL</button>
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
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${editing ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 10, padding: '10px 14px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>BIO</div>
                {editing ? (
                  <>
                    <textarea value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} maxLength={200} placeholder="Write something about yourself..."
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', fontFamily: 'inherit', minHeight: 60, boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>{(editForm.bio || '').length}/200</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: profile.bio ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.6, fontStyle: profile.bio ? 'normal' : 'italic' }}>{profile.bio || 'No bio yet.'}</div>
                )}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>PROGRAM</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)' }}>{profile.program || '—'}</div>
                {editing && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Contact admin to change your program.</div>}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${editing ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>YEAR</div>
                {editing ? (
                  <select value={editForm.year_level} onChange={e => setEditForm(f => ({ ...f, year_level: e.target.value }))} className="dark-select"
                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--cyber-cyan)', fontSize: 13, fontWeight: 700, padding: 0, outline: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ background: '#1a1a2e', color: 'white' }}>Select year</option>
                    {['1st Year','2nd Year','3rd Year','4th Year'].map(y => <option key={y} value={y} style={{ background: '#1a1a2e', color: 'white' }}>{y}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)' }}>{profile.year_level || '—'}</div>
                )}
              </div>
            </div>

            <ProfileTrustPointsSection userId={user.id} onViewHistory={() => setShowWarningHistory(true)} />

            {!readOnly && editing && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid var(--cyber-cyan)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 2 }}>APPEAR IN DISCOVER</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Allow others to find you on the Discover page</div>
                  </div>
                  <input type="checkbox" checked={editForm.discoverable !== false} onChange={e => setEditForm(f => ({ ...f, discoverable: e.target.checked }))}
                    style={{ accentColor: 'var(--cyber-cyan)', width: 18, height: 18, cursor: 'pointer' }} />
                </div>
              </div>
            )}

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
            )}

            <ProfilePhotosSection user={user} readOnly={readOnly} editing={editing} pendingPhotos={pendingPhotos} photoUploading={photoUploading} onUpload={handlePhotoUpload} onDelete={handlePhotoDelete} onTogglePrivacy={togglePhotoPrivacy} onReport={onReport} />

            {!readOnly && editing && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid var(--cyber-cyan)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
                  <i className="fa-solid fa-palette" style={{ marginRight: 6 }} />CUSTOMIZE
                </div>
                {ownedItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>You don't own any items yet. Visit the Profile Shop to get some!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {['name_color', 'avatar_border', 'background', 'companion', 'theme'].map(type => {
                      const typeItems = ownedItems.filter(p => p.shop_items?.type === type);
                      if (typeItems.length === 0) return null;
                      const activeId = pendingCustSettings?.[`active_${type}`];
                      return (
                        <div key={type}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700, marginBottom: 7, textTransform: 'uppercase' }}>{type.replace('_', ' ')}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => applyCustomization(type, null)}
                              style={{ padding: '5px 11px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: !activeId ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.4)', color: !activeId ? '#000' : 'var(--text-muted)', border: `1px solid ${!activeId ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}` }}>None</button>
                            {typeItems.map(p => (
                              <button key={p.item_id} onClick={() => applyCustomization(type, p.item_id)} title={p.shop_items.name}
                                style={{ padding: '5px 11px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.4)', color: activeId === p.item_id ? '#000' : 'var(--text-primary)', border: `1px solid ${activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}` }}>
                                {p.shop_items.type === 'badge' && p.shop_items.preview_url ? <>{p.shop_items.preview_url} {p.shop_items.name}</> : p.shop_items.name}
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
                {idUploaded && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />ID submitted — awaiting admin review</div>}
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
                    <div key={c.id}
                      onClick={() => {
                        if (readOnly && onCircleInfo) { onCircleInfo(c); }
                        else {
                          if (onClose) onClose();
                          if (c.id && c.id !== 'global') {
                            setTimeout(() => { window.dispatchEvent(new CustomEvent('nexo-navigate-circle', { detail: { circleId: c.id } })); }, 100);
                          }
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 8, padding: '4px 6px', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,240,255,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--cyber-cyan)', overflow: 'hidden' }}>
                        {c.logo_url ? <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <i className={c.faIcon || c.icon || 'fa-solid fa-circle-nodes'} style={{ fontSize: 12 }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!readOnly && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>CONNECTIONS</span>
                  <span style={{ fontSize: 13, color: 'var(--cyber-cyan)', fontWeight: 800 }}>{connectionsCount}</span>
                </div>
                {profileConnections.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No connections yet. Visit Discover to connect with peers.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {profileConnections.map(c => {
                      const curId = user.id;
                      const other = c.user_id === curId ? c.recipient : c.requester;
                      const name = other?.full_name || 'Unknown';
                      const ini = (name[0] || 'U').toUpperCase();
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--cyber-cyan)' }}>{ini}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</div>
                          <button onClick={async () => {
                              if (!confirm(`Disconnect from ${name}?`)) return;
                              const token = await getFreshToken();
                              const res = await fetch(getApiUrl('/api/connections'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'remove', connection_id: c.id }) });
                              if (res.ok) {
                                setProfileConnections(prev => prev.filter(x => x.id !== c.id));
                                setConnectionsCount(prev => Math.max(0, prev - 1));
                                onShowToast?.(`Disconnected from ${name}.`);
                              } else {
                                const err = await res.json().catch(() => ({}));
                                onShowToast?.(err.message || 'Failed to disconnect.');
                              }
                            }} title="Disconnect" style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: '2px 4px', opacity: 0.6, flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                            <i className="fa-solid fa-user-xmark"></i>
                          </button>
                          <button onClick={async () => {
                              const otherId = c.user_id === user.id ? c.connected_user_id : c.user_id;
                              if (!confirm(`Block ${name}?`)) return;
                              const token = await getFreshToken();
                              const res = await fetch(getApiUrl('/api/connections'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'block', target_id: otherId }) });
                              if (res.ok) {
                                setProfileConnections(prev => prev.filter(x => x.id !== c.id));
                                setConnectionsCount(prev => Math.max(0, prev - 1));
                                setBlockedUsers(prev => [...prev, { id: otherId, blocked_id: otherId, accounts: { id: otherId, full_name: name } }]);
                                onShowToast?.(`${name} blocked.`);
                              } else {
                                const err = await res.json().catch(() => ({}));
                                onShowToast?.(err.message || 'Failed to block user.');
                              }
                            }} title="Block user" style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: 12, padding: '2px 4px', opacity: 0.6, flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                            <i className="fa-solid fa-ban"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {!readOnly && blockedUsers.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#f97316', letterSpacing: 2, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>BLOCKED USERS</span>
                  <span style={{ fontSize: 13, color: '#f97316', fontWeight: 800 }}>{blockedUsers.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                  {blockedUsers.map(b => {
                    const bAcc = Array.isArray(b.accounts) ? b.accounts[0] : b.accounts;
                    const bName = bAcc?.full_name || 'Unknown';
                    return (
                      <div key={b.id || b.blocked_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{bName}</div>
                        <button onClick={async () => {
                            const token = await getFreshToken();
                            const res = await fetch(getApiUrl('/api/connections'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: 'unblock', target_id: b.blocked_id }) });
                            if (res.ok) {
                              setBlockedUsers(prev => prev.filter(x => x.blocked_id !== b.blocked_id));
                              onShowToast?.(`${bName} unblocked.`);
                            } else {
                              const err = await res.json().catch(() => ({}));
                              onShowToast?.(err.message || 'Failed to unblock.');
                            }
                          }} style={{ background: 'none', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 6, color: '#f97316', cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: '3px 8px', flexShrink: 0 }}>
                          Unblock
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {readOnly && connectionsCount > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fa-solid fa-link" style={{ color: 'var(--cyber-cyan)', fontSize: 13 }}></i>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}><strong style={{ color: 'var(--cyber-cyan)' }}>{connectionsCount}</strong> Connection{connectionsCount !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              {!readOnly && (
                <button className="cyber-btn danger" onClick={onLogout} style={{ width: '100%', fontSize: 11, background: 'rgba(180,30,30,0.85)', borderColor: 'var(--red)', color: '#fff', fontWeight: 700, backdropFilter: 'blur(8px)' }}>
                  <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 6 }} />LOGOUT
                </button>
              )}
              {readOnly && currentUserId && user?.id !== currentUserId && (
                <button onClick={isBlocked ? handleUnblockUser : handleBlockUser} disabled={connLoading}
                  style={{ width: '100%', fontSize: 11, padding: '9px 0', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 8, color: '#f97316', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <i className={isBlocked ? 'fa-solid fa-unlock' : 'fa-solid fa-ban'}></i> {isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              )}
              {readOnly && onReport && (
                <button onClick={() => onReport({ type: 'user', id: user.id, preview: `User: ${user.full_name} (${user.student_id})`, reportedUserId: user.id })}
                  style={{ width: '100%', fontSize: 11, padding: '9px 0', background: 'rgba(247,95,95,0.08)', border: '1px solid rgba(247,95,95,0.3)', borderRadius: 8, color: 'var(--red)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <i className="fa-solid fa-flag"></i> Report User
                </button>
              )}
              <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%', fontSize: 11, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,240,255,0.5)', color: 'var(--cyber-cyan)', fontWeight: 700 }}>CLOSE</button>
            </div>
          </div>
        </div>

        {/* Expanded Avatar Overlay */}
        {expandedAvatar && avatarUrl && ReactDOM.createPortal(
          <div onClick={() => setExpandedAvatar(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
            <img src={avatarUrl} alt="Profile" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, boxShadow: '0 0 60px rgba(0,240,255,0.3)', objectFit: 'contain' }} />
            <button onClick={() => setExpandedAvatar(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>,
          document.body
        )}

        {showWarningHistory && (
          <WarningHistoryModal userId={user.id} onClose={() => setShowWarningHistory(false)} onAppeal={(warning) => { setAppealingWarning(warning); setShowWarningHistory(false); }} />
        )}
        {appealingWarning && (
          <AppealModal warning={appealingWarning} userId={user.id} onClose={() => { setAppealingWarning(null); setShowWarningHistory(true); }} />
        )}

        {pendingCropFile && (
          <ImageCropModal file={pendingCropFile.file} aspect={pendingCropFile.type === 'avatar' ? 1 : 3} circular={pendingCropFile.type === 'avatar'} outputW={pendingCropFile.type === 'avatar' ? 300 : 900} outputH={pendingCropFile.type === 'avatar' ? 300 : 300}
            onConfirm={(croppedDataUrl) => {
              if (pendingCropFile.type === 'avatar') { setPendingAvatarUrl(croppedDataUrl); setAvatarUrl(croppedDataUrl); }
              else { setPendingCoverUrl(croppedDataUrl); }
              setPendingCropFile(null);
            }}
            onCancel={() => setPendingCropFile(null)} />
        )}

        {viewingCover && displayCoverUrl && ReactDOM.createPortal(
          <div onClick={() => setViewingCover(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <button onClick={() => setViewingCover(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: 'white', zIndex: 1 }}>
              <i className="fa-solid fa-xmark" />
            </button>
            <img src={displayCoverUrl} alt="Cover photo" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
