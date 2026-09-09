// Media message upload and preview components
import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_VOICE_SIZE = 10 * 1024 * 1024; // 10 MB

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

export function MediaUploadButton({ onMediaSelected, disabled }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine media type
    let mediaType, maxSize, allowedTypes;
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      mediaType = 'image';
      maxSize = MAX_IMAGE_SIZE;
      allowedTypes = ALLOWED_IMAGE_TYPES;
    } else if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
      mediaType = 'video';
      maxSize = MAX_VIDEO_SIZE;
      allowedTypes = ALLOWED_VIDEO_TYPES;
    } else {
      alert('Unsupported file type. Please upload an image or video.');
      return;
    }

    // Check file size
    if (file.size > maxSize) {
      const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      alert(`File too large. Maximum ${sizeMB}MB for ${mediaType}s. For larger files, share via YouTube, Google Drive, or Dropbox.`);
      return;
    }

    // Pass to parent
    onMediaSelected({ file, mediaType });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="chat-action-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title="Attach image or video"
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <i className="fa-solid fa-paperclip"></i>
      </button>
    </>
  );
}

export function VoiceRecorder({ onVoiceRecorded, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_VOICE_SIZE) {
          alert(`Voice message too large. Maximum ${(MAX_VOICE_SIZE / (1024 * 1024)).toFixed(0)}MB.`);
          return;
        }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        onVoiceRecorded({ file, mediaType: 'voice', duration: recordingTime });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Could not access microphone. Please allow microphone access.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <button
      className="chat-action-btn"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      title={isRecording ? 'Stop recording' : 'Record voice message'}
      style={{
        opacity: disabled ? 0.5 : 1,
        color: isRecording ? 'var(--red)' : 'inherit',
        animation: isRecording ? 'pulse 1.5s infinite' : 'none'
      }}
    >
      {isRecording ? (
        <>
          <i className="fa-solid fa-stop"></i>
          <span style={{ fontSize: 10, marginLeft: 4 }}>{recordingTime}s</span>
        </>
      ) : (
        <i className="fa-solid fa-microphone"></i>
      )}
    </button>
  );
}

export function MediaPreview({ file, mediaType, onCancel }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useState(() => {
    if (file && (mediaType === 'image' || mediaType === 'video')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, mediaType]);

  return (
    <div style={{
      padding: 12,
      background: 'var(--bg-card)',
      borderRadius: 8,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: '1px solid rgba(0,240,255,0.2)'
    }}>
      {mediaType === 'image' && previewUrl && (
        <img src={previewUrl} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
      )}
      {mediaType === 'video' && previewUrl && (
        <video src={previewUrl} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
      )}
      {mediaType === 'voice' && (
        <div style={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,240,255,0.1)', borderRadius: 4 }}>
          <i className="fa-solid fa-microphone" style={{ fontSize: 24, color: 'var(--cyber-cyan)' }}></i>
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{file.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </div>
      </div>
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--red)',
          cursor: 'pointer',
          fontSize: 18
        }}
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}

export async function uploadMediaFile(file, userId, mediaType) {
  // Compress image before upload if it's an image
  let fileToUpload = file;
  
  if (file.type.startsWith('image/')) {
    // Compress images to reduce size
    fileToUpload = await compressImage(file, 1920, 0.8); // Max 1920px width, 80% quality
  }

  // Convert file to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        
        // Upload via backend API
        const res = await fetch(getApiUrl('/api/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload-media',
            userId,
            fileData: base64Data,
            fileName: file.name,
            contentType: file.type
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        
        resolve(data.url);
      } catch (error) {
        console.error('Upload error:', error);
        reject(new Error('Failed to upload file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(fileToUpload);
  });
}

// Helper function to compress images
async function compressImage(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: file.type }));
        }, file.type, quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function MediaMessage({ message }) {
  const { message_type, media_url, content, media_duration } = message;

  if (message_type === 'image') {
    return (
      <div>
        <img 
          src={media_url} 
          alt="Shared image" 
          style={{ 
            maxWidth: '100%', 
            maxHeight: 300, 
            borderRadius: 8, 
            cursor: 'pointer',
            display: 'block'
          }}
          onClick={() => window.open(media_url, '_blank')}
        />
        {content && <div style={{ marginTop: 8 }}>{content}</div>}
      </div>
    );
  }

  if (message_type === 'video') {
    return (
      <div>
        <video 
          src={media_url} 
          controls 
          style={{ 
            maxWidth: '100%', 
            maxHeight: 300, 
            borderRadius: 8,
            display: 'block'
          }}
        />
        {content && <div style={{ marginTop: 8 }}>{content}</div>}
      </div>
    );
  }

  if (message_type === 'voice') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <audio 
          src={media_url} 
          controls 
          style={{ flex: 1, height: 32 }}
        />
        {media_duration && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {Math.floor(media_duration / 60)}:{(media_duration % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
    );
  }

  return <div>{content}</div>;
}
