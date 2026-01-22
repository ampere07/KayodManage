import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SettingsManagement from './SettingsManagement';
import SettingsConfiguration from './SettingsConfiguration';

const Settings: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="management" replace />} />
      <Route path="management" element={<SettingsManagement />} />
      <Route path="configuration" element={<Navigate to="/settings/configuration/job-category" replace />} />
      <Route path="configuration/:tab" element={<SettingsConfiguration />} />
    </Routes>
  );
};

export default Settings;
