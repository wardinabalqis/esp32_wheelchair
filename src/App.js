import React, { useState, useRef, useEffect } from 'react';

export default function WheelchairDashboard() {
  const [status, setStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [activeMode, setActiveMode] = useState(1); 
  const [activeSpeed, setActiveSpeed] = useState('2'); 
  
  const rxCharacteristicRef = useRef(null);

  const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const CHARACTERISTIC_UUID_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  // ==========================================
  // BLUETOOTH CORE
  // ==========================================
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
// MODE 1: GAMEPAD (Swapped Left/Right)
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
          {/* SWAPPED COMMANDS: Visual Left sends 'R', Visual Right sends 'L' */}
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
// MODE 2: NATIVE BROWSER VOICE CONTROL (No API Key)
// ==========================================
function VoiceMode({ sendCommand }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        
        const lowerText = currentTranscript.toLowerCase();
        setTranscript(`Heard: "${lowerText}"`);

        if (lowerText.includes('forward')) { sendCommand('U'); }
        else if (lowerText.includes('back') || lowerText.includes('reverse')) { sendCommand('D'); }
        else if (lowerText.includes('left')) { sendCommand('L'); }
        else if (lowerText.includes('right')) { sendCommand('R'); }
        else if (lowerText.includes('stop')) { sendCommand('S'); }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech error: ", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setTranscript('❌ Microphone permission denied.');
        } else {
          setTranscript(`Error: ${event.error}`);
        }
      };
    }
  }, [sendCommand]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setTranscript('❌ Error: This browser does not support native speech recognition.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      sendCommand('S');
    } else {
      setTranscript('Listening for commands...');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  };

  return (
    <div style={styles.modeWrapper}>
      <h3 style={styles.sectionTitle}>Say: "Forward", "Left", "Right", "Stop"</h3>
      <p style={{ color: '#ff9500', fontSize: '13px', textAlign: 'center', marginBottom: '15px', padding: '0 10px' }}>
        Using native local microphone (No API keys required)
      </p>
      
      <button 
        style={{ ...styles.micBtn, backgroundColor: isListening ? '#ff453a' : '#30d158' }} 
        onClick={toggleListen}
      >
        {isListening ? '🛑 Stop Listening' : '🎙️ Start Microphone'}
      </button>
      
      <div style={styles.transcriptBox}>
        {transcript || "Press start and speak..."}
      </div>

      <button style={styles.emergencyBtn} onClick={() => sendCommand('S')}>
        EMERGENCY STOP
      </button>
    </div>
  );
}

// ==========================================
// MODE 3: JOYSTICK MOTION CONTROL (100 Max + Steering Bias)
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
      
      // 1. VISUAL JOYSTICK MATH
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

      // 2. BLUETOOTH COMMAND MATH (With Steering Bias)
      let newCommand = 'S';
      
      if (Math.abs(beta) > sensitivity || Math.abs(gamma) > sensitivity) {
        // STEERING BIAS: Multiplies gamma by 1.5 to prioritize left/right turns
        if (Math.abs(beta) > (Math.abs(gamma) * 1.5)) {
          newCommand = beta < -sensitivity ? 'U' : 'D'; 
        } else {
          // STANDARD COMMANDS
          newCommand = gamma < -sensitivity ? 'L' : 'R';
        }
      }

      // 3. THROTTLE TRANSMISSION
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
      
      {/* Visual Joystick Canvas */}
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
  
  // D-PAD STYLES
  dPad: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  dRow: { display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' },
  navBtn: { width: '110px', height: '75px', fontSize: '15px', fontWeight: 'bold', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: '14px', touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', cursor: 'pointer' },
  centerSpace: { width: '110px', height: '75px' },
  
  // VOICE STYLES
  micBtn: { padding: '20px', fontSize: '18px', color: '#fff', border: 'none', borderRadius: '12px', width: '100%', fontWeight: 'bold', margin: '10px 0', cursor: 'pointer' },
  transcriptBox: { width: '100%', minHeight: '90px', background: '#000', padding: '15px', borderRadius: '10px', border: '1px solid #333', fontSize: '18px', textAlign: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emergencyBtn: { width: '100%', padding: '25px', marginTop: '20px', background: '#ff453a', color: '#fff', fontSize: '20px', fontWeight: 'bold', border: 'none', borderRadius: '12px', cursor: 'pointer' }
};