import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import 'bootstrap/dist/css/bootstrap.min.css';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

function App() {
  const [ledStatus, setLedStatus] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setLoggedIn(!!user));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    return onValue(ref(database, 'led'), (snapshot) => {
      setLedStatus(snapshot.val());
    });
  }, [loggedIn]);

  const toggleLed = () => {
    set(ref(database, 'led'), ledStatus === 1 ? 0 : 1);
  };

  // --- Inline Styles for the Switch ---
  const styles = {
    switchContainer: {
      position: 'relative',
      display: 'inline-block',
      width: '60px',
      height: '34px',
    },
    slider: {
      position: 'absolute',
      cursor: 'pointer',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: ledStatus === 1 ? '#00e676' : '#ccc',
      transition: '.4s',
      borderRadius: '34px',
    },
    knob: {
      position: 'absolute',
      height: '26px',
      width: '26px',
      left: ledStatus === 1 ? '30px' : '4px',
      bottom: '4px',
      backgroundColor: 'white',
      transition: '.4s',
      borderRadius: '50%',
    }
  };

  if (!loggedIn) {
    return (
      <div className="container d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="card p-4 shadow" style={{ width: '350px' }}>
          <h4 className="text-center mb-3">Login</h4>
          <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value).catch(() => alert('Login Failed')); }}>
            <input name="email" className="form-control mb-2" type="email" placeholder="Email" required />
            <input name="password" className="form-control mb-3" type="password" placeholder="Password" required />
            <button className="btn btn-primary w-100">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <h2 className="mb-4">LED Control</h2>
      
      <div className="card p-5 shadow-sm text-center" style={{ width: '250px', borderRadius: '15px' }}>
        <h5 className="mb-4">{ledStatus === 1 ? "STATUS: ON" : "STATUS: OFF"}</h5>
        
        {/* Toggle UI */}
        <div style={styles.switchContainer} onClick={toggleLed}>
          <div style={styles.slider}>
            <div style={styles.knob}></div>
          </div>
        </div>
      </div>
      
      <button className="btn btn-link text-secondary mt-4" onClick={() => signOut(auth)}>Logout</button>
    </div>
  );
}

export default App;