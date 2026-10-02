import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import NewTest from './pages/NewTest.jsx';
import Analysis from './pages/Analysis.jsx';
import RecordPage from './pages/Record.jsx';
import Calibrate from './pages/Calibrate.jsx';
import DemoCard from './pages/DemoCard.jsx';
import Verify from './pages/Verify.jsx';
export default function App() {
  return (<Routes>
    <Route path="/" element={<Home />} /><Route path="/new" element={<NewTest />} /><Route path="/analysis" element={<Analysis />} />
    <Route path="/record/:id" element={<RecordPage />} /><Route path="/calibrate" element={<Calibrate />} /><Route path="/demo-card" element={<DemoCard />} />
    <Route path="/verify/:id?" element={<Verify />} />
  </Routes>);
}
