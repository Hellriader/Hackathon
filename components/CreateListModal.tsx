import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateListModal({ onSubmit, onClose }: { onSubmit: (list: any) => void; onClose: () => void }) {
  const [listName, setListName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const mockItems = ['Milk', 'Bread', 'Eggs', 'Apples', 'Juice', 'Cheese'];

  const toggleItem = (item: string) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter((i) => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleSubmit = () => {
    const newList = {
      id: Date.now(),
      name: listName || `List_${Date.now()}`,
      items: selectedItems.map((name) => ({ name, price: 999 })),
    };
    onSubmit(newList);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CREATE NEW LIST</Text>

      <TextInput
        style={styles.input}
        placeholder="List Name"
        placeholderTextColor="#999"
        value={listName}
        onChangeText={setListName}
      />

      <TextInput
        style={styles.input}
        placeholder="Search Item"
        placeholderTextColor="#999"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={mockItems.filter((item) => item.toLowerCase().includes(search.toLowerCase()))}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, selectedItems.includes(item) && styles.selectedItem]}
            onPress={() => toggleItem(item)}
          >
            <Text style={styles.itemText}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.submitText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eee', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#fff', padding: 10, marginVertical: 5, borderRadius: 8 },
  item: { padding: 10, backgroundColor: '#fff', marginVertical: 4, borderRadius: 8 },
  selectedItem: { backgroundColor: '#c0ffc0' },
  itemText: { fontSize: 16 },
  submitBtn: { backgroundColor: '#000', padding: 15, borderRadius: 8, marginTop: 10 },
  submitText: { color: '#fff', textAlign: 'center', fontSize: 16 },
  closeBtn: { backgroundColor: '#999', padding: 15, borderRadius: 8, marginTop: 10 },
});
