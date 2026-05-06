import { NotificationType } from '@prisma/client'

export interface NotificationTemplate {
  title: string
  body: string
}

export type TemplateMap = Record<string, NotificationTemplate>

export const NOTIFICATION_TEMPLATES: Record<NotificationType, Record<'en' | 'hi', (data?: any) => NotificationTemplate>> = {
  LOAN_APPROVAL_REQUEST: {
    en: (data) => ({ title: 'Loan Request', body: `${data?.name || 'A member'} has requested a loan of ₹${data?.amount}.` }),
    hi: (data) => ({ title: 'ऋण अनुरोध', body: `${data?.name || 'एक सदस्य'} ने ₹${data?.amount} के ऋण का अनुरोध किया है।` })
  },
  LOAN_APPROVED: {
    en: (data) => ({ title: 'Loan Approved', body: `Your loan of ₹${data?.amount} has been approved.` }),
    hi: (data) => ({ title: 'ऋण स्वीकृत', body: `आपका ₹${data?.amount} का ऋण स्वीकृत हो गया है।` })
  },
  LOAN_REJECTED: {
    en: () => ({ title: 'Loan Rejected', body: 'Your loan request was rejected by the group leader.' }),
    hi: () => ({ title: 'ऋण अस्वीकृत', body: 'आपके ऋण अनुरोध को समूह नेता द्वारा अस्वीकार कर दिया गया है।' })
  },
  MEMBER_REMOVED: {
    en: (data) => ({ title: 'Removed from Group', body: `You have been removed from the group ${data?.groupName}.` }),
    hi: (data) => ({ title: 'समूह से हटाया गया', body: `आपको समूह ${data?.groupName} से हटा दिया गया है।` })
  },
  GROUP_INVITE: {
    en: (data) => ({ title: 'Group Invitation', body: `You have been invited to join ${data?.groupName}.` }),
    hi: (data) => ({ title: 'समूह आमंत्रण', body: `आपको ${data?.groupName} में शामिल होने के लिए आमंत्रित किया गया है।` })
  },
  DISSOLUTION_VOTE: {
    en: (data) => ({ title: 'Group Dissolution Vote', body: `A vote to dissolve ${data?.groupName} has started.` }),
    hi: (data) => ({ title: 'समूह विघटन वोट', body: `${data?.groupName} को भंग करने के लिए मतदान शुरू हो गया है।` })
  },
  KYC_REMINDER: {
    en: () => ({ title: 'KYC Pending', body: 'Please complete your KYC to unlock all features.' }),
    hi: () => ({ title: 'KYC लंबित', body: 'कृपया सभी सुविधाओं को अनलॉक करने के लिए अपना KYC पूरा करें।' })
  },
  GENERAL: {
    en: (data) => ({ title: data?.title || 'Notice', body: data?.body || '' }),
    hi: (data) => ({ title: data?.title || 'सूचना', body: data?.body || '' })
  }
}

export function getTemplate(type: NotificationType, lang: string = 'en', data?: any): NotificationTemplate {
  const language = lang === 'hi' ? 'hi' : 'en'
  const templateFn = NOTIFICATION_TEMPLATES[type]?.[language] || NOTIFICATION_TEMPLATES.GENERAL[language]
  return templateFn(data)
}
