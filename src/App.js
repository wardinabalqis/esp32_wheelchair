import React, { useState, useRef } from 'react';

export default function WheelchairController() {
  const [status, setStatus] = useState('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [activeSpeed, setActiveSpeed] = useState('2'); // Matches MEDIUM_SPEED default
  
  const rxCharacteristicRef = useRef(null);

  // Exact UUIDs from your ESP32 C++ Code
  const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const CHARACTERISTIC_UUID_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  const connectToWheelchair = async () => {
    if (!navigator.bluetooth) {
      setStatus('Web Bluetooth is not supported by this browser/app.');
      return;
    }

    try {
      setStatus('Searching for Wheelchair_BLE...');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Wheelchair_BLE' }],
        optionalServices: [SERVICE_UUID]
      });

      setStatus('Connecting to server...');
      const server = await device.gatt.connect();

      setStatus('Locating motor control service...');
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      setStatus('Securing control channel...');
      const rxCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_RX);
      
      rxCharacteristicRef.current = rxCharacteristic;
      setIsConnected(true);
      setStatus('Connected & Ready to Drive');

      // Add listener for accidental disconnects
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setStatus('Disconnected from Wheelchair');
        rxCharacteristicRef.current = null;
      });

    } catch (error) {
      setStatus(`Connection Error: ${error.message}`);
      setIsConnected(false);
    }
  };

  const sendCommand = async (commandChar) => {
    if (!rxCharacteristicRef.current) return;
    try {
      const encoder = new TextEncoder();
      // Send the single character as an array buffer byte matching your rxValue[0]
      await rxCharacteristicRef.current.writeValue(encoder.encode(commandChar));
      console.log(`Sent Command: ${commandChar}`);
    } catch (error) {
      console.error('Failed to send command:', error);
      setStatus('Transmission lost. Reconnecting...');
      setIsConnected(false);
    }
  };

  const handleSpeedChange = (speedLevel) => {
    setActiveSpeed(speedLevel);
    sendCommand(speedLevel); // Sends '1', '2', or '3'
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Wheelchair Control Panel</h1>
        <div style={{ ...styles.statusBar, backgroundColor: isConnected ? '#2ecc71' : '#e74c3c' }}>
          {status}
        </div>
      </header>

      {!isConnected ? (
        <button style={styles.connectBtn} onClick={connectToWheelchair}>
          Scan & Connect via Bluetooth
        </button>
      ) : (
        <main style={styles.controlGrid}>
          {/* Speed Selector Section */}
          <section style={styles.section}>
            <h3>Speed Configuration</h3>
            <div style={styles.row}>
              <button 
                style={{ ...styles.speedBtn, opacity: activeSpeed === '1' ? 1 : 0.5 }} 
                onClick={() => handleSpeedChange('1')}
              >
                Low (1)
              </button>
              <button 
                style={{ ...styles.speedBtn, opacity: activeSpeed === '2' ? 1 : 0.5 }} 
                onClick={() => handleSpeedChange('2')}
              >
                Med (2)
              </button>
              <button 
                style={{ ...styles.speedBtn, opacity: activeSpeed === '3' ? 1 : 0.5 }} 
                onClick={() => handleSpeedChange('3')}
              >
                Full (3)
              </button>
            </div>
          </section>

          {/* Directional D-Pad Section */}
          <section style={styles.section}>
            <h3>Directional Control</h3>
            <div style={styles.dPad}>
              <div style={styles.dRow}>
                <button style={styles.navBtn} onClick={() => sendCommand('U')}>▲ Forward</button>
              </div>
              <div style={styles.dRow}>
                <button style={styles.navBtn} onClick={() => sendCommand('L')}>◀ Left</button>
                <button style={styles.stopBtn} onClick={() => sendCommand('S')}>STOP</button>
                <button style={styles.navBtn} onClick={() => sendCommand('R')}>Right ▶</button>
              </div>
              <div style={styles.dRow}>
                <button style={styles.navBtn} onClick={() => sendCommand('D')}>▼ Reverse</button>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', fontFamily: '-apple-system, sans-serif', background: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  header: { width: '100%', maxWidth: '500px', textAlign: 'center', marginBottom: '30px' },
  statusBar: { padding: '10px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', marginTop: '10px', color: '#fff', transition: 'all 0.3s' },
  connectBtn: { padding: '20px 40px', fontSize: '18px', fontWeight: 'bold', color: '#fff', background: '#3498db', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '40px' },
  controlGrid: { width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '25px' },
  section: { background: '#222', padding: '20px', borderRadius: '12px', border: '1px solid #333', textAlign: 'center' },
  row: { display: 'flex', justifyContent: 'space-around', gap: '10px', marginTop: '10px' },
  speedBtn: { flex: 1, padding: '12px', fontSize: '16px', background: '#e67e22', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  dPad: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '15px' },
  dRow: { display: 'flex', gap: '10px', justifyContent: 'center', width: '100%' },
  navBtn: { width: '100px', height: '60px', fontSize: '16px', fontWeight: 'bold', background: '#2980b9', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  stopBtn: { width: '100px', height: '60px', fontSize: '16px', fontWeight: 'bold', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }
};