import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import Showcase from './components/Showcase.jsx';
import Features from './components/Features.jsx';
import Advantages from './components/Advantages.jsx';
import SyncStrip from './components/SyncStrip.jsx';
import Download from './components/Download.jsx';
import Footer from './components/Footer.jsx';
import './App.css';

export default function App() {
  return (
    <div className="site">
      <Nav />
      <main>
        <Hero />
        <Showcase />
        <Features />
        <Advantages />
        <SyncStrip />
        <Download />
      </main>
      <Footer />
    </div>
  );
}
