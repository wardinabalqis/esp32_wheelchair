import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, update } from 'firebase/database';

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCJ76eUpV5wvVlrZLKbd3S1k2gM6PsngB4",
  authDomain: "wheelchair-15ba8.firebaseapp.com",
  databaseURL: "https://wheelchair-15ba8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wheelchair-15ba8",
  storageBucket: "wheelchair-15ba8.firebasestorage.app",
  messagingSenderId: "524149398157",
  appId: "1:524149398157:web:a80a23e12980181c1320c4"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
export default function WheelchairDashboard() {
  const [status, setStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [activeMode, setActiveMode] = useState(1); 
  const [activeSpeed, setActiveSpeed] = useState('2'); 
  const [phoneLocation, setPhoneLocation] = useState({ lat: 0, lng: 0 });
  
  const rxCharacteristicRef = useRef(null);

  const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const CHARACTERISTIC_UUID_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  // LOCATION TRACKING & FIREBASE SYNC
  useEffect(() => {
    let watchId;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setPhoneLocation({ lat, lng });

          const locationRef = ref(database, '/');
          update(locationRef, {
            phone_latitude: lat,
            phone_longitude: lng,
            // timestamp: Date.now()
          }).catch(error => console.error("Firebase update failed:", error));
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    } else {
      console.warn("Geolocation is not supported by this browser.");
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // BLUETOOTH CORE
  const connectToWheelchair = async () => {
    if (!navigator.bluetooth) {
      setStatus('Web Bluetooth is not supported by this browser.');
      return;
    }
    try {
      setStatus('Searching for Wheelchair_BLE...');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Wheelchair_BLE' }],
        optionalServices: [SERVICE_UUID]
      });

      setStatus('Connecting to GATT Server...');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const rxCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_RX);
      
      rxCharacteristicRef.current = rxCharacteristic;
      setIsConnected(true);
      setStatus('Hardware Connected');

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setStatus('Disconnected from Hardware');
        rxCharacteristicRef.current = null;
      });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setIsConnected(false);
    }
  };

  const sendCommand = async (commandChar) => {
    if (!rxCharacteristicRef.current) return;
    try {
      const encoder = new TextEncoder();
      await rxCharacteristicRef.current.writeValue(encoder.encode(commandChar));
      console.log(`Successfully Sent: ${commandChar}`);
    } catch (error) {
      console.error('Transmission error:', error);
    }
  };

  const handleSpeedChange = (speedLevel) => {
    setActiveSpeed(speedLevel);
    sendCommand(speedLevel);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Wheelchair OS</h2>
        <div style={{ ...styles.statusBar, backgroundColor: isConnected ? '#2ecc71' : '#e74c3c' }}>
          {status}
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
          GPS: {phoneLocation.lat.toFixed(5)}, {phoneLocation.lng.toFixed(5)}
        </div>
      </header>

      {!isConnected ? (
        <button style={styles.connectBtn} onClick={connectToWheelchair}>
          Pair Hardware via Bluetooth
        </button>
      ) : (
        <div style={styles.dashboard}>
          <div style={styles.tabContainer}>
            <button style={{...styles.tab, backgroundColor: activeMode === 1 ? '#0a84ff' : '#333'}} onClick={() => setActiveMode(1)}>🎮 Touch</button>
            <button style={{...styles.tab, backgroundColor: activeMode === 2 ? '#0a84ff' : '#333'}} onClick={() => setActiveMode(2)}>🎙️ Voice</button>
            <button style={{...styles.tab, backgroundColor: activeMode === 3 ? '#0a84ff' : '#333'}} onClick={() => setActiveMode(3)}>📱 Motion</button>
          </div>

          <div style={styles.modeContainer}>
            {activeMode === 1 && <GamepadMode sendCommand={sendCommand} activeSpeed={activeSpeed} onSpeedChange={handleSpeedChange} />}
            {activeMode === 2 && <VoiceMode sendCommand={sendCommand} />}
            {activeMode === 3 && <JoystickMotionMode sendCommand={sendCommand} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODE 1: GAMEPAD
// ==========================================
function GamepadMode({ sendCommand, activeSpeed, onSpeedChange }) {
  const gamepadAction = (directionChar) => ({
    onMouseDown: () => sendCommand(directionChar),
    onMouseUp: () => sendCommand('S'),
    onMouseLeave: () => sendCommand('S'),
    onTouchStart: (e) => { e.preventDefault(); sendCommand(directionChar); },
    onTouchEnd: (e) => { e.preventDefault(); sendCommand('S'); }
  });

  return (
    <div style={styles.modeWrapper}>
      <h3 style={styles.sectionTitle}>Speed Control</h3>
      <div style={styles.row}>
        {['1', '2', '3'].map((speed) => (
          <button key={speed} style={{ ...styles.speedBtn, opacity: activeSpeed === speed ? 1 : 0.4 }} onClick={() => onSpeedChange(speed)}>
            Speed {speed}
          </button>
        ))}
      </div>
      
      <h3 style={{...styles.sectionTitle, marginTop: '20px'}}>Hold to Drive</h3>
      <div style={styles.dPad}>
        <div style={styles.dRow}>
          <button style={styles.navBtn} {...gamepadAction('U')}>▲ FWD</button>
        </div>
        <div style={styles.dRow}>
          <button style={styles.navBtn} {...gamepadAction('R')}>◀ LFT</button>
          <div style={styles.centerSpace}></div>
          <button style={styles.navBtn} {...gamepadAction('L')}>RGT ▶</button>
        </div>
        <div style={styles.dRow}>
          <button style={styles.navBtn} {...gamepadAction('D')}>▼ REV</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODE 2: VOICE (WITH CUSTOM AUTOMATIC VAD ENGINE)
// ==========================================
function VoiceMode({ sendCommand }) {
  const [voiceSubMode, setVoiceSubMode] = useState('LIVE'); 
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const [autoStopSeconds, setAutoStopSeconds] = useState(1); 
  const [isDetectingSpeech, setIsDetectingSpeech] = useState(false);

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pcmDataRef = useRef([]);
  const intervalIdRef = useRef(null);
  const autoStopTimerRef = useRef(null);

  const voiceSubModeRef = useRef(voiceSubMode);
  const lastSoundTimeRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const isDetectingSpeechRef = useRef(false);

  const forceStopAllRef = useRef(null); 

  const API_KEY = 'AIzaSyBuI5x6rdzXJUwgfQ-8I0569-Q0Ery9zfs';

  const executeVoiceCommand = (cmd, textSpoken) => {
    sendCommand(cmd);
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (cmd !== 'S') {
      autoStopTimerRef.current = setTimeout(() => {
        sendCommand('S'); 
        setTranscript(`"${textSpoken}" 🛑 Auto-Braked`);
      }, autoStopSeconds * 1000); 
    }
  };

  const forceStopAll = () => {
    setIsListening(false);
    isSpeakingRef.current = false;
    isDetectingSpeechRef.current = false;
    setIsDetectingSpeech(false);

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Close error:", e));
      audioContextRef.current = null;
    }
    
    pcmDataRef.current = [];
    executeVoiceCommand('S', 'Emergency Stop');
    setTranscript('');
  };

  useEffect(() => {
    forceStopAllRef.current = forceStopAll;
  });

  useEffect(() => {
    voiceSubModeRef.current = voiceSubMode;
    forceStopAll();
    return () => forceStopAll();
  }, [voiceSubMode]); 

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (forceStopAllRef.current) forceStopAllRef.current();
        setTranscript('App paused by OS. Tap Start.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const encodeWAV = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); 
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  const uploadToGoogle = async (base64data, sampleRate, isLive) => {
    if (!isLive) setTranscript('Processing...');
    
    try {
      const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'LINEAR16', 
            sampleRateHertz: sampleRate,
            languageCode: 'en-US',
            model: 'command_and_search',
            speechContexts: [{
              phrases: ["forward", "up", "depan", "straight", "reverse", "back", "backward", "down", "lewis", "gostan", "left", "kiri", "right", "kanan", "stop", "brake", "berhenti"],
              boost: 20
            }]
          },
          audio: { content: base64data }
        })
      });

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const text = data.results[0].alternatives[0].transcript.toLowerCase().trim();
        setTranscript(`"${text}"`);

        if (text.includes('forward') || text.includes('up') || text.includes('depan') || text.includes('straight')) executeVoiceCommand('U', text);
        else if (text.includes('back') || text.includes('reverse') || text.includes('down') || text.includes('lewis') || text.includes('gostan')) executeVoiceCommand('D', text);
        else if (text.includes('left') || text.includes('kiri')) executeVoiceCommand('L', text);
        else if (text.includes('right') || text.includes('kanan')) executeVoiceCommand('R', text);
        else if (text.includes('stop') || text.includes('brake') || text.includes('berhenti')) executeVoiceCommand('S', text);
      } else {
        if (!isLive) setTranscript('Try again.');
      }
    } catch (error) {
      console.error("Google API Error:", error);
      if (!isLive) setTranscript('Connection Error.');
    }
  };

  const processAudioChunk = (isLiveMode) => {
    if (pcmDataRef.current.length === 0 || !audioContextRef.current) return;
    
    const currentChunks = [...pcmDataRef.current];
    pcmDataRef.current = [];

    const length = currentChunks.reduce((sum, arr) => sum + arr.length, 0);
    const float32Array = new Float32Array(length);
    let offset = 0;

    for (let arr of currentChunks) {
      float32Array.set(arr, offset);
      offset += arr.length;
    }

    const sampleRate = audioContextRef.current.sampleRate;
    const wavBuffer = encodeWAV(float32Array, sampleRate);
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    const reader = new FileReader();
    reader.readAsDataURL(wavBlob);
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      uploadToGoogle(base64data, sampleRate, isLiveMode);
    };
  };

  const toggleListen = async () => {
    if (isListening) {
      if (voiceSubMode === 'PTT') processAudioChunk(false); 
      forceStopAll();
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setTranscript('Mic Error');
        return; 
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        mediaStreamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        pcmDataRef.current = [];
        
        isSpeakingRef.current = false;
        lastSoundTimeRef.current = 0;
        isDetectingSpeechRef.current = false;
        setIsDetectingSpeech(false);

        processor.onaudioprocess = (e) => {
          const channelData = e.inputBuffer.getChannelData(0);
          const float32Array = new Float32Array(channelData);
          pcmDataRef.current.push(float32Array);

          if (voiceSubModeRef.current === 'LIVE') {
            let maxVol = 0;
            for (let i = 0; i < float32Array.length; i++) {
              if (Math.abs(float32Array[i]) > maxVol) maxVol = Math.abs(float32Array[i]);
            }

            if (maxVol > 0.05) { 
              lastSoundTimeRef.current = Date.now();
              isSpeakingRef.current = true;
            }

            if (!isSpeakingRef.current && pcmDataRef.current.length > 10) {
              pcmDataRef.current.shift();
            }
          }
        };

        source.connect(processor);
        processor.connect(audioCtx.destination); 

        setIsListening(true);
        setTranscript('Listening...');

        if (voiceSubMode === 'LIVE') {
          intervalIdRef.current = setInterval(() => {
            const currentlySpeaking = isSpeakingRef.current;

            if (currentlySpeaking !== isDetectingSpeechRef.current) {
              isDetectingSpeechRef.current = currentlySpeaking;
              setIsDetectingSpeech(currentlySpeaking);
            }

            if (currentlySpeaking) {
              const timeSinceLastSound = Date.now() - lastSoundTimeRef.current;
              
              if (timeSinceLastSound > 1200) {
                isSpeakingRef.current = false;
                isDetectingSpeechRef.current = false;
                setIsDetectingSpeech(false);
                processAudioChunk(true);
              }
            }
          }, 150);
        }
        
      } catch (err) {
        console.error("Mic start error:", err);
        setTranscript('Mic Denied');
      }
    }
  };

  return (
    <div style={styles.modeWrapper}>
      {isListening && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, 
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '40px 20px',
            width: '80%',
            maxWidth: '350px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ margin: '0 0 30px 0', color: '#555', fontSize: '22px', fontWeight: '400' }}>Google</h2>
            
            <div style={{
              width: '90px', height: '90px',
              backgroundColor: '#4285F4',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isDetectingSpeech ? '0 0 0 15px rgba(66, 133, 244, 0.2)' : '0 4px 15px rgba(66, 133, 244, 0.4)',
              transform: isDetectingSpeech ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.15s ease-in-out',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '40px' }}>🎙️</span>
            </div>
            
            <p style={{ color: '#888', fontSize: '18px', margin: '10px 0 30px 0', minHeight: '24px', textAlign: 'center', fontWeight: isDetectingSpeech ? 'bold' : 'normal' }}>
              {isDetectingSpeech ? "Detecting Voice..." : transcript}
            </p>
            
            <button 
              onClick={toggleListen}
              style={{
                padding: '12px 30px',
                fontSize: '16px',
                color: '#4285F4',
                background: 'transparent',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              STOP
            </button>
          </div>
        </div>
      )}

      <div style={{ width: '100%', padding: '15px', marginBottom: '15px', background: '#222', borderRadius: '12px', boxSizing: 'border-box' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', color: '#ff9500', marginBottom: '10px', fontSize: '13px', fontWeight: 'bold' }}>
          <span>🛡️ Auto-Brake Safety</span>
          <span>{autoStopSeconds} sec</span>
        </label>
        <input 
          type="range" min="1" max="10" step="1"
          value={autoStopSeconds} 
          onChange={(e) => setAutoStopSeconds(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#ff9500', marginBottom: '10px' }}
        />
      </div>

      <button 
        style={{ ...styles.micBtn, backgroundColor: '#30d158' }} 
        onClick={toggleListen}
      >
        {voiceSubMode === 'PTT' ? '🎙️ Tap to Record' : '🎙️ Start Auto-VAD Engine'}
      </button>

      <button style={styles.emergencyBtn} onClick={forceStopAll}>
        EMERGENCY STOP
      </button>
    </div>
  );
}

// ==========================================
// MODE 3: JOYSTICK MOTION CONTROL
// ==========================================
function JoystickMotionMode({ sendCommand }) {
  const [isTracking, setIsTracking] = useState(false);
  const [activeCommand, setActiveCommand] = useState('S');
  const [sensitivity, setSensitivity] = useState(25); 
  
  const [puckPos, setPuckPos] = useState({ x: 0, y: 0 }); 
  const lastSentRef = useRef('S');

  const enableSensors = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          setIsTracking(true);
        } else {
          alert('Gyroscope permission denied.');
        }
      } catch (error) {
        console.error('Sensor error:', error);
      }
    } else {
      setIsTracking(true); 
    }
  };

  const stopSensors = () => {
    setIsTracking(false);
    setActiveCommand('S');
    setPuckPos({ x: 0, y: 0 }); 
  };

  useEffect(() => {
    if (!isTracking) return;

    const handleOrientation = (event) => {
      let { beta, gamma } = event; 
      
      const MAX_TILT = 100; 
      const MAX_TRAVEL = 90; 

      let normX = gamma / MAX_TILT;
      let normY = beta / MAX_TILT;

      const distance = Math.sqrt(normX * normX + normY * normY);
      if (distance > 1) {
        normX /= distance;
        normY /= distance;
      }

      setPuckPos({ x: normX * MAX_TRAVEL, y: normY * MAX_TRAVEL });

      let newCommand = 'S';
      
      if (Math.abs(beta) > sensitivity || Math.abs(gamma) > sensitivity) {
        if (Math.abs(beta) > (Math.abs(gamma) * 1.5)) {
          newCommand = beta < -sensitivity ? 'U' : 'D'; 
        } else {
          newCommand = gamma < -sensitivity ? 'L' : 'R';
        }
      }

      if (newCommand !== lastSentRef.current) {
        lastSentRef.current = newCommand;
        setActiveCommand(newCommand);
        sendCommand(newCommand);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (lastSentRef.current !== 'S') {
        lastSentRef.current = 'S';
        sendCommand('S'); 
      }
    };
  }, [isTracking, sendCommand, sensitivity]); 

  const deadzonePercentage = Math.min((sensitivity / 100) * 100, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600', color: '#eaeaea' }}>Tilt Phone to Steer</h3>
      
      <div style={{ position: 'relative', width: '240px', height: '240px', background: '#0a0a0c', borderRadius: '50%', border: '4px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px auto', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
        <div style={{
          position: 'absolute', borderRadius: '50%', border: '2px dashed #555', backgroundColor: 'rgba(255, 255, 255, 0.02)', transition: 'all 0.2s ease',
          width: `${deadzonePercentage}%`,
          height: `${deadzonePercentage}%`,
          borderColor: activeCommand === 'S' ? '#555' : '#30d158'
        }} />
        
        <div style={{
          position: 'absolute', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: 'white', zIndex: 10, transition: 'transform 0.1s linear, background-color 0.2s ease, box-shadow 0.2s ease',
          transform: `translate(${puckPos.x}px, ${puckPos.y}px)`,
          backgroundColor: activeCommand === 'S' ? '#888' : '#0a84ff',
          boxShadow: activeCommand === 'S' ? 'none' : '0 10px 20px rgba(10, 132, 255, 0.4)'
        }}>
          {activeCommand === 'U' && '▲'}
          {activeCommand === 'D' && '▼'}
          {activeCommand === 'L' && '◀'} 
          {activeCommand === 'R' && '▶'} 
        </div>
      </div>

      <div style={{ width: '100%', padding: '10px 20px', marginBottom: '15px', background: '#222', borderRadius: '12px', boxSizing: 'border-box' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
          <span>Deadzone Ring Size</span>
          <span style={{ color: '#0a84ff' }}>{sensitivity}°</span>
        </label>
        <input 
          type="range" min="5" max="100" 
          value={sensitivity} 
          onChange={(e) => setSensitivity(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#0a84ff' }}
        />
      </div>

      {!isTracking ? (
        <button style={{ padding: '20px', fontSize: '18px', color: '#fff', border: 'none', borderRadius: '12px', width: '100%', fontWeight: 'bold', margin: '10px 0', cursor: 'pointer', background: '#0a84ff' }} onClick={enableSensors}>
          Unlock Motion Sensors
        </button>
      ) : (
        <button style={{ width: '100%', padding: '25px', marginTop: '20px', background: '#ff453a', color: '#fff', fontSize: '20px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer' }} onClick={stopSensors}>
          STOP TRACKING
        </button>
      )}
    </div>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = {
  container: { padding: '15px', fontFamily: '-apple-system, sans-serif', background: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  header: { width: '100%', maxWidth: '500px', textAlign: 'center', marginBottom: '15px' },
  title: { margin: '5px 0', fontSize: '26px' },
  statusBar: { padding: '10px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', color: '#fff', transition: 'all 0.3s' },
  connectBtn: { padding: '20px 40px', fontSize: '18px', fontWeight: 'bold', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: '10px', marginTop: '40px', cursor: 'pointer' },
  dashboard: { width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tabContainer: { display: 'flex', width: '100%', gap: '8px', marginBottom: '20px' },
  tab: { flex: 1, padding: '14px 5px', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', transition: 'background-color 0.2s' },
  modeContainer: { width: '100%', background: '#1e1e1e', padding: '25px 20px', borderRadius: '16px', border: '1px solid #2c2c2e', boxSizing: 'border-box' },
  modeWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
  sectionTitle: { margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600', color: '#eaeaea' },
  row: { display: 'flex', justifyContent: 'space-around', width: '100%', gap: '10px', marginBottom: '10px' },
  speedBtn: { flex: 1, padding: '15px 5px', fontSize: '16px', background: '#ff9500', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  dPad: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  dRow: { display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' },
  navBtn: { width: '110px', height: '75px', fontSize: '15px', fontWeight: 'bold', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: '14px', touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', cursor: 'pointer' },
  centerSpace: { width: '110px', height: '75px' },
  micBtn: { padding: '20px', fontSize: '18px', color: '#fff', border: 'none', borderRadius: '12px', width: '100%', fontWeight: 'bold', margin: '10px 0', cursor: 'pointer', transition: 'background-color 0.2s' },
  transcriptBox: { width: '100%', minHeight: '90px', background: '#000', padding: '15px', borderRadius: '10px', border: '1px solid #333', fontSize: '18px', textAlign: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emergencyBtn: { width: '100%', padding: '25px', marginTop: '20px', background: '#ff453a', color: '#fff', fontSize: '20px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer' }
};