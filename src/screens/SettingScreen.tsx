
import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    StyleSheet,
} from 'react-native';
import { BottomNav } from '../components/BottomNav';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme/colors';
import { calculateBMI, getBMICategory, UserProfile, loadUserProfile, saveUserProfile } from '../utils/UserProfileManager';
import { useToast } from '../services/ToastService';

const DEFAULT_PROFILE: UserProfile = {
    name: '',
    age: '',
    gender: 'Male',
    weight: '',
    height: '',
};

export const SettingsScreen: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    // Load profile on mount
    useEffect(() => {
        const init = async () => {
            const data = await loadUserProfile();
            if (data) {
                setProfile(data);
            }
        };
        init();
    }, []);

    const handleSave = async () => {
        if (!profile.name.trim()) {
            showToast('Please enter your name', 'error', 'bottom');
            return;
        }
        if (!profile.age.trim()) {
            showToast('Please enter your age', 'error', 'bottom');
            return;
        }
        if (!profile.weight.trim() || !profile.height.trim()) {
            showToast('Please enter weight and height', 'error', 'bottom');
            return;
        }

        setIsSaving(true);
        try {
            await saveUserProfile(profile);
            showToast('Profile saved successfully', 'success', 'bottom');
        } catch (error) {
            showToast('Failed to save profile', 'error', 'bottom');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePickImage = () => {
        const options = {
            mediaType: 'photo' as const,
            includeBase64: true,
            maxWidth: 300,
            maxHeight: 300,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                return;
            }
            if (response.errorCode) {
                showToast('Failed to pick image', 'error', 'bottom');
                return;
            }

            if (response.assets && response.assets[0]) {
                const asset = response.assets[0];
                const base64 = `data:image/jpeg;base64,${asset.base64}`;
                setProfile(prev => ({ ...prev, profileImage: base64 }));
            }
        });
    };

    // Calculate BMI
    const bmiValue = useMemo(() => {
        if (profile.weight && profile.height) {
            return calculateBMI(parseFloat(profile.weight), parseFloat(profile.height));
        }
        return null;
    }, [profile.weight, profile.height]);

    const bmiCategory = bmiValue ? getBMICategory(bmiValue) : '';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={AppColors.navyMid} />
            
            <View style={styles.headerGradientContainer}>
                <LinearGradient
                    colors={[AppColors.navyMid, '#2D5A88']}
                    style={styles.headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Profile</Text>
                        <Text style={styles.headerSubtitle}>Manage your health information</Text>
                    </View>
                </LinearGradient>
            </View>

            <ScrollView 
                style={styles.scrollView} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Profile Picture Section */}
                <View style={styles.profilePictureSection}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.profilePictureWrapper}>
                        <View style={styles.profileImageContainer}>
                            {profile.profileImage ? (
                                <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
                            ) : (
                                <View style={styles.profileImagePlaceholder}>
                                    <MaterialCommunityIcons name="account" size={70} color="#CBD5E1" />
                                </View>
                            )}
                        </View>
                        <LinearGradient
                            colors={['#3B82F6', '#2563EB']}
                            style={styles.editBadge}
                        >
                            <MaterialCommunityIcons name="camera-plus" size={18} color="#FFFFFF" />
                        </LinearGradient>
                    </TouchableOpacity>
                    <Text style={styles.profileNameDisplay}>{profile.name || 'Your Name'}</Text>
                </View>

                {/* Info Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Personal Details</Text>
                    
                    {/* Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>FULL NAME</Text>
                        <View style={styles.inputWrapper}>
                            <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your name"
                                value={profile.name}
                                onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        {/* Age */}
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.inputLabel}>AGE</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Years"
                                    value={profile.age}
                                    onChangeText={(text) => setProfile(prev => ({ ...prev, age: text }))}
                                    keyboardType="numeric"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        {/* Gender selection as a row of pills */}
                        <View style={[styles.inputGroup, { flex: 2 }]}>
                            <Text style={styles.inputLabel}>GENDER</Text>
                            <View style={styles.genderContainer}>
                                {(['Male', 'Female', 'Other'] as const).map((gender) => (
                                    <TouchableOpacity
                                        key={gender}
                                        style={[
                                            styles.genderPill,
                                            profile.gender === gender && styles.genderPillActive,
                                        ]}
                                        onPress={() => setProfile(prev => ({ ...prev, gender }))}
                                    >
                                        <Text
                                            style={[
                                                styles.genderPillText,
                                                profile.gender === gender && styles.genderPillTextActive,
                                            ]}
                                        >
                                            {gender}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Health Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Physical Metrics</Text>
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                            <Text style={styles.inputLabel}>WEIGHT (KG)</Text>
                            <View style={styles.inputWrapper}>
                                <MaterialCommunityIcons name="weight-kilogram" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="00.0"
                                    value={profile.weight}
                                    onChangeText={(text) => setProfile(prev => ({ ...prev, weight: text }))}
                                    keyboardType="decimal-pad"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>HEIGHT (CM)</Text>
                            <View style={styles.inputWrapper}>
                                <MaterialCommunityIcons name="human-male-height" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="000"
                                    value={profile.height}
                                    onChangeText={(text) => setProfile(prev => ({ ...prev, height: text }))}
                                    keyboardType="decimal-pad"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>
                    </View>

                    {/* BMI Display Widget */}
                    {bmiValue && (
                        <View style={styles.bmiDisplayCard}>
                            <View style={styles.bmiInfo}>
                                <Text style={styles.bmiValueLabel}>Body Mass Index (BMI)</Text>
                                <View style={styles.bmiMainRow}>
                                    <Text style={styles.bmiValueText}>{bmiValue.toFixed(1)}</Text>
                                    <View style={[styles.bmiBadge, { backgroundColor: getBMIColor(bmiCategory) }]}>
                                        <Text style={styles.bmiBadgeText}>{bmiCategory}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{ opacity: 0.2 }}>
                                <MaterialCommunityIcons name="heart-pulse" size={40} color={AppColors.navyMid} />
                            </View>
                        </View>
                    )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[AppColors.navyMid, '#2D5A88']}
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {isSaving ? (
                            <MaterialCommunityIcons name="circle-slice-8" size={20} color="#FFFFFF" style={styles.spinningIcon} />
                        ) : (
                            <MaterialCommunityIcons name="check-bold" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.saveButtonText}>{isSaving ? 'SAVING...' : 'SAVE CHANGES'}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.bottomSpacer} />
            </ScrollView>
            <BottomNav activeTab="Settings" />
        </SafeAreaView>
    );
};

const getBMIColor = (category: string): string => {
    switch (category) {
        case 'Underweight':
            return '#87CEEB'; // Light blue
        case 'Normal':
            return '#90EE90'; // Light green
        case 'Overweight':
            return '#FFD700'; // Gold
        case 'Obese':
            return '#FF6B6B'; // Red
        default:
            return '#DDD';
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerGradientContainer: {
        width: '100%',
        height: 180,
    },
    headerGradient: {
        width: '100%',
        height: '100%',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    headerContent: {
        marginTop: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
    },
    scrollView: {
        flex: 1,
        marginTop: -40,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    profilePictureSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profilePictureWrapper: {
        position: 'relative',
    },
    profileImageContainer: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        padding: 4,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        elevation: 4,
    },
    profileNameDisplay: {
        fontSize: 22,
        fontWeight: 'bold',
        color: AppColors.navyMid,
        marginTop: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: AppColors.navyMid,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#94A3B8',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1E293B',
    },
    genderContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    genderPill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    genderPillActive: {
        backgroundColor: '#FFFFFF',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    genderPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    genderPillTextActive: {
        color: AppColors.navyMid,
    },
    bmiDisplayCard: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 16,
        marginTop: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bmiInfo: {
        flex: 1,
    },
    bmiValueLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    bmiMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bmiValueText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: AppColors.navyMid,
    },
    bmiBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    bmiBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    bmiIconBox: {
        marginLeft: 12,
    },
    saveButton: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: AppColors.navyMid,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        marginTop: 8,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    spinningIcon: {
        marginRight: 8,
    },
    bottomSpacer: {
        height: 40,
    },
});