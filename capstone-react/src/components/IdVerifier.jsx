import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

function extractIdFromText(text, typedId) {
  const ocrDigits = text.replace(/\D/g, '');
  const typedDigits = typedId.replace(/\D/g, '');
  if (typedDigits.length < 4) return { found: false };
  if (ocrDigits.includes(typedDigits)) return { found: true };
  // Fuzzy: allow 1 digit off
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

// ── CROP TOOL ────────────────────────────────────────────────────────────────
function CropTool({ imageSrc, onCrop, onSkip }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [rect, setRect] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Draw image + selection rect on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect) {
      // Dim outside selection
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, canvas.width, rect.y);
      ctx.fillRect(0, rect.y + rect.h, canvas.width, canvas.height - rect.y - rect.h);
      ctx.fillRect(0, rect.y, rect.x, rect.h);
      ctx.fillRect(rect.x + rect.w, rect.y, canvas.width - rect.x - rect.w, rect.h);
      // Selection border
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
      // Corner handles
      const hs = 8;
      ctx.fillStyle = '#00f0ff';
      [[rect.x, rect.y], [rect.x + rect.w, rect.y],
       [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]].forEach(([cx, cy]) => {
        ctx.fillRect(cx - hs/2, cy - hs/2, hs, hs);
      });
    }
  }, [rect, imgLoaded]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - bounds.left) * scaleX,
      y: (clientY - bounds.top) * scaleY,
    };
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    setDragging(true);
    setStart(pos);
    setRect(null);
  };

  const onMouseMove = (e) => {
    if (!dragging || !start) return;
    e.preventDefault();
    const pos = getPos(e);
    setRect({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: Math.abs(pos.x - start.x),
      h: Math.abs(pos.y - start.y),
    });
  };

  const onMouseUp = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleCrop = () => {
    if (!rect || rect.w < 20 || rect.h < 10) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    // Scale rect back to original image dimensions
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const cropCanvas = document.createElement('canvas');
    // Upscale crop 3x for better OCR
    const scale = 3;
    cropCanvas.width = rect.w * scaleX * scale;
    cropCanvas.height = rect.h * scaleY * scale;
    const ctx = cropCanvas.getContext('2d');
    // Grayscale + contrast on the cropped region
    ctx.drawImage(img,
      rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY,
      0, 0, cropCanvas.width, cropCanvas.height
    );
    // Enhance contrast
    const imageData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const contrast = 2.2;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
      data[i] = data[i+1] = data[i+2] = adjusted;
    }
    ctx.putImageData(imageData, 0, 0);
    cropCanvas.toBlob((blob) => {
      onCrop(new File([blob], 'id-crop.png', { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--cyber-cyan)', textAlign: 'center', fontWeight: 700 }}>
        <i className="fa-solid fa-crop-simple" style={{ marginRight: 6 }} />
        Drag to select the area containing your ID number
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: -6 }}>
        Select only the row with your 7-digit ID number for best accuracy
      </p>
      <div style={{ position: 'relative', cursor: 'crosshair', borderRadius: 8, overflow: 'hidden', border: '2px solid rgba(0,240,255,0.3)' }}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt="ID"
          style={{ display: 'none' }}
          onLoad={() => {
            const img = imgRef.current;
            const canvas = canvasRef.current;
            if (!canvas || !img) return;
            // Fit to max 480px wide
            const maxW = 480;
            const ratio = img.naturalHeight / img.naturalWidth;
            canvas.width = Math.min(img.naturalWidth, maxW);
            canvas.height = canvas.width * ratio;
            setImgLoaded(true);
          }}
        />
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cyber-btn secondary" onClick={onSkip} type="button" style={{ flex: 1 }}>
          <i className="fa-solid fa-forward" style={{ marginRight: 6 }} />Skip Crop
        </button>
        <button className="cyber-btn" onClick={handleCrop} type="button" style={{ flex: 1 }}
          disabled={!rect || rect.w < 20}>
          <i className="fa-solid fa-magnifying-glass" style={{ marginRight: 6 }} />Scan Selection
        </button>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function IdVerifier({ ctuId, onVerified }) {
  // stages: idle | camera | crop | scanning | done | error
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const capturedFileRef = useRef(null);   // full original file
  const cropFileRef = useRef(null);       // cropped region file

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
      const url = URL.createObjectURL(blob);
      setPreview(url);
      setStage('crop');
    }, 'image/jpeg', 0.95);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    capturedFileRef.current = file;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStage('crop');
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
      // PSM 7 = single text line — best for a cropped ID number row
      await worker.setParameters({
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: '0123456789',
      });
      const { data: { text } } = await worker.recognize(imageFile);
      await worker.terminate();
      console.log('[OCR] Raw text:', JSON.stringify(text));
      const match = extractIdFromText(text, ctuId);
      setResult(match);
      setStage('done');
    } catch (err) {
      console.error('OCR error:', err);
      setStage('error');
    }
  };

  const handleCropDone = (croppedFile) => {
    cropFileRef.current = croppedFile;
    runOCR(croppedFile);
  };

  const handleSkipCrop = () => {
    // Scan the full image without cropping
    cropFileRef.current = capturedFileRef.current;
    runOCR(capturedFileRef.current);
  };

  const handleContinue = () => {
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
    cropFileRef.current = null;
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
            Upload your CTU school ID — you'll crop the ID number area for accurate scanning
          </div>
        </div>
      </div>

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <div className="id-upload-area">
          <i className="fa-solid fa-id-card" style={{ fontSize: 32, color: 'var(--text-muted)', marginBottom: 10 }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Upload a clear photo of your CTU school ID
          </p>
          <p style={{ fontSize: 11, color: 'var(--cyber-yellow)', marginBottom: 16, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
            You'll be able to crop the ID number area before scanning
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

      {/* ── CAMERA ── */}
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

      {/* ── CROP ── */}
      {stage === 'crop' && preview && (
        <CropTool
          imageSrc={preview}
          onCrop={handleCropDone}
          onSkip={handleSkipCrop}
        />
      )}

      {/* ── SCANNING ── */}
      {stage === 'scanning' && (
        <div className="id-scan-area">
          {preview && (
            <div className="id-preview-wrap">
              <img src={preview} alt="ID preview" className="id-preview-img" />
              <div className="id-scan-line" />
            </div>
          )}
          <div className="id-progress-wrap">
            <div className="id-progress-bar">
              <div className="id-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="id-progress-label">
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />
              Scanning ID number... {progress}%
            </p>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && result && (
        <div className="id-scan-area">
          {preview && (
            <div className="id-preview-wrap">
              <img src={preview} alt="ID preview" className="id-preview-img" />
            </div>
          )}
          <div className={`id-result ${result.found ? 'success' : 'fail'}`}>
            {result.found ? (
              <>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 24, marginBottom: 8 }} />
                <div className="id-result-title">ID Number Detected!</div>
                <div className="id-result-sub">
                  ID <strong>{ctuId}</strong> was found in your photo.
                  Your ID will be sent to the admin for final approval.
                </div>
              </>
            ) : (
              <>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, marginBottom: 8 }} />
                <div className="id-result-title">Could Not Read ID Number</div>
                <div className="id-result-sub">
                  The scanner couldn't detect <strong>{ctuId}</strong>. Try cropping more precisely
                  around just the ID number row, or retake with better lighting.
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, width: '100%' }}>
              <button className="cyber-btn secondary" onClick={() => setStage('crop')} type="button" style={{ flex: 1 }}>
                <i className="fa-solid fa-crop-simple" style={{ marginRight: 6 }} />Re-crop
              </button>
              <button className="cyber-btn secondary" onClick={reset} type="button" style={{ flex: 1 }}>
                <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }} />Retake
              </button>
              {result.found && (
                <button className="cyber-btn" onClick={handleContinue} type="button" style={{ flex: 1 }}>
                  <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {stage === 'error' && (
        <div className="id-scan-area">
          <div className="id-result fail">
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 24, marginBottom: 8 }} />
            <div className="id-result-title">Scan Failed</div>
            <div className="id-result-sub">Could not process the image. Try a clearer photo.</div>
            <button className="cyber-btn secondary" onClick={reset} type="button"
              style={{ marginTop: 14, width: '100%' }}>Try Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
