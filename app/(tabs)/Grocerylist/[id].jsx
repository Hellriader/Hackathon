import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GroceryListDetail() {
  const router = useRouter();
  const { name, items } = useLocalSearchParams();
  const parsedItems = JSON.parse(items);

  const [toBuy, setToBuy] = useState(parsedItems);
  const [picked, setPicked] = useState([]);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const pickItem = (item) => {
    setToBuy(toBuy.filter((i) => i.name !== item.name));
    setPicked([...picked, item]);
  };

const dropItem = (item) => {
    setPicked(picked.filter((i) => i.name !== item.name));
    setToBuy([...toBuy, item]);
  };



  const total = [...toBuy, ...picked].reduce((acc, i) => acc + i.price, 0);
  const pickedTotal = picked.reduce((acc, i) => acc + i.price, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subTitle}>TO BUY TOTAL: ${total - pickedTotal}</Text>

      <FlatList
        data={toBuy}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => pickItem(item)}>
            <Text style={styles.itemText}>{item.name}</Text>
            <Text style={styles.price}>${item.price}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.totalBar} onPress={() => setOverlayVisible(true)}>
        <Text style={styles.totalText}>LIST TOTAL ${total} JMD</Text>
      </TouchableOpacity>

      <Modal visible={overlayVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>PICKED UP TOTAL: ${pickedTotal}</Text>
          <FlatList
            data={picked}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => dropItem(item)}>
                <Text style={styles.itemText}>{item.name}</Text>
                <Text style={styles.price}>${item.price}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setOverlayVisible(false)}>
            <Text style={styles.submitText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eee', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  subTitle: { fontSize: 14, marginBottom: 10 },
  item: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
  },
  itemText: { fontSize: 16 },
  price: { fontSize: 16, fontWeight: 'bold' },
  totalBar: {
    backgroundColor: '#008080',
    padding: 15,
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  totalText: { color: '#cdd400', textAlign: 'center', fontSize: 18 },
  overlay: {
    flex: 1,
    backgroundColor: '#ddd',
    marginTop: 200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  overlayTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  closeBtn: { backgroundColor: '#ffffffff', padding: 15, borderRadius: 8, marginTop: 10 },
  submitText: { color: '#000000ff', textAlign: 'center', fontSize: 16 },
});
