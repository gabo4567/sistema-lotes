// mobile-app/src/screens\MedicionesScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, RefreshControl, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../services/firebase";
import { API_URL } from "../utils/constants";

export default function MedicionesScreen({ navigation }) {
  const [mediciones, setMediciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const loadMediciones = async () => {
    try {
      setLoading(true);
      setError("");
      
      const tokenResult = await auth.currentUser?.getIdTokenResult();
      const ipt = tokenResult?.claims?.ipt;
      const idToken = await auth.currentUser?.getIdToken();
      
      console.log("🔍 Debug - Token result:", tokenResult);
      console.log("🔍 Debug - IPT encontrado:", ipt);
      console.log("🔍 Debug - User UID:", auth.currentUser?.uid);
      
      if (!ipt || !idToken) {
        setError(`No estás autenticado o no tienes IPT asignado. IPT: ${ipt || 'null'}`);
        return;
      }

      console.log("📊 Cargando mediciones para IPT:", ipt);
      
      const resp = await fetch(`${API_URL}/mediciones?productor=${ipt}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      
      if (!resp.ok) {
        throw new Error(`Error ${resp.status}: ${resp.statusText}`);
      }
      
      const data = await resp.json();
      console.log("📋 Mediciones cargadas:", data.length);
      console.log("📋 Data completa:", data);
      setMediciones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("❌ Error cargando mediciones:", e);
      setError(e.message || "Error al cargar mediciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMediciones();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadMediciones);
    return unsub;
  }, [navigation]);

  const formatFecha = (fecha) => {
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-AR');
    } catch {
      return fecha;
    }
  };

  const getTipoColor = (tipo) => {
    const colores = {
      'superficie': '#3498db',
      'plantas/ha': '#2ecc71',
      'inspección': '#e74c3c',
      'default': '#95a5a6'
    };
    return colores[tipo?.toLowerCase()] || colores.default;
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setImageModalVisible(false);
  };

  const renderMedicion = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.tipoText}>{item.tipo || 'Sin tipo'}</Text>
        <View style={[styles.tipoBadge, { backgroundColor: getTipoColor(item.tipo) }]}>
          <Text style={styles.tipoBadgeText}>{item.tipo || 'Otro'}</Text>
        </View>
      </View>
      
      <Text style={styles.loteText}>Lote: {item.lote || 'Sin lote'}</Text>
      
      {item.valorNumerico != null && (
        <Text style={styles.valorText}>Valor: {item.valorNumerico}</Text>
      )}
      
      <Text style={styles.fechaText}>Fecha: {formatFecha(item.fecha)}</Text>
      
      {item.observaciones ? (
        <Text style={styles.obsText}>Obs: {item.observaciones}</Text>
      ) : null}
      
      {item.tecnicoResponsable ? (
        <Text style={styles.tecnicoText}>Técnico: {item.tecnicoResponsable}</Text>
      ) : null}
      
      {item.evidenciaUrl ? (
        <TouchableOpacity style={styles.imageContainer} onPress={() => openImageModal(item.evidenciaUrl)}>
          <Image source={{ uri: item.evidenciaUrl }} style={styles.medicionImage} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.itemActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionEdit]} onPress={() => navigation.navigate('EditMedicion', { medicion: item })}>
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionDelete]} onPress={() => confirmDelete(item.id)}>
          <Text style={styles.actionText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const confirmDelete = (id) => {
    Alert.alert('Eliminar medición', 'Esta acción la marcará como inactiva. ¿Confirmás?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => handleDelete(id) },
    ]);
  };

  const handleDelete = async (id) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_URL}/mediciones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!resp.ok) throw new Error('No se pudo eliminar');
      await loadMediciones();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo eliminar');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Mediciones</Text>
        <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        <Text style={styles.loadingText}>Cargando mediciones...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Mediciones</Text>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { marginBottom: Math.max(insets.bottom, 24) }]} onPress={loadMediciones}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (mediciones.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Mis Mediciones</Text>
        <Text style={styles.emptyText}>No tienes mediciones registradas</Text>
        <TouchableOpacity style={[styles.retryButton, { marginBottom: Math.max(insets.bottom, 24) }]} onPress={loadMediciones}>
          <Text style={styles.retryButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={styles.title}>Mis Mediciones</Text>
      
      <TouchableOpacity 
        style={[styles.createButton, { marginBottom: Math.max(insets.bottom, 24) }]} 
        onPress={() => navigation.navigate('CrearMedicion')}
      >
        <Text style={styles.createButtonText}>➕ Nueva Medición</Text>
      </TouchableOpacity>
      
      <FlatList
        data={mediciones}
        keyExtractor={(item) => item.id}
        renderItem={renderMedicion}
        contentContainerStyle={[styles.listContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadMediciones} />
        }
      />

      <Modal visible={imageModalVisible} transparent animationType="fade" onRequestClose={closeImageModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedImage ? <Image source={{ uri: selectedImage }} style={styles.modalImage} /> : null}
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeImageModal}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  loadingText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginTop: 10,
  },
  error: {
    color: '#e74c3c',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 16,
    marginVertical: 30,
  },
  listContainer: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipoText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  tipoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  tipoBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  loteText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 4,
  },
  valorText: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 4,
  },
  fechaText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  obsText: {
    fontSize: 14,
    color: '#34495e',
    marginTop: 4,
    fontStyle: 'italic',
  },
  tecnicoText: {
    fontSize: 14,
    color: '#8e44ad',
    marginTop: 4,
  },
  imageContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  medicionImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  itemActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionEdit: { backgroundColor: '#3498db' },
  actionDelete: { backgroundColor: '#e74c3c' },
  actionText: { color: '#fff', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});