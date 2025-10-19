import { Audio } from "expo-av";
import { PlusCircle } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { speakText } from "../../components/ttsExpo";
// import Shlogoai from '././assets/shoply-logo-with-ai.png';

/**
 * Expo-managed workflow voice-to-text Shoply AI
 */
export default function Page() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(() => {
    const prompts = [
      "Lowest price cornbeef",
      "Most affordable meats",
      "Show me a list of soaps",
      "I want chocolate sweets",
      "Snacks for a hackathon",
    ];
    return prompts.map((p, i) => ({
      id: `prompt-${i}`,
      type: "prompt",
      text: p,
    }));
  });

  // Recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const flatRef = useRef(null);
  const nextId = useRef(0);

  function pushItems(newItems = []) {
    setItems((prev) => [
      ...prev,
      ...newItems.map((it) => ({ ...it, id: it.id ?? `${++nextId.current}` })),
    ]);
  }

  useEffect(() => {
    if (!flatRef.current) return;
    const t = setTimeout(() => {
      flatRef.current.scrollToEnd?.({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [items.length]);

  async function fetchResponse(q) {
    if (!q || !q.trim()) return [];
    try {
      setLoading(true);
      setError(null);

      // remove extra slash – make URL deterministic
      const res = await fetch(
        `https://hackathon-qrdq.onrender.com/api/ai-first/${encodeURIComponent(
          q
        )}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }

      const text = await res.text();

      // Use the correct setter name (adjust if your state is different)
      console.log("AI response:", text);
      return text;
    } catch (err) {
      console.warn("fetchProducts error", err);
      setError(err.message || "Failed to fetch");
      return [];
    } finally {
      setLoading(false);
    }
  }

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
      return rows;
    } catch (err) {
      console.warn("fetchProducts error", err);
      setError(err.message || "Failed to fetch");
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function submitQuery(q) {
    const trimmed = (q || "").trim();
    if (!trimmed) return;

    pushItems([{ type: "user", text: trimmed, id: `user-${Date.now()}` }]);
    setQuery("");
    Keyboard.dismiss();

    const aiText = await fetchResponse(trimmed);

    const rows = await fetchProducts(trimmed);

    if (rows.length) {
      pushItems([
        {
          type: "assistant",
          text: aiText,
          id: `assistant-summary-${Date.now()}`,
        },
      ]);
      const productItems = rows.map((p, i) => ({
        type: "product",
        product: p,
        id: `product-${Date.now()}-${i}`,
      }));
      speakText(aiText, { language: "en-US", rate: 0.9 });
      pushItems(productItems);
    } else {
      pushItems([
        {
          type: "assistant",
          text: error ? `Error: ${error}` : "No results found",
          id: `assistant-none-${Date.now()}`,
        },
      ]);
    }
  }

  // Prompt tap
  function onPromptPress(text) {
    submitQuery(text);
  }

  // -------------------- VOICE FUNCTIONS --------------------
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission required",
          "Microphone access is required for voice input."
        );
        return;
      }

      setIsRecording(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await newRecording.startAsync();
      setRecording(newRecording);
    } catch (err) {
      console.warn("startRecording error", err);
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    try {
      setIsRecording(false);
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Send audio to server (Whisper/OpenAI) to get text
      const transcript = await sendAudioToWhisper(uri);
      if (transcript) {
        setQuery(transcript);
        submitQuery(transcript); // optional auto-submit
      }
    } catch (err) {
      console.warn("stopRecording error", err);
    }
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  // -------------------- PLACEHOLDER TRANSCRIPTION --------------------
  async function sendAudioToWhisper(uri) {
    // Example placeholder: implement your API call here
    // You would send the audio file to a server/Whisper endpoint
    // Return the transcription string
    console.log("Send audio to server for transcription:", uri);
    // Mock transcription for demo:
    return "Mocked transcription from voice";
  }

  // -------------------- RENDERING --------------------
  function renderItem({ item }) {
    switch (item.type) {
      case "prompt":
        return (
          <TouchableOpacity
            style={styles.prompt}
            onPress={() => onPromptPress(item.text)}
          >
            <Text style={{ fontSize: 16 }}>{item.text}</Text>
          </TouchableOpacity>
        );

      case "user":
        return (
          <View style={[styles.bubbleRow, { justifyContent: "flex-end" }]}>
            <View style={styles.userBubble}>
              <Text style={styles.userBubbleText}>{item.text}</Text>
            </View>
          </View>
        );

      case "assistant":
        return (
          <View style={[styles.bubbleRow, { justifyContent: "flex-start" }]}>
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantBubbleText}>{item.text}</Text>
            </View>
          </View>
        );

      case "product": {
        const p = item.product || {};
        return (
          <TouchableOpacity style={styles.productCard} activeOpacity={0.9}>
            {p.image_url ? (
              <Image
                source={{ uri: p.image_url }}
                style={styles.productThumb}
              />
            ) : (
              <View style={styles.productThumb} />
            )}

            {/* Make this a row so we can anchor the button to the right */}
            <View
              style={{
                flex: 1,
                marginLeft: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {/* Left: product info stretches */}
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{p.name || "Untitled"}</Text>

                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {p.old_price != null && (
                    <Text
                      style={[
                        styles.productPrice,
                        { textDecorationLine: "line-through", color: "#888" },
                      ]}
                    >
                      ${p.old_price}
                    </Text>
                  )}
                  {p.price !== undefined && (
                    <Text
                      style={[
                        styles.productPrice,
                        { fontWeight: "700", color: "#000" },
                      ]}
                    >
                      {`$${p.price}`}
                    </Text>
                  )}
                </View>

                <Text style={styles.productLoc}>
                  {p.store || p.location || "Unknown"}
                </Text>
              </View>

              {/* Right: Add button anchored to the right */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  try {
                    const addItem = globalThis?.addItemToActiveList2;
                    if (typeof addItem !== "function") {
                      Alert.alert("Error", "List functionality not available.");
                      return;
                    }

                    const listName = p.store || "Default";
                    const newItemId = addItem(listName, {
                      text: p.name || "Untitled",
                      price: p.price ?? 0,
                      quantity: 1,
                      image: p.image_url || "",
                    });

                    if (newItemId) {
                      Alert.alert(
                        "Added",
                        `${p.name || "Item"} added to ${listName}`
                      );
                    } else {
                      Alert.alert(
                        "Not added",
                        "Could not add item (missing data)."
                      );
                    }
                  } catch (err) {
                    console.warn("add to list error", err);
                    Alert.alert(
                      "Error",
                      "An error occurred while adding the item."
                    );
                  }
                }}
                style={{
                  marginLeft: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: "#0a84ff",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  // shadow (iOS) + elevation (Android)
                  shadowColor: "#000",
                  shadowOpacity: 0.15,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 3,
                  elevation: 3,
                }}
              >
                <PlusCircle size={18} color="#fff" />
                <Text
                  style={{ color: "#fff", marginLeft: 8, fontWeight: "600" }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }

      default:
        return null;
    }
  }

  function clearAll() {
    setQuery("");
    const prompts = [
      "Show me red shoes",
      "Affordable folding bikes",
      "Bluetooth headphones under $50",
      "Eco-friendly cleaning supplies",
      "Men's running shoes",
    ];
    setItems(
      prompts.map((p, i) => ({ id: `prompt-${i}`, type: "prompt", text: p }))
    );
    setError(null);
  }

 return (
    <View style={styles.container}>
      <Image source={require("../../assets/images/Shoply-Logo-with-ai.png")} // Directly use the imported image
        style={styles.image} 
      />

      <FlatList
        ref={flatRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => it.id ?? JSON.stringify(it)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={<View style={{ height: 20 }} />}
      />

      <View
        style={[
          styles.inputRow,
          Platform.OS === "ios" ? { paddingBottom: 24 } : null,
        ]}
      >
        <TextInput
          placeholder="Ask Shoply a question"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submitQuery(query)}
          returnKeyType="search"
        />

        {/* Voice button */}
        <TouchableOpacity
          onPress={toggleRecording}
          style={[
            styles.iconBtn,
            isRecording ? { backgroundColor: "#f44" } : null,
          ]}
        >
          <Ionicons
            name={isRecording ? "mic" : "mic-outline"}
            size={18}
            color={isRecording ? "#fff" : "#000"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { marginLeft: 8 }]}
          onPress={() => submitQuery(query)}
        >
          <Ionicons name="send" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    paddingTop: 48,
    backgroundColor: "#f2f2f2",
  },
  header: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  divider: { height: 1, backgroundColor: "#ddd", marginVertical: 12 },
  listContent: { paddingHorizontal: 8, paddingBottom: 8 },

  bubbleRow: { flexDirection: "row", marginVertical: 6, paddingHorizontal: 8 },
  userBubble: {
    maxWidth: "78%",
    alignSelf: "flex-end",
    backgroundColor: "#0a84ff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userBubbleText: { color: "#fff", fontSize: 15 },
  assistantBubble: {
    maxWidth: "78%",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  assistantBubbleText: { color: "#222", fontSize: 15 },

  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginVertical: 6,
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  productName: { fontWeight: "700" },
  productPrice: { marginTop: 4 },
  productLoc: { marginTop: 4, color: "#666" },

  prompt: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 14,
    marginBottom: 12,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 50,
    marginTop: 8,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  iconBtn: {
    marginLeft: 8,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: 200,
    height: 160,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 12,
  },
});
