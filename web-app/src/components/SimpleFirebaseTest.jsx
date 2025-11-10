import React, { useState, useEffect } from 'react';
import { app, auth, db } from '../services/firebase';

const SimpleFirebaseTest = () => {
  const [status, setStatus] = useState('Verificando...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const testFirebase = async () => {
      try {
        // Verificar que Firebase esté inicializado
        if (!app) {
          throw new Error('Firebase app no está inicializada');
        }

        // Verificar autenticación
        const user = auth.currentUser;
        
        // Verificar Firestore con una consulta simple
        const { collection, getDocs } = await import('firebase/firestore');
        const testCollection = collection(db, 'test');
        const snapshot = await getDocs(testCollection);
        
        setStatus(`✅ Firebase conectado exitosamente!
                   App: ${app.name}
                   Usuario: ${user ? user.email : 'No autenticado'}
                   Documentos en test: ${snapshot.size}`);
      } catch (err) {
        setError(err.message);
        setStatus('❌ Error al conectar con Firebase');
        console.error('Error de Firebase:', err);
      }
    };

    testFirebase();
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      margin: '20px 0', 
      border: '1px solid #ccc', 
      borderRadius: '5px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>Test de Conexión Firebase</h3>
      <div style={{ 
        padding: '10px', 
        backgroundColor: error ? '#ffebee' : '#e8f5e8',
        borderRadius: '3px'
      }}>
        <p>{status}</p>
        {error && (
          <details>
            <summary>Detalles del error</summary>
            <pre style={{ fontSize: '12px', color: '#d32f2f' }}>{error}</pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default SimpleFirebaseTest;