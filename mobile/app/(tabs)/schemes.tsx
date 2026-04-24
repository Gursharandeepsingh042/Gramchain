import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { radius, shadows, spacing } from '@/constants/design';

const SCHEMES = [
  {
    id: 'day-nrlm',
    name: 'DAY-NRLM',
    fullName: 'Deendayal Antyodaya Yojana - National Rural Livelihoods Mission',
    icon: '🌾',
    eligibility: ['Rural poor households', 'Women Self Help Groups (SHGs)', 'Must be categorized under BPL (Below Poverty Line)'],
    benefits: ['Revolving Fund (RF) and Community Investment Fund (CIF)', 'Interest subvention on bank loans', 'Livelihood support and training'],
    url: 'https://www.myscheme.gov.in/schemes/day-nrlm'
  },
  {
    id: 'yss',
    name: 'Yuva Sahakar Scheme',
    fullName: 'Yuva Sahakar - Cooperative Enterprise Support and Innovation Scheme',
    icon: '🤝',
    eligibility: ['Cooperatives that have been in operation for at least one year', 'New cooperatives formed by youth, women, or SC/ST'],
    benefits: ['Fund up to 80% of project cost for specific categories', 'Low interest term loans', 'Encourages startups in the cooperative sector'],
    url: 'https://www.myscheme.gov.in/schemes/yss'
  },
  {
    id: 'cbssc-msy',
    name: 'Mahila Samriddhi Yojana',
    fullName: 'CBSSC Mahila Samriddhi Yojana',
    icon: '👩‍💼',
    eligibility: ['Women entrepreneurs', 'Belonging to backward classes', 'Annual family income below a specified limit'],
    benefits: ['Microfinance loans up to ₹1,40,000', 'Subsidized interest rates', 'Training and skill development programs'],
    url: 'https://www.myscheme.gov.in/schemes/cbssc-msy'
  },
  {
    id: 'visvas',
    name: 'VISVAS Yojana',
    fullName: 'Vanchit Ikai Samooh aur Vargon ki Aarthik Sahayata',
    icon: '🏛️',
    eligibility: ['SC and OBC Self Help Groups', 'Individual entrepreneurs from SC/OBC with family income limit'],
    benefits: ['Interest subvention at 5% p.a.', 'Direct benefit transfer to loan accounts', 'Quick sanctioning through banks'],
    url: 'https://www.myscheme.gov.in/schemes/visvas'
  },
  {
    id: 'pmfme',
    name: 'PMFME Scheme',
    fullName: 'Pradhan Mantri Formalisation of Micro food processing Enterprises',
    icon: '🍲',
    eligibility: ['Micro food processing units', 'FPOs, SHGs, and Cooperatives involved in food processing'],
    benefits: ['Credit-linked capital subsidy at 35%', 'Seed capital for SHG members', 'Support for branding and marketing'],
    url: 'https://www.myscheme.gov.in/schemes/pmfme'
  },
  {
    id: 'giaspfammwshg',
    name: 'Agri-Machinery for SHGs',
    fullName: 'Grant in aid to States for provision of fixed agriculture machineries to Women SHGs',
    icon: '🚜',
    eligibility: ['Women Self Help Groups engaged in agriculture', 'Registered under NRLM or State rural missions'],
    benefits: ['Financial grant for purchasing farming equipment', 'Mechanization of agriculture to reduce physical labor', 'Increased productivity and income'],
    url: 'https://www.myscheme.gov.in/schemes/giaspfammwshg'
  },
  {
    id: 'prerana',
    name: 'Prerana Scheme',
    fullName: 'Prerana',
    icon: '✨',
    eligibility: ['Women entrepreneurs and SHGs', 'Individuals looking for skill enhancement'],
    benefits: ['Marketing and exhibition support', 'Subsidized stall charges in national fairs', 'Capacity building workshops'],
    url: 'https://www.myscheme.gov.in/schemes/prerana'
  },
  {
    id: 'isds',
    name: 'ISDS',
    fullName: 'Integrated Skill Development Scheme',
    icon: '🧵',
    eligibility: ['Unemployed youth and women', 'Individuals seeking employment in textiles and allied sectors'],
    benefits: ['Free skill training and certification', 'Placement assistance', 'Stipend during the training period'],
    url: 'https://www.myscheme.gov.in/schemes/isds'
  },
  {
    id: 'apds',
    name: 'Animal Husbandry',
    fullName: 'Animal Husbandry Infrastructure Development Fund',
    icon: '🐄',
    eligibility: ['FPOs, MSMEs, Private Companies', 'Individual entrepreneurs in dairy and meat processing'],
    benefits: ['3% interest subvention', 'Up to 90% loan component', '2-year moratorium on principal repayment'],
    url: 'https://www.myscheme.gov.in/schemes/apds'
  },
  {
    id: 'dsctassgcsccm',
    name: 'Credit Guarantee Scheme',
    fullName: 'Credit Guarantee Scheme for Micro & Small Enterprises',
    icon: '🛡️',
    eligibility: ['New and existing Micro and Small Enterprises', 'Manufacturing or service sector units'],
    benefits: ['Collateral-free loans up to ₹200 lakhs', 'Guarantee cover up to 85%', 'Rehabilitation support for sick units'],
    url: 'https://www.myscheme.gov.in/schemes/dsctassgcsccm'
  }
];

export default function SchemesScreen() {
    const [selectedScheme, setSelectedScheme] = useState<any>(null);

    const openSchemeLink = (url: string) => {
        Linking.openURL(url).catch((err) => console.error('An error occurred', err));
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.title}>Govt Schemes</Text>
                <Text style={styles.subtitle}>Explore financial models & support</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {SCHEMES.map((scheme) => (
                    <TouchableOpacity
                        key={scheme.id}
                        style={[styles.card, shadows.sm]}
                        onPress={() => setSelectedScheme(scheme)}
                    >
                        <View style={styles.cardHeader}>
                            <View style={styles.iconContainer}>
                                <Text style={styles.cardIcon}>{scheme.icon}</Text>
                            </View>
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardTitle}>{scheme.name}</Text>
                                <Text style={styles.cardChevron} numberOfLines={1}>{scheme.fullName}</Text>
                            </View>
                            <Text style={styles.chevron}>»</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Modal
                visible={!!selectedScheme}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedScheme(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, shadows.lg]}>
                        {selectedScheme && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalTitleRow}>
                                        <Text style={styles.modalIcon}>{selectedScheme.icon}</Text>
                                        <Text style={styles.modalTitle}>{selectedScheme.name}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedScheme(null)}>
                                        <Text style={styles.closeBtnText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                                
                                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                                    <Text style={styles.modalFullName}>{selectedScheme.fullName}</Text>
                                    
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Eligibility</Text>
                                        {selectedScheme.eligibility.map((item: string, idx: number) => (
                                            <View key={idx} style={styles.listItem}>
                                                <Text style={styles.bullet}>•</Text>
                                                <Text style={styles.listText}>{item}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Benefits</Text>
                                        {selectedScheme.benefits.map((item: string, idx: number) => (
                                            <View key={idx} style={styles.listItem}>
                                                <Text style={styles.bullet}>•</Text>
                                                <Text style={styles.listText}>{item}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity 
                                        style={[styles.linkBtn, shadows.green]} 
                                        onPress={() => openSchemeLink(selectedScheme.url)}
                                    >
                                        <Text style={styles.linkBtnText}>Apply / View Official Site</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.screenPadding,
        paddingTop: 16,
        paddingBottom: 20,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: 4,
    },
    scroll: {
        padding: spacing.screenPadding,
        paddingBottom: 100,
        gap: 16,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.gray[100],
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: radius.xl,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardIcon: {
        fontSize: 24,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 4,
    },
    cardChevron: {
        fontSize: 13,
        color: colors.text.tertiary,
    },
    chevron: {
        fontSize: 24,
        color: colors.gray[300],
        marginLeft: 10,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius['3xl'],
        borderTopRightRadius: radius['3xl'],
        height: '80%',
        paddingTop: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    modalIcon: {
        fontSize: 32,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text.primary,
        flex: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        backgroundColor: colors.gray[100],
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        fontSize: 14,
        color: colors.text.secondary,
        fontWeight: 'bold',
    },
    modalScroll: {
        paddingHorizontal: 24,
    },
    modalFullName: {
        fontSize: 15,
        color: colors.primary[600],
        fontWeight: '600',
        marginVertical: 16,
        fontStyle: 'italic'
    },
    section: {
        marginBottom: 24,
        backgroundColor: colors.gray[50],
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.gray[100],
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 12,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    bullet: {
        fontSize: 16,
        color: colors.primary[500],
        marginRight: 8,
        marginTop: -1,
    },
    listText: {
        fontSize: 15,
        color: colors.text.secondary,
        flex: 1,
        lineHeight: 22,
    },
    modalFooter: {
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        borderTopWidth: 1,
        borderTopColor: colors.gray[100],
        backgroundColor: colors.surface,
    },
    linkBtn: {
        backgroundColor: colors.primary[600],
        borderRadius: radius.button,
        paddingVertical: spacing.buttonPaddingV,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkBtnText: {
        color: colors.surface,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
