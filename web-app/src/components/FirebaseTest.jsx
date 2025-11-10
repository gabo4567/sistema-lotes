import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

const FirebaseTest = () => {
  const [status, setStatus] = useState('Verificando...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Intentar obtener una colección de prueba
        const testCollection = collection(db, '_test_');
        const snapshot = await getDocs(testCollection);
        setStatus('✅ Conexión con Firebase establecida correctamente');
        setError(null);
      } catch (err) {
        console.error('Error de conexión con Firebase:', err);
        setStatus('❌ Error de conexión con Firebase');
        setError(err.message);
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
      <h4>Test de Conexión Firebase:</h4>
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