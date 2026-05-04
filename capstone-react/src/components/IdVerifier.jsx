import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

function extractIdFromText(text, typedId) {
  // Remove all non-digit characters from both OCR text and typed ID
  const ocrDigits = text.replace(/\D/g, '');
  const typedDigits = typedId.replace(/\D/g, '');

  if (typedDigits.length < 4) return { found: false };

  // Check if the typed ID digits appear anywhere in the OCR output
  if (ocrDigits.includes(typedDigits)) return { found: true };

  // Fuzzy: allow 1 digit difference for OCR misread (e.g. 0 vs O, 1 vs I)
  // Check all substrings of same length
  for (let i = 0; i <= ocrDigits.length - typedDigits.length; i++) {
    const chunk = ocrDigits.substring(i, i + typedDigits.length);
    let diff = 0;
    for (let j = 0; j < typedDigits.length; j++) {
      if (chunk[j] !== typedDigits[j]) diff++;
    }
    if (diff <= 1) return { found: true };
  }

  return { found: false };
}

export default function IdVerifier({ ctuId, onVerified }) {
  const [stage, setStage] = useState('idle'); // idle | camera | scanning | done | error
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
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
      if (!blob) { setCameraError('Capture failed. Try uploading a photo instead.'); setStage('idle'); return; }
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
      // Preprocess image: boost contrast, convert to grayscale, upscale
      const preprocessed = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.onload = () => {
          URL.revokeObjectURL(url);
          // Upscale to at least 1600px wide for better OCR accuracy
          const scale = Math.max(1, 1600 / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          // Draw original
          ctx.drawImage(img, 0, 0, w, h);

          // Apply grayscale + contrast boost via pixel manipulation
          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Grayscale
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            // Contrast stretch: push toward black or white
            const contrast = 1.8;
            const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
            const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
            data[i] = data[i+1] = data[i+2] = adjusted;
          }
          ctx.putImageData(imageData, 0, 0);

          canvas.toBlob((blob) => resolve(blob), 'image/png');
        };
        img.onerror = () => resolve(imageFile); // fallback to original
        img.src = url;
      });

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });

      // Configure Tesseract for ID card reading:
      // PSM 6 = assume a single uniform block of text
      // Whitelist alphanumeric + dash + space for CTU ID format
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: '0123456789 ',
      });

      const { data: { text } } = await worker.recognize(preprocessed);
      await worker.terminate();

      console.log('[OCR] Raw text:', text);
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
    onVerified(result?.found || false, capturedFileRef.current || null);
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
                  style={{ flex: 1 }}>
                  <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Submit
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
