import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const FirebaseTest = () => {
  const [status, setStatus] = useState('Verificando...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        const res = await api.get('/lotes');
        if (Array.isArray(res.data)) {
          setStatus('✅ Conexión backend OK');
          setError(null);
        } else {
          setStatus('⚠️ Backend respondió sin lista');
          setError(null);
        }
      } catch (err) {
        console.error('Error de conexión con backend:', err);
        setStatus('❌ Error de conexión con backend');
        setError(err?.response?.data?.error || err.message);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ 
      padding: '10px', 
      margin: '10px 0', 
      border: '1px solid #ccc', 
      borderRadius: '5px',
      backgroundColor: error ? '#ffe6e6' : '#e6ffe6'
    }}>
      <h4>Test de Conexión:</h4>
      <p>{status}</p>
      {error && (
        <div>
          <p><strong>Error:</strong></p>
          <pre style={{ fontSize: '12px', color: 'red' }}>{error}</pre>
        </div>
      )}
    </div>
  );
};

export default FirebaseTest;