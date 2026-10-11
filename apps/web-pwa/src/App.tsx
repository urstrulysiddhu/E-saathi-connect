import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { ConsumerHome } from './pages/consumer/ConsumerHome';
import { DeviceRegister } from './pages/consumer/DeviceRegister';
import { DeviceDetail } from './pages/consumer/DeviceDetail';
import { PhotoUpload } from './pages/consumer/PhotoUpload';

import { CollectorHome } from './pages/collector/CollectorHome';
import { CollectorHistory } from './pages/collector/CollectorHistory';
import { HandoverAccept } from './pages/collector/HandoverAccept';

import { HubHome } from './pages/hub/HubHome';
import { HubInventory } from './pages/hub/HubInventory';
import { RoutingWorkflow } from './pages/hub/RoutingWorkflow';

import { DestinationHome } from './pages/destination/DestinationHome';
import { DestinationProcessing } from './pages/destination/DestinationProcessing';
import { DestinationTransactions } from './pages/destination/DestinationTransactions';
import { DestinationCompleted } from './pages/destination/DestinationCompleted';
import { AdminHome } from './pages/admin/AdminHome';
import { AdminDeviceDetail } from './pages/admin/AdminDeviceDetail';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<AppLayout />}>
            {/* Consumer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['CONSUMER']} />}>
              <Route path="/consumer" element={<ConsumerHome />} />
              <Route path="/consumer/register" element={<DeviceRegister />} />
              <Route path="/consumer/devices/:deviceId" element={<DeviceDetail />} />
              <Route path="/consumer/devices/:deviceId/upload-photo" element={<PhotoUpload />} />
            </Route>

            {/* Collector Routes */}
            <Route element={<ProtectedRoute allowedRoles={['COLLECTOR']} />}>
              <Route path="/collector" element={<CollectorHome />} />
              <Route path="/collector/handover/:deviceId" element={<HandoverAccept />} />
              <Route path="/collector/history" element={<CollectorHistory />} />
            </Route>

            {/* Hub Routes */}
            <Route element={<ProtectedRoute allowedRoles={['HUB']} />}>
              <Route path="/hub" element={<HubHome />} />
              <Route path="/hub/routing/:deviceId" element={<RoutingWorkflow />} />
              <Route path="/hub/inventory" element={<HubInventory />} />
            </Route>

            {/* Destination Routes */}
            <Route element={<ProtectedRoute allowedRoles={['DESTINATION']} />}>
              <Route path="/destination" element={<DestinationHome />} />
              <Route path="/destination/processing/:deviceId" element={<DestinationProcessing />} />
              <Route path="/destination/transactions" element={<DestinationTransactions />} />
              <Route path="/destination/completed" element={<DestinationCompleted />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/devices/:deviceId" element={<AdminDeviceDetail />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
