import './App.css';
import Image from './assets/me.gif';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import About from './pages/About';
import Contact from './pages/Contact'
import Experiences from './pages/Experiences'
import Projects from './pages/Projects'

function App() {
  return (
    <BrowserRouter>
      <nav className="navbar">
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/experiences">Experiences</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/contact">
          <button>Contact</button>
        </Link>
      </nav>
      
      <Routes>
        <Route path="/" element={
            <>
              <h1 className="name">Shyamalan Kannan*</h1>
              <div className="main">
                <p>
                  On a mission to crack the code hidden within data, I thrive as both a data scientist and a machine learning engineer.
                  I love the thrill of the hunt* uncovering those hidden gems of insight and using them to build real-world solutions that make a difference.
                  If you're looking for someone who can bridge the gap between technical expertise and visual storytelling, let's connect*
                </p>
                <img src={Image} alt="ME" />
              </div>
            </>
          }
        />
        <Route path="/about" element={<About />} />
        <Route path="/experiences" element={<Experiences />} />
        <Route path="/projects" element={<Projects/>} />
        <Route path="/contact" element={<Contact/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
