import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SubmitTicket from './pages/SubmitTicket';
import Login from './pages/Login';
import TicketList from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';
import ApprovalQueue from './pages/ApprovalQueue';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SubmitTicket />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<TicketList />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/approvals" element={<ApprovalQueue />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}