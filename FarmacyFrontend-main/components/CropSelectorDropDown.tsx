import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  BackHandler,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { useCropsContext } from '@/context/CropsContext';
import { Crop } from '@/api/cropService';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CropSelectorDropdownProps {
  isDarkMode?: boolean;
  selectSingle?: boolean;
  onCropSelect?: (crop: Crop | null) => void;
  onMultipleCropSelect?: (crops: Crop[]) => void;
  defaultSelectedCrop?: { id: number; name: string } | null;
}

const CropSelectorDropdown: React.FC<CropSelectorDropdownProps> = ({
  isDarkMode = false,
  selectSingle = true,
  onCropSelect,
  onMultipleCropSelect,
  defaultSelectedCrop,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCrops, setFilteredCrops] = useState<Crop[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<{ id: number; name: string } | null>(defaultSelectedCrop || null);
  const [selectedCrops, setSelectedCrops] = useState<{ id: number; name: string }[]>([]);
  
  const { crops, loading, error, loadCrops } = useCropsContext();
  const { t } = useTranslation();
  const { mode, colors } = useTheme();
  
  // Animation values using react-native-reanimated
  const translateY = useSharedValue(SCREEN_HEIGHT * 0.85);
  const backdropOpacity = useSharedValue(0);
  
  // Use theme colors instead of hardcoded isDarkMode
  const themeColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
    modalBackground: mode === 'dark' ? '#1F2937' : '#FFFFFF',
    pickerBackground: mode === 'dark' ? '#374151' : '#F9FAFB',
    dropdownBackground: mode === 'dark' ? '#374151' : '#FFFFFF',
    searchBackground: mode === 'dark' ? '#4B5563' : '#F3F4F6',
  };

  // Always try to load crops if not present
  useEffect(() => {
    if (crops.length === 0 && !loading.crops) {
      console.log('[CropSelectorDropdown] No crops found, calling loadCrops(true)');
      loadCrops(true);
    } else {
      console.log('[CropSelectorDropdown] Crops present or loading:', crops.length, loading.crops);
    }
  }, [crops.length, loading.crops, loadCrops]);

  useEffect(() => {
    if (crops.length > 0) {
      const filtered = crops.filter((crop: Crop) =>
        crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        crop.variety.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCrops(filtered);
    } else {
      setFilteredCrops([]);
    }
  }, [crops, searchQuery]);

  useEffect(() => {
    setSelectedCrop(defaultSelectedCrop || null);
  }, [defaultSelectedCrop]);

  // Callback to close modal from animation
  const handleModalClose = useCallback(() => {
    setIsVisible(false);
    setSearchQuery('');
  }, []);

  // Smoother open/close animations with reduced overshoot
  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(0, {
        damping: 25, // Increased damping for more stability
        stiffness: 150, // Reduced stiffness to prevent jittering
        mass: 1.2, // Slightly increased mass for smoother movement
        overshootClamping: true, // Prevent overshoot
        restDisplacementThreshold: 0.5, // Increased threshold
        restSpeedThreshold: 2, // Increased threshold
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT * 0.85, {
        damping: 30,
        stiffness: 120, // Reduced stiffness for closing
        mass: 1.5, // Increased mass for smoother closing
        overshootClamping: true,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 2,
      });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isVisible]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isVisible) {
        closeModal();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVisible]);

  const groupedCrops = React.useMemo(() => {
    return filteredCrops.reduce((acc, crop) => {
      if (!acc[crop.name]) {
        acc[crop.name] = [];
      }
      acc[crop.name].push(crop);
      return acc;
    }, {} as Record<string, Crop[]>);
  }, [filteredCrops]);

  const openModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const closeModal = useCallback(() => {
      setIsVisible(false);
      setSearchQuery('');
  }, []);

  // PanResponder for drag-to-close functionality (only on drag handle)
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        const dy = Math.max(0, gestureState.dy);
        translateY.value = dy;
        
        const progress = Math.min(dy / 200, 1);
        backdropOpacity.value = Math.max(1 - progress * 0.7, 0.3);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const shouldClose = gestureState.dy > 100 || gestureState.vy > 0.5;
        
        if (shouldClose) {
          const modalHeight = SCREEN_HEIGHT * 0.85;
          translateY.value = withSpring(modalHeight, {
            damping: 30,
            stiffness: 120, // Match the closing animation
            mass: 1.5,
            overshootClamping: true,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 2,
          });
          backdropOpacity.value = withTiming(0, { duration: 250 });
          setTimeout(() => runOnJS(handleModalClose)(), 250);
        } else {
          translateY.value = withSpring(0, {
            damping: 25, // Match the opening animation
            stiffness: 150,
            mass: 1.2,
            overshootClamping: true,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 2,
          });
          backdropOpacity.value = withTiming(1, { duration: 300 });
        }
      },
    })
  ).current;

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      // Add layout stabilization
      backfaceVisibility: 'hidden',
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Header animation based on scroll
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 50],
      [1, 0.8],
      Extrapolate.CLAMP
    );
    return {
      opacity,
    };
  });

  const selectCrop = useCallback((crop: Crop) => {
    const cropSelection = { id: crop.id, name: crop.variety ? `${crop.variety} ${crop.name}` : crop.name };
    
    if (selectSingle) {
      setSelectedCrop(cropSelection);
      onCropSelect?.(crop);
      closeModal();
    } else {
      const isSelected = selectedCrops.some(selected => selected.id === crop.id);
      let newSelectedCrops;
      
      if (isSelected) {
        newSelectedCrops = selectedCrops.filter(selected => selected.id !== crop.id);
      } else {
        newSelectedCrops = [...selectedCrops, cropSelection];
      }
      
      setSelectedCrops(newSelectedCrops);
      const selectedCropIds = newSelectedCrops.map(sel => sel.id);
      const selectedCropObjs = crops.filter(c => selectedCropIds.includes(c.id));
      onMultipleCropSelect?.(selectedCropObjs);
    }
  }, [selectSingle, selectedCrops, onCropSelect, onMultipleCropSelect, closeModal, crops]);

  const clearSelection = useCallback(() => {
    if (selectSingle) {
      setSelectedCrop(null);
      onCropSelect?.(null);
    } else {
      setSelectedCrops([]);
      onMultipleCropSelect?.([]);
    }
    closeModal();
  }, [selectSingle, onCropSelect, onMultipleCropSelect, closeModal]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const isItemSelected = useCallback((crop: Crop) => {
    if (selectSingle) {
      return selectedCrop?.id === crop.id;
    } else {
      return selectedCrops.some(selected => selected.id === crop.id);
    }
  }, [selectSingle, selectedCrop, selectedCrops]);

  const renderSelectedCropsPreview = useCallback(() => {
    if (selectSingle || selectedCrops.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.selectedCropsContainer}
        contentContainerStyle={styles.selectedCropsContent}
      >
        {selectedCrops.map((crop, index) => (
          <View
            key={crop.id}
            style={[
              styles.selectedCropChip,
              { backgroundColor: themeColors.success }
            ]}
          >
            <Text
              style={[
                styles.selectedCropChipText,
                { color: themeColors.white }
              ]}
            >
              {crop.name}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const newSelected = selectedCrops.filter(s => s.id !== crop.id);
                setSelectedCrops(newSelected);
                const selectedCropIds = newSelected.map(sel => sel.id);
                const selectedCropObjs = crops.filter(c => selectedCropIds.includes(c.id));
                onMultipleCropSelect?.(selectedCropObjs);
              }}
              style={styles.chipRemoveButton}
            >
              <Ionicons
                name="close"
                size={14}
                color={themeColors.white}
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  }, [selectSingle, selectedCrops, themeColors, onMultipleCropSelect, crops]);

  const renderCropItem = React.useCallback(({ item: crop }: { item: Crop }) => {
    const isSelected = isItemSelected(crop);
    
    return (
      <TouchableOpacity
        style={[
          styles.cropItem,
          { 
            backgroundColor: themeColors.card,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? themeColors.success : themeColors.border
          }
        ]}
        onPress={() => selectCrop(crop)}
        activeOpacity={0.8}
      >
        <View style={styles.cropImageContainer}>
          {crop.image_urls?.[0] ? (
            <Image
              source={{ uri: crop.image_urls[0] }}
              style={styles.cropItemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cropItemImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>
                {crop.variety ? crop.variety[0]?.toUpperCase() : crop.name[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* Selection indicator */}
          <View style={styles.selectionIndicator}>
            {isSelected ? (
              <View style={[
                styles.checkbox,
                styles.checkboxSelected,
                { backgroundColor: themeColors.success }
              ]}>
                <Ionicons name="checkmark" size={12} color={themeColors.white} />
              </View>
            ) : (
              <View style={[
                styles.checkbox,
                { 
                  borderColor: themeColors.textSecondary,
                  backgroundColor: themeColors.card
                }
              ]} />
            )}
          </View>
        </View>
        
        <View style={styles.cropItemInfo}>
          <Text 
            style={[
              styles.cropItemName,
              { 
                color: themeColors.text,
                fontWeight: isSelected ? '600' : '500'
              }
            ]}
            numberOfLines={2}
          >
            {crop.variety ? `${crop.variety} ${crop.name}` : crop.name}
          </Text>
          <Text 
            style={[
              styles.cropItemCategory,
              { color: themeColors.textSecondary }
            ]}
            numberOfLines={1}
          >
            {crop.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [themeColors, selectCrop, isItemSelected]);

  const renderCropGroup = React.useCallback(({ item }: { item: [string, Crop[]] }) => {
    const [cropName, cropList] = item;
    return (
      <View style={[
        styles.cropSection,
        { backgroundColor: themeColors.background }
      ]}>
        <Text style={[
          styles.cropSectionTitle,
          { color: themeColors.text }
        ]}>
          {cropName}
        </Text>
        <View style={styles.cropGrid}>
          {cropList.map((crop) => (
            <View key={crop.id} style={styles.cropGridItem}>
              {renderCropItem({ item: crop })}
            </View>
          ))}
        </View>
      </View>
    );
  }, [themeColors, renderCropItem]);

  const renderLoading = React.useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={themeColors.success} />
      <Text style={[
        styles.loadingText,
        { color: themeColors.textSecondary }
      ]}>
        Loading crops...
      </Text>
    </View>
  ), [themeColors.success, themeColors.textSecondary]);

  const renderError = React.useCallback(() => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={32} color={themeColors.accent} />
      <Text style={[
        styles.errorText,
        { color: themeColors.text }
      ]}>
        Failed to load crops
      </Text>
    </View>
  ), [themeColors.accent, themeColors.text]);

  const renderEmptyState = React.useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="leaf-outline" size={48} color={themeColors.textSecondary} />
      <Text style={[
        styles.emptyText,
        { color: themeColors.textSecondary }
      ]}>
        {t('cropSelector.noCropsFound')}
      </Text>
    </View>
  ), [themeColors.textSecondary]);

  const hasSelection = React.useMemo(() => 
    selectSingle ? selectedCrop !== null : selectedCrops.length > 0,
    [selectSingle, selectedCrop, selectedCrops]
  );

  return (
    <>
      {/* Selector Button */}
      <TouchableOpacity
        style={[
          styles.selectorButton,
          {
            backgroundColor: themeColors.dropdownBackground,
            borderColor: themeColors.border,
          }
        ]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <View style={styles.selectorContent}>
          <Text
            style={[
              styles.selectorText,
              {
                color: themeColors.text,
              }
            ]}
            numberOfLines={1}
          >
            {selectSingle
              ? selectedCrop?.name || t('crops.selectCrop', 'Select a crop')
              : selectedCrops.length > 0
                ? `${selectedCrops.length} crops selected`
                : t('crops.selectCrops', 'Select crops')
            }
          </Text>
          <Ionicons
            name="chevron-down"
            size={24}
            color={themeColors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {renderSelectedCropsPreview()}

      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
        hardwareAccelerated={true}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        
          <Animated.View
            style={[
              styles.modalContent,
              { 
              backgroundColor: themeColors.modalBackground,
            },
            modalAnimatedStyle,
          ]}
        >
          {/* Drag Handle - ONLY this area can drag */}
          <Animated.View 
            style={[styles.dragIndicatorContainer, headerAnimatedStyle]}
            {...handlePanResponder.panHandlers}
          >
            <View style={[styles.dragIndicator, { backgroundColor: themeColors.textSecondary }]} />
          </Animated.View>

          <Animated.View style={[
              styles.modalHeader,
            { borderBottomColor: themeColors.border },
            headerAnimatedStyle
            ]}>
              <Text style={[
                styles.modalTitle,
              { color: themeColors.text }
              ]}>
                {selectSingle ? t('cropSelector.title') : t('cropSelector.titleMultiple')}
              </Text>
              <View style={styles.headerActions}>
                {!selectSingle && selectedCrops.length > 0 && (
                  <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: themeColors.success }]}
                    onPress={closeModal}
                  activeOpacity={0.8}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              <TouchableOpacity 
                onPress={closeModal} 
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                  <Ionicons 
                    name="close" 
                    size={24} 
                  color={themeColors.text} 
                  />
                </TouchableOpacity>
              </View>
          </Animated.View>

            <View style={[
              styles.searchContainer,
            { backgroundColor: themeColors.searchBackground }
            ]}>
              <Ionicons 
                name="search" 
                size={20} 
              color={themeColors.textSecondary} 
              />
              <TextInput
                style={[
                  styles.searchInput,
                { color: themeColors.text }
                ]}
                placeholder="Search crops..."
              placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>

            {hasSelection && (
              <View style={styles.clearSelectionContainer}>
                <TouchableOpacity
                style={[
                  styles.clearButton,
                  { 
                    backgroundColor: mode === 'dark' ? '#2D1B1B' : '#FEF2F2',
                    borderColor: mode === 'dark' ? '#451A1A' : '#FECACA'
                  }
                ]}
                  onPress={clearSelection}
                activeOpacity={0.8}
                >
                <Ionicons name="close-circle" size={16} color={themeColors.accent} />
                <Text style={[styles.clearButtonText, { color: themeColors.accent }]}>Clear Selection</Text>
                </TouchableOpacity>
              </View>
            )}

            {loading.crops ? (
              renderLoading()
            ) : error ? (
              renderError()
            ) : Object.keys(groupedCrops).length === 0 ? (
              renderEmptyState()
            ) : (
              <FlatList
                data={Object.entries(groupedCrops)}
                keyExtractor={([cropName]) => cropName}
                renderItem={renderCropGroup}
                contentContainerStyle={styles.modalList}
                showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="auto"
              />
            )}
          </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('2%'),
    borderWidth: 1,
    marginRight: wp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  selectorText: {
    fontSize: RFValue(14),
    fontWeight: '500',
    marginRight: wp('2%'),
  },
  selectedCropsContainer: {
    marginTop: wp('2%'),
    maxHeight: wp('12%'),
  },
  selectedCropsContent: {
    paddingHorizontal: wp('2%'),
  },
  selectedCropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: wp('1.5%'),
    borderRadius: wp('4%'),
    marginRight: wp('2%'),
  },
  selectedCropChipText: {
    fontSize: RFValue(12),
    fontWeight: '500',
  },
  chipRemoveButton: {
    marginLeft: wp('1.5%'),
    padding: wp('0.5%'),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '85%',
    borderTopLeftRadius: wp('6%'),
    borderTopRightRadius: wp('6%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 25,
    // Add layout stabilization
    overflow: 'hidden',
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: hp('2%'),
    paddingTop: hp('2.5%'),
  },
  dragIndicator: {
    width: wp('12%'),
    height: hp('0.6%'),
    borderRadius: wp('3%'),
    opacity: 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('4%'),
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('2%'),
    borderRadius: wp('2%'),
    marginRight: wp('3%'),
  },
  doneButtonText: {
    color: 'white',
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  closeButton: {
    padding: wp('1%'),
    borderRadius: wp('2%'),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('3%'),
    borderRadius: wp('3%'),
  },
  searchInput: {
    flex: 1,
    marginLeft: wp('2%'),
    fontSize: RFValue(14),
  },
  clearSelectionContainer: {
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('2.5%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: RFValue(13),
    fontWeight: '500',
    marginLeft: wp('1.5%'),
  },
  modalList: {
    paddingBottom: wp('8%'),
  },
  cropSection: {
    margin: wp('2%'),
    marginHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    padding: wp('3%'),
  },
  cropSectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: wp('3%'),
    paddingHorizontal: wp('1%'),
  },
  cropGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: wp('1%'),
  },
  cropGridItem: {
    width: '48%',
    marginBottom: wp('4%'),
  },
  cropItem: {
    alignItems: 'center',
    padding: wp('3%'),
    borderRadius: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minHeight: wp('45%'),
  },
  cropImageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: wp('3%'),
    position: 'relative',
    borderRadius: wp('3%'),
    overflow: 'hidden',
  },
  cropItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: wp('3%'),
  },
  placeholderImage: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: RFValue(20),
    fontWeight: '600',
  },
  selectionIndicator: {
    position: 'absolute',
    top: wp('2%'),
    right: wp('2%'),
    zIndex: 1,
  },
  checkbox: {
    width: wp('6%'),
    height: wp('6%'),
    borderRadius: wp('3%'),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#4CAF50',
  },
  cropItemInfo: {
    width: '100%',
    paddingHorizontal: wp('1%'),
    alignItems: 'center',
  },
  cropItemName: {
    fontSize: RFValue(13),
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: wp('1%'),
    lineHeight: RFValue(16),
  },
  cropItemCategory: {
    fontSize: RFValue(11),
    textAlign: 'center',
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('4%'),
    minHeight: SCREEN_HEIGHT * 0.3,
  },
  loadingText: {
    marginTop: wp('2%'),
    fontSize: RFValue(14),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('4%'),
    minHeight: SCREEN_HEIGHT * 0.3,
  },
  errorText: {
    marginTop: wp('2%'),
    fontSize: RFValue(14),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('4%'),
    minHeight: SCREEN_HEIGHT * 0.3,
  },
  emptyText: {
    marginTop: wp('2%'),
    fontSize: RFValue(14),
    textAlign: 'center',
  },
});

export default CropSelectorDropdown;