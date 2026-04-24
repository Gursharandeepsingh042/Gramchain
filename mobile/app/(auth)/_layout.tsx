import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="role-select">
      <Stack.Screen name="role-select" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="lender-login" />
      <Stack.Screen name="lender-signup" />
    </Stack>
  );
}
