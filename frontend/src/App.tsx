import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CreateProject from './pages/CreateProject';
import ProjectDetail from './pages/ProjectDetail';
import MyTickets from './pages/MyTickets';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateProject />} />
        <Route path="/project/:projectId" element={<ProjectDetail />} />
        <Route path="/my-tickets" element={<MyTickets />} />
      </Routes>
    </Router>
  );
}

export default App;
