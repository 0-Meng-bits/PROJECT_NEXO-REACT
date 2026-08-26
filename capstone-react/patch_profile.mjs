import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/UserPortal.jsx';
const src = readFileSync(file, 'utf8');

// Find start of ProfileModal function
const startMarker = 'function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl }) {';
const endMarker = 'function AuditionDetailModal(';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!', { startIdx, endIdx });
  process.exit(1);
}

console.log(`Replacing chars ${startIdx} to ${endIdx}`);

const newFunction = `function ProfileModal({ user, communities, onClose, onLogout, onAvatarUpdate, currentAvatarUrl }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || user.avatar_url || null);
  const [coverUrl, setCoverUrl] = useState(user.cover_url || null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const idPhotoRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [idUpload