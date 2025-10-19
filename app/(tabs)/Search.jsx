import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Ionicons from "react-native-vector-icons/Ionicons";

export default function Search() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(["Mackerel", "Grace Foods", "Noodles"]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    // If the user clears the input also clear results
    // if (query.trim().length === 0) {
    //   setProducts([]);
    //   setError(null);
    //   setLoading(false);
    //   return;
    // }

    // Debounce network calls by 400ms
    setLoading(true);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts(query.trim());
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function fetchProducts(q) {
    if (!q || !q.trim()) return [];
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `https://hackathon-qrdq.onrender.com/api/ai/${encodeURIComponent(q)}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }
      const data = await res.json();
      const rows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
        ? data
        : [];
      setProducts(rows);
    } catch (err) {
      console.warn("fetchProducts error", err);
      setError(err.message || "Failed to fetch");
      return [];
    } finally {
      setLoading(false);
    }
  }

  function onPressRecent(item) {
    setQuery(item);
    // fetchProducts will be triggered by useEffect through query change
  }

  function renderProduct({ item }) {
    // item may contain: id, name, price, parish, image_url, description
    return (
      <TouchableOpacity style={styles.storeRow} activeOpacity={0.8}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.storeThumb} />
        ) : (
          <View style={styles.storeThumb} />
        )}
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.storeName}>{item.name || "Untitled"}</Text>
          <Text style={styles.storeName}>{item.store || "Untitled"}</Text>

          {item.price !== undefined && (
            <Text style={styles.storePrice}>${item.price}</Text>
          )}
          <Text style={styles.storeLoc}>
            {item.parish || item.location || "Unknown"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.screenPadding}>
      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a product type (e.g. mackerel, noodles)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmit={() => fetchProducts(query)}
          />
        </View>

        <Text style={styles.recentLabel}>Your recent searches</Text>
        <View style={styles.recentRow}>
          {recent.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={styles.pill}
              onPress={() => onPressRecent(r)}
            >
              <Text>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: 10 }} />
        <View style={styles.topStoresHeader}>
          <Text style={styles.sectionTitle}>Top Stores Near You</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* Results area */}
        <View style={{ marginTop: 8 }} />

        {loading && (
          <View style={{ paddingVertical: 18 }}>
            <ActivityIndicator size="small" />
          </View>
        )}

        {/* {error ? (
          <Text style={{ color: "#cc0000", marginTop: 8 }}>Error: {error}</Text>
        ) : null} */}

        {!loading && products.length === 0 && query.trim().length > 0 && (
          <Text style={{ marginTop: 8, color: "#444" }}>
            No products found for "{query}"
          </Text>
        )}

        {/* Products list */}
        <FlatList
          data={products}
          keyExtractor={(it) => String(it.id || `${it.name}-${Math.random()}`)}
          renderItem={renderProduct}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => null}
          style={{ marginTop: 8 }}
        />

        {/* Fallback sample stores if no results or before search
        {(!query || query.trim().length === 0) && (
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.storeRow}>
                <View style={styles.storeThumb} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.storeName}>Name {i}</Text>
                  <Text style={styles.storeName}>Store {i}</Text>
                  <Text style={styles.storeLoc}>Location {i}</Text>
                </View>
              </View>
            ))}
          </>
        )} */}
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screenPadding: { padding: 12, paddingBottom: 40, paddingTop: 40 },

  /* Search */
  searchCard: {
    backgroundColor: "#d7d7d7",
    borderRadius: 10,
    padding: 12,
    margin: 0,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 22,
  },
  searchInput: { marginLeft: 8, flex: 1 },
  recentLabel: { marginTop: 10, fontWeight: "700" },
  recentRow: { flexDirection: "row", marginTop: 8, flexWrap: "wrap" },
  pill: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 20,
    marginRight: 8,
    marginTop: 6,
  },
  topStoresHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  seeAll: { textDecorationLine: "underline" },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    marginTop: 10,
  },
  storeThumb: {
    width: 70,
    height: 70,
    backgroundColor: "#9a9a9a",
    borderRadius: 6,
  },
  storeName: { fontWeight: "600" },
  storePrice: { marginTop: 4, fontWeight: "600" },
  storeLoc: { color: "#666" },
  sectionTitle: { fontWeight: "700" },
});
