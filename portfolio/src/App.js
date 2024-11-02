import './App.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import About from './pages/About';
import Contact from './pages/Contact'
import Experiences from './pages/Experiences'
import Projects from './pages/Projects'
import Front from './assets/front.png'

function App() {
  return (
    <BrowserRouter>
    <nav className='navv'>
      <div className='seek'>
        <p>Shyamalan Kannan</p>
      </div>
      <div className='link'>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/experiences">Experiences</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/contact">Contact</Link>
      </div>
    </nav>
      <Routes>
        <Route path="/" element={
            <>
              <div className='whole'>
              <h1 className='txt1'>Driven</h1>
              <div className='txt2-whole'>
                <h1 className='txt2'>by self*</h1>
                <img src={Front} alt="art" />
              </div>
              <h1 className='txt3'>Blind</h1>
              </div>
              <div className='bod'>
                <p>Seattle University 2024//2026</p>
                <p>(01/05)</p>
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
