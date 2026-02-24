import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme';

interface CropCardProps {
  id: number;
  name: string;
  variety?: string;
  imageUrl?: string;
  onPress?: () => void;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const CropCard: React.FC<CropCardProps> = ({
  id,
  name,
  variety,
  imageUrl,
  onPress,
}) => {
  const router = useRouter();
  const { mode } = useTheme();
  const isDarkMode = mode === 'dark';

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/crop/${id}` as any);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#374151' : '#FFFFFF',
        },
      ]}
      onPress={handlePress}
    >
      <Image
        source={
          imageUrl
            ? { uri: imageUrl }
            : require('@/assets/farm_field_sunrise.jpg')
        }
        style={styles.image}
      />
      <View style={styles.content}>
        <Text
          style={[
            styles.name,
            {
              color: isDarkMode ? '#F9FAFB' : '#1F2937',
            },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {variety && (
          <Text
            style={[
              styles.variety,
              {
                color: isDarkMode ? '#D1D5DB' : '#6B7280',
              },
            ]}
            numberOfLines={1}
          >
            {variety}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: cardWidth,
    resizeMode: 'cover',
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  variety: {
    fontSize: 14,
  },
});

export default CropCard; 