import React, { useRef, useState, useEffect } from 'react';

const SnapVibe = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState('photo');
  const [theme, setTheme] = useState('light');
  const [cameraReady, setCameraReady] = useState(false);
  const [filterEffect, setFilterEffect] = useState('normal');
  const [cameraError, setCameraError] = useState(null);

  // Available filter effects
  const filters = {
    normal: "Normal",
    grayscale: "Noir",
    sepia: "Vintage",
    saturate: "Vibrant",
    invert: "Negative"
  };

  // Load from localStorage
  useEffect(() => {
    const savedPhotos = JSON.parse(localStorage.getItem('photos') || '[]');
    const savedVideos = JSON.parse(localStorage.getItem('videos') || '[]');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    setPhotos(savedPhotos);
    setVideos(savedVideos);
    setTheme(savedTheme);
  }, []);

  // Apply theme effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Camera initialization with improved error handling
  const handleStartCamera = async () => {
    setCameraError(null); // Reset any previous errors
    
    try {
      // Try with default constraints first
      let mediaStream;
      
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      } catch (initialError) {
        console.log("Initial camera access failed, trying fallback options");
        
        // Try without audio
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          console.log("Camera accessed without audio");
        } catch (videoOnlyError) {
          // Try with explicit video constraints
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, 
              audio: false 
            });
            console.log("Camera accessed with explicit video constraints");
          } catch (constraintsError) {
            // One final attempt with environment camera
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "environment" }, 
              audio: false 
            });
            console.log("Accessed environment-facing camera");
          }
        }
      }
      
      if (!mediaStream) {
        throw new Error("Failed to initialize camera stream");
      }
      
      // Successfully accessed camera
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          console.log("Camera is ready");
        };
      }
      
      setStream(mediaStream);
      
    } catch (err) {
      console.error('Camera Access Error:', err);
      
      // Provide helpful error message based on the error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera access denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera found. Please connect a camera and try again.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError("Camera is already in use by another application. Please close other applications and try again.");
      } else if (err.name === 'OverconstrainedError') {
        setCameraError("Camera doesn't support the requested resolution. Try again with different settings.");
      } else {
        setCameraError(`Unable to access camera: ${err.message || 'Unknown error'}. Please check permissions and try again.`);
      }
    }
  };

  // Clean up camera resources when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [stream]);

  // Take photo with current filter effect
  const handleTakePhoto = () => {
    if (!cameraReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Apply filter effect to canvas
    if (filterEffect !== 'normal') {
      ctx.filter = getFilterCSS(filterEffect);
    } else {
      ctx.filter = 'none';
    }
    
    // Capture frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Find the camera container element before adding flash effect
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) {
      cameraContainer.classList.add('flash');
      setTimeout(() => {
        cameraContainer.classList.remove('flash');
      }, 200);
    }
    
    // Save image
    const imageData = canvas.toDataURL('image/png');
    const newPhoto = {
      data: imageData,
      timestamp: new Date().toISOString(),
      filter: filterEffect
    };
    
    const updatedPhotos = [...photos, newPhoto];
    setPhotos(updatedPhotos);
    localStorage.setItem('photos', JSON.stringify(updatedPhotos));
  };

  // Convert filter name to CSS filter
  const getFilterCSS = (filter) => {
    switch(filter) {
      case 'grayscale': return 'grayscale(1)';
      case 'sepia': return 'sepia(0.8)';
      case 'saturate': return 'saturate(2.5)';
      case 'invert': return 'invert(0.8)';
      default: return 'none';
    }
  };

  // Start recording video
  const handleStartRecording = () => {
    if (!cameraReady || !stream) return;
    
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      alert("Sorry, your browser doesn't support video recording.");
      return;
    }
    
    try {
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let mediaRecorder;
      
      // Try with different MIME types if the preferred one isn't supported
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
        mediaRecorder = new MediaRecorder(stream, options);
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } else {
        mediaRecorder = new MediaRecorder(stream);
      }
      
      let localChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          localChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (localChunks.length === 0) {
          console.error("No video data available");
          return;
        }
        
        try {
          const blob = new Blob(localChunks, { type: 'video/webm' });
          const base64 = await convertBlobToBase64(blob);
          
          const newVideo = {
            data: base64,
            timestamp: new Date().toISOString()
          };
          
          const updatedVideos = [...videos, newVideo];
          setVideos(updatedVideos);
          localStorage.setItem('videos', JSON.stringify(updatedVideos));
        } catch (err) {
          console.error("Error saving video:", err);
        }
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      
      // Add recording indicator
      const recordingIndicator = document.querySelector('.recording-indicator');
      if (recordingIndicator) {
        recordingIndicator.classList.add('active');
      }
    } catch (err) {
      console.error('Recording Error:', err);
      alert('Failed to start recording: ' + err.message);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      const recordingIndicator = document.querySelector('.recording-indicator');
      if (recordingIndicator) {
        recordingIndicator.classList.remove('active');
      }
    }
  };

  // Convert Blob to base64
  const convertBlobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Delete photo
  const handleDeletePhoto = (index) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    localStorage.setItem('photos', JSON.stringify(updatedPhotos));
  };

  // Delete video
  const handleDeleteVideo = (index) => {
    const updatedVideos = videos.filter((_, i) => i !== index);
    setVideos(updatedVideos);
    localStorage.setItem('videos', JSON.stringify(updatedVideos));
  };

  // Download photo
  const handleDownloadPhoto = (photo, index) => {
    const link = document.createElement('a');
    link.href = photo.data;
    link.download = `snapvibe-photo-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download video
  const handleDownloadVideo = (video, index) => {
    const link = document.createElement('a');
    link.href = video.data;
    link.download = `snapvibe-video-${new Date().getTime()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Format date for gallery items
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className={`app-container ${theme}`}>
      <div className="content-wrapper">
        <header className="header">
          <div className="logo-container">
            <div className="logo-icon">📸</div>
            <h1 className="logo-text">SnapVibe Studio</h1>
          </div>
          
          <div className="header-controls">
            <button onClick={toggleTheme} className="theme-toggle">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>

        <main>
          {!stream ? (
            <div className="startup-screen">
              <div className="camera-icon">📸</div>
              <h2>Welcome to SnapVibe Studio</h2>
              <p>Capture amazing photos and videos with creative filters</p>
              
              {cameraError ? (
                <div className="error-message">
                  <p>{cameraError}</p>
                  <div className="error-tips">
                    <h3>Troubleshooting Tips:</h3>
                    <ul>
                      <li>Make sure you've granted camera permissions in your browser</li>
                      <li>Try using a different browser (Chrome or Firefox recommended)</li>
                      <li>Check if another application is using your camera</li>
                      <li>Try restarting your browser</li>
                      <li>Ensure your camera is properly connected</li>
                    </ul>
                  </div>
                  <button onClick={handleStartCamera} className="retry-button">
                    Try Again
                  </button>
                </div>
              ) : (
                <button onClick={handleStartCamera} className="start-button">
                  Launch Camera
                </button>
              )}
            </div>
          ) : (
            <div className="camera-section">
              <div className="camera-container">
                <div className="recording-indicator"></div>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline
                  muted // Add muted to help with autoplay policies
                  style={{ filter: getFilterCSS(filterEffect) }}
                />
                <canvas ref={canvasRef} className="hidden-canvas" />
              </div>

              <div className="camera-controls">
                <div className="mode-selector">
                  <button 
                    onClick={() => setMode('photo')} 
                    className={`mode-button ${mode === 'photo' ? 'active' : ''}`}
                  >
                    📸 Photo
                  </button>
                  <button 
                    onClick={() => setMode('video')} 
                    className={`mode-button ${mode === 'video' ? 'active' : ''}`}
                  >
                    🎥 Video
                  </button>
                </div>

                {mode === 'photo' && (
                  <>
                    <div className="filter-controls">
                      {Object.entries(filters).map(([key, name]) => (
                        <button 
                          key={key}
                          onClick={() => setFilterEffect(key)} 
                          className={`filter-button ${filterEffect === key ? 'active' : ''}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={handleTakePhoto}
                      className={`capture-button photo-button ${!cameraReady ? 'disabled' : ''}`}
                      disabled={!cameraReady}
                    >
                      <span className="button-icon">📸</span>
                      <span className="button-text">Capture</span>
                    </button>
                  </>
                )}

                {mode === 'video' && !recording && (
                  <button 
                    onClick={handleStartRecording}
                    className={`capture-button video-start ${!cameraReady ? 'disabled' : ''}`}
                    disabled={!cameraReady}
                  >
                    <span className="button-icon">🎬</span>
                    <span className="button-text">Record</span>
                  </button>
                )}

                {mode === 'video' && recording && (
                  <button onClick={handleStopRecording} className="capture-button video-stop">
                    <span className="button-icon">⏹️</span>
                    <span className="button-text">Stop</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <section className="gallery-section">
              <h2 className="gallery-title">
                <span className="section-icon">🖼️</span> Photo Gallery
              </h2>
              <div className="gallery-grid">
                {photos.map((photo, i) => (
                  <div key={`photo-${i}`} className="gallery-item">
                    <div className="media-wrapper">
                      <img src={photo.data} alt={`Photo ${i+1}`} />
                      {photo.filter !== 'normal' && (
                        <div className="filter-badge">{filters[photo.filter]}</div>
                      )}
                    </div>
                    <div className="item-timestamp">{formatDate(photo.timestamp)}</div>
                    <div className="item-controls">
                      <button onClick={() => handleDownloadPhoto(photo, i)} className="item-button download">
                        <span className="button-icon">💾</span>
                      </button>
                      <button onClick={() => handleDeletePhoto(i)} className="item-button delete">
                        <span className="button-icon">🗑️</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Video Gallery */}
          {videos.length > 0 && (
            <section className="gallery-section">
              <h2 className="gallery-title">
                <span className="section-icon">🎬</span> Video Gallery
              </h2>
              <div className="gallery-grid">
                {videos.map((video, i) => (
                  <div key={`video-${i}`} className="gallery-item">
                    <div className="media-wrapper">
                      <video controls src={video.data} />
                    </div>
                    <div className="item-timestamp">{formatDate(video.timestamp)}</div>
                    <div className="item-controls">
                      <button onClick={() => handleDownloadVideo(video, i)} className="item-button download">
                        <span className="button-icon">💾</span>
                      </button>
                      <button onClick={() => handleDeleteVideo(i)} className="item-button delete">
                        <span className="button-icon">🗑️</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="footer">
          <p>Created with ❤️ by SnapVibe Studio</p>
        </footer>
      </div>
    </div>
  );
};

export default SnapVibe;