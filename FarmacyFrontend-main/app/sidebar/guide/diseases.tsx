import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useTheme } from '@/context/theme';

const DiseasesPage: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { colors, mode } = useTheme();
    const isDarkMode = mode === 'dark';
    
    return (
        <SafeAreaLayout
            backgroundColor={colors.background}
            statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
            edges={['top', 'left', 'right', 'bottom']}
            contentStyle={styles.container}
        >
            <ScrollView 
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            >
                <Text style={[styles.title, { color: colors.text }]}>Diseases Page</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    This is a sample screen displaying information about diseases.
                </Text>
            </ScrollView>
        </SafeAreaLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    description: {
        fontSize: 18,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

export default DiseasesPage;