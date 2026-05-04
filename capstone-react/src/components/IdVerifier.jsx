import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

function extractIdFromText(text, typedId) {
  // Noise filter — if OCR text is too short, it's a blank/dark image
  if (text.trim().length < 8) return { found: false };

  const normalized = text.replace(/\s+/g, ' ').toUpperCase();
  const typedNorm = typedId.replace(/\s+/g, '').toUpperCase();
  const ocrClean = normalized.replace(/\s/g, '');

  // Direct match
  if (ocrClean.includes(typedNorm)) return { found: true };

  const typedStripped = typedNorm.replace(/[-\s]/g, '');
  const ocrStripped = ocrClean.replace(/[-\s]/g, '');

  // Direct stripped match
  if (ocrStripped.includes(typedStripped) && typedStripped.length >= 5) return { found: true };

  // OCR confusion: B↔8, O↔0, I↔1, S↔5, Z↔2, 6↔8
  const normalize = (s) => s
    .replace(/B/g, '8').replace(/O/g, '0').replace(/I/g, '1')
    .replace(/S/g, '5').replace(/Z/g, '2').replace(/G/g, '6')
    .replace(/6/g, '8') // 6 and 8 look similar in OCR
    .replace(/\s/g, '');

  const typedNormalized = normalize(typedStripped);
  const ocrNormalized = normalize(ocrStripped);
  if (ocrNormalized.includes(typedNormalized) && typedNormalized.length >= 5) return { found: true };

  // Also try matching with 8→6 substitution (in case typed is 8 but OCR reads 6)
  const typedWith6 = typedStripped.replace(/8/g, '6');
  if (ocrStripped.includes(typedWith6) && typedWith6.length >= 5) return { found: true };

  // Try last 6 digits match (OCR sometimes misses first digit)
  if (typedStripped.length >= 6) {
    const last6 = typedStripped.slice(-6);
    const last6with6 = last6.replace(/8/g, '6');
    if (ocrStripped.includes(last6) || ocrStripped.includes(last6with6) || ocrNormalized.includes(normalize(last6))) return { found: true };
  }

  // Try first 5 digits match (OCR sometimes misses last digits)
  if (typedStripped.length >= 5) {
    const first5 = typedStripped.slice(0, 5);
    const first5with6 = first5.replace(/8/g, '6');
    const first5norm = normalize(first5);
    if (ocrStripped.includes(first5) || ocrStripped.includes(first5with6) || ocrNormalized.includes(first5norm)) return { found: true };
  }

  // Try any 4 consecutive digits match as last resort
  if (typedStripped.length >= 4) {
    for (let i = 0; i <= typedStripped.length - 4; i++) {
      const chunk = typedStripped.slice(i, i + 4);
      const chunkWith6 = chunk.replace(/8/g, '6');
      const chunkNorm = normalize(chunk);
      if (ocrStripped.includes(chunk) || ocrStripped.includes(chunkWith6) || ocrNormalized.includes(chunkNorm)) return { found: true };
    }
  }

  // Try sliding window — check if any 5-digit substring of the ID appears in OCR
  if (typedStripped.length >= 5) {
    for (let i = 0; i <= typedStripped.length - 5; i++) {
      const chunk = typedStripped.slice(i, i + 5);
      const chunkWith6 = chunk.replace(/8/g, '6');
      const chunkWith8 = chunk.replace(/6/g, '8');
      if (ocrStripped.includes(chunk) || ocrStripped.includes(chunkWith6) || ocrStripped.includes(chunkWith8) || ocrNormalized.includes(normalize(chunk))) {
        return { found: true };
      }
    }
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
      // Helper: apply contrast + grayscale to a canvas context
      const applyContrast = (ctx, w, h) => {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
          const factor = (259 * (1.5 * 255 + 255)) / (255 * (259 - 1.5 * 255));
          const val = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
          data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
      };

      // Load image once
      const img = await new Promise((resolve) => {
        const i = new Image();
        const url = URL.createObjectURL(imageFile);
        i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
        i.src = url;
      });

      // PASS 1: Full image → check for CTU keywords
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = img.width; fullCanvas.height = img.height;
      const fullCtx = fullCanvas.getContext('2d');
      fullCtx.drawImage(img, 0, 0);
      applyContrast(fullCtx, img.width, img.height);
      const fullBlob = await new Promise(r => fullCanvas.toBlob(r, 'image/jpeg', 0.9));

      // PASS 2: Cropped bottom 55% → check for ID number
      const cropTop = Math.floor(img.height * 0.45);
      const cropH = img.height - cropTop;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = img.width; cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(img, 0, cropTop, img.width, cropH, 0, 0, img.width, cropH);
      applyContrast(cropCtx, img.width, cropH);
      const cropBlob = await new Promise(r => cropCanvas.toBlob(r, 'image/jpeg', 0.9));

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });

      // Run full image OCR for CTU keywords
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const { data: { text: fullText } } = await worker.recognize(fullBlob);

      // Run cropped OCR for ID number (multiple passes)
      const cropResults = [];
      for (const psm of ['6', '11', '3']) {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-:',
          tessedit_pageseg_mode: psm,
        });
        const { data: { text } } = await worker.recognize(cropBlob);
        cropResults.push(text);
      }
      await worker.terminate();

      // Check CTU keywords in full image
      const fullUpper = fullText.toUpperCase().replace(/\s+/g, ' ');
      const CTU_KEYWORDS = ['CEBU TECHNOLOGICAL', 'CTU', 'BSIT', 'BSCS', 'BSCE', 'BSED', 'BSBA', 'BSHM', 'BSMT', 'BSME', 'BSEE', 'BSIE'];
      const isCTU = CTU_KEYWORDS.some(kw => fullUpper.includes(kw));

      // Check ID number in cropped image
      const combinedCrop = cropResults.join(' ');
      const idMatch = extractIdFromText(combinedCrop, ctuId);

      setResult({ found: idMatch.found, isCTU });
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
          {/* ID positioning guide */}
          <div style={{
            width: '100%', maxWidth: 320, height: 180,
            border: '2px dashed var(--cyber-cyan)',
            borderRadius: 10, margin: '0 auto 14px',
            position: 'relative', background: 'rgba(0,240,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 6,
          }}>
            {/* Corner guides */}
            {[
              { top: 6, left: 6, borderTop: '3px solid var(--cyber-cyan)', borderLeft: '3px solid var(--cyber-cyan)' },
              { top: 6, right: 6, borderTop: '3px solid var(--cyber-cyan)', borderRight: '3px solid var(--cyber-cyan)' },
              { bottom: 6, left: 6, borderBottom: '3px solid var(--cyber-cyan)', borderLeft: '3px solid var(--cyber-cyan)' },
              { bottom: 6, right: 6, borderBottom: '3px solid var(--cyber-cyan)', borderRight: '3px solid var(--cyber-cyan)' },
            ].map((style, i) => (
              <div key={i} style={{ position: 'absolute', width: 18, height: 18, borderRadius: 2, ...style }} />
            ))}
            <i className="fa-solid fa-id-card" style={{ fontSize: 36, color: 'rgba(0,240,255,0.3)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '0 16px' }}>
              Show the <strong style={{ color: 'white' }}>full ID card</strong> — hold it close so the ID number is readable
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)', marginRight: 5 }} />
            Full card visible, held close, well-lit, flat
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--red)', marginRight: 5 }} />
            Too far away — ID number won't be readable
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--red)', marginRight: 5 }} />
            Too zoomed in — admin needs to see the full card
          </div>

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
              <div className="id-camera-guide">
                <span>Align ID flat and horizontal within the frame</span>
              </div>
              {/* Bottom crop indicator */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: '55%', border: '2px solid rgba(0,240,255,0.6)',
                borderTop: '2px dashed var(--cyber-cyan)',
                pointerEvents: 'none',
              }}>
                <span style={{
                  position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: 'var(--cyber-cyan)', background: 'rgba(0,0,0,0.7)',
                  padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                }}>
                  Name & ID area — keep this zone clear
                </span>
              </div>
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
                    {result.isCTU && <span style={{ color: 'var(--green)', display: 'block', marginTop: 4 }}>✓ CTU ID card verified</span>}
                    Your photo will be sent to the admin for final approval.
                  </div>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, marginBottom: 8 }} />
                  <div className="id-result-title">Could Not Read ID</div>
                  <div className="id-result-sub">
                    {!result.isCTU && (
                      <span style={{ color: 'var(--orange)', display: 'block', marginBottom: 6 }}>
                        ⚠ CTU ID card not detected — make sure you're using your CTU school ID
                      </span>
                    )}
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
