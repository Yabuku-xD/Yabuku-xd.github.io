import './App.css';
import Image from './assets/me.gif';
import BG from './assets/bg.png';
import React from 'react';

function App() {
  return (
    <>
      <nav className="navbar">
        <a href='#'>About</a>
        <a href='#'>Experience</a>
        <p>Hey there!</p>
        <a href='#'>Projects</a>
        <button>Contact</button>
      </nav>
      <h1 className="name">Shyamalan Kannan*</h1>
      <div className="main">
        <p>
          On a mission to crack the code hidden within data, I thrive as both a data scientist and a machine learning engineer.
          I love the thrill of the hunt – uncovering those hidden gems of insight and using them to build real-world solutions that make a difference.
          If you're looking for someone who can bridge the gap between technical expertise and visual storytelling, let's connect!
        </p>
        <img src={Image} alt="ME" />
      </div>
    </>
  );
}

export default App;
