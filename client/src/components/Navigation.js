import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function PlantGraphic() {
  return (
    <svg width="120" height="36" viewBox="0 0 120 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Stem 1 */}
      <path d="M20 34 C20 22 14 18 10 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Leaf left of stem 1 */}
      <path d="M15 20 C10 16 6 18 8 24 C12 22 16 22 15 20Z" fill="white" opacity="0.7"/>
      {/* Flower 1 — 5 petals */}
      <circle cx="10" cy="9" r="3.5" fill="white" opacity="0.35"/>
      <circle cx="10" cy="5"  r="2.2" fill="white" opacity="0.55"/>
      <circle cx="14" cy="7"  r="2.2" fill="white" opacity="0.55"/>
      <circle cx="13" cy="12" r="2.2" fill="white" opacity="0.55"/>
      <circle cx="7"  cy="12" r="2.2" fill="white" opacity="0.55"/>
      <circle cx="6"  cy="7"  r="2.2" fill="white" opacity="0.55"/>
      <circle cx="10" cy="9"  r="2.5" fill="white" opacity="0.9"/>

      {/* Stem 2 */}
      <path d="M50 34 C50 24 50 18 50 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Leaf right */}
      <path d="M50 22 C54 17 60 18 58 25 C54 23 50 23 50 22Z" fill="white" opacity="0.65"/>
      {/* Leaf left */}
      <path d="M50 18 C46 13 40 14 42 21 C46 19 50 19 50 18Z" fill="white" opacity="0.65"/>
      {/* Round flower 2 */}
      <circle cx="50" cy="7" r="5" fill="white" opacity="0.3"/>
      <circle cx="50" cy="3"  r="2.5" fill="white" opacity="0.6"/>
      <circle cx="54" cy="5"  r="2.5" fill="white" opacity="0.6"/>
      <circle cx="54" cy="10" r="2.5" fill="white" opacity="0.6"/>
      <circle cx="50" cy="12" r="2.5" fill="white" opacity="0.6"/>
      <circle cx="46" cy="10" r="2.5" fill="white" opacity="0.6"/>
      <circle cx="46" cy="5"  r="2.5" fill="white" opacity="0.6"/>
      <circle cx="50" cy="7"  r="3"   fill="white" opacity="0.9"/>

      {/* Stem 3 */}
      <path d="M90 34 C90 24 94 18 98 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Small leaf */}
      <path d="M92 24 C88 20 82 21 84 27 C88 25 93 25 92 24Z" fill="white" opacity="0.65"/>
      {/* Small bud */}
      <ellipse cx="99" cy="7" rx="4" ry="5.5" fill="white" opacity="0.5"/>
      <ellipse cx="99" cy="5" rx="2.5" ry="3" fill="white" opacity="0.85"/>

      {/* Small grass blades at base */}
      <path d="M30 36 C29 30 27 27 26 24" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <path d="M34 36 C34 29 36 25 37 22" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <path d="M68 36 C67 31 65 27 64 24" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <path d="M73 36 C74 30 76 26 77 23" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <path d="M108 36 C108 30 110 26 111 23" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
      <path d="M113 36 C114 31 115 27 115 24" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.45"/>
    </svg>
  );
}

function FlowerLogo() {
  return (
    <img src="/logo.png" alt="Growing Success Garden" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
  );
}

function Navigation({ onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="navbar">
      <h1>
        <FlowerLogo />
        Growing Success Garden
      </h1>
      <div className="navbar-plant">
        <PlantGraphic />
      </div>
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/settings">Settings</Link>
        <button onClick={handleLogout}>Log out</button>
      </nav>
    </div>
  );
}

export default Navigation;
