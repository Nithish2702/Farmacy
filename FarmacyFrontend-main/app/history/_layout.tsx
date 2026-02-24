import { Stack } from 'expo-router';

export default function Layout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: {
                    margin: 0,
                    padding: 0,
                },
                animation: 'none',
            }}
        />
    );
}