import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function RootLayout() {
  return ( 

<Tabs 

 screenOptions={{ headerShown: false, tabBarActiveTintColor: '#e9791eff',}}

>  
    
       
   <Tabs.Screen name="index" options={{ tabBarLabel: "Home", 
    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" color={color} size={size} /> }} />

   <Tabs.Screen name="Search" options={{ tabBarLabel: "Search", 
    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="magnify" color={color} size={size} />
   }} /> 

   <Tabs.Screen name="Grocerylist" options={{ tabBarLabel: "Grocery List",
    tabBarBadge: 3,
    tabBarBadgeStyle: { backgroundColor: 'green' },
    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-bulleted" color={color} size={size} />
   }} />

    <Tabs.Screen name="AI" options={{ tabBarLabel: "AI", 
    tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot" color={color} size={size} />
   }} />

</Tabs>

);

}

