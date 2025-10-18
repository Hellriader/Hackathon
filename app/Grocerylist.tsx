import React from 'react'
import { StyleSheet, View } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'

export default function GroceryList() {
  return (
    <View style ={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TextInput>Grocery List  Screen</TextInput>
    </View>
  )
}

const styles = StyleSheet.create({})
