import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "firebase/database";

import "bootstrap/dist/css/bootstrap.min.css";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const cleanNumericValue = (val) => {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  const match = str.match(/^-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

// --- CUSTOM GAUGE COMPONENTS ---

// 1. Semi-Circular Gauge (For Gyro Magnitude - Dynamic 0 to 100 Bounds)
const SemiGauge = ({ value, min = 0, max = 100, title, unit }) => {
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const rotation = percentage * 180 - 90; // Maps 0-1 to -90 to +90 degrees

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 d-flex flex-column align-items-center justify-content-center">
      <p className="text-muted small fw-bold text-uppercase mb-3" style={{ fontSize: '0.75rem' }}>{title}</p>
      <div style={{ position: 'relative', width: '160px', height: '90px', overflow: 'hidden' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', width: '160px', height: '160px', 
          borderRadius: '50%', border: '16px solid #e2e8f0', top: 0, left: 0
        }} />
        {/* Needle Base */}
        <div style={{
          position: 'absolute', width: '12px', height: '12px', borderRadius: '50%',
          backgroundColor: '#1e293b', bottom: '-2px', left: '74px', zIndex: 3
        }} />
        {/* Needle Pin */}
        <div style={{
          position: 'absolute', width: '4px', height: '70px', backgroundColor: '#ef4444',
          bottom: 0, left: '78px', transformOrigin: 'bottom center',
          transform: `rotate(${rotation}deg)`, transition: 'transform 0.4s ease-out', zIndex: 2,
          borderRadius: '2px'
        }} />
      </div>
      <div className="text-center mt-2">
        <span className="fs-3 fw-bold text-dark">{value.toFixed(2)}</span>
        <span className="text-muted small ms-1">{unit}</span>
      </div>
    </div>
  );
};

// 2. Circular Dial Gauge (Fixed styling typo and added strict mathematical capping)
const CircularDial = ({ value, min = 0, max = 100, title, unit, color = "#3b82f6" }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  
  // Strict mathematical capping prevents lines from wrapping backward or shrinking to zero abnormally
  const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-2">
      <p className="text-muted small fw-bold text-uppercase mb-3" style={{ fontSize: '0.75rem' }}>{title}</p>
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
          {/* Foreground progress circle */}
          <circle 
            cx="60" cy="60" r={radius} fill="transparent" stroke={color} strokeWidth="10" 
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '120px', height: '120px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="fs-4 fw-bold text-dark font-monospace">{value.toFixed(1)}</span>
          <span className="text-muted style-normal" style={{ fontSize: '0.75rem' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastGyroUpdate, setLastGyroUpdate] = useState(0); 

  const prevGyroMagRef = useRef(null);
  const isBootWindowPassed = useRef(false);

  const [sensorData, setSensorData] = useState({
    ai_decision: {},
    data: {},
    esp32: {},
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
    });
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      isBootWindowPassed.current = false;
      setIsOnline(false);
      return;
    }

    const bootTimer = setTimeout(() => {
      isBootWindowPassed.current = true;
    }, 30000); 

    return () => clearTimeout(bootTimer);
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    const dbRef = ref(database);
    
    return onValue(dbRef, (snapshot) => {
      const firebaseData = snapshot.val();
      
      if (firebaseData) {
        const currentGyroMag = firebaseData?.ai_decision?.gyro_mag;

        if (isBootWindowPassed.current && currentGyroMag !== undefined) {
          if (prevGyroMagRef.current !== currentGyroMag) {
            setLastGyroUpdate(Date.now());
            setIsOnline(true);
            prevGyroMagRef.current = currentGyroMag; 
          }
        }

        setSensorData({
          ai_decision: firebaseData?.ai_decision || {},
          data: firebaseData?.data || {},
          esp32: firebaseData?.esp32 || {},
        });
      }
    });
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || lastGyroUpdate === 0) return;

    const interval = setInterval(() => {
      const timeSinceLastGyro = Date.now() - lastGyroUpdate;
      if (timeSinceLastGyro > 5000) {
        setIsOnline(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastGyroUpdate, loggedIn]);

  const toggleBuzzer = () => {
    const currentStatus = sensorData.esp32.buzzer_button || "off";
    const nextStatus = currentStatus === "on" ? "off" : "on";
    
    update(ref(database, 'esp32'), {
      buzzer_button: nextStatus
    }).catch((error) => {
      console.error("Failed to update buzzer status:", error);
    });
  };

  if (!loggedIn) {
    return (
      <div className="container-fluid d-flex justify-content-center align-items-center" style={{ height: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="card border-0 shadow-lg p-4 p-sm-5 bg-white text-dark" style={{ width: "100%", maxWidth: "400px", borderRadius: "16px" }}>
          <div className="text-center mb-4">
            <div className="bg-primary bg-opacity-10 text-primary d-inline-block p-3 rounded-circle mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-cpu" viewBox="0 0 16 16">
                <path d="M5 0a.5.5 0 0 1 .5.5V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2A2.5 2.5 0 0 1 14 4.5h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14v1h1.5a.5.5 0 0 1 0-1H14A2.5 2.5 0 0 1 11.5 14v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14A2.5 2.5 0 0 1 2 11.5H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2A2.5 2.5 0 0 1 4.5 2V.5A.5.5 0 0 1 5 0m-.5 3A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 11.5 3z"/>
              </svg>
            </div>
            <h4 className="fw-bold m-0 text-secondary">IoT Portal</h4>
            <small className="text-muted">Sign in to monitor active nodes</small>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value).catch(() => alert("Login Failed."));
          }}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-muted">Email Address</label>
              <input name="email" type="email" className="form-control form-control-lg border-2 shadow-none" required />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold text-muted">Password</label>
              <input name="password" type="password" className="form-control form-control-lg border-2 shadow-none" required />
            </div>
            <button className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" style={{ borderRadius: "8px" }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0" style={{ backgroundColor: "#f8fafc" }}>
      <div className="row g-0" style={{ minHeight: "100vh" }}>
        
        {/* SIDEBAR NAVIGATION */}
        <div className="col-12 col-md-3 col-lg-2 bg-dark text-white p-4 d-flex flex-column justify-content-between" style={{ backgroundColor: "#0f172a" }}>
          <div>
            <div className="d-flex align-items-center justify-content-between justify-content-md-start mb-3 mb-md-4 pb-2 border-bottom border-secondary border-opacity-25">
              <div className="d-flex align-items-center">
                <div className="bg-primary p-2 rounded-3 me-2 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-activity" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.523-3.046A.5.5 0 0 1 12 8.7h3a.5.5 0 0 1 0h-2.738l-2.03 4.05a.5.5 0 0 1-.9.03L5.12 3.319l-1.494 2.987A.5.5 0 0 1 3.18 6.5H.5a.5.5 0 0 1 0-1h2.417l1.6-3.2A.5.5 0 0 1 5 2z"/>
                  </svg>
                </div>
                <span className="fw-bold fs-5 tracking-tight">Smart Vest</span>
              </div>
            </div>
            <ul className="nav flex-row flex-md-column gap-2 mb-3 mb-md-0">
              <li className="nav-item flex-grow-1 flex-md-grow-0">
                <a href="#dashboard" className="nav-link text-white bg-primary bg-opacity-75 rounded-3 py-2 px-3 fw-medium d-flex align-items-center justify-content-center justify-content-md-start">Overview</a>
              </li>
            </ul>
          </div>
          <button className="btn btn-outline-light border-0 opacity-75 text-center text-md-start w-100 py-2 d-flex align-items-center justify-content-center justify-content-md-start mt-2 mt-md-4" onClick={() => signOut(auth)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-left me-1 me-md-2" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0z"/>
              <path fillRule="evenodd" d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708z"/>
            </svg>
            <span>Sign Out</span>
          </button>
        </div>

        {/* MAIN DASHBOARD BLOCK */}
        <div className="col-12 col-md-9 col-lg-10 p-3 p-sm-4 p-md-5">
          <div className="mb-4 mb-md-5">
            <h1 className="fw-bold tracking-tight text-dark m-0 fs-3">IoT Monitoring</h1>
            <p className="text-muted small m-0">Real-time telemetry stream from edge units</p>
          </div>

          {/* MAIN TOP ROW GRID */}
          <div className="row g-3 g-md-4 mb-4 mb-md-5">
            {/* AI STATE GAUGE ALIGNED */}
            <div className="col-12 col-sm-6 col-xl-6">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white d-flex flex-column align-items-center justify-content-center">
                <p className="text-muted small fw-bold text-uppercase mb-3" style={{ fontSize: '0.75rem' }}>AI Status State</p>
                <div className={`px-4 py-3 rounded-4 fw-bold fs-4 text-center w-75 ${sensorData.ai_decision.state === "Resting" ? "bg-success bg-opacity-10 text-success" : "bg-warning bg-opacity-10 text-warning"}`}>
                  {sensorData.ai_decision.state || "Unknown"}
                </div>
              </div>
            </div>

            {/* GYRO MAGNITUDE SEMI GAUGE */}
            <div className="col-12 col-sm-6 col-xl-6">
              <SemiGauge 
                value={cleanNumericValue(sensorData.ai_decision.gyro_mag)} 
                min={0} 
                max={100} 
                title="Gyro Magnitude Gauge" 
                unit="rad/s" 
              />
            </div>
          </div>

          {/* LOWER LAYOUT GRID */}
          <div className="row g-4">
            
            {/* VISUAL BME280 DIAL GAUGES BLOCK */}
            <div className="col-12">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="card-header bg-white border-bottom border-light px-4 py-3">
                  <h6 className="m-0 fw-bold text-dark">BME280 Environmental Instrument Gauges</h6>
                </div>
                <div className="p-4">
                  <div className="row g-4 text-center justify-content-around">
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.temperature)} 
                        min={0} max={50} title="Thermal Index" unit="°C" color="#f97316" 
                      />
                    </div>
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.humidity)} 
                        min={0} max={100} title="Humidity Matrix" unit="% RH" color="#06b6d4" 
                      />
                    </div>
                    {/* Fixed pressure min/max parameters to keep layout clean */}
                    <div className="col-12 col-sm-4">
                      <CircularDial 
                        value={cleanNumericValue(sensorData.data.pressure)} 
                        min={900} max={1100} title="Atmospheric Pressure" unit="hPa" color="#10b981" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACCELEROMETER TABLE */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white h-100">
                <div className="card-header bg-white border-bottom border-light px-4 py-3">
                  <h6 className="m-0 fw-bold text-dark">Accelerometer Matrix</h6>
                </div>
                <div className="p-3 p-sm-4">
                  <table className="table table-borderless align-middle m-0">
                    <thead>
                      <tr className="border-bottom text-muted small text-uppercase">
                        <th className="pb-2">Axis Segment</th>
                        <th className="pb-2 text-end">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-bottom border-light">
                        <td className="py-3 text-secondary fw-medium">X-Axis Value</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.accel_x ?? "--"}</td>
                      </tr>
                      <tr className="border-bottom border-light">
                        <td className="py-3 text-secondary fw-medium">Y-Axis Value</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.accel_y ?? "--"}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-secondary fw-medium">Z-Axis Value</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.accel_z ?? "--"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* GYROSCOPE TABLE */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white h-100">
                <div className="card-header bg-white border-bottom border-light px-4 py-3">
                  <h6 className="m-0 fw-bold text-dark">Gyroscope Matrix</h6>
                </div>
                <div className="p-3 p-sm-4">
                  <table className="table table-borderless align-middle m-0">
                    <thead>
                      <tr className="border-bottom text-muted small text-uppercase">
                        <th className="pb-2">Axis Segment</th>
                        <th className="pb-2 text-end">Velocity</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-bottom border-light">
                        <td className="py-3 text-secondary fw-medium">X-Axis Rotational</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.gyro_x ?? "--"}</td>
                      </tr>
                      <tr className="border-bottom border-light">
                        <td className="py-3 text-secondary fw-medium">Y-Axis Rotational</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.gyro_y ?? "--"}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-secondary fw-medium">Z-Axis Rotational</td>
                        <td className="py-3 text-end fw-bold text-dark font-monospace">{sensorData.data.gyro_z ?? "--"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ACTUATOR BUZZER TRIGGER SWITCH */}
            <div className="col-12">
              <div className="card border-0 shadow-sm rounded-4 p-3 p-sm-4 bg-white d-flex flex-row align-items-center justify-content-between">
                <div>
                  <h6 className="fw-bold text-dark m-0" style={{ fontSize: '0.95rem' }}>Actuator Control</h6>
                  <p className="text-muted small m-0 d-none d-sm-block">Toggle node alarm sounders</p>
                </div>
                <div className="form-check form-switch p-0 m-0 d-flex align-items-center">
                  <span className="me-2 me-sm-3 small fw-bold" style={{ fontSize: '0.8rem', color: sensorData.esp32.buzzer_button === "on" ? '#10b981' : '#6c757d' }}>
                    {sensorData.esp32.buzzer_button === "on" ? "ACTIVE" : "MUTED"}
                  </span>
                  <div style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      id="buzzerToggle"
                      checked={sensorData.esp32.buzzer_button === "on"}
                      onChange={toggleBuzzer}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <label 
                      htmlFor="buzzerToggle"
                      style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: sensorData.esp32.buzzer_button === "on" ? '#10b981' : '#cbd5e1',
                        transition: '.3s rounded, .3s background-color', borderRadius: '34px'
                      }}
                    >
                      <span style={{
                        position: 'absolute', content: '""', height: '18px', width: '18px', left: '4px', bottom: '4px',
                        backgroundColor: 'white', transition: '.3s transform', borderRadius: '50%',
                        transform: sensorData.esp32.buzzer_button === "on" ? 'translateX(22px)' : 'translateX(0)'
                      }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default App;