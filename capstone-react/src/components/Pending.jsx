import { useNavigate } from 'react-router-dom';

export default function Pending() {
  const navigate = useNavigate();
  return (
    <div className="pending-page">
      <div className="pending-card fade-in">
        <div className="pending-icon">⏳</div>
        <h2>AWAITING_CLEARANCE</h2>
        <p style={{ marginTop: 12 }}>
          Your account has been submitted and is pending admin verification.
          You will be granted access once approved.
        </p>
        <button
          className="cyber-btn"
          style={{ marginTop: 32 }}
          onClick={() => navigate('/')}
        >
          RETURN TO LOGIN
        </button>
      </div>
    </div>
  );
}
