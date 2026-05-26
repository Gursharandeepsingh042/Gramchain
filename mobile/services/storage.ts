import AsyncStorage from '@react-native-async-storage/async-storage'

// TODO: Switch to MMKV for better performance - requires TypeScript config investigation
// react-native-mmkv package is installed but has TypeScript compatibility issues
// with the current configuration. Reverting to AsyncStorage for stability.
export const storage = {
  set: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value)
  },
  getString: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  remove: async (key: string) => {
    await AsyncStorage.removeItem(key)
  },
}
