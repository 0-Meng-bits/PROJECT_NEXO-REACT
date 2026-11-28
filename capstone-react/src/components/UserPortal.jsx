import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { GivePointsModal, FlagUserModal, WarningHistoryModal, AppealModal } from './ModerationModals';
import AnnouncementCard, { Toast, TrustPointsBadge, POST_TYPE, timeSince, containsBadWord, autoFlagContent, FEEDBACK_TAGS } from './AnnouncementCard';
import { fetchQuestionsWithOptions } from './ApplicationSystem';
import OnlineStack from './OnlineStack';
import { ChatTimeSeparator, UnreadDivider } from './ChatHelpers';
import ReportModal from './ReportModal';
import ApplicationDetailModal from './ApplicationDetailModal';
import ManageGroupModal from './ManageGroupModal';
import MessageItem from './MessageItem';
import CreateModal from './CreateModal';
import CircleInfoCard from './CircleInfoCard';
import ProfileModal from './ProfileModal';
import { clearCustomizationCache } from '../lib/customization';
import Cropper from 'react-easy-crop';

// -- FRESH TOKEN HELPER -------------------------------------------------------
// Always gets a fresh Supabase access token, refreshing if needed.
// Falls back to localStorage if session refresh fails (e.g. offline).
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

// -- IMAGE CROP MODAL ---------------------------------------------------------
// Reusable crop modal for avatar (circular 1:1) and cover (3:1 banner)
function getCroppedImg(imageSrc, pixelCrop, outputW, outputH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, outputW, outputH
      );
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
    } catch (err) {
      console.error('Crop error:', err);
    } finally {
      setConfirming(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, padding: 0, overflow: 'hidden', borderRadius: 16 }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--cyber-cyan)', letterSpacing: 1 }}>
            <i className="fa-solid fa-crop-simple" style={{ marginRight: 8 }}></i>
            {circular ? 'CROP PROFILE PHOTO' : 'CROP COVER PHOTO'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Crop area */}
        <div style={{ position: 'relative', width: '100%', height: circular ? 340 : 220, background: '#000' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={circular ? 'round' : 'rect'}
            showGrid={!circular}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="fa-solid fa-magnifying-glass-minus" style={{ fontSize: 12, color: 'var(--text-muted)' }}></i>
          <input type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--cyber-cyan)' }} />
          <i className="fa-solid fa-magnifying-glass-plus" style={{ fontSize: 12, color: 'var(--text-muted)' }}></i>
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="cyber-btn secondary" onClick={onCancel} style={{ fontSize: 12, padding: '7px 18px' }}>
            <i className="fa-solid fa-xmark" style={{ marginRight: 6 }}></i>CANCEL
          </button>
          <button className="cyber-btn" onClick={handleConfirm} disabled={confirming} style={{ fontSize: 12, padding: '7px 18px' }}>
            {confirming
              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>PROCESSING...</>
              : <><i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>CONFIRM</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
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
import DiscoverPeople from './DiscoverPeople';
import CommentTree from './CommentTree';
import CallModal from './CallModal';

const SHOP_API = window.location.hostname === 'localhost'
  ? '/api/shop'
  : `${import.meta.env.VITE_API_URL || ''}/api/shop`;

function getCategoryIcon(category) {
  const map = {
    academic: 'fa-solid fa-graduation-cap',
    project: 'fa-solid fa-flask',
    hobby: 'fa-solid fa-gamepad',
    social: 'fa-solid fa-user-group',
    system: 'fa-solid fa-earth-asia',
  };
  return map[category] || 'fa-solid fa-network-wired';
}

function notifIcon(type) {
  const map = {
    join_approved: 'fa-solid fa-circle-check',
    join_denied: 'fa-solid fa-circle-xmark',
    kicked: 'fa-solid fa-user-xmark',
    promoted: 'fa-solid fa-arrow-up',
    application_update: 'fa-solid fa-microphone',
    new_announcement: 'fa-solid fa-bullhorn',
    shoutout: 'fa-solid fa-star',
    invite_accepted: 'fa-solid fa-envelope-open-text',
    circle_invite: 'fa-solid fa-envelope',
    circle_approved: 'fa-solid fa-circle-check',
    circle_rejected: 'fa-solid fa-circle-xmark',
    system: 'fa-solid fa-triangle-exclamation',
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
    project: 'linear-gradient(135deg, #1a3a1a, #0d5c2e)',
    hobby: 'linear-gradient(135deg, #3a1a3a, #6e0d5c)',
    social: 'linear-gradient(135deg, #3a2a0d, #6e4a0d)',
  };
  return map[category] || 'linear-gradient(135deg, #0d1a2e, #0a0f1e)';
}

const GLOBAL_COMM = {
  id: 'global', name: 'NEXO Hub',
  description: 'The central gathering space for all CTU students.',
  icon: null, faIcon: 'fa-solid fa-earth-asia', category: 'system', creator_id: 'SYSTEM',
};

// OnlineStack, ChatTimeSeparator, UnreadDivider → extracted to their own files

// MessageItem → extracted to MessageItem.jsx
// CreateModal → extracted to CreateModal.jsx
// ProfileModal (+ sub-components) → extracted to ProfileModal.jsx
// autoFlagContent → imported from AnnouncementCard.jsx

// ReportModal → extracted to ReportModal.jsx
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
  const [messagesLoading, setMessagesLoading] = useState(false);
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
  const [successorPicker, setSuccessorPicker] = useState(null); // { commId, members[] } when leader is leaving
  const [showProfile, setShowProfile] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showHierarchyHelp, setShowHierarchyHelp] = useState(false);
  const [circleChatMembers, setCircleChatMembers] = useState([]); // members for the panel
  const [showApplicationForm, setShowApplicationForm] = useState(null); // { comm, Application? }
  const [myApplications, setMyApplications] = useState([]);
  const [viewingApplication, setViewingApplication] = useState(null); // { response, community, questions }
  const [search, setSearch] = useState('');
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef(null);
  const [clock, setClock] = useState(new Date());
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);

  // Helper: update section + community in both state and URL so back/refresh work
  const navTo = useCallback((newSection, newCommId) => {
    const comm = newCommId !== undefined ? newCommId : activeCommId;
    const prevSection = new URLSearchParams(window.location.search).get('section') || 'home';
    setSection(newSection);
    if (newCommId !== undefined) setActiveCommId(newCommId);

    const params = new URLSearchParams();
    params.set('section', newSection);
    if (comm && comm !== 'global') params.set('commId', comm);
    const url = window.location.pathname + '?' + params.toString();

    // Push a real (user-activated) history entry when leaving home so Back returns to home first.
    // Use replaceState when switching between non-home sections or returning to home via nav.
    if (newSection !== 'home' && prevSection === 'home') {
      window.history.pushState({ portalNav: true, section: newSection }, '', url);
    } else {
      window.history.replaceState({ portalNav: true, section: newSection }, '', url);
    }
  }, [activeCommId]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('chat'); // chat, tasks (tasks only for project circles)
  const [activeCategory, setActiveCategory] = useState('all');
  const [feedFilter, setFeedFilter] = useState('all'); // filter for home feed post types
  const [homeFeedTab, setHomeFeedTab] = useState('official'); // 'official' | 'community'
  const [showHomeFeedArchive, setShowHomeFeedArchive] = useState(false);
  const [pastAnnouncements, setPastAnnouncements] = useState([]);
  const [loadingPastAnnouncements, setLoadingPastAnnouncements] = useState(false);
  const [showCircleArchive, setShowCircleArchive] = useState(false);
  const [pastCircleAnnouncements, setPastCircleAnnouncements] = useState([]);
  const [loadingPastCircle, setLoadingPastCircle] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [circleAnnouncements, setCircleAnnouncements] = useState([]);
  const [qaFilter, setQaFilter] = useState('all'); // 'all' | 'questions' | 'unanswered'
  const [circlePostSearch, setCirclePostSearch] = useState('');
  const [bulletinSearch, setBulletinSearch] = useState('');
  const [lastVisitedBulletin, setLastVisitedBulletin] = useState(
    () => localStorage.getItem('nexo-bulletin-visited') || new Date(0).toISOString()
  );
  const [lastVisitedGlobal, setLastVisitedGlobal] = useState(
    () => localStorage.getItem('nexo-global-visited') || new Date(0).toISOString()
  );
  const [circleUnreadMap, setCircleUnreadMap] = useState({}); // { [commId]: count }
  const [newPost, setNewPost] = useState({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''], event_metadata: null, visibility: 'public' });
  const [connectedUserIds, setConnectedUserIds] = useState(new Set()); // accepted connection user IDs
  const [newCirclePost, setNewCirclePost] = useState({ title: '', content: '', post_type: 'thread', pollOptions: ['', ''], event_metadata: null });
  const [crossPostToFeed, setCrossPostToFeed] = useState(false);
  const [activeCall, setActiveCall] = useState(null); // { token, livekit_url, room_name, comm_id }
  const [startingCall, setStartingCall] = useState(false);
  const [circleActiveCall, setCircleActiveCall] = useState(null); // active call for current circle from DB
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [postPendingMedia, setPostPendingMedia] = useState(null); // { file, mediaType } for post composers
  const [showComposer, setShowComposer] = useState(false);
  const [showBulletinComposer, setShowBulletinComposer] = useState(false);
  const [bulletinPost, setBulletinPost] = useState({ title: '', content: '', post_type: 'announcement', community_id: '', pollOptions: ['', ''], event_metadata: null });
  const [showCircleAnnouncements, setShowCircleAnnouncements] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const toastTimer = useRef(null);
  const feedBottomRef = useRef(null);
  const chatFeedRef = useRef(null); // ref to the scrollable chat feed container
  const firstUnreadRef = useRef(null); // ref to scroll to on load
  const firstUnreadMsgId = useRef(null); // message id of the first unread message
  const [firstUnreadId, setFirstUnreadId] = useState(null); // state version to trigger render
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
  const [mutedCategories, setMutedCategories] = useState([]); // notification category mutes
  const [streakCount, setStreakCount] = useState(0); // login streak for flame icon
  const [showCircleInfo, setShowCircleInfo] = useState(null); // circle object for Circle Info Card modal
  const [showOnlineModal, setShowOnlineModal] = useState(false); // online members modal in circle chat
  const [pendingCircleCropFile, setPendingCircleCropFile] = useState(null); // file pending crop for circle cover

  // Block navigation away from /portal when on home feed ? show logout modal instead
  const blocker = { state: 'idle', reset: () => { }, proceed: () => { } };

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowLogoutConfirm(true);
    }
  }, [blocker.state]);

  // When user cancels logout, close modal and re-arm the back trap (this click is a user gesture)
  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
    if (!trapArmedRef.current) {
      window.history.pushState({ portalTrap: true }, '', window.location.pathname + window.location.search);
      trapArmedRef.current = true;
    }
  };

  // When user confirms logout
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/auth');
  };

  // Listen for circle navigation events from ProfileModal
  useEffect(() => {
    const handler = (e) => {
      const { circleId } = e.detail || {};
      if (circleId) {
        setShowProfile(false);
        setViewingProfile(null);
        navTo('circles', circleId);
        setActiveChannelId(null);
      }
    };
    window.addEventListener('nexo-navigate-circle', handler);
    return () => window.removeEventListener('nexo-navigate-circle', handler);
  }, [navTo]);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('notification_mutes')
      .select('category')
      .eq('user_id', user.id)
      .then(({ data }) => setMutedCategories((data || []).map(r => r.category)));
  }, [user?.id]);

  // Show streak toast and load streak count on portal mount
  useEffect(() => {
    // Show streak toast if login just happened
    const streakData = sessionStorage.getItem('streakToast');
    if (streakData) {
      try {
        const { streak, points } = JSON.parse(streakData);
        sessionStorage.removeItem('streakToast');
        setTimeout(() => {
          showToast(`Day ${streak} Streak! +${points} Trust Points`);
        }, 1500);
      } catch { /* ignore */ }
    }
    // Load current streak count
    if (user?.id) {
      supabase.from('account_details')
        .select('streak_count')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => setStreakCount(data?.streak_count || 0));
    }
  }, [user?.id]);

  const toggleMuteCategory = async (cat) => {
    const isMuted = mutedCategories.includes(cat);
    if (isMuted) {
      await supabase.from('notification_mutes').delete().eq('user_id', user.id).eq('category', cat);
      setMutedCategories(prev => prev.filter(c => c !== cat));
    } else {
      await supabase.from('notification_mutes').insert([{ user_id: user.id, category: cat }]);
      setMutedCategories(prev => [...prev, cat]);
    }
  };

  const viewUserProfile = async (studentId) => {
    if (!studentId) return;
    // If clicking on own profile, open the full own-profile modal instead of read-only view
    if (String(studentId) === String(user?.student_id) || String(studentId) === String(user?.ctu_id)) {
      setShowProfile(true);
      return;
    }
    const { data, error } = await supabase
      .from('accounts')
      .select('id, full_name, ctu_id, user_type, account_status(is_verified), account_details(program, year_level, avatar_url, cover_url, gender, bio)')
      .eq('ctu_id', String(studentId)).single();
    if (!error && data) {
      const { data: interestRows } = await supabase.from('user_interests').select('interest').eq('user_id', data.id);
      const statusObj = Array.isArray(data.account_status) ? data.account_status[0] : data.account_status;
      const detailObj = Array.isArray(data.account_details) ? data.account_details[0] : data.account_details;
      const flat = {
        ...data,
        student_id: data.ctu_id,
        is_verified: statusObj?.is_verified,
        ...(detailObj || {}),
        interests: (interestRows || []).map(r => r.interest),
      };
      delete flat.account_status; delete flat.account_details;
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

  // View profile by UUID - used when only author_id (UUID) is available (e.g. comment avatars)
  const viewUserProfileById = async (userId) => {
    if (!userId) return;
    if (userId === user?.id) { setShowProfile(true); return; }
    const { data, error } = await supabase
      .from('accounts')
      .select('id, full_name, ctu_id, user_type, account_status(is_verified), account_details(program, year_level, avatar_url, cover_url, gender, bio)')
      .eq('id', userId).single();
    if (!error && data) {
      const { data: interestRows } = await supabase.from('user_interests').select('interest').eq('user_id', data.id);
      const statusObj = Array.isArray(data.account_status) ? data.account_status[0] : data.account_status;
      const detailObj = Array.isArray(data.account_details) ? data.account_details[0] : data.account_details;
      const flat = { ...data, student_id: data.ctu_id, is_verified: statusObj?.is_verified, ...(detailObj || {}), interests: (interestRows || []).map(r => r.interest) };
      delete flat.account_status; delete flat.account_details;
      const { data: memberships } = await supabase.from('memberships').select('community_id').eq('user_id', data.id).in('status', ['active', 'approved']);
      let circles = [];
      if (memberships?.length) {
        const commIds = memberships.map(m => m.community_id);
        const { data: comms } = await supabase.from('communities').select('id, name, icon, cover_url, logo_url, category').in('id', commIds);
        circles = comms || [];
      }
      setViewingProfile({ ...flat, _circles: circles });
    }
  };

  // Fetch read receipts (reader profiles) for a batch of messages
  // Also treats reactors as implicit readers since reacting means they saw the message
  const fetchReadCounts = useCallback(async (msgIds) => {
    if (!msgIds?.length) return;
    const _chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    const _batches = _chunk(msgIds, 50);
    const [reads, reacts] = await Promise.all([
      Promise.all(_batches.map(b => supabase.from('message_reads').select('message_id, reader_id, accounts:reader_id(full_name, account_details(avatar_url))').in('message_id', b).then(r => r.data || []))).then(r => r.flat()),
      Promise.all(_batches.map(b => supabase.from('message_reactions').select('message_id, sender_id').in('message_id', b).then(r => r.data || []))).then(r => r.flat()),
    ]);

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

    // Add reactors as implicit readers ? use accounts.id (UUID) for consistent dedup
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

    // Final dedup pass ? ensure no duplicate reader_ids per message
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
    // Don't mark as read if the tab is hidden (user isn't actually looking at it)
    if (document.visibilityState !== 'visible') return;
    // Only attempt if user has a real Supabase auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const others = msgs.filter(m => m.sender_id !== user.student_id);
    if (!others.length) return;
    const inserts = others.map(m => ({ message_id: m.id, reader_id: user.id }));
    try {
      await supabase.from('message_reads').upsert(inserts, { onConflict: 'message_id,reader_id', ignoreDuplicates: true });
      const myMsgs = msgs.filter(m => m.sender_id === user.student_id).map(m => m.id);
      if (myMsgs.length) fetchReadCounts(myMsgs);
    } catch (_) { }
  }, [user?.id, user?.student_id, fetchReadCounts]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const [sendError, setSendError] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false); // + button in chat composer
  const [shoutoutMention, setShoutoutMention] = useState(null); // { id, full_name } - selected user
  const [shoutoutSuggestions, setShoutoutSuggestions] = useState([]); // dropdown results
  const [shoutoutQuery, setShoutoutQuery] = useState(''); // current @query being typed
  const [replyTo, setReplyTo] = useState(null); // { id, content, full_name } ? message being replied to
  const [navAvatarUrl, setNavAvatarUrl] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return stored?.avatar_url || null;
  });
  const [navCompanion, setNavCompanion] = useState(null);

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
      .limit(50);

    if (!error && data) {
      const campus = data.filter(e => e.community_id === null);
      const circles = data.filter(e => e.community_id !== null);
      setCampusEvents(campus);
      setCircleEvents(circles);
    } else if (error) {
      console.error('Failed to load events:', error);
      setCampusEvents([]);
      setCircleEvents([]);
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

  // Heartbeat: update last_seen every 90s directly via Supabase client
  // Only pings when the tab is visible — background/minimized tabs skip writes
  useEffect(() => {
    if (!user?.id) return;
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      supabase
        .from('account_details')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {}, () => {});
    };
    ping();
    const t = setInterval(ping, 90000);
    // Ping immediately when user returns to the tab
    const onVisible = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [user?.id]);

  // Poll online users every 90s (online = last_seen within 3 minutes)
  const [onlineProfiles, setOnlineProfiles] = useState([]); // full profile objects of online users
  const [circleMateIds, setCircleMateIds] = useState(new Set()); // UUIDs of users sharing a circle

  useEffect(() => {
    const fetchOnline = async () => {
      const since = new Date(Date.now() - 4 * 60 * 1000).toISOString(); // 4 min window
      const { data } = await supabase.from('accounts')
        .select('id, full_name, ctu_id, account_details!inner(avatar_url, last_seen)')
        .gte('account_details.last_seen', since)
        .not('account_details.last_seen', 'is', null);
      const profiles = (data || []).map(a => ({
        ...a, student_id: a.ctu_id, avatar_url: a.account_details?.avatar_url,
      }));
      setOnlineUsers(new Set(profiles.map(p => p.id)));
      setOnlineProfiles(profiles);
    };
    fetchOnline();
    const t = setInterval(fetchOnline, 90000);
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
      .select('id, application_id, status, phase2_result, submitted_at, applications(community_id)')
      .eq('applicant_id', user.id)
      .order('submitted_at', { ascending: false });
    setMyApplications((data || []).map(r => ({
      ...r,
      community_id: r.applications?.community_id || null,
    })));
  }, [user?.id]);

  // Enrich announcements with author info, poll options, votes, and event metadata from normalized tables
  const enrichAnnouncements = useCallback(async (rows) => {
    if (!rows?.length) return rows || [];

    const annIds = rows.map(a => a.id);
    const authorIds = [...new Set(rows.map(a => a.author_id).filter(Boolean))];

    // Fetch author info, poll options, votes, event metadata in parallel
    const [authorsRes, optionsRes, votesRes, eventsRes] = await Promise.all([
      authorIds.length ? supabase.from('accounts').select('id, full_name, user_type, ctu_id').in('id', authorIds) : { data: [] },
      supabase.from('poll_options').select('id, announcement_id, option_text, display_order').in('announcement_id', annIds).order('display_order', { ascending: true }),
      supabase.from('poll_votes').select('announcement_id, option_id, voter_id').in('announcement_id', annIds),
      supabase.from('announcement_events').select('*').in('announcement_id', annIds),
    ]);

    const authorMap = {};
    (authorsRes.data || []).forEach(a => { authorMap[a.id] = a; });

    // Group poll options by announcement
    const optsByAnn = {};
    (optionsRes.data || []).forEach(o => {
      if (!optsByAnn[o.announcement_id]) optsByAnn[o.announcement_id] = [];
      optsByAnn[o.announcement_id].push(o);
    });

    // Group votes by announcement ? build { option_text: [voter_ids] }
    const votesByAnn = {};
    const optIdToText = {};
    (optionsRes.data || []).forEach(o => { optIdToText[o.id] = o.option_text; });
    (votesRes.data || []).forEach(v => {
      if (!votesByAnn[v.announcement_id]) votesByAnn[v.announcement_id] = {};
      const text = optIdToText[v.option_id];
      if (text) {
        if (!votesByAnn[v.announcement_id][text]) votesByAnn[v.announcement_id][text] = [];
        votesByAnn[v.announcement_id][text].push(v.voter_id);
      }
    });

    // Group event metadata by announcement
    const eventByAnn = {};
    (eventsRes.data || []).forEach(e => { eventByAnn[e.announcement_id] = e; });

    return rows.map(a => {
      const author = authorMap[a.author_id] || {};
      const opts = (optsByAnn[a.id] || []).map(o => o.option_text);
      const votes = votesByAnn[a.id] || {};
      // Initialise empty vote arrays for options with no votes
      opts.forEach(opt => { if (!votes[opt]) votes[opt] = []; });
      const evtMeta = eventByAnn[a.id] || null;

      return {
        ...a,
        author_student_id: author.ctu_id || null,
        // Provide author_name and author_type from accounts (keep Anonymous override)
        author_name: a.anonymous ? 'Anonymous' : (author.full_name || 'User'),
        author_type: a.anonymous ? 'Anonymous' : (author.user_type || 'Student'),
        // Poll data from new tables
        poll_options: opts,
        poll_votes: votes,
        // Event metadata from announcement_events
        event_metadata: evtMeta ? {
          event_date: evtMeta.event_date,
          event_time: evtMeta.event_time,
          location: evtMeta.location,
          is_closed: evtMeta.is_closed,
          closed_at: evtMeta.closed_at,
          closed_by: evtMeta.closed_by,
          generated_event_id: evtMeta.generated_event_id,
          winning_option: evtMeta.winning_option,
        } : null,
      };
    });
  }, []);

  const cachePostAvatars = useCallback(async (enriched) => {
    const authorIds = [...new Set(enriched.map(a => a.author_student_id).filter(Boolean))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('accounts').select('ctu_id, account_details(avatar_url)').in('ctu_id', authorIds);
      if (profiles) {
        const map = {};
        profiles.forEach(p => {
          const det = Array.isArray(p.account_details) ? p.account_details[0] : p.account_details;
          map[p.ctu_id] = det?.avatar_url || null;
        });
        setAvatarCache(prev => ({ ...prev, ...map }));
      }
    }
    const circleIds = [...new Set(enriched.filter(a => !a.author_student_id && a.community_id).map(a => a.community_id))];
    if (circleIds.length > 0) {
      const { data: circles } = await supabase.from('communities').select('id, logo_url').in('id', circleIds);
      if (circles) {
        const map = {};
        circles.forEach(c => { if (c.logo_url) map[`circle_${c.id}`] = c.logo_url; });
        setAvatarCache(prev => ({ ...prev, ...map }));
      }
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const { data, error } = await supabase.from('announcements')
      .select('*')
      .or('community_id.is.null,cross_posted_from.not.is.null')
      .gte('created_at', cutoff.toISOString())
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) console.error('[LOAD ANNOUNCEMENTS]', error.message);
    const enriched = await enrichAnnouncements(data || []);
    setAnnouncements(enriched);
    cachePostAvatars(enriched);
  }, [enrichAnnouncements, cachePostAvatars]);

  const loadPastAnnouncements = async () => {
    setLoadingPastAnnouncements(true);
    const { data } = await supabase.from('announcements')
      .select('*').or('community_id.is.null,cross_posted_from.not.is.null').order('created_at', { ascending: false }).limit(50);
    const enriched = await enrichAnnouncements(data || []);
    setPastAnnouncements(enriched);
    cachePostAvatars(enriched);
    setLoadingPastAnnouncements(false);
  };

  const loadPastCircleAnnouncements = async (commId) => {
    if (!commId || commId === 'global') return;
    setLoadingPastCircle(true);
    const { data } = await supabase.from('announcements')
      .select('*').eq('community_id', commId).order('created_at', { ascending: false }).limit(30);
    const enriched = await enrichAnnouncements(data || []);
    setPastCircleAnnouncements(enriched);
    cachePostAvatars(enriched);
    setLoadingPastCircle(false);
  };

  const loadCircleAnnouncements = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleAnnouncements([]); return; }
    const { data, error } = await supabase.from('announcements')
      .select('*')
      .eq('community_id', commId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) console.error('[LOAD CIRCLE ANNOUNCEMENTS]', error.message);
    const enriched = await enrichAnnouncements(data || []);
    setCircleAnnouncements(enriched);
    cachePostAvatars(enriched);
  }, [enrichAnnouncements, cachePostAvatars]);

  const postAnnouncement = async (typeOverride) => {
    if (!newPost.title.trim()) return;
    const requestedType = typeOverride || newPost.post_type;
    if (requestedType !== 'poll' && !newPost.content.trim()) return;
    if (requestedType === 'poll') {
      const validOptions = newPost.pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) { alert('A poll needs at least 2 options.'); return; }
    }
    const allowedTypes = ['announcement', 'event', 'shoutout', 'thread', 'general', 'poll'];
    const type = allowedTypes.includes(requestedType) ? requestedType : 'thread';

    // Block post if it contains inappropriate language and log attempt for Content Monitor
    if (containsBadWord(newPost.title) || containsBadWord(newPost.content)) {
      alert('⚠️ Your post contains inappropriate language and cannot be published. Please remove it and try again.');
      await autoFlagContent({
        reporterId: user.id,
        reportedUserId: user.id,
        contentType: 'announcement',
        contentId: null,
        contentPreview: [newPost.title, newPost.content].filter(Boolean).join(': '),
      });
      return;
    }

    setPostingAnnouncement(true);
    const pollOptions = type === 'poll' ? newPost.pollOptions.filter(o => o.trim()) : null;

    let mediaUrl = null;
    if (postPendingMedia) {
      try { mediaUrl = await uploadMediaFile(postPendingMedia.file, user.id, postPendingMedia.mediaType); } catch { /* non-fatal */ }
    }

    const { data: homAnn, error } = await supabase
      .from('announcements')
      .insert([{
        author_id: user.id,
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        post_type: type,
        community_id: null,
        media_url: mediaUrl,
        visibility: newPost.visibility || 'public',
        anonymous: newPost.anonymous || false,
      }])
      .select('id')
      .single();

    // Insert poll options into poll_options table
    if (!error && homAnn?.id && pollOptions) {
      await supabase.from('poll_options').insert(
        pollOptions.map((opt, i) => ({ announcement_id: homAnn.id, option_text: opt, display_order: i }))
      );
    }
    // Insert event metadata into announcement_events table
    if (!error && homAnn?.id && type === 'poll' && newPost.event_metadata?.event_date) {
      await supabase.from('announcement_events').insert({
        announcement_id: homAnn.id,
        event_date: newPost.event_metadata.event_date,
        event_time: newPost.event_metadata.event_time ? `${newPost.event_metadata.event_time}:00` : '00:00:00',
        location: newPost.event_metadata.location || '',
        is_closed: false,
      });
    }
    setPostingAnnouncement(false);
    if (!error) {
      setNewPost({ title: '', content: '', post_type: 'general', anonymous: false, pollOptions: ['', ''], event_metadata: null, visibility: 'public' });
      setPostPendingMedia(null);
      loadAnnouncements();

      // Auto-sync to Campus Events if admin posts an Event type with metadata
      if (type === 'event' && user?.user_type === 'Admin' && newPost.event_metadata?.event_date) {
        const token = localStorage.getItem('accessToken');
        fetch(getApiUrl('/api/admin-data'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            action: 'add_event',
            title: newPost.title.trim(),
            description: newPost.content.trim() || null,
            category: 'general',
            event_date: newPost.event_metadata.event_date,
            event_time: newPost.event_metadata.event_time || null,
            location: newPost.event_metadata.location || null,
            poster_id: user.id,
          }),
        }).catch(() => { }); // non-fatal
      }
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
    // Restrict posting to Leader (3) and Co-Leader (2) only ? except Thread which all members can post
    if (myRankLevel < 2 && newCirclePost.post_type !== 'thread') { showToast('Only Leaders and Co-Leaders can post announcements.'); return; }

    // Block post if it contains inappropriate language and log attempt for Content Monitor
    if (containsBadWord(newCirclePost.title) || containsBadWord(newCirclePost.content)) {
      showToast('⚠️ Your post contains inappropriate language and cannot be published. Please remove it and try again.');
      await autoFlagContent({
        reporterId: user.id,
        reportedUserId: user.id,
        contentType: 'announcement',
        contentId: null,
        contentPreview: [newCirclePost.title, newCirclePost.content].filter(Boolean).join(': '),
      });
      return;
    }

    setPostingAnnouncement(true);
    const pollOptions = newCirclePost.post_type === 'poll'
      ? newCirclePost.pollOptions.filter(o => o.trim()) : null;

    let mediaUrl = null;
    if (postPendingMedia) {
      try { mediaUrl = await uploadMediaFile(postPendingMedia.file, user.id, postPendingMedia.mediaType); } catch { /* non-fatal */ }
    }

    const comm = communities.find(c => c.id === commId);
    const isBulletinCrossPost = Boolean(comm?.is_official && crossPostToFeed && myRankLevel >= 2 && newCirclePost.post_type !== 'thread');

    const postPayload = {
      author_id: user.id,
      title: newCirclePost.title.trim(),
      content: newCirclePost.content.trim(),
      post_type: newCirclePost.post_type,
      community_id: commId,
      cross_posted_from: isBulletinCrossPost ? commId : null,
      media_url: mediaUrl,
    };
    const { data: annData, error } = await supabase.from('announcements').insert([postPayload]).select('id').single();

    // Insert poll options + event metadata into normalized tables (single unified row)
    if (!error && annData?.id) {
      if (pollOptions) {
        await supabase.from('poll_options').insert(
          pollOptions.map((opt, i) => ({ announcement_id: annData.id, option_text: opt, display_order: i }))
        );
      }
      if (newCirclePost.event_metadata?.event_date) {
        await supabase.from('announcement_events').insert({
          announcement_id: annData.id,
          event_date: newCirclePost.event_metadata.event_date,
          event_time: newCirclePost.event_metadata.event_time ? `${newCirclePost.event_metadata.event_time}:00` : '00:00:00',
          location: newCirclePost.event_metadata.location || '',
          is_closed: false,
        });
      }
    }

    setPostingAnnouncement(false);
    if (!error) {
      setNewCirclePost({ title: '', content: '', post_type: 'thread', pollOptions: ['', ''], event_metadata: null });
      setCrossPostToFeed(false);
      setPostPendingMedia(null);
      loadCircleAnnouncements(commId);
      if (isBulletinCrossPost) loadAnnouncements();

      // Auto-sync to Campus Events if verified circle posts an Event type with metadata
      if (newCirclePost.post_type === 'event' && comm?.is_official && newCirclePost.event_metadata?.event_date) {
        const token = localStorage.getItem('accessToken');
        fetch(getApiUrl('/api/admin-data'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            action: 'add_event',
            title: newCirclePost.title.trim(),
            description: newCirclePost.content.trim() || null,
            category: 'general',
            event_date: newCirclePost.event_metadata.event_date,
            event_time: newCirclePost.event_metadata.event_time || null,
            location: newCirclePost.event_metadata.location || null,
            poster_id: user.id,
          }),
        }).catch(() => { });
      }

      // Notify all active members
      const { data: members } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('community_id', commId)
        .eq('status', 'active')
        .neq('user_id', user.id);

      if (members && members.length > 0) {
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

  const postBulletinAnnouncement = async (verifiedLeaderCircles) => {
    if (!bulletinPost.title.trim()) return;
    const allowedBulletinTypes = ['announcement', 'event', 'poll'];
    const type = allowedBulletinTypes.includes(bulletinPost.post_type) ? bulletinPost.post_type : 'announcement';
    if (type !== 'poll' && !bulletinPost.content.trim()) return;
    if (type === 'poll') {
      const valid = bulletinPost.pollOptions.filter(o => o.trim());
      if (valid.length < 2) { alert('A poll needs at least 2 options.'); return; }
    }
    const isAdmin = user?.user_type === 'Admin';
    const selectedCommId = bulletinPost.community_id || (!isAdmin ? verifiedLeaderCircles[0]?.id : '');
    const targetComm = selectedCommId ? verifiedLeaderCircles.find(c => c.id === selectedCommId) : null;
    if (!isAdmin && !targetComm) {
      showToast('Only Admin or Verified Circle Leaders/Co-Leaders can post to the Bulletin.');
      return;
    }

    if (containsBadWord(bulletinPost.title) || containsBadWord(bulletinPost.content)) {
      showToast('⚠️ Your post contains inappropriate language and cannot be published. Please remove it and try again.');
      await autoFlagContent({
        reporterId: user.id,
        reportedUserId: user.id,
        contentType: 'announcement',
        contentId: null,
        contentPreview: [bulletinPost.title, bulletinPost.content].filter(Boolean).join(': '),
      });
      return;
    }

    setPostingAnnouncement(true);
    const pollOptions = type === 'poll' ? bulletinPost.pollOptions.filter(o => o.trim()) : null;
    let mediaUrl = null;
    if (postPendingMedia) {
      try { mediaUrl = await uploadMediaFile(postPendingMedia.file, user.id, postPendingMedia.mediaType); } catch { /* non-fatal */ }
    }

    const postPayload = {
      author_id: user.id,
      title: bulletinPost.title.trim(),
      content: bulletinPost.content.trim(),
      post_type: type,
      community_id: targetComm ? targetComm.id : null,
      cross_posted_from: targetComm ? targetComm.id : null,
      media_url: mediaUrl,
    };
    const { data: annData, error } = await supabase.from('announcements').insert([postPayload]).select('id').single();

    if (!error && annData?.id && pollOptions) {
      await supabase.from('poll_options').insert(
        pollOptions.map((opt, i) => ({ announcement_id: annData.id, option_text: opt, display_order: i }))
      );
    }

    setPostingAnnouncement(false);
    if (!error) {
      setBulletinPost({ title: '', content: '', post_type: 'announcement', community_id: '', pollOptions: ['', ''], event_metadata: null });
      setPostPendingMedia(null);
      setShowBulletinComposer(false);
      loadAnnouncements();
      if (targetComm && activeCommId === targetComm.id) loadCircleAnnouncements(targetComm.id);

      if (targetComm) {
        const { data: members } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('community_id', targetComm.id)
          .eq('status', 'active')
          .neq('user_id', user.id);

        if (members && members.length > 0) {
          await supabase.from('notifications').insert(members.map(m => ({
            user_id: m.user_id,
            type: 'new_announcement',
            message: `New ${type === 'poll' ? 'poll' : 'announcement'} in "${targetComm.name}": ${bulletinPost.title.trim()}`,
            link_comm_id: targetComm.id,
          })));
        }
      }
      showToast('Published to Bulletin!');
    } else {
      showToast('Failed to publish: ' + (error.message || 'Unknown error'));
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    const post = announcements.find(a => a.id === id) || circleAnnouncements.find(a => a.id === id);
    await deleteMediaFromStorage(post?.media_url);
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete post: ' + error.message);
      return;
    }
    loadAnnouncements();
    if (activeCommId && activeCommId !== 'global') loadCircleAnnouncements(activeCommId);
  };

  const togglePin = async (id, pinned) => {
    const { error } = await supabase.from('announcements').update({ pinned: !pinned }).eq('id', id);
    if (error) {
      showToast('Failed to update pin: ' + error.message);
      return;
    }
    loadAnnouncements();
    if (activeCommId && activeCommId !== 'global') loadCircleAnnouncements(activeCommId);
  };

  const handleVote = async (announcementId, option) => {
    if (!user?.id) return;
    // Look up option_id from poll_options table
    const { data: optRow } = await supabase.from('poll_options')
      .select('id').eq('announcement_id', announcementId).eq('option_text', option).single();
    if (!optRow) return;
    // Delete any existing vote by this user on this poll (one vote per poll)
    await supabase.from('poll_votes')
      .delete().eq('announcement_id', announcementId).eq('voter_id', user.id);
    // Insert new vote
    await supabase.from('poll_votes')
      .insert({ announcement_id: announcementId, option_id: optRow.id, voter_id: user.id });
    loadAnnouncements();
  };

  const handleCircleVote = async (announcementId, option) => {
    if (!user?.id) return;
    const { data: optRow } = await supabase.from('poll_options')
      .select('id').eq('announcement_id', announcementId).eq('option_text', option).single();
    if (!optRow) return;
    await supabase.from('poll_votes')
      .delete().eq('announcement_id', announcementId).eq('voter_id', user.id);
    await supabase.from('poll_votes')
      .insert({ announcement_id: announcementId, option_id: optRow.id, voter_id: user.id });
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
    const uncached = [...new Set((msgs || []).map(m => m.sender_id).filter(id => id))];
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

  const enrichMessages = useCallback(async (msgs) => {
    if (!msgs?.length) return msgs || [];
    const senderIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean))];
    let nameMap = {};
    if (senderIds.length > 0) {
      const { data: senders } = await supabase.from('accounts').select('ctu_id, full_name').in('ctu_id', senderIds);
      if (senders) {
        nameMap = Object.fromEntries(senders.map(s => [s.ctu_id, s.full_name]));
      }
    }
    return msgs.map(m => ({
      ...m,
      full_name: m.content?.startsWith('NEXOSYS:') && !m.sender_id
        ? 'System'
        : (nameMap[m.sender_id] || m.full_name || 'User'),
    }));
  }, []);

  const loadCustomizationsForMessages = useCallback(async (msgs) => {
    if (!msgs || msgs.length === 0) return;

    const studentIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean))];
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
          active_name_color,
          active_background,
          active_companion
        `)
        .in('user_id', accountIds);

      if (!settings) return;

      // Get shop items for the active customizations
      const itemIds = settings.flatMap(s =>
        [s.active_theme, s.active_name_color, s.active_background, s.active_companion].filter(Boolean)
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
            name_color: items.find(i => i.id === setting.active_name_color),
            background: items.find(i => i.id === setting.active_background),
            theme: items.find(i => i.id === setting.active_theme),
            companion: items.find(i => i.id === setting.active_companion),
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
    // firstUnreadId reset handled by useEffect on community switch
    setMessagesLoading(true);

    const calcFirstUnread = async (msgs) => {
      if (!user?.id || !msgs?.length) return;
      const otherMsgs = msgs.filter(m => m.sender_id !== user.student_id);
      if (!otherMsgs.length) return;
      const { data: reads } = await supabase.from('message_reads')
        .select('message_id').eq('reader_id', user.id)
        .in('message_id', otherMsgs.map(m => m.id));
      const readIds = new Set((reads || []).map(r => r.message_id));
      const first = otherMsgs.find(m => !readIds.has(m.id));
      if (first) { firstUnreadMsgId.current = first.id; setFirstUnreadId(prev => prev || first.id); }
    };

    if (commId === 'global') {
      const { data } = await supabase.from('messages').select('*')
        .is('community_id', null).order('created_at', { ascending: true });
      const msgs = await enrichMessages(data || []);
      await calcFirstUnread(msgs);
      setMessages(msgs);
      fetchAvatarsForMessages(msgs);
      loadCustomizationsForMessages(msgs);
      setTimeout(() => markMessagesRead(msgs), 1000);
      const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      const idsToFetch = [...new Set([...msgs.filter(m => m.sender_id === user?.student_id).map(m => m.id), ...(lastId ? [lastId] : [])])];
      if (idsToFetch.length) fetchReadCounts(idsToFetch);
    } else if (channelId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('channel_id', channelId).order('created_at', { ascending: true });
      const msgs = await enrichMessages(data || []);
      await calcFirstUnread(msgs);
      setMessages(msgs);
      fetchAvatarsForMessages(msgs);
      loadCustomizationsForMessages(msgs);
      setTimeout(() => markMessagesRead(msgs), 1000);
      const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      const idsToFetch = [...new Set([...msgs.filter(m => m.sender_id === user?.student_id).map(m => m.id), ...(lastId ? [lastId] : [])])];
      if (idsToFetch.length) fetchReadCounts(idsToFetch);
    } else if (commId) {
      const { data } = await supabase.from('messages').select('*')
        .eq('community_id', commId)
        .is('channel_id', null)
        .order('created_at', { ascending: true });
      const msgs = await enrichMessages(data || []);
      await calcFirstUnread(msgs);
      setMessages(msgs);
      fetchAvatarsForMessages(msgs);
      loadCustomizationsForMessages(msgs);
      setTimeout(() => markMessagesRead(msgs), 1000);
      const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      const idsToFetch = [...new Set([...msgs.filter(m => m.sender_id === user?.student_id).map(m => m.id), ...(lastId ? [lastId] : [])])];
      if (idsToFetch.length) fetchReadCounts(idsToFetch);
    } else {
      setMessages([]);
    }
    setMessagesLoading(false);
  }, [enrichMessages, fetchAvatarsForMessages, loadCustomizationsForMessages, markMessagesRead, fetchReadCounts, user?.student_id, user?.id]);

  const loadCircleChatMessages = useCallback(async (commId) => {
    if (!commId || commId === 'global') { setCircleChatMessages([]); return; }
    firstUnreadMsgId.current = null;
    const { data } = await supabase.from('messages').select('*')
      .eq('community_id', commId)
      .is('channel_id', null)
      .order('created_at', { ascending: true });
    const msgs = await enrichMessages(data || []);
    // Find first unread before marking as read
    if (user?.id && msgs.length) {
      const otherMsgs = msgs.filter(m => m.sender_id !== user.student_id);
      if (otherMsgs.length) {
        const { data: reads } = await supabase.from('message_reads')
          .select('message_id').eq('reader_id', user.id)
          .in('message_id', otherMsgs.map(m => m.id));
        const readIds = new Set((reads || []).map(r => r.message_id));
        const first = otherMsgs.find(m => !readIds.has(m.id));
        if (first) { firstUnreadMsgId.current = first.id; setFirstUnreadId(prev => prev || first.id); }
      }
    }
    setCircleChatMessages(msgs);
    fetchAvatarsForMessages(msgs);
    loadCustomizationsForMessages(msgs);
    setTimeout(() => markMessagesRead(msgs), 1000);
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    const idsToFetch = [...new Set([...msgs.filter(m => m.sender_id === user?.student_id).map(m => m.id), ...(lastId ? [lastId] : [])])];
    if (idsToFetch.length) fetchReadCounts(idsToFetch);
  }, [enrichMessages, fetchAvatarsForMessages, loadCustomizationsForMessages, markMessagesRead, fetchReadCounts, user?.student_id, user?.id]);

  // Initial load + realtime subscription ? re-runs when channel/community changes
  useEffect(() => {
    setMessages([]); // clear stale messages immediately so old context doesn't flash
    setFirstUnreadId(null); // reset unread divider on community switch
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
            enrichMessages([msg]).then(([enrichedMsg]) => {
              setMessages(prev => {
                if (prev.find(m => m.id === enrichedMsg.id)) return prev;
                fetchAvatarsForMessages([enrichedMsg]);
                markMessagesRead([enrichedMsg]);
                fetchReadCounts([enrichedMsg.id]);
                return [...prev, enrichedMsg];
              });
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

  // -- Unread circle message counts ? uses message_reads for cross-device accuracy -
  useEffect(() => {
    const myActiveCircles = myMemberships.filter(m => m.status === 'active').map(m => m.community_id);
    if (myActiveCircles.length === 0 || !user?.id) return;
    const fetchUnread = async () => {
      // Step 1 ? get all messages in my circles from others
      const { data: allMsgs } = await supabase
        .from('messages')
        .select('id, community_id')
        .in('community_id', myActiveCircles)
        .neq('sender_id', user.student_id || '');

      if (!allMsgs?.length) { setCircleUnreadMap({}); return; }

      // Step 2 ? get which of those I've already read
      const msgIds = allMsgs.map(m => m.id);
      const { data: readMsgs } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('reader_id', user.id)
        .in('message_id', msgIds);

      const readSet = new Set((readMsgs || []).map(r => r.message_id));

      // Step 3 ? count unread per circle
      const counts = {};
      myActiveCircles.forEach(commId => { counts[commId] = 0; });
      allMsgs.forEach(m => {
        if (!readSet.has(m.id)) counts[m.community_id] = (counts[m.community_id] || 0) + 1;
      });
      setCircleUnreadMap(counts);
    };
    fetchUnread();
  }, [myMemberships, user?.id, user?.student_id]);

  // Load accepted connection user IDs for visibility filtering
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('connections')
      .select('user_id, connected_user_id')
      .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .then(({ data }) => {
        if (data) {
          const ids = new Set(data.map(c => c.user_id === user.id ? c.connected_user_id : c.user_id));
          setConnectedUserIds(ids);
        }
      });
  }, [user?.id]);

  // Load current user's companion for nav avatar
  useEffect(() => {
    if (!user?.id) return;
    const loadNavCompanion = async () => {
      const { data: settings } = await supabase
        .from('user_profile_settings')
        .select('active_companion')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!settings?.active_companion) return;
      const { data: item } = await supabase
        .from('shop_items')
        .select('css_data')
        .eq('id', settings.active_companion)
        .single();
      if (item?.css_data) {
        const d = typeof item.css_data === 'string' ? JSON.parse(item.css_data) : item.css_data;
        setNavCompanion(d?.url || null);
      }
    };
    loadNavCompanion();
  }, [user?.id]);

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

  // -- Auto-clear unread badges when actively viewing -------------------
  useEffect(() => {
    if (section === 'global') {
      const now = new Date().toISOString();
      setLastVisitedGlobal(now);
      localStorage.setItem('nexo-global-visited', now);
    }
  }, [section]);

  useEffect(() => {
    if (section === 'circles' && activeCommId && activeCommId !== 'global' && user?.id) {
      // Get unread messages in this circle then mark them all as read
      supabase
        .from('messages')
        .select('id')
        .eq('community_id', activeCommId)
        .neq('sender_id', user.student_id || '')
        .then(async ({ data: allMsgs }) => {
          if (!allMsgs?.length) { setCircleUnreadMap(prev => ({ ...prev, [activeCommId]: 0 })); return; }
          const msgIds = allMsgs.map(m => m.id);
          const { data: readMsgs } = await supabase
            .from('message_reads').select('message_id').eq('reader_id', user.id).in('message_id', msgIds);
          const readSet = new Set((readMsgs || []).map(r => r.message_id));
          const unread = allMsgs.filter(m => !readSet.has(m.id));
          if (unread.length) {
            await supabase.from('message_reads').insert(
              unread.map(m => ({ message_id: m.id, reader_id: user.id }))
            );
          }
          setCircleUnreadMap(prev => ({ ...prev, [activeCommId]: 0 }));
        });
    }
  }, [section, activeCommId, user?.id, user?.student_id]);

  // Ref that always holds the latest state values needed by the back handler.
  // Avoids stale closures – listener registered once, reads fresh values via ref.
  const backStateRef = useRef({});
  // Registry for child component overlay closers (photo viewers etc.)
  const overlayCloserRef = useRef(null);
  // Tracks whether a user-activated portalTrap entry is currently on the history stack.
  // Chrome's History Manipulation Intervention skips pushState entries created without a
  // user gesture (e.g. on mount or inside popstate), so we arm the trap on pointerdown/keydown.
  const trapArmedRef = useRef(false);

  // Keep backStateRef in sync with current state so the popstate handler reads fresh values
  useEffect(() => {
    backStateRef.current = {
      section,
      showProfile, viewingProfile, showManage, showMembersPanel,
      showNotifications, showShop, showHelp, showThemePicker, showEventsModal,
      showCreate, showApplicationForm, viewingApplication, showLogoutConfirm,
    };
  });

  // Arm the back-button trap on mount (fallback for zero-tap back) AND on the first real
  // user gesture (touchend/click/keydown — note pointerdown does NOT grant user activation
  // on mobile touchscreens, which caused Chrome to skip the trap).
  useEffect(() => {
    if (!window.history.state?.portalTrap && !window.history.state?.portalNav) {
      window.history.pushState({ portalTrap: true, mount: true }, '', window.location.pathname + window.location.search);
    }

    const armTrap = () => {
      if (trapArmedRef.current) return;
      // Only arm when we don't already have a portalNav entry on top of a trap
      if (window.history.state?.portalNav && window.history.state?.section !== 'home') return;
      window.history.pushState({ portalTrap: true, user: true }, '', window.location.pathname + window.location.search);
      trapArmedRef.current = true;
    };

    window.addEventListener('touchend', armTrap, { capture: true, passive: true });
    window.addEventListener('click', armTrap, { capture: true, passive: true });
    window.addEventListener('keydown', armTrap, { capture: true, passive: true });
    return () => {
      window.removeEventListener('touchend', armTrap, { capture: true });
      window.removeEventListener('click', armTrap, { capture: true });
      window.removeEventListener('keydown', armTrap, { capture: true });
    };
  }, []);

  // Back-button / swipe-back handler – registered ONCE on mount.
  useEffect(() => {
    const onPopState = () => {
      // Check if a child overlay (photo viewer etc.) is open – close it first
      if (overlayCloserRef.current) {
        overlayCloserRef.current();
        overlayCloserRef.current = null;
        trapArmedRef.current = false;
        return;
      }
      if (window.__nexoOverlayCloser) {
        window.__nexoOverlayCloser();
        window.__nexoOverlayCloser = null;
        trapArmedRef.current = false;
        return;
      }

      const s = backStateRef.current;

      // a. Close open overlays first
      if (s.showProfile) { setShowProfile(false); trapArmedRef.current = false; return; }
      if (s.viewingProfile) { setViewingProfile(null); trapArmedRef.current = false; return; }
      if (s.showManage) { setShowManage(false); trapArmedRef.current = false; return; }
      if (s.showMembersPanel) { setShowMembersPanel(false); trapArmedRef.current = false; return; }
      if (s.showNotifications) { setShowNotifications(false); trapArmedRef.current = false; return; }
      if (s.showShop) { setShowShop(false); trapArmedRef.current = false; return; }
      if (s.showHelp) { setShowHelp(false); trapArmedRef.current = false; return; }
      if (s.showThemePicker) { setShowThemePicker(false); trapArmedRef.current = false; return; }
      if (s.showEventsModal) { setShowEventsModal(false); trapArmedRef.current = false; return; }
      if (s.showCreate) { setShowCreate(false); trapArmedRef.current = false; return; }
      if (s.showApplicationForm) { setShowApplicationForm(null); trapArmedRef.current = false; return; }
      if (s.viewingApplication) { setViewingApplication(null); trapArmedRef.current = false; return; }

      // b. Not on home – go to home feed (we just popped portalNav and landed on portalTrap)
      if (s.section !== 'home') {
        setSection('home');
        setActiveCommId('global');
        setActiveChannelId(null);
        window.history.replaceState({ portalTrap: true }, '', window.location.pathname + '?section=home');
        return;
      }

      // c. On home – show logout modal (portalTrap was just popped, so mark unarmed)
      trapArmedRef.current = false;
      setShowLogoutConfirm(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Reload channels and circle announcements whenever the active community changes
  useEffect(() => {
    setCircleAnnouncements([]); // clear stale announcements immediately when switching circles
    loadChannels(activeCommId);
    loadCircleAnnouncements(activeCommId);
    setQaFilter('all'); // reset Q&A filter when switching communities
    setCirclePostSearch(''); // reset post search when switching circles
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

  // Load active call for current circle
  useEffect(() => {
    if (!activeCommId || activeCommId === 'global') { setCircleActiveCall(null); return; }
    supabase.from('circle_calls').select('room_name, started_at')
      .eq('community_id', activeCommId).eq('status', 'active').maybeSingle()
      .then(({ data }) => setCircleActiveCall(data || null));
    // Subscribe to circle_calls changes
    const sub = supabase.channel(`circle-calls-${activeCommId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_calls', filter: `community_id=eq.${activeCommId}` }, () => {
        supabase.from('circle_calls').select('room_name, started_at')
          .eq('community_id', activeCommId).eq('status', 'active').maybeSingle()
          .then(({ data }) => setCircleActiveCall(data || null));
      }).subscribe();
    return () => supabase.removeChannel(sub);
  }, [activeCommId]);

  // Avatar is persisted in localStorage "? no DB sync needed on mount

  // Realtime home feed (campus-wide announcements)
  useEffect(() => {
    const sub = supabase.channel('rt:announcements:global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          if (!payload.new.community_id) {
            enrichAnnouncements([payload.new]).then(([enriched]) => {
              setAnnouncements(prev => {
                if (prev.find(a => a.id === enriched.id)) return prev;
                const updated = [enriched, ...prev];
                return updated.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
              });
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
        (payload) => {
          enrichAnnouncements([payload.new]).then(([enriched]) => {
            setCircleAnnouncements(prev => prev.find(a => a.id === enriched.id) ? prev : [enriched, ...prev]);
          });
        }
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
            enrichMessages([msg]).then(([enrichedMsg]) => {
              setCircleChatMessages(prev => {
                if (prev.find(m => m.id === enrichedMsg.id)) return prev;
                fetchAvatarsForMessages([enrichedMsg]);
                markMessagesRead([enrichedMsg]);
                fetchReadCounts([enrichedMsg.id]);
                return [...prev, enrichedMsg];
              });
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
    if (messagesLoading) return; // wait until messages are rendered
    if (firstUnreadRef.current) {
      firstUnreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      if (chatFeedRef.current) {
        chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
      } else {
        feedBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, messagesLoading]);

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

  const insertSystemMessage = async (commId, text) => {
    await supabase.from('messages').insert([{
      content: 'NEXOSYS:' + text,
      message_type: 'text',
      community_id: commId,
      channel_id: null,
      ...(user?.student_id ? { sender_id: user.student_id } : {}),
    }]);
  };

  const requestJoin = async (commId) => {
    const { error } = await supabase.from('memberships').insert([{
      community_id: commId, user_id: user.id, rank_level: 0, status: 'pending'
    }]);
    if (!error) { await loadMyMemberships(); showToast('Request sent!'); }
    else showToast('Already requested.');
  };

  const acceptInvite = async (commId) => {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(getApiUrl('/api/memberships'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'accept_invite', community_id: commId }),
      });
      const data = await res.json();
      if (res.ok) {
        await insertSystemMessage(commId, `${user.full_name} joined the circle.`);
        await loadMyMemberships();
        showToast(data.activated ? 'Circle is now active! Chat unlocked.' : 'You joined the circle!');
        navTo('circles', commId);
        setTimeout(() => loadMessages(commId, null), 300);
      } else {
        // If already a member, just navigate to the circle
        if (data.message?.toLowerCase().includes('already') || data.message?.toLowerCase().includes('active')) {
          showToast('You\'re already a member of this circle!');
          navTo('circles', commId);
        } else {
          showToast(data.message || 'Failed to accept invite.');
        }
      }
    } catch {
      showToast('Failed to accept invite.');
    }
  };

  const declineInvite = async (commId) => {
    const membership = myMemberships.find(m => m.community_id === commId && m.status === 'invited');
    if (!membership) return;
    const { error } = await supabase.from('memberships').delete().eq('id', membership.id);
    if (!error) { await loadMyMemberships(); showToast('Invite declined.'); }
    else showToast('Failed to decline invite.');
  };

  const handleChatInputChange = async (value) => {
    setSendError('');
    // Detect @mention ? works for both 'shoutout! @name' and standalone '@name'
    const isGlobal = !activeCommId || activeCommId === 'global';
    const shoutMatch = value.match(/^shoutout!\s+@([^\s][\w\s]*)/i);
    const mentionMatch = !shoutMatch && value.match(/@([\w\s]*)$/);
    if (shoutMatch) {
      const query = shoutMatch[1].trim();
      if (query.toLowerCase().startsWith('everyone')) {
        setShoutoutSuggestions([{ id: 'everyone', full_name: '@everyone' }]);
        setShoutoutQuery(query);
      } else if (query.length >= 1) {
        setShoutoutQuery(query);
        const { data } = await supabase.from('accounts')
          .select('id, full_name').ilike('full_name', `${query}%`).neq('id', user.id).limit(5);
        setShoutoutSuggestions(data || []);
      } else {
        setShoutoutSuggestions([{ id: 'everyone', full_name: '@everyone' }]);
      }
    } else if (mentionMatch && !isGlobal) {
      // Standalone @mention ? circle chat only, not Global Feed (use shoutout! there)
      const query = mentionMatch[1].trim();
      setShoutoutQuery(query);
      const activeMembers = circleChatMembers.filter(m => m.id !== user.id);
      if (query.length >= 1) {
        const memberMatches = activeMembers
          .filter(m => m.full_name?.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 6)
          .map(m => ({ id: m.id, full_name: m.full_name }));
        setShoutoutSuggestions(memberMatches);
      } else {
        // Just '@' typed ? show all circle members only
        setShoutoutSuggestions(activeMembers.slice(0, 6).map(m => ({ id: m.id, full_name: m.full_name })));
      }
    } else {
      setShoutoutSuggestions([]);
      setShoutoutQuery('');
      if (!value.toLowerCase().startsWith('shoutout!')) setShoutoutMention(null);
    }
  };

  const selectShoutoutMention = (person, inputRef) => {
    if (inputRef.current) {
      const current = inputRef.current.value;
      // Replace the @query part with the selected name
      const base = current.replace(/@[\w\s]*$/, `@${person.full_name} `);
      inputRef.current.value = base;
      inputRef.current.focus();
    }
    setShoutoutMention(person.id === 'everyone' ? { id: 'everyone', full_name: 'everyone' } : person);
    setShoutoutSuggestions([]);
    setShoutoutQuery('');
  };

  const sendPost = async () => {
    const msgInput = msgInputRef.current?.value || '';
    if (!msgInput.trim() && !pendingMedia) return;
    if (msgInput.trim() && containsBadWord(msgInput)) {
      setSendError('⚠️ Your message contains inappropriate language and was not sent.');
      setTimeout(() => setSendError(''), 4000);
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: null, contentPreview: msgInput });
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

      // Detect shoutout prefix
      const isShoutout = msgInput.trim().toLowerCase().startsWith('shoutout!');

      if (pendingMedia) {
        mediaUrl = await uploadMediaFile(pendingMedia.file, user.id, pendingMedia.mediaType);
        mediaSize = pendingMedia.file.size;
        mediaDuration = pendingMedia.duration || null;
        messageType = pendingMedia.mediaType;
      }

      const payload = {
        sender_id: user.student_id,
        content: msgInput.trim() || '',
        message_type: isShoutout ? 'shoutout' : messageType,
        media_url: mediaUrl,
        media_size: mediaSize,
        media_duration: mediaDuration,
        community_id: activeCommId === 'global' ? null : activeCommId,
        channel_id: activeCommId === 'global' ? null : activeChannelId,
        role: myRankLevel >= 3 ? 'LEADER' : myRankLevel === 2 ? 'CO-LEADER' : myRankLevel === 1 ? 'MODERATOR' : 'MEMBER',
        ...(replyTo ? { reply_to_id: replyTo.id, reply_to_preview: replyTo.content?.slice(0, 100), reply_to_author: replyTo.full_name } : {}),
      };

      const { data, error } = await supabase.from('messages').insert([payload]).select();
      if (!error && data) {
        const sentMsg = { ...data[0], full_name: user.full_name };
        setMessages(prev => prev.find(m => m.id === sentMsg.id) ? prev : [...prev, sentMsg]);
        if (msgInputRef.current) msgInputRef.current.value = '';
        setPendingMedia(null);
        setReplyTo(null);

        // Shoutout notifications ? use exact ID if selected from dropdown
        if (isShoutout) {
          const shoutText = msgInput.trim().replace(/^shoutout!\s*/i, '');
          const isEveryoneShout = shoutoutMention?.id === 'everyone' ||
            shoutText.toLowerCase().startsWith('@everyone');

          if (isEveryoneShout && activeCommId !== 'global') {
            const { data: members } = await supabase.from('memberships')
              .select('user_id').eq('community_id', activeCommId).eq('status', 'active').neq('user_id', user.id);
            if (members?.length) {
              const comm = communities.find(c => c.id === activeCommId);
              await supabase.from('notifications').insert(members.map(m => ({
                user_id: m.user_id, type: 'new_announcement',
                message: `📢 ${user.full_name} shouted out everyone in "${comm?.name || 'a circle'}": ${shoutText.replace(/^@everyone\s*/i, '')}`,
                link_comm_id: activeCommId,
              })));
            }
          } else if (shoutoutMention?.id && shoutoutMention.id !== 'everyone') {
            // Exact user selected from dropdown
            const msgBody = shoutText.replace(/^@[\w\s]+?\s/i, '');
            await supabase.from('notifications').insert([{
              user_id: shoutoutMention.id, type: 'new_announcement',
              message: `? ${user.full_name} shouted you out: ${msgBody || shoutText}`,
              link_comm_id: activeCommId !== 'global' ? activeCommId : null,
            }]);
          } else {
            // Fallback: no dropdown selection, search by name
            const mentionMatch = shoutText.match(/^@([\w\s]+?)(?:\s|$)/i);
            if (mentionMatch) {
              const { data: mentioned } = await supabase.from('accounts')
                .select('id, full_name').ilike('full_name', `${mentionMatch[1].trim()}%`).limit(1).maybeSingle();
              if (mentioned && mentioned.id !== user.id) {
                const msgBody = shoutText.replace(/^@[\w\s]+?\s/i, '');
                await supabase.from('notifications').insert([{
                  user_id: mentioned.id, type: 'new_announcement',
                  message: `📣 ${user.full_name} shouted you out: ${msgBody || shoutText}`,
                  link_comm_id: activeCommId !== 'global' ? activeCommId : null,
                }]);
              }
            }
          }
          setShoutoutMention(null);
        }
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
      await autoFlagContent({ reporterId: user.id, reportedUserId: user.id, contentType: 'message', contentId: null, contentPreview: circleChatInput });
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

      const isShoutout = circleChatInput.trim().toLowerCase().startsWith('shoutout!');

      if (circlePendingMedia) {
        mediaUrl = await uploadMediaFile(circlePendingMedia.file, user.id, circlePendingMedia.mediaType);
        mediaSize = circlePendingMedia.file.size;
        mediaDuration = circlePendingMedia.duration || null;
        messageType = circlePendingMedia.mediaType;
      }

      const payload = {
        sender_id: user.student_id,
        content: circleChatInput.trim() || '',
        message_type: isShoutout ? 'shoutout' : messageType,
        media_url: mediaUrl,
        media_size: mediaSize,
        media_duration: mediaDuration,
        community_id: activeCommId,
        channel_id: null,
        role: myRankLevel >= 3 ? 'LEADER' : myRankLevel === 2 ? 'CO-LEADER' : myRankLevel === 1 ? 'MODERATOR' : 'MEMBER',
        ...(replyTo ? { reply_to_id: replyTo.id, reply_to_preview: replyTo.content?.slice(0, 100), reply_to_author: replyTo.full_name } : {}),
      };

      const { data, error } = await supabase.from('messages').insert([payload]).select();
      if (!error && data) {
        const sentMsg = { ...data[0], full_name: user.full_name };
        setCircleChatMessages(prev => prev.find(m => m.id === sentMsg.id) ? prev : [...prev, sentMsg]);
        if (circleChatInputRef.current) circleChatInputRef.current.value = '';
        setCirclePendingMedia(null);
        setReplyTo(null);

        // Shoutout notifications for circle chat
        if (isShoutout) {
          const shoutText = circleChatInput.trim().replace(/^shoutout!\s*/i, '');
          const isEveryoneShout = shoutoutMention?.id === 'everyone' ||
            shoutText.toLowerCase().startsWith('@everyone');

          if (isEveryoneShout) {
            const { data: members } = await supabase.from('memberships')
              .select('user_id').eq('community_id', activeCommId).eq('status', 'active').neq('user_id', user.id);
            if (members?.length) {
              const comm = communities.find(c => c.id === activeCommId);
              await supabase.from('notifications').insert(members.map(m => ({
                user_id: m.user_id, type: 'new_announcement',
                message: `📢 ${user.full_name} shouted out everyone in "${comm?.name || 'a circle'}": ${shoutText.replace(/^@everyone\s*/i, '')}`,
                link_comm_id: activeCommId,
              })));
            }
          } else if (shoutoutMention?.id) {
            const msgBody = shoutText.replace(/^@[\w\s]+?\s/i, '');
            await supabase.from('notifications').insert([{
              user_id: shoutoutMention.id, type: 'new_announcement',
              message: `? ${user.full_name} shouted you out: ${msgBody || shoutText}`,
              link_comm_id: activeCommId,
            }]);
          } else {
            const mentionMatch = shoutText.match(/^@([\w\s]+?)(?:\s|$)/i);
            if (mentionMatch) {
              const { data: mentioned } = await supabase.from('accounts')
                .select('id, full_name').ilike('full_name', `${mentionMatch[1].trim()}%`).limit(1).maybeSingle();
              if (mentioned && mentioned.id !== user.id) {
                const msgBody = shoutText.replace(/^@[\w\s]+?\s/i, '');
                await supabase.from('notifications').insert([{
                  user_id: mentioned.id, type: 'new_announcement',
                  message: `📣 ${user.full_name} shouted you out: ${msgBody || shoutText}`,
                  link_comm_id: activeCommId,
                }]);
              }
            }
          }
          setShoutoutMention(null);
        }

        // @mention notifications for regular messages (non-shoutout)
        if (!isShoutout && circleChatInput.includes('@')) {
          const mentionRegex = /@([\w][\w\s]*)/g;
          let match;
          const notified = new Set();
          while ((match = mentionRegex.exec(circleChatInput)) !== null) {
            const query = match[1].trim();
            const mentioned = circleChatMembers.find(m =>
              m.full_name?.toLowerCase() === query.toLowerCase() && m.id !== user.id
            );
            if (mentioned && !notified.has(mentioned.id)) {
              notified.add(mentioned.id);
              const commName = communities.find(c => c.id === activeCommId)?.name || 'a circle';
              await supabase.from('notifications').insert([{
                user_id: mentioned.id,
                type: 'new_announcement',
                message: `💬 ${user.full_name} mentioned you in ${commName}: "${circleChatInput.slice(0, 60)}${circleChatInput.length > 60 ? '...' : ''}"`,
                link_comm_id: activeCommId,
              }]);
            }
          }
        }
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
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(getApiUrl('/api/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'delete-community', id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || data.error || 'Failed to delete circle.'); return; }
      showToast('Circle deleted.');
      await loadCommunities();
      navTo('home', 'global');
    } catch (err) {
      console.error('[DELETE CIRCLE] Error:', err);
      showToast('Network error — could not delete circle.');
    }
  };

  const leaveCircle = async (commId) => {
    if (leaveCircle._pending) return; // prevent double call
    leaveCircle._pending = true;
    try {
      const membership = getMembership(commId);
      if (!membership) { leaveCircle._pending = false; return; }

      // If the user is the leader (owner or rank 3), show successor picker
      const comm = communities.find(c => c.id === commId);
      const isCircleOwner = comm?.creator_id === user?.id;
      if (isCircleOwner || membership.rank_level === 3) {
        // Fetch current active members (excluding self) to pick a successor
        const { data: members } = await supabase
          .from('memberships')
          .select('id, user_id, rank_level, accounts:user_id(full_name, ctu_id)')
          .eq('community_id', commId)
          .eq('status', 'active')
          .neq('user_id', user.id)
          .order('rank_level', { ascending: false });

        if (!members || members.length === 0) {
          // No other members ? can leave freely, circle may dissolve
          if (!confirm('You are the only member. Leaving will dissolve this circle. Continue?')) return;
        } else {
          // Show successor picker
          setSuccessorPicker({
            commId, members: members.map(m => ({
              id: m.user_id,
              membershipId: m.id,
              full_name: m.accounts?.full_name || 'Unknown',
              ctu_id: m.accounts?.ctu_id,
              rank_level: m.rank_level,
            }))
          });
          return;
        }
      } else {
        if (!confirm('Leave this circle? You will need to request to join again.')) return;
      }

      // Non-leader leave (or no-members leader leave)
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/memberships'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'leave', community_id: commId }),
      });
      if (!res.ok) { showToast('Failed to leave circle.'); leaveCircle._pending = false; return; }
      const leaveData = await res.json().catch(() => ({}));
      if (leaveData.dissolved) {
        setCommunities(prev => prev.filter(c => c.id !== commId));
        showToast('Circle dissolved.');
        await Promise.all([loadMyMemberships(), loadCommunities()]);
      } else {
        await insertSystemMessage(commId, `${user.full_name} left the circle.`);
        showToast('You have left the circle.');
        await loadMyMemberships();
      }
      navTo('home', 'global');
    } finally { leaveCircle._pending = false; }
  };

  const confirmLeaveWithSuccessor = async (commId, successorId) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(getApiUrl('/api/memberships'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: 'leave', community_id: commId, successor_id: successorId }),
    });
    if (!res.ok) { showToast('Failed to transfer leadership.'); return; }
    const leaveData = await res.json().catch(() => ({}));
    setSuccessorPicker(null);
    if (leaveData.dissolved) {
      setCommunities(prev => prev.filter(c => c.id !== commId));
      showToast('Circle dissolved.');
      await Promise.all([loadMyMemberships(), loadCommunities()]);
    } else {
      await insertSystemMessage(commId, `${user.full_name} left the circle and transferred leadership.`);
      showToast('Leadership transferred. You have left the circle.');
      await Promise.all([loadMyMemberships(), loadCommunities()]);
    }
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
  const myRankLevel = isOwner ? 3 : (getMembership(activeCommId)?.rank_level ?? 0);
  const myRole = myRankLevel >= 3 ? 'LEADER' : myRankLevel === 2 ? 'CO-LEADER' : myRankLevel === 1 ? 'MODERATOR' : 'MEMBER';
  const canModerate = isOwner || myRankLevel >= 2; // leader or co-leader
  const canDeleteChat = isOwner || myRankLevel >= 1; // leader, co-leader, or moderator
  const tagColor = myRole === 'LEADER' ? 'var(--cyber-yellow)' : myRole === 'CO-LEADER' ? 'var(--cyber-cyan)' : myRole === 'MODERATOR' ? 'var(--green)' : 'var(--text-muted)';

  const deleteMediaFromStorage = async (mediaUrl) => {
    if (!mediaUrl) return;
    try {
      const url = new URL(mediaUrl);
      const pathParts = url.pathname.split('/chat-media/');
      if (pathParts.length > 1) {
        await supabase.storage.from('chat-media').remove([decodeURIComponent(pathParts[1])]);
      }
    } catch { /* non-fatal */ }
  };

  const startCall = async (commId) => {
    if (startingCall) return;
    setStartingCall(true);
    try {
      const token = await getFreshToken();
      // Always use Vercel for /api/call ? it doesn't exist on Render
      const callUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3000/api/call'
        : '/api/call';
      const res = await fetch(callUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'create', community_id: commId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Failed to start call.'); setStartingCall(false); return; }
      // Post system message when starting or joining a call
      await supabase.from('messages').insert([{
        content: data.existing
          ? `NEXOSYS:📞 ${user.full_name} joined the call`
          : `NEXOSYS:📞 ${user.full_name} started a call`,
        message_type: 'text',
        community_id: commId,
        channel_id: null,
        sender_id: user.student_id,
      }]);
      setActiveCall({ token: data.token, livekit_url: data.livekit_url, room_name: data.room_name, comm_id: commId });
    } catch { showToast('Failed to start call.'); }
    setStartingCall(false);
  };

  const endCall = async (isLastParticipant = true) => {
    if (!activeCall) return;
    const callToEnd = activeCall;
    setActiveCall(null);
    try {
      await supabase.from('messages').insert([{
        content: `NEXOSYS:📞 ${user.full_name} left the call`,
        message_type: 'text',
        community_id: callToEnd.comm_id,
        channel_id: null,
        sender_id: user.student_id,
      }]);
      if (isLastParticipant) {
        const token = await getFreshToken();
        const callUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:3000/api/call'
          : '/api/call';
        await fetch(callUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ action: 'delete', room_name: callToEnd.room_name }),
        });
      }
    } catch { /* non-fatal */ }
  };


  const deleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    const msg = messages.find(m => m.id === msgId);
    await deleteMediaFromStorage(msg?.media_url);
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

  // Circles for profile display ? excludes the global feed
  const myCirclesForProfile = myCircles.filter(c => c.id !== 'global');

  // ── PENDING LOCKOUT: show waiting room instead of full portal ──────────────
  if (user && !user.is_verified) {
    const handlePendingLogout = () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/auth');
    };
    return (
      <div className="auth-page" style={{ minHeight: '100vh' }}>
        <div className="auth-card-glow auth-glow-login">
          <div className="auth-card fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: 'var(--cyber-cyan)', letterSpacing: 2, marginBottom: 8 }}>
              PENDING APPROVAL
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
              Your account is currently under review by the NEXO Admin.<br />
              This usually takes <strong style={{ color: 'var(--cyber-yellow)' }}>1–2 school days</strong>.<br />
              You'll get full access as soon as you're approved.
            </p>

            {/* Submitted info */}
            <div style={{
              background: 'rgba(0,240,255,0.04)',
              border: '1px solid rgba(0,240,255,0.15)',
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>
                SUBMITTED AS
              </p>
              {[
                { icon: 'fa-solid fa-user', label: 'Name', value: user.full_name },
                { icon: 'fa-solid fa-id-card', label: 'CTU ID', value: user.ctu_id || user.student_id },
                { icon: 'fa-solid fa-envelope', label: 'Email', value: user.email },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
                  <i className={icon} style={{ color: 'var(--cyber-cyan)', width: 16, textAlign: 'center' }} />
                  <span style={{ color: 'var(--text-muted)', minWidth: 48 }}>{label}:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value || '—'}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(252,238,10,0.06)',
              border: '1px solid rgba(252,238,10,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontSize: 12,
              color: 'var(--cyber-yellow)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <i className="fa-solid fa-rotate" />
              You can log back in anytime to check if you've been approved.
            </div>

            <button className="cyber-btn secondary" style={{ width: '100%' }} onClick={handlePendingLogout}>
              <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 8 }} />
              LOGOUT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-layout">
      {/* PENDING BANNER removed — pending users now see lockout screen above */}

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
            onChange={e => {
              const val = e.target.value;
              setSearch(val);
              clearTimeout(searchTimeout.current);
              if (val.trim().length < 2) { setSearchUsers([]); setSearchLoading(false); return; }
              setSearchLoading(true);
              searchTimeout.current = setTimeout(async () => {
                const q = val.trim();
                let query = supabase.from('accounts')
                  .select('id, full_name, ctu_id, account_status(is_verified, is_banned), account_details(avatar_url)')
                  .or(`full_name.ilike.%${q}%,ctu_id.ilike.%${q}%`)
                  .limit(10);
                if (user?.id) query = query.neq('id', user.id);
                const { data, error } = await query;
                if (error) console.error('[SEARCH] error:', error.message);
                const filtered = (data || [])
                  .filter(u => {
                    const st = Array.isArray(u.account_status) ? u.account_status[0] : u.account_status;
                    return !st?.is_banned && st?.is_verified !== false;
                  })
                  .slice(0, 5)
                  .map(u => {
                    const det = Array.isArray(u.account_details) ? u.account_details[0] : u.account_details;
                    return { ...u, avatar_url: det?.avatar_url || null };
                  });
                setSearchUsers(filtered);
                setSearchLoading(false);
              }, 300);
            }}
          />
          {search && (
            <button className="nav-search-clear" onClick={() => { setSearch(''); setSearchUsers([]); }}>
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
              {/* Users */}
              {searchUsers.length > 0 && (
                <>
                  <div className="search-result-label">USERS</div>
                  {searchUsers.map(u => (
                    <div key={u.id} className="search-result-item" onClick={() => {
                      viewUserProfile(u.ctu_id); setSearch(''); setSearchUsers([]);
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,240,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                        {(u.avatar_url || u.account_details?.avatar_url)
                          ? <img src={u.avatar_url || u.account_details.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (u.full_name?.[0] || '?').toUpperCase()
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.ctu_id}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* No results / loading */}
              {communities.filter(c => c.id !== 'global' && c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && searchUsers.length === 0 && (
                <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {searchLoading
                    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Searching...</>
                    : search.trim().length >= 2 ? 'No results found.' : null
                  }
                </div>
              )}            </div>
          )}
        </div>

        {/* RIGHT ? notifications + user hud */}
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

          {/* Mobile-only: ? more menu */}
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
                          setShowNotifications(false);

                          if (n.type === 'shoutout' || n.type === 'new_announcement') {
                            // Mention, shoutout, comment, reply ? go to circle CHAT (not announcements)
                            if (n.link_comm_id) {
                              setActiveChannelId(null);
                              setShowCircleAnnouncements(false); // open chat, not announcements
                              navTo('circles', n.link_comm_id);
                            } else {
                              navTo('global', 'global');
                              loadMessages('global', null);
                            }

                          } else if (n.type === 'circle_invite' && n.link_comm_id) {
                            const existingMembership = myMemberships.find(m => m.community_id === n.link_comm_id && m.status === 'active');
                            if (existingMembership) {
                              navTo('circles', n.link_comm_id);
                            } else {
                              const invitedCircle = communities.find(c => c.id === n.link_comm_id);
                              if (invitedCircle) setShowCircleInfo(invitedCircle);
                              else { setActiveCategory('all'); navTo('activity', 'global'); }
                            }

                          } else if (n.type === 'circle_approved' || n.type === 'circle_rejected') {
                            // Go to Explore so they can find their new circle or browse
                            setActiveCategory('all');
                            navTo('activity', 'global');

                          } else if (n.type === 'system') {
                            // Deletion warning ? open Help Center to Support tab
                            setShowHelp(true);

                          } else if (n.type === 'Application_update' || n.type === 'audition_update') {
                            // Application result ? go to the circle
                            if (n.link_comm_id) {
                              setActiveChannelId(null);
                              navTo('circles', n.link_comm_id);
                            }

                          } else if (n.link_comm_id) {
                            // Generic fallback ? navigate to the circle
                            setActiveChannelId(null);
                            navTo('circles', n.link_comm_id);
                          }
                        }}>
                        <div className="notif-icon">
                          <i className={notifIcon(n.type)}></i>
                        </div>
                        <div className="notif-content">
                          <p className="notif-msg">{n.group_count > 1 ? n.message : n.message}</p>
                          <span className="notif-time">{timeAgo(n.created_at)}</span>
                        </div>
                        {!n.is_read && <div className="notif-unread-dot"></div>}
                      </div>
                    ))}
                  </div>
                )}
                {/* Notification mute controls */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>MUTE CATEGORIES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['Connections', 'Circles', 'Campus'].map(cat => (
                      <label key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{cat}</span>
                        <input type="checkbox" checked={mutedCategories.includes(cat)}
                          onChange={() => toggleMuteCategory(cat)}
                          style={{ accentColor: 'var(--cyber-cyan)', cursor: 'pointer' }} />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hud-chip">
            <span className="hud-label">SCHOOL_ID:</span>
            <span className="hud-value">{user?.student_id}</span>
          </div>
          {streakCount > 0 && (
            <div className="hud-chip" title={`${streakCount}-day login streak - log in daily to earn trust points!`}
              onClick={() => showToast(`Day ${streakCount} Streak! Log in daily to earn up to +5 Trust Points per day.`)}
              style={{ cursor: 'pointer' }}>
              <i className="fa-solid fa-fire" style={{ fontSize: 13, color: "#f97316" }}></i>
              <span className="hud-value" style={{ color: '#f97316', fontWeight: 800 }}>{streakCount}</span>
            </div>
          )}
          <div className="hud-avatar" onClick={() => setShowProfile(true)} style={{ position: 'relative' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {navAvatarUrl
                ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            {navCompanion && (
              <img src={navCompanion} alt="" style={{
                position: 'absolute', top: '-15%', left: '-15%',
                width: '55%', height: 'auto',
                pointerEvents: 'none', zIndex: 2,
                filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
                transform: 'rotate(-15deg)',
              }} />
            )}
          </div>
        </div>
      </nav>

      <div className="main">
        {/* CIRCLE DOCK ? always visible on desktop, toggle overlay on mobile */}
        <div className={`circle-dock${(showDock || mobileSidebarOpen) ? " dock-mobile-open" : ""}`}>
          <div className="dock-branding">
            <img src="/logoo.png" className="brand-logo-small" alt="NEXO" style={{ borderRadius: 10, cursor: 'pointer' }}
              onClick={() => { navTo('home', 'global'); setActiveCommId('global'); setShowDock(false); setMobileSidebarOpen(false); }}
              title="Go to Home Feed" />
          </div>
          {myCircles.map(c => (
            <div key={c.id} className={`dock-icon ${activeCommId === c.id ? "active" : ""}`}
              title={c.name} onClick={() => {
                setMessages([]);
                navTo(c.id === "global" ? "home" : "circles", c.id);
                setActiveChannelId(null);
                setShowDock(false);
                setMobileSidebarOpen(true);
                // Clear unread badge for this circle
                if (c.id !== 'global') {
                  setCircleUnreadMap(prev => ({ ...prev, [c.id]: 0 }));
                }
              }} style={{ position: 'relative' }}>
              {c.id === "global"
                ? <i className="fa-solid fa-earth-asia"></i>
                : c.logo_url
                  ? <img src={c.logo_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                  : <i className={c.icon || getCategoryIcon(c.category)}></i>
              }
              {/* Unread badge on dock icon */}
              {c.id !== 'global' && circleUnreadMap[c.id] > 0 && activeCommId !== c.id && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px' }}>
                  {circleUnreadMap[c.id] > 99 ? '99+' : circleUnreadMap[c.id]}
                </span>
              )}
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

        {/* SIDEBAR ? context aware */}
        <div className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
          {activeCommId === 'global' ? (
            /* -- GLOBAL / HOME sidebar -- */
            <>
              <div className="sidebar-brand-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { navTo('home', 'global'); setMobileSidebarOpen(false); setShowDock(false); }}>
                  <img src="/logoo.png" alt="Nexo" className="sidebar-logo-icon" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
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
                  <div className={`ls-item ${section === 'bulletin' ? 'active' : ''}`} onClick={() => {
                    navTo('bulletin', 'global');
                    setMobileSidebarOpen(false);
                    setShowDock(false);
                    const now = new Date().toISOString();
                    setLastVisitedBulletin(now);
                    localStorage.setItem('nexo-bulletin-visited', now);
                  }}>
                    <i className="nav-icon fa-solid fa-thumbtack"></i>
                    <span className="node-name">Bulletin</span>
                    {(() => {
                      const unread = announcements.filter(a =>
                        (a.author_type === 'Admin' || a.community_id !== null || a.cross_posted_from != null) &&
                        a.post_type !== 'thread' && a.post_type !== 'general' &&
                        new Date(a.created_at) > new Date(lastVisitedBulletin)
                      ).length;
                      return unread > 0 ? <span className="req-badge" style={{ marginLeft: 'auto' }}>{unread}</span> : null;
                    })()}
                  </div>
                  <div className={`ls-item ${section === 'global' ? 'active' : ''}`} onClick={() => {
                    setMessages([]); navTo('global', 'global'); loadMessages('global', null); setMobileSidebarOpen(false); setShowDock(false);
                    const now = new Date().toISOString();
                    setLastVisitedGlobal(now);
                    localStorage.setItem('nexo-global-visited', now);
                  }}>
                    <i className="nav-icon fa-solid fa-message"></i>
                    <span className="node-name">Global Feed</span>
                    {(() => {
                      const unread = messages.filter(m =>
                        new Date(m.created_at) > new Date(lastVisitedGlobal) &&
                        m.sender_id !== user?.student_id
                      ).length;
                      return unread > 0 && section !== 'global'
                        ? <span className="req-badge" style={{ marginLeft: 'auto' }}>{unread > 99 ? '99+' : unread}</span>
                        : null;
                    })()}
                  </div>
                  <div className={`ls-item ${section === 'activity' && activeCategory === 'all' ? 'active' : ''}`} onClick={() => { navTo('activity', 'global'); setActiveCategory('all'); setMobileSidebarOpen(false); setShowDock(false); }}>
                    <i className="nav-icon fa-solid fa-compass"></i>
                    <span className="node-name">Explore</span>
                  </div>
                  <div className={`ls-item ${section === 'discover' ? 'active' : ''}`} onClick={() => { navTo('discover', 'global'); setMobileSidebarOpen(false); setShowDock(false); }}>
                    <i className="nav-icon fa-solid fa-people-group"></i>
                    <span className="node-name">Discover People</span>
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

                  {/* General ? virtual default channel */}
                  <div
                    className={`ls-item ${!showCircleAnnouncements && activeChannelId === null ? 'active' : ''}`}
                    onClick={() => {
                      setMessages([]); setActiveChannelId(null); setShowCircleAnnouncements(false); navTo('circles', activeCommId); loadMessages(activeCommId, null);
                      setCircleUnreadMap(prev => ({ ...prev, [activeCommId]: 0 }));
                    }}
                  >
                    <i className="channel-hash">#</i>
                    <span className="node-name">general</span>
                    {circleUnreadMap[activeCommId] > 0 && (activeChannelId !== null || showCircleAnnouncements) && (
                      <span className="req-badge" style={{ marginLeft: 'auto' }}>{circleUnreadMap[activeCommId] > 99 ? '99+' : circleUnreadMap[activeCommId]}</span>
                    )}
                  </div>

                  {/* Huddle ? hardcoded voice channel, always visible */}
                  {user?.is_verified && isMember(activeCommId) && (
                    <div
                      className="ls-item"
                      onClick={() => startCall(activeCommId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-volume-high" style={{ fontSize: 13, color: circleActiveCall ? '#3ecf8e' : 'var(--text-muted)', width: 16, flexShrink: 0 }}></i>
                      <span className="node-name" style={{ color: circleActiveCall ? '#3ecf8e' : undefined }}>call</span>
                      {circleActiveCall && (
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#3ecf8e', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf8e', display: 'inline-block' }}></span>
                          Live
                        </span>
                      )}
                    </div>
                  )}



                  {channels.filter(ch => ch.channel_type !== 'voice' && ch.type !== 'voice').map(ch => (
                    <div
                      key={ch.id}
                      className={`ls-item ${activeChannelId === ch.id && !showCircleAnnouncements ? 'active' : ''}`}
                      onClick={() => {
                        if (ch.channel_type === 'voice' || ch.type === 'voice') {
                          // Voice channel ? start or join call
                          startCall(activeCommId);
                        } else {
                          setActiveChannelId(ch.id);
                          navTo('circles', activeCommId);
                          setShowCircleAnnouncements(false);
                        }
                      }}
                    >
                      {ch.channel_type === 'voice' || ch.type === 'voice' ? (
                        <>
                          <i className="fa-solid fa-volume-high" style={{ fontSize: 13, color: circleActiveCall ? '#3ecf8e' : 'var(--text-muted)', width: 16, flexShrink: 0 }}></i>
                          <span className="node-name" style={{ color: circleActiveCall ? '#3ecf8e' : undefined }}>{ch.name}</span>
                          {circleActiveCall && (
                            <span style={{ marginLeft: 'auto', fontSize: 9, color: '#3ecf8e', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ecf8e', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                              Live
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <i className="channel-hash">#</i>
                          <span className="node-name">{ch.name}</span>
                          {canModerate && (
                            <i
                              className="fa-solid fa-xmark channel-delete-btn"
                              onClick={e => { e.stopPropagation(); deleteChannel(ch.id); }}
                              title="Delete channel"
                            ></i>
                          )}
                        </>
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
                          <div className="ls-item" style={{ color: 'var(--red)' }} onClick={() => leaveCircle(activeComm.id)}>
                            <i className="nav-icon fa-solid fa-right-from-bracket"></i>
                            <span className="node-name">Leave Circle</span>
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
                {isOwner && activeComm?.status === 'pending' && (
                  <div className="ls-item" style={{ color: 'var(--red)' }}
                    onClick={async () => {
                      if (!confirm(`Cancel the circle "${activeComm.name}"? All pending invites will be cancelled and invitees will be notified.`)) return;
                      const token = localStorage.getItem('accessToken');
                      const res = await fetch(getApiUrl('/api/memberships'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ action: 'cancel_circle', community_id: activeCommId }),
                      });
                      if (res.ok) {
                        showToast('Circle cancelled.');
                        await loadCommunities();
                        navTo('home', 'global');
                      } else {
                        const d = await res.json().catch(() => ({}));
                        showToast(d.message || 'Failed to cancel circle.');
                      }
                    }}>
                    <i className="nav-icon fa-solid fa-circle-xmark"></i>
                    <span className="node-name">Cancel Circle</span>
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

              {/* Deletion Warning Banner */}
              {user?.deletion_pending && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', background: 'rgba(168,85,247,0.1)', border: '2px solid rgba(168,85,247,0.5)', borderRadius: 12, marginBottom: 14 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#a855f7', fontSize: 22, marginTop: 2, flexShrink: 0 }}></i>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#a855f7', marginBottom: 4 }}>⚠️ Your account has been flagged for deletion</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Reason: <strong>{user.deletion_reason}</strong>
                    </div>
                    {user.deletion_deadline && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Deadline to appeal: <strong style={{ color: new Date(user.deletion_deadline) < new Date() ? 'var(--red)' : 'var(--cyber-yellow)' }}>
                          {new Date(user.deletion_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </strong>
                        {new Date(user.deletion_deadline) < new Date() && <span style={{ color: 'var(--red)', marginLeft: 8 }}>(Deadline passed)</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      If you believe this is a mistake, submit a Deletion Appeal through the Help Center (Support tab) while your account is still active.
                    </div>
                    <button
                      onClick={() => setShowHelp(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 8, color: '#a855f7', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <i className="fa-solid fa-headset"></i> Open Support Ticket
                    </button>
                  </div>
                </div>
              )}
              {/* Slim greeting */}
              <div style={{ padding: '16px 4px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 14, background: 'linear-gradient(135deg, rgba(0,240,255,0.06), rgba(168,85,247,0.06))', borderRadius: 12, padding: '18px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Welcome back</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0.5 }}>
                  {user?.full_name || 'Technologist'} <span style={{ fontSize: 20 }}>👋</span>
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
                            background: c.logo_url ? undefined : c.cover_url ? undefined : categoryGradient(c.category),
                            backgroundImage: c.logo_url ? `url(${c.logo_url})` : c.cover_url ? `url(${c.cover_url})` : undefined,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                          }}>
                            {!c.logo_url && !c.cover_url && <i className={(c.icon || getCategoryIcon(c.category))}></i>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
                              {c.category}
                              {memberCounts[c.id] > 0 && (
                                <span style={{ marginLeft: 8, color: 'var(--cyber-yellow)' }}>
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

              {/* -- THREAD COMPOSER -- all verified users */}
              {user?.is_verified && (
                <div className="home-post-composer">
                  {!showComposer ? (
                    <div className="home-composer-header" onClick={() => setShowComposer(true)} style={{ cursor: 'pointer' }}>
                      <div className="home-composer-avatar">
                        {navAvatarUrl ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, flex: 1 }}>
                        Share your thoughts, invite others to your circle...
                      </span>
                      <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--cyber-cyan)', fontSize: 14 }}></i>
                    </div>
                  ) : (
                    <>
                      <div className="home-composer-header">
                        <div className="home-composer-avatar">
                          {navAvatarUrl ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>New Thread</span>
                        <button onClick={() => { setShowComposer(false); setNewPost({ title: '', content: '', post_type: 'thread', anonymous: false, pollOptions: ['', ''], event_metadata: null }); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      <input className="home-composer-title" placeholder="Title" value={newPost.title}
                        onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} autoFocus />
                      <textarea className="home-composer-body" placeholder="Share your thoughts, invite others to your circle..."
                        value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={3} />
                      {postPendingMedia && (
                        <MediaPreview file={postPendingMedia.file} mediaType={postPendingMedia.mediaType} onCancel={() => setPostPendingMedia(null)} />
                      )}
                      <div className="home-composer-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 11, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="fa-solid fa-comments" style={{ fontSize: 10 }}></i> Thread ? {user.student_id}
                          </div>
                          {/* Visibility toggle */}
                          <button
                            type="button"
                            onClick={() => setNewPost(p => ({ ...p, visibility: p.visibility === 'public' ? 'connections' : 'public' }))}
                            style={{
                              background: 'none', border: `1px solid ${newPost.visibility === 'connections' ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                              borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                              color: newPost.visibility === 'connections' ? '#a78bfa' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', gap: 5, transition: '0.2s',
                            }}>
                            <i className={newPost.visibility === 'connections' ? 'fa-solid fa-lock' : 'fa-solid fa-earth-asia'} style={{ fontSize: 10 }}></i>
                            {newPost.visibility === 'connections' ? 'Connections only' : 'Public'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <MediaUploadButton onMediaSelected={setPostPendingMedia} disabled={postingAnnouncement || !!postPendingMedia} />
                          <button className="cyber-btn" style={{ width: 'auto', padding: '8px 22px', fontSize: 12 }}
                            disabled={postingAnnouncement || !newPost.title.trim() || !newPost.content.trim()}
                            onClick={() => { postAnnouncement('thread'); setShowComposer(false); }}>
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

              {/* -- THREADS FEED -- */}
              <div className="home-section-header" style={{ marginTop: 4 }}>
                <span><i className="fa-solid fa-comments" style={{ marginRight: 8, color: '#a78bfa' }}></i>Threads</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{announcements.filter(a => a.post_type === 'thread' || a.post_type === 'general').length} posts</span>
              </div>

              {(() => {
                const threadPosts = announcements.filter(a => {
                  if (a.post_type !== 'thread' && a.post_type !== 'general') return false;
                  if (a.visibility === 'connections') {
                    // Show if viewer is the author OR is an accepted connection of the author
                    return a.author_id === user?.id || connectedUserIds.has(a.author_id);
                  }
                  return true; // public
                });
                return threadPosts.length === 0 ? (
                  <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                    <i className="fa-solid fa-comments" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {user?.is_verified ? 'No threads yet. Be the first to start one!' : 'No threads yet. Verify your account to post.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {threadPosts.map(a => (
                      <AnnouncementCard key={a.id} a={a} user={user}
                        avatarCache={avatarCache}
                        onPin={togglePin}
                        onDelete={deleteAnnouncement}
                        onVote={handleVote}
                        onReport={(data) => setShowReport(data)}
                        onViewProfile={viewUserProfile}
                        onViewProfileById={viewUserProfileById}
                        onApply={(ann) => {
                          const match = ann.title?.match(/\(([^)]+)\)$/);
                          const commName = match?.[1];
                          const comm = commName
                            ? communities.find(c => c.name === commName)
                            : communities.find(c => ann.title?.includes(c.name));
                          if (comm) {
                            const appTitle = ann.title?.replace(/^Application Open - /, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
                            setShowApplicationForm({ comm, appTitle });
                          } else alert('Could not find the circle. Try visiting the circle directly.');
                        }}
                        onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                    ))}
                  </div>
                );
              })()}

              {/* Popular by category ? now shown above, removed from here */}

            </div>
          )}

          {/* -- BULLETIN -- official posts from Admin + verified circle leaders -- */}
          {section === 'bulletin' && (() => {
            const isAdminUser = user?.user_type === 'Admin';
            const myVerifiedLeaderCircles = communities.filter(c => {
              if (!c.is_official || c.id === 'global') return false;
              if (c.creator_id === user?.id) return true;
              const m = myMemberships.find(mem => mem.community_id === c.id && mem.status === 'active');
              return (m?.rank_level ?? 0) >= 2;
            });
            const canPostToBulletin = Boolean(user?.is_verified && (isAdminUser || myVerifiedLeaderCircles.length > 0));
            const effectiveBulletinCommId = bulletinPost.community_id || (!isAdminUser ? (myVerifiedLeaderCircles[0]?.id || '') : '');
            return (
            <div className="c-feed fade-in">
              <div className="home-hero" style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.08), rgba(168,85,247,0.08))', minHeight: 'unset', padding: '24px 28px' }}>
                <div className="home-hero-text">
                  <h1 style={{ fontSize: 22, marginBottom: 6 }}><i className="fa-solid fa-thumbtack" style={{ marginRight: 10, color: 'var(--cyber-cyan)' }}></i>Bulletin</h1>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>Official announcements, events, and updates from Admin and verified circle leaders.</p>
                </div>
              </div>

              {/* Direct Bulletin Composer for Admin & Verified Circle Leaders/Co-Leaders */}
              {canPostToBulletin && (
                <div className="home-post-composer" style={{ marginTop: 12 }}>
                  {!showBulletinComposer ? (
                    <div className="home-composer-header" onClick={() => setShowBulletinComposer(true)} style={{ cursor: 'pointer' }}>
                      <div className="home-composer-avatar" style={{ background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', color: 'var(--cyber-cyan)' }}>
                        {navAvatarUrl ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, flex: 1 }}>
                        Post an official announcement, event, or poll to the Bulletin...
                      </span>
                      <i className="fa-solid fa-thumbtack" style={{ color: 'var(--cyber-cyan)', fontSize: 14 }}></i>
                    </div>
                  ) : (
                    <>
                      <div className="home-composer-header">
                        <div className="home-composer-avatar" style={{ background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', color: 'var(--cyber-cyan)' }}>
                          {navAvatarUrl ? <img src={navAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>New Official Bulletin</span>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {effectiveBulletinCommId
                              ? 'Synced to both the Bulletin and the selected verified circle'
                              : 'Campus-wide official Admin post'}
                          </div>
                        </div>
                        <button onClick={() => { setShowBulletinComposer(false); setBulletinPost({ title: '', content: '', post_type: 'announcement', community_id: '', pollOptions: ['', ''], event_metadata: null }); setPostPendingMedia(null); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>

                      {/* Posting-as selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Posting as:</span>
                        {(isAdminUser || myVerifiedLeaderCircles.length > 1) ? (
                          <select
                            value={effectiveBulletinCommId}
                            onChange={e => setBulletinPost(p => ({ ...p, community_id: e.target.value }))}
                            style={{
                              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,240,255,0.25)',
                              borderRadius: 8, padding: '5px 10px', color: 'var(--text-primary)',
                              fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                            }}>
                            {isAdminUser && <option value="">Campus Admin (Official)</option>}
                            {myVerifiedLeaderCircles.map(c => (
                              <option key={c.id} value={c.id}>{c.name} (Verified Circle)</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <i className="fa-solid fa-circle-check"></i>
                            {myVerifiedLeaderCircles[0]?.name}
                          </span>
                        )}
                      </div>

                      <input className="home-composer-title" placeholder="Bulletin Title"
                        value={bulletinPost.title}
                        onChange={e => setBulletinPost(p => ({ ...p, title: e.target.value }))} autoFocus />

                      {bulletinPost.post_type !== 'poll' && (
                        <textarea className="home-composer-body"
                          placeholder={bulletinPost.post_type === 'event' ? 'Describe the official event, date, and venue...' : 'Write your official bulletin announcement...'}
                          value={bulletinPost.content}
                          onChange={e => setBulletinPost(p => ({ ...p, content: e.target.value }))}
                          rows={3} />
                      )}

                      {bulletinPost.post_type === 'poll' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {bulletinPost.pollOptions.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6 }}>
                              <input
                                className="home-composer-title"
                                style={{ marginBottom: 0, flex: 1 }}
                                placeholder={`Option ${i + 1}`}
                                value={opt}
                                onChange={e => {
                                  const opts = [...bulletinPost.pollOptions];
                                  opts[i] = e.target.value;
                                  setBulletinPost(p => ({ ...p, pollOptions: opts }));
                                }}
                              />
                              {bulletinPost.pollOptions.length > 2 && (
                                <button type="button"
                                  onClick={() => setBulletinPost(p => ({ ...p, pollOptions: p.pollOptions.filter((_, idx) => idx !== i) }))}
                                  style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', padding: '0 10px', fontSize: 13 }}>
                                  <i className="fa-solid fa-xmark"></i>
                                </button>
                              )}
                            </div>
                          ))}
                          {bulletinPost.pollOptions.length < 6 && (
                            <button type="button"
                              onClick={() => setBulletinPost(p => ({ ...p, pollOptions: [...p.pollOptions, ''] }))}
                              style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed rgba(0,240,255,0.3)', borderRadius: 6, color: 'var(--cyber-cyan)', cursor: 'pointer', padding: '4px 12px', fontSize: 11, fontFamily: 'inherit' }}>
                              + Add Option
                            </button>
                          )}
                        </div>
                      )}

                      {postPendingMedia && (
                        <MediaPreview file={postPendingMedia.file} mediaType={postPendingMedia.mediaType} onCancel={() => setPostPendingMedia(null)} />
                      )}

                      <div className="home-composer-footer">
                        <div className="home-composer-types">
                          {['announcement', 'event', 'poll'].map(t => {
                            const cfg = POST_TYPE[t];
                            return (
                              <button key={t}
                                className={`home-type-btn ${bulletinPost.post_type === t ? 'active' : ''}`}
                                style={{ '--type-color': cfg.color }}
                                onClick={() => setBulletinPost(p => ({ ...p, post_type: t }))}>
                                <i className={cfg.icon}></i> {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className="cyber-btn"
                            style={{ width: 'auto', padding: '8px 20px', fontSize: 12 }}
                            disabled={postingAnnouncement || !bulletinPost.title.trim() || (bulletinPost.post_type !== 'poll' && !bulletinPost.content.trim())}
                            onClick={() => postBulletinAnnouncement(myVerifiedLeaderCircles)}>
                            {postingAnnouncement
                              ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Publishing...</>
                              : <><i className="fa-solid fa-thumbtack" style={{ marginRight: 6 }}></i>Publish</>}
                          </button>
                          <MediaUploadButton onMediaSelected={setPostPendingMedia} disabled={postingAnnouncement || !!postPendingMedia} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Bulletin search */}
              <div style={{ position: 'relative', margin: '10px 0 4px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}></i>
                <input value={bulletinSearch} onChange={e => setBulletinSearch(e.target.value)}
                  placeholder="Search bulletin posts..."
                  style={{ width: '100%', paddingLeft: 34, paddingRight: bulletinSearch ? 34 : 12, paddingTop: 8, paddingBottom: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                {bulletinSearch && (
                  <button onClick={() => setBulletinSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
                {[
                  { key: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
                  { key: 'announcement', label: 'Announcement', icon: 'fa-solid fa-bullhorn' },
                  { key: 'event', label: 'Event', icon: 'fa-solid fa-calendar' },
                  { key: 'poll', label: 'Poll', icon: 'fa-solid fa-chart-bar' },
                  { key: 'archive', label: 'Archive', icon: 'fa-solid fa-box-archive' },
                ].map(f => {
                  const cfg = POST_TYPE[f.key];
                  const color = f.key === 'archive' ? 'var(--text-muted)' : (cfg?.color || 'var(--cyber-cyan)');
                  const isActive = f.key === 'archive' ? showHomeFeedArchive : feedFilter === f.key;
                  return (
                    <button key={f.key}
                      onClick={() => {
                        if (f.key === 'archive') {
                          setShowHomeFeedArchive(v => !v);
                          if (!showHomeFeedArchive) loadPastAnnouncements();
                        } else {
                          setFeedFilter(f.key);
                          setShowHomeFeedArchive(false);
                        }
                      }}
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

              {/* Archive view */}
              {showHomeFeedArchive ? (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-box-archive" style={{ color: 'var(--cyber-cyan)' }}></i>
                    Older official posts
                  </div>
                  {loadingPastAnnouncements ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><i className="fa-solid fa-spinner fa-spin"></i></div>
                  ) : pastAnnouncements.filter(a => a.author_type === 'Admin' || a.community_id !== null || a.cross_posted_from != null).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No archived posts.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {pastAnnouncements.filter(a => a.author_type === 'Admin' || a.community_id !== null || a.cross_posted_from != null).map(a => (
                        <AnnouncementCard key={a.id} a={a} user={user} avatarCache={avatarCache}
                          onPin={togglePin} onDelete={deleteAnnouncement} onVote={handleVote}
                          onReport={(data) => setShowReport(data)} onViewProfile={viewUserProfile}
                          onViewProfileById={viewUserProfileById}
                          onApply={(ann) => { const match = ann.title?.match(/\(([^)]+)\)$/); const commName = match?.[1]; const comm = commName ? communities.find(c => c.name === commName) : communities.find(c => ann.title?.includes(c.name)); if (comm) { const appTitle = ann.title?.replace(/^Application Open - /, '').replace(/\s*\([^)]*\)\s*$/, '').trim(); setShowApplicationForm({ comm, appTitle }); } }}
                          onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (() => {
                const bulletinPosts = announcements.filter(a =>
                  (a.author_type === 'Admin' || a.community_id !== null || a.cross_posted_from != null) &&
                  (a.post_type !== 'thread' && a.post_type !== 'general')
                );
                let filtered = feedFilter === 'all' ? bulletinPosts : bulletinPosts.filter(a => a.post_type === feedFilter);
                if (bulletinSearch.trim()) {
                  const q = bulletinSearch.toLowerCase();
                  filtered = filtered.filter(a => a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q));
                }
                return filtered.length === 0 ? (
                  <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                    <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {bulletinSearch ? `No posts matching "${bulletinSearch}"` : feedFilter === 'all' ? 'No bulletin posts yet.' : `No ${feedFilter} posts yet.`}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filtered.map(a => (
                      <AnnouncementCard key={a.id} a={a} user={user} avatarCache={avatarCache}
                        onPin={togglePin} onDelete={deleteAnnouncement} onVote={handleVote}
                        onReport={(data) => setShowReport(data)} onViewProfile={viewUserProfile}
                        onViewProfileById={viewUserProfileById}
                        onApply={(ann) => { const match = ann.title?.match(/\(([^)]+)\)$/); const commName = match?.[1]; const comm = commName ? communities.find(c => c.name === commName) : communities.find(c => ann.title?.includes(c.name)); if (comm) { const appTitle = ann.title?.replace(/^Application Open - /, '').replace(/\s*\([^)]*\)\s*$/, '').trim(); setShowApplicationForm({ comm, appTitle }); } else alert('Could not find the circle. Try visiting the circle directly.'); }}
                        onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                    ))}
                  </div>
                );
              })()}
            </div>
            );
          })()}

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
              <div ref={chatFeedRef} className="c-feed fade-in c-feed-chat" style={{ margin: '0 20px 0 0', borderRadius: '0', flex: 1 }}>

                {messagesLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, color: 'var(--cyber-cyan)', opacity: 0.7 }}></i>
                    <span style={{ fontSize: 12, letterSpacing: 1 }}>Loading messages...</span>
                  </div>
                ) : (() => {
                  const lastOwnIdx = messages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
                  const lastMsgSenderId = messages.length > 0 ? messages[messages.length - 1].student_id : null;
                  // Readers for last message: exclude current user and the sender
                  const lastMsgReaders = (messageReads[lastMsgId] || []).filter(
                    r => r.reader_id !== user?.id && r.reader_id !== lastMsgSenderId
                  );
                  return messages.map((m, idx) => {
                    const isOwnerMsg = m.sender_id === user?.student_id;
                    const prev = messages[idx - 1];
                    const next = messages[idx + 1];
                    const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                    const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                    const isLastMsg = m.id === lastMsgId;

                    // Group consecutive messages from same user within 3 minutes
                    const isGrouped = prev &&
                      prev.sender_id === m.sender_id &&
                      (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

                    const isLastInGroup = !next ||
                      next.sender_id !== m.sender_id ||
                      (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;

                    return (
                      <React.Fragment key={m.id}>
                        {showSep && <ChatTimeSeparator date={m.created_at} />}
                        {m.id === firstUnreadId && (
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
                          avatarUrl={avatarCache[m.sender_id] || null}
                          onViewProfile={viewUserProfile}
                          online={isOnline(profileIdCache[m.sender_id])}
                          readers={isLastMsg && isLastInGroup ? lastMsgReaders : []}
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
                  <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    {/* + attach menu */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setShowAttachMenu(v => !v)} disabled={uploading}
                        style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: showAttachMenu ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)', color: showAttachMenu ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s', transform: showAttachMenu ? 'rotate(45deg)' : 'none' }}>
                        <i className="fa-solid fa-plus" />
                      </button>
                      {showAttachMenu && (
                        <div style={{ position: 'absolute', bottom: 42, left: 0, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', zIndex: 400 }}>
                          <MediaUploadButton onMediaSelected={(m) => { setPendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!pendingMedia} />
                          <VoiceRecorder onVoiceRecorded={(m) => { setPendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!pendingMedia} />
                        </div>
                      )}
                    </div>
                    <input ref={msgInputRef} onChange={e => { handleChatInputChange(e.target.value); setShowAttachMenu(false); }}
                      onKeyDown={e => e.key === 'Enter' && !uploading && sendPost()}
                      placeholder="Say something to the Global Feed..."
                      disabled={uploading}
                      style={sendError ? { borderColor: 'var(--red)', flex: 1 } : { flex: 1 }} />
                    {shoutoutSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 10, overflow: 'hidden', zIndex: 300, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
                        {shoutoutSuggestions.map(p => (
                          <div key={p.id} onMouseDown={e => { e.preventDefault(); selectShoutoutMention(p, msgInputRef); }}
                            style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,240,255,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {p.id === 'everyone'
                              ? <><i className="fa-solid fa-users" style={{ color: 'var(--cyber-cyan)', width: 16 }}></i><span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>@everyone</span></>
                              : <><i className="fa-solid fa-user" style={{ color: 'var(--text-muted)', width: 16 }}></i><span>{p.full_name}</span></>}
                          </div>
                        ))}
                      </div>
                    )}
                    <button className="chat-send-btn" onClick={sendPost} disabled={uploading} title="Send">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                  {sendError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><i className="fa-solid fa-triangle-exclamation"></i>{sendError}</div>}
                </div>
              )}
            </>
          )}

          {/* -- DISCOVER PEOPLE -- */}
          {section === 'discover' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', width: '100%', boxSizing: 'border-box' }}>
              <DiscoverPeople
                user={user}
                onShowToast={showToast}
                onViewProfile={viewUserProfile}
                onNavigateToCircle={(circleId) => navTo('circles', circleId)}
              />
            </div>
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
                    { key: 'all', label: 'All', icon: 'fa-solid fa-border-all' },
                    { key: 'academic', label: 'Academic', icon: 'fa-solid fa-graduation-cap' },
                    { key: 'project', label: 'Projects', icon: 'fa-solid fa-flask' },
                    { key: 'hobby', label: 'Hobbies', icon: 'fa-solid fa-gamepad' },
                    { key: 'social', label: 'Social', icon: 'fa-solid fa-user-group' },
                    { key: 'forming', label: 'Forming', icon: 'fa-solid fa-hourglass-half' },
                  ].map(cat => (
                    <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: activeCategory === cat.key ? (cat.key === 'forming' ? 'rgba(247,169,79,0.15)' : 'rgba(0,240,255,0.15)') : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${activeCategory === cat.key ? (cat.key === 'forming' ? 'var(--orange)' : 'var(--cyber-cyan)') : 'rgba(255,255,255,0.1)'}`,
                        color: activeCategory === cat.key ? (cat.key === 'forming' ? 'var(--orange)' : 'var(--cyber-cyan)') : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}>
                      <i className={cat.icon} style={{ fontSize: 11 }} />{cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const filtered = communities.filter(c =>
                  c.id !== 'global' && (
                    activeCategory === 'all' ? true :
                      activeCategory === 'forming' ? c.status === 'pending' :
                        c.category === activeCategory
                  )
                ).sort((a, b) => {
                  // Invited circles always float to the top
                  const aInvited = isInvited(a.id) ? 1 : 0;
                  const bInvited = isInvited(b.id) ? 1 : 0;
                  return bInvited - aInvited;
                });
                return filtered.length === 0 ? (
                  <div className="post"><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No circles found in this category.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(c => {
                      const owned = c.creator_id === user?.id;
                      const joined = isMember(c.id);
                      const pending = isPending(c.id);
                      const invited = isInvited(c.id);
                      const myApplication = getMyApplication(c.id);
                      const isAcceptedApp = myApplication && (myApplication.status === 'accepted' || myApplication.status === 'approved' || myApplication.phase2_result === 'accepted');

                      // Status indicator shown on the card (quick glance only)
                      let statusBadge = null;
                      if (invited) statusBadge = <span style={{ fontSize: 10, color: 'var(--cyber-cyan)', border: '1px solid var(--cyber-cyan)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}><i className="fa-solid fa-envelope" style={{ marginRight: 4 }}></i>INVITED</span>;
                      else if (owned) statusBadge = <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>YOUR CIRCLE</span>;
                      else if (joined) statusBadge = <span style={{ fontSize: 10, color: '#3ecf8e', border: '1px solid #3ecf8e', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}><i className="fa-solid fa-check" style={{ marginRight: 4 }}></i>JOINED</span>;
                      else if (pending) statusBadge = <span style={{ fontSize: 10, color: 'var(--cyber-yellow)', border: '1px solid var(--cyber-yellow)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}><i className="fa-solid fa-clock" style={{ marginRight: 4 }}></i>PENDING</span>;
                      else if (myApplication && !isAcceptedApp) statusBadge = <span style={{ fontSize: 10, color: ApplicationStatusColor(myApplication.status, myApplication.phase2_result), border: `1px solid ${ApplicationStatusColor(myApplication.status, myApplication.phase2_result)}`, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}><i className="fa-solid fa-microphone" style={{ marginRight: 4 }}></i>{ApplicationStatusLabel(myApplication.status, myApplication.phase2_result)}</span>;

                      return (
                        <div key={c.id} className="post circle-explore-card"
                          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', cursor: 'pointer' }}
                          onClick={() => setShowCircleInfo(c)}>

                          {/* Logo */}
                          <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {c.logo_url
                              ? <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <i className={c.icon || getCategoryIcon(c.category)} style={{ fontSize: 18, color: 'var(--cyber-cyan)' }} />
                            }
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid #333', padding: '1px 6px', borderRadius: 4, letterSpacing: 1 }}>{c.category}</span>
                              {c.status === 'pending' && <span style={{ fontSize: 9, color: 'var(--orange)', border: '1px solid var(--orange)', padding: '1px 6px', borderRadius: 4 }}><i className="fa-solid fa-hourglass-half" style={{ marginRight: 3 }}></i>Forming</span>}
                              {c.is_open && c.status !== 'pending' && <span style={{ fontSize: 9, color: '#3ecf8e', border: '1px solid #3ecf8e', padding: '1px 6px', borderRadius: 4 }}><i className="fa-solid fa-door-open" style={{ marginRight: 3 }}></i>Open</span>}
                              {c.application_enabled && <span style={{ fontSize: 9, color: 'var(--cyber-cyan)', border: '1px solid rgba(0,240,255,0.4)', padding: '1px 6px', borderRadius: 4 }}><i className="fa-solid fa-microphone" style={{ marginRight: 3 }}></i>Application</span>}
                            </div>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.description || <span style={{ fontStyle: 'italic', opacity: 0.4 }}>No description</span>}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                <i className="fa-solid fa-users" style={{ fontSize: 9, marginRight: 4 }}></i>{memberCounts[c.id] || 0} member{(memberCounts[c.id] || 0) !== 1 ? 's' : ''}
                              </span>
                              {statusBadge}
                            </div>
                          </div>

                          {/* Single CTA */}
                          <button
                            className="group-action-btn manage"
                            onClick={e => { e.stopPropagation(); setShowCircleInfo(c); }}
                            style={{ flexShrink: 0, fontSize: 11, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                            <i className="fa-solid fa-eye" style={{ marginRight: 6 }}></i>VIEW
                          </button>
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
                  {/* Cover photo edit button ? top-right, only for creator */}
                  {isOwner && (
                    <label className="circle-cover-edit-btn" title="Change circle cover photo">
                      <i className="fa-solid fa-image"></i>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setPendingCircleCropFile(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {/* Report circle cover/logo ? visible to non-owners when cover exists */}
                  {!isOwner && activeComm.cover_url && user?.user_type !== 'Admin' && (
                    <button onClick={() => setShowReport({ type: 'circle_photo', id: activeComm.id, preview: `Cover photo of circle: ${activeComm.name}`, reportedUserId: activeComm.creator_id })}
                      title="Report this circle cover photo"
                      style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(247,95,95,0.4)', color: 'var(--red)', borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(6px)', opacity: 0.8, zIndex: 5 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.8}>
                      <i className="fa-solid fa-flag" style={{ fontSize: 10 }} /> Report Cover
                    </button>
                  )}
                  <div className="circle-cover-overlay">
                    <div className="circle-cover-icon">
                      {activeComm.logo_url
                        ? <img src={activeComm.logo_url} alt={activeComm.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <i className={activeComm.icon || getCategoryIcon(activeComm.category)}></i>
                      }
                    </div>
                    <div>
                      <h2 className="circle-cover-title">
                        {activeComm.name.toUpperCase()}
                        {activeComm.is_official && (
                          <span style={{ marginLeft: 10, fontSize: 12, background: 'rgba(62,207,142,0.2)', border: '1px solid var(--green)', color: 'var(--green)', borderRadius: 20, padding: '2px 10px', fontWeight: 700, letterSpacing: 1, verticalAlign: 'middle' }}>
                            <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }}></i>VERIFIED
                          </span>
                        )}
                        {activeChannelId && channels.find(c => c.id === activeChannelId) && (
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, fontSize: 15, marginLeft: 10 }}>
                            # {channels.find(c => c.id === activeChannelId)?.name}
                          </span>
                        )}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {activeCommId !== 'global' && (
                          <div className="verified-badge" style={{ borderColor: tagColor, color: tagColor, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className={myRole === 'LEADER' ? 'fa-solid fa-crown' : myRole === 'CO-LEADER' ? 'fa-solid fa-star' : myRole === 'MODERATOR' ? 'fa-solid fa-shield' : 'fa-solid fa-user'} style={{ fontSize: 10 }}></i>
                            {myRole}
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
                      <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, display: 'none' }}>
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
                              {label} · {group.length}
                            </div>
                            {group.map(m => {
                              const url = avatarCache[m.sender_id] || m.avatar_url;
                              const initials = (m.full_name || '?')[0].toUpperCase();
                              return (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px', opacity: isOnline(m.id) ? 1 : 0.45, cursor: 'pointer' }}
                                  onClick={() => {
                                    setShowOnlineModal(false);
                                    const memberStudentId = m.student_id || m.ctu_id;
                                    if (memberStudentId === user?.student_id || memberStudentId === String(user?.ctu_id)) {
                                      setShowProfile(true);
                                    } else {
                                      viewUserProfile(memberStudentId);
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
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.sender_id}</div>
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

              <div ref={chatFeedRef} className="c-feed fade-in c-feed-chat" style={{ margin: '0 20px 0 0', borderRadius: '0', flex: 1 }}>
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
                        ) : (() => {
                          const myApp = getMyApplication(activeCommId);
                          const isAcceptedApp = myApp && (myApp.status === 'accepted' || myApp.status === 'approved' || myApp.phase2_result === 'accepted');
                          if (myApp && !isAcceptedApp) {
                            const appColor = { pending: 'var(--cyber-yellow)', accepted: 'var(--green)', rejected: 'var(--red)' }[myApp.status] || 'var(--cyber-cyan)';
                            return (
                              <span style={{ fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 20, color: appColor, border: `1px solid ${appColor}` }}>
                                <i className="fa-solid fa-microphone" style={{ marginRight: 6 }}></i>
                                APPLICATION {(myApp.status || '').toUpperCase()}
                              </span>
                            );
                          }
                          return (
                            <button className="group-action-btn manage" onClick={() => setShowApplicationForm({ comm: activeComm })}>
                              <i className="fa-solid fa-microphone"></i> APPLY TO JOIN
                            </button>
                          );
                        })()
                      ) : (
                        <button className="group-action-btn manage" onClick={() => requestJoin(activeCommId)}>
                          <i className="fa-solid fa-paper-plane"></i> REQUEST TO JOIN
                        </button>
                      )
                    )}
                  </div>
                ) : activeComm?.status === 'pending' ? (
                  <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fa-solid fa-hourglass-half" style={{ fontSize: 32, color: 'var(--orange)', marginBottom: 16, display: 'block' }}></i>
                    <p style={{ color: 'var(--orange)', fontWeight: 700, marginBottom: 8 }}>Circle is still forming</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chat unlocks once 3 members have joined. Share the circle in Explore so others can apply!</p>
                  </div>
                ) : showCircleAnnouncements ? (
                  /* -- CIRCLE ANNOUNCEMENTS VIEW -- */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Post composer ? Leaders/Co-Leaders for all types; all verified members for Thread */}
                    {isMember(activeCommId) && user?.is_verified && (
                      <div className="home-post-composer">
                        <div className="home-composer-header">
                          <div className="home-composer-avatar" style={{ background: 'rgba(252,238,10,0.15)', border: '1px solid rgba(252,238,10,0.3)', color: 'var(--cyber-yellow)' }}>
                            {initials}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                              Post to {activeComm.name}
                            </span>
                            {activeComm.is_official && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                <i className="fa-solid fa-circle-check" style={{ marginRight: 4, color: 'var(--green)' }}></i>
                                Verified circle
                              </div>
                            )}
                          </div>
                        </div>
                        <input className="home-composer-title" placeholder="Title"
                          value={newCirclePost.title}
                          onChange={e => setNewCirclePost(p => ({ ...p, title: e.target.value }))} />
                        {newCirclePost.post_type !== 'poll' && (
                          <textarea className="home-composer-body" placeholder={newCirclePost.post_type === 'thread' ? 'Share your thoughts with the circle...' : newCirclePost.post_type === 'event' ? 'Describe the event...' : newCirclePost.post_type === 'shoutout' ? 'Give a shoutout...' : 'Write your announcement...'}
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
                        {postPendingMedia && (
                          <MediaPreview file={postPendingMedia.file} mediaType={postPendingMedia.mediaType} onCancel={() => setPostPendingMedia(null)} />
                        )}
                        <div className="home-composer-footer">
                          <div className="home-composer-types">
                            {['thread', ...(myRankLevel >= 2 ? ['announcement', 'event', 'poll', ...(activeComm.category === 'hobby' ? ['showcase'] : []), ...(activeComm.category === 'academic' ? ['question'] : [])] : [])].map(t => {
                              const cfg = POST_TYPE[t];
                              return (
                                <button key={t}
                                  className={`home-type-btn ${newCirclePost.post_type === t ? 'active' : ''}`}
                                  style={{ '--type-color': cfg.color }}
                                  onClick={() => {
                                    setNewCirclePost(p => ({ ...p, post_type: t }));
                                    if (t === 'thread') setCrossPostToFeed(false);
                                  }}>
                                  <i className={cfg.icon}></i> {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {activeComm.is_official && myRankLevel >= 2 && newCirclePost.post_type !== 'thread' && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: crossPostToFeed ? 'var(--green)' : 'var(--text-muted)', userSelect: 'none' }}
                                title="Also publish this official post to the campus Bulletin">
                                <input
                                  type="checkbox"
                                  checked={crossPostToFeed}
                                  onChange={e => setCrossPostToFeed(e.target.checked)}
                                  style={{ accentColor: 'var(--green)', width: 13, height: 13, cursor: 'pointer' }}
                                />
                                <i className="fa-solid fa-thumbtack" style={{ fontSize: 10 }}></i>
                                Post to Bulletin
                              </label>
                            )}
                            <button className="cyber-btn"
                              style={{ width: 'auto', padding: '8px 20px', fontSize: 12 }}
                              disabled={postingAnnouncement || !newCirclePost.title.trim() || (newCirclePost.post_type !== 'poll' && !newCirclePost.content.trim())}
                              onClick={() => postCircleAnnouncement(activeCommId)}>
                              {postingAnnouncement
                                ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Posting...</>
                                : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Post</>}
                            </button>
                            <MediaUploadButton onMediaSelected={setPostPendingMedia} disabled={postingAnnouncement || !!postPendingMedia} />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Circle filter bar ? All, Announcement, Event, Poll, Archive */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {[
                        { key: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
                        { key: 'announcement', label: 'Announcement', icon: 'fa-solid fa-bullhorn' },
                        { key: 'event', label: 'Event', icon: 'fa-solid fa-calendar' },
                        { key: 'thread', label: 'Thread', icon: 'fa-solid fa-comments' },
                        { key: 'poll', label: 'Poll', icon: 'fa-solid fa-chart-bar' },
                        { key: 'archive', label: 'Archive', icon: 'fa-solid fa-box-archive' },
                      ].map(f => {
                        const active = f.key === 'archive' ? showCircleArchive : (!showCircleArchive && (f.key === 'all' ? qaFilter === 'all' : qaFilter === f.key));
                        return (
                          <button key={f.key}
                            onClick={() => {
                              if (f.key === 'archive') {
                                setShowCircleArchive(v => !v);
                                if (!showCircleArchive) loadPastCircleAnnouncements(activeCommId);
                              } else {
                                setShowCircleArchive(false);
                                setQaFilter(f.key);
                              }
                            }}
                            style={{
                              padding: '4px 12px', fontSize: 11, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                              border: active ? '1px solid var(--cyber-cyan)' : '1px solid rgba(0,240,255,0.15)',
                              background: active ? 'rgba(0,240,255,0.1)' : 'rgba(0,0,0,0.2)',
                              color: active ? 'var(--cyber-cyan)' : 'var(--text-muted)',
                              fontWeight: active ? 700 : 400, transition: 'all 0.2s',
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                            <i className={f.icon} style={{ fontSize: 9 }}></i>{f.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Archive view */}
                    {showCircleArchive && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <i className="fa-solid fa-box-archive" style={{ color: 'var(--cyber-cyan)' }}></i>
                          Older posts from this circle
                        </div>
                        {loadingPastCircle ? (
                          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><i className="fa-solid fa-spinner fa-spin"></i></div>
                        ) : pastCircleAnnouncements.length === 0 ? (
                          <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                            <i className="fa-solid fa-box-archive" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No archived posts yet.</p>
                          </div>
                        ) : pastCircleAnnouncements.map(a => (
                          <AnnouncementCard key={a.id} a={a} user={user}
                            avatarCache={avatarCache} onPin={togglePin}
                            onDelete={(id) => { supabase.from('announcements').delete().eq('id', id); loadPastCircleAnnouncements(activeCommId); }}
                            onVote={handleCircleVote} onReport={(data) => setShowReport(data)}
                            onViewProfile={viewUserProfile} onViewProfileById={viewUserProfileById}
                            communityCreatorId={activeComm?.creator_id}
                            onReload={() => loadPastCircleAnnouncements(activeCommId)}
                            onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                        ))}
                      </div>
                    )}

                    {/* Q&A Filter bar ? academic circles only */}
                    {!showCircleArchive && activeComm?.category === 'academic' && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        {[
                          { key: 'all', label: 'All Posts' },
                          { key: 'questions', label: '❓ Questions' },
                          { key: 'unanswered', label: '📭 Unanswered' },
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
                    {/* Post search bar */}
                    {!showCircleArchive && (
                      <div style={{ position: 'relative', marginBottom: 10 }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}></i>
                        <input
                          value={circlePostSearch}
                          onChange={e => setCirclePostSearch(e.target.value)}
                          placeholder="Search posts..."
                          style={{ width: '100%', paddingLeft: 34, paddingRight: circlePostSearch ? 34 : 12, paddingTop: 8, paddingBottom: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {circlePostSearch && (
                          <button onClick={() => setCirclePostSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                      </div>
                    )}

                    {!showCircleArchive && circleAnnouncements.length === 0 ? (
                      <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                        <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}></i>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No announcements yet.</p>
                      </div>
                    ) : !showCircleArchive ? (
                      (() => {
                        let filtered = qaFilter === 'questions'
                          ? circleAnnouncements.filter(a => a.post_type === 'question')
                          : qaFilter === 'unanswered'
                            ? circleAnnouncements.filter(a => a.post_type === 'question' && !a.solution_comment_id)
                            : qaFilter === 'announcement' || qaFilter === 'event' || qaFilter === 'poll' || qaFilter === 'thread'
                              ? circleAnnouncements.filter(a => a.post_type === qaFilter || (qaFilter === 'thread' && a.post_type === 'general'))
                              : circleAnnouncements;
                        // Apply post search on top of type filter
                        if (circlePostSearch.trim()) {
                          const q = circlePostSearch.toLowerCase();
                          filtered = filtered.filter(a =>
                            a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)
                          );
                        }
                        if (filtered.length === 0) return (
                          <div className="post" style={{ textAlign: 'center', padding: 32 }}>
                            <i className="fa-solid fa-thumbtack" style={{ fontSize: 28, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}></i>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{circlePostSearch ? `No posts matching "${circlePostSearch}"` : `No ${qaFilter === 'all' ? '' : qaFilter + ' '}posts yet.`}</p>
                          </div>
                        );
                        return filtered.map(a => (
                          <AnnouncementCard key={a.id} a={a} user={user}
                            avatarCache={avatarCache}
                            onPin={togglePin}
                            onDelete={(id) => { deleteAnnouncement(id); loadCircleAnnouncements(activeCommId); }}
                            onVote={handleCircleVote}
                            onReport={(data) => setShowReport(data)}
                            onViewProfile={viewUserProfile}
                            onViewProfileById={viewUserProfileById}
                            onApply={(ann) => { const appTitle = ann.title?.replace(/^(Internal )?Application Open - /, '').trim(); setShowApplicationForm({ comm: activeComm, appTitle }); }}
                            communityCreatorId={activeComm?.creator_id}
                            onReload={() => loadCircleAnnouncements(activeCommId)}
                            onViewEvents={() => { setShowEventsModal(true); loadEvents(); }} />
                        ));
                      })()
                    ) : null}
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
                    if (messagesLoading) return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 22, color: 'var(--cyber-cyan)', opacity: 0.7 }}></i>
                        <span style={{ fontSize: 12, letterSpacing: 1 }}>Loading messages...</span>
                      </div>
                    );
                    const lastOwnIdx = messages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
                    const lastMsgSenderId = messages.length > 0 ? messages[messages.length - 1].student_id : null;
                    const lastMsgReaders = (messageReads[lastMsgId] || []).filter(
                      r => r.reader_id !== user?.id && r.reader_id !== lastMsgSenderId
                    );
                    return messages.map((m, idx) => {
                      const isOwnerMsg = m.sender_id === user?.student_id;
                      const canDelete = isOwnerMsg || canDeleteChat;
                      const prev = messages[idx - 1];
                      const next = messages[idx + 1];
                      const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                      const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                      const isLastMsg = m.id === lastMsgId;

                      // Group consecutive messages from same user within 3 minutes
                      const isGrouped = prev &&
                        prev.sender_id === m.sender_id &&
                        (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

                      const isLastInGroup = !next ||
                        next.sender_id !== m.sender_id ||
                        (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;

                      return (
                        <React.Fragment key={m.id}>
                          {showSep && <ChatTimeSeparator date={m.created_at} />}
                          {m.content?.startsWith('NEXOSYS:') ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px', margin: '2px 0' }}>
                              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', padding: '0 6px' }}>
                                {m.content.slice('NEXOSYS:'.length)}
                              </span>
                              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            </div>
                          ) : (
                            <MessageItem
                              m={m}
                              tagColor={tagColor}
                              isOwnerMsg={isOwnerMsg}
                              canDelete={canDelete}
                              onDelete={deleteMessage}
                              onEdit={editMessage}
                              onReport={(data) => setShowReport(data)}
                              currentStudentId={user?.student_id}
                              avatarUrl={avatarCache[m.sender_id] || null}
                              onViewProfile={viewUserProfile}
                              online={isOnline(profileIdCache[m.sender_id])}
                              readers={isLastMsg && isLastInGroup ? lastMsgReaders : []}
                              isLastOwn={isLastOwn}
                              isGrouped={isGrouped}
                              isLastInGroup={isLastInGroup}
                              userCustomizations={userCustomizations}
                              onReply={(msg) => setReplyTo(msg)}
                            />
                          )}
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                <div ref={feedBottomRef} />
              </div>

              {isMember(activeCommId) && !showCircleAnnouncements && user?.is_verified && channels.find(c => c.id === activeChannelId)?.channel_type !== 'tasks' && activeComm?.status !== 'pending' && (
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
                  <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setShowAttachMenu(v => !v)} disabled={uploading}
                        style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: showAttachMenu ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)', color: showAttachMenu ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s', transform: showAttachMenu ? 'rotate(45deg)' : 'none' }}>
                        <i className="fa-solid fa-plus" />
                      </button>
                      {showAttachMenu && (
                        <div style={{ position: 'absolute', bottom: 42, left: 0, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', zIndex: 400 }}>
                          <MediaUploadButton onMediaSelected={(m) => { setPendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!pendingMedia} />
                          <VoiceRecorder onVoiceRecorded={(m) => { setPendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!pendingMedia} />
                        </div>
                      )}
                    </div>
                    <input ref={msgInputRef} onChange={e => { handleChatInputChange(e.target.value); setShowAttachMenu(false); }}
                      onKeyDown={e => e.key === 'Enter' && !uploading && sendPost()}
                      placeholder={`Say something to ${activeComm?.name || 'Circle Chat'}...`}
                      disabled={uploading}
                      style={sendError ? { borderColor: 'var(--red)', flex: 1 } : { flex: 1 }} />
                    {shoutoutSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 10, overflow: 'hidden', zIndex: 300, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
                        {shoutoutSuggestions.map(p => (
                          <div key={p.id} onMouseDown={e => { e.preventDefault(); selectShoutoutMention(p, msgInputRef); }}
                            style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,240,255,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {p.id === 'everyone'
                              ? <><i className="fa-solid fa-users" style={{ color: 'var(--cyber-cyan)', width: 16 }}></i><span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>@everyone</span><span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>(circle only)</span></>
                              : <><i className="fa-solid fa-user" style={{ color: 'var(--text-muted)', width: 16 }}></i><span>{p.full_name}</span></>}
                          </div>
                        ))}
                      </div>
                    )}
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
                    {/* Call button */}
                    {user?.is_verified && (
                      <button onClick={() => startCall(activeCommId)} disabled={startingCall || !!activeCall}
                        title="Start voice/video call"
                        style={{ background: activeCall ? 'rgba(62,207,142,0.15)' : 'transparent', border: `1px solid ${activeCall ? 'var(--green)' : 'rgba(0,240,255,0.25)'}`, borderRadius: 8, color: activeCall ? 'var(--green)' : 'var(--text-muted)', padding: '5px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s' }}>
                        <i className={startingCall ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-phone'} />
                        <span>{startingCall ? 'Starting...' : activeCall ? 'In Call' : 'Call'}</span>
                      </button>
                    )}
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
                  ) : activeComm?.status === 'pending' ? (
                    <div className="post" style={{ textAlign: 'center', padding: 40 }}>
                      <i className="fa-solid fa-hourglass-half" style={{ fontSize: 32, color: 'var(--orange)', marginBottom: 16, display: 'block' }}></i>
                      <p style={{ color: 'var(--orange)', fontWeight: 700, marginBottom: 8 }}>Circle is still forming</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chat unlocks once 3 members have joined. Share the circle in Explore so others can apply!</p>
                    </div>
                  ) : (
                    (() => {
                      const lastOwnIdx = circleChatMessages.reduce((acc, x, i) => x.student_id === user?.student_id ? i : acc, -1);
                      const lastMsgId = circleChatMessages.length > 0 ? circleChatMessages[circleChatMessages.length - 1].id : null;
                      const lastMsgSenderId = circleChatMessages.length > 0 ? circleChatMessages[circleChatMessages.length - 1].student_id : null;
                      const lastMsgReaders = (messageReads[lastMsgId] || []).filter(
                        r => r.reader_id !== user?.id && r.reader_id !== lastMsgSenderId
                      );
                      return circleChatMessages.map((m, idx) => {
                        const isSysMsg = m.content?.startsWith('NEXOSYS:');
                        const isOwnerMsg = m.sender_id === user?.student_id;
                        const canDelete = isOwnerMsg || canDeleteChat;
                        const prev = circleChatMessages[idx - 1];
                        const next = circleChatMessages[idx + 1];
                        const showSep = !prev || (new Date(m.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
                        const isLastOwn = isOwnerMsg && idx === lastOwnIdx;
                        const isLastMsg = m.id === lastMsgId;

                        // Group consecutive messages from same user within 3 minutes
                        // Group consecutive messages from same user within 3 minutes
                        const isGrouped = !isSysMsg && prev &&
                          !prev.content?.startsWith('NEXOSYS:') &&
                          prev.sender_id === m.sender_id &&
                          (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

                        const isLastInGroup = isSysMsg || !next ||
                          next.content?.startsWith('NEXOSYS:') ||
                          next.sender_id !== m.sender_id ||
                          (new Date(next.created_at) - new Date(m.created_at)) >= 3 * 60 * 1000;
                        return (
                          <React.Fragment key={m.id}>
                            {showSep && <ChatTimeSeparator date={m.created_at} />}
                            {m.id === firstUnreadId && (
                              <div ref={firstUnreadRef}><UnreadDivider /></div>
                            )}
                            {m.content?.startsWith('NEXOSYS:') ? (
                              (() => {
                                const body = m.content.slice('NEXOSYS:'.length);
                                if (body.startsWith('CALL_STARTED:')) {
                                  const parts = body.split(':');
                                  const roomName = parts[parts.length - 1];
                                  const roomUrl = parts.slice(1, parts.length - 1).join(':');
                                  const isInCall = activeCall?.room_name === roomName;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', margin: '4px 0' }}>
                                      <div style={{ flex: 1, height: 1, background: 'rgba(62,207,142,0.2)' }} />
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.25)', borderRadius: 20, padding: '5px 14px' }}>
                                        <i className="fa-solid fa-phone" style={{ fontSize: 11, color: '#3ecf8e' }}></i>
                                        <span style={{ fontSize: 11, color: '#3ecf8e', fontWeight: 700 }}>Call in progress</span>
                                        {!isInCall && (
                                          <button onClick={() => setActiveCall({ room_url: roomUrl, room_name: roomName, comm_id: activeCommId })}
                                            style={{ background: '#3ecf8e', border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#000', fontFamily: 'inherit' }}>
                                            Join
                                          </button>
                                        )}
                                        {isInCall && <span style={{ fontSize: 10, color: '#3ecf8e', opacity: 0.7 }}>You are in this call</span>}
                                      </div>
                                      <div style={{ flex: 1, height: 1, background: 'rgba(62,207,142,0.2)' }} />
                                    </div>
                                  );
                                }
                                if (body === 'CALL_ENDED') {
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px', margin: '2px 0' }}>
                                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 6px' }}>
                                        <i className="fa-solid fa-phone-slash" style={{ marginRight: 5 }}></i>Call ended
                                      </span>
                                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px', margin: '2px 0' }}>
                                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', padding: '0 6px' }}>{body}</span>
                                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                  </div>
                                );
                              })()
                            ) : (
                              <MessageItem
                                m={m}
                                tagColor={tagColor}
                                isOwnerMsg={isOwnerMsg}
                                canDelete={canDelete}
                                onDelete={async (id) => {
                                  if (!confirm('Delete this message?')) return;
                                  const msg = circleChatMessages.find(m => m.id === id);
                                  await deleteMediaFromStorage(msg?.media_url);
                                  await supabase.from('messages').delete().eq('id', id);
                                  setCircleChatMessages(prev => prev.filter(msg => msg.id !== id));
                                }}
                                onEdit={async (id, content) => {
                                  await supabase.from('messages').update({ content, edited: true }).eq('id', id);
                                  setCircleChatMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content, edited: true } : msg));
                                }}
                                currentStudentId={user?.student_id}
                                avatarUrl={avatarCache[m.sender_id] || null}
                                onViewProfile={viewUserProfile}
                                online={isOnline(profileIdCache[m.sender_id])}
                                readers={isLastMsg && isLastInGroup ? lastMsgReaders : []}
                                isLastOwn={isLastOwn}
                                isGrouped={isGrouped}
                                isLastInGroup={isLastInGroup}
                                userCustomizations={userCustomizations}
                                onReply={(msg) => setReplyTo(msg)}
                              />
                            )}
                          </React.Fragment>
                        );
                      });
                    })()
                  )}
                  <div ref={feedBottomRef} />
                </div>

                {isMember(activeCommId) && user?.is_verified && activeComm?.status !== 'pending' && (
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
                    <div className="c-input-wrap chat-input-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button onClick={() => setShowAttachMenu(v => !v)} disabled={uploading}
                          style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: showAttachMenu ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.05)', color: showAttachMenu ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s', transform: showAttachMenu ? 'rotate(45deg)' : 'none' }}>
                          <i className="fa-solid fa-plus" />
                        </button>
                        {showAttachMenu && (
                          <div style={{ position: 'absolute', bottom: 42, left: 0, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', zIndex: 400 }}>
                            <MediaUploadButton onMediaSelected={(m) => { setCirclePendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!circlePendingMedia} />
                            <VoiceRecorder onVoiceRecorded={(m) => { setCirclePendingMedia(m); setShowAttachMenu(false); }} disabled={uploading || !!circlePendingMedia} />
                          </div>
                        )}
                      </div>
                      <input ref={circleChatInputRef}
                        onChange={e => { handleChatInputChange(e.target.value); setShowAttachMenu(false); }}
                        placeholder={`Message ${activeComm.name}...`}
                        disabled={uploading}
                        style={{ flex: 1 }} />
                      {shoutoutSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 52, left: 0, right: 0, background: 'var(--card-bg,#1a1a2e)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 10, overflow: 'hidden', zIndex: 300, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
                          {shoutoutSuggestions.map(p => (
                            <div key={p.id} onMouseDown={e => { e.preventDefault(); selectShoutoutMention(p, circleChatInputRef); }}
                              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,240,255,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {p.id === 'everyone'
                                ? <><i className="fa-solid fa-users" style={{ color: 'var(--cyber-cyan)', width: 16 }}></i><span style={{ color: 'var(--cyber-cyan)', fontWeight: 700 }}>@everyone</span></>
                                : <><i className="fa-solid fa-user" style={{ color: 'var(--text-muted)', width: 16 }}></i><span>{p.full_name}</span></>}
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="chat-send-btn" onClick={sendCircleChatPost} disabled={uploading} title="Send">
                        <i className="fa-solid fa-paper-plane"></i>
                      </button>
                    </div>
                  </div>
                )}
                {showMembersPanel && (
                  <div style={{ width: 220, background: 'rgba(13,13,18,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: 'none', borderRadius: '0 0 15px 0', overflowY: 'auto', flexShrink: 0, padding: '14px 0' }}>
                    <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 10, color: 'var(--cyber-cyan)', letterSpacing: 2, fontWeight: 700 }}>MEMBERS - {circleChatMembers.length}</span><button onClick={() => setShowHierarchyHelp(true)} title='Role Hierarchy' style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}><i className='fa-solid fa-circle-question'></i></button></div>
                    {[
                      { label: 'ONLINE', filter: m => isOnline(m.id) },
                      { label: 'OFFLINE', filter: m => !isOnline(m.id) },
                    ].map(({ label, filter }) => {
                      const group = circleChatMembers.filter(filter);
                      if (!group.length) return null;
                      return (
                        <div key={label}>
                          <div style={{ padding: '8px 14px 4px', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, fontWeight: 700 }}>
                            {label} · {group.length}
                          </div>
                          {group.map(m => {
                            const memberStudentId = m.student_id || m.ctu_id;
                            const url = avatarCache[memberStudentId] || m.avatar_url;
                            const initials = (m.full_name || '?')[0].toUpperCase();
                            const rankLabels = ['', 'MOD', 'CO-LEAD', 'LEADER'];
                            return (
                              <div key={m.id} onClick={() => {
                                if (memberStudentId === user?.student_id || memberStudentId === String(user?.ctu_id)) {
                                  setShowProfile(true);
                                } else {
                                  viewUserProfile(memberStudentId);
                                }
                              }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', opacity: isOnline(m.id) ? 1 : 0.45, cursor: 'pointer' }}>
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
          viewerStudentId={user?.student_id}
          onSaved={(updated) => {
            setCommunities(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
            loadCommunities();
            showToast('SETTINGS_SAVED');
          }}
          onGivePoints={(member) => {
            setShowGivePoints({
              targetUser: {
                id: member.user_id,
                full_name: member.accounts?.full_name || 'Unknown',
                ctu_id: member.accounts?.ctu_id || '',
                avatar_url: member.accounts?.avatar_url || null
              }
            });
          }}
          onFlagUser={(member) => {
            setShowFlagUser({
              targetUser: {
                id: member.user_id,
                full_name: member.accounts?.full_name || 'Unknown',
                ctu_id: member.accounts?.ctu_id || '',
                avatar_url: member.accounts?.avatar_url || null
              }
            });
          }}
        />
      )}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCommCreated} userId={user?.id} />}

      {/* -- SUCCESSOR PICKER MODAL -- */}
      {successorPicker && (
        <div className="modal-overlay" onClick={() => setSuccessorPicker(null)}>
          <div className="auth-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '94vw', padding: '28px 28px 24px', borderRadius: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, color: 'var(--cyber-cyan)', marginBottom: 6 }}>
              <i className="fa-solid fa-crown" style={{ marginRight: 8 }} />TRANSFER LEADERSHIP
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              You must appoint a successor before leaving. Select a member to become the new Leader.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
              {successorPicker.members.map(m => (
                <button key={m.id} onClick={() => confirmLeaveWithSuccessor(successorPicker.commId, m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s, background 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,240,255,0.4)'; e.currentTarget.style.background = 'rgba(0,240,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--cyber-cyan)', flexShrink: 0 }}>
                    {m.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {m.rank_level === 2 ? '👑 Co-Leader' : m.rank_level === 1 ? '🛡️ Moderator' : '👤 Member'}
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 11 }} />
                </button>
              ))}
            </div>
            <button className="cyber-btn secondary" onClick={() => setSuccessorPicker(null)} style={{ width: '100%', fontSize: 12 }}>
              CANCEL
            </button>
          </div>
        </div>
      )}
      {showProfile && <ProfileModal user={user} communities={myCirclesForProfile} onUpdateUser={setCurrentUser} onShowToast={showToast} onClose={async () => { setShowProfile(false); if (user?.id) { const { data: s } = await supabase.from('user_profile_settings').select('active_companion').eq('user_id', user.id).maybeSingle(); if (s?.active_companion) { const { data: item } = await supabase.from('shop_items').select('css_data').eq('id', s.active_companion).single(); if (item?.css_data) { const d = typeof item.css_data === 'string' ? JSON.parse(item.css_data) : item.css_data; setNavCompanion(d?.url || null); } } else { setNavCompanion(null); } } }} onLogout={logout} onAvatarUpdate={(url) => setNavAvatarUrl(url)} currentAvatarUrl={navAvatarUrl} />}
      {viewingProfile && (
        <ProfileModal
          user={viewingProfile}
          communities={viewingProfile._circles || []}
          onClose={() => setViewingProfile(null)}
          onLogout={() => { }}
          onAvatarUpdate={() => { }}
          currentAvatarUrl={viewingProfile.avatar_url}
          onReport={(data) => setShowReport(data)}
          onCircleInfo={(c) => setShowCircleInfo(c)}
          currentUserId={user?.id}
          onShowToast={showToast}
          readOnly
        />
      )}
      {showApplicationForm && (
        <ApplicationApplicationForm
          comm={showApplicationForm.comm}
          Application={showApplicationForm.Application || null}
          appTitle={showApplicationForm.appTitle || null}
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
      {/* Circle Hierarchy Help Modal */}
      {showHierarchyHelp && (
        <div className='modal-overlay' onClick={() => setShowHierarchyHelp(false)}>
          <div className='modal-box' onClick={e => e.stopPropagation()} style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 14, color: 'var(--cyber-cyan)', letterSpacing: 1 }}><i className='fa-solid fa-shield-halved' style={{ marginRight: 8 }}></i>CIRCLE ROLE HIERARCHY</h3>
              <button onClick={() => setShowHierarchyHelp(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}><i className='fa-solid fa-xmark'></i></button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '75vh' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>Each role has a daily TP giving cap per recipient. You cannot give points upward (e.g. Member cannot give to Leader). 24-hour cooldown per person.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'rgba(0,240,255,0.08)' }}>
                  {['Role', 'Max', 'TP Given', 'Pool', 'Total'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--cyber-cyan)', fontWeight: 700, letterSpacing: 1, fontSize: 10, borderBottom: '1px solid rgba(0,240,255,0.2)' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    { role: 'Leader', color: 'var(--cyber-yellow)', icon: 'fa-solid fa-crown', max: '1', tp: 5, pool: 1, total: 6 },
                    { role: 'Co-Leader', color: 'var(--cyber-cyan)', icon: 'fa-solid fa-star', max: '2', tp: 4, pool: 1, total: 5 },
                    { role: 'Moderator', color: 'var(--green)', icon: 'fa-solid fa-shield', max: '3', tp: 3, pool: 1, total: 4 },
                    { role: 'Member', color: 'var(--text-muted)', icon: 'fa-solid fa-user', max: 'Unlimited', tp: 2, pool: 1, total: 3 },
                  ].map((r, i) => (
                    <tr key={r.role} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '10px 10px' }}><span style={{ color: r.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><i className={r.icon} style={{ fontSize: 11 }}></i>{r.role}</span></td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{r.max}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--cyber-yellow)', fontWeight: 700 }}>+{r.tp} TP</td>
                      <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>+{r.pool} TP</td>
                      <td style={{ padding: '10px 10px', color: 'var(--green)', fontWeight: 700 }}>{r.total} TP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--cyber-yellow)' }}>Rules:</strong><br />
                - Max column = max of that role per circle<br />
                - TP Given = points given to the recipient<br />
                - Pool = points added to the circle TP pool<br />
                - You cannot give TP to someone of higher rank<br />
                - 12-hour cooldown per recipient
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Center Modal */}
      {showHelp && (
        <HelpModal user={user} onClose={() => setShowHelp(false)} />
      )}

      {/* Circle Cover Crop Modal */}
      {pendingCircleCropFile && (
        <ImageCropModal
          file={pendingCircleCropFile}
          aspect={3}
          circular={false}
          outputW={900}
          outputH={300}
          onConfirm={async (croppedDataUrl) => {
            setPendingCircleCropFile(null);
            // Optimistically update UI
            setCommunities(prev => prev.map(c =>
              c.id === activeCommId ? { ...c, cover_url: croppedDataUrl } : c
            ));
            // Save via server
            let saved = false;
            try {
              const token = localStorage.getItem('accessToken');
              const serverRes = await fetch(getApiUrl('/api/upload'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ action: 'upload-cover', cover_url: croppedDataUrl, communityId: activeCommId }),
              });
              if (serverRes.ok) saved = true;
            } catch (err) { console.error('[circle cover crop]', err); }
            showToast(saved ? 'COVER_PHOTO_UPDATED' : 'UPLOAD_FAILED');
          }}
          onCancel={() => setPendingCircleCropFile(null)}
        />
      )}

      {/* Circle Info Card Modal */}
      {showCircleInfo && (<CircleInfoCard
        circle={showCircleInfo}
        memberCount={memberCounts[showCircleInfo.id] || 0}
        myMemberships={myMemberships}
        myApplications={myApplications}
        currentUser={user}
        onClose={() => setShowCircleInfo(null)}
        onEnter={(commId) => { setShowCircleInfo(null); navTo('circles', commId); }}
        onRequestJoin={async (commId) => { await requestJoin(commId); setShowCircleInfo(null); }}
        onApply={(comm) => { setShowCircleInfo(null); setShowApplicationForm({ comm }); }}
        onAcceptInvite={async (commId) => { await acceptInvite(commId); setShowCircleInfo(null); }}
        onDeclineInvite={async (commId) => { await declineInvite(commId); setShowCircleInfo(null); }}
        onLeave={async (commId) => { await leaveCircle(commId); setShowCircleInfo(null); }}
        onViewApplication={async (myApp, circle) => {
          const [rRes, aRes, qList] = await Promise.all([
            supabase.from('application_submissions').select('*').eq('id', myApp.id).single(),
            supabase.from('application_answers').select('question_id, answer_text').eq('submission_id', myApp.id),
            myApp.application_id ? fetchQuestionsWithOptions([myApp.application_id]) : Promise.resolve([]),
          ]);
          const answers = {};
          (aRes.data || []).forEach(ans => { answers[ans.question_id] = ans.answer_text; });
          setShowCircleInfo(null);
          setViewingApplication({ response: { ...(rRes.data || {}), answers }, community: circle, questions: qList });
        }}
        onViewLeaderProfile={viewUserProfile}
        onReport={(data) => setShowReport(data)}
      />
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <ThemePicker
          currentTheme={currentTheme}
          onClose={() => setShowThemePicker(false)}
          onThemeChange={(t) => setCurrentTheme(t)}
        />
      )}

      {/* Starting Call Loading Overlay */}
      {startingCall && !activeCall && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#0d0d12', border: '1px solid rgba(62,207,142,0.35)',
            borderRadius: 16, padding: '32px 40px', textAlign: 'center',
            boxShadow: '0 0 40px rgba(0,0,0,0.7)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(62,207,142,0.12)', border: '2px solid #3ecf8e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 22, color: '#3ecf8e',
            }}>
              <i className="fa-solid fa-phone fa-beat"></i>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              Connecting to {activeComm?.name || 'Circle'} call...
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Setting up voice & video room
            </div>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {activeCall && (
        <CallModal
          token={activeCall.token}
          livekitUrl={activeCall.livekit_url}
          circleName={communities.find(c => c.id === activeCall.comm_id)?.name || 'Circle'}
          currentUser={user}
          communityId={activeCall.comm_id}
          supabase={supabase}
          onClose={(isLast) => { endCall(isLast); }}
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
