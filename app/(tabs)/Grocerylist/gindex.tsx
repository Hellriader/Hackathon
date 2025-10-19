import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CreateListModal from '../../../components/CreateListModal';

export default function GroceryListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddList = (newList: any) => {
    setLists((prev) => [...prev, newList]);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GROCERY LISTS</Text>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
  style={styles.listItem}
  onPress={() =>
    router.push({
      pathname: '/Grocerylist/[id]'as any, // ✅ points to the dynamic [id].tsx
      params: {
        id: item.id,               // dynamic segment for URL
        name: item.name,           // passed to the page
        items: JSON.stringify(item.items), // convert array to string
      },
    })
  }
>
  <Text style={styles.listText}>{item.name}</Text>
</TouchableOpacity>


        )}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addText}>＋</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <CreateListModal onSubmit={handleAddList} onClose={() => setModalVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1c1c', padding: 20 },
  title: { color: '#fff', fontSize: 20, marginBottom: 10 },
  listItem: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginVertical: 5 },
  listText: { fontSize: 16 },
  addButton: {
    backgroundColor: '#0f0',
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 30,
    padding: 15,
  },
  addText: { fontSize: 25, color: '#000' },
});
