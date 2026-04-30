import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '../lib/supabase';

function extractIdFromText(text, typedId) {
  const normalized = text.replace(/\s+/g, ' ').toUpperCase();
  const typedNorm = typedId.replace(/\s+/g, '').toUpperCase();
  const ocrClean = normalized.replace(/\s/g, '');
  if (ocrClean.includes(typedNorm)) return { found: true };
  const typedStripped = typedNorm.replace(/[-\s]/g, '');
  const ocrStripped = ocrClean.replace(/[-\s]/g, '');
  if (ocrStripped.includes(typedStripped) && typedStripped.length >= 4) return { found: true };
  return { found: false };
}

// Upload photo to Supabase storage and return public URL
async function uploadIdPhoto(file, ctuId) {
  try {
    const ext = file.name?.split('.').pop() || 'jpg';
    const path = `id-photos/${ctuId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('id-photos')
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('id-photos').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export default function IdVerifier({ ctuId, onVerified }) {
  const [stage, setStage] = useState('idle'); // idle | camera | scanning | done | error
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const capturedFileRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = async () => {
    setCameraError(null);
    setStage('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setCameraError('Camera access denied. Please upload a photo instead.');
      setStage('idle');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    stopCamera();
    canvas.toBlob((blob) => {
      const file = new File([blob], 'id-capture.jpg', { type: 'image/jpeg' });
      capturedFileRef.current = file;
      setPreview(URL.createObjectURL(blob));
      runOCR(file);
    }, 'image/jpeg', 0.95);
  };

  const runOCR = async (imageFile) => {
    setStage('scanning');
    setProgress(0);
    setResult(null);
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      setResult(extractIdFromText(text, ctuId));
      setStage('done');
    } catch (err) {
      console.error('OCR error:', err);
      setStage('error');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    capturedFileRef.current = file;
    setPreview(URL.createObjectURL(file));
    runOCR(file);
  };

  const handleContinue = async () => {
    setUploading(true);
    const photoUrl = capturedFileRef.current
      ? await uploadIdPhoto(capturedFileRef.current, ctuId)
      : null;
    setUploading(false);
    onVerified(result?.found || false, photoUrl);
  };

  const reset = () => {
    stopCamera();
    setStage('idle');
    setPreview(null);
    setResult(null);
    setProgress(0);
    setCameraError(null);
    capturedFileRef.current = null;
    if (fileRef.current) fileRef.current.value = '';
  };

  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  return (
    <div className="id-verifier">
      <div className="id-verifier-header">
        <i className="fa-solid fa-id-card" style={{ color: 'var(--cyber-cyan)', marginRight: 8 }} />
        <div>
          <div className="id-verifier-title">School ID Verification</div>
          <div className="id-verifier-sub">
            Upload a photo of your CTU school ID so the admin can verify you're a real student
          </div>
        </div>
      </div>

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <div className="id-upload-area">
          <i className="fa-solid fa-id-card" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Make sure your <strong style={{ color: 'white' }}>CTU ID number</strong> is clearly visible
          </p>
          <p style={{ fontSize: 11, color: 'var(--cyber-yellow)', marginBottom: 16, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
            Required — admin needs this to confirm your identity
          </p>
          {cameraError && (
            <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 12, textAlign: 'center' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />
              {cameraError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <label className="id-upload-btn" htmlFor="id-file-upload">
              <i className="fa-solid fa-upload" style={{ marginRight: 6 }} />
              Upload Photo
              <input id="id-file-upload" ref={fileRef} type="file"
                accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            {isMobile ? (
              <label className="id-upload-btn camera" htmlFor="id-camera-mobile">
                <i className="fa-solid fa-camera" style={{ marginRight: 6 }} />
                Take Photo
                <input id="id-camera-mobile" type="file" accept="image/*"
                  capture="environment" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            ) : (
              <button className="id-upload-btn camera" onClick={openCamera} type="button">
                <i className="fa-solid fa-camera" style={{ marginRight: 6 }} />
                Take Photo
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CAMERA (desktop) ── */}
      {stage === 'camera' && (
        <div className="id-camera-wrap">
          <div className="id-camera-frame">
            <video ref={videoRef} autoPlay playsInline muted className="id-camera-video" />
            <div className="id-camera-overlay">
              <div className="id-camera-guide"><span>Align your ID within the frame</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="cyber-btn" onClick={capturePhoto} type="button" style={{ flex: 1 }}>
              <i className="fa-solid fa-camera" style={{ marginRight: 6 }} />Capture
            </button>
            <button className="cyber-btn secondary" onClick={reset} type="button" style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── SCANNING / DONE / ERROR ── */}
      {(stage === 'scanning' || stage === 'done' || stage === 'error') && (
        <div className="id-scan-area">
          {preview && (
            <div className="id-preview-wrap">
              <img src={preview} alt="ID preview" className="id-preview-img" />
              {stage === 'scanning' && <div className="id-scan-line" />}
            </div>
          )}

          {stage === 'scanning' && (
            <div className="id-progress-wrap">
              <div className="id-progress-bar">
                <div className="id-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="id-progress-label">
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
                Reading ID... {progress}%
              </p>
            </div>
          )}

          {stage === 'done' && result && (
            <div className={`id-result ${result.found ? 'success' : 'fail'}`}>
              {result.found ? (
                <>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 24, marginBottom: 8 }} />
                  <div className="id-result-title">ID Match Found!</div>
                  <div className="id-result-sub">
                    CTU ID <strong>{ctuId}</strong> was detected in your photo.
                    Your photo will be sent to the admin for final approval.
                  </div>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, marginBottom: 8 }} />
                  <div className="id-result-title">Could Not Read ID</div>
                  <div className="id-result-sub">
                    The system couldn't detect <strong>{ctuId}</strong> in the photo.
                    You can still continue — the admin will verify your ID manually from the photo.
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, width: '100%' }}>
                <button className="cyber-btn secondary" onClick={reset} type="button" style={{ flex: 1 }}>
                  <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }} />
                  Retake
                </button>
                <button className="cyber-btn" onClick={handleContinue} type="button"
                  style={{ flex: 1 }} disabled={uploading}>
                  {uploading
                    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Uploading...</>
                    : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Submit</>
                  }
                </button>
              </div>
            </div>
          )}

          {stage === 'error' && (
            <div className="id-result fail">
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, marginBottom: 8 }} />
              <div className="id-result-title">Scan Failed</div>
              <div className="id-result-sub">Could not read the image. Try a clearer photo.</div>
              <button className="cyber-btn secondary" onClick={reset} type="button"
                style={{ marginTop: 14, width: '100%' }}>Try Again</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
