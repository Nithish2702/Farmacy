import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

interface StageFilterProps {
  selectedStage: number | null;
  onStageSelect: (stage: number | null) => void;
  isDarkMode?: boolean;
}

const stages = [
  { id: 1, name: 'Seed', icon: 'leaf-outline' as const },
  { id: 2, name: 'Germination', icon: 'leaf-outline' as const },
  { id: 3, name: 'Seedling', icon: 'leaf' as const },
  { id: 4, name: 'Vegetative', icon: 'eye-outline' as const },
  { id: 5, name: 'Flowering', icon: 'flower-outline' as const },
  { id: 6, name: 'Fruiting', icon: 'nutrition-outline' as const },
  { id: 7, name: 'Maturity', icon: 'checkmark-circle-outline' as const },
  { id: 8, name: 'Harvest', icon: 'basket-outline' as const },
];

const StageFilter: React.FC<StageFilterProps> = ({
  selectedStage,
  onStageSelect,
  isDarkMode = false,
}) => {
  const handleStagePress = useCallback((stageId: number) => {
    if (selectedStage === stageId) {
      onStageSelect(null); // Deselect if already selected
    } else {
      onStageSelect(stageId);
    }
  }, [selectedStage, onStageSelect]);

  const handleClearSelection = useCallback(() => {
    onStageSelect(null);
  }, [onStageSelect]);

  const renderStageChip = useCallback((stage: typeof stages[0]) => {
    const isSelected = selectedStage === stage.id;
    return (
      <TouchableOpacity
        key={stage.id}
        style={[
          styles.stageChip,
          {
            backgroundColor: isSelected
              ? '#4CAF50'
              : isDarkMode
              ? '#374151'
              : '#F3F4F6',
            borderColor: isSelected
              ? '#4CAF50'
              : isDarkMode
              ? '#4B5563'
              : '#E5E7EB',
          }
        ]}
        onPress={() => handleStagePress(stage.id)}
      >
        <Ionicons
          name={stage.icon}
          size={16}
          color={
            isSelected
              ? 'white'
              : isDarkMode
              ? '#D1D5DB'
              : '#6B7280'
          }
        />
        <Text
          style={[
            styles.stageText,
            {
              color: isSelected
                ? 'white'
                : isDarkMode
                ? '#D1D5DB'
                : '#6B7280',
            }
          ]}
        >
          {stage.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedStage, isDarkMode, handleStagePress]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[
          styles.title,
          { color: isDarkMode ? '#F9FAFB' : '#374151' }
        ]}>
          Filter by Growth Stage
        </Text>
        {selectedStage && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearSelection}
          >
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stagesContainer}
      >
        {stages.map(renderStageChip)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: wp('2%'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    marginBottom: wp('3%'),
  },
  title: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: wp('3%'),
    paddingVertical: wp('1%'),
  },
  clearAllText: {
    color: '#EF4444',
    fontSize: RFValue(12),
    fontWeight: '500',
  },
  stagesContainer: {
    paddingHorizontal: wp('4%'),
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: wp('2%'),
    borderRadius: wp('5%'),
    marginRight: wp('2%'),
    borderWidth: 1,
  },
  stageText: {
    fontSize: RFValue(12),
    fontWeight: '500',
    marginLeft: wp('1%'),
  },
});

export default StageFilter;