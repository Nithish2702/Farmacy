import { Stack } from 'expo-router';

export default function DiseaseLayout() {
  return (
    <Stack
      initialRouteName="index"
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="stage"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
} 