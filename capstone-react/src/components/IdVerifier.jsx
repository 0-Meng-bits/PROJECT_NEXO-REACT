import { useState, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

// Common OCR misreads for digits - only allow letter-to-digit confusion, not digit-to-digit
const OCR_DIGIT_VARIANTS = {
  '0': ['0', 'O', 'o', 'Q', 'D'],
  '1': ['1', 'l', 'I', 'i', '|'],
  '2': ['2', 'Z', 'z'],
  '3': ['3'],
  '4': ['4'],
  '5': ['5', 'S', 's'],
  '6': ['6', 'b', 'G'],
  '7': ['7'],
  '8': ['8', 'B'],
  '9': ['9', 'g', 'q'],
};

// Build fuzzy variants for OCR text matching - only generates letter alternatives
function buildOcrVariants(ocrText) {
  // Create reverse map: OCR character -> possible actual digits
  const reverseMap = {};
  for (const [digit, variants] of Object.entries(OCR_DIGIT_VARIANTS)) {
    for (const variant of variants) {
      if (!reverseMap[variant]) reverseMap[variant] = [];
      reverseMap[variant].push(digit);
    }
  }

  // Build all possible interpretations of OCR text
  const chars = ocrText.split('');
  const possibilities = chars.map(ch => {
    const upper = ch.toUpperCase();
    return reverseMap[upper] || [upper];
  });

  // Generate all combinations (limit to prevent explosion)
  const variants = new Set();
  function generate(index, current) {
    if (index === chars.length) {
      variants.add(current);
      if (variants.size > 500) return; // safety limit
      return;
    }
    for (const option of possibilities[index]) {
      generate(index + 1, current + option);
      if (variants.size > 500) return;
    }
  }
  generate(0, '');
  return [...variants];
}

function extractIdFromText(text, typedId) {
  // Normalize OCR text and typed ID
  const ocrRaw = text.toUpperCase();
  const ocrStripped = ocrRaw.replace(/[\s\-\.]/g, '');
  const idClean = typedId.replace(/[\s\-\.]/g, '').toUpperCase();

  // 1. Direct exact match
  if (ocrStripped.includes(idClean)) return { found: true };

  // 2. Match with spaces/separators allowed between digits (OCR sometimes inserts spaces)
  const spacedPattern = idClean.split('').join('[\\s\\-\\.]*');
  if (new RegExp(spacedPattern).test(ocrRaw)) return { found: true };

  // 3. Strip everything except alphanumeric and check again
  // Handles cases like "1 No.8230582" where noise prefixes the number
  const ocrAlphaNum = ocrRaw.replace(/[^A-Z0-9]/g, '');
  if (ocrAlphaNum.includes(idClean)) return { found: true };

  // 4. Fuzzy match — generate all possible interpretations of OCR text
  const ocrVariants = buildOcrVariants(ocrStripped);
  if (ocrVariants.includes(idClean)) return { found: true };

  // Also check with spaces in OCR text
  const ocrWords = ocrRaw.match(/\S+/g) || [];
  for (const word of ocrWords) {
    const wordStripped = word.replace(/[\s\-\.]/g, '');
    const wordVariants = buildOcrVariants(wordStripped);
    if (wordVariants.includes(idClean)) return { found: true };
  }

  // 5. Check each line's digit-only sequence against the ID
  // Handles "1 No.8230582" → digits only → "18230582" which contains "8230582"
  const lines = ocrRaw.split(/\n/);
  for (const line of lines) {
    const digitsOnly = line.replace(/[^0-9]/g, '');
    if (digitsOnly.includes(idClean.replace(/[^0-9]/g, ''))) return { found: true };
  }

  return { found: false };
}
// Preprocess image on canvas to improve OCR accuracy:
// - Optionally crop to bottom portion (cropRatio=0.4 means bottom 40%)
// - Upscale to target size, adaptive threshold binarization
async function preprocessImage(imageFile, cropRatio = 1) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      const srcY = Math.floor(img.height * (1 - cropRatio));
      const srcH = img.height - srcY;
      // Use lower target for crop pass (faster), higher for full image pass
      const targetSize = cropRatio < 1 ? 1600 : 2000;
      const scale = Math.max(1, targetSize / Math.max(img.width, srcH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(srcH * scale);
      const ctx = canvas.getContext('2d');

      // Draw only the cropped region, scaled
      ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, canvas.width, canvas.height);

      // Step 1: Convert to grayscale
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) {
        gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
      }

      // Step 2: Adaptive threshold (integral image method)
      // Each pixel is compared to the mean of its surrounding block minus a constant C
      // This handles uneven lighting and gradient backgrounds (like yellow-to-green IDs)
      const blockSize = Math.round(Math.min(w, h) * 0.05) | 1; // ~5% of smaller dimension, must be odd
      const C = 10; // subtract from local mean — tune this to make text pop

      // Build integral image for fast block sums
      const integral = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          integral[(y + 1) * (w + 1) + (x + 1)] =
            gray[y * w + x]
            + integral[y * (w + 1) + (x + 1)]
            + integral[(y + 1) * (w + 1) + x]
            - integral[y * (w + 1) + x];
        }
      }

      const half = Math.floor(blockSize / 2);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x - half);
          const y1 = Math.max(0, y - half);
          const x2 = Math.min(w - 1, x + half);
          const y2 = Math.min(h - 1, y + half);
          const count = (x2 - x1 + 1) * (y2 - y1 + 1);
          const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
            - integral[y1 * (w + 1) + (x2 + 1)]
            - integral[(y2 + 1) * (w + 1) + x1]
            + integral[y1 * (w + 1) + x1];
          const localMean = sum / count;
          const binary = gray[y * w + x] < localMean - C ? 0 : 255;
          const idx = (y * w + x) * 4;
          data[idx] = data[idx + 1] = data[idx + 2] = binary;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'processed.png', { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(imageFile); // fallback to original
    };
    img.src = url;
  });
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
  const scanningRef = useRef(false); // prevent double-trigger on mobile camera return

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        // video element not mounted yet, wait for next tick
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 50);
      }
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
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .-',
        tessedit_pageseg_mode: '11',
      });

      // Pass 1: crop to bottom 40% where ID number lives on CTU IDs
      const croppedFile = await preprocessImage(imageFile, 0.4);
      const { data: { text: croppedText } } = await worker.recognize(croppedFile);
      console.log('[OCR] Cropped pass:', croppedText);

      let result = extractIdFromText(croppedText, ctuId);

      // Pass 2: only if crop pass failed — try full image
      if (!result.found) {
        setProgress(0);
        const fullFile = await preprocessImage(imageFile, 1);
        const { data: { text: fullText } } = await worker.recognize(fullFile);
        console.log('[OCR] Full image pass:', fullText);
        result = extractIdFromText(fullText, ctuId);
      }

      await worker.terminate();
      setResult(result);
      setStage('done');
    } catch (err) {
      console.error('OCR error:', err);
      setStage('error');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file || scanningRef.current) return;
    scanningRef.current = true;
    capturedFileRef.current = file;
    setPreview(URL.createObjectURL(file));
    runOCR(file);
  };

  const handleContinue = async () => {
    onVerified(result?.found || false, capturedFileRef.current || null);
  };

  const reset = () => {
    stopCamera();
    scanningRef.current = false;
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
            <button className="id-upload-btn camera" onClick={openCamera} type="button">
              <i className="fa-solid fa-camera" style={{ marginRight: 6 }} />
              Take Photo
            </button>
          </div>
        </div>
      )}

      {/* ── CAMERA (desktop) ── */}
      {stage === 'camera' && (
        <div className="id-camera-wrap">
          <div className="id-camera-frame">
            <video ref={videoRef} autoPlay playsInline muted className="id-camera-video" />
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
