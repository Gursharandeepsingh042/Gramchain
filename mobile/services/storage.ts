import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = {
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  getString: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  remove: (key: string) => AsyncStorage.removeItem(key),
}
